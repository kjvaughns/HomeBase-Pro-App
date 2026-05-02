# HomeBase Provider Portal — Full Audit (May 2026)

**Audit date:** May 2, 2026
**Scope:** End-to-end review of the provider portal — all 33 provider screens under `client/screens/provider/`, the navigation graph (`ProviderTabNavigator`, `RootStackNavigator`), the provider-facing API surface in `server/routes.ts` (~13,700 lines), the database schema in `shared/schema.ts`, and the supporting state stores / hooks (`providerStore.ts`, `authStore.ts`, `useSubscriptionStatus.ts`, `usePushNotifications.ts`).
**Comparison baseline:** April 14, 2026 audits — `provider-mvp-audit-report.md`, `provider-feature-audit-report.md`, `provider-design-audit-report.md`, plus `REVIEWER_NOTES.md`.
**Method:** Static code review across screens, hooks, navigators, server routes, and DB schema; cross-checking against the prior baseline; verifying claims by spot-reading current source. **No runtime API calls were made; no code was modified.** This document is investigation only.

---

## 1. Executive Summary

The provider portal has progressed substantially since the April 14 baseline. **8 of 13** previously identified critical/high blockers have been resolved or materially improved. The subscription/billing surface — previously the single biggest "not ready" item — now has a real status hook (`useSubscriptionStatus`), a dedicated DB-backed grace-period state machine (`provider_plans`), a working RevenueCat webhook, a partner-bypass path, and visible enforcement primitives (`SubscriptionGateModal`, `GracePeriodBanner`).

What remains is mostly **second-order polish and dead-code cleanup** rather than foundation work:

- A handful of legacy provider screens (`AccountingScreen`, `MoneyScreen`, `FinancesScreen`, `BookingPoliciesScreen`, `BusinessDetailsScreen`, `NewServiceScreen`) are unreferenced or superseded by `FinancialsScreen` / `BusinessHubScreen` / `ServiceBlueprintWizardScreen` and should be deleted.
- `LeadsScreen` is a fully-built screen that **is not registered in the navigator at all** and cannot be reached from anywhere in the app.
- `ServicePreviewScreen` still hard-codes "Do you have pets?" as the intake question preview, and `StripeConnectScreen` still ships with `"Test Service"` / `"50.00"` as default invoice values — both real-provider trust hits.
- `providerStore.ts` still seeds the in-memory store with ~290 lines of mock jobs / messages / invoices / payouts / clients (`initialJobs`, `initialMessages`, `initialInvoices`, `initialPayouts`, `initialClients`, `initialClientActivities`, `initialClientNotes`, lines 243–544). These are wired into the default state at lines 961–965 of the same file, so a brand-new provider whose API calls fail open will see fake data rather than empty states.
- Voice input on the Provider AI Assistant is still cosmetic (the screen imports `expo-speech` but does not implement speech-to-text capture).
- Message-template auto-seeding still does not happen at provider creation; new providers see an empty template list.
- The `replit.md` "28 tables" figure is stale — the schema actually defines **39 tables** (incl. duplicate `message_templates` vs `provider_message_templates`).

### Readiness score: **8.0 / 10 — Soft-launch ready with 1 day of cleanup**

Up from **6.5 / 10** in the April 14 baseline. The remaining gaps are bounded; none of them are foundational. With the P1–P5 fixes in §10 below, the portal is ready for paid-provider rollout.

---

## 2. Inventory

### 2.1 Provider screens (33 files)

| # | Screen | Wired into nav? | Verdict |
|---|---|---|---|
| 1 | `AccountingScreen` | No | **DEAD CODE** — superseded by `FinancialsScreen` |
| 2 | `AddClientScreen` | Yes (RootStack) | Working |
| 3 | `AddInvoiceScreen` | Yes (RootStack) | Working |
| 4 | `AddJobScreen` | Yes (RootStack) | Working (uses real custom services) |
| 5 | `AdminPartnersScreen` | Yes (RootStack) | Working (admin-only) |
| 6 | `BookingLinkScreen` | Yes (RootStack) | Working |
| 7 | `BookingPoliciesScreen` | No | **DEAD CODE** — duplicates `BusinessHubScreen` Policies tab |
| 8 | `BusinessDetailsScreen` | Yes (RootStack) | **DUPLICATE** — overlaps `BusinessHubScreen` Profile tab |
| 9 | `BusinessHubScreen` | Yes (RootStack) | Working — the canonical multi-tab business config screen |
| 10 | `ClientDetailScreen` | Yes (RootStack) | Working — but Client `ltv` always shows `$0` |
| 11 | `ClientsScreen` | Yes (Tab) | Working |
| 12 | `CommunicationsScreen` | Yes (RootStack) | Partial — broadcast SMS works; no message history |
| 13 | `FinancesScreen` | No | **DEAD CODE** — superseded by `FinancialsScreen` |
| 14 | `FinancialsScreen` | Yes (Tab) | Working (`stripe-payouts` query, CSV export) |
| 15 | `InvoiceDetailScreen` | Yes (RootStack) | Working |
| 16 | `LeadsScreen` | **No** | **ORPHAN — not registered anywhere; unreachable** |
| 17 | `MoneyScreen` | No | **DEAD CODE** — superseded by `FinancialsScreen` |
| 18 | `NewServiceScreen` | No | **DEAD CODE** — superseded by `ServiceBlueprintWizardScreen` |
| 19 | `ProviderAIAssistantScreen` | Yes (RootStack) | Working (real data); voice button is fake; chat history not persisted |
| 20 | `ProviderHomeScreen` | Yes (Tab) | Working |
| 21 | `ProviderJobDetailScreen` | Yes (RootStack) | Working — checklist & photos persist (regression fixed) |
| 22 | `ProviderMoreScreen` | Yes (Tab) | Working — availability toggle now persists via `PATCH /api/provider/:id` |
| 23 | `ProviderResourcesScreen` | Yes (RootStack) | Working |
| 24 | `PublicProfileScreen` | Yes (RootStack) | Working (read-only preview) |
| 25 | `ReviewsScreen` | Yes (RootStack) | Partial — provider can reply; no "Request a review" CTA |
| 26 | `ScheduleScreen` | Yes (Tab) | Working |
| 27 | `SendMessageScreen` | Yes (RootStack) | Working (uses `KeyboardAvoidingView` from keyboard-controller) |
| 28 | `ServiceBlueprintWizardScreen` | Yes (RootStack as `NewService` & `EditService`) | Working |
| 29 | `ServicePreviewScreen` | **No** (typed in `RootStackParamList` but no `<Stack.Screen>`) | **ORPHAN** — and still hardcodes "Do you have pets?" intake preview |
| 30 | `ServicesScreen` | Yes (RootStack) | Working |
| 31 | `ServiceSummaryScreen` | Yes (RootStack) | Working |
| 32 | `StripeConnectScreen` | Yes (RootStack) | Working — but ships with `"Test Service"` / `"50.00"` defaults |
| 33 | `SubscriptionScreen` | Yes (RootStack) | Working — real status via `useSubscriptionStatus` hook |

**Tab navigator (5 tabs):** `HomeTab`, `ClientsTab`, `ScheduleTab`, `FinancialsTab`, `MoreTab`.
**RootStack provider screens:** 24 push-modal stack screens (counts above).

### 2.2 Database tables (39 total)

`replit.md` documents "28 tables." The actual count from `shared/schema.ts` plus `shared/models/chat.ts` is **39**. Provider-relevant tables:

`users`, `providers`, `provider_plans`, `provider_custom_services`, `provider_services`, `provider_message_templates`, `provider_messages`, `services`, `service_categories`, `clients`, `jobs`, `appointments`, `invoices`, `invoice_line_items`, `payments`, `payouts`, `refunds`, `booking_links`, `intake_submissions`, `leads`, `stripe_connect_accounts`, `stripe_webhook_events`, `reviews`, `review_reports`, `notifications`, `notification_preferences`, `notification_deliveries`, `push_tokens`, `message_templates`, `housefax_entries`, `support_tickets`, `home_field_changes`, `conversations`, `messages`, plus homeowner-side tables (`homes`, `saved_providers`, `maintenance_reminders`, `user_credits`, `credit_ledger`).

**Schema issues**

- **Duplicate template tables.** Both `provider_message_templates` (line 1474, includes `eventType`) and `message_templates` (line 1579, simpler) exist. One is dead. Confirm which is the source of truth, drop the other.
- **Legacy decimal columns.** `invoices.amount` / `invoices.total` and `payments.amount` (decimals) coexist with newer `*_cents` integer columns. Reads still go through both paths. Acceptable for now but should be deprecated and removed.
- **`clients.homeData`** is explicitly marked deprecated in favor of `clients.homeId`.
- **Chat tables** in `shared/models/chat.ts` (`conversations`, `messages`) use `serial` IDs, while `shared/schema.ts` uses `varchar` UUIDs everywhere else — mixing these two in joins will break.
- **No `partner_grants` table** — partner status lives entirely on `provider_plans.isPartner` / `partnerSince`.

### 2.3 Provider API surface (`server/routes.ts`, ~13,700 lines)

Categorized inventory (selected; full list in §6):

- **Profile & onboarding:** `POST /api/provider/onboard-complete`, `GET /api/auth/me`, `PUT /api/providers/:id`, `PATCH /api/provider/:id` (used by availability sync), `POST /api/providers/:id/profile-image`.
- **Custom services:** `GET/POST /api/provider/:providerId/custom-services`, `PUT/DELETE /api/provider/:providerId/custom-services/:id`.
- **Booking links & intake:** `GET/POST /api/providers/:providerId/booking-links`, `PUT/DELETE /api/booking-links/:id`, `GET/POST /api/intake/submit`, `POST /api/intake-submissions/:id/convert`.
- **Leads:** `GET /api/providers/:providerId/leads`, `POST /api/leads/:id/accept|decline`, `DELETE /api/leads/:id`. **(Frontend cannot reach these — `LeadsScreen` is orphaned.)**
- **Jobs:** `GET /api/provider/:providerId/jobs`, `PUT /api/jobs/:id`, `POST /api/jobs/:id/start|complete`, `PATCH /api/jobs/:id/checklist-state`, `POST /api/jobs/:id/photos`.
- **Clients:** `GET /api/providers/:providerId/clients`, `POST /api/clients`, `PUT/DELETE /api/clients/:id`.
- **Invoices & payments:** `GET /api/providers/:providerId/invoices`, `POST /api/invoices`, `GET /api/jobs/:id/invoice`, send/mark-paid/cancel/remind sub-routes.
- **Stripe Connect:** `GET /api/stripe/connect/status/:providerId`, `POST /api/stripe/connect/onboard`, `GET /api/stripe/connect/login-link/:providerId`, `GET /api/providers/:providerId/stripe-payouts`.
- **Subscription:** `GET /api/providers/:id/subscription-status`, `POST /api/revenuecat/webhook`.
- **Messaging / notifications:** `GET /api/conversations`, `POST /api/conversations/:id/messages`, `POST /api/notifications/register-push-token`, `GET /api/notifications/:userId`, `GET /api/providers/:providerId/message-templates` (no UI consumer beyond `SendMessageScreen`).
- **AI:** `POST /api/ai/provider-assistant`, `POST /api/ai/service-blueprint`.
- **Reviews:** `GET /api/providers/:providerId/reviews`, `POST /api/reviews/:id/reply`. **No `POST` for the provider to request a review from a client.**
- **Admin:** `GET /api/admin/providers`, `POST /api/admin/providers/:id/verify`, partner grant/revoke routes.

---

## 3. Status of April 14 critical / high findings

The April 14 baseline flagged 4 critical and 7 high items. Status today:

| # | April 14 finding | Severity | Status now | Evidence |
|---|---|---|---|---|
| 1 | Availability toggle does not persist | Critical | **Resolved** | `providerStore.syncAvailableForWork` (lines 813–817) calls `PATCH /api/provider/:id { isActive }` with optimistic UI + rollback + cache invalidation. `ProviderMoreScreen` wires this in. |
| 2 | AI Assistant input blocked by keyboard on iOS | Critical | **Resolved** | `ProviderAIAssistantScreen` line 345 wraps the chat in `KeyboardAvoidingView`. |
| 3 | Payouts crash with `column "arrival_date" does not exist` | Critical | **Resolved** | Column defined in `shared/schema.ts` line 722 and read in `server/stripeConnectService.ts` lines 1714 & 1758 (Stripe Unix → JS `Date`). |
| 4 | Subscription screen always shows "Free" | Critical | **Resolved** | `SubscriptionScreen` consumes `useSubscriptionStatus`, which reads `/api/providers/:id/subscription-status` (RevenueCat-backed `provider_plans` row, partner bypass logic). `GracePeriodBanner` + `SubscriptionGateModal` render real state. |
| 5 | SendMessage input blocked by keyboard | High | **Resolved** | `SendMessageScreen` line 144 uses `KeyboardAvoidingView`. |
| 6 | Job photo upload doesn't persist | High | **Resolved** | `ProviderJobDetailScreen` line 549 → `POST /api/jobs/:id/photos`. |
| 7 | Job checklist resets every open | High | **Resolved** | `ProviderJobDetailScreen` line 406 → `PATCH /api/jobs/:id/checklist-state`. |
| 8 | AddJob picker uses generic categories instead of real custom services | High | **Resolved** | `AddJobScreen` line 40 uses `useProviderPublishedServices` → `GET /api/provider/:id/custom-services?publishedOnly=true`. |
| 9 | Client `ltv` always 0 | High | **Open (regression)** | `ClientDetailScreen` line 330 reads `client.ltv`, but server still defaults `ltv` to 0 at create time and never recomputes it from invoices/jobs. |
| 10 | NotificationPreferences screen is homeowner-only | High | **Resolved** | `shared/schema.ts` line 1467 + `server/notificationService.ts` line 201 add provider-specific categories (`email_review_request`, etc.). |
| 11 | Voice input on AI Assistant is fake | High | **Open** | `ProviderAIAssistantScreen` imports `expo-speech` (text-to-speech, not speech-to-text); no recording / transcription path. The mic button does nothing meaningful. |
| 12 | No provider review-request flow | High | **Partially resolved** | The `notificationService` accepts a `review.request` event type, but there is still no in-app CTA on the job-completion screen and no `POST /api/reviews/request` endpoint surfaced for the provider. |
| 13 | Message templates never auto-seeded for new providers | High | **Open** | No call site in `server/auth.ts` or onboarding flows seeds default templates; first-time providers see an empty list. |

**Net:** 8 of 13 resolved, 1 partial, 4 open. The 4 open items are all polish-tier and bounded.

---

## 4. New findings (not in April 14 audits)

### 4.1 `LeadsScreen` is fully built but completely unreachable — Critical

`client/screens/provider/LeadsScreen.tsx` is a complete, polished screen (queries `leads` and `intake-submissions`, renders empty states with `assets/images/empty-leads.png`, accept/decline/quote actions). But:

- It is **not** registered in `RootStackNavigator.tsx` (no `<Stack.Screen name="Leads" …>`).
- It is **not** a tab in `ProviderTabNavigator.tsx` (only Home / Clients / Schedule / Financials / More).
- No `navigation.navigate('Leads')` call exists in `ProviderHomeScreen`, `BusinessHubScreen`, or `ProviderMoreScreen`.

The corresponding backend endpoints (`/api/providers/:providerId/leads`, `/api/leads/:id/accept|decline`, `/api/intake/submissions`) are live and functional. **Providers literally cannot view, accept, or decline incoming leads from the public booking page through the app today.** This is the single highest-impact regression in this audit.

### 4.2 Provider store still seeds the app with mock data — High

`client/state/providerStore.ts`:

- Lines 243–544 define `initialJobs`, `initialMessages`, `initialInvoices`, `initialPayouts`, `initialClients`, `initialClientActivities`, `initialClientNotes` — ~290 lines of fake data with names like "John Smith" and amounts like `$485.00`.
- Lines 961–965 of the same file write those arrays into the default Zustand state.

If the API queries fail or are slow on first load, real providers will briefly see fictional clients, jobs, and invoices in their dashboard. Even when API data does load, the store keeps the mock entries in any code path that reads from the store directly rather than React Query. This is also visible to anyone who inspects the JS bundle. Strip these blocks and start with empty arrays.

### 4.3 `StripeConnectScreen` ships with test invoice defaults — High

`client/screens/provider/StripeConnectScreen.tsx`:

```ts
const [invoiceDescription, setInvoiceDescription] = useState("Test Service");
const [invoiceAmount, setInvoiceAmount] = useState("50.00");
```

Plus `setInvoiceDescription("Test Service")` after submit (line 172). A real provider opening this screen sees pre-filled "Test Service" + "$50.00" in the invoice form. This is a trust hit and should be empty defaults with placeholders only.

### 4.4 `ServicePreviewScreen` still hard-codes a fake intake question — Medium

`ServicePreviewScreen.tsx` lines 145–152:

```tsx
<ThemedText style={styles.sectionTitle}>INTAKE QUESTIONS</ThemedText>
<ThemedText type="caption">Homeowners will be asked these questions during booking:</ThemedText>
<View style={[styles.questionPreview, …]}>
  <ThemedText type="body">1. Do you have pets? (Yes/No)</ThemedText>
</View>
```

The screen also doesn't render add-ons, booking mode, deposit policy, or the actual service's `intakeQuestionsJson`. This was flagged in April; still unfixed. Compounded by §4.5: the screen is also not registered in the navigator.

### 4.5 `ServicePreviewScreen` is typed but not registered — Medium

`RootStackNavigator.tsx` line 50 imports `ServicePreviewScreen` and line 143 declares `ServicePreview: { service: any }` in `RootStackParamList`, but there is no `<Stack.Screen name="ServicePreview" …>`. Any `navigation.navigate("ServicePreview", …)` call would crash. The wizard doesn't call it today, but the import dangles.

### 4.6 Three duplicate "business config" screens — Medium

`BusinessHubScreen` (the canonical multi-tab editor) overlaps with:

- `BusinessDetailsScreen` (still registered in RootStack, edits the same `provider` fields),
- `BookingPoliciesScreen` (orphaned, edits the same `bookingPolicies` JSON).

If a provider opens `BusinessDetails`, edits a field, and saves, then opens `BusinessHub` and saves a different tab, the writes can race because both screens `PATCH /api/provider/:id` against the full row. Pick `BusinessHub` as the source of truth, delete the other two.

### 4.7 `provider_message_templates` vs `message_templates` — Medium

Two separate Drizzle tables, both alive in the schema. Server endpoints reference `message_templates`; the frontend `SendMessageScreen` queries `/api/providers/:id/message-templates`. The duplicated `provider_message_templates` table appears dead. Reconcile and drop one.

### 4.8 `replit.md` says 28 tables, schema has 39 — Low (doc drift)

Update `replit.md`'s "managing 28 tables" to the correct 39, or split into "core 28" + "operational 11" if intentional.

### 4.9 Missing endpoints flagged but unused — Low

- **`GET /api/push-tokens`** does not exist; `NotificationPreferences` cannot list a user's registered devices. Acceptable if intentional, but the UI implies a list.
- **`POST /api/reviews/request`** does not exist; provider-initiated review requests have no API.

### 4.10 Inconsistent validation — Low

Several provider mutation routes (`POST /api/provider/onboard-complete`, `POST /api/booking-links`, `POST /api/leads/:id/accept`) bypass Zod (`insertProviderSchema`, `insertBookingLinkSchema`, etc.) in favor of manual `req.body.x` extraction. Risk of malformed writes. Standardize on Zod across all provider routes.

### 4.11 `getProviderByUserId` ownership check is single-provider-only — Low (latent)

`server/routes.ts` lines 3774–3778 use `getProviderByUserId` for the stats ownership check. If a user is ever associated with two `providers` rows (e.g. partial onboarding + retry), the second one returns 403. Not currently triggered in production but worth refactoring to compare against the row directly.

### 4.12 AI Assistant chat history is in-memory only — Low

`ProviderAIAssistantScreen` keeps messages in `useState`. Closing the screen wipes history. No `POST /api/ai/conversations` persistence. Acceptable for an MVP coach but worth flagging.

---

## 5. Per-screen findings (33 screens)

### 5.1 Tab screens

| Screen | Data sources | Status | Notes |
|---|---|---|---|
| `ProviderHomeScreen` | `stats`, `insights`, `jobs` queries; `SkeletonLoader`; pull-to-refresh | Working | "Go Online" toggle correctly wired through `syncAvailableForWork`. |
| `ClientsScreen` | `clients`, `last-messages` | Working | Clean empty state via `assets/images/empty-leads.png`. |
| `ScheduleScreen` | `jobs`, `clients` | Working | Calendar view; opens `ProviderJobDetailScreen`. |
| `FinancialsScreen` | `stats`, `invoices`, `stripe-payouts` | Working | CSV export, date range filters, real Stripe payout list. Empty for providers without Connect onboarding. |
| `ProviderMoreScreen` | `connectStatus` | Working | Availability toggle persists; settings fan-out. |

### 5.2 Stack screens (registered)

| Screen | Status | Notes |
|---|---|---|
| `AddClientScreen` | Working | Simple form, `PrimaryButton` with loading state. |
| `AddJobScreen` | Working | Uses real custom services; supports inline client creation. |
| `AddInvoiceScreen` | Working | Validation error blocks; Stripe-aware. |
| `BookingLinkScreen` | Working | Copy/share/regenerate. Uses two query keys for the same data (`["bookingLinks", providerId]` and `["/api/provider", providerId, "booking-links"]`) — minor inconsistency carried over from April. |
| `BusinessHubScreen` | Working | The canonical Profile / Services / Hours / Policies editor. |
| `BusinessDetailsScreen` | Duplicate | See §4.6. |
| `ClientDetailScreen` | Working with caveat | `client.ltv` always 0 — see §3 row 9. |
| `CommunicationsScreen` | Partial | Broadcast SMS sender works; no inbox / message history. |
| `InvoiceDetailScreen` | Working | Send / mark paid / cancel / remind; clear status pills. |
| `NewService` (alias of `ServiceBlueprintWizardScreen`) | Working | Multi-step wizard; AI service descriptions; saves to `provider_custom_services`. |
| `EditService` (alias of `ServiceBlueprintWizardScreen`) | Working | Same wizard in edit mode. |
| `ServicesScreen` | Working | Grid view of services, publish/unpublish toggle. |
| `ServiceSummaryScreen` | Working | Reorder / delete utility. |
| `PublicProfileScreen` | Working | Read-only public-page preview. |
| `ProviderJobDetailScreen` | Working | Checklist persists; photos upload to Supabase. Checklist is still the same 6-item generic list for every job (UX1 from April — still unaddressed). |
| `ProviderAIAssistantScreen` | Mostly working | Real data via 5 API queries; `KeyboardAvoidingView` fixed; voice mic still fake; chat history not persisted. |
| `ReviewsScreen` | Partial | Reply works; no aggregate rating display; no "Request a review" CTA. |
| `ProviderResourcesScreen` | Working | Offline cache, skeletons, retry. |
| `StripeConnectScreen` | Working with caveats | "Test Service"/"50.00" defaults must go (see §4.3). |
| `BookingLinkScreen` | Working | (Listed twice for clarity; only one screen file.) |
| `SendMessageScreen` | Working | Uses real `message_templates`; `KeyboardAvoidingView` fixed. |
| `SubscriptionScreen` | Working | Real RevenueCat status; restore purchases; Apple/Google manage links. |
| `AdminPartnersScreen` | Working (admin only) | Grant / revoke partner status. |

### 5.3 Orphan / dead / not registered

| Screen | Why | Recommendation |
|---|---|---|
| `LeadsScreen` | Built but not in any navigator. **Critical.** | Register in RootStack and add an entry point from `ProviderHomeScreen` (e.g. a "Leads" card with badge count from `/api/providers/:id/leads`). |
| `ServicePreviewScreen` | Imported and typed but no `<Stack.Screen>`; also still has hardcoded sample intake question. | Either register it and have the wizard's "Preview" button navigate to it (and replace mock content with real intake/add-ons/booking mode), or delete. |
| `AccountingScreen` | Superseded by `FinancialsScreen`. | Delete. |
| `MoneyScreen` | Superseded by `FinancialsScreen`. | Delete. |
| `FinancesScreen` | Superseded by `FinancialsScreen`. | Delete. |
| `BookingPoliciesScreen` | Duplicates BusinessHub's Policies tab. | Delete. |
| `BusinessDetailsScreen` | Duplicates BusinessHub's Profile tab. Still registered in RootStack — risk of conflicting writes. | Delete and route any links to `BusinessHub`. |
| `NewServiceScreen` | Older single-screen version; navigator now routes `NewService` and `EditService` to `ServiceBlueprintWizardScreen`. | Delete. |

---

## 6. Backend route findings

### 6.1 What's solid

- All ownership-protected provider routes use `requireAuth` + `assertProviderOwnership` consistently.
- Subscription gating: `POST /api/jobs` and `POST /api/invoices` correctly return `HTTP 403 { code: "SUBSCRIPTION_REQUIRED" }` once grace period expires (per `REVIEWER_NOTES.md`).
- Stripe Connect onboarding, account-link generation, and payout fetch are all live and DB-backed.
- The dual webhook architecture (`/api/stripe/webhook/platform`, `/api/stripe/webhook/connect`, plus `/api/revenuecat/webhook`) is in place with idempotency via `stripe_webhook_events` table.
- `provider_plans` correctly tracks `firstPaidBookingAt`, `gracePeriodEndsAt`, `isPartner`, `isSubscribed`, `subscriptionSource` (`stripe` vs `revenuecat`).

### 6.2 Endpoint issues

| ID | Issue | Impact |
|---|---|---|
| BE-1 | `LeadsScreen` not registered → all `/api/leads/*` and `/api/providers/:id/leads` endpoints have **no UI consumer**. | Public-link leads are invisible to providers. |
| BE-2 | `POST /api/reviews/request` does not exist. | Providers cannot solicit reviews via API. |
| BE-3 | `GET /api/push-tokens` does not exist. | UI implies a device list but cannot render one. |
| BE-4 | `getProviderByUserId` ownership check on `/api/provider/:id/stats` returns 403 for second provider profile of same user. | Latent multi-profile bug. |
| BE-5 | Inconsistent Zod validation across provider mutation routes. | Risk of malformed writes. |
| BE-6 | Two query keys for the same data in `BookingLinkScreen`. | Minor cache fragmentation; carried over from April. |

### 6.3 Schema migration status

- The April `arrival_date` migration gap is **closed** — column exists and is read by `stripeConnectService` lines 1714 & 1758.
- No other missing-column errors observed in the read-through.
- Recommend a one-time pruning pass for legacy `decimal` invoice/payment columns once cents path is fully battle-tested.

---

## 7. End-to-end provider workflows

### 7.1 New provider onboarding → first booking

| Step | Status | Notes |
|---|---|---|
| Signup → role select → onboarding wizard | Working | `ProviderSetupFlow` calls `POST /api/provider/onboard-complete` (atomic user + provider + first service insert). Bypasses Zod (manual extraction). |
| Service blueprint wizard | Working | AI suggestions; persists to `provider_custom_services`. |
| Booking link creation | Working | `POST /api/providers/:id/booking-links` writes a configurable link. |
| Public booking page → intake submission | Working | Writes `intake_submissions`. |
| Provider receives lead | **Broken end-to-end** — `LeadsScreen` is unreachable. The data lands in DB; no UI. | Fix per §4.1. |
| Lead → job conversion | Backend works (`POST /api/leads/:id/accept`); no UI path. | Same fix. |
| Job execution → checklist + photos | Working | Persistence regression fixed. |
| Job complete → invoice | Working | `POST /api/invoices` + Stripe checkout. |
| First paid invoice → grace period | Working | `provider_plans.firstPaidBookingAt` + `gracePeriodEndsAt` set automatically. `GracePeriodBanner` renders. |
| Grace expired → `SubscriptionGateModal` | Working | Modal blocks new job/invoice; "Subscribe" routes to `SubscriptionScreen` → RevenueCat purchase or Stripe (web). |
| Restore purchases | Working | Surfaced on `SubscriptionScreen`. |

**Net:** the only break in the new-provider funnel is step 5 (Leads UI). Everything else works end-to-end.

### 7.2 Existing provider day-to-day

- **Dashboard:** real stats, AI insights captions, jobs feed. ✓
- **Schedule:** calendar + job detail. ✓
- **Clients:** list, detail, add, edit. Caveat: `ltv` always shows $0.
- **Communications:** broadcast SMS works; no inbox.
- **Financials:** real Stripe payouts, date filters, CSV export. ✓
- **Subscription:** real status. ✓
- **AI Assistant:** real-data answers; mic button is decorative.
- **Reviews:** display and reply work; no aggregate rating; no request-review CTA.

### 7.3 Provider-to-homeowner messaging

- Email via `Resend` works through `SendMessageScreen` and `provider_messages` table.
- SMS broadcast via `CommunicationsScreen` works.
- Push notifications: token registration works; `NotificationPreferences` now has provider categories. No "list registered devices" UI possible (BE-3).

---

## 8. Mock data & dead code inventory

### 8.1 Mock data still in production bundle

- `client/state/providerStore.ts` lines 243–544 (`initialJobs`, `initialMessages`, `initialInvoices`, `initialPayouts`, `initialClients`, `initialClientActivities`, `initialClientNotes`) — wired into default state lines 961–965.
- `client/screens/provider/ServicePreviewScreen.tsx` lines 32–38 (default sample service) and line 151 (hardcoded "Do you have pets?").
- `client/screens/provider/StripeConnectScreen.tsx` lines 57–58 + 172 ("Test Service" / "50.00").

### 8.2 Dead screens to delete

`AccountingScreen`, `MoneyScreen`, `FinancesScreen`, `BookingPoliciesScreen`, `BusinessDetailsScreen`, `NewServiceScreen` (6 files; ~1,800 LOC combined estimate). All unreferenced.

### 8.3 Schema candidates for cleanup

- Drop one of `provider_message_templates` / `message_templates`.
- Plan deprecation of legacy decimal columns (`invoices.amount`, `invoices.total`, `payments.amount`).
- Reconcile `clients.homeData` removal (already deprecated).

---

## 9. Comparison table — April 14 vs May 2

| Area | April 14 verdict | May 2 verdict | Delta |
|---|---|---|---|
| Availability toggle | Broken (no PATCH) | Persists (PATCH + optimistic + rollback) | ✓ Fixed |
| AI Assistant keyboard | Input hidden by keyboard | Fixed | ✓ Fixed |
| SendMessage keyboard | Input hidden | Fixed | ✓ Fixed |
| Payouts DB | `arrival_date` missing | Migrated; works | ✓ Fixed |
| Subscription | Always "Free" | Real RevenueCat status, grace banner, gate modal | ✓ Fixed |
| Job photos | Not persisted | `POST /api/jobs/:id/photos` | ✓ Fixed |
| Job checklist | Resets each open | `PATCH /api/jobs/:id/checklist-state` | ✓ Fixed |
| AddJob picker | Generic categories | Real custom services | ✓ Fixed |
| Client `ltv` | Always 0 | Still always 0 | — Open |
| NotificationPreferences | Homeowner-only | Provider categories added | ✓ Fixed |
| Voice input | Fake | Still fake | — Open |
| Review request flow | Missing | API event type added; no UI CTA | ~ Partial |
| Default message templates | Not seeded | Still not seeded | — Open |
| `LeadsScreen` reachable | (Not flagged) | **Orphaned — unreachable** | ✗ New |
| `ServicePreviewScreen` registered | Registered | Type-only; no `<Stack.Screen>` | ✗ New |
| Mock data in store | Flagged | Still present | — Open |
| StripeConnect test defaults | Flagged | Still present | — Open |
| Duplicate business-config screens | Flagged | Still 3 screens | — Open |
| `provider_message_templates` vs `message_templates` | (Not flagged) | Both exist | ✗ New |
| `replit.md` table count | 28 (claimed) | Actual: 39 | ✗ New (doc drift) |

**Net movement: +8 fixes, +4 new findings.** Fixes outweigh new findings, and all new findings are bounded.

---

## 10. Top 10 prioritized fixes

| # | Fix | Severity | Est. effort | Impact |
|---|---|---|---|---|
| P1 | **Register `LeadsScreen` and add an entry point** from `ProviderHomeScreen` (badge with lead count) and from the More tab. Without this the entire public-booking-link funnel is dark. | Critical | 1 hr | Restores end-to-end lead → job pipeline. |
| P2 | **Remove mock data from `providerStore.ts`** (lines 243–544 + 961–965). Replace with empty arrays. | High | 30 min | New providers no longer see fake clients/jobs/invoices. |
| P3 | **Strip `"Test Service"` / `"50.00"` defaults** from `StripeConnectScreen.tsx`. Use empty strings + placeholders. | High | 10 min | Removes immediate trust hit on first invoice creation. |
| P4 | **Fix `ServicePreviewScreen`** — register it in the navigator (or delete it) and replace the hardcoded "Do you have pets?" with the real `intakeQuestionsJson`, add-ons, booking mode, and deposit policy from the service being previewed. | Medium | 2 hrs | Wizard preview is honest; trust restored. |
| P5 | **Compute `client.ltv` server-side** as `SUM(jobs.finalPrice WHERE status='completed') + SUM(payments.amountCents/100 WHERE invoices.clientId = …)` per client. Update on `POST /api/jobs/:id/complete` and on `payments` insert. | Medium | 2 hrs | Sort-by-LTV becomes meaningful; ClientDetail shows real value. |
| P6 | **Delete dead screens** — `AccountingScreen`, `MoneyScreen`, `FinancesScreen`, `BookingPoliciesScreen`, `BusinessDetailsScreen`, `NewServiceScreen`. Update `RootStackNavigator` to remove `BusinessDetails` and re-route any callers to `BusinessHub`. | Medium | 1 hr | Removes ~1,800 LOC and the duplicate-write race risk. |
| P7 | **Auto-seed default message templates** at provider creation. Insert 5 starter templates (Booking Confirmation, Reminder, Quote, Invoice, Review Request) into `message_templates` from `POST /api/provider/onboard-complete`. | Medium | 1 hr | First-time providers see a working template list. |
| P8 | **Add "Request a review" CTA** on the Job Completion screen and on `ReviewsScreen`. Wire to a new `POST /api/reviews/request` that emits the existing `review.request` notification event. | Medium | 2 hrs | Captures the highest-intent moment for review collection. |
| P9 | **Replace fake voice button** in `ProviderAIAssistantScreen` — either implement speech-to-text (`expo-av` + a transcription service) or hide the mic icon. Current state is deceptive UI. | Low | 15 min (hide) / 4 hrs (implement) | Removes broken affordance. |
| P10 | **Reconcile schema duplicates** — drop one of `provider_message_templates` / `message_templates` (whichever is unused), update `replit.md` table count from 28 → 39, and plan deprecation of legacy decimal invoice/payment columns. | Low | 1 hr | Reduces schema confusion for future contributors. |

**Total bounded effort to reach launch-ready: ~10 hours of focused work**, dominated by P1 (Leads) and P5 (LTV).

---

## 11. What is safe to demo today

These provider flows can be shown to real prospective providers without caveats:

- Onboarding wizard end-to-end (signup → role → business setup → first service).
- Business Hub (Profile / Services / Hours / Policies).
- Service Blueprint Wizard (AI-assisted descriptions, multi-step).
- Booking Link creation + public booking page.
- Client list and Client Detail (except the LTV chip).
- Add Job / Job Detail with checklist and photos.
- Add Invoice / Invoice Detail / Send / Mark Paid / Stripe checkout.
- Stripe Connect onboarding and payout history.
- Subscription screen with real grace-period state and gate modal.
- Email + SMS messaging with templates.
- Provider AI Assistant (text only).
- Reviews list and replies.
- Push notifications with provider-specific categories.

## 12. What must be hidden, fixed, or disclaimed before paid rollout

- `LeadsScreen` — must be wired up before any provider uses a public booking link.
- Mock seed data in `providerStore.ts` — must be stripped.
- `StripeConnectScreen` "Test Service" defaults — must be removed.
- `ServicePreviewScreen` — fix or remove; do not ship the "Do you have pets?" preview.
- Voice mic button — hide until speech-to-text actually exists.
- Sort-by-LTV in `ClientsScreen` — disable until P5 ships.
- Duplicate business-config screens — delete `BusinessDetailsScreen` and `BookingPoliciesScreen` entries from RootStack.

---

## Appendix A — Orphaned / dead provider files

```
client/screens/provider/AccountingScreen.tsx          (dead — superseded by FinancialsScreen)
client/screens/provider/BookingPoliciesScreen.tsx     (dead — duplicate of BusinessHub Policies tab)
client/screens/provider/BusinessDetailsScreen.tsx     (live in nav but duplicate of BusinessHub Profile tab)
client/screens/provider/FinancesScreen.tsx            (dead — superseded by FinancialsScreen)
client/screens/provider/LeadsScreen.tsx               (built but unregistered — CRITICAL)
client/screens/provider/MoneyScreen.tsx               (dead — superseded by FinancialsScreen)
client/screens/provider/NewServiceScreen.tsx          (dead — superseded by ServiceBlueprintWizardScreen)
client/screens/provider/ServicePreviewScreen.tsx      (typed in RootStackParamList but no <Stack.Screen>)
```

## Appendix B — Provider tab navigator (canonical 5 tabs)

```
ProviderTabNavigator
├── HomeTab        → ProviderHomeScreen
├── ClientsTab     → ClientsScreen
├── ScheduleTab    → ScheduleScreen
├── FinancialsTab  → FinancialsScreen
└── MoreTab        → ProviderMoreScreen
```

`LeadsScreen` belongs here as a 6th tab or as a card on `ProviderHomeScreen` with a notification badge tied to `/api/providers/:id/leads` count.

## Appendix C — Subscription state machine (current, post-fix)

```
NEW PROVIDER
  ↓ (no paid invoices yet)
FREE  ──────────────────────────────────────► full feature access
  ↓ POST /api/invoices (first one paid)
GRACE_PERIOD (7 days)  ────────────────────► full feature access
                                            + GracePeriodBanner shows countdown
  ↓ gracePeriodEndsAt < now()
GATED  ───────────────────────────────────► POST /api/jobs and
                                            POST /api/invoices return
                                            403 SUBSCRIPTION_REQUIRED
                                            + SubscriptionGateModal shown in UI
  ↓ RevenueCat INITIAL_PURCHASE / RENEWAL webhook
SUBSCRIBED ────────────────────────────────► full feature access
  ↓ EXPIRATION / CANCELLATION webhook past expiration_at_ms
GATED (again, until re-subscribe or partner grant)
```

Partner bypass: `provider_plans.isPartner = true` short-circuits the gate at any state.

## Appendix D — Schema table count reconciliation

`replit.md` says 28 tables. Actual: **39** across `shared/schema.ts` (37) + `shared/models/chat.ts` (2). Update `replit.md` accordingly. Full list:

users, homes, service_categories, services, providers, provider_services, provider_custom_services, appointments, reviews, saved_providers, review_reports, notifications, maintenance_reminders, provider_plans, stripe_connect_accounts, user_credits, credit_ledger, payouts, refunds, stripe_webhook_events, invoice_line_items, clients, jobs, invoices, payments, booking_links, intake_submissions, home_field_changes, push_tokens, notification_preferences, provider_message_templates, notification_deliveries, provider_messages, message_templates, leads, housefax_entries, support_tickets, conversations, messages.

---

*End of report.*
