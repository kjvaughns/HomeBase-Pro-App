#!/usr/bin/env node
// Expo Go tunnel launcher (Node.js version)
// Runs Metro with --tunnel, then fetches the tunnel URL
// from the manifest and displays it prominently for Expo Go.

const { spawn, execSync } = require("child_process");
const http = require("http");

// Aggressively kill any stale Metro/Expo processes on port 8081.
// We exclude the current PID to avoid self-termination.
const selfPid = process.pid;
try { execSync("fuser -k -KILL 8081/tcp 2>/dev/null", { stdio: "ignore" }); } catch (_) {}
try {
  // Kill processes matching "expo" but not the current node process
  execSync(
    `ps aux | grep -E '[e]xpo' | awk '{print $2}' | grep -v '^${selfPid}$' | xargs -r kill -9 2>/dev/null || true`,
    { stdio: "ignore", shell: true }
  );
} catch (_) {}
try {
  // Kill processes matching "metro"
  execSync("pkill -f 'metro' 2>/dev/null || true", { stdio: "ignore", shell: true });
} catch (_) {}
try { execSync("sleep 2", { stdio: "ignore" }); } catch (_) {}

const env = {
  ...process.env,
  REACT_NATIVE_DEBUGGER_OPEN: "0",
};

console.log("\n[HomeBase] Starting Metro with tunnel...\n");

const metro = spawn(
  "npx",
  ["expo", "start", "--go", "--tunnel", "--port", "8081"],
  { env, stdio: ["pipe", "inherit", "inherit"] }
);

// After 5 seconds, send a newline to dismiss any default-answerable prompts
// (e.g. anonymous login, "use port 8082?" if somehow still asked)
setTimeout(() => {
  try { metro.stdin.write("\n"); } catch (_) {}
}, 5000);

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
            console.log("  Open Expo Go -> tap 'Enter URL manually'");
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
