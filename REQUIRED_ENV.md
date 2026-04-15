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
