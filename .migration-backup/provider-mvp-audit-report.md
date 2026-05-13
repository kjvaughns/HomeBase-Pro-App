# HomeBase Provider App — MVP Readiness Audit
**Date:** April 14, 2026  
**Scope:** 32 provider and provider-related screens, navigation flows, API wiring, UX patterns  
**Auditor:** Full codebase read — every provider screen file reviewed in full  

---

## Executive Summary

The provider app has a strong functional core. Every major business workflow — sign up → set up profile → list services → receive bookings → manage clients → create invoices → get paid — traces through to real Supabase data. The CRM, scheduling calendar, invoicing system, and Stripe Connect integration are production-grade. The AI assistant uses live business context rather than mock data, and the service wizard correctly makes AI optional.

Four issues will cause real provider harm if launched as-is:
1. **ServicePreviewScreen** shows hardcoded fake intake questions and fake "What's Included" bullets, not the provider's actual service configuration.
2. **ProviderAIAssistantScreen** has a chat keyboard bug — wrong `KeyboardAvoidingView` import means the text input is hidden behind the keyboard on iOS.
3. **Availability toggle** is never persisted to the database — providers who turn off availability remain visible on public listings.
4. **SubscriptionScreen** is a non-functional placeholder that shows all providers as "Pro" regardless of any real subscription state.

**MVP Readiness Score: 7/10 — Conditional Beta. Clear 4 blockers, then launch.**

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

Each screen is evaluated across five dimensions:

| Dimension | What It Means |
|-----------|---------------|
| **End-to-End** | Does the screen complete a real user action from input through the backend and back? |
| **Persistence** | Does all data the user enters actually save to the Supabase database? |
| **Trustworthy** | Would a real provider trust what they see (correct data, no fake placeholders)? |
| **AI Balance** | Is AI assistance optional and clearly labeled, or does it over-reach and assume? |
| **Empowerment** | Does the screen put the provider in control, or does it feel passive or confusing? |

Severity levels:
- **Critical** — launch blocker; real provider harm if shipped as-is
- **High** — should fix before public launch
- **Medium** — target for v1.1
- **Low** — polish / nice-to-have threshold item

---

## 2. Screen-by-Screen Findings

### 2.1 FirstLaunchScreen
`client/screens/onboarding/FirstLaunchScreen.tsx` — 102 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Animated logo reveal → auto-navigates to `AccountTypeSelection` |
| Persistence | N/A | Pure presentation |
| Trustworthy | ✅ Pass | No data displayed |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Clean, fast brand moment |

**No issues.** 102-line file handles the splash animation correctly. `useNativeDriver: false` used for animated values (per project convention).

---

### 2.2 AccountTypeSelectionScreen
`client/screens/onboarding/AccountTypeSelectionScreen.tsx` — 342 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Homeowner card → HomeownerOnboarding; Provider card → ProviderOnboarding. Sets `accountType` in `onboardingStore`. |
| Persistence | ✅ Pass | `onboardingStore.accountType` persisted via Zustand/AsyncStorage |
| Trustworthy | ✅ Pass | Static selection screen; no data to falsify |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Clear two-card split; feature lists communicate value before commitment |

**Finding (Low):** Animated values use `useNativeDriver: false` — correct per project conventions. No issues.

---

### 2.3 ProviderOnboardingScreen (Feature Teaser)
`client/screens/onboarding/ProviderOnboardingScreen.tsx` — 1,656 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | 3-step animated teaser + auth (login/signup) → exits to `ProviderSetupFlow` or `Main` |
| Persistence | ✅ Pass | Creates user account via `POST /api/auth/register`; JWT stored in `authStore` |
| Trustworthy | ✅ Pass | Feature previews are honest representations of real app functionality |
| AI Balance | ✅ Pass | No AI in onboarding |
| Empowerment | ✅ Pass | Login/signup both available; clear CTA progression |

**Finding (Low):** This is a large file (1,656 lines) that combines animated feature teaser, login form, and signup form. Consider splitting into separate components for maintainability, but no functional issues.

---

### 2.4 ProviderSetupFlow (Business Setup Wizard)
`client/screens/onboarding/ProviderSetupFlow.tsx` — 1,877 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | 7 steps → `POST /api/providers` creates provider record → navigates to Main |
| Persistence | ✅ Pass | Business name, category, service area, hours, first service, booking link all written to DB |
| Trustworthy | ✅ Pass | Real slug generated from business name; shown for sharing at end |
| AI Balance | ✅ Pass | No AI in setup flow |
| Empowerment | ⚠️ Partial | 7 steps without skip options; Hours (Step 4) and First Service (Step 5) feel mandatory |

**Finding (Medium):** Steps 4 (Business Hours) and 5 (First Service) should be optional/skippable. New providers may not have these details on hand and abandoning the flow at step 5 of 7 would be frustrating. The `ProviderSetupFlow` duplicate runs similar logic to `ProviderOnboardingScreen`; worth checking whether both are still in use or if one has superseded the other.

---

### 2.5 ProviderHomeScreen (Dashboard)
`client/screens/provider/ProviderHomeScreen.tsx`

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Stats from `/api/provider/:id/stats`; Getting Started checklist evaluates real `providerProfile` |
| Persistence | N/A | Read-only |
| Trustworthy | ✅ Pass | Real revenue MTD, job count, client count, upcoming count |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Quick action buttons; progress checklist with clear next steps |

**Finding (Low):** Bell icon navigates to homeowner `Notifications` screen — no provider-specific notification preferences exist.

---

### 2.6 BusinessHubScreen (Profile Management)
`client/screens/provider/BusinessHubScreen.tsx`

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Reads from `/api/provider/user/:userId`; PATCH to `/api/provider/:id` for all 4 tabs |
| Persistence | ✅ Pass | Profile, area, hours, and policies all write to `providers` table |
| Trustworthy | ✅ Pass | Syncs from server on mount before showing any form values |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Clear 4-tab layout; save confirmation with haptics |

**Finding (High):** `BookingPoliciesScreen` and `BusinessDetailsScreen` are standalone screens that write to the same `bookingPolicies` and `businessHours` fields. Three separate UIs writing to one DB field with different internal field names is a data consistency risk. See Section 7.

---

### 2.7 BookingPoliciesScreen (Standalone — Duplicate)
`client/screens/provider/BookingPoliciesScreen.tsx` — 406 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Reads from `/api/provider/user/:userId` on mount; PATCH to `/api/provider/:id` on save |
| Persistence | ✅ Pass | Writes `bookingPolicies` jsonb field correctly |
| Trustworthy | ⚠️ Partial | Uses field names `cancellationFeePercent` / `depositPercent` while `BusinessDetailsScreen` uses `cancellationFee` / `depositPercent`. Same DB field, different keys. |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ⚠️ Partial | Exists as a second entry point to edit policies that are also in BusinessHubScreen |

**Finding (High):** This screen is a functional duplicate of BusinessHubScreen's Policies tab. The existence of two editing UIs for the same data, with inconsistent field naming, is a maintenance liability. **Recommend:** Remove this screen and update any navigation links to point to `BusinessHub`. See Section 7, Issue H2.

---

### 2.8 BusinessDetailsScreen (Standalone — Duplicate)
`client/screens/provider/BusinessDetailsScreen.tsx` — 643 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Reads/writes business hours and policies; saves via PATCH |
| Persistence | ✅ Pass | Writes to `providers` table |
| Trustworthy | ⚠️ Partial | Third place editing policies; uses `cancellationFee` key (not `cancellationFeePercent`) |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ⚠️ Partial | Another entry point to overlapping data |

**Finding (High):** See `BookingPoliciesScreen` analysis above. This is the third UI editing the same backend fields. **Recommend:** Delete this screen and update navigation to `BusinessHub`. See Section 7, Issue H2.

---

### 2.9 ServicesScreen
`client/screens/provider/ServicesScreen.tsx`

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Loads from `/api/provider/:id/services`; publish/unpublish/delete work |
| Persistence | ✅ Pass | Mutations invalidate query cache after write |
| Trustworthy | ✅ Pass | Only shows services the provider created |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Eye-icon preview per service; FAB adds new service |

**No blockers.**

---

### 2.10 ServiceBlueprintWizardScreen (New Service Wizard)
`client/screens/provider/ServiceBlueprintWizardScreen.tsx`

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | 6 steps → `POST /api/provider/:id/services` → appears in ServicesScreen |
| Persistence | ✅ Pass | Saves name, pricing, intake questions, add-ons, booking mode, ai insight |
| Trustworthy | ✅ Pass | All data entered by provider; AI suggestions shown as optional chips |
| AI Balance | ✅ Pass | AI is lazy-loaded and never auto-runs; "Suggest…" is a secondary link |
| Empowerment | ✅ Pass | Manual entry escape hatch throughout; "Build your service your way" philosophy |

**No blockers.**

---

### 2.11 NewServiceScreen (Edit Service — EditService Route)
`client/screens/provider/NewServiceScreen.tsx` — 1,272 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Full-form editor for existing services; PUT to `/api/provider/services/:id` |
| Persistence | ✅ Pass | All fields including recurring settings, intake questions, add-ons saved |
| Trustworthy | ✅ Pass | Loads existing service data from API on mount |
| AI Balance | ✅ Pass | Recurring pricing AI insight available but optional |
| Empowerment | ✅ Pass | Direct field editing with immediate visual feedback; save + cancel |

**Finding (Low):** This screen is only reachable via `EditService` route (not `NewService`). The wizard handles creation; this handles editing. The navigation naming (`NewServiceScreen` file, `EditService` route) is slightly confusing but doesn't affect functionality.

---

### 2.12 ServicePreviewScreen
`client/screens/provider/ServicePreviewScreen.tsx` — 249 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Navigated to with service params; displays service card |
| Persistence | N/A | Read-only |
| Trustworthy | ❌ FAIL | Lines 119–154: "WHAT'S INCLUDED" shows 3 hardcoded bullets ("Professional service by verified pro", "All materials and equipment included", "Satisfaction guaranteed"). "INTAKE QUESTIONS" shows hardcoded "1. Do you have pets? (Yes/No)" — none of this reads from the actual service configuration |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ❌ FAIL | Provider configures custom intake questions in the wizard, but the preview shows completely wrong hardcoded questions |

**Finding (Critical):** `ServicePreviewParams` type only accepts `{name, category, description, pricingModel, price, duration}`. The `intakeQuestionsJson` and `addOnsJson` fields are never passed to this screen. Fix: extend the params type and render real data. See Section 6, Blocker B1.

---

### 2.13 ServiceSummaryScreen
`client/screens/provider/ServiceSummaryScreen.tsx` — 508 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Fetches real service data from `/api/provider/services/:id` using `useFocusEffect` |
| Persistence | ✅ Pass | Publish/unpublish toggle writes to DB |
| Trustworthy | ✅ Pass | Shows real intake questions, add-ons, booking mode, pricing all from DB |
| AI Balance | ✅ Pass | No AI; shows `ai_pricing_insight` as reference text if present |
| Empowerment | ✅ Pass | Pencil-icon edit navigates to correct step in wizard/edit screen |

**No issues.** This screen correctly displays real service data — contrasting sharply with the preview screen bug.

---

### 2.14 PublicProfileScreen (Provider's Own Public Profile Preview)
`client/screens/provider/PublicProfileScreen.tsx` — 1,101 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | 3-tab view (About/Services/Reviews) fetching from `/api/provider/user/:userId` |
| Persistence | N/A | Read-only preview |
| Trustworthy | ✅ Pass | Loads real profile data: bio, hours, services list, reviews |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | "Preview" banner visible; Share button opens native share sheet for booking URL |

**No issues.** Correctly shows the provider how their public profile looks to homeowners. The previous "preview banner in wrong screen" bug was already fixed prior to this audit.

---

### 2.15 BookingLinkScreen
`client/screens/provider/BookingLinkScreen.tsx`

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | CRUD: create/list/toggle/delete/copy/share all wired to real API |
| Persistence | ✅ Pass | `bookingLinks` table via `/api/providers/:id/booking-links` |
| Trustworthy | ✅ Pass | URLs use `EXPO_PUBLIC_DOMAIN` env var; correct |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Share sheet, copy link, active toggle |

**Finding (Low):** No edit flow for existing links; must delete and recreate.

---

### 2.16 LeadsScreen
`client/screens/provider/LeadsScreen.tsx` — 794 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Accept creates client + job; Decline sets status; both call real API |
| Persistence | ✅ Pass | Accept calls `POST /api/intake-submissions/:id/accept` |
| Trustworthy | ✅ Pass | Real submission data with client name/email/phone from booking form |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Accept modal with date/notes; decline requires no explanation |

**Finding (Medium):** Two separate lists (intake submissions + CRM leads) confuse the visual hierarchy. See Section 8.

---

### 2.17 ScheduleScreen
`client/screens/provider/ScheduleScreen.tsx` — 1,341 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Jobs fetched from real API; status updates write back via PATCH |
| Persistence | ✅ Pass | Status mutations invalidate jobs query |
| Trustworthy | ✅ Pass | Only shows provider's real scheduled jobs |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | List/month toggle; quick status update bottom sheet |

**Finding (Low):** Month calendar stuck at current month — no forward/back navigation.

---

### 2.18 ClientsScreen
`client/screens/provider/ClientsScreen.tsx` — 685 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Real API; search/filter/sort all client-side |
| Persistence | N/A | Read-only list |
| Trustworthy | ✅ Pass | Real LTV, last seen, next appointment |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | 6 filter chips, 4 sort options, search |

**No blockers.**

---

### 2.19 ClientDetailScreen
`client/screens/provider/ClientDetailScreen.tsx` — 1,219 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | 6-tab detail (Overview/Jobs/Invoices/Notes/Home/Messages) all fetch real data |
| Persistence | ✅ Pass | Notes CRUD, job/invoice creation persist |
| Trustworthy | ✅ Pass | All data from real API endpoints |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Quick action row; all tabs actionable |

**Finding (Low):** Home tab empty with no guidance to invite client to link their HomeBase account.

---

### 2.20 AddClientScreen
`client/screens/provider/AddClientScreen.tsx` — 280 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | `POST /api/provider/:id/clients` with all fields |
| Persistence | ✅ Pass | Saved to `clients` table |
| Trustworthy | ✅ Pass | Address autocomplete via Google Places |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | All fields optional except first name; validation in place |

**No issues.**

---

### 2.21 AddJobScreen
`client/screens/provider/AddJobScreen.tsx` — 771 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | `POST /api/jobs` creates job + appointment row |
| Persistence | ✅ Pass | Both `jobs` and `appointments` tables written |
| Trustworthy | ✅ Pass | Real client picker; optional AI pricing suggestion |
| AI Balance | ✅ Pass | "Get AI Price Estimate" is opt-in; can be ignored |
| Empowerment | ⚠️ Partial | Service type picker shows static hardcoded options, not provider's real services |

**Finding (Medium):** Static service options ("General Repair", "Installation" etc.) instead of provider's `provider_custom_services`. See Section 8.

---

### 2.22 ProviderJobDetailScreen
`client/screens/provider/ProviderJobDetailScreen.tsx` — 770 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Status progression, notes, final price all write to API |
| Persistence | ✅ Pass | All mutations invalidate the job query |
| Trustworthy | ✅ Pass | Real job data, real client info |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ⚠️ Partial | Before/after photos captured but never uploaded |

**Finding (High):** `expo-image-picker` captures job photos as local URIs only — no upload endpoint. Photos lost on restart. See Section 7.

---

### 2.23 AddInvoiceScreen
`client/screens/provider/AddInvoiceScreen.tsx` — 1,129 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Multi-line-item form → `POST /api/invoices/create-and-send` |
| Persistence | ✅ Pass | Line items as JSON in `invoices.line_items`; total calculated server-side |
| Trustworthy | ✅ Pass | Real client/job selectors; no fake data |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Multiple line items, due date, notes, optional send toggle |

**No blockers.**

---

### 2.24 InvoiceDetailScreen
`client/screens/provider/InvoiceDetailScreen.tsx` — 884 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Send, Mark Paid, Cancel, Copy Payment Link, Stripe Checkout all wired |
| Persistence | ✅ Pass | Status changes persist; `chargesEnabled` gate prevents broken URLs |
| Trustworthy | ✅ Pass | Real line items with correct totals; `paidAt` date from Stripe webhook |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Full invoice lifecycle; user-friendly error if Stripe not ready |

**No blockers.**

---

### 2.25 StripeConnectScreen
`client/screens/provider/StripeConnectScreen.tsx` — 632 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Full onboarding: creates account → opens Stripe URL → polls status on AppState resume |
| Persistence | ✅ Pass | `stripeConnectAccounts` updated by webhook/polling |
| Trustworthy | ✅ Pass | All 4 status states (not_started/pending/complete/restricted) shown accurately |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Auto-refresh on return from browser; no manual step needed |

**Finding (Low):** Test invoice section (hardcoded "Test Service", "$50.00") should be hidden behind `__DEV__` flag before public launch.

---

### 2.26 FinancialsScreen
`client/screens/provider/FinancialsScreen.tsx` — 1,655 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Revenue stats, invoice list, Stripe payout history from real API |
| Persistence | N/A | Read-only |
| Trustworthy | ✅ Pass | `useFocusEffect` ensures fresh data on tab focus |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Overview/Transactions/More tabs; navigates to InvoiceDetail |

**Finding (High):** `MoneyScreen.tsx`, `FinancesScreen.tsx`, `AccountingScreen.tsx` are dead code not registered in any navigator. See Section 7, Issue H4.

---

### 2.27 CommunicationsScreen
`client/screens/provider/CommunicationsScreen.tsx` — 650 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Individual and broadcast messages sent via real API |
| Persistence | ✅ Pass | Messages stored in `provider_messages` table |
| Trustworthy | ✅ Pass | Rate-limited to prevent spam |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Email/push channel selector; individual vs broadcast |

**Finding (Medium):** Push delivery status not surfaced to provider. See Section 8.

---

### 2.28 SendMessageScreen
`client/screens/provider/SendMessageScreen.tsx` — 437 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Template system, merge variables, blast mode all reach API |
| Persistence | ✅ Pass | Message history visible in ClientDetail Messages tab |
| Trustworthy | ✅ Pass | Merge variables resolve to real data server-side |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ✅ Pass | Template CRUD, channel selection, blast mode with count display |

**Finding (Medium):** Uses `KeyboardAvoidingView` from `react-native` (line 9) instead of `react-native-keyboard-controller`. May cause keyboard overlay on iOS.

---

### 2.29 ReviewsScreen
`client/screens/provider/ReviewsScreen.tsx` — 379 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Fetches from `/api/provider/:id/reviews`; filter by stars works |
| Persistence | N/A | Read-only |
| Trustworthy | ✅ Pass | Real review data from homeowners; star distribution bars |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ⚠️ Partial | View-only; no way to request or respond to reviews |

**Finding (Medium):** No "Request a Review" CTA. See Section 8.

---

### 2.30 ProviderAIAssistantScreen
`client/screens/provider/ProviderAIAssistantScreen.tsx` — 607 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Sends to `/api/ai/provider/chat` with real business context |
| Persistence | N/A | Conversational |
| Trustworthy | ✅ Pass | Context fetches real clients/jobs/invoices/stats; cached per session |
| AI Balance | ✅ Pass | Provider initiates all queries; AI is a tool not a driver |
| Empowerment | ⚠️ Partial | Mic button decorative — tapping does nothing |

**Finding (Critical):** `KeyboardAvoidingView` from `react-native` (line 9) instead of `react-native-keyboard-controller`. Chat input hidden behind keyboard on iOS. See Section 6, Blocker B2.

**Finding (Medium):** Microphone icon animates but `isListening` is never set to `true`. No voice input is wired. Remove the icon or implement voice capture.

---

### 2.31 ProviderMoreScreen
`client/screens/provider/ProviderMoreScreen.tsx` — 442 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ✅ Pass | Logout, delete account, role switch, dark mode all work |
| Persistence | ⚠️ Partial | Availability toggle is local-only — not persisted |
| Trustworthy | ✅ Pass | Real provider name, avatar, category |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ⚠️ Partial | Availability toggle has no actual effect on public listing |

**Finding (Critical):** The availability toggle updates only Zustand state. No PATCH call to backend. See Section 6, Blocker B3.

---

### 2.32 SubscriptionScreen
`client/screens/provider/SubscriptionScreen.tsx` — 177 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ❌ Fail | "Manage" opens App Store subscriptions — no HomeBase subscription there |
| Persistence | ❌ Fail | No subscription state in database |
| Trustworthy | ❌ Fail | All providers shown as "Pro" — not tied to real subscription logic |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ❌ Fail | Provider cannot manage, view, or change anything |

**Finding (Critical):** Non-functional placeholder. See Section 6, Blocker B4.

---

### 2.33 ProviderResourcesScreen
`client/screens/provider/ProviderResourcesScreen.tsx` — 426 lines

| Dimension | Rating | Notes |
|-----------|--------|-------|
| End-to-End | ❌ Fail | All 8 resource links open the same non-existent URL |
| Persistence | N/A | Read-only |
| Trustworthy | ❌ Fail | Every card promises content that does not exist at the destination URL |
| AI Balance | ✅ Pass | No AI |
| Empowerment | ❌ Fail | Provider seeking help or best practices hits a 404 every time |

**Finding (High):** All links point to `https://homebaseproapp.com/faqpage` — a page that doesn't exist. See Section 7, Issue H1.

---

## 3. Empty / Loading / Error State Matrix

| Screen | Loading | Empty | Error |
|--------|---------|-------|-------|
| ProviderHomeScreen | ✅ Per-stat ActivityIndicator | ✅ "0" values + onboarding prompts | ✅ Degrades to 0s |
| ServicesScreen | ✅ ActivityIndicator | ✅ EmptyState + "Add first service" CTA | ⚠️ Shows empty silently |
| BookingLinkScreen | ✅ isLoading spinner | ✅ "No booking links yet" with CTA | ⚠️ No explicit error UI |
| LeadsScreen | ✅ ActivityIndicator at top | ✅ EmptyState per section | ⚠️ Silent empty on error |
| ScheduleScreen | ✅ ActivityIndicator over calendar | ✅ "No jobs on this day" | ⚠️ Silent empty on error |
| ClientsScreen | ✅ isLoading guard | ✅ EmptyState + "Add first client" | ⚠️ Silent empty on error |
| ClientDetailScreen | ✅ Per-tab ActivityIndicator | ✅ Empty state per tab | ⚠️ Tab errors silent |
| AddJobScreen | ✅ Client list isLoading | ✅ "No clients yet" message | ✅ Submit error in Alert |
| ProviderJobDetailScreen | ✅ ActivityIndicator on load | N/A (navigated with ID) | ✅ Error message if fetch fails |
| AddInvoiceScreen | ✅ Client/job pickers show loading | ✅ Handles empty pickers | ✅ Errors in Alert |
| InvoiceDetailScreen | ✅ ActivityIndicator on load | N/A (navigated with ID) | ✅ chargesEnabled gate shows message |
| FinancialsScreen | ✅ Per-section ActivityIndicator | ✅ EmptyState per tab | ⚠️ Stripe errors silently show "not connected" |
| StripeConnectScreen | ✅ loadingStatus spinner | ✅ Clear CTA when not connected | ✅ All 4 status states handled |
| CommunicationsScreen | ✅ ActivityIndicator on client list | ✅ "No clients yet" | ⚠️ Send error in Alert only |
| ReviewsScreen | ✅ isLoading guard | ✅ "No reviews yet" per filter | ⚠️ Fetch error shows empty list |
| ProviderAIAssistantScreen | ✅ Animated dots during AI call | ✅ Quick-prompt chips on empty chat | ✅ Error shown as assistant message |
| ServicePreviewScreen | N/A (no async) | N/A (passed via params) | N/A |
| ServiceSummaryScreen | ✅ ActivityIndicator + useFocusEffect | N/A (navigated with ID) | ⚠️ Silent on fetch error |
| PublicProfileScreen | ✅ ActivityIndicator per tab | ✅ Per-tab empty states | ⚠️ Degrades silently |
| ProviderMoreScreen | N/A (static + local state) | N/A | ✅ Delete account error logged |
| SubscriptionScreen | N/A (no fetching) | N/A | N/A |
| ProviderResourcesScreen | N/A (static) | N/A | N/A |

**Summary:** Loading and empty states are consistently handled. The common gap is **error state display** — most screens show an empty list when an API call fails, rather than an explicit "something went wrong, pull to refresh" message. This is acceptable for MVP but should be addressed in v1.1 for all screens currently rated ⚠️.

---

## 4. End-to-End Workflow Audit

### Workflow A: New Provider Registration to Dashboard
**Path:** FirstLaunchScreen → AccountTypeSelection → ProviderOnboarding (auth + 3-step teaser) → ProviderSetupFlow (7 steps) → ProviderHomeScreen

**Status: ✅ Passes end-to-end**

`POST /api/auth/register` creates user. `POST /api/providers` creates provider record. `authStore.providerProfile` populated. `onboardingStore.hasCompletedProviderSetup = true`. ProviderHomeScreen Getting Started checklist correctly reflects new provider's incomplete state.

**Gap:** A returning provider whose `providers` record was not created (partial signup) may be stuck. The `activateProviderMode()` fallback exists but the UX path is unclear.

---

### Workflow B: Service Creation → Public Booking → Lead Acceptance → Job
**Path:** ServiceBlueprintWizardScreen (6 steps) → Publish → BookingLinkScreen (create + share) → Homeowner submits via `/book/:slug` → LeadsScreen → Accept modal → Job in ScheduleScreen

**Status: ✅ Passes end-to-end**

Wizard saves `intake_questions_json`, `add_ons_json`, `booking_mode` to `provider_custom_services`. Public page at `/book/:slug` renders intake questions and adapts CTA per booking mode. `POST /api/intake-submissions/:id/accept` creates `clients` (upsert by email) + `jobs`. Job appears in ScheduleScreen as `confirmed`.

**Gap (Critical):** `ServicePreviewScreen` shows hardcoded content instead of the actual service — the preview step in the wizard is deceptive. Fix required before launch.

**Gap:** If `instantBooking: true`, auto-conversion creates client+job at submission time but provider is not notified in real-time. They must manually refresh.

---

### Workflow C: Job Completion → Invoice → Payment
**Path:** ProviderJobDetailScreen (advance to `completed`) → AddInvoiceScreen → Send Invoice → Client pays via Stripe Checkout → InvoiceDetailScreen shows `paid`

**Status: ✅ Passes end-to-end**

Job status progression writes correctly via PATCH. Invoice line items saved. Stripe Checkout URL guarded by `chargesEnabled` with user-friendly error. `paidAt` timestamp set by Stripe webhook. InvoiceDetailScreen shows paid status and date.

**Gap:** Provider must manually check InvoiceDetailScreen for payment — no push notification when a payment lands.

---

### Workflow D: Provider Manages Client CRM
**Path:** AddClientScreen → ClientsScreen → ClientDetailScreen (6 tabs)

**Status: ✅ Passes end-to-end**

All 6 tabs in ClientDetailScreen load real data. Notes CRUD works. Message compose sends via blast or individual API. LTV, outstanding balance, and next appointment computed correctly.

**Gap:** Home tab empty unless homeowner linked their HomeBase account. No mechanism to invite a client to link from within the provider CRM.

---

### Workflow E: Stripe Connect Onboarding → Payouts
**Path:** StripeConnectScreen → Stripe browser onboarding → return to app → charges enabled → invoice paid → payout received

**Status: ✅ Passes end-to-end**

AppState listener refreshes Connect status on return from browser. Platform fee of 3% defaults throughout invoice creation. Payout history shown in FinancialsScreen via `/api/stripe/payouts`. `chargesEnabled` gate prevents broken payment links.

**Gap:** No "trigger payout" UI — providers wait for Stripe's automatic schedule. This is by Stripe design but is not explained in the UI.

---

## 5. Missing MVP Requirements

| # | Requirement | Status | Provider Impact |
|---|-------------|--------|-----------------|
| M1 | Availability toggle persists to backend | ❌ Missing | Providers who turn off are still shown as available on public listings |
| M2 | ServicePreviewScreen shows real service content | ❌ Wrong data | Preview shows fake hardcoded questions/includes instead of provider's configured data |
| M3 | Subscription state is real | ❌ Placeholder | All providers shown as "Pro" with no subscription check |
| M4 | AI chat keyboard works on iOS | ❌ Bug | Text input can be hidden behind software keyboard |
| M5 | Resource links are not dead | ❌ All 404 | All 8 help resources link to a non-existent page |
| M6 | Job photos are durable | ❌ Local URI only | Before/after photos lost on app restart; never stored in DB |
| M7 | Single source of truth for policies | ❌ 3 UIs, 1 field | BookingPoliciesScreen, BusinessDetailsScreen, and BusinessHubScreen all write to same field with different key names |

---

## 6. Critical Blockers

### B1 — ServicePreviewScreen: Hardcoded Fake Content
**File:** `client/screens/provider/ServicePreviewScreen.tsx`, lines 119–154  
**Problem:** "WHAT'S INCLUDED" shows 3 hardcoded bullets. "INTAKE QUESTIONS" always shows "Do you have pets?" — completely ignoring the provider's actual wizard-configured data.  
**Fix:** Extend `ServicePreviewParams` to include `intakeQuestionsJson` and `addOnsJson`. Pass these from `ServicesScreen` and `ServiceBlueprintWizardScreen`. Render parsed JSON instead of hardcoded strings.  
**Effort:** ~2 hours

### B2 — ProviderAIAssistantScreen: Wrong KeyboardAvoidingView
**File:** `client/screens/provider/ProviderAIAssistantScreen.tsx`, line 9  
**Problem:** `KeyboardAvoidingView` imported from `react-native`. Project guidelines require `react-native-keyboard-controller` for all chat screens. Input obscured by keyboard on iOS.  
**Fix:** `import { KeyboardAvoidingView } from 'react-native-keyboard-controller'` with `behavior="padding"` and `keyboardVerticalOffset={0}`.  
**Effort:** ~15 minutes

### B3 — Availability Toggle Never Persisted
**Files:** `ProviderMoreScreen.tsx`, `BusinessHubScreen.tsx`, `state/providerStore.ts`  
**Problem:** `setAvailableForWork(value)` only updates in-memory Zustand. No PATCH to `providers` table. Public listing ignores the toggle. State lost on restart.  
**Fix:** Add `PATCH /api/provider/:id` call with `{ isAvailable: value }` in both toggle handlers. Initialize from `providerProfile.isActive` on mount.  
**Effort:** ~1 hour

### B4 — SubscriptionScreen: Non-Functional Placeholder
**File:** `client/screens/provider/SubscriptionScreen.tsx`  
**Problem:** "Pro" badge shown to all providers. `isFree` check uses `completedJobs === 0` (not a subscription check). "Manage" button opens App Store but no HomeBase subscription exists there.  
**Fix (MVP minimum):** Add "Coming Soon" label and disable the Manage button. Optionally integrate RevenueCat `Purchases.getCustomerInfo()` for real entitlement checks.  
**Effort:** ~30 minutes ("Coming Soon" label); ~1 day (full RevenueCat integration)

---

## 7. High Priority Issues

### H1 — All Resource Links Dead
**File:** `ProviderResourcesScreen.tsx`  
All 8 resource cards link to `https://homebaseproapp.com/faqpage` — page does not exist. Replace external links with inline modal content, or create actual pages at these URLs before launch.

### H2 — Three Duplicate Policy UIs with Inconsistent Field Names
**Files:** `BusinessHubScreen.tsx`, `BookingPoliciesScreen.tsx`, `BusinessDetailsScreen.tsx`  
All three write to `providers.bookingPolicies`. `BookingPoliciesScreen` uses `cancellationFeePercent`; `BusinessDetailsScreen` uses `cancellationFee`; `BusinessHubScreen` uses `cancellationFeePercent`. Data saved from one screen may be ignored or misread by another.  
**Fix:** Delete `BookingPoliciesScreen` and `BusinessDetailsScreen` as standalone screens. Update any navigation links to point to `BusinessHub`. Standardize field key names in BusinessHubScreen.

### H3 — Job Photos Lost on Restart
**File:** `ProviderJobDetailScreen.tsx`  
Photos captured via image picker stored as local URI strings. No upload endpoint. Lost on app restart; not shared with homeowner.  
**Fix:** Create `POST /api/jobs/:id/photos` with multipart form data upload to Supabase Storage. Display uploaded photo URLs, not local URIs.

### H4 — Orphaned Finance Screens (Dead Code)
**Files:** `MoneyScreen.tsx`, `FinancesScreen.tsx`, `AccountingScreen.tsx`  
Not registered in any navigator. Older iterations of the financial flow.  
**Fix:** Delete all three files to reduce maintenance confusion.

---

## 8. Medium Priority Issues

| # | Screen | Issue |
|---|--------|-------|
| Mid1 | `ProviderAIAssistantScreen` | Mic button is decorative — `isListening` never becomes `true`. Remove or implement voice input. |
| Mid2 | `SendMessageScreen` | `KeyboardAvoidingView` from `react-native` instead of `react-native-keyboard-controller`. May cause keyboard overlay. |
| Mid3 | `ReviewsScreen` | No "Request a Review" CTA. Add a button that pre-fills SendMessageScreen with a review-request template. |
| Mid4 | `LeadsScreen` | Two separate lists (intake submissions + CRM leads) is confusing. Unify with a source badge. |
| Mid5 | `AddJobScreen` | Service type picker shows hardcoded generic options instead of provider's real `provider_custom_services`. |
| Mid6 | `CommunicationsScreen` | Push delivery status not surfaced — provider cannot tell if a push notification was actually delivered. |
| Mid7 | `ScheduleScreen` | Month calendar has no forward/back month navigation — stuck on current month. |

---

## 9. Nice-to-Have Improvements

| # | Screen | Suggestion |
|---|--------|------------|
| N1 | `ProviderSetupFlow` | Make Steps 4 (Hours) and 5 (First Service) skippable to reduce first-day friction |
| N2 | `BookingLinkScreen` | Add edit flow for existing links (currently delete + recreate) |
| N3 | `ClientDetailScreen` | "Invite to link home" prompt on empty Home tab |
| N4 | `StripeConnectScreen` | Hide test invoice section behind `__DEV__` flag |
| N5 | `ProviderHomeScreen` | Bell icon should navigate to provider-specific notifications, not homeowner screen |
| N6 | `ScheduleScreen` | Group jobs with no `scheduledDate` into an "Unscheduled" section |
| N7 | `ClientsScreen` | Add avatar/photo upload for client records |
| N8 | All screens with ⚠️ in error column | Replace silent empty-list-on-error with "Something went wrong, pull to refresh" state |
| N9 | `ProviderTabNavigator` | `ProviderFAB` overlaps content on FinancialsTab — hide when not relevant |
| N10 | `ProviderOnboardingScreen` | Split 1,656-line file into separate teaser, login, and signup components |

---

## 10. Final Verdict

**MVP Readiness Score: 7 / 10**

**Verdict: CONDITIONAL BETA — 4 critical blockers must be resolved before provider-facing launch**

### What Works Well
The core provider business loop is fully functional end-to-end. Every key workflow (setup → services → bookings → clients → jobs → invoices → payments) traces through to real Supabase data. The CRM, scheduling calendar, invoicing system, Stripe Connect integration, and AI assistant (with real business context) are production-grade. The service wizard correctly makes AI optional and empowers providers to build services their way. No screens use mock data in their primary data paths.

### What Needs Fixing
Four issues will cause real provider harm at launch:
1. **ServicePreviewScreen fake content** — providers who configure custom services will see wrong information in preview — destroys their trust in the wizard
2. **AI assistant keyboard bug** — the primary provider tool is unusable with the keyboard open on iOS
3. **Availability toggle broken** — providers who mark themselves unavailable remain visible to homeowners
4. **Subscription screen misleads** — all providers appear "Pro" with no real subscription check

### Recommended Delivery Path
1. Fix B1–B4 (estimated ~4–6 hours total)
2. Fix H1 (dead resource links) — 1–2 hours or inline modal approach
3. Delete orphaned finance screens (H4) — 10 minutes
4. Consolidate 3 policy UIs to 1 (H2) — 1–2 hours
5. **Beta launch to providers**
6. Address Medium-priority issues in v1.1 sprint based on real provider feedback

At current state with only the 4 blockers fixed, this is a **solid, trustworthy provider tool** that delivers on its core promise.
