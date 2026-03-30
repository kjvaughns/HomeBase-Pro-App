#!/usr/bin/env node
// Expo Go launcher (Node.js version)
// Runs Metro WITHOUT tunnel, using the Replit domain as the packager host.
// This avoids ngrok stability issues entirely:
//  - Expo Go connects to exps://<replit-domain>
//  - Metro (on port 8081, external port 80) handles the connection
//  - enhanceMiddleware in metro.config.js rewrites the host header so Metro accepts it
//  - Bundle download also goes through Replit's proxy

const { spawn, execSync } = require("child_process");
const http = require("http");
const fs = require("fs");

// Aggressively kill any stale Metro/Expo processes on port 8081.
const selfPid = process.pid;
try { execSync("fuser -k -KILL 8081/tcp 2>/dev/null", { stdio: "ignore" }); } catch (_) {}
try {
  execSync(
    `ps aux | grep -E '[e]xpo' | awk '{print $2}' | grep -v '^${selfPid}$' | xargs -r kill -9 2>/dev/null || true`,
    { stdio: "ignore", shell: true }
  );
} catch (_) {}
try {
  execSync("pkill -f 'metro' 2>/dev/null || true", { stdio: "ignore", shell: true });
} catch (_) {}
try { execSync("sleep 2", { stdio: "ignore" }); } catch (_) {}

// The Replit dev domain (port 80 externally → port 8081 Metro)
const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.EXPO_PUBLIC_DOMAIN || "localhost";

// API calls go to Express backend on port 5000
const apiDomain = process.env.REPLIT_DEV_DOMAIN
  ? `${process.env.REPLIT_DEV_DOMAIN}:5000`
  : process.env.EXPO_PUBLIC_DOMAIN;

// The Expo Go URL will be exps://<replitDomain> (HTTPS via Replit proxy)
const expoGoUrl = `exps://${replitDomain}`;

console.log("\n[HomeBase] Starting Metro (no tunnel)...");
console.log(`[HomeBase] Replit domain: ${replitDomain}`);
console.log(`[HomeBase] API domain: ${apiDomain}`);
console.log(`[HomeBase] Expo Go URL: ${expoGoUrl}\n`);

// Write the Expo Go URL immediately (no tunnel polling needed)
try { fs.writeFileSync("/tmp/expo-tunnel-url.txt", expoGoUrl, "utf8"); } catch (_) {}

const env = {
  ...process.env,
  REACT_NATIVE_DEBUGGER_OPEN: "0",
  // Override EXPO_PUBLIC_DOMAIN to point to Express backend (port 5000)
  EXPO_PUBLIC_DOMAIN: apiDomain,
  // Tell Metro to use the Replit domain in manifest bundle URLs (hostname only)
  REACT_NATIVE_PACKAGER_HOSTNAME: replitDomain,
  // Override the proxy URL so bundle URLs use port 80 (not 8081)
  // Replit maps external port 80 → internal 8081 (Metro)
  EXPO_PACKAGER_PROXY_URL: `http://${replitDomain}`,
};

const metro = spawn(
  "npx",
  ["expo", "start", "--port", "8081"],
  { env, stdio: ["pipe", "inherit", "inherit"] }
);

// After 5 seconds, send a newline to dismiss any default-answerable prompts
setTimeout(() => {
  try { metro.stdin.write("\n"); } catch (_) {}
}, 5000);

metro.on("exit", (code) => process.exit(code || 0));
process.on("SIGTERM", () => metro.kill("SIGTERM"));
process.on("SIGINT", () => metro.kill("SIGINT"));

// Wait for Metro to be ready, then print confirmation
let attempts = 0;
const MAX_ATTEMPTS = 60;

function checkMetroReady() {
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
          if (manifest && manifest.id) {
            console.log("\n============================================");
            console.log("  EXPO GO URL READY");
            console.log(`  URL: ${expoGoUrl}`);
            console.log("  Scan the QR code in the Replit preview pane");
            console.log("============================================\n");
            return;
          }
        } catch (_) {}
        setTimeout(checkMetroReady, 2000);
      });
    }
  );
  req.on("error", () => setTimeout(checkMetroReady, 2000));
  req.on("timeout", () => {
    req.destroy();
    setTimeout(checkMetroReady, 2000);
  });
}

setTimeout(checkMetroReady, 8000);
