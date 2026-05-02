# HomeBase Homeowner Portal — Full Audit (May 2026)

**Audit date:** May 2, 2026
**Scope:** End-to-end review of the homeowner portal — all 27 homeowner screens under `client/screens/homeowner/`, the auth + onboarding screens that feed into it (`client/screens/auth/*`, `client/screens/onboarding/*`, `RoleGatewayScreen`, `RoleSwitchConfirmationScreen`, `BecomeProviderScreen`), the navigation graph (`HomeownerTabNavigator`, `RootStackNavigator`), the homeowner-facing API surface in `server/routes.ts` (~13,700 lines), the supporting state stores / hooks (`authStore.ts`, `homeownerStore.ts`, `usePushNotifications.ts`), and the cross-cutting helpers (`query-client.ts`, `notificationService.ts`, `emailService.ts`, `stripeConnectService.ts`).
**Comparison baseline:** April 14, 2026 audits — `docs/homeowner-mvp-audit.md` and `docs/homeowner-design-ux-audit.md`.
**Method:** Static code review across screens, hooks, navigators, server routes, and DB schema; cross-checking against the prior baseline; verifying claims by spot-reading current source. **No runtime API calls were made; no code was modified.** This document is investigation only.

---

## 1. Executive Summary

The homeowner portal has progressed dramatically since the April 14 baseline. **Every primary home tool has been wired to real backend data.** What was the single biggest "not ready" item in April — six homeowner screens (`HouseFax`, `HealthScore`, `ServiceHistory`, `SurvivalKit`, `Budgeter`, `SavingsSpend`) rendering hardcoded `MOCK_*` arrays as if they were the user's data — is largely resolved:

- `HouseFaxScreen` now fetches `GET /api/housefax/:homeId` (`server/routes.ts:2480`) and renders real housefax entries, derived asset lifecycle, and AI insights from the actual home age and service gaps.
- `HealthScoreScreen` computes the score client-side from real wizard answers, persists it via `PUT /api/homes/:id` (`server/routes.ts:2080`), and writes back home attribute changes via `PATCH /api/homes/:id/profile`.
- `ServiceHistoryScreen` pulls from a new `GET /api/homes/:homeId/service-history` endpoint (`server/routes.ts:6254`) joining `appointments` × `providers`. The April-era `MOCK_SERVICE_ENTRIES` / `MOCK_PAST_PROVIDERS` arrays are gone.
- `SurvivalKitScreen` runs a 17-step wizard that pre-fills from real home profile data and persists answers via `PATCH /api/homes/:homeId/profile`.
- `BudgeterScreen` and `SavingsSpendScreen` were converted to honest "Coming Soon" feature-preview screens (`UPCOMING_FEATURES` and `SAVINGS_FEATURES` arrays at `BudgeterScreen.tsx:20` and `SavingsSpendScreen.tsx:20`) — a substantial trust upgrade over the April mock-data state. `BudgeterScreen` is reachable today as a guest from the `FindScreen` "Homeowner Tools" footer (`FindScreen.tsx:91–119, 975–1020`); `SavingsSpendScreen` is still unreachable (typed but not registered). See §4.1.

The booking → payment → review pipeline is solid end-to-end with real Stripe Connect integration, server-computed amounts, webhook idempotency, server-side ownership checks on every mutation, and a `chargesEnabled` gate before booking with non-onboarded providers. Account deletion (`DELETE /api/auth/account`, `server/routes.ts:1796–1907`) is a comprehensive transactional cascade across users, homes, appointments, jobs, invoices, payments, reviews, push tokens, support tickets, and Stripe customers.

**One critical security finding warrants attention before paid launch:** `GET /api/homes/:homeId/service-history` (`server/routes.ts:6254`) and `GET /api/homes/:homeId/reminders` (`:6304`) require auth but **do not verify the home belongs to the caller** — any logged-in user can read another homeowner's full service history (including free-text notes that contain sensitive intake details) by iterating `homeId` UUIDs. See §4.18. Fix is a 5-line copy of the ownership block from `/api/housefax/:homeId`.

What remains is **second-order polish, two reachability gaps, one unimplemented sub-feature, and small cross-cutting hardening items** rather than foundation work:

- `BudgeterScreen` is registered in `RootStackNavigator.tsx:351` and reachable to **guests only** via the `FindScreen` "Homeowner Tools" footer (`FindScreen.tsx:91–119, 309–312, 975–1020`) — the footer renders only when `!isAuthenticated && !isSearching`, so authenticated homeowners have no entry point to it. `SavingsSpendScreen` is **typed in `RootStackParamList` (`RootStackNavigator.tsx:96`) but has no import and no `<Stack.Screen>` registration** — it cannot be reached, and a stray `navigation.navigate("SavingsSpend")` would crash. Two related screens, two different problems: Budgeter is half-wired (guest-only entry, "Coming Soon" payload); SavingsSpend is fully orphaned.
- `AppointmentDetailScreen.tsx:356` shows a "Coming Soon — Messaging will be available in a future update" `Alert.alert` when the homeowner taps "Message Provider", and there is no homeowner ↔ provider message thread endpoint in `server/routes.ts`. The UI affordance exists; the pipe doesn't.
- `ProfileEditScreen` displays an `<Avatar>` but has **no upload trigger and no client-side wiring of `avatarUrl`** to the existing `PUT /api/user/:id` (server already accepts the field at `routes.ts:1944`).
- `AddressesScreen` lets a homeowner add or delete a home but **cannot edit an existing address** — only the nickname can be changed; correcting a typo requires delete + re-add (which loses `housefax_entries` and `appointments` history references).
- `client/lib/query-client.ts` does not implement a global 401 → forced-logout interceptor; an expired JWT mid-session surfaces as a generic per-screen error string instead of routing the user back to `Login`.
- `POST /api/support/ticket` (`server/routes.ts:13675–13725`) and the unauthenticated `POST /api/auth/forgot-password` (`server/routes.ts:1560`) ship without per-route rate limiting (general infrastructure only) — both are spam-amplification candidates because both trigger transactional Resend emails.
- No analytics or crash-reporting SDK is wired (`package.json` has no PostHog / Sentry / Mixpanel / @sentry/react-native). Production incidents will be invisible.

### Readiness score: **8.0 / 10 — Almost ready; one Critical security fix + ~1 day of cleanup**

Up from **6.0 / 10** in the April 14 baseline. The §4.18 IDOR is the single must-fix before paid rollout (small, surgical change). The remaining gaps are bounded and none of them are foundational. With the P0 fix plus P1–P5 in §10 below, the homeowner portal is ready for paid rollout in parallel with the provider portal.

---

## 2. Inventory

### 2.1 Homeowner screens (27 files)

Status vocabulary used throughout this report (matches the provider audit):

- **Working** — fully functional with real data, no known bugs.
- **Partial** — primary path works, but a sub-feature is missing or stubbed.
- **Broken** — primary path fails (crash, persistence loss, security defect, or UI deadlock).
- **Stubbed-Mock** — uses hardcoded sample data instead of real backend.
- **Missing** — file unreachable from any homeowner navigation target (orphan / dead code).

The task spec (`task-267.md`) requested a **Pass / Partial / Fail** verdict per screen. The mapping is:

- **Pass** = `Working`
- **Partial** = `Partial`
- **Fail** = `Broken`, `Stubbed-Mock`, or `Missing`

The inventory below uses the literal `Pass / Partial / Fail` labels in the Status column and `N/A` in the Severity column where appropriate. Counts: **21 Pass, 5 Partial, 1 Fail** — Pass = rows 1–11, 13–15, 18–20, 22–24 (note: rows 5 `AIChat` and 6 `SmartIntake` are guest-reachable but explicitly client-gate the protected actions via `AccountGateModal` before any API call, so they Pass); Partial = rows 12, 16, 17, 25, 26 (`Budgeter`, guest-only stub); Fail = row 27 (`SavingsSpend`, typed but unregistered). Note: row 24 (`ServiceHistoryScreen`) is Pass on the client but flagged with a *server-side* High severity for the §4.18 IDOR.

The **Reachable** column uses these tags:

- **Guest+Auth** — both unauthenticated browsers and signed-in homeowners can reach the screen.
- **Auth-only** — requires a signed-in homeowner; not in the guest tab set or routed via `AccountGateModal` first.
- **Auth-gated mid-flow** — guests can start the flow but `AccountGateModal` (`client/components/AccountGateModal.tsx`) blocks the final destructive action (e.g. completing a booking, leaving a review).
- **No** — registered or typed but no homeowner code path navigates to it.

| # | Screen | Reachable | Status | Severity | One-line note |
|---|---|---|---|---|---|
| 1 | `HomeScreen` | Auth-only (HomeTab) | Pass | N/A | Real `GET /api/users/:userId/appointments` (`routes.ts:3344`); pull-to-refresh; categories; quick actions. **HomeTab is conditionally mounted at `HomeownerTabNavigator.tsx:168` — guests do not see this tab at all.** |
| 2 | `FindScreen` | Guest+Auth (FindTab) | Pass | Low | Real `GET /api/providers` with lat/lng (`routes.ts:3071`); `PRESET_LOCATIONS` (`FindScreen.tsx:70`) is the only hardcoded constant — list of major US cities for the location picker, not user data. The header swaps from "HomeBase" (guest) to "Find a Pro" (auth) at `HomeownerTabNavigator.tsx:183`. |
| 3 | `ManageScreen` | Guest+Auth (ManageTab) | Pass | N/A | Collapsible Upcoming / Active / Past sections backed by `GET /api/users/:userId/appointments` (`routes.ts:3344`). For guests this renders an empty state CTA to sign in. The April baseline's "missing endpoint" finding is now resolved. |
| 4 | `MoreScreen` | Guest+Auth (MoreTab) | Pass | N/A | Tools / account / settings / support sections. Account-only items (Edit Profile, Addresses, Notifications, Account Security, Saved Providers) are hidden for guests. Account deletion modal calls `DELETE /api/auth/account` (`routes.ts:1796`). |
| 5 | `AIChatScreen` | **Guest+Auth** (RootStack via `FindScreen` AI card `:368–372` + AppointmentDetail/Onboarding) | Pass | N/A | Reachable to guests because the `FindScreen` "Ask HomeBase AI" card is *not* auth-gated (only the search panel is). `sendMessage` checks `!isAuthenticated` first (`AIChatScreen.tsx:64–69`) and opens `AccountGateModal` *before* any request to `POST /api/chat/simple` (`routes.ts:4862`, `requireAuth + aiRateLimit` at `routes.ts:294`). Authenticated users get the full AI chat with intake hand-off; guests are converted into the auth flow. |
| 6 | `SmartIntakeScreen` | **Guest+Auth** (RootStack — entered from `BudgeterScreen.tsx:85`, `AIChatScreen.tsx:120`, `HouseFaxScreen.tsx:370, 583`, `HealthScoreScreen.tsx:926`, all of which are guest-reachable) | Pass | N/A | 4-step AI wizard (`/api/intake/analyze`, `/api/intake/refine`, `/api/intake/match-providers` at `routes.ts:5947 / 6012 / 6099`); all three protected by `requireAuth + aiRateLimit`. `handleDescribeSubmit` (`SmartIntakeScreen.tsx:159–166`) gates the call with `if (!isAuthenticated) setShowAccountGate(true)` *before* hitting the API, and the auto-analyze effect (`:152–157`) only fires when authenticated. So guests see the prompt UI, attempt to submit, get the gate modal, and convert. |
| 7 | `ProviderListScreen` | Guest+Auth (RootStack) | Pass | N/A | `GET /api/providers?categoryId=…` is public (no auth); with lat/lng for distance sorting; `EmptyState` shown on no results. |
| 8 | `ProviderProfileScreen` | Guest+Auth (RootStack) | Pass | Low | Public `GET /api/providers/:id` (`routes.ts:3127`). About / Services / Reviews tabs; Save provider triggers `AccountGateModal` for guests. Call/Text via `Linking.openURL`. Review reporting wired to moderation queue. Uses `Alert.alert` (lines 204, 207, 315, 318, 330, 333) — guidelines forbid emojis but `Alert.alert` is acceptable for system errors and confirmations. |
| 9 | `SavedProvidersScreen` | Auth-only (RootStack) | Pass | N/A | Real `GET /api/saved-providers` (`routes.ts:3208`, requires auth); `useMutation` for unsave with cache invalidation. Hidden from guests on `MoreScreen`. |
| 10 | `SimpleBookingScreen` | Auth-gated mid-flow (RootStack) | Pass | N/A | Guests can browse the wizard; `AccountGateModal` triggers before final `POST /api/appointments` (`routes.ts:3635`). Idempotency check at `routes.ts:3657–3681` prevents double-tap duplicates; deposit via Stripe Checkout (`routes.ts:3694–3787`) with rollback on failure. |
| 11 | `BookingSuccessScreen` | Auth-only (RootStack) | Pass | Low | Reachable only after a successful booking, so always auth. Uses `CommonActions.reset` to prevent back-navigation. **Sub-issue:** if the deposit Stripe Checkout redirect was closed, there is no resume CTA — user has to navigate to `AppointmentDetail` and pay from there. |
| 12 | `AppointmentDetailScreen` | Auth-only (RootStack) | Partial | Medium | `GET /api/appointment/:id` (singular, `routes.ts:3363`) with ownership check; cancel via `POST /api/appointments/:id/cancel` (`:4238`); reschedule via `POST /api/appointments/:id/reschedule` (`:4373`). **Sub-issue:** "Message Provider" CTA shows `Alert.alert("Coming Soon", "Messaging will be available in a future update.")` (`AppointmentDetailScreen.tsx:356`) — no `/api/messages` endpoint exists for homeowner ↔ provider threads. |
| 13 | `JobDetailScreen` | Auth-only (RootStack) | Pass | Low | Read-only timeline + photos; provider-uploaded photos served via `/api/jobs/:id/photos`. **Sub-issue:** if the provider does not upload, the homeowner has no in-app channel to ask. |
| 14 | `PaymentScreen` | Auth-only (RootStack) | Pass | Low | `GET /api/invoices/:id` (`routes.ts:8798`) + `POST /api/invoices/:id/checkout` (`routes.ts:11485`) hosted-checkout fallback; 5-second `refetchInterval` polling for status (functional but could be replaced by webhook-pushed invalidation). All amounts pulled server-side from the invoice DB row. `assertInvoiceAccess` ownership check. |
| 15 | `ReviewScreen` | Auth-only (RootStack) | Pass | N/A | `POST /api/appointments/:id/review` (`routes.ts:7406`); 409 Conflict on duplicate; provider rating recalculated server-side from full review average (`routes.ts:7469–7489`). |
| 16 | `ProfileEditScreen` | Auth-only (RootStack) | Partial | Medium | `PUT /api/user/:id` (`routes.ts:1930`) for name + phone with `authStore.updateUser` sync. **Sub-issue:** Avatar UI is rendered but no upload trigger; server already accepts `avatarUrl` (`routes.ts:1944`) but the client never sets it. |
| 17 | `AddressesScreen` | Auth-only (RootStack) | Partial | Medium | `GET /api/homes/:userId` + `POST /api/homes` + `DELETE /api/homes/:id` all wired. Google Places autocomplete works. **Sub-issue:** no `Edit address` flow — only the nickname is editable; correcting a typo means deleting the home, which orphans the `housefax_entries` and `appointments` history pointing at it. |
| 18 | `NotificationsScreen` | Auth-only (RootStack) | Pass | N/A | `GET /api/notifications/:userId` (`routes.ts:4550`); deep links to `AppointmentDetail`, `InvoiceDetail`, `ClientDetail`. |
| 19 | `NotificationPreferencesScreen` | Auth-only (RootStack) | Pass | N/A | `GET /api/notification-preferences/:userId` (`routes.ts:4704`) + `POST /api/notification-preferences` (`routes.ts:4743`). Honored by `notificationService.ts:isEmailAllowed` (line 205) and the push send path (`notificationService.ts:836`, where `prefs.pushEnabled === false` aborts the send). |
| 20 | `HelpCenterScreen` | Guest+Auth (RootStack) | Pass | N/A | Static `FAQ_SECTIONS` is intentionally hardcoded — content is realistic, not lorem. CMS not justified at this scale. |
| 21 | `ContactUsScreen` | Guest+Auth (RootStack) | Pass | Low | `POST /api/support/ticket` (`routes.ts:13675`) is public; creates a `support_tickets` row + emails support via `sendSupportTicketEmail`. **Sub-issue:** no per-route rate limit; spam-amplification candidate. |
| 22 | `HouseFaxScreen` | **Guest+Auth** (auth: `MoreScreen` Tools; guest: `FindScreen` footer `:91–119, 975–1020`) | Pass | N/A | `GET /api/housefax/:homeId` (`routes.ts:2480`) + `GET /api/homes/:homeId/profile` (`routes.ts:2326`); auto-derived asset lifecycle from `housefax_entries`; AI insights from real home age. Both endpoints require auth + ownership, so a guest reaches the screen and sees an empty/error state but cannot read another user's data. |
| 23 | `HealthScoreScreen` | **Guest+Auth** (auth: `MoreScreen` Tools; guest: `FindScreen` footer) | Pass | N/A | 14-question wizard; `computeScoreFromAnswers`; persists score via `PUT /api/homes/:id` (`routes.ts:2080`); writes back home attributes via `PATCH /api/homes/:id/profile`. Persistence calls 401 for guests; the wizard itself runs client-side and is fully reachable. |
| 24 | `ServiceHistoryScreen` | Auth-only (RootStack via `MoreScreen` Tools) | Pass | High (server) | `GET /api/homes/:homeId/service-history` (`routes.ts:6254`) joins `appointments × providers`; no mock arrays remain. **Server-side defect:** the endpoint has no ownership check (see §4.18). The screen renders correctly; the API behind it is currently exploitable. (Not present in `HOME_TOOLS` so genuinely auth-only via `MoreScreen`.) |
| 25 | `SurvivalKitScreen` | **Guest+Auth** (auth: `MoreScreen` Tools; guest: `FindScreen` footer) | Partial | Low | 17-step wizard pre-fills from real home profile; persists answers via `PATCH /api/homes/:homeId/profile`. **Sub-issue:** the maintenance task list itself is generated client-side via `generateTasksFromWizardData` and not persisted — switching devices means re-running the wizard. Persistence call 401s for guests; the wizard UI is reachable. |
| 26 | `BudgeterScreen` | Guest-only (`FindScreen` footer) | Partial (Stubbed-Mock) | Medium | Honest "Coming Soon" content (`UPCOMING_FEATURES` array, `BudgeterScreen.tsx:20`). Reachable from the `FindScreen` "Homeowner Tools" guest footer (`FindScreen.tsx:91–119, 309–312, 975–1020`), which renders only when `!isAuthenticated && !isSearching`. Imported + registered (`RootStackNavigator.tsx:27, 351`). **Authenticated homeowners have no entry point** — `MoreScreen` does not surface it. Either also list it on `MoreScreen` as a disabled "Coming soon" tile, or accept the guest-funnel-only role. |
| 27 | `SavingsSpendScreen` | **No** (typed, not registered) | Fail (Stubbed-Mock + Missing) | Medium | Same UI pattern as `BudgeterScreen` (`SAVINGS_FEATURES` array at line 20), but the file is **not imported and not registered** in `RootStackNavigator` — only typed in `RootStackParamList` (`RootStackNavigator.tsx:96`). A stray `navigation.navigate("SavingsSpend")` would throw at runtime. Either wire it up or delete the type. |

**Additional dead code (not in the inventory above because they are not active routes):** `client/screens/ProfileScreen.tsx`, `client/navigation/MainTabNavigator.tsx`, `client/navigation/HomeStackNavigator.tsx`, and `client/navigation/ProfileStackNavigator.tsx` form a self-contained chain (`MainTab → HomeStack + ProfileStack → ProfileScreen`) that is **never imported anywhere outside that chain** (`grep -rn "MainTabNavigator" client/ --include="*.tsx"` returns only the file itself). The active app uses `RootStackNavigator` + `HomeownerTabNavigator` / `ProviderTabNavigator` instead. **Recommendation:** delete all four files in a follow-up cleanup pass — they confuse code search and architectural reasoning, and `ProfileScreen` in particular shadows the role-based profile screens that actually ship.

**Tab navigator (conditional):** the underlying `Tab.Navigator` declares 4 tabs, but `HomeTab` is mounted only when `isAuthenticated` is true (`client/navigation/HomeownerTabNavigator.tsx:168–177`). The effective tab sets are:

- **Guest tabs (3):** `FindTab`, `ManageTab`, `MoreTab`. (`FindTab` becomes the landing tab.)
- **Authenticated homeowner tabs (4):** `HomeTab`, `FindTab`, `ManageTab`, `MoreTab`.

Guests can reach (in addition to the rows already tagged Guest+Auth in the table above): `WelcomeScreen`, `LoginScreen`, `SignUpScreen`, `ForgotPasswordScreen`, `OnboardingScreen` (via "Continue as Guest" → "Browse"), `ProviderListScreen`, `ProviderProfileScreen`, `SimpleBookingScreen` (up to the `AccountGateModal` blocker), `HelpCenterScreen`, `ContactUsScreen`, and the four screens listed in `FindScreen.tsx` `HOME_TOOLS` + the AI card: `BudgeterScreen`, `SurvivalKitScreen`, `HealthScoreScreen`, `HouseFaxScreen`, `AIChatScreen`, plus `SmartIntakeScreen` (entered from any of the four "Tools" screens or `AIChatScreen`). Genuinely auth-only homeowner screens (no guest reachability, registered in `RootStackNavigator.tsx`) are: `HomeScreen`, `AppointmentDetailScreen`, `BookingSuccessScreen`, `NotificationsScreen`, `NotificationPreferencesScreen`, `ProfileEditScreen`, `AddressesScreen`, `SavedProvidersScreen`, `ServiceHistoryScreen`, `ReviewScreen`, plus the auth/onboarding screens.

> **Correction vs the previous draft of this report:** earlier copy listed `PaymentMethodsScreen`, `CreditsScreen`, and `MessagesScreen` as auth-only homeowner screens — those file names do **not** exist as registered routes in `RootStackNavigator.tsx`. Payment is handled inline in `SimpleBookingScreen` via Stripe Checkout/PaymentSheet, the homeowner does not have a dedicated "credits" or "messages" screen today, and any reference in this report to those names should be read as "doesn't exist."

(See Appendix B for the full tab + MoreScreen layout.)

### 2.2 Auth + onboarding screens (12 files, all reachable)

| # | Screen | Status | Severity | Note |
|---|---|---|---|---|
| A1 | `WelcomeScreen` | Pass | N/A | Static landing; signup / login / "Browse as guest" → `Main`. |
| A2 | `LoginScreen` | Pass | N/A | `POST /api/auth/login` (`routes.ts:1402`); generic 401 + network error UX. Email is trimmed. |
| A3 | `SignUpScreen` | Pass | N/A | `POST /api/auth/signup` (`routes.ts:1182`); validates against `insertUserSchema`; forces `activeRole = "homeowner"`; `navigation.reset` to `Onboarding`. |
| A4 | `ForgotPasswordScreen` | Pass | Low | `POST /api/auth/forgot-password` (`routes.ts:1560`) is fully wired: signs a 1-hour reset JWT, builds `${protocol}://${host}/reset-password?token=…`, calls `sendPasswordResetEmail` (fire-and-forget). Reset is consumed by `POST /api/auth/reset-password` (`routes.ts:1609`). **Sub-issue:** no per-route rate limit; the `host` header is taken from `x-forwarded-host` without an allow-list (header-injection candidate that would cause an off-domain reset link). |
| A5 | `OnboardingScreen` (post-auth address capture) | Pass | Low | `POST /api/homes` (`routes.ts:1976`) with Zillow + Google Places enrichment. Nickname state defaults to `"My Home"` literal at `OnboardingScreen.tsx:37`. |
| A6 | `AccountSecurityScreen` | Pass | Low | Change email + change password + delete account; `change-password` re-issues the JWT via `setSessionToken`; some `console.log` spam (line 75). |
| A7 | `HomeownerOnboardingScreen` | Pass | N/A | Animated priorities + features intro; client-side `onboardingStore` only. |
| A8 | `AccountTypeSelectionScreen` | Pass | N/A | Role choice; routes to `HomeownerOnboarding` or provider onboarding. |
| A9 | `FirstLaunchScreen` | Pass | N/A | Animated splash; presentational only. |
| A10 | `RoleGatewayScreen` | Pass | Low | Post-login role chooser for dual-role users. Often bypassed by the auto-resolve in `RootStackNavigator.tsx:193` if `activeRole` is already persisted. |
| A11 | `RoleSwitchConfirmationScreen` | Pass | N/A | Confirmation modal; uses `navigation.reset` to swap tab navigators. |
| A12 | `BecomeProviderScreen` | Pass | Low | `POST /api/provider/register` (`routes.ts:3161`); idempotent — checks for existing profile on mount; `console.log` spam (line 72). |

### 2.3 Homeowner-relevant DB tables (used by homeowner flows)

`users`, `homes`, `service_categories`, `services`, `providers`, `provider_services`, `provider_custom_services`, `appointments`, `reviews`, `saved_providers`, `review_reports`, `notifications`, `notification_preferences`, `notification_deliveries`, `maintenance_reminders`, `housefax_entries`, `home_field_changes`, `intake_submissions`, `push_tokens`, `support_tickets`, `user_credits`, `credit_ledger`, `stripe_webhook_events`, `invoices`, `invoice_line_items`, `payments`, `refunds`. The schema as a whole defines 39 tables (see Appendix D of the provider audit); homeowner flows touch ~26 of them directly.

### 2.4 Homeowner-facing API surface (`server/routes.ts`)

| Group | Endpoints | Auth | IDOR check |
|---|---|---|---|
| Auth | `POST /api/auth/signup` (1182), `POST /api/auth/login` (1402), `POST /api/auth/logout` (1498), `POST /api/auth/refresh` (1523), `POST /api/auth/forgot-password` (1560), `POST /api/auth/reset-password` (1609), `POST /api/auth/change-password` (1646), `DELETE /api/auth/account` (1784) | Public for signup/login/forgot/reset; auth required for change-password / account deletion / `me` | n/a (acts on `req.authenticatedUserId`) |
| User | `GET /api/user/:id` (1909), `PUT /api/user/:id` (1930), `GET /api/users/:userId/appointments` (3344) | All require auth | Yes — `req.params.id !== authUserId → 403` |
| Homes / HouseFax | `GET /api/homes/:userId` (1958), `POST /api/homes` (1976), `PUT /api/homes/:id` (2080), `DELETE /api/homes/:id` (2111), `GET /api/homes/:homeId/profile` (2326), `PATCH /api/homes/:id/profile`, `GET /api/housefax/:homeId` (2480), `GET /api/homes/:homeId/service-history` (6254), `GET /api/homes/:homeId/reminders` (6304) | All require auth | **Mostly yes** — owner check by fetching home and comparing `home.userId` for `PUT`, `DELETE`, profile reads/writes, and `housefax`. **Two exceptions:** `GET /api/homes/:homeId/service-history` (`routes.ts:6254–6293`) and `GET /api/homes/:homeId/reminders` (`:6304`) have `requireAuth` only — no `home.userId === authUserId` check. See §4.18 (CRITICAL). |
| Providers (public) | `GET /api/categories` (3050), `GET /api/providers` (3071), `GET /api/providers/:id` (3127) | Public | n/a — only public fields exposed |
| Saved providers | `GET /api/saved-providers` (3208), `POST /api/saved-providers` (3251), `DELETE /api/saved-providers/:id` (3271) | All require auth | Scoped to `req.authenticatedUserId` |
| Appointments | `GET /api/users/:userId/appointments` (3344), `GET /api/appointment/:id` (singular, 3363), `POST /api/appointments` (3635), `POST /api/appointments/:id/cancel` (4238), `POST /api/appointments/:id/reschedule` (4373), `POST /api/appointments/:id/review` (7406) | All require auth | Yes — `userId === authUserId` or provider-of-record |
| AI | `POST /api/chat/simple` (4862), `POST /api/intake/analyze` (5947), `POST /api/intake/refine` (6012), `POST /api/intake/match-providers` (6099) | All require auth + `aiRateLimit` (294) | HouseFax context scoped by ownership when `homeId` provided |
| Notifications | `GET /api/notifications/:userId` (4550), `POST /api/notifications/:id/read` (4568), `GET /api/notification-preferences/:userId` (4704), `POST /api/notification-preferences` (4743) | All require auth | Yes — `req.params.userId === authUserId` |
| Payments (homeowner) | `GET /api/invoices/:id` (8798), `POST /api/invoices/:id/checkout` (11485), `POST /api/invoices/:invoiceId/payment-intent` (11158), `POST /api/invoices/:invoiceId/apply-credits` (11536), `POST /api/homeowner/setup-payment-sheet` (11196), `GET /api/homeowner/payment-methods` (11251), `DELETE /api/homeowner/payment-methods/:pmId` (11300), `PATCH /api/homeowner/default-payment-method` (11333), `POST /api/homeowner/payment-sheet` (11374) | All require auth | Yes — `assertInvoiceAccess`; payment methods scoped to Stripe customer of `req.authenticatedUserId` |
| Webhooks | Stripe platform + Connect + RevenueCat | Public, signature-verified | Idempotent via `stripe_webhook_events` (`stripeWebhookRouter.ts:201–223, 317–345`) |
| Support | `POST /api/support/ticket` (13675) | Public | Creates `support_tickets` row + emails support |
| Push | `POST /api/push-tokens`, `DELETE /api/push-tokens/:token` | Auth | Token bound to `req.authenticatedUserId` |

---

## 3. Status of April 14 critical / high findings

| April 14 finding | April severity | May 2026 status | Note |
|---|---|---|---|
| `ServiceHistoryScreen` renders `MOCK_SERVICE_ENTRIES` / `MOCK_PAST_PROVIDERS` as if it were the user's data | Critical | **Resolved (with caveat)** | Real `GET /api/homes/:homeId/service-history` (`routes.ts:6254`) joining `appointments × providers`; no mock arrays remain. **New finding:** the endpoint has no ownership check (§4.18). |
| `SurvivalKitScreen` renders `MOCK_TASKS` / `MOCK_TIPS` as if it were a personalized plan | Critical | **Resolved (mostly)** | Wizard now pre-fills from real home profile and persists answers. Generated task list is still client-side and not cross-device persisted. |
| `BudgeterScreen` renders `BUDGET_CATEGORIES` / `RECENT_TRANSACTIONS` as if they were the user's finances | Critical | **Resolved (different way)** | Replaced with an honest "Coming Soon" preview. Reachable as guest from `FindScreen` footer; not surfaced to authed users (see §4.1). |
| `SavingsSpendScreen` renders `MOCK_CATEGORIES` / `MOCK_SAVINGS_WINS` as if they were real savings | Critical | **Resolved (different way)** | Honest "Coming Soon" preview, but the file is typed in `RootStackParamList` and never imported/registered — unreachable from anywhere (see §4.1). |
| `HouseFaxScreen` shows demo data and not actual home data | High | **Resolved** | Real `GET /api/housefax/:homeId`; AI insights based on real home attributes; document tracking pulled from real invoice data. |
| `HealthScoreScreen` score not persisted between sessions | High | **Resolved** | `PUT /api/homes/:id` persists score and `lastHealthScoreAt`; wizard answer write-back via `PATCH /api/homes/:id/profile`. |
| `ManageScreen` — `GET /api/users/:userId/appointments` was reportedly missing | High (April) | **Resolved / never broken** | Endpoint exists at `routes.ts:3344–3359` with `requireAuth` and explicit `if (req.params.userId !== authUserId) → 403`. The April finding was a verification gap; one explorer in this round repeated the claim and was independently disproven by direct file inspection. |
| Homeowner ↔ Provider messaging UI is rendered but has no backend | High | **Unchanged** | "Message Provider" still triggers `Alert.alert("Coming Soon", "Messaging will be available in a future update.")` at `AppointmentDetailScreen.tsx:356`. Same in `JobDetailScreen` for any photo-request channel. |
| Avatar upload UI rendered without persistence | Medium | **Unchanged** | UI shows `<Avatar>` but no upload trigger; `PUT /api/user/:id` already accepts `avatarUrl` (`routes.ts:1944`). |
| Address edit not supported (only nickname) | Medium | **Unchanged** | `AddressesScreen` still requires delete + re-add to correct an address. |
| Payment screen polling vs push invalidation after Stripe redirect | Low | **Unchanged** | 5-second `refetchInterval` works but a webhook-driven cache invalidation would be cleaner. |
| Account deletion does not cascade to all child rows | High | **Resolved** | `DELETE /api/auth/account` (`routes.ts:1796–1907`) is a comprehensive transactional cascade across users, homes, appointments, jobs, invoices, line items, payments, reviews, push tokens, notification prefs, support tickets, and the Stripe customer. |

**Net:** 7 of 11 April critical/high findings are fully resolved. 1 was never actually broken (verification artifact). 3 remain as Medium-severity sub-features (messaging, avatar upload, address edit). 0 regressions.

---

## 4. New findings (not in April 14 audits)

### 4.1 `BudgeterScreen` is half-wired and `SavingsSpendScreen` is fully orphaned — **[Partial / Medium]**

- **`BudgeterScreen` — guest-only entry, no authed entry.** Imported at `RootStackNavigator.tsx:27`, typed in `RootStackParamList` at `:97`, and registered as a `<Stack.Screen>` at `:351`. It is reached from the `FindScreen` "Homeowner Tools" footer: `HOME_TOOLS` declares `{ id: "budgeter", screen: "Budgeter", … }` (`FindScreen.tsx:91–119`), `handleToolPress` calls `navigation.navigate(tool.screen as any)` (`:309–312`), and `renderFooter` maps the array onto pressable tiles (`:975–1020`). **Critical caveat:** the footer is gated by `!isAuthenticated && !isSearching` (`:977`), so the screen is reachable to *guests only* — once a homeowner signs in, the tile disappears and there is no other entry point (`MoreScreen.tsx:174–213` routes only to `SurvivalKit`, `HouseFax`, `HealthScore`, `ServiceHistory`). The same guest-only constraint also applies to the existing tools (`SurvivalKit`, `HealthScore`, `HouseFax`) listed in that footer, but those are also surfaced to authed users via `MoreScreen`; only Budgeter is exclusively guest-facing.
- **`SavingsSpendScreen` — typed but not registered.** The `RootStackParamList` declares `SavingsSpend: undefined` at `RootStackNavigator.tsx:96`, but the file is **not imported** and there is **no `<Stack.Screen name="SavingsSpend">`**. A stray `navigation.navigate("SavingsSpend")` would type-check but throw at runtime with "no screen registered for that name."
- Both files render an honest "Coming Soon" feature preview (good). Budgeter delivers a teaser to the guest funnel today; SavingsSpend delivers nothing.

**Impact:** Authenticated homeowners cannot find Budgeter; the marketing teaser only reaches signed-out browsers (which is probably the opposite of intent for a "future paid feature" preview). Latent runtime crash if any code accidentally navigates to `SavingsSpend`.
**Fix:**
- For `Budgeter`: surface it on `MoreScreen` as a disabled "Coming soon" tile so authed users can also see it (preferred), or accept that the guest funnel is the only intended audience and document that.
- For `SavingsSpend`: either (a) import + register the screen and surface it from `MoreScreen` (and add it to `HOME_TOOLS` if it should also appear in the guest funnel), or (b) delete the `SavingsSpend: undefined` line from `RootStackParamList` and delete `SavingsSpendScreen.tsx` until a real implementation lands.

### 4.2 No global 401 / session-expiry interceptor — **[Partial / Medium]**

- `client/lib/query-client.ts` injects the JWT and surfaces 401 as a generic `Error` from `throwIfResNotOk`.
- There is no top-level handler in `App.tsx` that listens for `error.status === 401` to call `authStore.logout()` + `navigation.reset({ routes: [{ name: "Login" }] })`.
- When a JWT expires mid-session (24h default), every authenticated screen breaks individually with whatever generic error UI it implements — `HomeScreen` shows nothing, `ManageScreen` shows an empty list, `PaymentScreen` shows a one-shot error (the 5-second poll is gated on `query.state.data?.invoice?.status` at `PaymentScreen.tsx:69–81`, so a 401 throws once and stops; `retry: false` is set globally in `client/lib/query-client.ts:105`). The user has to force-quit and relaunch.

**Fix:** Wrap `apiRequest` so a 401 dispatches a global `auth:expired` event; `App.tsx` listens once and routes to `Welcome`/`Login`.

### 4.3 No analytics or crash-reporting SDK — **[Missing / Medium]**

- `package.json` contains no `posthog-react-native`, `@sentry/react-native`, `sentry-expo`, `mixpanel-react-native`, or `expo-insights`.
- `appReviewStore.recordHappyMoment` is the only behavioral signal recorded, and only locally for App Store review prompts.
- Production incidents will be invisible. There is no funnel visibility on signup → first booking → first paid invoice.

**Fix:** Add `@sentry/react-native` (Expo Go-compatible per the development guidelines) for crashes + a lightweight analytics SDK (PostHog) for funnel events. Also wire to `client/components/ErrorBoundary.tsx`.

### 4.4 `POST /api/support/ticket` and `POST /api/auth/forgot-password` lack per-route rate limiting — **[Partial / Medium]**

- `POST /api/support/ticket` (`routes.ts:13675–13725`) is unauthenticated and triggers `sendSupportTicketEmail` (Resend) for every submission. Spam amplification candidate.
- `POST /api/auth/forgot-password` (`routes.ts:1560`) is unauthenticated, signs a 1-hour reset JWT, and triggers `sendPasswordResetEmail`. Same spam vector. The endpoint correctly avoids account-existence disclosure (always returns 200 with the same generic message).
- AI endpoints already use `aiRateLimit` and onboarding helpers use `onboardingRateLimit`. The pattern is in place; these two endpoints just don't opt in.

**Fix:** Add an `emailAbuseRateLimit` (e.g. 5 req / 10 min per IP) to both endpoints.

### 4.5 `forgot-password` reset URL host is taken from `x-forwarded-host` without allow-list — **[Partial / Low]**

- `routes.ts:1577` reads `req.headers["x-forwarded-host"]` and falls back to `req.get("host")` then to `"home-base-pro-app.replit.app"`.
- Behind a misconfigured proxy (or a directly-internet-reachable Express in a future deploy), an attacker can supply a forged `Host` or `X-Forwarded-Host` header so that the reset URL points at `attacker.com/reset-password?token=…` — a victim who clicks would leak the JWT to the attacker.
- The fallback string is safe; the per-request override is not.

**Fix:** Compare the resolved host against an allow-list (`process.env.PUBLIC_HOST` or a small static list); refuse to send the email if the host doesn't match.

### 4.6 `AppointmentDetailScreen` "Message Provider" is purely cosmetic — **[Stubbed-Mock / Medium]**

- `AppointmentDetailScreen.tsx:356` shows `Alert.alert("Coming Soon", "Messaging will be available in a future update.")` when the homeowner taps the messaging CTA.
- There is no homeowner ↔ provider messaging endpoint in `server/routes.ts`. The `provider_messages` table exists for provider-broadcast SMS but has no inbound homeowner channel.
- The provider-side audit also flagged `CommunicationsScreen` as broadcast-only with no inbox. The two findings together mean that homeowners and providers cannot exchange in-app messages at all today — only SMS / phone via `Linking.openURL`.

**Fix:** Either (a) implement a thread endpoint (`POST /api/appointments/:id/messages`, `GET /api/appointments/:id/messages`) backed by a new table, or (b) remove the CTA from the homeowner UI until ready.

### 4.7 Avatar upload is UI-only — **[Partial / Medium]**

- `ProfileEditScreen.tsx` renders `<Avatar>` but no `expo-image-picker` flow, no upload endpoint call, no `avatarUrl` set in the `PUT /api/user/:id` payload.
- The server already accepts `avatarUrl` (`routes.ts:1944`) and the `users` schema has the column. Only the client wiring + a storage destination (Supabase Storage bucket or `expo-file-system` → server `multer`) is missing.

**Fix:** Add an `expo-image-picker` button on the avatar; upload to a new `POST /api/user/:id/avatar` endpoint that writes to Supabase Storage and returns the URL; client sets it on the next `PUT /api/user/:id`.

### 4.8 `AddressesScreen` cannot edit an existing home — **[Partial / Medium]**

- The screen has add + delete affordances only.
- `PUT /api/homes/:id` already exists at `routes.ts:2080–2109` and does the right ownership check.
- A user who mistypes a street number can only fix it by deleting the home, which orphans the `housefax_entries` and `appointments` history pointing at it (those rows cascade-delete in the current schema, so the user actually loses real data).

**Fix:** Add an "Edit" affordance per home that opens an autocomplete + nickname form bound to `PUT /api/homes/:id`.

### 4.9 `BookingSuccessScreen` cannot resume a closed deposit checkout — **[Partial / Low]**

- `SimpleBookingScreen.tsx:400–403` opens the Stripe Checkout URL with `openExternalUrl(data.depositCheckoutUrl)` when `requiresDeposit && depositCheckoutUrl` is true.
- `BookingSuccessScreen` does not capture or surface that URL. If the user closes the Stripe tab before paying, they have to navigate to `Manage → AppointmentDetail` and find the deposit-pay CTA.
- Server stores `deposit_checkout_url` on the appointment row (`appointments.deposit_checkout_url`), so the data is available — the screen just doesn't show it.

**Fix:** Pass `depositCheckoutUrl` through navigation params and render a "Pay deposit" button on `BookingSuccessScreen` if `depositStatus === "awaiting"`.

### 4.10 `SurvivalKitScreen` task list is not cross-device persisted — **[Partial / Low]**

- Wizard answers persist via `PATCH /api/homes/:homeId/profile`.
- The generated task list (`generateTasksFromWizardData` at `SurvivalKitScreen.tsx:175`) is client-side only.
- A homeowner who completes the wizard on iPhone and opens the app on iPad will see no tasks until they re-run the wizard.

**Fix:** Either (a) regenerate from server-fetched profile each time the screen mounts (fast, no schema change), or (b) persist the task list + completion state in a new `home_maintenance_tasks` table.

### 4.11 `Alert.alert` used throughout homeowner screens — **[Partial / Low]**

- The development guidelines say "Do NOT use Alert.alert or regular JavaScript alert to show confirmation prompts as these may not fully work. Implement custom modals if necessary."
- Homeowner code uses `Alert.alert` heavily for confirmations and status messages: `ProviderProfileScreen.tsx:204, 207, 315, 318, 330, 333`; `AppointmentDetailScreen.tsx:270, 285, 310, 342, 356, 372, 374`; `MoreScreen.tsx:91`.
- For pure error toasts the current usage is acceptable; for confirmations (cancel appointment, delete account) a custom modal would match the guideline.

**Fix:** Replace confirmation `Alert.alert`s in `AppointmentDetailScreen` and `MoreScreen` with the existing `AccountGateModal`-style custom modal; leave error toasts as-is.

### 4.12 `console.log` spam in production code paths — **[Partial / Low]**

- `BecomeProviderScreen.tsx:72`, `AccountSecurityScreen.tsx:75`, `MoreScreen.tsx:91` (delete error), `AddressesScreen.tsx` error handling, `SimpleBookingScreen` deposit flow.
- Not security-critical (no secrets logged, low-signal filters in place), but adds noise to native device logs.

**Fix:** Replace with a single `client/lib/log.ts` wrapper that no-ops in production builds.

### 4.13 Loading-state inconsistency — **[Partial / Low]**

- `SkeletonLoader.tsx` exists and is used in `NotificationsScreen` and `ManageScreen`.
- Most other homeowner screens (`HomeScreen`, `FindScreen`, `ProviderListScreen`, `ProviderProfileScreen`, `HouseFaxScreen`) use a centered `<ActivityIndicator>` instead.
- The mixed treatment makes the app feel inconsistent — the skeletons are noticeably nicer.

**Fix:** Standardize on `SkeletonLoader` for list/grid surfaces; keep `ActivityIndicator` for transient mutations only.

### 4.14 Empty-state inconsistency — **[Partial / Low]**

- `EmptyState.tsx` exists and is used in `ManageScreen`, `NotificationsScreen`, `FinancesScreen`.
- `FindScreen.tsx:597` uses an inline `View + Feather` combo for "No results found" instead.

**Fix:** Replace the inline empty state in `FindScreen` with `EmptyState`.

### 4.15 Accessibility labels missing on many `Pressable` components — **[Partial / Low]**

- `ProviderProfileScreen.tsx:236` uses `accessibilityLabel`; most custom `Pressable` elements in `HomeScreen` and `MoreScreen` do not.
- Tab bar buttons meet 44pt min via `flex: 1` + `tabHeight: 60`.

**Fix:** Add `accessibilityLabel` and `accessibilityRole="button"` to every interactive `Pressable` that has only an icon or non-textual content.

### 4.16 Offline behavior — **[Missing / Low]**

- The app has **no offline mode**. There is no service worker, no `react-query` `persistQueryClient` plugin, no `AsyncStorage`-backed query cache, and no offline mutation queue.
- The shared React Query client (`client/lib/query-client.ts:98–110`) explicitly sets `staleTime: 1000 * 60 * 5` (5 minutes), `refetchOnWindowFocus: false`, `refetchInterval: false`, and `retry: false` for both queries and mutations. So a fetch failure (network drop, 401, 5xx) throws once with no automatic retry — the screen sees the error immediately rather than spinning. This is intentional and correct, but it means *no* network-resilience layer is doing anything if the connection comes back.
- `@react-native-community/netinfo` is in the pre-installed Expo Go library list but is **not imported anywhere in `client/`** — confirmed by repository-wide search. There is no "you're offline" banner, no retry-on-reconnect orchestration, and no queued-mutation flush.
- The defaults do not explicitly set `refetchOnReconnect`. With `@tanstack/react-query` v5 (`package.json:35`) the library default for that option is `true`, so stale queries *will* re-fetch on reconnect — but only for queries that are currently mounted. There is no app-level "we're back online, here are the things you tried to do offline" affordance.
- For the booking + payment flow this is a real concern: `POST /api/appointments` has server-side idempotency (`routes.ts:3657–3681`) so a manual retry is safe, but a homeowner who taps "Book" while offline gets a generic Alert and no queued retry. Stripe PaymentSheet handles its own offline UX.
- HouseFax, Health Score, and Service History are read-only views that show a centered `ActivityIndicator` until the query resolves or errors; with `retry: false` an offline launch surfaces an error promptly but with no "tap to retry" affordance on most screens.

**Fix:** Treat offline as Low priority for v1 (this is a connected-services product — bookings, AI chat, and payments have no offline meaning). Minimum viable improvement: install `@react-native-community/netinfo`, wrap `<App>` with a thin offline banner, and consider relaxing `retry: false` to `retry: 1` for read-only queries in `client/lib/query-client.ts`. (`refetchOnReconnect` already defaults to `true` in react-query v5, so reconnect-driven re-fetches happen for any currently-mounted query.) Defer query persistence + mutation queueing to post-launch.

### 4.17 Performance — **[Partial / Low]**

- **Lists.** `@shopify/flash-list` is in the pre-installed library set but **not used** anywhere in `client/screens/homeowner/`. `ManageScreen`, `NotificationsScreen`, `SavedProvidersScreen`, `ProviderListScreen` all use `FlatList` (or scrolled `View` blocks) — fine at current scale (typical homeowner has ~5–20 appointments, ~5–20 notifications, < 10 saved providers), but adopting `FlashList` would be a free improvement on long-tail lists. `FindScreen` provider results use `FlatList` with no `getItemLayout` or `keyExtractor` optimization.
- **Re-renders.** `HomeScreen`, `FindScreen`, and `MoreScreen` re-render on every theme/auth/notification cache invalidation; no `React.memo` wrappers on heavy children. With current screen depth this is invisible, but it would matter once the appointment count grows.
- **Image loading.** `expo-image` is used in `ProviderProfileScreen` and `HomeScreen` (good — built-in caching + memory pressure handling). `ManageScreen` and `NotificationsScreen` use `Image` from `react-native` for provider logos, missing the `expo-image` cache benefit.
- **Bundle.** One fully orphaned screen (`SavingsSpendScreen` — typed but not registered, see §4.1) and one legacy navigator file (`ProfileStackNavigator.tsx`) ship in the JS bundle. `BudgeterScreen` is reachable to guests via `FindScreen` so it is not orphaned. Combined LOC of the actually-removable files is ~400.
- **Heavy components.** `SurvivalKitScreen` (17-step wizard) and `HealthScoreScreen` (14-step wizard) keep all step state in memory at once — fine at this size, but worth noting if either wizard grows. `HouseFaxScreen` mounts four tabs simultaneously without `React.lazy`; based on the source there is no virtualization, but the per-tab payload is small.
- **AI calls.** `POST /api/chat/simple` and `/api/intake/*` buffer the entire OpenAI streaming response server-side before returning (per the development guidelines for React Native streaming). Total latency is therefore OpenAI-bound; the client shows a spinner.
- **Cold start.** Expo Go cold start is dominated by JS bundle parse; nothing exotic in the homeowner code path that would dwarf normal Expo overhead.

**Methodology note.** This audit is a static code review only — no app instrumentation, no profiler runs, no device measurements. Performance findings above are read off the source (which library is imported, whether virtualization is used, where heavy state lives). All quantitative claims have been removed.

**Fix:** Performance is **Partial / Low** — there is no current performance bug visible in the source. Quick wins (all source-level): (a) swap `FlatList` → `FlashList` for `FindScreen` provider results, (b) swap `Image` → `expo-image` for `ManageScreen` + `NotificationsScreen` thumbnails, (c) delete the two unreachable screens (also closes §4.1). None are blockers; all should be confirmed against a real device profile before treating them as wins.

### 4.18 IDOR on `/api/homes/:homeId/service-history` and `/api/homes/:homeId/reminders` — **[Broken / Critical]**

- `GET /api/homes/:homeId/service-history` (`server/routes.ts:6254–6293`) is wrapped in `requireAuth` only. The handler reads `req.params.homeId` and immediately queries `appointments WHERE homeId = :homeId` joined with `providers`. **There is no `home.userId === req.authenticatedUserId` check.** Any authenticated homeowner (or provider, since both share the same JWT scheme) can iterate `homeId` UUIDs and read another user's complete service history — service names, descriptions, status, prices, notes, scheduled dates, and the provider business names attached to each.
- `GET /api/homes/:homeId/reminders` (`server/routes.ts:6304`) immediately follows the same pattern with the same defect — auth required, no ownership check. Maintenance reminders include scheduling cadence and free-text notes.
- The disclosure includes `appointments.notes`, which the homeowner intake flow uses to record health/safety details (gas leak, mold suspicion, security-system code, gate code, "back door is broken," etc.). This is genuinely sensitive PII.
- The same data is also exposed by the legitimate `GET /api/users/:userId/appointments` (`routes.ts:3344`), but that endpoint enforces `req.params.userId === authUserId` and returns 403 otherwise. The `/api/homes/:homeId/*` shape is the IDOR vector.
- Cross-cutting: the homeowner audit had previously claimed (in §6.1) that ownership checks were "explicit and uniform" for home-scoped endpoints. They are not. This finding contradicts that earlier paragraph; §6.1 is now corrected to flag these two endpoints.
**Impact:** Cross-tenant disclosure of homeowner service history + maintenance plans. Any logged-in account can enumerate.
**Fix:** Add the standard owner check at the top of both handlers — fetch the home by `homeId`, return 404 if missing, return 403 if `home.userId !== req.authenticatedUserId`. Pattern is already used by `/api/homes/:id/profile` (`routes.ts:2326`) and `/api/housefax/:homeId` (`:2480`); copy that block.

---

## 5. Per-screen findings (27 homeowner screens)

### 5.1 Tab screens (4)

- **`HomeScreen`** — Greeting, upcoming appointments (real `GET /api/users/:userId/appointments` at `routes.ts:3344`), category quick-search, AI assistant entry. Pull-to-refresh wired to a real fetch. **Pass / N/A.** Minor: `formatDate` (line 161) uses `new Date(dateStr)` which can fail on certain Android engines on non-ISO strings — server emits ISO so currently safe.

- **`FindScreen`** — Lat/lng-based provider search; categories grid; preset locations modal. Real `GET /api/providers` (`routes.ts:3071`). **Working / Low** — `PRESET_LOCATIONS` (`FindScreen.tsx:70`) is a hardcoded list of major US cities (SF/LA/NY/etc.) for the location picker, not user data. The empty state at `:597` should use the shared `EmptyState` component.

- **`ManageScreen`** — Collapsible Upcoming / Active / Past sections; `GET /api/users/:userId/appointments` (`routes.ts:3344`). **Pass / N/A.** This screen was the centerpiece of one explorer's "missing endpoint" claim that was disproven by direct file inspection — see §3.

- **`MoreScreen`** — Profile card, tools grid (4 tiles → SurvivalKit / HouseFax / HealthScore / ServiceHistory), account section (Edit Profile, Account Security, Addresses, Saved Providers, Notifications, Notification Preferences), settings (theme via `themeStore`), support (Help Center, Contact Us), Sign Out, Delete Account. **Pass / N/A.** Delete account confirmation calls `DELETE /api/auth/account` and is comprehensive (`routes.ts:1796–1907`).

### 5.2 Discovery + AI (4)

- **`AIChatScreen`** — General home maintenance Q&A; `POST /api/chat/simple` (`routes.ts:4862`). Lead-conversion CTA correctly parses `needsService`, `category`, `problemSummary` to prefill `SmartIntake`. `aiRateLimit` (`routes.ts:294`) protects against cost abuse. **Pass / N/A.**

- **`SmartIntakeScreen`** — 4-step wizard (Describe → Questions → Options → Match). Three real AI endpoints (`/api/intake/analyze` 5947, `/api/intake/refine` 6012, `/api/intake/match-providers` 6099), all `requireAuth + aiRateLimit`. `handleSelectProvider` (line 245) and `handleBookWithPreselectedProvider` (line 282) both correctly forward `intakeData` to `SimpleBooking`. `calculateTrustScore` (line 6147 server) is a heuristic but uses real DB fields. **Pass / N/A.**

- **`ProviderListScreen`** — `GET /api/providers?categoryId=…` with lat/lng for distance sorting. `EmptyState` shown on no results. Filters + sort. `FlatList` with `keyExtractor`. **Pass / N/A.**

- **`ProviderProfileScreen`** — About / Services / Reviews tabs. Save provider via `POST /api/saved-providers`. Custom services from `/api/provider/:id/custom-services`. Call/Text via `Linking.openURL("tel:" / "sms:")`. Review reporting wired to moderation queue (Apple Guideline 1.2 satisfied). **Working / Low** — uses `Alert.alert` for system errors and report confirmations (acceptable for system-level errors).

### 5.3 Booking + post-booking (5)

- **`SimpleBookingScreen`** — Service selection, calendar, intake questions, `POST /api/appointments` (`routes.ts:3635`). Idempotency dedup at `routes.ts:3657–3681` prevents double-tap duplicates. Stripe Checkout deposit flow with rollback on failure. `AccountGateModal` correctly intercepts guest users before final POST. **Pass / N/A.**

- **`BookingSuccessScreen`** — Summary card, "What's next" guidance. `CommonActions.reset` correctly prevents back-navigation to the intake form. **Working / Low** — does not surface the deposit checkout URL if the Stripe tab was closed (see §4.9).

- **`AppointmentDetailScreen`** — `GET /api/appointment/:id` (singular, `routes.ts:3363`) with ownership check. Cancel + reschedule via `checkRescheduleAllowed`; `maxReschedules` and time-window enforcement. **Partial / Medium** — "Message Provider" CTA (line 356) is purely cosmetic (see §4.6). Reschedule's date-string vs Date object cast in `DateUtils` can occasionally produce off-by-one display dates on edge timezones.

- **`JobDetailScreen`** — `GET /api/appointments/:id` (which includes `job` data) + `GET /api/jobs/:id`. Photo timeline (provider-uploaded). **Working / Low** — homeowners cannot request a photo if the provider doesn't upload (no messaging channel; see §4.6).

- **`PaymentScreen`** — `GET /api/invoices/:id` (`routes.ts:8798`); 5-second `refetchInterval` poll for status. Hosted-checkout fallback via `POST /api/invoices/:id/checkout` (`routes.ts:11485`). `assertInvoiceAccess` ownership check. Server pulls amounts from DB. **Working / Low** — polling could be replaced with webhook-driven cache invalidation for crisper UX.

### 5.4 Reviews + saved providers (2)

- **`ReviewScreen`** — `POST /api/appointments/:id/review` (`routes.ts:7406`). Ownership check (`appointment.userId === authUserId`); 409 on duplicate (`routes.ts:7452–7456`); provider rating recalc from full average (`:7469–7489`). **Pass / N/A.**

- **`SavedProvidersScreen`** — `GET /api/saved-providers` (`routes.ts:3208`); `useMutation` for unsave with cache invalidation; "Find a Pro" CTA on empty state. **Pass / N/A.**

### 5.5 Profile + settings + support (7)

- **`ProfileEditScreen`** — `PUT /api/user/:id` (`routes.ts:1930`) for name + phone with `authStore.updateUser` + `homeownerStore.updateProfile` sync. **Partial / Medium** — avatar upload UI-only (see §4.7).

- **`AddressesScreen`** — `GET /api/homes/:userId` + `POST /api/homes` + `DELETE /api/homes/:id`; Google Places autocomplete. **Partial / Medium** — no edit flow (see §4.8).

- **`NotificationsScreen`** — `GET /api/notifications/:userId` (`routes.ts:4550`); deep links to `AppointmentDetail`, `InvoiceDetail`, `ClientDetail`. **Pass / N/A.**

- **`NotificationPreferencesScreen`** — `GET /api/notification-preferences/:userId` (`routes.ts:4704`) + `POST /api/notification-preferences` (`:4743`). Honored by `notificationService.ts:isEmailAllowed` (line 205) and the push send path at `notificationService.ts:836` (which aborts on `prefs.pushEnabled === false`). **Pass / N/A.**

- **`HelpCenterScreen`** — Static `FAQ_SECTIONS`; intentionally hardcoded; content is realistic, not lorem. **Pass / N/A.**

- **`ContactUsScreen`** — `POST /api/support/ticket` (`routes.ts:13675`); creates `support_tickets` row + emails support. **Working / Low** — no per-route rate limit (see §4.4).

- **`AccountSecurityScreen`** — Change email, change password, delete account. Change-password re-issues JWT via `setSessionToken`. **Working / Low** — `console.log` spam at line 75.

### 5.6 Home tools (6)

- **`HouseFaxScreen`** — `GET /api/housefax/:homeId` (`routes.ts:2480`) + `GET /api/homes/:homeId/profile` (`:2326`); auto-derived asset lifecycle from `housefax_entries`; AI insights from real home age + service gaps. Multi-tab Overview / Timeline / Assets / Insights. **Pass / N/A.**

- **`HealthScoreScreen`** — 14-question wizard; `computeScoreFromAnswers` (line 61); `estimateCostIfIgnored`; `buildActionPlan`. `GET /api/housefax/:homeId` for baseline (line 380); `PUT /api/homes/:id` for score persistence (`:459`); `PATCH /api/homes/:id/profile` for answer write-back (`:348`). **Pass / N/A.**

- **`ServiceHistoryScreen`** — `GET /api/homes/:homeId/service-history` (`routes.ts:6254`) joining `appointments × providers`. Statuses real-time. Empty state CTA → `HealthScore`. **Working (client) / High (server)** — endpoint has no ownership check (see §4.18). The screen itself is correct.

- **`SurvivalKitScreen`** — 17-step wizard; pre-fills from real home profile (line 466); persists answers via `PATCH /api/homes/:homeId/profile` (`:431`). **Partial / Low** — generated task list is client-side only and not cross-device persisted (see §4.10).

- **`BudgeterScreen`** — Honest "Coming Soon" preview (`UPCOMING_FEATURES` array, line 20). **Partial (Stubbed-Mock) / Medium** — reachable from the `FindScreen` guest footer only; no authenticated entry point (see §4.1).

- **`SavingsSpendScreen`** — Honest "Coming Soon" preview (`SAVINGS_FEATURES` array, line 20). **Fail (Stubbed-Mock + Missing) / Medium** — same pattern as Budgeter (see §4.1).

### 5.7 Auth + onboarding (12)

See §2.2. All Working except `ForgotPasswordScreen` (Working / Low — backend works, but no rate limit + host-header injection latent).

---

## 6. Backend route findings

### 6.1 What's solid

- **`requireAuth`** is consistently applied to every mutating endpoint touched by homeowner flows.
- **IDOR / ownership checks** are explicit and *almost* uniform: `if (req.params.userId !== authUserId) return res.status(403)…` for user-scoped endpoints; `home.userId === authUserId` after fetch for most home-scoped endpoints; `assertInvoiceAccess` for invoice endpoints; `appointment.userId === authUserId` for appointment endpoints. **Two home-scoped GETs are unprotected** — `/api/homes/:homeId/service-history` (`routes.ts:6254`) and `/api/homes/:homeId/reminders` (`:6304`) require auth but do not verify the home belongs to the caller. See §4.18.
- **SQL injection** — Drizzle ORM throughout; raw `sql` template literals are correctly parameterized. No string concatenation found in homeowner-touched paths.
- **Cost-abuse protection** — `aiRateLimit` (`routes.ts:294`) on all OpenAI-backed endpoints; `onboardingRateLimit` on public AI helpers.
- **Webhook signature verification + idempotency** — Stripe platform + Connect + RevenueCat all verified; `stripe_webhook_events` table with `reserveEvent` pattern (`stripeWebhookRouter.ts:201–223, 317–345`) prevents duplicate processing.
- **Server-computed amounts** — `POST /api/invoices/create` calculates subtotal + platform fees + total server-side (`routes.ts:11069–11116`); payment intent amount comes from DB invoice (`:11429`); credits redemption validated server-side against user balance (`stripeConnectService.ts:720`).
- **Provider rating recalc** on every review submission (`routes.ts:7469–7489`).
- **`chargesEnabled` gate** before booking with non-onboarded providers (`routes.ts:625, 11397`).
- **Account deletion** is a full transactional cascade including the Stripe customer (`routes.ts:1796–1907`).
- **Error responses** uniform: `res.status(500).json({ error: "…" })`; no stack traces leaked.
- **Input validation** — `insertUserSchema`, `loginSchema`, `insertHomeSchema`, `appointmentSchema` etc. (Zod) used on all critical mutations.
- **PII handling** — `formatUserResponse` strips passwords; `formatHomeResponse` maps legacy field names; no Stripe customer ID or card data logged.

### 6.2 Endpoint issues (homeowner-side)

- **`POST /api/support/ticket`** (`routes.ts:13675`) — public, no per-route rate limit. Resend amplification candidate.
- **`POST /api/auth/forgot-password`** (`routes.ts:1560`) — public, no per-route rate limit. Resend amplification candidate. Also reads `x-forwarded-host` for the reset URL without an allow-list (latent header-injection — see §4.5).
- **`POST /api/auth/signup`** and **`POST /api/auth/login`** (`routes.ts:1182`, `:1402`) — no explicit per-route middleware (rely on infrastructure rate limiting). Lower priority because there is no email side-effect on these; account-existence disclosure is mitigated by uniform error messages.
- **No `/api/messages` for homeowner ↔ provider threads** — the UI advertises messaging that doesn't exist (§4.6).
- **No avatar upload endpoint** — the UI advertises an avatar that can't be set (§4.7). Server already accepts the URL field; storage destination is missing.
- **No `PUT /api/homes/:id` invocation from `AddressesScreen`** — endpoint exists, screen doesn't call it (§4.8).

### 6.3 Schema status

The `replit.md` "28 tables" figure is stale — the schema actually defines 39 tables. This is a doc-drift item already noted in the provider audit (Appendix D there); it carries over unchanged for the homeowner audit.

---

## 7. End-to-end homeowner workflows

### 7.1 New homeowner — first launch → first booking → first paid invoice → first review

1. **Splash + onboarding** — `FirstLaunch` → `AccountTypeSelection` → `HomeownerOnboarding`. ✅
2. **Sign up** — `SignUp` → `POST /api/auth/signup` → JWT in `SecureStore` + cookie. ✅
3. **Address capture** — `Onboarding` (post-auth) → `POST /api/homes` with Zillow + Places enrichment. ✅
4. **Land in `HomeScreen`** — greeting, empty appointments, category grid. ✅
5. **Find a pro** — `FindScreen` → `ProviderList` → `ProviderProfile` → "Book Now". ✅
6. **Book** — `SimpleBooking` → service + date + time + intake → `POST /api/appointments`. ✅ (idempotency check prevents double-tap dupe)
7. **Pay deposit (if required)** — Stripe Checkout opens via `openExternalUrl`. ⚠️ If user closes the tab, no resume CTA on `BookingSuccessScreen` (§4.9).
8. **`BookingSuccess`** — confirmation; `CommonActions.reset`. ✅
9. **Provider arrives, completes job** — homeowner sees status update via push (if `pushEnabled`); `JobDetail` shows photos. ✅ (no in-app channel to ask for missing photos — §4.6)
10. **Invoice posted** — push notification → `PaymentScreen` → Stripe PaymentSheet or hosted checkout → server validates amount from DB → `payments` row + webhook idempotency. ✅
11. **Leave a review** — `ReviewScreen` → `POST /api/appointments/:id/review` → 409 on duplicate → provider rating recalc. ✅

**Verdict: end-to-end workable.** Two friction points: deposit-resume gap (§4.9), and the absence of a homeowner ↔ provider message channel (§4.6).

### 7.2 Returning homeowner — manage existing bookings

1. `Manage` tab → upcoming + active + past via `GET /api/users/:userId/appointments`. ✅
2. Tap an appointment → `AppointmentDetail`. ✅
3. Cancel — confirmation `Alert.alert` → `POST /api/appointments/:id/cancel` with cancellation-fee logic. ✅
4. Reschedule — `checkRescheduleAllowed` → date picker → `POST /api/appointments/:id/reschedule` (`routes.ts:4373`). ✅
5. Message provider — **broken UX**: `Alert.alert("Coming Soon", …)` (§4.6).

### 7.3 Home health workflow — "what should I do for my home?"

1. `More → Home Health Score` → 14-question wizard → score persisted → action plan. ✅
2. `More → Survival Kit` → 17-step wizard → answers persisted → tasks generated client-side. ⚠️ tasks not cross-device (§4.10).
3. `More → HouseFax` → multi-tab dashboard with real history + AI insights. ✅
4. `More → Service History` → real timeline. ✅

**Verdict: end-to-end workable, with the SurvivalKit task-persistence gap as the only sub-feature issue.**

### 7.4 Account lifecycle

1. Edit profile (name + phone) → `PUT /api/user/:id`. ✅ (avatar upload missing — §4.7)
2. Add / delete addresses. ✅ (no edit — §4.8)
3. Change email / password — re-issues JWT. ✅
4. Notification preferences — honored by `notificationService.ts`. ✅
5. Sign out — clears `sessionToken` + `AsyncStorage` + `SecureStore` + `queryClient.clear()` + push token deletion (`authStore.ts:113–136`). ✅
6. Delete account — full transactional cascade including Stripe customer (`routes.ts:1796–1907`). ✅
7. Become a provider — `BecomeProvider` → `POST /api/provider/register`; idempotent. ✅
8. Switch roles — `RoleSwitchConfirmation` → `navigation.reset` to provider tabs. ✅

---

## 8. Mock data, hardcoded data, and dead code inventory

### 8.1 Mock data still in the production bundle (homeowner side)

| File | Constant | Type | Fix |
|---|---|---|---|
| `client/screens/homeowner/BudgeterScreen.tsx` | `UPCOMING_FEATURES` (line 20) | Honest "Coming Soon" preview content | Reachable today via the `FindScreen` guest footer; consider also surfacing on `MoreScreen` for authed users. |
| `client/screens/homeowner/SavingsSpendScreen.tsx` | `SAVINGS_FEATURES` (line 20) | Honest "Coming Soon" preview content | Same as above. |
| `client/screens/homeowner/FindScreen.tsx` | `PRESET_LOCATIONS` (line 70) | Hardcoded list of major US cities for the location picker | Acceptable — this is a UI helper, not user data. Could later be replaced by current-location detection. |
| `client/screens/homeowner/HelpCenterScreen.tsx` | `FAQ_SECTIONS` | Hardcoded FAQ content | Acceptable at this scale — content is realistic, not lorem. |

The April baseline's `MOCK_SERVICE_ENTRIES`, `MOCK_PAST_PROVIDERS`, `MOCK_TASKS`, `MOCK_TIPS`, `BUDGET_CATEGORIES`, `RECENT_TRANSACTIONS`, `MOCK_CATEGORIES`, `MOCK_SAVINGS_WINS` arrays are **all gone** — verified by repository-wide search.

### 8.2 Dead screens to delete or wire

- `client/screens/homeowner/BudgeterScreen.tsx` — reachable as guest only (via `FindScreen` footer); also surface from `MoreScreen` for authed users, or document as a guest-funnel-only teaser.
- `client/screens/homeowner/SavingsSpendScreen.tsx` — typed but not registered. Wire up properly, or delete file + the `SavingsSpend: undefined` line in `RootStackParamList`.

### 8.3 Stale documentation

- `replit.md` says "28 tables"; schema has 39 (carryover from provider audit Appendix D).
- `replit.md` does not mention the May 2026 wiring of `HouseFax`, `HealthScore`, `ServiceHistory`, `SurvivalKit` to real data — should be reflected in the System Architecture section.

---

## 9. Comparison table — April 14 vs May 2

| Area | April 14 | May 2026 | Delta |
|---|---|---|---|
| `HouseFaxScreen` data | Demo data only | Real `GET /api/housefax/:homeId` | ✅ Resolved |
| `HealthScoreScreen` persistence | N/A | `PUT /api/homes/:id` + write-back | ✅ Resolved |
| `ServiceHistoryScreen` data | `MOCK_SERVICE_ENTRIES` | Real `GET /api/homes/:homeId/service-history` | ✅ Resolved |
| `SurvivalKitScreen` data | `MOCK_TASKS` / `MOCK_TIPS` | Wizard answers persisted; tasks client-generated | ✅ Mostly resolved |
| `BudgeterScreen` data | Hardcoded categories + transactions | Honest "Coming Soon" | ✅ Trust restored, ⚠️ guest-only entry; no authed entry |
| `SavingsSpendScreen` data | Hardcoded categories + wins | Honest "Coming Soon" | ✅ Trust restored, ⚠️ typed but not registered |
| `ManageScreen` appointments | Reportedly missing endpoint | Endpoint exists at `routes.ts:3344` (was a verification gap) | ✅ Confirmed working |
| Account deletion cascade | Partial (orphaned Stripe + push tokens) | Full transactional cascade | ✅ Resolved |
| Stripe Connect deposit handling | Stubbed | Real Checkout URL with rollback | ✅ Resolved |
| Webhook idempotency | N/A | `stripe_webhook_events` reservation pattern | ✅ Resolved |
| Notification preferences honored by sender | Stored, not honored | Honored by `notificationService.ts:isEmailAllowed` (line 205) + push send-path check at `notificationService.ts:836` | ✅ Resolved |
| Push notification deep linking | Partial | `handleNotificationNavigation` covers `AppointmentDetail`, `InvoiceDetail`, `SimpleBooking`, `Notifications`, `Review` | ✅ Resolved |
| Homeowner ↔ Provider messaging | UI-only | UI-only ("Coming Soon" alert) | ❌ Unchanged |
| Avatar upload | UI-only | UI-only (server accepts the field) | ❌ Unchanged |
| Address edit | Add/delete only | Add/delete only | ❌ Unchanged |
| Global 401 interceptor | Not present | Not present | ❌ Unchanged |
| Analytics / crash SDK | Not present | Not present | ❌ Unchanged |
| Per-route rate limit on support + forgot-password | Not present | Not present | ❌ Unchanged |
| Empty / loading state consistency | Mixed | Mixed | ❌ Unchanged |

**Net delta: 12 resolved, 0 regressed, 7 carryovers.** All carryovers are Medium or lower.

---

## 10. Prioritized fixes

The recommendations below are split into two explicit lists per the audit brief: **Top issues to fix next** (must-fix or high-trust-impact) and **Nice-to-have polish** (low severity, can ship after launch).

### 10.1 Top issues to fix next (P0 – P7)

These items either block paid rollout (P0) or visibly damage trust if a paying homeowner encounters them. All carry Critical or Medium severity.

| # | Fix | Severity | Est. effort | Impact |
|---|---|---|---|---|
| **P0** | **Add ownership checks to `/api/homes/:homeId/service-history` and `/api/homes/:homeId/reminders`** (`routes.ts:6254`, `:6304`). Fetch the home, return 404 if missing and 403 if `home.userId !== req.authenticatedUserId`. Use the same block already used by `/api/housefax/:homeId` (`:2480`) and `/api/homes/:id/profile` (`:2326`). | **Critical** | 15 min | Closes the only known IDOR in the homeowner API surface; eliminates cross-tenant disclosure of service history + maintenance reminders + sensitive intake notes. |
| P1 | **Clean up `BudgeterScreen` and `SavingsSpendScreen` (different fixes for each).** For `Budgeter`: also surface as a disabled "Coming Soon" tile on `MoreScreen` so authed homeowners (not only guests) can find it; today the only entry point is the gated `FindScreen` footer (`FindScreen.tsx:977`). For `SavingsSpend`: either import + register the screen and surface it from `MoreScreen` (and consider adding it to `HOME_TOOLS`), OR delete the `SavingsSpend: undefined` line from `RootStackParamList` (`:96`) along with `SavingsSpendScreen.tsx`. | Medium | 30 min | Closes the authed-vs-guest reachability gap on Budgeter and removes a latent runtime crash on `SavingsSpend`. |
| P2 | **Implement homeowner ↔ provider messaging or remove the CTA.** Either build `POST /api/appointments/:id/messages` + `GET /api/appointments/:id/messages` backed by a new `appointment_messages` table, or remove the "Message Provider" button from `AppointmentDetailScreen.tsx:356`. | Medium | 6 hrs (build) / 5 min (hide) | Removes "Coming Soon" pop-up from the detail flow. |
| P3 | **Wire avatar upload.** Add `expo-image-picker` button on `<Avatar>` in `ProfileEditScreen`; new `POST /api/user/:id/avatar` endpoint that writes to Supabase Storage and returns the URL; client sets `avatarUrl` on next `PUT /api/user/:id` (server already accepts the field at `routes.ts:1944`). | Medium | 2 hrs | Avatar UI becomes functional. |
| P4 | **Add edit-address flow.** New "Edit" affordance per home in `AddressesScreen` that opens an autocomplete + nickname form bound to `PUT /api/homes/:id` (`routes.ts:2080`). Avoids cascading delete of `housefax_entries` + `appointments` history when correcting a typo. | Medium | 2 hrs | Address corrections become non-destructive. |
| P5 | **Add per-route rate limiting + host allow-list to `/api/auth/forgot-password` + `/api/support/ticket`.** Same `aiRateLimit` pattern (`routes.ts:294`). For forgot-password, validate `x-forwarded-host` against `process.env.PUBLIC_HOST` allow-list (close §4.5). | Medium | 1 hr | Closes Resend amplification + reset-link header-injection. |
| P6 | **Add a global 401 / session-expiry interceptor.** Wrap `apiRequest` in `query-client.ts` so a 401 dispatches a global event; `App.tsx` listens once and routes to `Welcome` / `Login` after `authStore.logout()`. | Medium | 2 hrs | Expired JWTs no longer break individual screens silently. |
| P7 | **Add Sentry + a lightweight analytics SDK.** Install `@sentry/react-native` (Expo Go-compatible) and wire to `ErrorBoundary.tsx`. Add PostHog for funnel events (signup → first booking → first paid). | Medium | 3 hrs | Production crashes + funnel become observable. |

**Subtotal: ~10–12 hours.** Only P0 blocks paid rollout; P1–P7 are visible-trust improvements that should ship before charging real homeowners.

### 10.2 Nice-to-have polish (P8 – P12)

These items are Low severity. They improve perceived quality and operational hygiene but do not block launch and do not affect functional correctness.

| # | Fix | Severity | Est. effort | Impact |
|---|---|---|---|---|
| P8 | **Pass `depositCheckoutUrl` to `BookingSuccessScreen`** + render a "Pay deposit" button when `depositStatus === "awaiting"`. Server already stores `appointments.deposit_checkout_url`. | Low | 30 min | Closes the deposit-resume gap (§4.9). |
| P9 | **Persist `SurvivalKit` task list cross-device** — easiest path is to regenerate from server-fetched profile each mount (no schema change). | Low | 1 hr | Wizard results follow the user across devices. |
| P10 | **Standardize loading + empty states.** Use `SkeletonLoader` for list/grid surfaces (replace center `ActivityIndicator` in `HomeScreen`, `FindScreen`, `ProviderListScreen`, `ProviderProfileScreen`, `HouseFaxScreen`); replace inline empty state in `FindScreen.tsx:597` with shared `EmptyState`. Also replace confirmation `Alert.alert`s with custom modals per the development guidelines. | Low | 3 hrs | Polishes the perceived quality of the app. |
| P11 | **Performance quick wins (§4.17).** Swap `FlatList` → `FlashList` for `FindScreen` provider results; swap `Image` → `expo-image` for `ManageScreen` + `NotificationsScreen` thumbnails; delete `SavingsSpendScreen.tsx` (the only fully orphaned screen — overlaps with P1). | Low | 1 hr | Free perf gains; no behavior change. |
| P12 | **Minimum-viable offline UX (§4.16).** Install `@react-native-community/netinfo`, render a thin "You're offline" banner; optionally relax `retry: false` → `retry: 1` for read-only queries in `client/lib/query-client.ts` (reconnect re-fetch already works via the v5 default). | Low | 1 hr | Users on flaky networks stop staring at silent spinners. |

**Subtotal: ~6–7 hours.**

**Total effort for P0–P12: ~2 days.** Only P0 blocks paid rollout; the rest splits cleanly into 10–12 hrs of pre-launch trust fixes (P1–P7) and 6–7 hrs of post-launch polish (P8–P12).

---

## 11. What is safe to demo today

For a soft-launch demo without code changes, the following user flows are presentable end-to-end:

- **First-launch → signup → address capture → land in Home tab.** All real, all persisted, no mocks.
- **Find a pro by category and location.** Real provider catalog with lat/lng distance sorting.
- **AI chat for general home questions.** Real OpenAI-backed responses with rate limiting.
- **Smart Intake wizard.** Real AI-driven scoping → quote → provider matching, end-to-end.
- **Book an appointment.** Real `POST /api/appointments` with idempotency. Stripe Checkout deposit if required.
- **View / cancel / reschedule appointments** in `Manage`. Real data, real ownership checks, real cancellation-fee logic.
- **Pay an invoice** via Stripe PaymentSheet or hosted checkout. Server-validated amounts, webhook-confirmed status, full idempotency.
- **Leave a review** with provider-rating recalc.
- **HouseFax dashboard** with real home data + AI insights.
- **Health Score wizard** with real persistence + write-back of home attributes.
- **Service History** as a real appointment timeline. *(Note: the API behind it is exploitable — see §4.18. Safe for a controlled demo, not for paid users until P0 ships.)*
- **Survival Kit wizard** with real wizard-answer persistence (caveat: regenerate the task list on each open).
- **Edit profile (name + phone)**.
- **Manage notification preferences** — honored by the sender.
- **Add / delete addresses** with Google Places autocomplete.
- **Saved Providers** list.
- **Notifications** with deep linking.
- **Help Center** + **Contact Us**.
- **Account deletion** (verify in a non-prod Stripe environment).

---

## 12. What must be hidden, fixed, or disclaimed before paid rollout

The following items should be addressed before charging real homeowners. **Item 0 is the only true blocker; the rest are trust + polish.**

0. **Fix the IDOR on `/api/homes/:homeId/service-history` and `/api/homes/:homeId/reminders`.** This is a 5-line server-side change. Until it ships, any logged-in user can read any other homeowner's service history + maintenance reminders by guessing `homeId` UUIDs. (P0)
1. **Hide the "Message Provider" button** on `AppointmentDetailScreen` (or implement it). Showing "Coming Soon" on a paid product is a trust hit. (P2)
2. **Hide or implement avatar upload.** Currently the UI suggests it should work. (P3)
3. **Add edit-address.** A user with a typo in their address loses appointment + service history if they delete. (P4)
4. **Close the Budgeter authed-entry gap and decide on `SavingsSpend`.** Budgeter is reachable as guest only; `SavingsSpend` is fully orphaned. (P1)
5. **Rate-limit `/api/auth/forgot-password` + `/api/support/ticket`.** Both can be used as Resend amplification today. (P5)
6. **Add the `x-forwarded-host` allow-list** to the password-reset URL builder. (P5)
7. **Add Sentry.** Production crashes are currently invisible. (P7)
8. **Add a 401 interceptor.** Expired sessions break each screen separately today. (P6)

The remainder (deposit resume, SurvivalKit task persistence, loading/empty consistency, accessibility labels, console-log spam) are polish items that can ship after launch.

---

## Appendix A — Orphaned / unreachable homeowner files

```
client/screens/homeowner/BudgeterScreen.tsx       (imported + registered at RootStackNavigator.tsx:27, :351; reached from FindScreen.tsx guest footer ONLY — no authed entry from MoreScreen)
client/screens/homeowner/SavingsSpendScreen.tsx   (NOT imported, NOT registered; only typed at RootStackNavigator.tsx:96; zero call sites; runtime crash if navigated to)
```

(Also reused from the provider audit: `client/screens/ProfileStackNavigator.tsx` — appears to be a legacy leftover; `MoreScreen` handles all profile entry directly.)

## Appendix B — Homeowner tab navigator

```
HomeownerTabNavigator
├── HomeTab     → HomeScreen
├── FindTab     → FindScreen
├── ManageTab   → ManageScreen
└── MoreTab     → MoreScreen
```

The `MoreScreen` is the canonical entry point for all homeowner secondary surfaces:

```
MoreScreen
├── Tools
│   ├── Survival Kit         → SurvivalKitScreen
│   ├── HouseFax             → HouseFaxScreen
│   ├── Home Health Score    → HealthScoreScreen
│   └── Service History      → ServiceHistoryScreen
├── Account
│   ├── Edit Profile         → ProfileEditScreen
│   ├── Account Security     → AccountSecurityScreen
│   ├── Addresses            → AddressesScreen
│   ├── Saved Providers      → SavedProvidersScreen
│   ├── Notifications        → NotificationsScreen
│   └── Notification Prefs   → NotificationPreferencesScreen
├── Settings
│   └── (theme via themeStore — local only)
├── Support
│   ├── Help Center          → HelpCenterScreen
│   └── Contact Us           → ContactUsScreen
└── Sign Out / Delete Account
```

`Budgeter` and `SavingsSpend` belong here as new tiles in the Tools group (or should be removed entirely — see P1).

## Appendix C — Homeowner data persistence map

| Surface | Read | Write | Persistence guarantee |
|---|---|---|---|
| User profile | `GET /api/user/:id` (1909) | `PUT /api/user/:id` (1930) | DB row in `users`; `authStore` synced. |
| Homes | `GET /api/homes/:userId` (1958) | `POST /api/homes` (1976), `PUT /api/homes/:id` (2080), `DELETE /api/homes/:id` (2111) | DB row in `homes`; cascades `housefax_entries` + `appointments` on delete. |
| HouseFax | `GET /api/housefax/:homeId` (2480) | (auto-derived from `housefax_entries`, `invoices`, `appointments`) | Read-only aggregate; no client-side persistence. |
| Health Score | wizard local | `PUT /api/homes/:id` (`healthScore`, `lastHealthScoreAt`); `PATCH /api/homes/:id/profile` (write-back) | Score persisted on `homes`; answers update `homes.profile`. |
| Survival Kit | wizard local | `PATCH /api/homes/:homeId/profile` | Answers persisted on `homes.profile`. Generated tasks **not persisted** (regenerated client-side). |
| Service History | `GET /api/homes/:homeId/service-history` (6254) | (read-only join) | Real-time from `appointments × providers`. **Endpoint missing ownership check (§4.18).** |
| Appointments | `GET /api/users/:userId/appointments` (3344), `GET /api/appointment/:id` (singular, 3363) | `POST /api/appointments` (3635), reschedule/cancel via `/api/appointments/:id/*` | DB row in `appointments`; idempotency dedup at `:3657`. |
| Reviews | (provider profile aggregates) | `POST /api/appointments/:id/review` (7406) | DB row in `reviews`; recalc rating on `providers`. |
| Saved providers | `GET /api/saved-providers` (3208) | `POST /api/saved-providers` (3251), `DELETE /api/saved-providers/:id` (3271) | DB row in `saved_providers`. |
| Invoices / payments | `GET /api/invoices/:id` (8798) | `POST /api/invoices/:id/checkout` (11485), `POST /api/invoices/:invoiceId/payment-intent` (11158), `POST /api/invoices/:invoiceId/apply-credits` (11536) | DB rows in `invoices`, `payments`, `credit_ledger`; webhook-idempotent via `stripe_webhook_events`. |
| Payment methods | `GET /api/homeowner/payment-methods` (11251) | `POST /api/homeowner/setup-payment-sheet` (11196), `DELETE /api/homeowner/payment-methods/:pmId` (11300), `PATCH /api/homeowner/default-payment-method` (11333) | Stripe-side via attached customer. |
| Notifications | `GET /api/notifications/:userId` (4550) | `POST /api/notifications/:id/read` (4568) | DB row in `notifications`. |
| Notification preferences | `GET /api/notification-preferences/:userId` (4704) | `POST /api/notification-preferences` (4743) | DB row in `notification_preferences`; honored by `notificationService.ts`. |
| Push tokens | (read-only via push delivery) | `POST /api/push-tokens`, `DELETE /api/push-tokens/:token` | DB row in `push_tokens`; deleted on logout. |
| Support tickets | (read-only for support) | `POST /api/support/ticket` (13675) | DB row in `support_tickets`; emails support via Resend. |

## Appendix D — Tests recommended (none ship today)

The repo has no automated tests for any homeowner flow. Recommended minimum (out of scope for this audit; flagged for a future task):

1. Auth: signup → me → logout → me-401.
2. Homes: create → list → get profile → update → delete.
3. Booking: create appointment with idempotency key → duplicate request returns same row.
4. Payment: create invoice → payment intent → apply credits → mock webhook → invoice paid.
5. Review: post → 409 on duplicate → provider rating recalc.
6. Account deletion: create user with all child rows → delete → assert nothing remains.

---

*End of report.*
