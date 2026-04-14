# HomeBase Provider App — MVP Readiness Audit
**Date:** April 14, 2026  
**Scope:** All 30+ provider-facing screens, navigation flows, API wiring, and UX patterns  
**Auditor:** Full codebase review — every provider screen file read in full  

---

## Table of Contents
1. [Audit Methodology](#1-audit-methodology)
2. [Screen-by-Screen Findings](#2-screen-by-screen-findings)
3. [Empty / Loading / Error State Matrix](#3-empty--loading--error-state-matrix)
4. [End-to-End Workflow Audit](#4-end-to-end-workflow-audit)
5. [Missing MVP Requirements](#5-missing-mvp-requirements)
6. [Critical Blockers](#6-critical-blockers)
7. [High Priority Issues](#7-high-priority-issues)
8. [Medium Priority Issues](#8-medium-priority-issues)
9. [Nice-to-Have Improvements](#9-nice-to-have-improvements)
10. [Final Verdict](#10-final-verdict)

---

## 1. Audit Methodology

Each screen was evaluated across five dimensions:

| Dimension | What It Means |
|-----------|---------------|
| **End-to-End** | Does the screen complete a real user action, from input through to the backend, and back? |
| **Persistence** | Does all data the user enters actually save to the Supabase database? |
| **Trustworthy** | Would a real provider trust what they see (correct data, no fake placeholders)? |
| **AI Balance** | Is AI assistance optional and clearly labeled, or does it over-reach and assume? |
| **Empowerment** | Does the screen put the provider in control, or does it feel passive/confusing? |

Findings are categorized as: **Critical** (launch blocker), **High** (should fix before launch), **Medium** (v1.1), or **Low** (polish).

---

## 2. Screen-by-Screen Findings

### 2.1 ProviderSetupFlow (Onboarding)
`client/screens/onboarding/ProviderSetupFlow.tsx` — 1,877 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | 7 steps → creates provider record in DB → navigates to ProviderHome |
| Persistence | ✅ Pass | `POST /api/providers` on complete; profile stored in `authStore.providerProfile` |
| Trustworthy | ✅ Pass | No fake data; real slug generated from business name |
| AI Balance | ✅ Pass | No AI in this flow |
| Empowerment | ⚠️ Partial | 7 steps is heavy; Steps 4 (Hours) and 5 (First Service) feel mandatory but are skippable conceptually |

**Finding (Low):** Consider making Hours and First Service optional — show "You can add these later" so providers reach their dashboard faster.

---

### 2.2 ProviderHomeScreen (Dashboard)
`client/screens/provider/ProviderHomeScreen.tsx`

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Stats fetched from `/api/provider/:id/stats`; Getting Started checklist evaluates real `providerProfile` fields |
| Persistence | ✅ Pass | Read-only dashboard; no writes required |
| Trustworthy | ✅ Pass | Displays real revenue, job count, client count |
| AI Balance | ✅ Pass | No AI in this screen |
| Empowerment | ✅ Pass | Quick action buttons to common tasks; clear progress on getting started |

**Finding (Low):** Bell icon navigates to the homeowner `Notifications` screen. Provider-specific notification preferences do not exist.

---

### 2.3 BusinessHubScreen (Profile Management)
`client/screens/provider/BusinessHubScreen.tsx`

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Reads from `/api/provider/user/:userId`; PATCH to `/api/provider/:id` saves all tabs |
| Persistence | ✅ Pass | Profile, area, hours, and policies all write to the `providers` table |
| Trustworthy | ✅ Pass | Syncs from server on mount; no stale local-only state |
| AI Balance | ✅ Pass | No AI involved |
| Empowerment | ✅ Pass | 4-tab layout is clear and well-organized |

**Finding (High — Duplicate Paths):** `BookingPoliciesScreen` and `BusinessDetailsScreen` are standalone screens that edit the **same backend fields** as BusinessHubScreen's Policies tab. `BusinessDetailsScreen` uses different internal field names (`cancellationFee` vs. `cancellationFeePercent` in `BookingPoliciesScreen`). Data saved from one screen may display incorrectly in another. Three separate UIs writing to the same database field is a data consistency risk. **Recommend:** Remove `BookingPoliciesScreen` and `BusinessDetailsScreen` as standalone screens; `BusinessHubScreen` should be the single editing interface.

---

### 2.4 ServicesScreen
`client/screens/provider/ServicesScreen.tsx`

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Loads from `/api/provider/:id/services`; publish/unpublish, delete all work |
| Persistence | ✅ Pass | Mutations invalidate `services` query key after write |
| Trustworthy | ✅ Pass | Only shows services the provider actually created |
| AI Balance | ✅ Pass | No AI in this screen |
| Empowerment | ✅ Pass | Eye-icon preview; FAB to add new service |

No blockers.

---

### 2.5 ServiceBlueprintWizardScreen (New Service)
`client/screens/provider/ServiceBlueprintWizardScreen.tsx`

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | 6-step flow → `POST /api/provider/:id/services` → service appears in ServicesScreen |
| Persistence | ✅ Pass | All steps (name, pricing, questions, add-ons, booking mode) saved in full |
| Trustworthy | ✅ Pass | Provider-authored content throughout |
| AI Balance | ✅ Pass | AI is clearly optional ("Suggest…" secondary links, never auto-runs) |
| Empowerment | ✅ Pass | Manual entry escape hatch; "Build your service your way" philosophy honored |

No blockers.

---

### 2.6 ServicePreviewScreen
`client/screens/provider/ServicePreviewScreen.tsx`

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Navigated to from ServicesScreen eye-icon; displays service card |
| Persistence | N/A | Read-only |
| Trustworthy | ❌ FAIL | "WHAT'S INCLUDED" section is **hardcoded**: "Professional service by verified pro", "All materials and equipment included", "Satisfaction guaranteed" — ignores the provider's actual add-ons. "INTAKE QUESTIONS" is **hardcoded**: "1. Do you have pets? (Yes/No)" — ignores actual intake questions from the wizard |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ❌ FAIL | Provider configures custom questions in the wizard, but the preview shows completely different fake questions — destroys trust |

**Finding (Critical):** The `ServicePreviewParams` type only accepts `{name, category, description, pricingModel, price, duration}`. Intake questions and add-ons are never passed to this screen. Fix: expand the params type to include `intakeQuestionsJson` (from `provider_custom_services.intake_questions_json`) and `addOnsJson`, then render them instead of the hardcoded strings.

---

### 2.7 BookingLinkScreen
`client/screens/provider/BookingLinkScreen.tsx`

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | CRUD: create/list/toggle/delete/copy/share — all wired to real API |
| Persistence | ✅ Pass | `bookingLinks` table via `/api/providers/:id/booking-links` |
| Trustworthy | ✅ Pass | URLs use `EXPO_PUBLIC_DOMAIN` env var — never hardcoded |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Share sheet, copy-link, active toggle all give provider control |

**Finding (Low):** No edit flow for an existing booking link; provider must delete and recreate.

---

### 2.8 LeadsScreen
`client/screens/provider/LeadsScreen.tsx` — 794 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Intake submissions + CRM leads both from real API; Accept creates client + job; Decline updates status |
| Persistence | ✅ Pass | Accept calls `POST /api/intake-submissions/:id/accept` which creates client + job records |
| Trustworthy | ✅ Pass | Real submission data with client name/email/phone from booking form |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Accept modal with date/notes; decline requires no explanation (respects provider's time) |

**Finding (Medium):** Two visually separate lists (intake submissions at top, CRM leads below) are confusing. Both represent incoming business. Consider a unified "Inbox" with a source badge.

---

### 2.9 ScheduleScreen
`client/screens/provider/ScheduleScreen.tsx` — 1,341 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Jobs fetched from real API; status updates write back; navigates to ProviderJobDetail |
| Persistence | ✅ Pass | Status mutations via PATCH endpoint invalidate the jobs query |
| Trustworthy | ✅ Pass | Only shows provider's real scheduled jobs |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | List/month toggle; quick status update bottom sheet; day-tap filtering |

**Finding (Low):** Month calendar doesn't paginate — cannot navigate to other months.

---

### 2.10 ClientsScreen
`client/screens/provider/ClientsScreen.tsx` — 685 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Loads from `/api/provider/:id/clients`; long-press quick actions (call/text/email/message) work |
| Persistence | N/A | Read-only list; writes happen in AddClient/ClientDetail |
| Trustworthy | ✅ Pass | Real client data with LTV, last seen, next appointment |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | 6 filter chips, 4 sort options, search — full CRM control |

No blockers.

---

### 2.11 ClientDetailScreen
`client/screens/provider/ClientDetailScreen.tsx` — 1,219 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | 6-tab detail (Overview, Jobs, Invoices, Notes, Home, Messages) — all tabs fetch real data |
| Persistence | ✅ Pass | Notes CRUD, new job/invoice creation all persist |
| Trustworthy | ✅ Pass | All data comes from real API endpoints per-client |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Quick action row (call/text/email/message); all tabs provide actionable data |

**Finding (Low):** Home tab shows HouseFax data if the client linked their homeowner profile. If not linked, it shows empty state with no guidance for how to ask a client to link their home.

---

### 2.12 AddJobScreen
`client/screens/provider/AddJobScreen.tsx` — 771 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Client picker → date/time → price → saves to `POST /api/jobs` (also creates appointment non-fatally) |
| Persistence | ✅ Pass | `jobs` table write confirmed |
| Trustworthy | ✅ Pass | Pre-selects passed `clientId` from navigation params |
| AI Balance | ✅ Pass | "Get AI Price Estimate" is opt-in only |
| Empowerment | ⚠️ Partial | Static `SERVICE_OPTIONS` list doesn't show provider's real custom services |

**Finding (Medium):** The service type picker shows hardcoded generic options ("General Repair", "Installation", etc.) instead of the provider's actual configured services from `provider_custom_services`. A provider who carefully set up their service catalog sees none of it here.

---

### 2.13 ProviderJobDetailScreen
`client/screens/provider/ProviderJobDetailScreen.tsx` — 770 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Status progression, notes, final price — all write to API |
| Persistence | ✅ Pass | All mutations invalidate the job query key |
| Trustworthy | ✅ Pass | Shows real job data, client info |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ⚠️ Partial | Before/after photos captured via image picker but never uploaded |

**Finding (High):** `expo-image-picker` is used to capture job photos, but there is no photo upload endpoint. Photos are stored as local URI strings only — they will disappear on app restart and are never shared with the homeowner or stored durably.

---

### 2.14 AddInvoiceScreen
`client/screens/provider/AddInvoiceScreen.tsx` — 1,129 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Multi-line-item form → `POST /api/invoices/create-and-send` → invoice appears in FinancialsScreen |
| Persistence | ✅ Pass | Line items stored as JSON in `invoices.line_items`; total calculated server-side |
| Trustworthy | ✅ Pass | Real client/job selectors; no fake data |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Multiple line items, due date, notes, optional "send on creation" toggle |

No blockers.

---

### 2.15 InvoiceDetailScreen
`client/screens/provider/InvoiceDetailScreen.tsx` — 884 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Send, Mark Paid, Cancel, Copy Payment Link, Stripe Checkout — all wired to real API |
| Persistence | ✅ Pass | Status updates persist; `chargesEnabled` gate prevents broken Stripe URLs |
| Trustworthy | ✅ Pass | Shows real line items with correct totals |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Full invoice lifecycle control; user-friendly error if Stripe not ready |

No blockers.

---

### 2.16 StripeConnectScreen
`client/screens/provider/StripeConnectScreen.tsx` — 632 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Full onboarding: creates Connect account → opens Stripe onboarding URL → polls status on AppState resume |
| Persistence | ✅ Pass | `stripeConnectAccounts` table updated by webhook/polling |
| Trustworthy | ✅ Pass | Status states (not_started/pending/complete/restricted) accurately reflect Stripe reality |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | AppState listener auto-refreshes on return from Stripe; no manual refresh needed |

**Finding (Low):** Test invoice section at the bottom (hardcoded "Test Service", "$50.00") is clearly a dev tool. Should be hidden behind `__DEV__` flag or removed before launch.

---

### 2.17 FinancialsScreen
`client/screens/provider/FinancialsScreen.tsx` — 1,655 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Revenue stats, invoice list, Stripe payout history — all from real API |
| Persistence | N/A | Read-only |
| Trustworthy | ✅ Pass | `useFocusEffect` ensures fresh data on tab focus |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Overview/Transactions/More tabs; direct navigate to InvoiceDetail |

**Finding (High):** `MoneyScreen.tsx`, `FinancesScreen.tsx`, and `AccountingScreen.tsx` exist as separate files but are **not registered in any navigator**. They are dead code that will confuse future developers.

---

### 2.18 CommunicationsScreen
`client/screens/provider/CommunicationsScreen.tsx` — 650 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Individual and broadcast message sends reach `/api/providers/:id/messages` |
| Persistence | ✅ Pass | Messages stored in `provider_messages` table; appear in ClientDetail Messages tab |
| Trustworthy | ✅ Pass | Rate-limiting (10/client/24hr) prevents spam |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Channel picker (email/push), individual vs broadcast modes |

**Finding (Medium):** Push channel sends to client but push delivery status is never surfaced. Providers have no visibility into whether a push notification was actually delivered.

---

### 2.19 SendMessageScreen
`client/screens/provider/SendMessageScreen.tsx` — 437 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Template system, merge variable chips, blast mode — all reach API |
| Persistence | ✅ Pass | Message history viewable in ClientDetail |
| Trustworthy | ✅ Pass | Merge variables resolve to real provider/client data server-side |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Template CRUD, merge variable hints, channel selection |

**Finding (Medium):** Uses `KeyboardAvoidingView` from `react-native` (line 9) instead of the required `react-native-keyboard-controller`. May cause keyboard overlay on some iOS devices.

---

### 2.20 ReviewsScreen
`client/screens/provider/ReviewsScreen.tsx` — 379 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Fetches from `/api/provider/:id/reviews`; filter by stars |
| Persistence | N/A | Read-only |
| Trustworthy | ✅ Pass | Shows real review data from homeowners |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ⚠️ Partial | Provider can only view reviews; cannot request or respond to them |

**Finding (Medium):** No "Request a Review" CTA. Provider cannot proactively solicit feedback from satisfied clients.

---

### 2.21 ProviderAIAssistantScreen
`client/screens/provider/ProviderAIAssistantScreen.tsx` — 607 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Sends to `/api/ai/provider/chat` with real business context |
| Persistence | N/A | Conversational; no writes |
| Trustworthy | ✅ Pass | Business context fetches real clients/jobs/invoices/stats; cached in ref |
| AI Balance | ✅ Pass | AI is clearly a chat assistant; provider initiates all queries |
| Empowerment | ⚠️ Partial | Mic button is decorative — tapping it does nothing |

**Finding (Critical):** `KeyboardAvoidingView` imported from `react-native` (line 9) instead of `react-native-keyboard-controller`. The project guidelines explicitly state chat screens **MUST** use the keyboard-controller version. On iOS, the input field can be hidden behind the software keyboard.

**Finding (Medium):** The microphone icon animates a pulsing effect but `isListening` is never set to `true` anywhere in the component. No speech capture is wired up. Remove the icon or implement voice input.

---

### 2.22 ProviderMoreScreen
`client/screens/provider/ProviderMoreScreen.tsx` — 442 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Logout, delete account, switch role, dark mode — all work |
| Persistence | ⚠️ Partial | See availability toggle finding below |
| Trustworthy | ✅ Pass | Displays real provider avatar, name, category |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Role switch, account management, clear navigation |

**Finding (Critical):** The "Available for Work" toggle updates only local Zustand state (`providerStore.availableForWork`). There is **no PATCH call** to the backend. The `providers.is_active` field in Supabase is never updated. Public provider listings continue to show the provider as available even when they toggled off. The local state is also reset on app restart.

---

### 2.23 SubscriptionScreen
`client/screens/provider/SubscriptionScreen.tsx` — 177 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ❌ Fail | "Manage Subscription" opens App Store subscriptions page — no integration |
| Persistence | ❌ Fail | No subscription state in database |
| Trustworthy | ❌ Fail | "PRO" badge shown to all providers regardless of actual subscription |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ❌ Fail | Provider cannot actually manage anything from this screen |

**Finding (Critical):** This screen is a non-functional placeholder. `isFree` is determined by `completedJobs === 0` (unrelated to subscriptions). There is no RevenueCat integration, no subscription check against any backend. If provider monetization is planned for launch, this must be wired up. If post-launch, add a clear "Coming Soon" badge so providers are not confused.

---

### 2.24 ProviderResourcesScreen
`client/screens/provider/ProviderResourcesScreen.tsx` — 426 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ❌ Fail | Every link opens the same dead URL |
| Persistence | N/A | Read-only |
| Trustworthy | ❌ Fail | 8 cards all link to `https://homebaseproapp.com/faqpage` — does not exist |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ❌ Fail | Provider trying to learn best practices hits a 404 every time |

**Finding (High):** All 8 resource links point to the same non-existent page. Fix: either create real content at these URLs before launch, or replace external links with inline modal content within the app.

---

## 3. Empty / Loading / Error State Matrix

| Screen | Loading State | Empty State | Error State | Rating |
|--------|--------------|-------------|-------------|--------|
| ProviderHomeScreen | ✅ Skeleton-style `ActivityIndicator` per stat card | ✅ "0" values shown with onboarding prompts | ✅ Silently degrades to 0 stats | Pass |
| ServicesScreen | ✅ `ActivityIndicator` while fetching | ✅ `EmptyState` with "Add your first service" CTA | ✅ Shows empty state (no explicit error UI) | Pass |
| BookingLinkScreen | ✅ `isLoading` spinner | ✅ "No booking links yet" with create CTA | ⚠️ No explicit error toast — shows empty list | Partial |
| LeadsScreen | ✅ `ActivityIndicator` at top | ✅ `EmptyState` per tab (intake vs. leads) | ⚠️ No explicit error state — shows empty list | Partial |
| ScheduleScreen | ✅ `ActivityIndicator` over calendar | ✅ "No jobs on this day" per day | ⚠️ No explicit error card — shows empty | Partial |
| ClientsScreen | ✅ `isLoading` check renders nothing briefly | ✅ `EmptyState` component with "Add first client" | ⚠️ No explicit error UI — shows empty | Partial |
| ClientDetailScreen | ✅ Per-tab `ActivityIndicator` | ✅ Empty state per tab (no jobs, no invoices, etc.) | ⚠️ Tab errors silent (shows empty) | Partial |
| AddJobScreen | ✅ Client list loads with `isLoading` | ✅ "No clients yet — add one first" | ⚠️ Submit error shown in Alert only | Partial |
| ProviderJobDetailScreen | ✅ `ActivityIndicator` while loading job | ✅ N/A (navigated with jobId) | ✅ Shows error message if fetch fails | Pass |
| AddInvoiceScreen | ✅ Client/job selectors show loading | ✅ Modal pickers handle empty lists | ✅ Mutation errors surface in Alert | Pass |
| InvoiceDetailScreen | ✅ `ActivityIndicator` on load | ✅ N/A (navigated with invoiceId) | ✅ `chargesEnabled` gate shows friendly error | Pass |
| FinancialsScreen | ✅ Per-section `ActivityIndicator` | ✅ `EmptyState` per section tab | ⚠️ Stripe status errors silently show "not connected" | Partial |
| StripeConnectScreen | ✅ `loadingStatus` spinner on mount | ✅ Clear CTA when not connected | ✅ Handles all 4 status states with UI | Pass |
| CommunicationsScreen | ✅ `ActivityIndicator` on client list | ✅ "No clients yet" message | ⚠️ Send errors shown in Alert only | Partial |
| ReviewsScreen | ✅ `isLoading` guard before render | ✅ "No reviews yet" per filter | ⚠️ Fetch error shows empty list | Partial |
| ProviderAIAssistantScreen | ✅ `isLoading` dots animation during AI call | ✅ Quick-prompt chips on empty chat | ✅ Error caught and shown as assistant message | Pass |
| ServicePreviewScreen | N/A (no async) | N/A | N/A | Pass |
| ProviderMoreScreen | N/A (static) | N/A | ✅ Delete account error logged | Pass |
| SubscriptionScreen | N/A (no fetching) | N/A | N/A | N/A |
| ProviderResourcesScreen | N/A (static) | N/A | N/A | Pass |

**Summary:** Most screens handle loading and empty states correctly. The majority gap is in **error state display** — many screens silently show an empty list when an API call fails rather than showing a "something went wrong, pull to refresh" message. This is acceptable for MVP but should be tightened up in v1.1.

---

## 4. End-to-End Workflow Audit

### Workflow A: New Provider First Day

**Steps:** Sign up → select Provider → ProviderOnboarding (3-step teaser) → ProviderSetupFlow (7 steps) → ProviderHomeScreen

**Status: ✅ Passes end-to-end**

- `POST /api/providers` creates provider record with `businessName`, `category`, `serviceArea`, `businessHours`, and initial `customServices`
- `authStore.providerProfile` populated; `onboardingStore.hasCompletedProviderSetup = true`
- ProviderHomeScreen Getting Started checklist correctly reflects new provider's incomplete state (Stripe not connected, 0 services, 0 clients)

**Gap:** Returning provider who completed setup but whose `providers` record was somehow not created will be stuck in a loop. The `canAccessProviderMode()` check in `RootStackNavigator` has a fallback via `activateProviderMode()` but the UX is unclear.

---

### Workflow B: Provider Lists and Books a Service

**Steps:** New Service (Wizard, 6 steps) → Publish → Booking Link (create) → Share → Homeowner submits via `/book/:slug` → Leads inbox → Accept → Job appears in Schedule

**Status: ✅ Passes end-to-end**

- Wizard saves to `provider_custom_services` including `intake_questions_json`, `add_ons_json`, `booking_mode`, `ai_pricing_insight`
- Booking link created in `bookingLinks` table with `slug`
- Public page at `/book/:slug` renders intake questions and adapts CTA for `quote_only` or `starts_at` modes
- `POST /api/intake-submissions/:id/accept` creates `clients` (upsert by email) + `jobs` records
- Job appears in ScheduleScreen with status `confirmed`

**Gap:** If `instantBooking: true`, the auto-conversion to client+job happens at submission time, but the provider is not notified in real-time. They would only see the new client/job on next refresh.

---

### Workflow C: Provider Completes a Job and Gets Paid

**Steps:** ProviderJobDetailScreen → advance status to `completed` → AddInvoiceScreen → Send Invoice → Client pays via Stripe Checkout → InvoiceDetailScreen shows `paid`

**Status: ✅ Passes end-to-end**

- Job status progression: scheduled → confirmed → on_my_way → arrived → in_progress → completed — all PATCH to `/api/jobs/:id/status`
- Invoice creation via `POST /api/invoices/create-and-send` attaches to client and job
- Stripe Checkout URL generated via `POST /api/invoices/:id/checkout` (guarded by `chargesEnabled`)
- `paidAt` timestamp set by Stripe webhook; InvoiceDetailScreen shows paid status and date

**Gap:** Provider must manually check InvoiceDetailScreen for payment — there is no push notification or in-app alert when a payment lands.

---

### Workflow D: Provider Manages Clients (CRM)

**Steps:** AddClientScreen → ClientsScreen → ClientDetailScreen (6 tabs: Overview/Jobs/Invoices/Notes/Home/Messages)

**Status: ✅ Passes end-to-end**

- `POST /api/provider/:id/clients` creates client with address (Google Places enrichment)
- All 6 tabs in ClientDetailScreen load real data from their respective API endpoints
- Notes CRUD works; message compose sends via `/api/providers/:id/messages`
- LTV, outstanding balance, and next appointment computed correctly

**Gap:** "Home" tab is empty unless the homeowner has linked their HomeBase account. There's no mechanism to invite a client to link their home from within the provider CRM.

---

### Workflow E: Provider Gets Paid via Stripe Connect

**Steps:** StripeConnectScreen → onboard → charges enabled → create invoice → client pays → payout received

**Status: ✅ Passes end-to-end**

- AppState listener refreshes Connect status automatically after returning from Stripe's onboarding browser
- Platform fee of 3% correctly defaults in all invoice creation flows
- Payout history shown in FinancialsScreen "More" tab via `/api/stripe/payouts`
- `chargesEnabled` gate on checkout prevents broken links

**Gap:** No manual "trigger payout" UI — providers must wait for Stripe's automatic payout schedule. This is by design for Stripe Connect but not explained in the UI.

---

## 5. Missing MVP Requirements

The following items represent functional gaps that a real provider would need on day one:

| # | Requirement | Status | Impact |
|---|-------------|--------|--------|
| M1 | **Availability toggle persists to backend** | ❌ Missing | Providers who turn off availability are still shown as active on public listings |
| M2 | **ServicePreviewScreen shows real content** | ❌ Wrong data | Preview shows fake hardcoded questions/includes instead of provider's actual service configuration |
| M3 | **Subscription state is real** | ❌ Placeholder | All providers shown as "Pro" with no actual RevenueCat or payment subscription check |
| M4 | **AI chat keyboard works on iOS** | ❌ Bug | Wrong `KeyboardAvoidingView` import means the text input can be hidden behind the keyboard |
| M5 | **Resource links are not dead** | ❌ All 404 | All 8 resource links point to a non-existent URL |
| M6 | **Job photos are durable** | ❌ Local only | Before/after photos captured but never uploaded — lost on app restart |
| M7 | **Single source of truth for policies** | ❌ 3 UIs, 1 DB field | `BookingPoliciesScreen`, `BusinessDetailsScreen`, and `BusinessHubScreen` all write to the same field with different field names |

---

## 6. Critical Blockers

These must be fixed before any provider-facing public launch.

### B1 — ServicePreviewScreen: Hardcoded Fake Content
**File:** `client/screens/provider/ServicePreviewScreen.tsx`, lines 119–154  
**Problem:** "WHAT'S INCLUDED" shows 3 hardcoded bullet points; "INTAKE QUESTIONS" shows hardcoded "Do you have pets?" regardless of what the provider configured.  
**Fix:** Update `ServicePreviewParams` type to include `intakeQuestionsJson: string | null` and `addOnsJson: string | null`. Update `ServicesScreen` and `ServiceBlueprintWizardScreen` to pass these fields. Render them in ServicePreviewScreen instead of the hardcoded content.  
**Effort:** ~2 hours

### B2 — ProviderAIAssistantScreen: Wrong KeyboardAvoidingView
**File:** `client/screens/provider/ProviderAIAssistantScreen.tsx`, line 9  
**Problem:** `import { ..., KeyboardAvoidingView } from "react-native"` — this is the native component, not the keyboard-controller version. Chat input obscured by keyboard on iOS.  
**Fix:** Replace import with `import { KeyboardAvoidingView } from 'react-native-keyboard-controller'` and ensure `behavior="padding"` with `keyboardVerticalOffset={0}`.  
**Effort:** ~15 minutes

### B3 — Availability Toggle Not Persisted
**Files:** `ProviderMoreScreen.tsx`, `BusinessHubScreen.tsx`, `state/providerStore.ts`  
**Problem:** `setAvailableForWork()` only updates in-memory Zustand state. No PATCH to `/api/provider/:id`. Public listing ignores this toggle.  
**Fix:** Add `PATCH /api/provider/:id` call with `{ isAvailable: value }` in both toggle handlers. Add `is_active` to the fields read from `providerProfile` on mount to initialize state correctly.  
**Effort:** ~1 hour

### B4 — SubscriptionScreen: Non-Functional Placeholder
**File:** `client/screens/provider/SubscriptionScreen.tsx`  
**Problem:** All providers show "Pro" status. No RevenueCat integration. "Manage" button opens App Store subscriptions page with no HomeBase subscription to find there.  
**Fix (MVP minimum):** Add a "Coming Soon" badge and disable the Manage button if RevenueCat is not ready. Alternatively, integrate RevenueCat `Purchases.getCustomerInfo()` to check entitlements.  
**Effort:** ~30 minutes for "Coming Soon" label; ~1 day for full RevenueCat integration

---

## 7. High Priority Issues

### H1 — Resource Links All Dead
**File:** `client/screens/provider/ProviderResourcesScreen.tsx`  
All 8 resource URLs point to `https://homebaseproapp.com/faqpage` which does not exist. **Fix:** Replace external links with inline modal detail views, or create actual content pages.

### H2 — Three Duplicate Policy-Editing UIs
**Files:** `BusinessHubScreen.tsx`, `BookingPoliciesScreen.tsx`, `BusinessDetailsScreen.tsx`  
All three write to `providers.bookingPolicies`. Field naming is inconsistent between files. **Fix:** Delete `BookingPoliciesScreen` and `BusinessDetailsScreen` as standalone screens; retain only `BusinessHubScreen` as the canonical editing interface.

### H3 — Job Photos Lost on Restart
**File:** `ProviderJobDetailScreen.tsx`  
Photos captured via image picker are stored as local URI strings only — no upload endpoint. **Fix:** Create `POST /api/jobs/:id/photos` with multipart form data upload to Supabase Storage.

### H4 — Orphaned Finance Screens (Dead Code)
**Files:** `MoneyScreen.tsx`, `FinancesScreen.tsx`, `AccountingScreen.tsx`  
Not registered in any navigator. Older iterations of the financial flow. **Fix:** Delete all three files to reduce codebase confusion.

---

## 8. Medium Priority Issues

### Mid1 — Microphone Button is Decorative
`ProviderAIAssistantScreen.tsx` — `isListening` never set to `true`. Remove the mic button or wire up `expo-speech` for voice input.

### Mid2 — SendMessageScreen Keyboard Bug
`SendMessageScreen.tsx` line 9 — `KeyboardAvoidingView` from `react-native`. Replace with `react-native-keyboard-controller` version.

### Mid3 — No Review Solicitation
`ReviewsScreen.tsx` — No "Request a Review" CTA. Add a button that opens `SendMessageScreen` pre-filled with a review-request template.

### Mid4 — Unified Leads Inbox
`LeadsScreen.tsx` — Two separate lists (intake submissions + CRM leads) are confusing. Unify into a single list with a source badge.

### Mid5 — AddJobScreen Uses Static Service Types
`AddJobScreen.tsx` — Service type picker shows hardcoded generic options instead of the provider's real services from `provider_custom_services`. Fetch and display provider's own services first.

### Mid6 — Push Delivery Status Invisible
`CommunicationsScreen.tsx` — Provider cannot tell if a push notification was delivered. Surface delivery status in message history.

### Mid7 — Month Calendar Doesn't Paginate
`ScheduleScreen.tsx` — Month calendar is stuck on current month. Add forward/back navigation arrows.

---

## 9. Nice-to-Have Improvements

These are polish items for v1.1 or beyond:

| # | Screen | Suggestion |
|---|--------|------------|
| N1 | `ProviderSetupFlow` | Make Hours (Step 4) and First Service (Step 5) skippable; reduce initial friction |
| N2 | `BookingLinkScreen` | Add edit flow for existing booking links (currently delete + recreate) |
| N3 | `ClientDetailScreen` | "Invite client to link their home" prompt on empty Home tab |
| N4 | `StripeConnectScreen` | Remove test invoice section or gate it behind `__DEV__` |
| N5 | `ProviderHomeScreen` | Bell icon should navigate to provider-specific notifications, not homeowner notifications |
| N6 | `ProviderMoreScreen` | `BookingPoliciesScreen` navigation route still exists — clean it up after H2 fix |
| N7 | `ScheduleScreen` | Group jobs with no `scheduledDate` into a "Unscheduled" section |
| N8 | `ClientsScreen` | Add avatar/photo upload for client records |
| N9 | All screens | Most error states show empty list silently — add a "Something went wrong, pull to refresh" state |
| N10 | `ProviderTabNavigator` | `ProviderFAB` overlaps content on FinancialsTab — hide FAB when not relevant |

---

## 10. Final Verdict

**Overall Readiness Score: 74 / 100**

**Verdict: CONDITIONAL BETA — 4 critical issues must be resolved before provider-facing launch**

### Strengths
The provider app represents a substantial, well-architected build. The core business loop — onboard → list services → get bookings → manage clients → invoice → get paid — is fully wired to real Supabase data from end to end. The CRM (ClientsScreen + ClientDetailScreen), invoicing system, Stripe Connect integration, and scheduling calendar are production-quality. The AI assistant uses real business context, not mock data. The ServiceBlueprintWizard honors provider autonomy with optional AI assistance.

### Blockers Summary
Four issues will cause real provider harm if launched today:
1. **ServicePreviewScreen** shows fake content — providers who carefully configure services will see wrong information in preview
2. **AI chat keyboard bug** — text input hidden on iOS in the AI assistant (the highest-frequency provider tool)
3. **Availability toggle** doesn't work — providers who toggle off are still shown as available to homeowners
4. **SubscriptionScreen** misleads all providers into thinking they have a "Pro" subscription

### Recommended Release Path
1. Fix the 4 critical blockers (~4–6 hours of engineering)
2. Fix H1 (dead resource links) and H3 (job photo upload) before provider marketing
3. Delete orphaned finance screens (H4 — 10 minutes, reduces confusion)
4. Consolidate the 3 policy UIs (H2 — 1–2 hours)
5. Launch to beta providers
6. Address medium-priority items in v1.1 sprint based on provider feedback
