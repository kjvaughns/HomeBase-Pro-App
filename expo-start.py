#!/usr/bin/env node
// Expo Go tunnel launcher (Node.js version)
// Runs Metro with CI=1 + --tunnel, then fetches the tunnel URL
// from the manifest and displays it prominently for Expo Go.

const { spawn, execSync } = require("child_process");
const http = require("http");

// Kill any stale process on 8081
try {
  execSync("fuser -k 8081/tcp 2>/dev/null", { stdio: "ignore" });
  execSync("sleep 1", { stdio: "ignore" });
} catch (_) {}

const env = {
  ...process.env,
  CI: "1",
  REACT_NATIVE_DEBUGGER_OPEN: "0",
};

console.log("\n[HomeBase] Starting Metro with tunnel...\n");

const metro = spawn(
  "npx",
  ["expo", "start", "--go", "--tunnel", "--port", "8081"],
  { env, stdio: "inherit" }
);

metro.on("exit", (code) => process.exit(code || 0));
process.on("SIGTERM", () => metro.kill("SIGTERM"));
process.on("SIGINT", () => metro.kill("SIGINT"));

// Poll until Metro is ready and extract the tunnel URL
let attempts = 0;
const MAX_ATTEMPTS = 60; // 2 minutes total

function fetchTunnelUrl() {
  attempts++;
  if (attempts > MAX_ATTEMPTS) return;

  const req = http.get(
    {
      hostname: "localhost",
      port: 8081,
      path: "/",
      headers: { "expo-platform": "ios", "expo-protocol-version": "1" },
      timeout: 3000,
    },
    (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const manifest = JSON.parse(body);
          const host =
            manifest?.extra?.expoGo?.debuggerHost ||
            manifest?.debuggerHost;
          if (host) {
            const url = `exp://${host}`;
            console.log("\n");
            console.log("============================================");
            console.log("  EXPO GO URL READY");
            console.log("  Open Expo Go → tap 'Enter URL manually'");
            console.log(`  URL: ${url}`);
            console.log("============================================");
            console.log("\n");
            return;
          }
        } catch (_) {}
        // Not ready yet, retry
        setTimeout(fetchTunnelUrl, 2000);
      });
    }
  );
  req.on("error", () => setTimeout(fetchTunnelUrl, 2000));
  req.on("timeout", () => {
    req.destroy();
    setTimeout(fetchTunnelUrl, 2000);
  });
}

// Start polling after Metro has had time to initialize tunnel
setTimeout(fetchTunnelUrl, 15000);
