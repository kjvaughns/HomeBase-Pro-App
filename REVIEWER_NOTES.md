# HomeBase — App Store Reviewer Notes

## App overview

HomeBase is a two-sided marketplace for home services. Two roles share one
binary:

- **Homeowner**: discover providers, request services, track home
  maintenance, pay invoices.
- **Service Provider** (HomeBase Pro): the same person can also run a service
  business — manage clients, schedule jobs, send invoices, and accept
  payments.

The two roles share a single account; users can switch between them at any
time from the More tab.

## Demo account

| Field | Value |
| --- | --- |
| Email | `reviewer@homebaseproapp.com` |
| Password | _provided in the App Store Connect notes field_ |
| Role | Homeowner + Service Provider (already approved) |

The reviewer account already has sample homes, clients, jobs, and invoices
populated so all features are reachable without onboarding.

## In-app purchases (RevenueCat)

HomeBase Pro is the provider-side membership. It is sold **only** as an
auto-renewing subscription via Apple In-App Purchase (and Google Play on
Android), processed through RevenueCat. The web build of the app uses Stripe
because Apple's In-App Purchase rules don't apply to non-iOS digital purchases.

| Item | Type | Price | Period |
| --- | --- | --- | --- |
| HomeBase Pro Monthly | Auto-renewing subscription | $29.99 USD | 1 month |

- **Entitlement identifier**: `pro`
- **Monthly product ID**: configured in RevenueCat (`monthly` package on the
  current offering)
- **Free trial / introductory offer**: none configured at the IAP layer.
  HomeBase grants a server-side **7-day grace period** that begins
  automatically when a provider receives their first paid invoice. During
  that window all features remain free; after it ends, creating new jobs and
  sending invoices is gated until the provider subscribes.
- **Restore purchases**: available on the in-app **Subscription** screen
  (More → Subscription & Plan → "Restore purchases").
- **Manage / cancel**: the in-app **Subscription** screen routes the user to
  the system subscription settings (Apple ID subscriptions on iOS, Play Store
  subscriptions on Android). HomeBase never asks the user to manage payment
  on a website.

## How to reach the subscription paywall

1. Sign in with the reviewer account.
2. Tap **More → Switch to Provider Mode** (already approved).
3. Tap **More → Subscription & Plan**.
4. The screen shows the current state (free / trial / expired / subscribed),
   the localized price from the App Store, the Subscribe and Restore
   purchases buttons, the auto-renewal disclosure, and the Terms of Use
   (EULA) and Privacy Policy links.

You can also reach a subscription gate by trying to create a new Job (More →
Schedule → +) or a new Invoice (More → Invoices → +) **after** the trial has
ended on a provider account. The gate sheet has a Subscribe button that takes
you to the same Subscription screen.

## Account creation, sign-in, and account deletion

- Sign-up and sign-in are available in-app via email/password. Sign in with
  Apple is supported via `expo-apple-authentication`.
- **In-app account deletion** is available at: **More → Account & Security →
  Delete Account**. Deleting the account removes the user and cascades
  through provider profile, homes, appointments, jobs, and invoices.

## Required URLs

- **Privacy Policy**: <https://homebaseproapp.com/privacy>
- **Terms of Use (EULA)**: <https://homebaseproapp.com/terms>

Both are also linked directly from the Subscription screen and from the
Sign-Up screen.

## Server-side gating logic (for context)

- A provider stays in the **free** state until their first paid invoice.
- After the first paid invoice the provider enters a **7-day grace period**.
- After grace expires, `POST /api/jobs` and `POST /api/invoices` return HTTP
  403 with `code: "SUBSCRIPTION_REQUIRED"` until the provider subscribes.
- RevenueCat → `/api/revenuecat/webhook` is the authoritative source for
  flipping `isSubscribed` on/off based on Apple/Google receipt events
  (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`,
  `BILLING_ISSUE`, etc.). Auto-renew turned off does not immediately revoke
  access — the user remains entitled until `expiration_at_ms`.

## What the homeowner-facing parts do (no IAP involved)

The homeowner side of the app is free. Homeowners pay providers for
**physical home services** (plumbing, lawn care, etc.) via Stripe Connect.
Per Apple's guidelines, those transactions are explicitly outside the scope
of In-App Purchase because they are payments for real-world services rendered
outside the app.
