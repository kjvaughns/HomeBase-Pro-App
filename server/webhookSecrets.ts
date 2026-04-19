// =============================================================================
// Stripe webhook signing-secret resolution
// =============================================================================
// Standardized env names: STRIPE_WEBHOOK_SECRET_PLATFORM and
// STRIPE_WEBHOOK_SECRET_CONNECT. Legacy names (STRIPE_WEBHOOK_SECRET and
// STRIPE_CONNECT_WEBHOOK_SECRET) are honored as fallbacks so an env rename
// can be rolled out without breaking deploys; a deprecation warning is logged
// once per process per legacy name.
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
