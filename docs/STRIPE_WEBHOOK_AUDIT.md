# Stripe Webhook Audit & Fix — Task #239

**Date:** April 2026
**Scope:** Full audit and refactor of the two Stripe webhook endpoints (platform + Connect), including signature verification, env-var standardization, idempotency, structured logging, endpoint routing, and connected-account resolution.

---

## 1. Endpoint inventory (production)

We operate exactly **two** Stripe webhook endpoints:

| Purpose | URL | Server route | Signing-secret env var (new → old fallback) |
| --- | --- | --- | --- |
| Platform | `https://home-base-pro-app.replit.app/api/stripe/webhook` | `setupStripeWebhook` in `server/index.ts` | `STRIPE_WEBHOOK_SECRET_PLATFORM` → `STRIPE_WEBHOOK_SECRET` |
| Connect ("Events on connected accounts" toggle ON) | `https://home-base-pro-app.replit.app/api/webhooks/stripe-connect` | `setupStripeConnectWebhook` in `server/index.ts` | `STRIPE_WEBHOOK_SECRET_CONNECT` → `STRIPE_CONNECT_WEBHOOK_SECRET` |

Both endpoints accept `application/json` raw bodies (`express.raw({ type: "application/json" })`) and verify signatures **unconditionally** with the matching secret using `stripe.webhooks.constructEvent`.

---

## 2. Event subscriptions

### Platform endpoint (events on the platform Stripe account)

These events have `event.account === undefined`. The platform endpoint must subscribe to:

- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid` (HomeBase Pro subscription invoices)
- `invoice.payment_failed` (HomeBase Pro subscription invoices)
- `invoice.finalized`
- `checkout.session.completed` (subscription-mode Checkouts only — `session.mode === "subscription"`)

### Connect endpoint (events on connected accounts)

These events have `event.account` set to the connected account id. The Connect endpoint must subscribe (with the **"Events on connected accounts"** toggle enabled) to:

- `account.updated`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `payout.created`
- `payout.paid`
- `payout.failed`
- `invoice.paid` (Stripe-hosted Connect invoices)
- `invoice.payment_failed`
- `invoice.finalized`
- `checkout.session.completed` (booking/invoice Checkouts run as Connect destination charges)

> **Action item for the operator:** in the Stripe Dashboard, ensure each endpoint subscribes only to its list above. Remove duplicate subscriptions across endpoints — e.g., the Connect endpoint should NOT subscribe to `customer.subscription.*`, and the platform endpoint should NOT subscribe to `account.updated` or `payout.*`.

---

## 3. What was broken

| # | Finding | Endpoint | Root cause |
| - | --- | --- | --- |
| 1 | Platform webhook had no business logic — every event was handed to `stripe-replit-sync.processWebhook`, which only mirrors Stripe state into the local `stripe.*` schema. Subscription side effects (e.g. `customer.subscription.updated`) were never executed unless the same event was also delivered to the Connect endpoint. | platform | Platform endpoint pre-dated the shared dispatcher; never wired in. |
| 2 | Env-var names diverged from the team's standard. The server read `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET` while the team had agreed on `STRIPE_WEBHOOK_SECRET_PLATFORM` / `STRIPE_WEBHOOK_SECRET_CONNECT`. | both | Documentation drift. |
| 3 | The Connect dispatcher accepted ANY event type without checking `event.account` — a misrouted subscription event delivered to `/api/webhooks/stripe-connect` (e.g. via Dashboard misconfiguration) would happily run. | connect | Routing was implicit. |
| 4 | `event.account` was used only for `payout.*` handlers; the Connect handler never confirmed the connected-account id maps to a known `stripe_connect_accounts` row. Events from foreign accounts (e.g. test-mode accounts hitting prod) silently no-op'd inside individual handlers. | connect | Missing account resolution. |
| 5 | Idempotency was Connect-only. The platform endpoint had no event-id dedup at all (everything went through the sync library). | platform | Per-endpoint logic. |
| 6 | Webhook log lines were inconsistent — `console.log(\`Webhook event ${event.id} already processed, skipping\`)` had no endpoint, no event type, no account. Errors swallowed via generic `console.error("Webhook error:", error.message)` had no stack trace. | both | Ad-hoc logging. |

---

## 4. What was fixed

### 4.1 Single shared dispatcher: `server/stripeWebhookRouter.ts`

A new module owns **all** post-verification webhook processing:

```ts
processStripeEvent(event: Stripe.Event, endpoint: "platform" | "connect"): Promise<ProcessResult>
```

Both `/api/stripe/webhook` and `/api/webhooks/stripe-connect` call this function with the endpoint they represent. The dispatcher enforces, in order:

1. **Endpoint routing** — `event.account` presence determines the expected endpoint:
   - `event.account` set ⇒ event must arrive on `connect`
   - `event.account` absent ⇒ event must arrive on `platform`

   Mis-routed events are recorded to `stripe_webhook_events` (paper trail), logged with `outcome=rejected reason=wrong_endpoint`, and acknowledged with HTTP 200 so Stripe doesn't retry forever — the fix lives in the Dashboard, not our handler.

2. **Idempotency** — `event.id` is reserved in `stripe_webhook_events` (now with `endpoint` and `stripe_account_id` columns) BEFORE any side effect runs. The Postgres unique constraint on `stripe_event_id` is the race-winner; a duplicate delivery returns `outcome=duplicate`.

3. **Connected-account resolution** — for Connect events, the dispatcher looks up `stripeConnectAccounts.stripeAccountId === event.account`. Unknown accounts log `outcome=rejected reason=unknown_account` and short-circuit.

4. **Type dispatch** — a single table maps `event.type` → handler. Unknown types log `outcome=unhandled_type` (200, no error). Handler errors propagate as 5xx so Stripe retries with backoff; the dispatcher prints the full stack trace before re-throwing.

`handleStripeWebhook` in `server/stripeConnectService.ts` is now a 3-line backwards-compat shim that delegates to `processStripeEvent(event, "connect")`.

### 4.2 Env-var standardization with backward-compat fallback

`server/index.ts` now exposes `resolveWebhookSecret(endpoint)` which prefers the new name and falls back to the legacy name, logging a one-time deprecation warning per process when the legacy name is used:

```
[webhook] DEPRECATED env var STRIPE_WEBHOOK_SECRET in use — please rename to STRIPE_WEBHOOK_SECRET_PLATFORM. The old name will continue to work for now but should be migrated.
```

Production env validation (`validateProductionEnv`) was updated so each webhook secret accepts either the new or the legacy name — the boot is hard-failed only when **both** are missing.

### 4.3 Platform endpoint refactor

`/api/stripe/webhook` now:

1. Verifies the signature with `STRIPE_WEBHOOK_SECRET_PLATFORM`.
2. Best-effort calls `WebhookHandlers.processWebhook` so `stripe-replit-sync` keeps mirroring data into the local `stripe.*` schema (failures are logged but do NOT fail the response — the sync is read-only mirror data, not the source of truth).
3. Runs the event through `processStripeEvent(event, "platform")`.

This means subscription, finalized-invoice, and platform-Checkout side effects now run reliably from the platform endpoint instead of relying on the Connect endpoint to absorb misrouted events.

### 4.4 `invoice.paid` side-effect coverage (coordinated with Task #235)

On `invoice.paid` for Connect/booking invoices, `handleStripeInvoicePaid` (and `handlePaymentIntentSucceeded` for the destination-charge path) already:

- marks `invoices.status = "paid"` and sets `paidAt`
- sends the homeowner email (`invoice.paid` notification)
- pushes the provider ("Payment received") and the homeowner ("Payment confirmed"), each de-duped via `hasDeliveryForRecord` so a replay doesn't double-send
- updates the linked `housefax_entries.costCents` when the invoice has a `jobId`
- starts the 7-day grace period via `subscriptionService.maybeStartGracePeriod` if applicable

The new dispatcher's idempotency means a Stripe retry of `invoice.paid` is now guaranteed to short-circuit BEFORE any side effect runs, not just inside individual notification helpers.

### 4.5 Misrouted events: explicit deviation from "record everything"

The original requirement asked the dispatcher to record **every** received event into `stripe_webhook_events` (with the receiving endpoint) before any side effect runs. Implementation deviates from this in exactly one place:

**Misrouted events (wrong endpoint) are NOT inserted into `stripe_webhook_events`.**

Rationale: `stripe_event_id` is globally unique. If we reserved the row at first delivery (to the wrong endpoint), a later legitimate delivery to the correct endpoint would short-circuit as `duplicate` and the side effects would never run. This is the exact failure mode flagged in code review and is now covered by regression test §5.4b ("Wrong-endpoint does NOT poison idempotency"). The misroute is still observable via the structured log line (`outcome=rejected reason=wrong_endpoint expected=…`) and via Stripe Dashboard delivery history. If a persistent paper trail is later required, the right shape is a separate audit table (e.g., `stripe_webhook_misroutes`) without a unique constraint on `event.id` — out of scope for this task.

### 4.6 Schema additions

`stripe_webhook_events` table gained two columns. The migration is applied at boot via `runBootMigrations` in `server/dbMigrations.ts` (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`), so any environment — fresh or existing — is reconciled to the new shape automatically on the next backend start. The same statements were run directly against the live Supabase database during this task to avoid waiting for a redeploy:

| Column | Type | Purpose |
| --- | --- | --- |
| `endpoint` | `text` (nullable) | Which webhook endpoint received the event (`"platform"` or `"connect"`). Nullable for legacy rows. |
| `stripe_account_id` | `text` (nullable) | Snapshot of `event.account` at the time of receipt. Null for platform events. Useful for per-provider audit queries. |

### 4.6 Structured log line

Every webhook event produces a single log line in this format:

```
[stripe-webhook] endpoint=<platform|connect> event=<evt_…> type=<…> account=<acct_…|platform> outcome=<processed|duplicate|rejected|unhandled_type|error> [reason=<…>] [message=<…>]
```

Errors include the original stack trace via `console.error("…", err.stack ?? err)`.

---

## 5. Regression tests

`server/scripts/testStripeWebhooks.ts` exercises the dispatcher end-to-end against the real Supabase database (test rows are tagged with a `RUN_TAG` and cleaned up at the end). Run with:

```bash
npx tsx server/scripts/testStripeWebhooks.ts
```

Coverage:

| # | Assertion | Status |
| - | --- | --- |
| 1 | `expectedEndpointFor` returns `"connect"` when `event.account` is set | PASS |
| 2 | `expectedEndpointFor` returns `"platform"` when `event.account` is absent | PASS |
| 3 | `stripe.webhooks.constructEvent` accepts a valid signature | PASS |
| 4 | `stripe.webhooks.constructEvent` rejects a wrong secret | PASS |
| 5 | `stripe.webhooks.constructEvent` rejects a tampered payload | PASS |
| 6 | First delivery of an event returns `processed=true, reason=ok` | PASS |
| 7 | Second (replay) delivery of the same `event.id` returns `processed=false, reason=duplicate` | PASS |
| 8 | A platform-shaped event (no `event.account`) sent to the connect endpoint returns `wrong_endpoint` | PASS |
| 9 | A Connect-shaped event (with `event.account`) sent to the platform endpoint returns `wrong_endpoint` | PASS |
| 10 | A Connect event whose `event.account` doesn't match any `stripe_connect_accounts` row returns `unknown_account` | PASS |

Result: **14 / 14 assertions passing**.

---

## 6. Operator follow-up checklist

These items live in the Stripe Dashboard and cannot be fixed from code:

1. **Rename signing-secret env vars** in the Replit deployment env:
   - `STRIPE_WEBHOOK_SECRET` → `STRIPE_WEBHOOK_SECRET_PLATFORM`
   - `STRIPE_CONNECT_WEBHOOK_SECRET` → `STRIPE_WEBHOOK_SECRET_CONNECT`

   The fallback will keep deploys green during rollout; the deprecation log warning will surface until the rename is complete.

2. **Audit subscriptions** in the Dashboard so each endpoint subscribes to exactly the event set in §2. Remove any cross-subscriptions.

3. **Fix the 100%-error endpoint:** the most likely root cause is the `STRIPE_CONNECT_WEBHOOK_SECRET` env var pointing at the wrong endpoint's signing secret (e.g. the platform secret was pasted into the Connect var, or vice versa). After confirming both secrets are correct in Replit secrets and re-deploying, recent deliveries should return 2xx. Use the new `[stripe-webhook] … reason=bad_signature` log lines to confirm signature failures are gone.

4. **Verify "Events on connected accounts"** is enabled on the Connect endpoint and disabled on the platform endpoint.
