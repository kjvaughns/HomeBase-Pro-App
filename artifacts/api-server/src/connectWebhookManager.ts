import { getStripe } from "./stripeConnectService";
import { pool } from "./db";

const SETTING_KEY = "stripe_connect_webhook_secret";

const CONNECT_WEBHOOK_EVENTS = [
  "account.updated",
  "charge.refunded",
  "checkout.session.completed",
  "invoice.finalized",
  "invoice.paid",
  "invoice.payment_failed",
  "payment_intent.payment_failed",
  "payment_intent.succeeded",
  "payout.created",
  "payout.failed",
  "payout.paid",
];

export async function getStoredConnectSecret(): Promise<string | null> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      "SELECT value FROM app_settings WHERE key = $1 LIMIT 1",
      [SETTING_KEY],
    );
    return (res.rows[0]?.value as string) ?? null;
  } catch {
    return null;
  } finally {
    client.release();
  }
}

async function storeConnectSecret(secret: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [SETTING_KEY, secret],
    );
  } finally {
    client.release();
  }
}

export async function ensureConnectWebhook(baseUrl: string): Promise<void> {
  const connectUrl = `${baseUrl}/api/stripe/webhook/connect`;
  const stripe = getStripe();

  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });

    const existing = endpoints.data.find((ep) => ep.url === connectUrl);

    if (existing) {
      const storedSecret = await getStoredConnectSecret();

      if (storedSecret) {
        const missingEvents = CONNECT_WEBHOOK_EVENTS.filter(
          (e) => !existing.enabled_events.includes(e),
        );
        if (missingEvents.length > 0) {
          const merged = Array.from(
            new Set([...existing.enabled_events, ...CONNECT_WEBHOOK_EVENTS]),
          );
          await stripe.webhookEndpoints.update(existing.id, {
            enabled_events: merged as any,
          });
          console.log(
            `[connect-webhook] Updated events on ${existing.id}: added ${missingEvents.join(", ")}`,
          );
        } else {
          console.log(
            `[connect-webhook] Webhook ${existing.id} up-to-date, secret already stored`,
          );
        }
        return;
      }

      console.log(
        `[connect-webhook] Webhook ${existing.id} found but secret unknown — recreating to obtain fresh secret`,
      );
      await stripe.webhookEndpoints.del(existing.id);
    }

    const created = await stripe.webhookEndpoints.create({
      url: connectUrl,
      enabled_events: CONNECT_WEBHOOK_EVENTS as any,
      connect: true,
      description: "HomeBase Connect webhook (auto-managed)",
    });

    if (!created.secret) {
      console.error(
        "[connect-webhook] Stripe did not return a secret on create — check API version",
      );
      return;
    }

    await storeConnectSecret(created.secret);
    console.log(
      `[connect-webhook] Created webhook ${created.id} at ${connectUrl} and stored signing secret`,
    );
  } catch (err: any) {
    console.error(
      "[connect-webhook] Failed to ensure Connect webhook:",
      err?.message ?? err,
    );
  }
}
