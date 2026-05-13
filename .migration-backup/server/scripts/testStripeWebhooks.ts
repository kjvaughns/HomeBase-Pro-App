/**
 * Targeted regression tests for the Stripe webhook router.
 *
 * Runs against the real database (uses transient `evt_test_*` event ids that
 * are cleaned up at the end). Does NOT call Stripe — events are constructed
 * locally and signatures generated with `stripe.webhooks.generateTestHeaderString`.
 *
 * Usage:
 *   npx tsx server/scripts/testStripeWebhooks.ts
 *
 * Exits 0 on success, 1 on any failed assertion.
 */
import Stripe from "stripe";
import { db, pool } from "../db";
import { eq, like } from "drizzle-orm";
import { stripeWebhookEvents } from "../../shared/schema";
import {
  processStripeEvent,
  expectedEndpointFor,
} from "../stripeWebhookRouter";

const TEST_SECRET = "whsec_test_router_regression_secret";
const RUN_TAG = `evt_test_router_${Date.now()}`;

let pass = 0;
let fail = 0;

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  PASS  ${label}`);
    pass += 1;
  } else {
    console.error(
      `  FAIL  ${label}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`,
    );
    fail += 1;
  }
}

function makeEvent(opts: {
  id: string;
  type: string;
  account?: string | null;
  object?: any;
}): Stripe.Event {
  return {
    id: opts.id,
    object: "event",
    api_version: "2025-11-17",
    created: Math.floor(Date.now() / 1000),
    type: opts.type as any,
    data: { object: opts.object ?? { id: "obj_test_1" } } as any,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    account: opts.account ?? undefined,
  } as Stripe.Event;
}

async function main() {
  console.log(`\n=== Stripe webhook router regression tests (${RUN_TAG}) ===\n`);

  // -------------------------------------------------------------------------
  // 1. Pure-function: expectedEndpointFor
  // -------------------------------------------------------------------------
  console.log("1. expectedEndpointFor() routing rule");
  assertEq(
    expectedEndpointFor(makeEvent({ id: "x1", type: "payout.paid", account: "acct_1" })),
    "connect",
    "event.account set → connect",
  );
  assertEq(
    expectedEndpointFor(makeEvent({ id: "x2", type: "customer.subscription.updated" })),
    "platform",
    "event.account absent → platform",
  );

  // -------------------------------------------------------------------------
  // 2. Signature verification (Stripe SDK construct/verify roundtrip)
  // -------------------------------------------------------------------------
  console.log("\n2. Signature verification");
  const stripe = new Stripe("sk_test_dummy_for_signing");
  const payload = JSON.stringify({
    id: `${RUN_TAG}_sig`,
    object: "event",
    type: "invoice.finalized",
    data: { object: { id: "in_1" } },
  });
  const validHeader = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: TEST_SECRET,
  });
  let verifiedOk = false;
  try {
    stripe.webhooks.constructEvent(payload, validHeader, TEST_SECRET);
    verifiedOk = true;
  } catch {
    verifiedOk = false;
  }
  assertEq(verifiedOk, true, "valid signature accepted");

  let rejectedBadSig = false;
  try {
    stripe.webhooks.constructEvent(payload, validHeader, "whsec_wrong_secret");
  } catch {
    rejectedBadSig = true;
  }
  assertEq(rejectedBadSig, true, "wrong secret rejected");

  let rejectedTamperedPayload = false;
  try {
    stripe.webhooks.constructEvent(
      payload + "tampered",
      validHeader,
      TEST_SECRET,
    );
  } catch {
    rejectedTamperedPayload = true;
  }
  assertEq(rejectedTamperedPayload, true, "tampered payload rejected");

  // -------------------------------------------------------------------------
  // 3. Idempotent replay of invoice.paid (Task #239 acceptance criterion)
  // Uses an invoice with no homebaseInvoiceId metadata → handler treats it
  // as a non-HomeBase invoice and no-ops, while the dispatcher still
  // exercises the reservation/commit path on a real production event type.
  // -------------------------------------------------------------------------
  console.log("\n3. Idempotent replay of invoice.paid (event.id reuse)");
  const replayId = `${RUN_TAG}_replay`;
  const replayEvent = makeEvent({
    id: replayId,
    type: "invoice.paid",
    object: { id: "in_test_replay", metadata: {} },
  });
  const first = await processStripeEvent(replayEvent, "platform");
  assertEq(first.processed, true, "first delivery: processed=true");
  assertEq(first.reason, "ok", "first delivery: reason=ok");

  const second = await processStripeEvent(replayEvent, "platform");
  assertEq(second.processed, false, "second delivery: processed=false");
  assertEq(second.reason, "duplicate", "second delivery: reason=duplicate");

  // -------------------------------------------------------------------------
  // 3c. resolveWebhookSecret() env-var precedence (new name → legacy fallback)
  // -------------------------------------------------------------------------
  console.log("\n3c. resolveWebhookSecret precedence");
  const { resolveWebhookSecret } = await import("../index");
  const saved = {
    plat: process.env.STRIPE_WEBHOOK_SECRET_PLATFORM,
    platLegacy: process.env.STRIPE_WEBHOOK_SECRET,
    conn: process.env.STRIPE_WEBHOOK_SECRET_CONNECT,
    connLegacy: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  };
  try {
    process.env.STRIPE_WEBHOOK_SECRET_PLATFORM = "whsec_new_platform";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_legacy_platform";
    assertEq(
      resolveWebhookSecret("platform"),
      "whsec_new_platform",
      "platform: new name preferred over legacy",
    );
    delete process.env.STRIPE_WEBHOOK_SECRET_PLATFORM;
    assertEq(
      resolveWebhookSecret("platform"),
      "whsec_legacy_platform",
      "platform: legacy fallback when new name absent",
    );
    process.env.STRIPE_WEBHOOK_SECRET_CONNECT = "whsec_new_connect";
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_legacy_connect";
    assertEq(
      resolveWebhookSecret("connect"),
      "whsec_new_connect",
      "connect: new name preferred over legacy",
    );
    delete process.env.STRIPE_WEBHOOK_SECRET_CONNECT;
    assertEq(
      resolveWebhookSecret("connect"),
      "whsec_legacy_connect",
      "connect: legacy fallback when new name absent",
    );
  } finally {
    // Restore original env so subsequent tests / live endpoints work
    if (saved.plat !== undefined) process.env.STRIPE_WEBHOOK_SECRET_PLATFORM = saved.plat;
    else delete process.env.STRIPE_WEBHOOK_SECRET_PLATFORM;
    if (saved.platLegacy !== undefined) process.env.STRIPE_WEBHOOK_SECRET = saved.platLegacy;
    else delete process.env.STRIPE_WEBHOOK_SECRET;
    if (saved.conn !== undefined) process.env.STRIPE_WEBHOOK_SECRET_CONNECT = saved.conn;
    else delete process.env.STRIPE_WEBHOOK_SECRET_CONNECT;
    if (saved.connLegacy !== undefined) process.env.STRIPE_CONNECT_WEBHOOK_SECRET = saved.connLegacy;
    else delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  }

  // -------------------------------------------------------------------------
  // 4. Wrong-endpoint rejection
  // -------------------------------------------------------------------------
  console.log("\n4. Wrong-endpoint rejection");
  const platformEventOnConnect = makeEvent({
    id: `${RUN_TAG}_misroute_p`,
    type: "customer.subscription.updated",
    object: { id: "sub_test_1" },
  });
  const r1 = await processStripeEvent(platformEventOnConnect, "connect");
  assertEq(r1.reason, "wrong_endpoint", "platform event on connect endpoint → wrong_endpoint");
  assertEq(r1.processed, false, "wrong_endpoint: processed=false");

  const connectEventOnPlatform = makeEvent({
    id: `${RUN_TAG}_misroute_c`,
    type: "payout.paid",
    account: "acct_test_misroute",
    object: { id: "po_test_1" },
  });
  const r2 = await processStripeEvent(connectEventOnPlatform, "platform");
  assertEq(r2.reason, "wrong_endpoint", "connect event on platform endpoint → wrong_endpoint");

  // -------------------------------------------------------------------------
  // 3b. Failed-handler retry MUST be allowed to succeed on a later delivery
  // (regression: previously reserveEvent inserted with processed_at=NOW(),
  // so a 5xx-then-Stripe-retry delivery hit the unique constraint and was
  // silently dropped as a duplicate, permanently losing the event)
  // -------------------------------------------------------------------------
  console.log("\n3b. Failed handler → Stripe retry succeeds (state model)");
  const { reserveEvent: reserve, markEventProcessed: markDone } = await import(
    "../stripeWebhookRouter"
  );
  const failThenSucceed = makeEvent({
    id: `${RUN_TAG}_retry_after_fail`,
    type: "invoice.finalized",
    object: { id: "in_test_retry" },
  });
  const r0 = await reserve(failThenSucceed, "platform");
  assertEq(r0, "fresh", "first delivery: fresh");
  // simulate handler throw → DON'T call markEventProcessed → row stays NULL
  const r1retry = await reserve(failThenSucceed, "platform");
  assertEq(r1retry, "retry", "second delivery (after fail): retry, not duplicate");
  // simulate handler success on retry → commit
  await markDone(failThenSucceed.id);
  const r2dup = await reserve(failThenSucceed, "platform");
  assertEq(r2dup, "duplicate", "third delivery (after success): duplicate");

  // -------------------------------------------------------------------------
  // 4b. Wrong-endpoint MUST NOT poison idempotency for the correct endpoint
  // (regression: a misrouted delivery would have reserved the event_id and
  // caused the correct delivery to be silently dropped as a duplicate)
  // -------------------------------------------------------------------------
  console.log("\n4b. Wrong-endpoint does NOT poison idempotency");
  const cutoverEvent = makeEvent({
    id: `${RUN_TAG}_cutover`,
    type: "invoice.finalized",
    object: { id: "in_test_cutover" },
  });
  const wrongFirst = await processStripeEvent(cutoverEvent, "connect");
  assertEq(wrongFirst.reason, "wrong_endpoint", "cutover: wrong endpoint first");
  const correctSecond = await processStripeEvent(cutoverEvent, "platform");
  assertEq(
    correctSecond.processed,
    true,
    "cutover: correct endpoint still processes after wrong-endpoint hit",
  );
  assertEq(correctSecond.reason, "ok", "cutover: correct endpoint reason=ok");

  // -------------------------------------------------------------------------
  // 5. Unknown connected account
  // -------------------------------------------------------------------------
  console.log("\n5. Unknown connected account → unknown_account");
  const unknownAcctEvent = makeEvent({
    id: `${RUN_TAG}_unknown_acct`,
    type: "payout.paid",
    account: "acct_test_does_not_exist_xyz",
    object: { id: "po_test_2" },
  });
  const r3 = await processStripeEvent(unknownAcctEvent, "connect");
  assertEq(r3.reason, "unknown_account", "unknown account → unknown_account");
  assertEq(r3.processed, false, "unknown_account: processed=false");

  // -------------------------------------------------------------------------
  // 6. Cleanup
  // -------------------------------------------------------------------------
  console.log("\n6. Cleanup");
  const deleted = await db
    .delete(stripeWebhookEvents)
    .where(like(stripeWebhookEvents.stripeEventId, `${RUN_TAG}%`))
    .returning({ id: stripeWebhookEvents.id });
  console.log(`  cleaned up ${deleted.length} test rows`);

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
  await pool.end().catch(() => {});
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
