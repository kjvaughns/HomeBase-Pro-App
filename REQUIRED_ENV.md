# Required Environment Variables

This document defines every environment variable the HomeBase backend depends on, its criticality, and enforcement behavior.

| Variable | Required | Enforcement | Source |
|---|---|---|---|
| `JWT_SECRET` | **Critical** | `process.exit(1)` at startup if unset in production | Set manually in deployment secrets |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | **Critical** | `process.exit(1)` at startup if unset in production; all webhook requests rejected without it | Stripe Dashboard → Webhooks → signing secret |
| `SUPABASE_DATABASE_URL` | **Critical** | `db.ts` throws on connection if neither DB URL set | Supabase project settings |
| `DATABASE_URL` | Fallback | Used if `SUPABASE_DATABASE_URL` unset | Replit built-in PostgreSQL |
| `STRIPE_SECRET_KEY` | **Critical** | Replit Stripe integration; `getStripe()` throws on use if missing | Replit Stripe integration |
| `STRIPE_WEBHOOK_SECRET` | **Critical** | Used by `stripe-replit-sync`; `/api/stripe/webhook` returns 400 on sig failure | Stripe Dashboard → Webhooks |
| `RESEND_API_KEY` | Required for email | Replit Resend integration; email send fails gracefully if missing | Resend dashboard |
| `OPENAI_API_KEY` | Required for AI features | Replit AI integration; AI endpoints return 500 if missing | OpenAI dashboard |
| `RAPIDAPI_KEY` | Optional | `fetchZillowPropertyData` returns `null` gracefully if missing | RapidAPI dashboard |
| `GOOGLE_API_KEY` | Optional | Geocoding/Places APIs return `[]`/`null` gracefully if missing | Google Cloud Console |
| `SESSION_SECRET` | Optional | Used by session middleware if configured | Set manually |
| `NODE_ENV` | Optional | Set to `production` in production deployments; controls fail-fast behavior | Deployment config |

## Production Checklist

Before going live, ensure these are configured in Replit deployment secrets:

- [ ] `JWT_SECRET` — minimum 32 random characters
- [ ] `STRIPE_CONNECT_WEBHOOK_SECRET` — from Stripe Connect webhook endpoint
- [ ] `STRIPE_SECRET_KEY` — from Stripe dashboard (live key)
- [ ] `STRIPE_WEBHOOK_SECRET` — from Stripe primary webhook endpoint
- [ ] `SUPABASE_DATABASE_URL` — Supabase session-mode pooler URL
- [ ] `RESEND_API_KEY` — for transactional email
- [ ] `OPENAI_API_KEY` — for AI assistant features
- [ ] `NODE_ENV=production`

## Startup Fail-Fast Behavior

The following missing variables will cause the server to **hard-exit at startup** when `NODE_ENV=production` (via `validateProductionEnv()`):

1. `JWT_SECRET` — enforced in `server/auth.ts`
2. `STRIPE_CONNECT_WEBHOOK_SECRET` — enforced in `server/index.ts`
3. `STRIPE_SECRET_KEY` — enforced in `server/index.ts` (all payment features fail without it)
4. `STRIPE_WEBHOOK_SECRET` — enforced in `server/index.ts` (primary webhook verification fails)
5. `RESEND_API_KEY` — enforced in `server/index.ts` (transactional email silently fails without it)

Variables that log WARNING in production but do not cause exit:

- `SUPABASE_DATABASE_URL` — falls back to `DATABASE_URL`
- `OPENAI_API_KEY` — AI features return 500 errors

---

## Stripe Live Mode Cutover Runbook

The backend automatically selects Stripe test vs live mode based on `NODE_ENV`:

- `NODE_ENV=production`: `STRIPE_TEST_SECRET_KEY` is **IGNORED**. Only `STRIPE_SECRET_KEY` (must start with `sk_live_`) is used. A `WARNING` is logged at first Stripe call if it does not start with `sk_live_`.
- Non-production: `STRIPE_TEST_SECRET_KEY` is honored first if set, falling back to `STRIPE_SECRET_KEY` — lets developers run against Stripe test mode locally without swapping their secret.

### Pre-cutover checklist

1. **Set live keys in deployment secrets**:
   - `STRIPE_SECRET_KEY` → live secret (`sk_live_...`)
   - `STRIPE_WEBHOOK_SECRET` → signing secret from live-mode primary webhook endpoint
   - `STRIPE_CONNECT_WEBHOOK_SECRET` → signing secret from live-mode Connect webhook endpoint
   - Ensure `STRIPE_TEST_SECRET_KEY` is **not set** in production (it is ignored, but removing it prevents confusion).
   - The Replit Stripe connector should be configured for the `production` environment (see `server/stripeClient.ts`) so `/api/stripe/config` returns the live publishable key to deployed mobile builds.

2. **Register webhooks in the Stripe dashboard (live mode)**:
   - Platform account → endpoint `https://<deployed-domain>/api/stripe/webhook` — subscribe to the same events used in test mode (see `server/webhookHandlers.ts`), notably `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`.
   - Connect endpoint → `https://<deployed-domain>/api/webhooks/stripe-connect` — subscribe to `account.updated`, `invoice.paid`, `invoice.payment_failed`, `payout.*`, `charge.refunded`, `transfer.*` (full list in `server/stripeConnectService.ts :: handleStripeWebhook`).
   - Paste the two signing secrets into deployment env as `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET`.
   - Redeploy.

3. **Mobile builds**:
   - EAS `production` and `preview` profiles are configured with the `pk_live_...` publishable key (see `eas.json`). Any TestFlight/beta build cut from these profiles will use live Stripe.
   - The `development` and `development-simulator` profiles intentionally still use `pk_test_...` for local QA.

### Provider re-onboarding (existing test-mode Connect accounts)

Any Connect account created against test mode cannot accept live payments — Stripe account IDs are mode-specific. After cutover:

- `GET /api/stripe/connect/status/:providerId` now returns `{ livemode, needsReonboarding }`. When the platform is running in live mode and the stored Connect account is test-mode (detected either via Stripe's `livemode` flag or a `resource_missing` response from `accounts.retrieve`), `needsReonboarding: true` is returned and UI should surface a prompt.
- Providers re-onboard by calling `POST /api/stripe/connect/reonboard/:providerId` (auth required, ownership enforced). The server deletes the stale `stripe_connect_accounts` row and issues a fresh live-mode `accountLinks.create` URL. Historical invoices/payouts remain intact; only the Connect account mapping is replaced.
- Until re-onboarding completes, invoice send / checkout routes already fail closed with `stripe_not_ready` because `chargesEnabled` will be `false` on the new live account.

### Live smoke test

Before handing builds to beta testers, run end-to-end on the deployed app:

1. Sign up a test provider → complete live Stripe Connect onboarding.
2. Send a small real-dollar invoice to a homeowner test account.
3. Pay with a real card from the mobile app.
4. Verify: webhook fires → `invoices.status` flips to `paid`; paid email arrives; in-app + push notifications delivered; payout pending on the provider's live Connect account minus the 3% platform fee.
