/**
 * Manual reproduction script for Task #184 (and the underlying server guard
 * added in Task #183).
 *
 * Verifies that PATCH /api/provider/:id with `{ isActive: true }` against a
 * provider that does NOT have Stripe Connect ready (chargesEnabled !== true)
 * returns HTTP 422 with `{ error: "stripe_not_ready" }`.
 *
 * Usage:
 *   BASE_URL=http://localhost:5000 \
 *   AUTH_TOKEN=<bearer token for the provider's user> \
 *   PROVIDER_ID=<provider id without chargesEnabled> \
 *   tsx server/scripts/reproIsActiveStripeGuard.ts
 *
 * Exit code 0 means the guard fired as expected; non-zero means the guard
 * is missing or returned the wrong shape.
 */

const baseUrl = process.env.BASE_URL || "http://localhost:5000";
const token = process.env.AUTH_TOKEN;
const providerId = process.env.PROVIDER_ID;

async function main() {
  if (!token || !providerId) {
    console.error(
      "Set AUTH_TOKEN and PROVIDER_ID env vars (provider must NOT have Stripe Connect chargesEnabled).",
    );
    process.exit(2);
  }

  const res = await fetch(`${baseUrl}/api/provider/${providerId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ isActive: true }),
  });

  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep body null */
  }

  console.log(`Status: ${res.status}`);
  console.log(`Body:   ${text}`);

  if (res.status !== 422) {
    console.error(`FAIL: expected 422, got ${res.status}`);
    process.exit(1);
  }
  if (!body || body.error !== "stripe_not_ready") {
    console.error(`FAIL: expected error="stripe_not_ready", got ${body?.error}`);
    process.exit(1);
  }

  console.log("PASS: server returned 422 stripe_not_ready as expected.");
}

main().catch((err) => {
  console.error("Repro script crashed:", err);
  process.exit(2);
});
