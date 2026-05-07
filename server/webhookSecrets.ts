// =============================================================================
// Stripe webhook signing-secret resolution
// =============================================================================
// Standardized env names: STRIPE_WEBHOOK_SECRET_PLATFORM and
// STRIPE_WEBHOOK_SECRET_CONNECT. Legacy names (STRIPE_WEBHOOK_SECRET and
// STRIPE_CONNECT_WEBHOOK_SECRET) are honored as fallbacks so an env rename
// can be rolled out without breaking deploys; a deprecation warning is logged
// once per process per legacy name.
//
// For the Connect endpoint the secret is also stored in the app_settings DB
// table by connectWebhookManager.ts (which auto-creates/recreates the Stripe
// webhook endpoint on startup so the secret is always current). The DB value
// takes priority so domain changes never require a manual env-var update.
//
// Lives in its own module (no side effects on import) so the regression test
// can import + exercise resolveWebhookSecret without booting the whole server.
// =============================================================================

const _legacySecretWarned: Record<string, boolean> = {};

export function resolveWebhookSecret(
  endpoint: "platform" | "connect",
): string | undefined {
  const newName =
    endpoint === "platform"
      ? "STRIPE_WEBHOOK_SECRET_PLATFORM"
      : "STRIPE_WEBHOOK_SECRET_CONNECT";
  const oldName =
    endpoint === "platform"
      ? "STRIPE_WEBHOOK_SECRET"
      : "STRIPE_CONNECT_WEBHOOK_SECRET";

  const fromNew = process.env[newName];
  if (fromNew) return fromNew;

  const fromOld = process.env[oldName];
  if (fromOld) {
    if (!_legacySecretWarned[oldName]) {
      console.warn(
        `[webhook] DEPRECATED env var ${oldName} in use — please rename to ${newName}. ` +
          `The old name will continue to work for now but should be migrated.`,
      );
      _legacySecretWarned[oldName] = true;
    }
    return fromOld;
  }

  return undefined;
}

// Async variant that checks the DB-stored Connect secret first (populated by
// connectWebhookManager.ensureConnectWebhook at startup). Falls back to env
// vars so existing deployments that set STRIPE_CONNECT_WEBHOOK_SECRET keep
// working until the first auto-managed cycle completes.
export async function resolveWebhookSecretAsync(
  endpoint: "platform" | "connect",
): Promise<string | undefined> {
  if (endpoint === "connect") {
    try {
      const { getStoredConnectSecret } = await import("./connectWebhookManager");
      const fromDb = await getStoredConnectSecret();
      if (fromDb) return fromDb;
    } catch {
      // If the DB isn't ready yet (e.g. very early startup), fall through to env.
    }
  }
  return resolveWebhookSecret(endpoint);
}
