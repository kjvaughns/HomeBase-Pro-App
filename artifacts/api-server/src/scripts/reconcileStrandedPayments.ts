/**
 * Task #245 — Reconcile two stranded $2 invoices that pre-Task-#150 code
 * routed to the platform Stripe account instead of Heritage Home Cleaners'
 * connected account.
 *
 * For each invoice in STRANDED_INVOICES we:
 *   1. Load the Stripe Invoice from the PLATFORM account (that's where it
 *      lives) to get the latest_charge.
 *   2. Compute net = amount_paid (no application_fee was collected on these,
 *      so the full gross is owed to the provider).
 *   3. Create a Stripe Transfer from the platform balance to the provider's
 *      connected account, using `source_transaction = chargeId` so Stripe
 *      automatically debits the original charge's funds rather than touching
 *      the platform's general balance.
 *   4. Idempotency: skip the transfer if one already exists for this
 *      invoice (we look it up by `transfer_group = invoiceId`).
 *   5. Insert/UPSERT a `payments` row tagged with the transfer id so the
 *      invoice has a proper audit record going forward.
 *   6. Append a note to the `invoices` row recording the transfer id and
 *      timestamp.
 *
 * Run:   npx tsx server/scripts/reconcileStrandedPayments.ts
 * Dry:   DRY_RUN=1 npx tsx server/scripts/reconcileStrandedPayments.ts
 */
import Stripe from "stripe";
import { db, pool } from "../db";
import { eq } from "drizzle-orm";
import { invoices, payments } from "@workspace/db";

const DRY_RUN = process.env.DRY_RUN === "1";

// Use the LIVE platform key directly. The two stranded invoices and the
// destination Heritage Connect account both live in Stripe live mode, so
// the dev-only test-mode key (STRIPE_TEST_SECRET_KEY) cannot find them.
const LIVE_KEY = process.env.STRIPE_SECRET_KEY;
if (!LIVE_KEY || !LIVE_KEY.startsWith("sk_live_")) {
  console.error(
    "[reconcile] STRIPE_SECRET_KEY must be a sk_live_... key. Aborting.",
  );
  process.exit(1);
}
const stripe = new Stripe(LIVE_KEY);

type StrandedInvoice = {
  invoiceNumber: string;
  destinationConnectAccountId: string;
};

const STRANDED_INVOICES: StrandedInvoice[] = [
  // Heritage Home Cleaners — both $2 charges from 2026-04-18
  {
    invoiceNumber: "INV-MO4J9UF0-5O83",
    destinationConnectAccountId: "acct_1TNbF7EnzXBWu22p",
  },
  {
    invoiceNumber: "INV-MO4J4XID-2K1P",
    destinationConnectAccountId: "acct_1TNbF7EnzXBWu22p",
  },
];

type ReconcileResult =
  | {
      ok: true;
      action: "created_transfer" | "already_reconciled";
      invoiceNumber: string;
      transferId: string;
      amountCents: number;
    }
  | {
      ok: false;
      action: "skipped";
      invoiceNumber: string;
      reason: string;
    };

async function reconcile(item: StrandedInvoice): Promise<ReconcileResult> {
  const tag = `[reconcile:${item.invoiceNumber}]`;
  const [invRow] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.invoiceNumber, item.invoiceNumber));
  if (!invRow) {
    return {
      ok: false,
      action: "skipped",
      invoiceNumber: item.invoiceNumber,
      reason: "invoice row not found",
    };
  }
  if (!invRow.stripeInvoiceId) {
    return {
      ok: false,
      action: "skipped",
      invoiceNumber: item.invoiceNumber,
      reason: "no stripeInvoiceId",
    };
  }

  // Load the Stripe Invoice from the PLATFORM account (no stripeAccount
  // option — these settled to the platform). Expand payments so we can
  // resolve the underlying charge id via the linked PaymentIntent (the
  // top-level `charge` field has been removed from newer API versions).
  const stripeInvoice = await stripe.invoices.retrieve(invRow.stripeInvoiceId, {
    expand: ["payments", "payment_intent.latest_charge"],
  });
  if (stripeInvoice.status !== "paid") {
    return {
      ok: false,
      action: "skipped",
      invoiceNumber: item.invoiceNumber,
      reason: `Stripe invoice status=${stripeInvoice.status}`,
    };
  }

  // Resolve the PaymentIntent that paid this invoice (works on both legacy
  // and current API versions: prefer the top-level field if present,
  // otherwise dig through the payments collection).
  // The legacy top-level `payment_intent` field on Stripe.Invoice has been
  // removed in newer API versions, hence the explicit shape extension here
  // (no blanket `as any`).
  type InvoiceWithLegacyLinks = Stripe.Invoice & {
    payment_intent?: string | Stripe.PaymentIntent | null;
    payments?: {
      data?: Array<{
        payment?: {
          payment_intent?: string | Stripe.PaymentIntent | null;
        } | null;
      }>;
    } | null;
  };
  const inv = stripeInvoice as InvoiceWithLegacyLinks;
  const narrowId = (
    v: string | { id?: string } | null | undefined,
  ): string | null => {
    if (!v) return null;
    if (typeof v === "string") return v;
    return v.id ?? null;
  };

  let paymentIntentId: string | null = narrowId(inv.payment_intent);
  if (!paymentIntentId) {
    const paymentsList = inv.payments?.data ?? [];
    for (const p of paymentsList) {
      const pid = narrowId(p?.payment?.payment_intent ?? null);
      if (pid) {
        paymentIntentId = pid;
        break;
      }
    }
  }

  // Fetch the PI directly to get latest_charge (which is the modern,
  // post-`charge` way to find the source charge for source_transaction).
  let chargeId: string | null = null;
  if (paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    chargeId =
      typeof pi.latest_charge === "string"
        ? pi.latest_charge
        : (pi.latest_charge?.id ?? null);
  }
  const amountPaid = stripeInvoice.amount_paid ?? 0;

  if (!chargeId || amountPaid <= 0) {
    return {
      ok: false,
      action: "skipped",
      invoiceNumber: item.invoiceNumber,
      reason: `missing charge (${chargeId}) or amount (${amountPaid})`,
    };
  }

  // Idempotency: list transfers in the transfer_group; if one exists, skip.
  const transferGroup = `homebase_invoice_${invRow.id}`;
  const existing = await stripe.transfers.list({
    transfer_group: transferGroup,
    limit: 5,
  });
  const alreadyTransferred = existing.data.find(
    (t) => t.destination === item.destinationConnectAccountId,
  );

  let transferId: string;
  if (alreadyTransferred) {
    console.log(
      `${tag} already-reconciled transfer=${alreadyTransferred.id} amount=${alreadyTransferred.amount}`,
    );
    transferId = alreadyTransferred.id;
  } else if (DRY_RUN) {
    console.log(
      `${tag} DRY_RUN would transfer cents=${amountPaid} → ${item.destinationConnectAccountId} sourceTxn=${chargeId}`,
    );
    return {
      ok: true,
      action: "created_transfer",
      invoiceNumber: item.invoiceNumber,
      transferId: "dry-run",
      amountCents: amountPaid,
    };
  } else {
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: amountPaid,
          currency: stripeInvoice.currency || "usd",
          destination: item.destinationConnectAccountId,
          source_transaction: chargeId,
          transfer_group: transferGroup,
          description: `HomeBase Task #245 reconciliation for ${item.invoiceNumber}`,
          metadata: {
            reason: "task-245-reconciliation",
            homebaseInvoiceId: invRow.id,
            invoiceNumber: item.invoiceNumber,
          },
        },
        // Stripe-side idempotency key — guarantees that even if the script
        // crashes between transfers.create returning and our DB write
        // committing, a retry will return the original transfer rather than
        // create a duplicate (architect review, Task #245).
        { idempotencyKey: `reconcile_inv_${invRow.id}_v1` },
      );
      transferId = transfer.id;
      console.log(
        `${tag} CREATED transfer=${transferId} amount=${amountPaid} → ${item.destinationConnectAccountId}`,
      );
    } catch (transferErr: any) {
      // Transfer-or-refund fallback (per Task #245 step 4): if the platform
      // can't move the funds to the provider's connected account (e.g. the
      // connected account is restricted, charges_disabled, or Stripe
      // refuses the transfer for any other reason), the homeowner must not
      // be left holding an unrouted charge. Refund them and audit the
      // failure. Refund is also idempotency-keyed so a re-run is safe.
      console.error(
        `${tag} transfer FAILED (${transferErr?.code ?? "unknown"} / ${transferErr?.message}); falling back to homeowner refund`,
      );
      const refund = await stripe.refunds.create(
        {
          charge: chargeId,
          reason: "requested_by_customer",
          metadata: {
            reason: "task-245-reconciliation-transfer-failed",
            homebaseInvoiceId: invRow.id,
            invoiceNumber: item.invoiceNumber,
            transferError: String(transferErr?.message ?? transferErr),
          },
        },
        { idempotencyKey: `reconcile_refund_${invRow.id}_v1` },
      );
      console.log(
        `${tag} REFUNDED ${amountPaid} cents via ${refund.id} after transfer failure`,
      );
      // Mark the homebase invoice as refunded and audit-note the path so
      // ops can follow up. We return early — there is no transfer to
      // record, but the refund replaces it as the terminal funds movement.
      const refundNote = `\n[Task #245 reconciliation ${new Date().toISOString()}] transfer to ${item.destinationConnectAccountId} FAILED (${transferErr?.message}); refunded ${amountPaid} cents to homeowner via ${refund.id}`;
      await db
        .update(invoices)
        .set({
          status: "void",
          notes: (invRow.notes || "") + refundNote,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invRow.id));
      if (paymentIntentId) {
        await db
          .insert(payments)
          .values({
            invoiceId: invRow.id,
            providerId: invRow.providerId,
            amountCents: amountPaid,
            amount: (amountPaid / 100).toFixed(2),
            method: "stripe",
            status: "refunded",
            stripePaymentIntentId: paymentIntentId,
            stripeChargeId: chargeId,
            notes: `Refunded via Task #245 fallback: ${refund.id}`,
          })
          .onConflictDoUpdate({
            target: payments.stripePaymentIntentId,
            set: {
              status: "refunded",
              stripeChargeId: chargeId,
              notes: `Refunded via Task #245 fallback: ${refund.id}`,
            },
          });
      }
      return {
        ok: true,
        action: "created_transfer",
        invoiceNumber: item.invoiceNumber,
        transferId: refund.id,
        amountCents: amountPaid,
      };
    }
  }

  // True idempotency (architect review fix): when this run found a
  // pre-existing reconciliation transfer (from a prior execution), the
  // payments row and invoice notes were already written then. Re-running
  // must be a true no-op for DB writes — no duplicate notes appended,
  // no payments mutation. We still log so operators can see the run
  // touched this invoice.
  if (alreadyTransferred) {
    return {
      ok: true,
      action: "already_reconciled",
      invoiceNumber: item.invoiceNumber,
      transferId,
      amountCents: amountPaid,
    };
  }

  // Persist a payments row + invoice note (idempotent UPSERT on PI id).
  if (paymentIntentId) {
    await db
      .insert(payments)
      .values({
        invoiceId: invRow.id,
        providerId: invRow.providerId,
        amountCents: amountPaid,
        amount: (amountPaid / 100).toFixed(2),
        method: "stripe",
        status: "succeeded",
        stripePaymentIntentId: paymentIntentId,
        stripeChargeId: chargeId,
        notes: `Reconciled via Task #245 transfer ${transferId}`,
      })
      .onConflictDoUpdate({
        target: payments.stripePaymentIntentId,
        set: {
          status: "succeeded",
          stripeChargeId: chargeId,
          notes: `Reconciled via Task #245 transfer ${transferId}`,
        },
      });
  }

  const reconcileNote = `\n[Task #245 reconciliation ${new Date().toISOString()}] transferred ${amountPaid} cents to ${item.destinationConnectAccountId} via ${transferId}`;
  const newNotes = (invRow.notes || "") + reconcileNote;
  await db
    .update(invoices)
    .set({
      notes: newNotes,
      stripePaymentIntentId: paymentIntentId ?? invRow.stripePaymentIntentId,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invRow.id));

  return {
    ok: true,
    action: alreadyTransferred ? "already_reconciled" : "created_transfer",
    invoiceNumber: item.invoiceNumber,
    transferId,
    amountCents: amountPaid,
  };
}

async function main() {
  console.log(
    `\n=== Task #245 reconciliation ${DRY_RUN ? "(DRY_RUN)" : "(LIVE)"} ===\n`,
  );

  let success = 0;
  let failed = 0;
  for (const item of STRANDED_INVOICES) {
    try {
      const result = await reconcile(item);
      if (result.ok) {
        console.log(`  ${result.action}: ${JSON.stringify(result)}`);
        success += 1;
      } else {
        console.error(`  SKIPPED: ${JSON.stringify(result)}`);
        failed += 1;
      }
    } catch (err: any) {
      console.error(`  ERROR ${item.invoiceNumber}:`, err?.message ?? err);
      console.error(err?.stack);
      failed += 1;
    }
  }

  console.log(
    `\n=== Result: ${success} reconciled, ${failed} skipped/failed ===\n`,
  );
  await pool.end().catch(() => {});
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Reconciliation runner crashed:", err);
  process.exit(1);
});
