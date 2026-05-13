/**
 * Production start script.
 *
 * Starts Metro (Expo bundler) and the Express API server in parallel.
 * Metro runs as a long-lived process so Expo Go can load the JS bundle
 * on demand. The Express server proxies /_expo/*, /assets/, and manifest
 * requests to Metro automatically (setupMetroProxy in server/index.ts).
 *
 * Build phase: only compiles the Express server (esbuild, fast).
 * Run phase (this script): starts Metro + Express, both stay alive.
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripProtocol(str) {
  return str.trim().replace(/^https?:\/\//i, "");
}

function getProductionDomain() {
  const candidates = [
    process.env.REPLIT_INTERNAL_APP_DOMAIN,
    process.env.REPLIT_DEV_DOMAIN,
    process.env.EXPO_PUBLIC_DOMAIN,
  ];
  for (const c of candidates) {
    if (c) return stripProtocol(c);
  }
  // Fallback: Express is reachable on 0.0.0.0:5000; Metro on localhost:8081.
  return "localhost";
}

/**
 * Replace the dotslash-based react-native-devtools binary with a POSIX no-op.
 * The dotslash runtime needs libnspr4.so which is absent on NixOS.
 */
function stubDevToolsBinary() {
  const candidates = [
    path.join(
      __dirname,
      "../node_modules/expo/node_modules/@react-native/debugger-shell/bin/react-native-devtools",
    ),
    path.join(
      __dirname,
      "../node_modules/@react-native/debugger-shell/bin/react-native-devtools",
    ),
  ];

  for (const bin of candidates) {
    if (fs.existsSync(bin)) {
      try {
        fs.writeFileSync(bin, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
        console.log(`[prod] Stubbed DevTools binary: ${bin}`);
      } catch (err) {
        console.warn(`[prod] Could not stub DevTools binary (non-fatal): ${err.message}`);
      }
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

const domain = getProductionDomain();
console.log(`[prod] Starting HomeBase production — domain: ${domain}`);

stubDevToolsBinary();

// --- Metro (Expo bundler) ---
const metroEnv = {
  ...process.env,
  NODE_ENV: "production",
  EXPO_PUBLIC_DOMAIN: domain,
  CI: "1",
  REACT_NATIVE_DEBUGGER_OPEN: "0",
  EXPO_NO_INSPECTOR_PROXY: "1",
  NODE_OPTIONS: "--max-old-space-size=4096",
};

const metro = spawn(
  "npx",
  ["expo", "start", "--no-dev", "--minify", "--localhost"],
  { stdio: "inherit", detached: false, env: metroEnv },
);

metro.on("error", (err) => {
  console.error("[prod] Failed to start Metro:", err.message);
});

// --- Express API server ---
const serverEnv = {
  ...process.env,
  NODE_ENV: "production",
  EXPO_PUBLIC_DOMAIN: domain,
};

const server = spawn("node", ["server_dist/index.js"], {
  stdio: "inherit",
  detached: false,
  env: serverEnv,
});

server.on("error", (err) => {
  console.error("[prod] Failed to start Express:", err.message);
  process.exit(1);
});

server.on("exit", (code, signal) => {
  console.error(`[prod] Express exited (code=${code}, signal=${signal}). Shutting down.`);
  metro.kill();
  process.exit(code ?? 1);
});

// Metro crashing is non-fatal — Express still serves the API.
metro.on("exit", (code, signal) => {
  console.warn(`[prod] Metro exited (code=${code}, signal=${signal}).`);
});

// ─── Signal forwarding ───────────────────────────────────────────────────────

function shutdown(sig) {
  console.log(`[prod] Received ${sig}, shutting down…`);
  try { metro.kill(sig); } catch (_) {}
  try { server.kill(sig); } catch (_) {}
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGHUP",  () => shutdown("SIGHUP"));
