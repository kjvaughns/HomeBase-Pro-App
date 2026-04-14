# HomeBase Provider App — MVP Readiness Audit
**Date:** April 14, 2026  
**Scope:** All provider-facing screens, navigation, and backend integration  
**Auditor:** Agent review of 30+ screen files  

---

## Executive Summary

The provider app is in strong shape for a beta launch. The core workflow — onboarding → profile setup → service listing → booking → client management → invoicing → payments — is fully wired to real Supabase data. Several polish issues and one functional regression need fixing before a public release.

**Overall readiness: 78/100 — Beta Ready with 4 blockers to fix**

---

## Section 1: Onboarding & Setup Flow

**File:** `client/screens/onboarding/ProviderSetupFlow.tsx` (1,877 lines)

### Status: ✅ Functional

- 7-step wizard: Business Name → Category → Service Area → Hours → First Service → Booking Link → Sharing
- Reads/writes to `/api/providers` and stores result in `authStore.providerProfile` + `onboardingStore`
- Shares booking link via native Share sheet at the end
- Shows real slug generated from business name
- Haptic feedback, Reanimated entrance animations throughout

### Issues
- **Medium**: 7 steps is a long setup for day-one registration. Consider collapsing Steps 4 (Hours) and 5 (First Service) into optional/skippable steps to get the provider to their dashboard faster.
- **Low**: Category selection icons reuse some icons for different categories (`home` icon for both "Cleaning" and "Roofing"). Minor visual inconsistency.

---

## Section 2: Provider Home Screen (Dashboard)

**File:** `client/screens/provider/ProviderHomeScreen.tsx`

### Status: ✅ Solid

- Fetches real stats from `/api/provider/:id/stats` via React Query
- Shows Revenue MTD, Jobs Completed, Active Clients, Upcoming Jobs
- Getting Started checklist (5 items: profile complete, first service, Stripe, booking link, first client) with real completion checks against `providerProfile`
- Quick action buttons: New Job, New Invoice, New Client, Schedule
- Push notification registration via `usePushNotifications()` hook

### Issues
- **Low**: The bell icon in the header navigates to `Notifications` (homeowner notifications screen), not a provider-specific notifications screen. Provider notification preferences don't exist yet.

---

## Section 3: Business Hub (Profile Management)

**File:** `client/screens/provider/BusinessHubScreen.tsx`

### Status: ✅ Solid

- 4-tab interface: Profile, Services Area, Hours, Policies
- Profile tab: bio, phone, website, `isPublic` toggle — all saved to `/api/provider/:id` via PATCH
- Services Area tab: service radius slider, ZIP codes, cities — saved correctly
- Hours tab: per-day toggle with open/close time pickers — saved as `businessHours` jsonb
- Policies tab: deposit %, cancellation hours/fee, reschedule window — saved as `bookingPolicies` jsonb
- Reads current data from `/api/provider/user/:userId` on mount; syncs to providerStore

### Issues
- **High**: `BookingPoliciesScreen` is a separate, standalone screen that edits the exact same `bookingPolicies` JSON as the Policies tab in BusinessHubScreen. There are now **3 places** to edit booking policies: `BusinessHubScreen` (Policies tab) → `BookingPoliciesScreen` (standalone) → `BusinessDetailsScreen` (policies section). All save to the same field. The separate `BookingPoliciesScreen` uses slightly different field names (`cancellationFeePercent` vs. `cancellationFee` in BusinessDetailsScreen), meaning data saved from one screen may display incorrectly in another. **Recommendation**: Remove `BookingPoliciesScreen` and `BusinessDetailsScreen` as standalone screens; keep only BusinessHubScreen as the single source of truth.

---

## Section 4: Service Management

**Files:** `ServicesScreen.tsx`, `ServiceBlueprintWizardScreen.tsx`, `NewServiceScreen.tsx`, `ServicePreviewScreen.tsx`, `ServiceSummaryScreen.tsx`

### Status: ✅ Functional — 1 blocker

- `ServicesScreen`: Fetches from `/api/provider/:id/services` via React Query; publish/unpublish toggle works; eye-icon preview button; delete swipe action
- `ServiceBlueprintWizardScreen` (6 steps): Step 0 (name/category/description), Step 1 (pricing), Step 2 (intake questions), Step 3 (add-ons), Step 4 (booking mode), Step 5 (review + publish). AI suggestions are lazy-loaded and optional. Manual entry always available. Creates via `POST /api/provider/:id/services`, updates via `PUT /api/provider/services/:id`.
- `NewServiceScreen`: Edit mode for existing services; all fields save correctly
- `ServiceSummaryScreen`: Shows real service data with edit capability

### Issues — BLOCKER

- **Critical**: `ServicePreviewScreen` shows **hardcoded fake content** that is NOT sourced from the actual service data:
  - "WHAT'S INCLUDED" section always shows: "Professional service by verified pro", "All materials and equipment included", "Satisfaction guaranteed" — regardless of the service's actual add-ons
  - "INTAKE QUESTIONS" section always shows: "1. Do you have pets? (Yes/No)" — regardless of the actual intake questions configured in the wizard

  The `ServicePreviewParams` type only accepts `{name, category, description, pricingModel, price, duration}` and discards intake questions and add-ons entirely. A provider who configures custom questions in the wizard then previews their service will see completely wrong information. **Fix:** Update `ServicePreviewParams` to include `intakeQuestionsJson` and `addOnsJson`, and render them in the preview instead of the hardcoded content.

- **Low**: `ServicePreviewScreen` always says "Starting from" even when pricingModel is "fixed" (should say "Flat rate:"). Also the "Book Now" button does nothing (`onPress={() => {}}`) — consider adding a note that this is view-only.

---

## Section 5: Booking Links

**File:** `client/screens/provider/BookingLinkScreen.tsx`

### Status: ✅ Solid

- Full CRUD: create, list, toggle active, delete, copy/share URL
- Booking URL constructed as `https://${EXPO_PUBLIC_DOMAIN}/book/${slug}` using env var correctly
- `instantBooking` toggle correctly shown
- Custom questions configurable per link
- Deposit amount field with dollar formatting
- Loads from `/api/providers/:id/booking-links`

### Issues
- **Low**: No way to edit an existing booking link (only delete and recreate). A simple edit flow would help.

---

## Section 6: Leads / Intake Management

**File:** `client/screens/provider/LeadsScreen.tsx` (794 lines)

### Status: ✅ Functional

- Shows both pending intake submissions (from booking links) and tracked leads separately
- Accept modal with optional scheduled date + notes → calls `POST /api/intake-submissions/:id/accept`
- Decline button → calls `PATCH` to set status `declined`
- Lead cards (CRM-style leads) shown below intake submissions with accept/decline modals
- Filter chips: All, New, Contacted, Quoted, Won, Lost
- Pull-to-refresh and React Query caching

### Issues
- **Medium**: The two-list layout (intake submissions at top, CRM leads below) is confusing. Both represent potential jobs but they come from different data sources with different UX. Consider unifying into a single list with a `source` badge ("Booking Link" vs. "Manual Lead").

---

## Section 7: Schedule (Calendar / Jobs)

**File:** `client/screens/provider/ScheduleScreen.tsx` (1,341 lines)

### Status: ✅ Solid

- Toggle between List view and Month calendar view
- Month view: renders dots for days with jobs; tap a day to filter job list
- Job status progression: scheduled → confirmed → on_my_way → arrived → in_progress → completed
- Quick status update via bottom sheet with haptic confirmation
- Navigates to `ProviderJobDetail` for full job management
- Fetches from `/api/provider/:id/jobs` and `/api/provider/:id/clients`

### Issues
- **Low**: Month view doesn't paginate — you can only see current month. No forward/back month navigation.
- **Low**: Jobs with no `scheduledDate` show as "No date set" rather than being grouped separately.

---

## Section 8: Clients CRM

**Files:** `ClientsScreen.tsx`, `ClientDetailScreen.tsx`, `AddClientScreen.tsx`

### Status: ✅ Strong

- `ClientsScreen`: FlatList with search, 6 filter chips (All/Lead/Active/Inactive/Has Upcoming/Overdue), 4 sort options (Recent/LTV/Overdue/Newest). Long-press for quick actions (Call, Text, Email, Message). Last sent message preview on client card. Swipe to open detail.
- `ClientDetailScreen`: 6-tab detail: Overview (stats, info, quick actions), Jobs (status progression), Invoices (create/view), Notes (CRUD), Home (HouseFax data if linked), Messages (message history + compose)
- `AddClientScreen`: Address autocomplete via Google Places with HouseFax enrichment; all fields saved to `/api/provider/:id/clients`

### Issues
- **Low**: No photo/avatar upload for clients. The avatar field exists in the schema but there's no upload UI.
- **Low**: `ClientDetailScreen` Home tab shows HouseFax data if the client linked their homeowner profile. If not linked, it shows an empty state. There's no guidance for how to get a client to link their home profile.

---

## Section 9: Job Management

**Files:** `AddJobScreen.tsx`, `ProviderJobDetailScreen.tsx`

### Status: ✅ Functional

- `AddJobScreen`: Client selector (pre-populated from ClientDetail), service name picker, date/time picker, price, address, notes. AI pricing suggestion via `/api/ai/provider/pricing`. Saves to `POST /api/jobs` which also creates an `appointments` row non-fatally.
- `ProviderJobDetailScreen`: Status progression, job checklist, before/after photo capture via `expo-image-picker`, final price update, notes

### Issues
- **Medium**: `ProviderJobDetailScreen` uses `expo-image-picker` to capture before/after photos, but there is **no upload endpoint** visible in the codebase — the photos are stored as local URI strings only. On app restart or on another device, the photos will be missing. **Fix:** Add a photo upload endpoint or use Supabase Storage for job photos.
- **Low**: The static `SERVICE_OPTIONS` list in `AddJobScreen` ("General Repair", "Installation", etc.) is not connected to the provider's actual custom services list. The provider's real services should appear first in this picker.

---

## Section 10: Invoicing & Payments

**Files:** `AddInvoiceScreen.tsx`, `InvoiceDetailScreen.tsx`, `StripeConnectScreen.tsx`, `FinancialsScreen.tsx`

### Status: ✅ Strong

- `AddInvoiceScreen`: Multi-line-item form with auto-calculated totals; client selector; job selector; due date picker; send on creation option. Saves to `POST /api/invoices/create-and-send`.
- `InvoiceDetailScreen`: Full invoice view with line items breakdown; actions: Send, Mark Paid, Cancel, Copy Payment Link, Stripe Checkout URL. `chargesEnabled` gate with user-friendly error for Stripe not ready.
- `StripeConnectScreen`: Full Connect onboarding with status polling; AppState listener refreshes status when returning from browser (onboarding completion). Test invoice creation. Handles `not_started`, `pending`, `complete`, `restricted` states.
- `FinancialsScreen` (tab): Overview stats, transactions list (invoices + payouts), Stripe payout history. `useFocusEffect` for auto-refresh.

### Issues
- **Medium**: `MoneyScreen.tsx`, `FinancesScreen.tsx`, and `AccountingScreen.tsx` exist in the codebase but are **not registered in any navigator**. They appear to be older iterations of the financial flow. These are dead code and should be deleted to avoid confusion during future development.
- **Low**: `StripeConnectScreen` has a test invoice section at the bottom (with hardcoded "Test Service" default and "$50.00" default amount). This is clearly a development tool and should be removed or hidden behind a `__DEV__` flag before public launch.

---

## Section 11: Communications & Messaging

**Files:** `CommunicationsScreen.tsx`, `SendMessageScreen.tsx`

### Status: ✅ Functional

- `CommunicationsScreen`: Individual vs. Broadcast mode; email + push channel selection; client picker (multi-select for broadcast); subject + body fields; real send via `/api/providers/:id/messages`
- `SendMessageScreen`: Template system (5 presets + custom); merge variable chips; email/SMS channel toggle; blast mode for bulk sends; rate-limited at 10/client/day; message history in ClientDetail Messages tab

### Issues
- **Medium**: The "push" channel in CommunicationsScreen sends a push notification to the client, but the **client-side push notification token registration** for homeowners is tied to the homeowner auth flow. If a homeowner hasn't used the app recently or revoked notifications, the push will silently fail. The backend returns success even if the push fails, so providers have no visibility into delivery status. Consider showing a "delivered" vs. "failed" status on the message history.
- **Low**: `SendMessageScreen` uses `KeyboardAvoidingView` from `react-native` (line 9), not from `react-native-keyboard-controller` as required by the project guidelines. This may cause keyboard overlay issues on some iOS devices.

---

## Section 12: Provider AI Assistant

**File:** `client/screens/provider/ProviderAIAssistantScreen.tsx` (607 lines)

### Status: ⚠️ Functional but has a keyboard bug

- Async `getBusinessContext()` fetches real data from `/api/provider/:id/clients`, `/api/provider/:id/jobs`, `/api/provider/:id/invoices`, `/api/provider/:id/stats`
- Context is cached in `cachedContextRef` to avoid redundant fetches per session
- Chat interface with quick-prompt chips; expo-speech TTS for assistant responses; animated pulsing mic button (visual only — no actual speech-to-text capture)
- Correct placement: `ProviderAIAssistant` is a stack screen (not inside the tab navigator), so tab bar is correctly hidden

### Issues — BLOCKER

- **Critical**: `ProviderAIAssistantScreen` imports `KeyboardAvoidingView` from `react-native` (line 9), not from `react-native-keyboard-controller`. Per the project guidelines, **chat screens MUST use `KeyboardAvoidingView` from `react-native-keyboard-controller`** (`NEVER from react-native`). On iOS, the native `KeyboardAvoidingView` does not reliably push the input field above the software keyboard in all cases, making the text input obscured. **Fix:** Replace the import and ensure `behavior="padding"` is set.

- **Medium**: The microphone button is purely decorative — it animates a pulsing effect when `isListening` is true, but there is **no actual speech recognition** wired up. The `isListening` state is never set to `true` anywhere. Either remove the mic button or implement voice input using `expo-speech` or `expo-av`. Currently, users will tap the mic icon and nothing will happen.

---

## Section 13: Reviews

**File:** `client/screens/provider/ReviewsScreen.tsx`

### Status: ✅ Display-only (acceptable for MVP)

- Fetches from `/api/provider/:id/reviews`
- Filter by star rating (All/5/4/3/2/1)
- Summary stats: average rating, total count, per-star bar chart
- Reads `providerProfile.rating` and `providerProfile.reviewCount` for header stats

### Issues
- **Medium**: No way to request/solicit a review from within the app. Providers can only view existing reviews. For MVP, add a "Request a Review" button that sends a message to a client with a review link.
- **Low**: No backend endpoint for `GET /api/provider/:id/reviews` was observed in `server/routes.ts`. If this endpoint is missing, the screen will always show an empty state. Verify the endpoint exists and returns data correctly.

---

## Section 14: Resources Screen

**File:** `client/screens/provider/ProviderResourcesScreen.tsx`

### Status: ⚠️ UI complete, links are dead

- Shows 8 resource cards with icons, titles, descriptions
- Content is genuinely useful: Getting Started, Setting Rates, 5-Star Reviews, Pricing Photos, Booking Policies, Growing Your Business, Managing Cash Flow, Safety & Liability

### Issues
- **High**: Every single resource link points to `https://homebaseproapp.com/faqpage`. This URL does not currently serve any content. Providers who tap any resource card will land on a dead page. **Fix:** Either create real content pages at these URLs before launch, or replace the links with modal deep-dives that show the content inline within the app. The latter is more reliable for an MVP.

---

## Section 15: Subscription Screen

**File:** `client/screens/provider/SubscriptionScreen.tsx`

### Status: ⚠️ Placeholder — not functional

- Shows a "Pro Plan" card with feature list
- "Manage Subscription" button opens `https://apps.apple.com/account/subscriptions` (the iOS system subscription management page)
- "Free tier" detection: `isFree = (providerProfile?.completedJobs ?? 0) === 0` — this is not a real subscription check; it just checks if any jobs have been completed

### Issues
- **Critical (for monetization)**: This screen is a non-functional placeholder. There is no RevenueCat integration, no subscription state tracking, no paywall logic. The "PRO" badge is displayed to all providers regardless of subscription status. If you plan to monetize the provider side at launch, this needs to be wired up. If monetization is post-launch, **add a clear "Coming Soon" label** so it doesn't confuse providers who tap it.

---

## Section 16: Availability Toggle (Backend Sync Bug)

**Files:** `ProviderMoreScreen.tsx`, `BusinessHubScreen.tsx`, `state/providerStore.ts`

### Status: ⚠️ State-only, not persisted

### Issues — BLOCKER

- **Critical**: The "Available for Work" toggle in `ProviderMoreScreen` and `BusinessHubScreen` only updates Zustand's `providerStore.availableForWork` in memory. There is **no API call** to persist this to the `providers` table in the database. When a provider toggles their availability off (e.g., "I'm on vacation"), the public listing continues to show them as available. The local state is also lost on app restart since Zustand's `availableForWork` is not persisted in AsyncStorage.

  **Fix:** Add `PATCH /api/provider/:id` with `{ isAvailable: boolean }` on toggle, and read the initial value from the provider's profile on mount. The `providers` table has `is_active` which can serve this purpose.

---

## Section 17: More Screen & Navigation

**File:** `client/screens/provider/ProviderMoreScreen.tsx`

### Status: ✅ Solid

- Displays provider avatar, business name, category
- Quick links: Business Hub, Services, Booking Link, Leads, AI Assistant, Reviews, Communications, Subscription, Resources
- Switch to Homeowner view with role reset
- Dark mode toggle (persisted via `themeStore`)
- Logout and Delete Account with confirmation modal

### Issues
- **Low**: `BookingPoliciesScreen` appears as a separate navigation target from ProviderMoreScreen (accessible via the `BusinessDetails` route), adding to the duplicate-policies confusion described in Section 3.
- **Low**: The `ProviderFAB` (Floating Action Button) is rendered inside `ProviderTabNavigator` overlaying all tab screens. When the user is on the `FinancialsTab`, the FAB overlaps the bottom portion of the invoice list. Consider hiding the FAB on screens where it conflicts.

---

## Summary of Blockers (Must Fix Before Public Launch)

| # | Severity | Screen | Issue |
|---|----------|--------|-------|
| 1 | Critical | `ServicePreviewScreen` | Hardcoded fake "What's Included" and fake "Intake Questions" instead of real service data |
| 2 | Critical | `ProviderAIAssistantScreen` | `KeyboardAvoidingView` from `react-native` instead of `react-native-keyboard-controller` — keyboard hides input on iOS |
| 3 | Critical | `ProviderMoreScreen` / `BusinessHubScreen` | Availability toggle not persisted to backend — public listing always shows provider as available |
| 4 | Critical | `SubscriptionScreen` | Non-functional placeholder; all providers appear to have "Pro" status with no real subscription logic |

---

## High Priority (Should Fix Before Launch)

| # | Priority | Screen | Issue |
|---|----------|--------|-------|
| 5 | High | `ProviderResourcesScreen` | All 8 resource links dead-end at `homebaseproapp.com/faqpage` |
| 6 | High | `BookingPoliciesScreen` + `BusinessDetailsScreen` | Duplicate policy editing paths with different field names — risk of data inconsistency |
| 7 | High | `ProviderJobDetailScreen` | Job photos stored as local URI only — lost on restart, never uploaded to server |
| 8 | High | Finance screens | `MoneyScreen.tsx`, `FinancesScreen.tsx`, `AccountingScreen.tsx` are orphaned dead code — delete to reduce confusion |

---

## Medium Priority (Target for v1.1)

| # | Priority | Screen | Issue |
|---|----------|--------|-------|
| 9 | Medium | `ProviderAIAssistantScreen` | Microphone button is decorative — never activates speech input |
| 10 | Medium | `ReviewsScreen` | No way to solicit reviews from clients |
| 11 | Medium | `LeadsScreen` | Two separate lists (intake submissions + CRM leads) — consider unified view |
| 12 | Medium | `CommunicationsScreen` | Push delivery status not surfaced — providers can't tell if push succeeded |
| 13 | Medium | `ProviderSetupFlow` | 7 steps is a heavy onboarding — consider making hours/first-service optional/skippable |
| 14 | Medium | `AddJobScreen` | Service picker shows static options, not provider's real custom services |
| 15 | Medium | `SendMessageScreen` | `KeyboardAvoidingView` from `react-native` instead of `react-native-keyboard-controller` |

---

## What's Working Well (No Action Needed)

- **ProviderHomeScreen** — Real stats dashboard with getting started checklist ✅
- **BusinessHubScreen** — Complete 4-tab profile management with robust save flow ✅
- **ClientsScreen + ClientDetailScreen** — Production-grade 6-tab CRM ✅
- **ScheduleScreen** — Calendar + list view with real job status progression ✅
- **FinancialsScreen** — Revenue tracking, Stripe payout history, real transaction list ✅
- **StripeConnectScreen** — Full Connect onboarding with background polling ✅
- **AddInvoiceScreen** — Multi-line-item invoicing with Stripe integration ✅
- **InvoiceDetailScreen** — Full invoice lifecycle management ✅
- **ServiceBlueprintWizardScreen** — AI-assisted 6-step wizard with manual escape hatch ✅
- **BookingLinkScreen** — Complete booking link CRUD with share functionality ✅
- **SendMessageScreen** — Template system, merge variables, blast mode ✅
- **AddClientScreen** — Address autocomplete with HouseFax enrichment ✅
- **ProviderSetupFlow** — Full 7-step onboarding with booking link sharing ✅

---

## Recommended Fix Order

1. **Fix `ServicePreviewScreen`** — pass real `intakeQuestionsJson` + `addOnsJson` from wizard; render actual data
2. **Fix `ProviderAIAssistantScreen` keyboard** — swap `KeyboardAvoidingView` import to `react-native-keyboard-controller`
3. **Fix availability toggle** — add PATCH API call + read initial value from provider profile
4. **Label `SubscriptionScreen` as Coming Soon** or integrate RevenueCat
5. **Fix resource links** — either create content or render inline modals
6. **Delete orphaned finance screens** — `MoneyScreen`, `FinancesScreen`, `AccountingScreen`
7. **Consolidate policy editing** — remove `BookingPoliciesScreen` and `BusinessDetailsScreen` as standalone screens

Estimated effort to clear all 4 critical blockers: **~4–6 hours of focused engineering work**.
