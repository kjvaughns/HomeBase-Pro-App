import express from "express";
import cookieParser from "cookie-parser";
import type { Request, Response, NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { runMigrations } from 'stripe-replit-sync';
import { runBootMigrations } from "./dbMigrations";
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { handleStripeWebhook } from "./stripeConnectService";
import { db, pool } from "./db";
import cron from "node-cron";
import { eq, and, gte, lte, lt } from "drizzle-orm";
import { appointments, invoices, clients, providers, users } from "@shared/schema";
import { dispatch, hasDeliveryForRecord } from "./notificationService";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    origins.add("https://homebaseproapp.com");
    origins.add("https://api.homebaseproapp.com");

    const origin = req.header("origin");

    // Allow localhost origins for Expo web development (any port)
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupStripeWebhook(app: express.Application) {
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const signature = req.headers['stripe-signature'];

      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature' });
      }

      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;

        if (!Buffer.isBuffer(req.body)) {
          console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer.');
          return res.status(500).json({ error: 'Webhook processing error' });
        }

        await WebhookHandlers.processWebhook(req.body as Buffer, sig);
        res.status(200).json({ received: true });
      } catch (error: any) {
        console.error('Webhook error:', error.message);
        res.status(400).json({ error: 'Webhook processing error' });
      }
    }
  );
}

function setupStripeConnectWebhook(app: express.Application) {
  // MUST be registered before express.json() so req.body is the raw Buffer
  // required by Stripe's cryptographic signature verification.
  // Signature verification is UNCONDITIONAL — no fallback in any environment.
  app.post(
    "/api/webhooks/stripe-connect",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"];
      const endpointSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

      if (!sig) {
        return res.status(400).json({ error: "Missing stripe-signature header" });
      }

      if (!endpointSecret) {
        console.error("[webhook] STRIPE_CONNECT_WEBHOOK_SECRET is not set — Connect webhook rejected");
        return res.status(400).json({ error: "Webhook secret not configured" });
      }

      const stripe = (await import("./stripeClient")).getStripe();
      let event: any;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err: any) {
        console.error("[webhook] Stripe Connect signature verification failed:", err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      try {
        const result = await handleStripeWebhook(event);
        res.json(result);
      } catch (error: any) {
        console.error("[webhook] Stripe Connect processing error:", error);
        res.status(500).json({ error: error.message || "Webhook processing failed" });
      }
    }
  );
}

function setupBodyParsing(app: express.Application) {
  app.use(cookieParser());

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

async function initStripe() {
  const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log('DATABASE_URL not found, skipping Stripe initialization');
    return;
  }

  try {
    console.log('Initializing Stripe schema...');

    // Pre-create stripe.invoice_status to avoid a name-collision bug in the
    // stripe-replit-sync migration 0005_invoices.sql. That migration checks for
    // invoice_status by typname only (no schema filter), finds the app's
    // public.invoice_status enum, skips creation, then fails building
    // stripe.invoices which references "stripe"."invoice_status". By creating
    // it here first (schema-qualified) the migration table creation succeeds.
    try {
      const client = await pool.connect();
      try {
        await client.query(`CREATE SCHEMA IF NOT EXISTS stripe;`);
        await client.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_type t
              JOIN pg_namespace n ON t.typnamespace = n.oid
              WHERE t.typname = 'invoice_status' AND n.nspname = 'stripe'
            ) THEN
              CREATE TYPE "stripe"."invoice_status" AS ENUM ('draft', 'open', 'paid', 'uncollectible', 'void');
            END IF;
          END$$;
        `);
      } finally {
        client.release();
      }
    } catch (preFixError: any) {
      console.log('Stripe pre-migration setup note:', preFixError.message?.slice(0, 100));
    }

    try {
      await runMigrations({ databaseUrl });
      console.log('Stripe schema ready');
    } catch (migrationError: any) {
      console.log('Stripe migration skipped (may already exist or pending setup):', migrationError.message?.slice(0, 100));
    }

    try {
      const stripeSync = await getStripeSync();

      console.log('Setting up managed webhook...');
      const webhookBaseUrl = process.env.REPLIT_DOMAINS?.split(',')[0]
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : null;
      if (!webhookBaseUrl) {
        console.log('Stripe webhook setup skipped: REPLIT_DOMAINS not set');
      } else {
        const { webhook } = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`
        );
        console.log(`Webhook configured: ${webhook?.url ?? 'unknown'}`);
      }

      console.log('Syncing Stripe data...');
      stripeSync.syncBackfill()
        .then(() => {
          console.log('Stripe data synced');
        })
        .catch((err: any) => {
          console.log('Stripe data sync skipped:', err.message?.slice(0, 100));
        });
    } catch (syncError: any) {
      console.log('Stripe sync setup skipped:', syncError.message?.slice(0, 100));
    }
  } catch (error: any) {
    console.log('Stripe initialization skipped:', error.message?.slice(0, 100));
  }
}

const SENSITIVE_FIELDS = new Set(["password", "token", "secret", "accessToken", "refreshToken"]);

function redactSensitive(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitive);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = SENSITIVE_FIELDS.has(key) ? "[REDACTED]" : redactSensitive(value);
  }
  return result;
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      const requestBody = req.body && typeof req.body === "object" ? req.body : undefined;
      if (requestBody && Object.keys(requestBody).length > 0) {
        const redactedBody = JSON.stringify(redactSensitive(requestBody));
        if (redactedBody.length < 200) {
          logLine += ` body:${redactedBody}`;
        }
      }

      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(redactSensitive(capturedJsonResponse))}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  // Try to use the live tunnel URL written by expo-start.py; fall back to Replit host.
  let expFullUrl = `exps://${expsUrl}`;
  try {
    const tunnelUrl = fs.readFileSync("/tmp/expo-tunnel-url.txt", "utf8").trim();
    if (tunnelUrl) expFullUrl = tunnelUrl;
  } catch (_) {}

  log(`baseUrl`, baseUrl);
  log(`expFullUrl`, expFullUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXP_FULL_URL_PLACEHOLDER/g, expFullUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function setupMetroProxy(app: express.Application) {
  const METRO_PORT = 8081;
  const metroProxy = createProxyMiddleware({
    pathFilter: (path: string, req: any) =>
      path.startsWith("/_expo") ||
      path.startsWith("/index.bundle") ||
      path.startsWith("/index.map") ||
      path.startsWith("/__metro__") ||
      path.startsWith("/__hmr") ||
      path.startsWith("/hot") ||
      path.startsWith("/debugger-ui") ||
      path.startsWith("/client/") ||
      (path.startsWith("/assets/") && !!(req.query?.platform || req.query?.hash || req.headers?.["expo-platform"])) ||
      (path === "/" && !!(req.headers && req.headers["expo-platform"])),
    target: `http://localhost:${METRO_PORT}`,
    changeOrigin: true,
    ws: true,
    proxyTimeout: 10 * 60 * 1000,
    timeout: 10 * 60 * 1000,
    on: {
      error: (_err: any, _req: any, res: any) => {
        if (res && typeof res.status === "function" && !res.headersSent) {
          res.status(502).send("Metro dev server not reachable");
        }
      },
    },
  });

  // Mount globally so the full path is preserved when forwarding to Metro
  app.use(metroProxy);
  log("Metro proxy configured: /_expo/*, /client/*, /assets/* → localhost:8081");
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  // Backward-compatible redirect: old /book/:slug → /providers/:slug
  app.get("/book/:slug", (req: Request<{ slug: string }>, res: Response) => {
    res.redirect(301, `/providers/${req.params.slug}`);
  });

  // Public booking page — served at /providers/:slug (SSR)
  app.get("/providers/:slug", async (req: Request<{ slug: string }>, res: Response) => {
    try {
      const { renderBookingPage } = await import("./bookingPage");
      const { html, status } = await renderBookingPage(req.params.slug, db);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.status(status).send(html);
    } catch (err: any) {
      console.error("Booking page render error:", err);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(500).send("<!DOCTYPE html><html><body><h1>Internal Server Error</h1></body></html>");
    }
  });

  log("Serving static Expo files with dynamic manifest routing");

  // Live Expo Go QR code page — reads the tunnel URL written by expo-start.py
  app.get("/qr", (_req: Request, res: Response) => {
    let tunnelUrl = "";
    try {
      tunnelUrl = fs.readFileSync("/tmp/expo-tunnel-url.txt", "utf8").trim();
    } catch (_) {}

    const ready = !!tunnelUrl;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="5">
  <title>HomeBase - Open in Expo Go</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #111;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
    }
    .card {
      background: #1c1c1e;
      border-radius: 20px;
      padding: 40px 32px;
      text-align: center;
      max-width: 360px;
      width: 100%;
    }
    .dot {
      width: 10px; height: 10px; border-radius: 50%;
      display: inline-block; margin-right: 8px;
      background: ${ready ? "#38AE5F" : "#f59e0b"};
    }
    .status {
      font-size: 13px;
      color: ${ready ? "#38AE5F" : "#f59e0b"};
      margin-bottom: 24px;
      display: flex; align-items: center; justify-content: center;
    }
    h1 { font-size: 22px; font-weight: 600; margin-bottom: 8px; }
    .sub { font-size: 14px; color: #888; margin-bottom: 28px; line-height: 1.5; }
    #qr-wrap {
      background: #fff;
      border-radius: 12px;
      padding: 16px;
      display: inline-block;
      margin-bottom: 24px;
    }
    .url-box {
      background: #2c2c2e;
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 13px;
      color: #aaa;
      word-break: break-all;
      margin-bottom: 8px;
    }
    .hint { font-size: 12px; color: #555; }
    .spinner {
      width: 48px; height: 48px;
      border: 3px solid #333;
      border-top-color: #38AE5F;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="status"><span class="dot"></span>${ready ? "Tunnel ready" : "Waiting for Metro..."}</div>
    <h1>Open in Expo Go</h1>
    <p class="sub">Scan with your iPhone camera to open HomeBase in Expo Go</p>
    ${ready ? `
    <div id="qr-wrap"><canvas id="qr"></canvas></div>
    <div class="url-box">${tunnelUrl}</div>
    <p class="hint">Page refreshes automatically</p>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
    <script>
      QRCode.toCanvas(document.getElementById('qr'), '${tunnelUrl}', {
        width: 220, margin: 0, color: { dark: '#000', light: '#fff' }
      });
    <\/script>
    ` : `
    <div class="spinner"></div>
    <p class="hint">Metro is starting up. This page refreshes every 5 seconds.</p>
    `}
  </div>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  // JSON endpoint: returns the live tunnel URL written by expo-start.py
  app.get("/api/tunnel-url", (_req: Request, res: Response) => {
    let tunnelUrl: string | null = null;
    try {
      const content = fs.readFileSync("/tmp/expo-tunnel-url.txt", "utf8").trim();
      if (content) tunnelUrl = content;
    } catch (_) {}
    res.json({ url: tunnelUrl, ready: !!tunnelUrl });
  });

  // Web preview info page
  app.get("/web", (req: Request, res: Response) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} - Web Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(135deg, #0F1419 0%, #1a2633 100%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      max-width: 480px;
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: #38AE5F;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg { width: 40px; height: 40px; fill: #fff; }
    h1 { font-size: 28px; margin-bottom: 12px; }
    p { color: #888; font-size: 16px; line-height: 1.6; margin-bottom: 24px; }
    .steps {
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 24px;
      text-align: left;
      margin-bottom: 24px;
    }
    .step {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }
    .step:last-child { margin-bottom: 0; }
    .step-num {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #38AE5F;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      flex-shrink: 0;
    }
    .step-text { font-size: 15px; color: #ccc; padding-top: 3px; }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background: #38AE5F;
      color: #fff;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 500;
      font-size: 16px;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .back { margin-top: 16px; }
    .back a { color: #666; font-size: 14px; text-decoration: none; }
    .back a:hover { color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 24 24"><path d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z"/></svg>
    </div>
    <h1>Mobile App Preview</h1>
    <p>This is a native mobile app built with React Native. For the best experience, view it on your phone using Expo Go.</p>
    
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Download Expo Go from the App Store or Google Play</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Return to the landing page and scan the QR code</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">The app will open instantly on your phone</div>
      </div>
    </div>
    
    <a href="/" class="btn">Back to QR Code</a>
    <div class="back"><a href="/">Return to landing page</a></div>
  </div>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

/**
 * In production, if no pre-built static manifest exists, Metro wasn't bundled
 * at build time. Spawn Metro here so the existing proxy (setupMetroProxy) can
 * forward Expo Go requests to it. Metro runs as a long-lived child process.
 */
function maybeStartMetro() {
  if (process.env.NODE_ENV !== "production") return;

  const manifestPath = path.resolve(process.cwd(), "static-build", "ios", "manifest.json");
  if (fs.existsSync(manifestPath)) {
    log("Static Expo bundle found — skipping dynamic Metro startup.");
    return;
  }

  log("No static Expo bundle found — starting Metro dynamically for production...");

  // Stub the dotslash-based DevTools binary so libnspr4.so is never needed.
  const devToolsCandidates = [
    path.resolve(
      process.cwd(),
      "node_modules/expo/node_modules/@react-native/debugger-shell/bin/react-native-devtools",
    ),
    path.resolve(
      process.cwd(),
      "node_modules/@react-native/debugger-shell/bin/react-native-devtools",
    ),
  ];
  for (const bin of devToolsCandidates) {
    if (fs.existsSync(bin)) {
      try {
        fs.writeFileSync(bin, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
        log(`Stubbed DevTools binary: ${bin}`);
      } catch (_) {}
    }
  }

  const domain = (
    process.env.REPLIT_INTERNAL_APP_DOMAIN ||
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.EXPO_PUBLIC_DOMAIN ||
    "localhost"
  ).replace(/^https?:\/\//i, "");

  const metro = spawn(
    "npx",
    ["expo", "start", "--no-dev", "--minify", "--localhost"],
    {
      stdio: "inherit",
      detached: false,
      env: {
        ...process.env,
        EXPO_PUBLIC_DOMAIN: domain,
        CI: "1",
        REACT_NATIVE_DEBUGGER_OPEN: "0",
        EXPO_NO_INSPECTOR_PROXY: "1",
        NODE_OPTIONS: "--max-old-space-size=4096",
      },
    },
  );

  metro.on("error", (err: Error) => {
    log(`Metro spawn error (non-fatal): ${err.message}`);
  });

  metro.on("exit", (code: number | null) => {
    log(`Metro process exited with code ${code}`);
  });

  const cleanup = () => {
    try { metro.kill("SIGTERM"); } catch (_) {}
  };
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
  process.on("exit", cleanup);

  log(`Metro started (PID ${metro.pid}) — proxy will route Expo Go requests.`);
}

/**
 * Parse appointment datetime from scheduledDate (timestamp) + scheduledTime (text like "9:00 AM").
 * scheduledDate may be stored as midnight UTC for the appointment day; scheduledTime carries the
 * actual clock time. We combine them so reminder windows use the real appointment time.
 */
function parseAppointmentDatetime(scheduledDate: Date, scheduledTime: string | null): Date {
  if (!scheduledTime) return scheduledDate;
  // scheduledTime is stored as "HH:MM AM/PM" or "HH:MM" (24h)
  const base = new Date(scheduledDate);
  const match12 = scheduledTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const match24 = scheduledTime.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === 'AM' && hours === 12) hours = 0;
    if (period === 'PM' && hours !== 12) hours += 12;
    base.setHours(hours, minutes, 0, 0);
  } else if (match24) {
    base.setHours(parseInt(match24[1], 10), parseInt(match24[2], 10), 0, 0);
  }
  return base;
}

async function runBookingReminder24h(): Promise<void> {
  try {
    const now = new Date();
    // Query a broad date window (from 22h to 26h out) to account for time parsing;
    // in-memory filter then narrows to the precise 23–25h window using real appointment datetime.
    const broadFrom = new Date(now.getTime() + 22 * 60 * 60 * 1000);
    const broadTo = new Date(now.getTime() + 26 * 60 * 60 * 1000);
    const upcoming = await db.select().from(appointments).where(
      and(gte(appointments.scheduledDate, broadFrom), lte(appointments.scheduledDate, broadTo), eq(appointments.status, "confirmed"))
    );
    const windowFrom = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const windowTo = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    for (const appt of upcoming) {
      const apptDatetime = parseAppointmentDatetime(appt.scheduledDate, appt.scheduledTime);
      if (apptDatetime < windowFrom || apptDatetime > windowTo) continue;
      const alreadySent = await hasDeliveryForRecord('booking.reminder_24h', appt.id);
      if (alreadySent) continue;
      const [user, provider] = await Promise.all([
        db.select().from(users).where(eq(users.id, appt.userId)).then(r => r[0]),
        db.select().from(providers).where(eq(providers.id, appt.providerId)).then(r => r[0]),
      ]);
      if (!user?.email) continue;
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
      dispatch('booking.reminder_24h', {
        recipientUserId: user.id,
        clientEmail: user.email,
        clientName: name,
        providerName: provider?.businessName || "Your provider",
        serviceName: appt.serviceName,
        appointmentDate: apptDatetime.toLocaleDateString(),
        appointmentTime: appt.scheduledTime,
        relatedRecordType: 'appointment',
        relatedRecordId: appt.id,
      });
    }
    console.log(`[cron:24h-reminder] checked ${upcoming.length} upcoming appointments`);
  } catch (err) {
    console.error('[cron:24h-reminder] error:', err);
  }
}

async function runBookingReminder2h(): Promise<void> {
  try {
    const now = new Date();
    // Query broad window (1h–3h out), then in-memory filter to precise 1.5–2.5h window.
    const broadFrom = new Date(now.getTime() + 60 * 60 * 1000);
    const broadTo = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const upcoming = await db.select().from(appointments).where(
      and(gte(appointments.scheduledDate, broadFrom), lte(appointments.scheduledDate, broadTo), eq(appointments.status, "confirmed"))
    );
    const windowFrom = new Date(now.getTime() + 90 * 60 * 1000);
    const windowTo = new Date(now.getTime() + 150 * 60 * 1000);
    for (const appt of upcoming) {
      const apptDatetime = parseAppointmentDatetime(appt.scheduledDate, appt.scheduledTime);
      if (apptDatetime < windowFrom || apptDatetime > windowTo) continue;
      const alreadySent = await hasDeliveryForRecord('booking.reminder_2h', appt.id);
      if (alreadySent) continue;
      const [user, provider] = await Promise.all([
        db.select().from(users).where(eq(users.id, appt.userId)).then(r => r[0]),
        db.select().from(providers).where(eq(providers.id, appt.providerId)).then(r => r[0]),
      ]);
      if (!user?.email) continue;
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
      dispatch('booking.reminder_2h', {
        recipientUserId: user.id,
        clientEmail: user.email,
        clientName: name,
        providerName: provider?.businessName || "Your provider",
        serviceName: appt.serviceName,
        appointmentDate: apptDatetime.toLocaleDateString(),
        appointmentTime: appt.scheduledTime,
        relatedRecordType: 'appointment',
        relatedRecordId: appt.id,
      });
    }
    console.log(`[cron:2h-reminder] checked ${upcoming.length} upcoming appointments`);
  } catch (err) {
    console.error('[cron:2h-reminder] error:', err);
  }
}

async function runInvoiceDueReminder(): Promise<void> {
  try {
    const now = new Date();
    // Target invoices due in 2.5–3.5 days (tight 1h window around the 3-day mark)
    const from = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000);
    const dueInvoices = await db.select().from(invoices).where(
      and(
        gte(invoices.dueDate, from),
        lte(invoices.dueDate, to),
        eq(invoices.status, "sent"),
      )
    );
    for (const invoice of dueInvoices) {
      if (!invoice.clientId && !invoice.homeownerUserId) continue;
      const alreadySent = await hasDeliveryForRecord('invoice.reminder_3d', invoice.id);
      if (alreadySent) continue;
      const [client, provider] = await Promise.all([
        invoice.clientId ? db.select().from(clients).where(eq(clients.id, invoice.clientId)).then(r => r[0]) : Promise.resolve(undefined),
        db.select().from(providers).where(eq(providers.id, invoice.providerId)).then(r => r[0]),
      ]);
      // Prefer homeowner user email, fall back to client record
      let recipientEmail = client?.email;
      let recipientName = [client?.firstName, client?.lastName].filter(Boolean).join(" ") || "Client";
      let recipientUserId: string | undefined;
      if (invoice.homeownerUserId) {
        const homeowner = await db.select().from(users).where(eq(users.id, invoice.homeownerUserId)).then(r => r[0]);
        if (homeowner?.email) {
          recipientEmail = homeowner.email;
          recipientName = [homeowner.firstName, homeowner.lastName].filter(Boolean).join(" ") || "Client";
          recipientUserId = homeowner.id;
        }
      }
      if (!recipientEmail) continue;
      const msUntilDue = invoice.dueDate ? invoice.dueDate.getTime() - now.getTime() : 0;
      const daysUntilDue = Math.ceil(msUntilDue / (1000 * 60 * 60 * 24));
      dispatch('invoice.reminder_3d', {
        recipientUserId,
        clientEmail: recipientEmail,
        clientName: recipientName,
        providerName: provider?.businessName || "Service Provider",
        invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
        amount: parseFloat(invoice.total?.toString() || "0"),
        dueDate: invoice.dueDate ? invoice.dueDate.toLocaleDateString() : "Soon",
        daysUntilDue,
        paymentLink: invoice.hostedInvoiceUrl || undefined,
        relatedRecordType: 'invoice',
        relatedRecordId: invoice.id,
      });
    }
    console.log(`[cron:invoice-due-reminder] checked ${dueInvoices.length} invoices`);
  } catch (err) {
    console.error('[cron:invoice-due-reminder] error:', err);
  }
}

async function runInvoiceOverdueReminder(): Promise<void> {
  try {
    const now = new Date();
    // Target invoices that became overdue 0.5–1.5 days ago (tight window around 1-day overdue mark)
    const from = new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() - 0.5 * 24 * 60 * 60 * 1000);
    const overdueInvoices = await db.select().from(invoices).where(
      and(
        gte(invoices.dueDate, from),
        lt(invoices.dueDate, to),
        eq(invoices.status, "sent"),
      )
    );
    for (const invoice of overdueInvoices) {
      if (!invoice.clientId && !invoice.homeownerUserId) continue;
      const alreadySent = await hasDeliveryForRecord('invoice.overdue_1d', invoice.id);
      if (alreadySent) continue;
      const [client, provider] = await Promise.all([
        invoice.clientId ? db.select().from(clients).where(eq(clients.id, invoice.clientId)).then(r => r[0]) : Promise.resolve(undefined),
        db.select().from(providers).where(eq(providers.id, invoice.providerId)).then(r => r[0]),
      ]);
      // Prefer homeowner user email, fall back to client record
      let recipientEmail = client?.email;
      let recipientName = [client?.firstName, client?.lastName].filter(Boolean).join(" ") || "Client";
      let recipientUserId: string | undefined;
      if (invoice.homeownerUserId) {
        const homeowner = await db.select().from(users).where(eq(users.id, invoice.homeownerUserId)).then(r => r[0]);
        if (homeowner?.email) {
          recipientEmail = homeowner.email;
          recipientName = [homeowner.firstName, homeowner.lastName].filter(Boolean).join(" ") || "Client";
          recipientUserId = homeowner.id;
        }
      }
      if (!recipientEmail) continue;
      const msOverdue = now.getTime() - (invoice.dueDate ? invoice.dueDate.getTime() : now.getTime());
      const daysOverdue = Math.ceil(msOverdue / (1000 * 60 * 60 * 24));
      dispatch('invoice.overdue_1d', {
        recipientUserId,
        clientEmail: recipientEmail,
        clientName: recipientName,
        providerName: provider?.businessName || "Service Provider",
        invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
        amount: parseFloat(invoice.total?.toString() || "0"),
        dueDate: invoice.dueDate ? invoice.dueDate.toLocaleDateString() : "Past due",
        daysOverdue,
        paymentLink: invoice.hostedInvoiceUrl || undefined,
        relatedRecordType: 'invoice',
        relatedRecordId: invoice.id,
      });
    }
    console.log(`[cron:invoice-overdue-reminder] checked ${overdueInvoices.length} invoices`);
  } catch (err) {
    console.error('[cron:invoice-overdue-reminder] error:', err);
  }
}

function setupReminderJobs(): void {
  // 24h booking reminder — runs every hour
  cron.schedule('0 * * * *', runBookingReminder24h);
  // 2h booking reminder — runs every 30 minutes
  cron.schedule('*/30 * * * *', runBookingReminder2h);
  // 3-days-before invoice due reminder — runs daily at 9am
  cron.schedule('0 9 * * *', runInvoiceDueReminder);
  // 1-day-overdue invoice reminder — runs daily at 10am
  cron.schedule('0 10 * * *', runInvoiceOverdueReminder);
  console.log('[cron] reminder jobs scheduled: 24h/2h booking reminders, 3d/1d invoice reminders');
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

(async () => {
  await runBootMigrations();

  // Production env hard-fail guards — must run before anything else
  if (process.env.NODE_ENV === "production") {
    if (!process.env.STRIPE_CONNECT_WEBHOOK_SECRET) {
      console.error("[startup] FATAL: STRIPE_CONNECT_WEBHOOK_SECRET must be set in production");
      process.exit(1);
    }
  }

  setupCors(app);
  setupMetroProxy(app);
  setupStripeWebhook(app);          // raw-body — must precede JSON parsing
  setupStripeConnectWebhook(app);   // raw-body — must precede JSON parsing
  setupBodyParsing(app);
  setupRequestLogging(app);

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  await initStripe();

  // Start reminder cron jobs
  setupReminderJobs();

  // Start Metro dynamically if static bundle wasn't generated at build time.
  maybeStartMetro();

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );
})();
