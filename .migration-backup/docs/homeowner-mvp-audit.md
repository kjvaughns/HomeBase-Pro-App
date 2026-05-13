# Homeowner MVP Readiness Audit
**Date:** April 14, 2026  
**Task:** #70 — Screen-by-screen audit of all homeowner flows  

---

## Executive Summary

**MVP Readiness Verdict: Almost Ready**

The core booking, payment, and appointment management flows are production-ready with real API integrations. Three critical data integrity bugs have been fixed (review submission, profile save, health score computation). Several tools (Budgeter, Survival Kit, Service History, Savings/Spend) use hardcoded data — these are clearly deferred features rather than broken flows, and their placeholder nature is not trust-breaking in the same way as, e.g., a "Save" button that silently discards user input.

---

## Audit Results by Screen

### Auth & Onboarding

| Screen | Status | Severity | Notes |
|--------|--------|----------|-------|
| RoleGatewayScreen | PASS | — | Real account type selection, persisted to authStore |
| HomeownerOnboardingScreen | PASS | — | Three-step animated onboarding, no fake data |
| AccountTypeSelectionScreen | PASS | — | Redirects correctly to homeowner or provider flows |

---

### Discovery & Booking Flow

| Screen | Status | Severity | Notes |
|--------|--------|----------|-------|
| HomeScreen | PASS | — | Fetches real appointments via `GET /api/users/:id/appointments`; renders upcoming/active bookings |
| FindScreen | PASS | — | Real `GET /api/categories`, `GET /api/providers?categoryId=...` and search |
| ProviderListScreen | PASS | — | Real `GET /api/providers?categoryId=...`; maps API response to Provider type |
| ProviderProfileScreen | PASS | — | Real provider data from `GET /api/provider/:id`; reviews, services, availability |
| AIChatScreen | PASS | — | Real OpenAI GPT-4o-mini via AI Integrations; accepts homeId for property-specific context |
| SmartIntakeScreen | PASS | — | AI-powered service classification; real provider matching |
| SimpleBookingScreen | PASS | — | Real `GET /api/homes/:userId`, provider services, availability; `POST /api/appointments` on submit |
| BookingSuccessScreen | PASS | — | Confirmation screen with appointment ID passed from booking |

---

### Appointment Management Flow

| Screen | Status | Severity | Notes |
|--------|--------|----------|-------|
| ManageScreen | PASS | — | Real `GET /api/users/:id/appointments`; tabs for upcoming/active/past |
| AppointmentDetailScreen | PASS | — | Real `GET /api/appointments/:id`; cancel/reschedule wired to real endpoints |
| JobDetailScreen | PASS | — | Real `GET /api/appointments/:id/job`; full job detail with provider info |
| PaymentScreen | PASS | — | Real Stripe integration; `POST /api/stripe/invoices/:id/checkout`; chargesEnabled gate |
| ReviewScreen | **FIXED** | ~~CRITICAL~~ → PASS | Was: no API call. Now: `POST /api/appointments/:id/review` with ownership validation, duplicate prevention (409), and provider rating recalculation |

---

### Profile & Settings Flow

| Screen | Status | Severity | Notes |
|--------|--------|----------|-------|
| MoreScreen | PASS | — | Reads from authStore + homeownerStore; settings wired correctly |
| ProfileEditScreen | **FIXED** | ~~CRITICAL~~ → PASS | Was: `setTimeout(500)` fake save. Now: `PUT /api/user/:id` with real persistence; `updateUser()` syncs authStore; email field removed |
| AddressesScreen | PASS | — | Real `GET /api/homes/:userId`; add/delete homes via API |
| PaymentMethodsScreen | PASS | — | Real Stripe payment methods; `GET /api/stripe/payment-methods` |
| NotificationsScreen | PASS | — | Real `GET /api/notifications/:userId`; mark-read wired |
| NotificationPreferencesScreen | PASS | — | Real preferences endpoint |

---

### Homeowner Tools

| Screen | Status | Severity | Notes |
|--------|--------|----------|-------|
| HouseFaxScreen | PASS | — | Real `GET /api/homes/:userId` for home selection; `GET /api/housefax/:homeId`; HouseFax enrichment via Google Places/Zillow |
| HealthScoreScreen | **FIXED** | ~~HIGH~~ → PASS | Was: hardcoded MOCK_SCORE_RUNS (score always 82); hardcoded cost cards ($2,500-5,000) and action plan (4 static tasks). Now: real `computeScoreFromAnswers()` with 5-category weighted scoring; `estimateCostIfIgnored()` and `estimateQuickWinSavings()` computed from wizard answers; `buildActionPlan()` maps topRisks to real action items; score persisted via `PUT /api/homes/:homeId` |
| ServiceHistoryScreen | PARTIAL | MEDIUM | Has real homes selector (`GET /api/homes/:userId`) but displays `MOCK_SERVICE_ENTRIES` and `MOCK_PAST_PROVIDERS` instead of real service history. Backend `GET /api/housefax/:homeId` returns entries but is not wired to this screen. Pull-to-refresh is a fake 1-second timeout. |
| SurvivalKitScreen | PARTIAL | MEDIUM | 14-step maintenance wizard is functional and produces a maintenance plan. Plan items come from `MOCK_TASKS` (16 generic tasks) and `MOCK_TIPS`. No backend persistence — plan resets on app restart. |
| BudgeterScreen | PARTIAL | MEDIUM | Fully hardcoded `BUDGET_CATEGORIES` and `RECENT_TRANSACTIONS`. No backend for budget tracking exists. UI is functional but data is illustrative only. |
| SavingsSpendScreen | PARTIAL | MEDIUM | Hardcoded `MOCK_CATEGORIES` and `MOCK_SAVINGS_WINS`. No backend. Data is illustrative. |
| SavedProvidersScreen | PASS | — | Real saved providers from homeownerStore (persisted via AsyncStorage). Fake pull-to-refresh (1s timeout) is cosmetically acceptable. |

---

### Cross-Cutting Concerns

| Concern | Status | Notes |
|---------|--------|-------|
| Loading states | PASS | All real-data screens show loading spinners; react-query handles loading/error states |
| Error handling | PASS | All fixed screens use `instanceof Error` pattern; no `catch (e: any)` slop |
| Session expiry | PASS | `on401: "throw"` in queryFn; auth middleware enforces JWT validity |
| Empty states | PASS | ManageScreen, SavedProviders, Notifications all have empty state UI |
| Auth required checks | PASS | All API endpoints require `requireAuth` middleware |
| Offline behavior | ACCEPTABLE | React-query caches last response; no explicit offline mode needed for MVP |

---

## Issues Fixed in This Task

### CRITICAL → FIXED

1. **ReviewScreen** — `POST /api/appointments/:id/review`
   - Validates ownership, reviewable status, prevents duplicates (409)
   - Recalculates provider `rating`/`reviewCount`/`averageRating`
   - Fetches real appointment/provider data via `useQuery`

2. **ProfileEditScreen** — `PUT /api/user/:id`
   - `updateUser()` added to authStore for session sync
   - Email field removed (security: server doesn't accept email updates)
   - Error handling uses `instanceof Error` pattern

### HIGH → FIXED

3. **HealthScoreScreen** — Real computation + dynamic UI
   - `computeScoreFromAnswers()` with weighted 5-category scoring
   - `estimateCostIfIgnored()` derived from topRisks severity
   - `estimateQuickWinSavings()` derived from energy/water breakdown
   - `buildActionPlan()` maps each risk to a specific, costed action item
   - Score persisted via `PUT /api/homes/:homeId`

### INFRASTRUCTURE → FIXED

4. **housefax_entries table** missing from DB
   - Created table directly via SQL (immediate fix)
   - Added `CREATE TABLE IF NOT EXISTS` to `server/dbMigrations.ts` boot migration
   - HouseFax GET endpoint now returns 200 instead of 500

---

## Medium Priority Issues (Deferred — Not Critical for Launch)

| Issue | Effort | Recommended Action |
|-------|--------|-------------------|
| ServiceHistoryScreen: MOCK_SERVICE_ENTRIES | Medium | Wire `GET /api/housefax/:homeId` to timeline entries |
| SurvivalKitScreen: MOCK_TASKS | Medium | Add persistence endpoint `PUT /api/homes/:id/maintenance-plan` |
| BudgeterScreen: hardcoded budgets | High | Design budget schema + CRUD API + real transactions |
| SavingsSpendScreen: MOCK_CATEGORIES | High | Aggregate real appointment costs from HouseFax entries |

---

## Final Verdict

**MVP Status: Almost Ready**

The primary user journeys — find a provider → book → manage appointment → pay → review — are all backed by real APIs with proper auth, error handling, and persistence. No critical flows silently drop user data. The deferred tool screens (Budgeter, Survival Kit, Service History, Savings) are clearly feature-preview experiences rather than broken flows. They should be labeled or deferred for a v1.1 release.
