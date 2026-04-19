/**
 * Task #245 regression tests — Stripe Connect routing for provider invoices.
 *
 * Verifies, against a real database but a stubbed Stripe client (so no live
 * API calls):
 *
 *   1. createStripeInvoice always passes a non-empty `stripeAccount` option
 *      starting with "acct_" when calling stripe.invoices.create. Catches a
 *      regression where a code path drops the option and routes to the
 *      platform balance — exactly the bug Task #245 fixed.
 *
 *   2. createStripeInvoice throws code='stripe_not_ready' for a provider
 *      whose Connect charges are disabled, BEFORE making any Stripe API
 *      call. There must be no silent fallback to the platform.
 *
 *   3. handleStripeInvoicePaid upserts a `payments` row keyed on the
 *      PaymentIntent id, so production stops shipping with an empty
 *      payments table.
 *
 * Usage:
 *   npx tsx server/scripts/testInvoiceConnectRouting.ts
 *
 * Exits 0 on success, 1 on any failed assertion.
 */
import type Stripe from "stripe";
import { db, pool } from "../db";
import { and, eq } from "drizzle-orm";
import {
  invoices,
  payments,
  providers,
  clients,
  users,
  stripeConnectAccounts,
} from "../../shared/schema";

let pass = 0;
let fail = 0;
function ok(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  PASS  ${label}`);
    pass += 1;
  } else {
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
    fail += 1;
  }
}

const RUN_TAG = `t245_${Date.now()}`;

// Tracks args passed to the stub Stripe client.
type StubCall = { method: string; args: any[]; opts?: any };
const calls: StubCall[] = [];

// Build a thin stub object that mimics the small surface of stripe-node we
// touch from createStripeInvoice. Returns plausible-looking objects so the
// flow doesn't crash on missing fields.
function makeStubStripe(): any {
  let counter = 0;
  return {
    customers: {
      retrieve: async (_id: string, opts?: any) => {
        calls.push({ method: "customers.retrieve", args: [_id], opts });
        return { id: _id, deleted: false };
      },
      create: async (params: any, opts?: any) => {
        calls.push({ method: "customers.create", args: [params], opts });
        return { id: `cus_stub_${++counter}` };
      },
    },
    invoiceItems: {
      create: async (params: any, opts?: any) => {
        calls.push({ method: "invoiceItems.create", args: [params], opts });
        return { id: `ii_stub_${++counter}` };
      },
    },
    invoices: {
      create: async (params: any, opts?: any) => {
        calls.push({ method: "invoices.create", args: [params], opts });
        return { id: `in_stub_${++counter}`, hosted_invoice_url: null };
      },
      finalizeInvoice: async (id: string, opts?: any) => {
        calls.push({ method: "invoices.finalizeInvoice", args: [id], opts });
        return {
          id,
          hosted_invoice_url: `https://invoice.stripe.com/i/${opts?.stripeAccount ?? "platform"}/${id}`,
        };
      },
      retrieve: async (id: string, opts?: any) => {
        calls.push({ method: "invoices.retrieve", args: [id], opts });
        // Pretend the existing invoice is voided so the idempotency branch
        // falls through to "create a fresh one" — exercising the guard path.
        return { id, status: "void", hosted_invoice_url: null };
      },
      sendInvoice: async (id: string, opts?: any) => {
        calls.push({ method: "invoices.sendInvoice", args: [id], opts });
        return { id };
      },
    },
  };
}

async function withStubStripe<T>(stub: any, fn: () => Promise<T>): Promise<T> {
  // Inject the stub into stripeConnectService's cached singleton via the
  // test-only setter. Restore on the way out so subsequent tests get a
  // fresh state.
  const svc = await import("../stripeConnectService");
  svc.__setStripeForTesting(stub);
  try {
    return await fn();
  } finally {
    svc.__setStripeForTesting(null);
  }
}

async function setupFixture(opts: {
  chargesEnabled: boolean;
}): Promise<{ providerId: string; invoiceId: string; cleanup: () => Promise<void> }> {
  // Create a throwaway user → provider → connect account → client → invoice.
  const userId = `u_${RUN_TAG}_${Math.random().toString(36).slice(2, 8)}`;
  const providerId = `p_${RUN_TAG}_${Math.random().toString(36).slice(2, 8)}`;
  const clientId = `c_${RUN_TAG}_${Math.random().toString(36).slice(2, 8)}`;
  const invoiceId = `i_${RUN_TAG}_${Math.random().toString(36).slice(2, 8)}`;

  await db.insert(users).values({
    id: userId,
    email: `${userId}@test.local`,
    password: "x",
    isProvider: true,
  } as any);

  await db.insert(providers).values({
    id: providerId,
    userId,
    businessName: `Test Provider ${RUN_TAG}`,
  } as any);

  await db.insert(stripeConnectAccounts).values({
    providerId,
    stripeAccountId: `acct_test_${RUN_TAG}`,
    chargesEnabled: opts.chargesEnabled,
    payoutsEnabled: opts.chargesEnabled,
    detailsSubmitted: true,
  } as any);

  await db.insert(clients).values({
    id: clientId,
    providerId,
    firstName: "Test",
    lastName: "Client",
    email: `${clientId}@test.local`,
  } as any);

  await db.insert(invoices).values({
    id: invoiceId,
    providerId,
    clientId,
    invoiceNumber: `TEST-${RUN_TAG}`,
    currency: "usd",
    subtotalCents: 5000,
    totalCents: 5000,
    platformFeeCents: 150,
    amount: "50.00",
    total: "50.00",
    lineItems: JSON.stringify([
      { description: "Test service", quantity: 1, unitPrice: 50, total: 50 },
    ]),
    status: "draft",
  } as any);

  const cleanup = async () => {
    await db.delete(payments).where(eq(payments.invoiceId, invoiceId));
    await db.delete(invoices).where(eq(invoices.id, invoiceId));
    await db.delete(clients).where(eq(clients.id, clientId));
    await db
      .delete(stripeConnectAccounts)
      .where(eq(stripeConnectAccounts.providerId, providerId));
    await db.delete(providers).where(eq(providers.id, providerId));
    await db.delete(users).where(eq(users.id, userId));
  };

  return { providerId, invoiceId, cleanup };
}

async function main() {
  console.log(`\n=== Task #245 regression tests (${RUN_TAG}) ===\n`);

  // ---------------------------------------------------------------------------
  // Test 1: happy path — createStripeInvoice passes stripeAccount to every
  // Stripe call.
  // ---------------------------------------------------------------------------
  console.log("1. createStripeInvoice routes through connected account");
  {
    const fx = await setupFixture({ chargesEnabled: true });
    const stub = makeStubStripe();
    try {
      const svc = await import("../stripeConnectService");
      await withStubStripe(stub, async () => {
        await svc.createStripeInvoice(fx.invoiceId);
      });

      const invoiceCreate = calls.find((c) => c.method === "invoices.create");
      ok(
        "stripe.invoices.create was called",
        Boolean(invoiceCreate),
        JSON.stringify(calls.map((c) => c.method)),
      );
      ok(
        "invoices.create stripeAccount option starts with acct_",
        Boolean(
          invoiceCreate?.opts?.stripeAccount &&
            String(invoiceCreate.opts.stripeAccount).startsWith("acct_"),
        ),
        `opts=${JSON.stringify(invoiceCreate?.opts)}`,
      );
      const finalize = calls.find(
        (c) => c.method === "invoices.finalizeInvoice",
      );
      ok(
        "invoices.finalizeInvoice stripeAccount also set",
        Boolean(
          finalize?.opts?.stripeAccount &&
            String(finalize.opts.stripeAccount).startsWith("acct_"),
        ),
        `opts=${JSON.stringify(finalize?.opts)}`,
      );
    } finally {
      await fx.cleanup();
      calls.length = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Test 2: refusal — chargesEnabled=false → throws stripe_not_ready BEFORE
  // any Stripe call.
  // ---------------------------------------------------------------------------
  console.log("\n2. createStripeInvoice refuses when chargesEnabled=false");
  {
    const fx = await setupFixture({ chargesEnabled: false });
    const stub = makeStubStripe();
    try {
      const svc = await import("../stripeConnectService");
      let threw: any = null;
      await withStubStripe(stub, async () => {
        try {
          await svc.createStripeInvoice(fx.invoiceId);
        } catch (e) {
          threw = e;
        }
      });
      ok("threw an error", threw !== null);
      ok(
        "error code is stripe_not_ready",
        threw?.code === "stripe_not_ready",
        `code=${threw?.code} message=${threw?.message}`,
      );
      ok(
        "no Stripe API calls were made",
        calls.length === 0,
        `calls=${JSON.stringify(calls.map((c) => c.method))}`,
      );
    } finally {
      await fx.cleanup();
      calls.length = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Test 3: handleStripeInvoicePaid upserts a payments row.
  // ---------------------------------------------------------------------------
  console.log("\n3. handleStripeInvoicePaid upserts a payments row");
  {
    const fx = await setupFixture({ chargesEnabled: true });
    try {
      const svc = await import("../stripeConnectService");
      const fakeStripeInvoice: Partial<Stripe.Invoice> = {
        id: `in_test_${RUN_TAG}`,
        status: "paid",
        amount_paid: 5000,
        amount_due: 5000,
        currency: "usd",
        payment_intent: `pi_test_${RUN_TAG}`,
        charge: `ch_test_${RUN_TAG}`,
        metadata: { homebaseInvoiceId: fx.invoiceId },
      };
      await svc.handleStripeInvoicePaid(fakeStripeInvoice as Stripe.Invoice);
      const rows = await db
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, fx.invoiceId));
      ok("exactly one payments row exists", rows.length === 1, `count=${rows.length}`);
      ok(
        "payments row has correct PI id",
        rows[0]?.stripePaymentIntentId === `pi_test_${RUN_TAG}`,
        `pi=${rows[0]?.stripePaymentIntentId}`,
      );
      ok(
        "payments row has correct status",
        rows[0]?.status === "succeeded",
        `status=${rows[0]?.status}`,
      );
      ok(
        "payments row has correct amount",
        rows[0]?.amountCents === 5000,
        `amount=${rows[0]?.amountCents}`,
      );

      // Idempotency: replay should not double-insert
      await svc.handleStripeInvoicePaid(fakeStripeInvoice as Stripe.Invoice);
      const rowsAfterReplay = await db
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, fx.invoiceId));
      ok(
        "replay does not duplicate (still 1 row)",
        rowsAfterReplay.length === 1,
        `count=${rowsAfterReplay.length}`,
      );
    } finally {
      await fx.cleanup();
    }
  }

  // ---------------------------------------------------------------------------
  // Test 4: handlePaymentIntentSucceeded — PI without metadata.invoiceId
  // (Stripe-Invoice-paid PIs are created internally by Stripe with no
  // metadata) must still attribute via the PI's `invoice` field and write
  // a payments row.
  // ---------------------------------------------------------------------------
  console.log(
    "\n4. handlePaymentIntentSucceeded falls back to PI.invoice when metadata is missing",
  );
  {
    const fx = await setupFixture({ chargesEnabled: true });
    try {
      const svc = await import("../stripeConnectService");
      const stripeInvoiceId = `in_test_fb_${RUN_TAG}`;
      // Link the homebase invoice to a Stripe Invoice id so the fallback
      // lookup (`invoices.stripeInvoiceId`) can resolve it.
      const { eq: eqOp } = await import("drizzle-orm");
      await db
        .update(invoices)
        .set({ stripeInvoiceId })
        .where(eqOp(invoices.id, fx.invoiceId));

      const fakePI: any = {
        id: `pi_test_fb_${RUN_TAG}`,
        amount: 7500,
        latest_charge: `ch_test_fb_${RUN_TAG}`,
        invoice: stripeInvoiceId,
        metadata: {}, // explicitly missing invoiceId
      };
      await svc.handlePaymentIntentSucceeded(fakePI as any);

      const rows = await db
        .select()
        .from(payments)
        .where(eqOp(payments.invoiceId, fx.invoiceId));
      ok(
        "fallback path created exactly one payments row",
        rows.length === 1,
        `count=${rows.length}`,
      );
      ok(
        "fallback row carries the right PI id",
        rows[0]?.stripePaymentIntentId === `pi_test_fb_${RUN_TAG}`,
        `pi=${rows[0]?.stripePaymentIntentId}`,
      );
      ok(
        "fallback row carries the right charge id",
        rows[0]?.stripeChargeId === `ch_test_fb_${RUN_TAG}`,
        `charge=${rows[0]?.stripeChargeId}`,
      );
      ok(
        "fallback row uses PI amount when present",
        rows[0]?.amountCents === 7500,
        `amount=${rows[0]?.amountCents}`,
      );
    } finally {
      await fx.cleanup();
    }
  }

  // ---------------------------------------------------------------------------
  // Test 5: ROUTE-LEVEL — POST /api/stripe/invoices/:invoiceId/send must
  // FAIL CLOSED with 409 + { code: "stripe_not_ready" } when the
  // provider's Connect account isn't ready, AND must NOT mark the
  // invoice as "sent" or trigger any side effects (Task #245
  // architect-review fix).
  // ---------------------------------------------------------------------------
  console.log(
    "\n5. POST /api/stripe/invoices/:id/send fails closed on stripe_not_ready",
  );
  {
    const fx = await setupFixture({ chargesEnabled: false });
    try {
      const { generateToken } = await import("../auth");
      // Look up the user we just created so we can mint a JWT for them.
      const [u] = await db
        .select()
        .from(users)
        .where(
          eq(
            users.id,
            (
              await db
                .select({ userId: providers.userId })
                .from(providers)
                .where(eq(providers.id, fx.providerId))
            )[0].userId!,
          ),
        );
      const token = generateToken(u.id, "provider", (u as any).tokenVersion ?? 0);

      const port = process.env.PORT || "5000";
      const base = `http://127.0.0.1:${port}`;
      const resp = await fetch(
        `${base}/api/stripe/invoices/${fx.invoiceId}/send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: "{}",
        },
      );
      const body = await resp.json().catch(() => ({}));
      ok(
        "send route returns HTTP 409",
        resp.status === 409,
        `status=${resp.status} body=${JSON.stringify(body)}`,
      );
      ok(
        'send route body has code "stripe_not_ready"',
        body?.code === "stripe_not_ready",
        `body.code=${body?.code}`,
      );

      // Side-effect proof: invoice status MUST still be "draft" — fail
      // closed means no transition to "sent", no sentAt timestamp.
      const [inv] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, fx.invoiceId));
      ok(
        "invoice was NOT marked sent (status stays draft)",
        inv?.status === "draft",
        `status=${inv?.status}`,
      );
      ok(
        "invoice has no sentAt timestamp",
        inv?.sentAt == null,
        `sentAt=${inv?.sentAt}`,
      );
    } catch (err: any) {
      // If the dev server isn't reachable (e.g. running in CI without the
      // backend), record a single failure rather than crashing — keeps
      // the rest of the suite informative.
      ok(
        "route-level test reached the dev server",
        false,
        `Could not reach backend: ${err?.message}. Start the backend before running this test.`,
      );
    } finally {
      await fx.cleanup();
    }
  }

  // ---------------------------------------------------------------------------
  // Test 6: ROUTE-LEVEL — POST /api/invoices/:id/send (the legacy
  // non-/api/stripe send endpoint) MUST also fail closed on
  // stripe_not_ready, otherwise the Connect-routing contract has a hole.
  // ---------------------------------------------------------------------------
  console.log(
    "\n6. POST /api/invoices/:id/send fails closed on stripe_not_ready",
  );
  {
    const fx = await setupFixture({ chargesEnabled: false });
    try {
      const { generateToken } = await import("../auth");
      const [{ userId }] = await db
        .select({ userId: providers.userId })
        .from(providers)
        .where(eq(providers.id, fx.providerId));
      const [u] = await db.select().from(users).where(eq(users.id, userId!));
      const token = generateToken(u.id, "provider", (u as any).tokenVersion ?? 0);
      const port = process.env.PORT || "5000";
      const resp = await fetch(
        `http://127.0.0.1:${port}/api/invoices/${fx.invoiceId}/send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: "{}",
        },
      );
      const body = await resp.json().catch(() => ({}));
      ok(
        "legacy send route returns HTTP 409",
        resp.status === 409,
        `status=${resp.status} body=${JSON.stringify(body)}`,
      );
      ok(
        'legacy send route body has code "stripe_not_ready"',
        body?.code === "stripe_not_ready",
      );
      const [inv] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, fx.invoiceId));
      ok(
        "legacy send: invoice status stays draft",
        inv?.status === "draft",
        `status=${inv?.status}`,
      );
      ok("legacy send: invoice has no sentAt", inv?.sentAt == null);
    } catch (err: any) {
      ok(
        "legacy send route-level test reached the dev server",
        false,
        `Could not reach backend: ${err?.message}`,
      );
    } finally {
      await fx.cleanup();
    }
  }

  // ---------------------------------------------------------------------------
  // Test 7: ROUTE-LEVEL — POST /api/invoices/create-and-send must insert
  // the invoice as `draft`, refuse with 409 on stripe_not_ready, and
  // leave the persisted row in `draft` (NOT `sent`).
  // ---------------------------------------------------------------------------
  console.log(
    "\n7. POST /api/invoices/create-and-send fails closed on stripe_not_ready",
  );
  {
    const fx = await setupFixture({ chargesEnabled: false });
    try {
      const { generateToken } = await import("../auth");
      const [{ userId }] = await db
        .select({ userId: providers.userId })
        .from(providers)
        .where(eq(providers.id, fx.providerId));
      const [u] = await db.select().from(users).where(eq(users.id, userId!));
      const token = generateToken(u.id, "provider", (u as any).tokenVersion ?? 0);
      const [c] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.providerId, fx.providerId));
      const port = process.env.PORT || "5000";
      const resp = await fetch(
        `http://127.0.0.1:${port}/api/invoices/create-and-send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            providerId: fx.providerId,
            clientId: c.id,
            amount: 75,
            notes: "T245-fail-closed-test",
          }),
        },
      );
      const body = await resp.json().catch(() => ({}));
      ok(
        "create-and-send returns HTTP 409",
        resp.status === 409,
        `status=${resp.status} body=${JSON.stringify(body)}`,
      );
      ok(
        'create-and-send body has code "stripe_not_ready"',
        body?.code === "stripe_not_ready",
      );
      const newInvoiceId = body?.invoiceId;
      ok(
        "create-and-send returned the newly-created invoiceId",
        typeof newInvoiceId === "string" && newInvoiceId.length > 0,
      );
      if (newInvoiceId) {
        const [inv] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, newInvoiceId));
        ok(
          "create-and-send: invoice persisted as draft (not sent)",
          inv?.status === "draft",
          `status=${inv?.status}`,
        );
        ok(
          "create-and-send: invoice has no sentAt",
          inv?.sentAt == null,
          `sentAt=${inv?.sentAt}`,
        );
        // Cleanup the invoice we just created out-of-band
        await db.delete(invoices).where(eq(invoices.id, newInvoiceId));
      }
    } catch (err: any) {
      ok(
        "create-and-send route-level test reached the dev server",
        false,
        `Could not reach backend: ${err?.message}`,
      );
    } finally {
      await fx.cleanup();
    }
  }

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
  await pool.end().catch(() => {});
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
