import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = new Set<string>();
      if (process.env.REPLIT_DEV_DOMAIN) {
        allowedOrigins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
        allowedOrigins.add(`https://${process.env.REPLIT_DEV_DOMAIN}:8081`);
      }
      if (process.env.REPLIT_DOMAINS) {
        for (const d of process.env.REPLIT_DOMAINS.split(",")) {
          allowedOrigins.add(`https://${d.trim()}`);
        }
      }
      callback(null, allowedOrigins.size === 0 || allowedOrigins.has(origin));
    },
    credentials: true,
  }),
);

// ─── Stripe webhook routes ────────────────────────────────────────────────────
// MUST be registered BEFORE app.use(express.json()) so that req.body is the
// raw Buffer that Stripe's signature verification requires. Once express.json()
// runs, the body is a parsed JS object and constructEventAsync will always
// throw "No signatures found matching the expected signature for payload."
// ─────────────────────────────────────────────────────────────────────────────

async function stripeWebhookHandler(
  endpoint: "platform" | "connect",
  req: Request,
  res: Response,
): Promise<void> {
  if (!Buffer.isBuffer(req.body)) {
    logger.error(
      { endpoint, bodyType: typeof req.body },
      "[stripe-webhook] req.body is not a Buffer — express.json() must have run first. " +
        "Webhook route is mis-ordered relative to the global JSON middleware.",
    );
    res.status(400).json({ error: "bad_body: raw Buffer required" });
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    logger.warn({ endpoint }, "[stripe-webhook] missing stripe-signature header");
    res.status(400).json({ error: "missing stripe-signature" });
    return;
  }

  const { resolveWebhookSecretAsync } = await import("./webhookSecrets");
  const secret = await resolveWebhookSecretAsync(endpoint);
  if (!secret) {
    logger.error(
      { endpoint },
      "[stripe-webhook] no signing secret configured — cannot verify signature",
    );
    res.status(400).json({ error: "webhook secret not configured" });
    return;
  }

  const { getUncachableStripeClient } = await import("./stripeClient");
  const stripe = await getUncachableStripeClient();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(req.body, sig, secret);
  } catch (err: any) {
    logger.warn(
      { endpoint, message: err?.message },
      "[stripe-webhook] endpoint=%s outcome=rejected reason=bad_signature message=%s",
      endpoint,
      err?.message,
    );
    res.status(400).json({ error: `bad_signature: ${err?.message}` });
    return;
  }

  try {
    const { processStripeEvent } = await import("./stripeWebhookRouter");
    await processStripeEvent(event, endpoint);
    res.status(200).json({ received: true });
  } catch (err: any) {
    logger.error(
      { endpoint, eventId: event.id, message: err?.message },
      "[stripe-webhook] handler error",
    );
    res.status(500).json({ error: "handler_error" });
  }
}

app.post(
  "/api/stripe/webhook/platform",
  express.raw({ type: "application/json" }),
  (req: Request, res: Response) => {
    stripeWebhookHandler("platform", req, res).catch((err) => {
      logger.error({ err }, "[stripe-webhook] unexpected error in platform handler");
      if (!res.headersSent) res.status(500).json({ error: "internal_error" });
    });
  },
);

app.post(
  "/api/stripe/webhook/connect",
  express.raw({ type: "application/json" }),
  (req: Request, res: Response) => {
    stripeWebhookHandler("connect", req, res).catch((err) => {
      logger.error({ err }, "[stripe-webhook] unexpected error in connect handler");
      if (!res.headersSent) res.status(500).json({ error: "internal_error" });
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", router);

export default app;
