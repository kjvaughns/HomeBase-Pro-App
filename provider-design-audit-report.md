# HomeBase Provider App — Design & iOS UX Audit
**Date:** April 14, 2026  
**Scope:** Full design and iOS UX assessment of all 33 provider and onboarding screens, the shared component library, and the navigation architecture  
**Method:** Full codebase read — every component and screen file reviewed; findings grounded in specific code locations

---

## Overall Design Score: 7 / 10
## Provider Trust Score: 6 / 10
## iOS Quality Score: 7 / 10

---

## Summary Assessment

The HomeBase provider app has a coherent, well-structured design foundation. The glass card system is done right on iOS, the button and list row components are native-quality, and the typography scale is grounded in the iOS HIG. The color discipline is good — one accent, one error, one warning, grayscale for everything else.

What holds it back is execution fragmentation. The design system has strong components that are not consistently used. `StatCard` exists but the dashboard builds its own stat grid. `ThemedText` only exposes a custom type scale (h1–h4) while the iOS-native names (largeTitle, title1, headline, callout, etc.) are defined in `theme.ts` but completely absent from the text component — resulting in devs bypassing `ThemedText` to use `Typography.xxx` directly. Status colors are defined three different ways across three different files. And a handful of screens (ProviderAIAssistantScreen, SendMessageScreen) have keyboard handling bugs that will make them feel broken on real devices.

For a real service business owner — a cleaner, a lawn care operator, a pest control company — the app communicates capability but not yet authority. The biggest trust gap isn't visual polish; it's that critical workflows (leads, booking links) are buried two taps deep behind "More → Business Hub", and the subscription screen shows everyone as "Pro" while the navigation hardcodes "$29.99/mo" as if billing is already active.

---

## Table of Contents
1. [Biggest Design Flaws](#1-biggest-design-flaws)
2. [Best Design Strengths](#2-best-design-strengths)
3. [Screen-by-Screen Audit](#3-screen-by-screen-audit)
4. [UX Friction Points](#4-ux-friction-points)
5. [Consistency Issues](#5-consistency-issues)
6. [iOS-Specific Design Issues](#6-ios-specific-design-issues)
7. [Final Verdict on Launch Polish](#7-final-verdict-on-launch-polish)

---

## 1. Biggest Design Flaws

### D1 — Leads and Booking Links Are Not in the Tab Bar
**Impact: High — Daily workflow broken**  
The two most important daily tasks for a service provider — reviewing new booking requests and sharing their booking link — have no tab bar presence. They live inside `MoreTab → Business Hub → Booking`. That's two taps from anywhere, inside a settings-like screen, behind a 4-tab scroll view. A plumber who just got a new lead request will not find it. For a professional booking tool, leads should either be a tab or live on the dashboard with a clear notification badge.

**Specific location:** `client/navigation/ProviderTabNavigator.tsx` — only 5 tabs registered (Home, Clients, Schedule, Finance, More); LeadsScreen is not in any tab

### D2 — `StatCard` Component Exists But Isn't Used on the Dashboard
**Impact: High — Inconsistency undermines the design system**  
`client/components/StatCard.tsx` exists with icon, value, label, trend indicator, and subtitle. The dashboard (`ProviderHomeScreen.tsx` lines 329–372) builds its own inline 4-square stat grid with raw `View`, `Feather`, and `ThemedText`. The result is a visually weaker dashboard that duplicates functionality that already exists. The FinancialsScreen Overview tab actually does use `StatCard` correctly. The inconsistency is jarring — the Finance tab looks richer than the Home tab.

**Fix:** Replace the inline stat grid in `ProviderHomeScreen` with 4 `StatCard` instances. Add trend data from the existing `/api/provider/:id/insights` response.

### D3 — Bar Chart Peak Value Label Is 7 Pixels
**Impact: High — Unreadable on every device**  
`client/screens/provider/FinancialsScreen.tsx` line 270:  
```
fontSize: 7,
```
The peak bar value label is rendered at 7px. On a 390px-wide iPhone 16 screen at 3x resolution, a 7px label is physically under 1mm tall. It is invisible to most users. This is the only data label on the chart — without it, the chart shows no numbers at all.

**Fix:** Minimum font size for any on-screen text is 11px (the `caption2` token in `theme.ts`). Use `fontSize: 11` minimum for the peak label.

### D4 — Two Parallel Typography Systems That Conflict
**Impact: High — Visual inconsistency throughout**  
`theme.ts` defines two scales:
- iOS HIG-aligned: `largeTitle (34)`, `title1 (28)`, `title2 (22)`, `title3 (20)`, `headline (17)`, `body (17)`, `callout (16)`, `subhead (15)`, `footnote (13)`, `caption1 (12)`, `caption2 (11)`
- Custom: `display (32)`, `h1 (24)`, `h2 (20)`, `h3 (18)`, `h4 (16)`, `body (17)`, `small (14)`, `caption (12)`, `label (14)`, `link (16)`

`ThemedText` only exposes the custom scale. The iOS scale is defined but unreachable through `ThemedText`. The result: `SectionHeader.tsx` uses `Typography.title3` directly (not through `ThemedText`). `ProviderFAB.tsx` uses raw `Text` with `Typography.subhead`. Any component that wants iOS-appropriate sizing is forced to bypass `ThemedText` entirely.

**Fix:** Add iOS scale variants to `ThemedText` type prop, or collapse to one scale.

### D5 — "Business Insights" Section Uses AI as a Replacement for Data
**Impact: Medium — Feels like filler; undermines trust**  
The dashboard's "Business Insights" card shows three rows — Revenue Milestone, Client Growth, Top Rated — where each value is an AI-generated prose sentence ("You've earned $12K this year", "Client count up 15% this quarter"). This is not a data visualization; it's marketing copy about your own business. During loading, it shows "Analyzing your earnings..." which anthropomorphizes a data fetch in a way that is more consumer app than business tool.

A busy service business owner wants numbers on a chart, not sentences. The AI-generated framing will erode credibility over time, especially when values are inaccurate or generic.

### D6 — `StatusPill` Uses Square Corners, Not a Pill Shape
**Impact: Medium — Amateur-looking status indicators**  
`client/components/StatusPill.tsx` line 69: `borderRadius: BorderRadius.sm` (8). This produces a rounded rectangle. Every major iOS app (Mail, Notes, Reminders, App Store) uses full-radius pills for status badges. The fix is a one-line change: `borderRadius: BorderRadius.full` or `borderRadius: 99`. Currently every status indicator in the app — across JobCard, LeadCard, ClientCard, and all modal headers — looks like a label sticker rather than a native status pill.

### D7 — `ProviderFAB` Uses Raw `Text`, Breaking Dark Mode for Action Labels
**Impact: Medium — Dark mode bug**  
`client/components/ProviderFAB.tsx` line 241 uses a raw React Native `Text` component for action label text (e.g., "Job", "Client", "Invoice", "Ask AI"). `ThemedText` is used everywhere else in the app. The raw `Text` component has no dark mode awareness — in dark mode these labels will render in the system default color, not `theme.text`.

### D8 — `TextField` Focus State Has a Bug: No Background Change
**Impact: Low but embarrassing — Focus state is invisible**  
`client/components/TextField.tsx` lines 35–37:
```typescript
const backgroundColor = isFocused
  ? theme.backgroundSecondary
  : theme.backgroundSecondary;
```
Both branches return `theme.backgroundSecondary`. The background never changes on focus. The only visual feedback when a field is focused is the accent-colored border (which is `borderWidth: 1.5` — also subtle). This means most users won't know which field is focused until they start typing.

---

## 2. Best Design Strengths

### S1 — `GlassCard` Is Genuinely Native-Quality iOS
The `GlassCard` component is done properly: `expo-blur` with `BlurView` on iOS only, platform fallback to solid `theme.cardBackground`, spring press animation at 0.97 scale, hairline border with `theme.borderLight`, and haptic feedback. The glass effect looks correct on iOS — not fake, not overdone.

### S2 — `PrimaryButton` and `SecondaryButton` Are Cohesive
50px height, 12px radius, Reanimated spring press scale, haptic feedback, `ActivityIndicator` loading state, disabled state with background color change. Both buttons handle every state correctly and look native without being derivative.

### S3 — `ListRow` Component Is Production-Grade
The settings list row in `ProviderMoreScreen` and `BusinessHubScreen` uses `ListRow` with: icon container, title + subtitle, right element, badge count support, haptic feedback on press, animated highlight on press (via Reanimated), and `isFirst/isLast` radius management. This looks and feels like native iOS settings — it is one of the best-implemented components in the codebase.

### S4 — StripeConnectScreen Communicates Status Clearly
The Stripe Connect screen has four distinct states (not started / pending / active / restricted) with visual treatment for each. The auto-refresh on `AppState` resume (when returning from the Stripe browser) is a smart UX touch that eliminates the need for a manual "Check Status" button. It is one of the few screens where the business workflow is completely clear at a glance.

### S5 — Service Blueprint Wizard Earns Trust by Making AI Optional
The wizard correctly implements the "provider first, AI assists" philosophy. AI suggestions are behind secondary links ("Suggest questions for [service]"), never auto-populate, and the escape hatch to direct form editing is always visible. The step structure (Name → Pricing → Questions → Add-ons → Booking → Review) maps directly to how a business owner thinks about a service offering.

### S6 — `JobCard` and `LeadCard` Are Information-Dense Without Being Cluttered
Both cards show the right information: client name, service, time/date, location, status, price. The header-details-footer three-section layout is clear. Recurring badge on `JobCard` is compact and unobtrusive. Relative timestamps on `LeadCard` ("2h ago", "Just now") are the right choice for a leads inbox.

### S7 — Dark Mode Is Systematically Implemented
The full `Colors.dark` token set, `useTheme()` hook throughout, and `isDark` branching in `GlassCard` and the tab bar is thorough. Dark mode works across the app (with the exception of the raw `Text` in ProviderFAB).

### S8 — Haptic Feedback Is Consistent and Appropriate
Every tap, selection, and form action uses `expo-haptics`. `ImpactFeedbackStyle.Light` for navigation/selection, `ImpactFeedbackStyle.Medium` for primary actions. This is exactly correct for iOS haptic conventions.

---

## 3. Screen-by-Screen Audit

### 3.1 FirstLaunchScreen
**Polished:** Clean animated logo reveal, auto-navigates without a tap  
**Unfinished:** Nothing  
**Overall:** 9/10 — Strong first impression

---

### 3.2 AccountTypeSelectionScreen
**Polished:** Clean two-card layout, feature bullets on each card, good separation between homeowner and provider value propositions  
**Confusing:** The "Service Provider" card shows features like "Smart scheduling" and "Invoicing" — but these are tool descriptions, not benefits. A cleaner framing would be: "Run your business from your phone" rather than listing feature names  
**Overall:** 8/10

---

### 3.3 ProviderOnboardingScreen (Feature Teaser)
**Polished:** 3-step animated teaser communicates product capabilities  
**Unfinished:** The feature teaser is consumer-app style — large animated icons and marketing-style copy. A lawn care business owner who is evaluating a new booking tool wants to set up, not watch a feature slideshow  
**Too consumer-focused:** The animated pager with swipeable slides and dot indicators is how Spotify onboards new music listeners, not how B2B tools onboard businesses  
**What should be redesigned:** Consider a single-screen value statement ("Manage your entire service business in one place") with a direct "Get started" CTA, rather than a 3-step animated carousel  
**Overall:** 6/10 — Functional but wrong tone for B2B

---

### 3.4 ProviderSetupFlow (7-Step Setup Wizard)
**Polished:** Clear step counter ("Step X of 7"), provider-appropriate categories (Cleaning, Plumbing, HVAC etc.), real service area setup with zip code support  
**Unfinished:** Hours (Step 4) and First Service (Step 5) have no skip options. A new provider who wants to just get started and come back to configure hours later is stuck  
**Confusing:** "Service area" UI is zip code input only — no map visualization. Business owners think in terms of neighborhoods and cities, not zip codes  
**Overall:** 7/10

---

### 3.5 ProviderHomeScreen (Dashboard)
**Polished:** Glass greeting card with avatar, pull-to-refresh, getting started checklist that disappears when complete, staggered entrance animations  
**Unfinished:** The 4-stat grid is a raw inline implementation — no trend arrows, no comparison to prior period, no navigation hint that tapping the stat takes you somewhere  
**Cluttered:** "Business Insights" section with 3 AI-generated text rows. This section adds visual noise without actionable data  
**What should be redesigned:** Replace the "Business Insights" card with a single revenue sparkline chart (last 7 days) that maps directly to provider intent. Remove or drastically reduce AI prose copy  
**Too consumer-focused:** The greeting card ("Good morning, John") with avatar and time-of-day salutation is consumer app UX. A business owner's dashboard should open with the most important business information, not a personalized greeting  
**Overall:** 6.5/10

---

### 3.6 BusinessHubScreen
**Polished:** 4-tab structure (Profile, Services, Booking, Policies) is well-organized, inline save feedback, tab navigation with icon+label chips  
**Cluttered:** The Profile tab has: avatar upload, business name, category, bio, service area, service radius, zip codes, service cities, plus Save button. That's a lot of fields in one scroll  
**Unfinished:** The 4 tabs use custom pill-style tab navigation (not `FilterChips`, not `SegmentedControl`, not system tabs) — it's fine but is a fourth navigation paradigm in the app alongside the tab bar, screen stacks, and wizard steps  
**Overall:** 7/10

---

### 3.7 ServicesScreen
**Polished:** Eye-icon preview per service, publish/unpublish status clearly shown, FAB-adjacent navigation to add new service  
**Unfinished:** Service cards don't show pricing or category at a glance — just name and a status indicator. A provider with 10 services can't tell them apart  
**Overall:** 7/10

---

### 3.8 ServiceBlueprintWizardScreen
**Polished:** Best screen in the app for provider empowerment — correct mental model, optional AI assistance, manual entry always available  
**Unfinished:** Progress bar dots have no step labels. Provider sees 6 dots but doesn't know "I'm on step 4 of 6 (Add-ons)"  
**Overall:** 8/10

---

### 3.9 ServicePreviewScreen
**Polished:** Nothing stands out — it shows static layout correctly  
**Unfinished/Broken:** Hardcoded "What's Included" bullets and fake intake questions (confirmed from MVP audit). A provider who set up custom intake questions will see "Do you have pets?" in their preview — completely undermines trust in the wizard  
**Overall:** 3/10 — Non-functional and misleading

---

### 3.10 BookingLinkScreen
**Polished:** Toggle active/inactive, copy to clipboard, share sheet — all the right controls  
**Unfinished:** Booking link URLs truncate at card width with no expand/copy affordance visible at first glance  
**Confusing:** No way to edit an existing booking link — delete and recreate only  
**Overall:** 6.5/10

---

### 3.11 LeadsScreen
**Cluttered:** Two visually distinct list sections (intake submissions with Accept/Decline CTAs at top, then CRM leads with filter chips below) in a single scrollable list. The boundary between the two sections is unclear  
**Confusing:** Accept modal uses a plain `TextInput` for date entry while `AddJobScreen` uses `NativeDatePickerSheet` — inconsistency in the same workflow  
**Overall:** 6/10

---

### 3.12 ScheduleScreen
**Polished:** List/month toggle, date group headers ("Today", "Tomorrow", relative dates), 7-status color system  
**Unfinished:** Month calendar has no forward/back navigation. Completely stuck at the current month. The "month" toggle option is misleading since it can't navigate  
**Confusing:** `STATUS_COLOR` in this file uses hardcoded `#3B82F6` (blue) and `#F59E0B` (amber) without them being defined in `Colors`. These are invisible in dark mode adjustments  
**Overall:** 6.5/10

---

### 3.13 ClientsScreen
**Polished:** Search + filter + sort combination is powerful; relative timestamps on last message; quick-action call/message buttons on each card  
**Cluttered:** "Has Upcoming" filter chip is too verbose; `headerShown: false` forces a completely custom header that looks different from every other screen's transparent navigation header  
**Confusing:** "LTV" column — small business owners don't use this acronym; it should be "Revenue" or "Total Spend"  
**Overall:** 7/10

---

### 3.14 ClientDetailScreen
**Polished:** 6-tab detail view with rich data per tab, real message history in Messages tab, notes CRUD  
**Unfinished:** Home tab (showing client's property data) is always empty for most clients — no prompt to invite the client to link their account  
**Overall:** 7.5/10

---

### 3.15 AddJobScreen
**Polished:** Inline client picker, optional AI price estimate  
**Unfinished:** Service type picker uses hardcoded generic options instead of the provider's actual configured services  
**Overall:** 6.5/10

---

### 3.16 ProviderJobDetailScreen
**Polished:** Clear status progression button, job summary card, client info row  
**Unfinished:** Before/after photo buttons capture images but never upload them — photos are lost on restart  
**Overall:** 6/10

---

### 3.17 AddInvoiceScreen
**Polished:** Multi-line-item form with auto-calculated totals, real client and job selectors, large green total at bottom  
**Cluttered:** Three inline inputs per line item (description, qty, unit price) in a narrow card are tight on smaller screens  
**Overall:** 7.5/10

---

### 3.18 InvoiceDetailScreen
**Polished:** Full invoice lifecycle visible; `chargesEnabled` gate with user-friendly error; paid date shown clearly  
**Best screen in the app:** The invoice detail correctly surfaces all the information a business owner needs: who owes what, the line items, the status, and the actions (send, mark paid, cancel, copy link)  
**Overall:** 8.5/10

---

### 3.19 StripeConnectScreen
**Polished:** All 4 states clearly communicated, auto-refresh on AppState resume, fee breakdown is transparent  
**Unfinished:** Hardcoded test invoice fields ("Test Service", "$50.00") visible in production  
**Overall:** 8/10

---

### 3.20 FinancialsScreen
**Polished:** Date range filter, separate Invoices / Payouts transaction tabs, proper currency formatting  
**Unfinished:** 7px chart label (unreadable). "More" as a sub-tab label inside the Finance screen is confusing  
**Overall:** 6.5/10

---

### 3.21 ReviewsScreen
**Polished:** Star distribution bars, filter by rating, relative timestamps  
**Too empty:** No "Request a Review" CTA. For a new provider with 0 reviews this screen just says "No reviews yet" with no path forward  
**Overall:** 6/10

---

### 3.22 CommunicationsScreen
**Polished:** Individual and broadcast channels, client selector with count badge  
**Unfinished:** Push delivery status not surfaced (confirmed from MVP audit)  
**Overall:** 7/10

---

### 3.23 SendMessageScreen
**Polished:** Template system with merge variables is well-organized, blast mode count display  
**Unfinished:** Keyboard handling bug — `KeyboardAvoidingView` from `react-native` instead of `react-native-keyboard-controller`  
**Overall:** 6.5/10

---

### 3.24 ProviderAIAssistantScreen
**Polished:** Quick-prompt chips on empty state, real business context, animated typing indicator  
**Unfinished:** Keyboard bug — same import issue as SendMessageScreen. Microphone button is decorative  
**Overall:** 6/10 (due to keyboard bug)

---

### 3.25 ProviderMoreScreen (Settings)
**Polished:** `ListRow` component gives this the native iOS Settings feel; avatar card at top with business name and rating is the right anchor  
**Cluttered:** 13 navigation items, 2 toggles, 7 separate animated sections, Sign Out, Danger Zone. This screen does too much. The "Danger Zone" section label sounds unprofessional for a business tool  
**What should be redesigned:** Split into: a quick-access top section (availability, Stripe/payments), a business section (profile, services, booking), an account section (subscription, reviews), and a support/settings section (notifications, help, sign out). Delete the separate Sign Out section — it can be the last item in Account  
**Confusing:** "$29.99/mo" hardcoded in the ListRow subtitle for Subscription, but SubscriptionScreen is a non-functional placeholder. Business owners who tap through to manage their plan hit a dead end  
**Overall:** 5.5/10

---

### 3.26 SubscriptionScreen
**Amateur:** Shows all providers as "Pro" with no real subscription logic. The screen layout is two cards (Plan / Benefits) with a "Manage Subscription" button that does nothing useful  
**Not provider-focused:** This screen looks like a consumer app freemium paywall, not a B2B SaaS pricing screen  
**Overall:** 3/10

---

### 3.27 PublicProfileScreen
**Polished:** 3-tab view (About / Services / Reviews), "Preview mode" banner, share sheet  
**Unfinished:** Reviews tab only shows existing reviews with no "Request a review" option  
**Overall:** 7/10

---

## 4. UX Friction Points

| # | Screen | Friction |
|---|--------|---------|
| F1 | All screens | Leads and booking link management require 3 taps from any tab (MoreTab → BusinessHub → Booking tab) |
| F2 | ProviderHomeScreen | "Business Insights" AI text blocks take 1–2 seconds to populate, causing layout shift below the fold |
| F3 | ScheduleScreen | Month view is a dead end — no forward/back navigation, makes the toggle button misleading |
| F4 | ClientsScreen | No visible "Add client" button in the main list — it's in the FAB (which must be tapped first to expand) |
| F5 | LeadsScreen | Accept modal uses plain text input for date (not a date picker) — inconsistent with AddJobScreen |
| F6 | ProviderAIAssistantScreen | Keyboard blocks the text input (known bug), making the primary provider tool inaccessible |
| F7 | SendMessageScreen | Same keyboard bug — composing a message to clients is impaired |
| F8 | ProviderMoreScreen | "Subscription & Plan" row shows "$29.99/mo" but tapping it leads to a placeholder screen |
| F9 | ServicePreviewScreen | Preview shows fake hardcoded content — destroys provider confidence in the wizard |
| F10 | BookingLinkScreen | No way to edit a booking link — must delete and recreate |
| F11 | ProviderSetupFlow | Steps 4–7 have no skip option, blocking quick setup |
| F12 | ClientsScreen | Screen has `headerShown: false` with a custom header that looks different from all other tab screens |

---

## 5. Consistency Issues

### C1 — Three Separate Status Color Systems
The app defines job/lead status colors in three different places with no shared source of truth:

| File | Colors Used | Method |
|------|------------|--------|
| `StatusPill.tsx` | accent, warning, error, #3B82F6, #808080 | `getStatusColors()` function |
| `ScheduleScreen.tsx` | #3B82F6, #F59E0B, accent, #9CA3AF | `STATUS_COLOR` record (lines 74–82) |
| `ClientsScreen.tsx` (ClientCard) | accent, #3B82F6, textSecondary | Inline switch in `useMemo` |

`#3B82F6` (blue) and `#F59E0B` (amber) appear as hardcoded hex strings in at least 4 screen files, never as named tokens in `Colors`. These will not adapt to dark mode changes.

**Fix:** Add `Colors.info`, `Colors.blue`, and `Colors.amber` tokens to `theme.ts` and replace all hardcoded hex occurrences.

### C2 — `StatCard` Used in FinancialsScreen But Not Dashboard
The `StatCard` component is imported and used correctly in `FinancialsScreen`. The dashboard `ProviderHomeScreen` builds an identical visual structure (icon container + number + label) inline. The two stat displays look similar but are implemented completely differently. The dashboard version is visually simpler (no trend arrows, no subtitle), making the most-viewed screen look less polished than the Finance tab.

### C3 — `Avatar` Fallback Always Green
When a client has no photo, the `Avatar` component renders their initials on a solid `Colors.accent` green background. In a list of 20 clients without photos, every row has an identical green circle. The color is decorative here, not semantic — it should vary by name hash to create visual distinction between clients.

### C4 — Two Different Custom Headers in the Same Tab Bar
- `ClientsScreen` uses `headerShown: false` with a custom inline header (search bar + title inside a scroll view header component)
- All other 4 tabs use the navigator's transparent header with `headerTitle`

The `ClientsScreen` custom header looks noticeably different — different alignment, different background treatment, different title position.

### C5 — `FilterChips` and `PrimaryButton` Have Identical Active States
Both use `Colors.accent` fill with white text. When filter chips and action buttons appear on the same screen (e.g., ClientsScreen with filter chips + a button), the visual hierarchy is unclear — the most important action (create/submit) looks like a selected filter.

**Fix:** Differentiate: chips keep accent fill, PrimaryButton keeps accent fill — but chips should use a smaller radius and slightly reduced opacity (80%) to visually differentiate from buttons.

### C6 — `SecondaryButton` Has No Border
`SecondaryButton` uses `theme.backgroundSecondary` as its background with no border. On a card with a `theme.backgroundDefault` or `theme.backgroundSecondary` background, the secondary button is invisible against the page. It only reads as a button because of its height and label.

**Fix:** Add `borderWidth: 1, borderColor: theme.border` to `SecondaryButton`.

### C7 — Section Header Uses `Typography.title3` Directly (Not `ThemedText`)
`SectionHeader.tsx` line 50: `...Typography.title3` applied directly to `ThemedText` via spread. This works but bypasses the intent of `ThemedText`'s type system and uses the iOS-native scale name rather than the custom scale. Mixed usage across files.

---

## 6. iOS-Specific Design Issues

### I1 — `StatusPill` Is Not Pill-Shaped
`BorderRadius.sm` (8) produces a rounded rectangle. Every iOS native status badge uses `borderRadius: 9999`. This is a one-character fix that would make every status indicator in the app immediately look more native. Currently they look like label stickers.

### I2 — Two Screens Have the Wrong `KeyboardAvoidingView` Import
`client/screens/provider/ProviderAIAssistantScreen.tsx` line 9 and `client/screens/provider/SendMessageScreen.tsx` line 9 both import `KeyboardAvoidingView` from `react-native` instead of `react-native-keyboard-controller`. On iOS 17+, the built-in `KeyboardAvoidingView` with `behavior="padding"` doesn't reliably push the text input above the keyboard in screens pushed onto a stack. These are the two chat/compose screens — the most keyboard-intensive screens in the app. Both will feel broken on a physical device.

### I3 — Settings Screen Has Slow Staggered Animations (800ms to Full Load)
`ProviderMoreScreen.tsx` staggers 8 section animations from 100ms to 800ms. The entire settings list takes nearly 1 second to fully render. In iOS's native Settings app, the list renders immediately. For a screen users visit frequently (checking subscription, toggling availability), a slow fade-in feels sluggish and amateurish.

**Fix:** Reduce to a single `FadeIn` on the full screen, or use max 200ms for the full cascade.

### I4 — `ProviderFAB` Uses a `Modal` for Its Action Overlay
The FAB menu uses a `Modal` component to render the blurred action overlay. `Modal` in React Native renders above everything including the system keyboard. If the FAB is tapped while a TextInput is focused on the underlying screen, the modal will render but the keyboard may remain open, creating an awkward layered state. iOS native speed dial menus use `Animated.View` with `zIndex` elevation, not a `Modal`.

### I5 — Tab Bar Label "Finance" Is Not Descriptive Enough
The Finance tab (icon: `bar-chart-2`, label: "Finance") contains invoices, revenue data, and payouts. For a lawn care company owner, "Finance" is abstract. "Invoices" or "Money" is more concrete. This is a minor but consistently noted point in B2B tool usability testing.

### I6 — `FilterChips` Uses `BorderRadius.lg` (16) Instead of `BorderRadius.full`
Filter chips should be pill-shaped to be immediately recognizable as chips (not buttons or tags). At `BorderRadius.lg` (16), a chip with short text like "All" looks almost rectangular. At `BorderRadius.full`, it reads as a tap target immediately.

### I7 — `TextField` Has No Visible Unfocused State (Border Width = 0)
When unfocused, `TextField` has `borderWidth: 0`. The input field is distinguished from the background only by a slightly different background color (`theme.backgroundSecondary`). On light mode, `backgroundDefault: "#F5F5F5"` and `backgroundSecondary: "#EEEEEE"` are only 7 points of lightness apart — nearly indistinguishable. This means forms with multiple unfocused fields look like flat surfaces with no affordance to tap.

**Fix:** Add a hairline border when unfocused: `borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border`.

---

## 7. Final Verdict on Launch Polish

### Scores Explained
**Design: 7/10** — The design language is clear and the component library is mostly solid. What holds it back is fragmented execution: two type scales, three color systems, inconsistent component reuse, and a few screens (Dashboard, MoreScreen) that feel noticeably less polished than the best screens (InvoiceDetail, StripeConnect, ServiceWizard).

**Provider Trust: 6/10** — The functional core is there. But: leads are buried, the subscription screen is fake, the "$29.99/mo" is a lie, the chart is unreadable, and Service Preview shows wrong data. A real business owner can tell when software is half-finished. The trust issues are fixable in days, not weeks.

**iOS Quality: 7/10** — Glass cards, haptics, spring animations, and the ListRow component are all native-quality. The keyboard handling bugs on the two chat screens, the non-pill StatusPill, the 800ms settings animation, and the 7px chart label are what pull the score down.

### Pre-Launch Design Fixes (Estimated Time)
| Fix | Screen/File | Time |
|-----|------------|------|
| `StatusPill` → `borderRadius: 9999` | `StatusPill.tsx` | 5 min |
| Fix `TextField` focus state (same bg both states) | `TextField.tsx` | 5 min |
| `ProviderFAB` → use `ThemedText` for labels | `ProviderFAB.tsx` | 10 min |
| Bar chart peak label → minimum `fontSize: 11` | `FinancialsScreen.tsx` | 5 min |
| Fix keyboard import in AI chat screen | `ProviderAIAssistantScreen.tsx` | 10 min |
| Fix keyboard import in SendMessage | `SendMessageScreen.tsx` | 10 min |
| Remove/hide test invoice section in Stripe screen | `StripeConnectScreen.tsx` | 15 min |
| Add `Colors.info` and `Colors.amber` to theme | `theme.ts` | 20 min |
| Add `SecondaryButton` border | `SecondaryButton.tsx` | 5 min |
| Reduce MoreScreen stagger animations | `ProviderMoreScreen.tsx` | 15 min |
| Remove hardcoded "$29.99/mo" or label as "Coming Soon" | `ProviderMoreScreen.tsx` | 10 min |

**Total for pre-launch polish fixes: ~2 hours**

### Post-Launch Design Improvements (v1.1)
1. Replace inline stat grid in Dashboard with `StatCard` components (+trend data)
2. Surface Leads as a tab or dashboard card with badge notification
3. Add step name labels to wizard progress bar
4. Fix month calendar navigation
5. Replace AI prose "Business Insights" with a revenue sparkline
6. Collapse ProviderOnboarding from 3-step animated carousel to a single direct screen
7. Add name-hash color variation to `Avatar` fallback backgrounds
8. Add `FilterChips` radius to `borderRadius.full`
9. Consider merging type scales in `ThemedText` to expose iOS HIG names

### Go/No-Go
**No-Go in current state for two reasons:**
1. The keyboard bugs in ProviderAIAssistantScreen and SendMessageScreen make two of the most important daily-use screens feel broken on physical devices
2. ServicePreviewScreen showing hardcoded fake content destroys the credibility of the entire service setup wizard

Fix those two items plus the "$29.99/mo" trust issue, and the app is ready for a limited provider beta. The 2-hour list above makes it beta-ready. The v1.1 list makes it launch-ready for the App Store.
