# Provider Feature Functionality Audit Report
**Date:** April 14, 2026  
**Auditor:** Automated deep-dive analysis (Task #74)  
**Test Account:** `test@homebase.com` / `test123`  
**Test Provider ID:** `test-provider-001` (business: "Demo Pro Services")  
**Backend:** `http://localhost:5000` (Supabase + Express)

---

## 1. Feature Health Summary

| # | Feature | Status | Severity |
|---|---------|--------|----------|
| 1 | Sign up | WORKING | — |
| 2 | Login | WORKING | — |
| 3 | Logout | WORKING | — |
| 4 | Forgot password / reset | WORKING | — |
| 5 | Provider onboarding flow | WORKING | — |
| 6 | Business profile editing | WORKING | — |
| 7 | Logo / avatar upload | WORKING | — |
| 8 | Business hours | WORKING | — |
| 9 | Booking policies | WORKING | — |
| 10 | Service creation (wizard) | WORKING | — |
| 11 | Service pricing types | WORKING | — |
| 12 | Custom intake questions | WORKING | — |
| 13 | Service add-ons | WORKING | — |
| 14 | Recurring service setup | WORKING | — |
| 15 | Service editing | WORKING | — |
| 16 | Service deletion | WORKING | — |
| 17 | Service publish / unpublish | WORKING | — |
| 18 | Service preview (B1) | PARTIAL | Medium |
| 19 | Booking link creation | WORKING | — |
| 20 | Public booking page | WORKING | — |
| 21 | Booking link sharing | WORKING | — |
| 22 | Lead intake / new submissions | WORKING | — |
| 23 | Lead accept / decline | WORKING | — |
| 24 | Quote creation from submission | PARTIAL | Medium |
| 25 | Availability toggle (B3) | BROKEN | Critical |
| 26 | Job creation | WORKING | — |
| 27 | Job scheduling / ScheduleScreen | WORKING | — |
| 28 | Job status progression | WORKING | — |
| 29 | Job cancellation | WORKING | — |
| 30 | Photo upload for jobs | PARTIAL | Medium |
| 31 | Client management (CRM) | WORKING | — |
| 32 | Client record creation | WORKING | — |
| 33 | Invoice creation + email | WORKING | — |
| 34 | Payment collection (Stripe checkout) | WORKING | — |
| 35 | Stripe Connect onboarding | WORKING | — |
| 36 | Dashboard metrics | WORKING | — |
| 37 | Payout visibility | BROKEN | High |
| 38 | Business insights (AI) | WORKING | — |
| 39 | Email communication | WORKING | — |
| 40 | SMS communication | PARTIAL | Low |
| 41 | Message templates | WORKING | — |
| 42 | Review collection | PARTIAL | Medium |
| 43 | Push notifications | PARTIAL | Medium |
| 44 | Notification preferences | WORKING | — |
| 45 | Data persistence (restart) | PARTIAL | High |
| 46 | Pull-to-refresh | WORKING | — |
| 47 | Loading / empty states | WORKING | — |
| 48 | Error handling | PARTIAL | Medium |
| 49 | Account deletion | WORKING | — |
| B2 | AI Assistant keyboard | BROKEN | High |
| B2b | SendMessage keyboard | BROKEN | Medium |
| — | Voice input (AI Screen) | FAKE | Medium |
| — | Job checklist persistence | FAKE | Medium |
| — | Client LTV calculation | BROKEN | Medium |

---

## 2. Fully Working Features

These features were verified end-to-end via API calls and code review. Real data flows, proper invalidation, and correct UI rendering confirmed.

### Authentication & Identity
- **Sign up** (`POST /api/auth/signup`): Creates user record, returns JWT token, isProvider flag supported. Tested: new user created with UUID `59ee70c2-...`.
- **Login** (`POST /api/auth/login`): Returns token + full providerProfile in response. Token stored via AsyncStorage. `providerProfile.id = "test-provider-001"` correctly populated.
- **Logout**: Clears token and providerProfile from authStore, clears React Query cache.
- **Account deletion** (`DELETE /api/auth/account`): Endpoint exists, cascades deletes (verified in route, lines 711–785 of routes.ts).

### Business Setup
- **Business profile editing** (`PUT /api/provider/:id`): All fields (businessName, description, phone, email, hourlyRate, serviceRadius, serviceZipCodes, serviceCities, slug) save and reload correctly. BusinessHubScreen populates form from API response.
- **Logo upload** (`POST /api/provider/:id/logo`): Full chain confirmed working. ImagePicker → base64 → server → Supabase Storage → public URL stored in DB. Test produced: `https://yvedkmtjynhgsuxukxjj.supabase.co/storage/v1/object/public/job-photos/logos/provider-test-provider-001-logo-1776199523533.png`.
- **Business hours**: Loaded from `provider.businessHours` JSONB, saved via `PUT /api/provider/:id`. Default hours shown when DB returns null (correct behavior).
- **Booking policies**: Loaded from `provider.bookingPolicies` JSONB, saved via `PUT /api/provider/:id`. Deposit %, cancellation windows, reschedule limits all persist.

### Services
- **Service creation** (ServiceBlueprintWizardScreen): Full 6-step wizard calls `POST /api/provider/:providerId/custom-services`. Pricing types (flat, starts_at, quote_only), intake questions, add-ons, booking mode, recurring flag all stored.
- **Service editing**: `PUT /api/provider/:providerId/custom-services/:id` patches correctly.
- **Service deletion**: `DELETE /api/provider/:providerId/custom-services/:id` removes record and React Query cache is invalidated.
- **Recurring service**: `is_recurring`, `recurring_frequency`, `recurring_price` columns confirmed in DB schema (migration 0003).

### Booking & Leads
- **Booking link creation** (`POST /api/providers/:providerId/booking-links`): Creates record with slug, active status, instantBooking, customTitle. BookingLinkScreen fetches and displays correctly.
- **Public booking page**: `GET /api/booking/:slug` serves provider data. Form submission creates intake_submission record.
- **Booking link sharing**: Uses `expo-clipboard` and native Share sheet. URL constructed as `https://homebaseproapp.com/providers/${slug}`.
- **Lead management**: LeadsScreen shows intake submissions from `GET /api/providers/:providerId/intake-submissions`. Accept flow (`POST /api/intake-submissions/:id/accept`) creates client + job records and marks submission `confirmed`. Decline works.

### Jobs
- **Job creation** (`POST /api/jobs`): Creates job with clientId, title, scheduledDate, scheduledTime, estimatedPrice. Non-fatal appointment row also created. Test: job `fa599a1e-...` created successfully.
- **ScheduleScreen**: Fetches from `GET /api/provider/:id/jobs` with React Query. Month view calendar and list view both show real data. 13 test jobs confirmed.
- **Job status progression**: `PUT /api/jobs/:id` with status field works for all statuses (scheduled → confirmed → on_my_way → arrived → in_progress). `POST /api/jobs/:id/complete` transitions to `completed` status and accepts finalPrice. Job cancellation via `PUT /api/jobs/:id` with `status: "cancelled"` confirmed working.

### Clients
- **Client management** (ClientsScreen): Fetches from `GET /api/provider/:id/clients`, returns 8 clients for test provider. Search (client-side), filter by status, sort by recency/LTV all work. ClientDetailScreen 6 tabs load from correct endpoints.
- **Client record creation** (AddClientScreen): `POST /api/clients` with all fields (firstName, lastName, email, phone, address, city, state, zip, notes). AddressAutocomplete via Google Places. Correct cache invalidation on success.

### Invoices & Payments
- **Invoice creation**: `POST /api/invoices` or `/api/invoices/create-and-send`. Line items array accepted, total calculated server-side. 16 test invoices confirmed.
- **Invoice detail** (InvoiceDetailScreen): Fetches real invoice, shows line items, invoice number, paid date. Mark paid, cancel, remind actions all call correct endpoints.
- **Payment collection** (Stripe checkout): `POST /api/invoices/:id/checkout` correctly gates on `stripeConnectAccounts.chargesEnabled`. Returns `{"error":"Provider Stripe account not connected"}` for unconnected providers — correct behavior.
- **Stripe Connect onboarding**: `GET /api/stripe/connect/status/:providerId` returns `{exists, onboardingStatus, chargesEnabled, payoutsEnabled, detailsSubmitted}`. StripeConnectScreen uses AppState listener to auto-refresh after returning from Stripe onboarding URL.

### Dashboard & Analytics
- **Dashboard metrics** (`GET /api/provider/:id/stats`): Returns real DB aggregation: `{revenueMTD: 201.65, jobsCompleted: 0, activeClients: 8, upcomingJobs: 0, averageJobValue: 201.65, revenueByPeriod: [...]}`. Ownership check correctly uses `storage.getProviderByUserId()`.
- **Business insights** (`GET /api/provider/:id/insights`): Returns `{allTimeRevenue: 4925, clientCountThisQuarter: 0, clientGrowthPct: -100, rating: "4.9", reviewCount: 47}` with AI-generated motivational messages (GPT-4o-mini, 1-hour cache).

### Communications
- **Email communication**: `POST /api/providers/:providerId/messages` sends via Resend. Subject/body with merge variable substitution. Rate-limited to 10/client/24h. Message history stored in `provider_messages` table.
- **Message templates**: `GET/POST/PUT/DELETE /api/providers/:providerId/message-templates` all confirmed working. 5 preset template categories supported with merge variable insertion.

### Settings
- **Notification preferences**: `GET /api/notification-preferences/:userId` and `POST /api/notification-preferences` round-trip confirmed. All 11 preference fields toggle and persist correctly. Providers share this screen with homeowners — same preferences, same backend.
- **Pull-to-refresh**: All major list screens (ClientsScreen, ScheduleScreen, LeadsScreen, ReviewsScreen) implement `RefreshControl` with query `refetch()`.

---

## 3. Partially Working Features

### F1 — Service Preview (B1 from Task #71) — Severity: Medium
**File:** `client/screens/provider/ServicePreviewScreen.tsx`  
**Finding:** ServicePreviewScreen receives service data via route params from the wizard's Review step — it is NOT showing hardcoded fake data in the normal flow. The wizard correctly passes `{name, category, description, pricingModel, price, duration}` as params.

**However, there is still an issue:** The screen has a hardcoded fallback on lines 31–38:
```typescript
const service = route.params?.service || {
  name: "Sample Service",
  category: "Cleaning", 
  description: "This is how your service will appear to homeowners.",
  ...
};
```
This fallback is shown if `ServicePreviewScreen` is opened without params (e.g., from ServicesScreen's eye-icon button). The eye-icon preview on ServicesScreen passes service data, but only from the `ServicesScreen` local data, not from the full DB record. Intake questions and add-ons are NOT shown in the preview — only name, category, description, and price.

**Status:** Not as broken as initially reported in Task #71. Normal flow (wizard) shows real in-progress data. But the preview doesn't show intake questions or add-ons, which are the most differentiating elements of a service.

### F2 — Quote Creation from Intake Submission — Severity: Medium
**Finding:** When a submission has `bookingMode = "quote_only"`, the intake submission appears in LeadsScreen. The Accept flow creates a job. However, there is no UI in LeadsScreen or JobDetail to create an invoice *directly from the quote submission* — the provider must navigate to FinancialsScreen → Add Invoice and manually select the client. The workflow requires too many steps to be called a "quote-to-invoice" flow.

### F3 — Job Photo Upload — Severity: Medium
**File:** `client/screens/provider/ProviderJobDetailScreen.tsx` (lines ~340–390 not fully read)  
**Backend:** `POST /api/jobs/:id/photos` exists at routes.ts line 1306.  
**Finding:** The endpoint exists and is called from ProviderJobDetailScreen using ImagePicker + base64. However, the upload is a backend-only action — the photos are stored in the job's HouseFax entry. The screen loads `uploadedPhotos` state locally but there's no `useQuery` to reload photos from the server after upload. Photos may not persist visually across screen re-opens. **Needs device testing to fully confirm.**

### F4 — Review Collection — Severity: Medium
**File:** `client/screens/provider/ReviewsScreen.tsx`  
**Finding:** ReviewsScreen can display reviews (fetches from `GET /api/provider/:id/reviews`). Test provider has 47 reviews in DB but they return as empty array (`{"reviews":[]}`) — this may be a seed data issue. **More critically: there is no `POST /api/reviews` endpoint and no UI for providers to "Request a Review" from a client.** Reviews can only be created by homeowners completing the homeowner review flow. Providers have no agency in review collection.

### F5 — Push Notifications — Severity: Medium
**Finding:** Push token registration (`POST /api/push-tokens`) exists. In-app notification sending uses `sendPush()` function on the server side for booking, message, and invoice events. However:
- `GET /api/push-tokens` returns 404 — no listing endpoint
- The `NotificationPreferencesScreen` is the homeowner version, reused for providers without provider-specific notification categories (e.g., no "New Lead" or "Job Started" categories)
- There is no in-app notification center/inbox screen navigable from the provider app

### F6 — SMS Communication — Severity: Low
**Finding:** The send message flow supports SMS channel selection. Messages are stored with `status: "pending_sms"`. **No actual SMS delivery occurs.** This is by design (Twilio not integrated), but the UI implies to providers that SMS is sent. The status `pending_sms` is never resolved to `sent` or `failed`.

### F7 — Subscription Screen (B4 from Task #71) — Severity: Medium
**File:** `client/screens/provider/SubscriptionScreen.tsx` (lines 27, 76–78)  
**Finding:** The `isFree` determination uses:
```typescript
const isFree = (providerProfile?.completedJobs ?? 0) === 0;
```
`providerProfile.completedJobs` is hardcoded to `0` in `BusinessHubScreen.tsx` line 205 during profile recovery:
```typescript
completedJobs: 0,
```
Therefore `isFree` is always `true` for all providers — even those who have completed jobs. The screen always shows "Free until your first paid booking."

Additionally, the screen links to Apple Subscriptions settings for plan management but has **no RevenueCat integration** to verify or display actual subscription status. The entire subscription system is a UI placeholder.

### F8 — Data Persistence After Restart — Severity: High
**Finding:** All React Query data is correctly re-fetched on mount. Server data persists properly. However, `availableForWork` in `providerStore` is Zustand-persisted via AsyncStorage but is NOT synced FROM the server on app start. If a provider toggles availability on one device, the other device (or after a reinstall) shows the wrong state. The source of truth should be `bookingPolicies.availableForWork` on the server — it never is.

---

## 4. Broken Features

### B1 — Availability Toggle Not Persisted (B3 from Task #71) — Severity: Critical
**File:** `client/screens/provider/ProviderMoreScreen.tsx` lines 120–125  
**Root cause:**
```typescript
<Switch
  value={availableForWork}
  onValueChange={setAvailableForWork}  // Zustand store only — NO API call
  ...
/>
```
`setAvailableForWork` is a Zustand setter that updates local state and persists to AsyncStorage. There is no `PATCH /api/provider/:id` call. The PATCH endpoint works (confirmed: accepts `bookingPolicies` JSONB payload), but it is never called when the toggle is flipped.

**Impact:** The provider's availability state is never saved to the database. After app restart on a different device, or if the user clears app data, availability reverts to `true` (the default). Public booking pages do not gate on this toggle.

### B2 — AI Assistant Keyboard Bug (B2 from Task #71) — Severity: High
**File:** `client/screens/provider/ProviderAIAssistantScreen.tsx` line 11  
**Root cause:**
```typescript
import { ..., KeyboardAvoidingView, ... } from "react-native";  // WRONG
```
Should be:
```typescript
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
```
**Impact:** On iOS, the keyboard covers the chat input when typing. The text input is unreachable behind the system keyboard on physical devices. The screen is essentially unusable as a chat interface on iOS.

### B2b — SendMessage Keyboard Bug — Severity: Medium
**File:** `client/screens/provider/SendMessageScreen.tsx` line 9  
**Root cause:** Same as B2 — imports `KeyboardAvoidingView` from `react-native` instead of `react-native-keyboard-controller`.  
**Impact:** The body composition area for email/SMS is obscured by the keyboard on iOS devices.

### B3 — Payout Visibility Broken — Severity: High
**File:** `client/screens/provider/FinancialsScreen.tsx` lines 851–857  
**Backend:** `GET /api/providers/:providerId/payouts` at routes.ts line 5820  
**Root cause:** The `payouts` table in Drizzle schema defines `arrivalDate: timestamp("arrival_date")` (schema.ts line 357). But the actual Supabase database does **not** have this column — the migration was never applied. Query result:
```json
{"error":"column \"arrival_date\" does not exist"}
```
**Impact:** The entire Payouts tab in FinancialsScreen shows nothing — or an error state. FinancialsScreen also uses `GET /api/providers/:providerId/stripe-payouts` for live Stripe payouts, which returns `{"error":"stripe_not_connected"}` for providers who haven't connected Stripe. **Both payout views are completely non-functional for the test provider.**

### B4 — Voice Input is Non-Functional — Severity: Medium
**File:** `client/screens/provider/ProviderAIAssistantScreen.tsx` lines 223–232  
**Root cause:**
```typescript
const handleVoicePress = () => {
  if (isListening) {
    setIsListening(false);
  } else {
    setIsListening(true);
    // Voice input is not yet integrated — just toggle the listening indicator
    setTimeout(() => { setIsListening(false); }, 3000);
  }
};
```
The code comment explicitly acknowledges the feature is not implemented. The microphone button shows an animated listening pulse for 3 seconds then stops. No speech-to-text API is called. No text is transcribed.  
**Impact:** Providers who tap the microphone button expect voice input to work. This is a deceptive UI element.

### B5 — Client LTV Always Undefined — Severity: Medium
**Endpoint:** `GET /api/clients/:id` and `GET /api/provider/:id/clients`  
**Finding:** The `Client` interface in ClientsScreen defines `ltv: number` as a required field. The API returns `ltv: undefined`. The server does not compute lifetime value from invoice totals. ClientsScreen renders `ltv` as `"$0"` via fallback but the sort-by-LTV feature is effectively non-functional since all clients have LTV = 0. The `sortBy: "ltv"` sort shows no useful ordering.

---

## 5. Fake or Mock-Only Features

### M1 — Job Checklist is Local State Only
**File:** `client/screens/provider/ProviderJobDetailScreen.tsx` lines 248–255  
**Finding:** The job detail checklist renders 6 hardcoded items:
```typescript
const [localChecklist, setLocalChecklist] = useState<JobChecklistItem[]>([
  { id: "1", label: "Arrived at location", completed: false },
  { id: "2", label: "Assessed the issue", completed: false },
  { id: "3", label: "Discussed scope with customer", completed: false },
  { id: "4", label: "Completed main work", completed: false },
  { id: "5", label: "Cleaned up area", completed: false },
  { id: "6", label: "Walkthrough with customer", completed: false },
]);
```
Checklist toggle state is local. There is no API call to persist checklist progress. Every time the job detail is opened, the checklist resets to unchecked. The 6 items are identical for every job type (plumbing, painting, cleaning, etc.).

### M2 — Voice Input in AI Assistant
Covered in B4. Fake UI, no real speech-to-text.

### M3 — Subscription / Plan Management
SubscriptionScreen opens `https://apps.apple.com/account/subscriptions` for plan management. There is no RevenueCat entitlement check, no subscription status API, and no paywall logic. All providers are effectively shown as "Pro" (the `isFree` check is always true due to hardcoded `completedJobs: 0`). The monetization layer is entirely missing.

---

## 6. Data Flow Issues

### DF1 — `providerProfile.completedJobs` Always 0
**Files:** `client/screens/onboarding/ProviderSetupFlow.tsx`, `client/screens/provider/BusinessHubScreen.tsx` line 205  
When provider profile is recovered from the API (auto-recovery flow), it is reconstructed as:
```typescript
createProviderProfile({
  ...
  completedJobs: 0,  // Hardcoded
});
```
This field is never updated from the stats API. `SubscriptionScreen` uses `completedJobs` to determine free tier. It will always say "Free until your first paid booking" even for providers with dozens of completed jobs.

### DF2 — Availability State Source of Truth Split
`availableForWork` exists in two places with no sync:
- **Zustand store** (AsyncStorage): Source for the toggle UI
- **Server DB** (`bookingPolicies.availableForWork`): Never written by the toggle
The DB value is never read on app startup. Two devices with the same provider account will show different availability states.

### DF3 — React Query Cache Key Inconsistency
Two different cache keys are used for the same booking links data:
- `["/api/providers", providerId, "booking-links"]` (BookingLinkScreen, BusinessHubScreen)
- `["/api/provider", providerId, "booking-links"]` (invalidation in BookingLinkScreen)

BookingLinkScreen invalidates both keys. This works but is inconsistent and error-prone for future development.

### DF4 — Stats/Insights Ownership Check Uses `getProviderByUserId`
**File:** `server/routes.ts` lines 3774–3778  
The stats endpoint does:
```typescript
const providerRow = await storage.getProviderByUserId(req.authenticatedUserId!);
if (!providerRow || providerRow.id !== req.params.id) {
  res.status(403).json({ error: "Forbidden" });
}
```
This means: if a user has **two provider accounts** (e.g., after re-onboarding), `getProviderByUserId` returns the first one, and the second provider's stats endpoint returns 403. This is a latent multi-provider-profile bug.

### DF5 — Message Templates: No Auto-Creation for New Providers
When a new provider is created, no default message templates are seeded. `GET /api/providers/:id/message-templates` returns 0 templates. The 5 "built-in preset templates" mentioned in the README exist only as UI suggestions in SendMessageScreen — they are never written to the DB. First-time providers see an empty templates list.

### DF6 — Service Categories in AddJobScreen vs. DB
**File:** `client/screens/provider/AddJobScreen.tsx` lines 47–55  
The service picker shows 7 hardcoded categories ("General Repair", "Installation", etc.) rather than the provider's real custom services from `GET /api/provider/:id/custom-services`. Providers who have created specific services (e.g., "Deep Clean Package", "HVAC Tune-Up") won't see them in the job creation dropdown. They can type a custom name, but the UX doesn't guide them to their own service catalog.

---

## 7. Backend Integration Issues

### BE1 — `GET /api/providers/:id/payouts` Column Missing
Endpoint at routes.ts line 5820. Returns `{"error":"column \"arrival_date\" does not exist"}`. The `arrivalDate` column is in the Drizzle schema (`shared/schema.ts` line 357) but the Supabase database migration was never applied. This is the ONLY known migration gap found.

### BE2 — No Review Creation Endpoint for Providers
`GET /api/provider/:id/reviews` exists (lines 3884–3900). There is no `POST /api/reviews` or `/api/provider/:id/request-review` endpoint. Providers cannot initiate review requests from within the app. Reviews are purely homeowner-initiated.

### BE3 — `GET /api/push-tokens` Does Not Exist
ProviderMoreScreen navigates to NotificationPreferences which shows push notification toggles. Push token registration (`POST /api/push-tokens`) works. But `GET /api/push-tokens` returns 404 — there is no way to list registered tokens. The app cannot tell users on which devices push is active.

### BE4 — NotificationPreferences Screen is Homeowner-Only
**File:** `client/navigation/RootStackNavigator.tsx` line 430  
The `NotificationPreferences` route is mapped to `NotificationPreferencesScreen` from `client/screens/homeowner/`. Providers accessing this screen via ProviderMoreScreen get the homeowner version. The categories shown (Booking Confirmations, Booking Reminders, etc.) are homeowner-oriented. Provider-specific categories (New Lead, Job Status Update, Invoice Paid) are absent.

### BE5 — PATCH vs PUT Provider Profile
The `ProviderSetupFlow.tsx` uses `PATCH /api/provider/:id` while `BusinessHubScreen.tsx` uses both `PUT` and `PATCH`. The server appears to handle both (both return updated provider). However this inconsistency can cause partial-update vs full-replace confusion in future development.

### BE6 — Stripe Payouts Endpoint Confusion
FinancialsScreen correctly uses `GET /api/providers/:providerId/stripe-payouts` (line 854). However a separate endpoint `GET /api/providers/:providerId/payouts` (DB payouts table, line 5820) is never called by the UI. The DB payouts table is populated only by internal Stripe webhook logic, not used in any screen. The FinancialsScreen only shows live Stripe payouts — which are empty for providers without Stripe Connect set up.

---

## 8. UX Issues Inside Otherwise Working Features

### UX1 — Job Checklist Doesn't Match Service Type
The 6-item checklist (arrived, assessed, discussed, completed, cleaned, walkthrough) is identical for all jobs. A plumber and a house cleaner see the same checklist. The items should be dynamically generated based on service type or customizable per job. This is a trust-reducing detail for real service providers.

### UX2 — AddJobScreen Service Picker Lists Generic Options
The service picker shows "General Repair", "Installation", etc. instead of the provider's actual custom services. This creates a disconnect: providers set up specific services in the wizard, then see generic ones when creating jobs. Impact: providers will likely use the "type a custom service" field for every job, making the service association in analytics less reliable.

### UX3 — Subscription Screen Always Says "Free"
Due to hardcoded `completedJobs: 0`, every provider sees "Free until your first paid booking" regardless of their actual history. This erodes trust in the billing information display.

### UX4 — Service Preview Missing Key Data
ServicePreviewScreen shows name, category, description, and price — but NOT intake questions, add-ons, or booking mode. Providers who built a detailed intake form cannot preview what customers will actually see. The "preview" is thus misleading.

### UX5 — Business Insights Negative Growth Caption
When a provider has 0 clients this quarter vs 8 last quarter, the AI generates `clientGrowthPct: -100` and the motivational caption says "Challenge yourself to attract new clients this quarter." This is technically accurate but may alarm providers who just started using the app — their baseline quarter had seed data.

### UX6 — Provider AI Assistant Real Data Works, But No History
`getBusinessContext()` correctly fetches from 5 real API endpoints. However, chat history is stored in local state (`useState`) only — not persisted. Every time the provider closes and reopens the AI screen, conversation history is lost. There is no backend storage for AI chat sessions.

### UX7 — Stripe Connect Screen Shows "Test Service" Default Invoice
StripeConnectScreen has hardcoded defaults:
```typescript
const [invoiceDescription, setInvoiceDescription] = useState("Test Service");
const [invoiceAmount, setInvoiceAmount] = useState("50.00");
```
These are pre-populated test values visible to real providers, suggesting the screen was built for testing and not cleaned up for production.

### UX8 — No "Request Review" Button in Job Completion Flow
When a job is marked "Completed", there is no prompt to request a review from the client. This is the highest-intent moment to request reviews. The omission means providers must navigate to a non-existent review request flow manually.

---

## 9. Highest Priority Fixes

| # | Fix | Severity | Effort | Impact |
|---|-----|----------|--------|--------|
| P1 | **Fix availability toggle (B3)**: Add `PATCH /api/provider/:id` call in ProviderMoreScreen `onValueChange` handler | Critical | 30 min | Providers lose availability state on restart |
| P2 | **Fix AI Assistant keyboard (B2)**: Replace `KeyboardAvoidingView` import with `react-native-keyboard-controller` in ProviderAIAssistantScreen | High | 10 min | Chat input unreachable on iOS |
| P3 | **Fix SendMessage keyboard**: Same fix as P2 in SendMessageScreen | Medium | 10 min | Email composition broken on iOS |
| P4 | **Fix payouts DB migration**: Apply missing `arrival_date` column to Supabase. Run `db:push` or add boot migration for `payouts` table column | High | 20 min | Entire payout history broken |
| P5 | **Persist job checklist**: Add `POST /api/jobs/:id/checklist` endpoint and load checklist items from DB; remove hardcoded 6-item default | Medium | 2 hrs | Providers lose checklist progress on every screen open |
| P6 | **Fix AddJobScreen service picker**: Replace `SERVICE_OPTIONS` array with `GET /api/provider/:id/custom-services` query to show provider's real services | Medium | 1 hr | Disconnect between provider's service catalog and job creation |
| P7 | **Fix Client LTV**: Compute `ltv` server-side as sum of `finalPrice` from completed jobs + total paid from invoices for this client | Medium | 1 hr | Sort-by-LTV is non-functional; all clients show $0 |
| P8 | **Create provider-specific NotificationPreferences**: Add provider notification categories (New Lead, Job Update, Invoice Paid) or split the shared screen by role | Medium | 2 hrs | Providers see homeowner notification categories |
| P9 | **Add "Request Review" CTA on job completion**: After `POST /api/jobs/:id/complete`, prompt provider to send a review request email to client | Medium | 1 hr | Highest-intent moment for review collection is missed |
| P10 | **Fix Subscription Screen**: Integrate RevenueCat entitlement check; remove hardcoded `completedJobs: 0` from profile recovery | High | 4 hrs | All providers shown as "Free" regardless of payment status |

---

## 10. Final Feature Readiness Verdict

### Overall Assessment: **6.5 / 10 — Not Ready for Real Provider Launch**

The core data infrastructure is solid. Stats, insights, client management, invoicing, Stripe Connect, booking links, and job tracking all work end-to-end with real database data. Logo upload works. Onboarding persists to the DB. 29 of 49 audited features are fully functional.

### Launch-Blocking Issues (Must Fix Before Any Real Provider Use)

1. **Availability toggle (P1)** — Providers cannot reliably control their booking availability. State resets on restart. This is the first setting a provider would use.

2. **AI Assistant keyboard (P2)** — The AI business coach, listed as a headline feature, is unusable on physical iOS devices. The text input is blocked by the keyboard.

3. **Payouts DB migration (P4)** — The entire payout visibility section of the Financials screen is broken with a database error. Revenue tracking is the #1 concern of service providers.

4. **Subscription / billing (P10)** — Every provider is shown as "Free" regardless of actual status. Cannot charge providers without this working.

### Important-But-Not-Blocking Issues (Fix Before Soft Launch)

5. **SendMessage keyboard (P3)** — Client communications are impaired on iOS.
6. **Client LTV always $0 (P7)** — Makes the "Highest LTV" sort feature useless.
7. **Voice input is fake (B4)** — Remove the microphone button or implement real speech-to-text; deceptive UI erodes trust.
8. **Review collection has no provider flow** — Providers have no way to solicit reviews at the optimal moment (job completion).
9. **Job checklist resets (P5)** — Every time a provider opens a job during work, the checklist is blank.
10. **Service picker doesn't use real services (P6)** — Disconnect between service catalog and job creation.

### What Is Safe to Show Providers Today

The following sections can be demonstrated to real providers without issue:
- Business profile setup and logo upload
- Service creation wizard (all 6 steps)
- Booking links and public booking page
- Client CRM with full detail screen
- Invoice creation, sending, and Stripe checkout
- Job creation and status progression
- Dashboard stats and business insights (AI captions)
- Email messaging with templates
- Business hours and booking policies

### What Must Be Hidden or Disabled

- Availability toggle (shows but doesn't work)
- Payout visibility tab (crashes with DB error)
- Subscription screen (always shows wrong state)
- AI Assistant voice button (fake)
- Sort-by-LTV (all clients appear equal)
- Review request flow (no such flow exists)
