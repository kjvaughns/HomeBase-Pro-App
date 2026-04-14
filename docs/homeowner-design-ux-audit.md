# HomeBase Homeowner App — Design & iOS UX Audit
**Date:** April 14, 2026  
**Auditor Role:** Senior Product Designer / iOS UX Reviewer  

---

## Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Overall Design Quality** | **6.8 / 10** | Strong system, weak entry experience |
| **iOS Native Feel** | **7.5 / 10** | Glass cards + BlurView header + haptics are excellent; a few web-ish patterns remain |
| **Trust & Polish** | **6.2 / 10** | Core flows are polished; welcome/onboarding and tool screens undercut trust |

---

## 1. Biggest Design Problems (Ranked by Impact)

### P1 — WelcomeScreen has zero emotional pull
This is your first impression. It shows a logo, a bland tagline ("Your home, simplified"), and a checklist of 4 generic bullet points (find a pro, book appointments, chat, access tools). This reads like a B2B SaaS login page, not a consumer home app that should evoke warmth, safety, and trust. There is no hero visual, no photography, no gradient — just a white screen with a list. For a product that competes with Thumbtack and Angi, this will not convert.

### P2 — Onboarding is two steps and feels abandoned
HomeownerOnboarding has exactly two steps: a priority multi-select and "You're all set!" That's it. The user is never asked to add their home address during onboarding. This means the first time they hit the app, they're staring at a dashboard with empty stats (0 bookings, no home info) and no natural next action. The home address step from the post-auth `OnboardingScreen` (via AddressAutocomplete) exists but is disconnected from the main onboarding flow for many paths.

### P3 — HomeScreen is dead for new users
When a user has zero appointments, the HomeScreen shows: a greeting header, a row of StatCards (all showing 0 or nothing), a small "No bookings yet" empty state card, and a 3-column category grid. The stats cards are useless for new users and create a hollow, abandoned feeling. The category grid is the only real action available, but it's small and low-contrast. There is no single dominant CTA guiding the user to their first booking.

### P4 — The tools section feels like a prototype
BudgeterScreen, SurvivalKitScreen, SavingsSpendScreen, and ServiceHistoryScreen all contain hardcoded or MOCK data. A real user who taps "Budgeter" will see pre-filled budget categories that are not theirs. A user who taps "Service History" sees a timeline of mock service entries with fake providers. This is a significant trust issue: users may assume they are seeing real data and be confused, or they may realize the data is fake and feel deceived.

### P5 — SmartIntake vs AI Chat creates navigational confusion
There are two AI-powered entry points: the AIChatScreen (general home advice) and SmartIntakeScreen (AI intake for booking). Both are accessible from FindScreen. For a new user, it is unclear when to use which. The distinction is buried in the UI with no clear framing.

### P6 — HealthScoreScreen wizard has 14 questions with no skip option
The Home Health Score requires completing a 14-question wizard. There is a progress indicator, but there is no "I don't know" escape hatch, no "Skip this question" option, and no way to see results without completing all 14 questions. For a new user trying to understand the app's value, 14 questions is a steep entry cost.

### P7 — "Continue as Guest" on WelcomeScreen is a ghost link
The "Continue as Guest" option is implemented as a plain `Pressable` with a text label in `theme.textSecondary`. It has no clear tap affordance, looks like disabled text, and has a small tap target (`paddingVertical: Spacing.md` = 12px only). Guests exploring the app will struggle to see this as a clickable option.

---

## 2. Highest Impact Design Improvements

1. **Redesign WelcomeScreen** — Full-bleed hero image of a beautiful home interior or exterior, a short emotional headline ("Your home deserves the best."), and just two primary CTAs. Remove the feature checklist.
2. **Add address onboarding step** — Insert home address capture into HomeownerOnboarding step 2 (before "You're all set!"). Auto-focus, pre-validate, skip option with "Add later" link.
3. **Redesign HomeScreen for new users** — Show a contextual empty state: a large "Find your first pro" CTA card that opens FindScreen, with sub-text "Trusted pros in your area, vetted and rated." Hide the StatCards until the user has at least one booking.
4. **Label or gate the mock tool screens** — Either replace the MOCK data with "Add your info to see real data" empty states, or add a "Preview" label/badge to those tool cards in MoreScreen.
5. **Consolidate AI entry points** — Merge SmartIntake and AIChatScreen under one entry point. Use conversational intent detection to route users: if intent = service need → booking flow; if intent = advice → chat mode.
6. **Add "I don't know" to HealthScore wizard** — Neutral answer option on every question. Update scoring algorithm to treat it as neutral (50% weight for that category) rather than blocking.
7. **Improve "Continue as Guest"** — Add underline styling and increase tap target to at least 44px height. Alternatively, style it as a ghost button with a full-width border.

---

## 3. Screen-by-Screen Design Audit

---

### Entry & Auth Screens

#### SplashScreen / FirstLaunchScreen
- **What's great:** Animated entrance, logo-first approach.
- **What's messy:** Cannot verify from code. Unknown if it has brand depth or is just a logo on white.
- **iOS native:** Standard approach, acceptable.

#### WelcomeScreen
- **What's great:** Clean layout, proper safe area handling, correct button hierarchy (`PrimaryButton` > `SecondaryButton` > ghost Pressable).
- **What's messy or unfinished:** No visual hero, no photography, no depth. Four feature rows with circular icon containers feel like a generic marketing checklist. App name in `h1` + tagline "Your home, simplified" is forgettable.
- **What's off-brand:** The feature list format is a B2B SaaS pattern. HomeBase should feel like a premium consumer app.
- **What feels cheap:** The `featureIcon` circle uses `theme.backgroundSecondary` (a near-white background) — it's barely visible in light mode. The icons feel like filler.
- **What needs redesign:** The entire upper section. Replace with a full-bleed photo, a single punchy headline, and let the CTAs do the work. Remove the feature list.
- **Already strong:** Button hierarchy, safe area handling, overall spacing structure.

#### LoginScreen / SignUpScreen
- **What's great (from architecture):** `TextField` with icon support, `KeyboardAwareScrollViewCompat`, validation states, proper loading/disabled state on submit button.
- **What's off:** Cannot assess specific visual quality from code without screenshots. Common risks: form labels above inputs may be too small, error messages may be too close to the field.
- **iOS native:** Using custom TextFields is correct. Avoid relying on native Android-style underline inputs.

#### HomeownerOnboardingScreen
- **What's great:** Spring animation between steps, priority chip selection with accent color highlight, haptics on selection.
- **What's messy:** Step 2 is "You're all set!" — this feels rushed. The step exists only to confirm completion, it adds no value and has no action to perform.
- **What's missing:** Home address capture, a brief explanation of what HomeBase will do for the user, and a more celebratory completion state.
- **Too empty:** Step 2 is a dead screen — just text and a button.

---

### Core Discovery Flow

#### HomeScreen (Dashboard)
- **What's great:** `largeTitle` (34px) greeting with `Avatar` is premium. `GlassCard` for upcoming appointments is appropriately elevated. Category grid provides quick service access. Staggered `FadeInDown` entrance animation is polished. `RefreshControl` with accent color is on-brand.
- **What's messy:** StatCards showing 0s for new users create a hollow, number-heavy layout that communicates nothing positive. The 3-column `31%` width category grid can feel cramped and unbalanced — 31% doesn't divide evenly, leaving visual gaps.
- **What's off-brand:** The greeting section takes a lot of vertical space. For a premium app, real estate should be earned by useful content, not just a large name.
- **What feels too cluttered:** When the user has active appointments, the screen tries to show: header + stats + upcoming appointments + categories + AI prompt. Too many competing sections.
- **What feels too empty:** For a new user, the screen is mostly dead. StatCards with zeros, empty appointment area, and a generic category grid communicate no value.
- **iOS native:** Correct use of transparent header + `headerHeight` for content inset. `ScrollView` with `contentContainerStyle` is correct.
- **Needs redesign:** StatCards for new users. Show contextual onboarding action instead.

#### FindScreen
- **What's great:** Search bar at top, filter chips (horizontal scroll), integrated category selector. Live search with category chips is an excellent pattern for service discovery.
- **What's messy:** The dual filter system (category tabs + keyword search) may cause interaction confusion — if a user searches "plumber" while on the "HVAC" tab, which wins?
- **What's off-brand:** Nothing critically off-brand here.
- **iOS native:** Horizontal `ScrollView` for filter chips is the standard iOS pattern (like App Store genre pills). Correct.

#### ProviderListScreen
- **What's great:** `ProviderCard` with Avatar, StatusPill, rating, and price metadata. Staggered animation per card (50ms delay). Pull-to-refresh with accent tint.
- **What's messy:** Without knowing the ProviderCard image approach, if providers don't have an avatar image, initials-based avatars may look too generic at scale.
- **What needs improvement:** Consider adding a map view toggle for providers near the user's home — for a home services app, proximity is a key trust signal.
- **Too empty:** When 0 providers match, the empty state uses a generic `search` icon. Should show a location-aware "No pros near you" message with a "Broaden your search" CTA.

#### ProviderProfileScreen
- **What's great:** Tabbed interface (About / Services / Reviews) is the correct pattern. Action row (Book Now, Call, Text, Save) is functional. Business hours list with closed days greyed out is clear. Service area chips are scannable.
- **What's messy:** The tabbed content below a header full of info (name, rating, business details) means the page is already 40% scrolled before reaching tabs. On a small iPhone, the initial view is visually dense.
- **What's missing:** Work photos. For a home services app, provider photo galleries are a primary trust signal (this is how Thumbtack closes bookings). A `photosRow` of past work would significantly improve conversion.
- **What's too cluttered:** The action row with 4 buttons (Book Now, Call, Text, Save) — "Call" and "Text" are fine, but two CTA-style buttons plus a ghost-style save icon is inconsistent. The `Save` heart icon should be in the header, not the action row.
- **iOS native:** Tab implementation with animated transitions is correct. `useHeaderHeight` for safe area is correct.

---

### Booking Flow

#### SmartIntakeScreen
- **What's great:** Step-based AI intake is an excellent pattern. "Try these" suggestion chips reduce first-use friction. `SlideInRight`/`SlideOutLeft` directional transitions feel like progress.
- **What's messy:** The GlassCard showing "AI Analysis" (Summary + Severity pill) while asking follow-up questions is a nice touch but the severity pill (e.g., "High Priority") could alarm users unnecessarily. Should be "Need Attention" or similar softer language.
- **What's off-brand:** Nothing critical.
- **Navigational issue:** Users coming from the home AI Chat and from SmartIntake land in visually similar but functionally different flows, creating inconsistency.

#### SimpleBookingScreen
- **What's great:** Summary card at top maintains context. Date selection as horizontal cards is better than a traditional calendar. Dynamic intake form generation from JSON is technically impressive. Floating "Book Appointment" button ensures the CTA is always accessible.
- **What's messy:** The date selection chips are small — confirm they're at least 44px tall for tap targets. If the provider has 10+ available services, the vertical list becomes very long before the intake questions section.
- **What's off-brand:** Nothing critical.
- **Too cluttered:** For complex bookings (service selection + date + time + multiple intake questions), the screen can become a very long scroll with no visual section breaks. Consider collapsing completed sections.
- **iOS native:** `KeyboardAwareScrollViewCompat` is the correct choice here. Floating button with proper `insets.bottom` padding is correct.

#### BookingSuccessScreen
- **What's great:** `ZoomIn` animation on checkmark circle is satisfying. Stack reset via `CommonActions.reset` prevents back-navigation into booking form. Haptic success notification on mount.
- **What's too subdued:** The success state should be more celebratory for what is a key conversion moment. Consider a confetti/particle animation overlay (Lottie) — this is a paid action and should feel like a win.
- **What's too empty:** The summary card is good but sparse. Add "Your provider will confirm within X hours" as a next-step expectation setter.

---

### Appointment Management

#### ManageScreen
- **What's great:** `SkeletonCard` for loading is excellent — no layout shift. Status tab bar (Upcoming / Active / Past) is correct. `GlassCard` appointment items with StatusPill hierarchy are clean.
- **What's messy:** Tab bar across the top is a common iOS pattern but if all three states are empty at once (new user), the screen may feel like a list of nothing.
- **What's too cluttered:** When active appointments exist, the card shows service name, provider, status pill, date, time, and estimated price. Six data points per card is at the limit of readable density.
- **iOS native:** Correct header height handling. Correct tab layout.

#### AppointmentDetailScreen
- **What's great:** Full job detail with provider contact info, cancel/reschedule actions. GlassCard layout is clean.
- **What's messy:** Cannot fully assess from code, but cancel/reschedule as destructive/secondary actions need to be clearly separated from primary job actions (pay, review) visually.

#### JobDetailScreen
- Similar strengths to AppointmentDetailScreen. The job status progression should be visually represented (a status timeline would be more premium than just a StatusPill).

#### PaymentScreen
- **What's great:** Invoice card with clear "Total Due" in `Typography.title1` is premium. Saved card banner with card brand + last 4 digits + colored border is an excellent UX pattern. Success view with check-circle is satisfying.
- **What's missing:** A breakdown of the total (labor, materials, tax) before the pay button would increase trust and reduce hesitation for larger invoices.
- **iOS native:** Stripe's native payment sheet is the correct approach. Good.

#### ReviewScreen
- **What's great:** Star rating with haptic feedback and color transition (`Colors.accent` for active stars) is polished. Comment `TextInput` with character guidance. Tips section for review quality. Error and success states implemented.
- **What's messy:** The star rating implementation uses individual `Pressable` for each star — confirm the touch target for each star is at least 44px.
- **What's too empty:** After submitting, what happens? The screen should animate to a "Thank you" confirmation state before navigating back, not just dismiss.

---

### Profile & Settings

#### ProfileEditScreen
- **What's great:** TextField with `leftIcon` for each field (user, phone) is clear affordance. `KeyboardAwareScrollViewCompat` is correct. Save button disabled during submission with ActivityIndicator.
- **What's messy:** Avatar editing is missing. A profile photo is a primary trust signal for homeowners when communicating with providers.
- **What feels cheap:** No photo upload capability means the profile always shows initials. For a premium consumer app, initials are a fallback, not the intended state.

#### MoreScreen
- **What's great:** Settings list with section grouping is the standard iOS settings pattern. Consistent Feather icons for each row.
- **What's messy:** "More" as a tab label is a common anti-pattern in iOS apps — it implies everything that didn't fit elsewhere. Consider renaming to "Account" or using a person icon only.
- **What's off-brand:** Generic settings list is standard but lacks the premium feel of the rest of the app. Consider grouping sections under GlassCard containers.

#### NotificationsScreen
- **What's great:** Real notification data with mark-read functionality. Empty state for no notifications.
- **What needs improvement:** No visual distinction between read and unread notifications beyond a text indicator. Standard iOS pattern is a subtle left border accent or background tint on unread items.

---

### Homeowner Tools

#### HealthScoreScreen
- **What's great:** SVG ring chart for score with color gradient (green → orange → red) is visually impactful. The 5-category breakdown (Safety, Water, Energy, Comfort, Exterior) is structured. Tab views (Score / Plan / History) are appropriate. Haptics throughout the 14-question wizard.
- **What's messy:** 14 questions with no skip option or "I don't know" answer is too demanding. Users who don't know their HVAC filter age should not be blocked from getting a score.
- **What's off-brand:** The wizard uses generic Pressable option cards. For a premium health-score experience, the option cards could use more visual weight (color indicators, icons per option).
- **Too cluttered:** The results screen has three tabs (Score, Plan, History) each with multiple sections. The "Plan" tab shows action cards with cost estimates — this is valuable but visually dense.
- **Needs redesign:** The wizard progress bar is the only orientation — consider also showing the question number ("Question 7 of 14") for user control.

#### HouseFaxScreen
- **What's great:** Real API data from HouseFax enrichment. Multi-tab report (Overview, Timeline, Assets, Insights) is comprehensive.
- **What's too technical:** "HouseFax" as a concept is jargon-heavy. The interface with multiple tabs of home data may feel like a property inspection report, not a consumer-friendly home app feature.
- **What feels cheap:** The data enrichment (Google Places, Zillow-style) shown as raw JSON-style lists needs custom UI treatment to feel premium.

#### ServiceHistoryScreen
- **What's messy or unfinished:** MOCK_SERVICE_ENTRIES and MOCK_PAST_PROVIDERS are visible to real users. The vertical timeline and provider cards are architecturally correct but the fake data destroys trust.
- **What needs to happen:** Replace mock data with "No service history yet. Your completed bookings will appear here." empty state.

#### BudgeterScreen
- **What's messy or unfinished:** Hardcoded BUDGET_CATEGORIES and RECENT_TRANSACTIONS. Users see budget data that isn't theirs, which is a trust-breaking experience for any financial-adjacent feature.
- **What needs to happen before launch:** Gate this screen with "Coming soon" or clear the hardcoded data and show an empty onboarding state.

#### SurvivalKitScreen
- **What's great:** 14-step maintenance wizard is well-structured. Directional animations are correct. Contextual help text on each step is useful.
- **What's messy:** MOCK_TASKS in the plan output means the completed plan is hardcoded, not based on wizard answers. The wizard feels fake because its results don't reflect user input.
- **What feels cheap:** If a user says "I have a flat roof" in the wizard and the plan still shows "Inspect pitched roof shingles" from MOCK_TASKS, the entire experience collapses.

#### SavingsSpendScreen
- **What's messy:** MOCK_CATEGORIES and MOCK_SAVINGS_WINS. Same trust issue as BudgeterScreen.
- **What needs to happen before launch:** Show empty state ("Complete your first booking to track spending.").

#### SavedProvidersScreen
- **What's great:** Real saved provider data from homeownerStore (AsyncStorage-backed). Correct.
- **What's messy:** Pull-to-refresh is a 1-second fake delay with no real refresh logic. Minor but discoverable.

---

## 4. UX Friction Points

| Friction Point | Location | Severity |
|----------------|----------|----------|
| 14 questions with no skip/neutral answer | HealthScoreScreen wizard | High |
| No dominant first CTA for new users | HomeScreen | High |
| Feature checklist replaces emotional welcome | WelcomeScreen | High |
| MOCK data visible in tool screens | Budget, SurvivalKit, ServiceHistory, Savings | High |
| Two separate AI entry points with no clear distinction | FindScreen | Medium |
| No profile photo upload | ProfileEditScreen | Medium |
| No work photo gallery on provider profiles | ProviderProfileScreen | Medium |
| No job status timeline (visual progression) | AppointmentDetailScreen | Medium |
| No booking cost breakdown before payment | PaymentScreen | Medium |
| "Review submitted" success is implicit (screen dismisses) | ReviewScreen | Medium |
| "More" tab label is generic | Tab bar | Low |
| Star tap targets need verification (44px min) | ReviewScreen | Low |
| Date chip tap targets need verification | SimpleBookingScreen | Low |
| Severity language in AI analysis ("High Priority") may alarm | SmartIntakeScreen | Low |
| Fake pull-to-refresh (1s timeout) | SavedProvidersScreen | Low |

---

## 5. Visual Consistency Issues

1. **Two button patterns for destructive actions** — Some screens use a red-tinted secondary button for cancel/delete, others use a ghost Pressable with red text. Standardize: always use outline button with `Colors.error` border for destructive actions.

2. **GlassCard vs ThemedView mix** — The majority of screens use GlassCard correctly, but some sections fall back to plain ThemedView with custom background styles. This creates subtle visual inconsistency in elevation/depth.

3. **Feather icon sizing inconsistency** — Screen-level Feather icons range from size 14 (small metadata) to size 24 (action row) but there's no explicit rule in the design system. Some screens use 18, others 20, others 24 for similar-importance icons.

4. **StatCard vs plain text for key numbers** — HealthScoreScreen uses a large SVG ring (excellent). BudgeterScreen uses a hero card (good). HomeScreen uses StatCard components. ServiceHistoryScreen uses inline text. Four different treatments for "key metrics" across the app.

5. **StatusPill colors need audit** — The `inProgress` status variant should use `Colors.warning` not `Colors.info` — a job in progress requires attention, not just information.

6. **Typography at screen borders** — Some screens use `Typography.largeTitle` (34px) for the main heading, others use `Typography.title1` (28px), others `Typography.title2` (22px), without a consistent rule for which to use when.

---

## 6. iOS-Specific Issues

1. **`useNativeDriver: false` in onboarding transitions** — `HomeownerOnboardingScreen` uses `Animated` (legacy) with `useNativeDriver: false` for the fade/slide transition. This runs on the JS thread and may jank on older iPhones. Replace with `react-native-reanimated` for fluid 60/120fps animation.

2. **Transparent header + scroll behavior** — The transparent blur header is excellent on iOS 26 but needs validation that the blur effect activates correctly when content scrolls underneath. If GlassCard content scrolls behind the header without the blur engaging, it looks broken.

3. **Liquid Glass / GlassEffect** — The app correctly uses `expo-glass-effect` GlassView and falls back on unsupported platforms. Confirm `glassEffectStyle='regular'` is used for interactive glass surfaces and `'clear'` for non-interactive — mixing these breaks the iOS 26 design intent.

4. **Haptic pattern consistency** — The app uses three haptic types but the selection is not always semantically appropriate:
   - Star rating → `selectionAsync` ✓ (correct)
   - Booking → `ImpactFeedbackStyle.Heavy` ✓ (correct weight for a major action)
   - Alert/error → `NotificationFeedbackType.Error` ✓ (correct)
   - But: category card taps should use `selectionAsync`, not `impactAsync`.

5. **Missing Dynamic Type support** — The typography system uses fixed pixel sizes (e.g., `fontSize: 34` for `largeTitle`). iOS users who have increased their Dynamic Type size will see the same small text as everyone else. For a home services app targeting a broad age range (including older homeowners), Dynamic Type matters.

6. **Safe area on landscape** — Not audited but landscape use cases (common on iPad) should be confirmed — `useSafeAreaInsets` handles this but confirm no hardcoded padding values override it.

7. **`Alert.alert` usage** — A few screens (notably `ProviderProfileScreen` which imports `Alert`) may use `Alert.alert` for confirmation prompts. Per the development guidelines, this is not recommended for testing and should be replaced with custom modal sheets.

---

## 7. Final Verdict: Is This Design Launch Ready?

**Overall: Almost launch ready for the core flows. Not ready as a complete premium consumer product.**

### Ready to ship:
- The core booking funnel (Find → Provider Profile → Book → Manage → Pay → Review) is architecturally correct and has premium surface-level polish: glass cards, haptics, animated transitions, correct iOS navigation patterns, and consistent component usage.
- The chat/AI intake flows are well-designed and differentiated from competitors.
- The payment screen is clean and trustworthy.
- The tab bar (floating, BlurView, adaptive sizing) is genuinely premium.

### Not ready to ship:
- **WelcomeScreen** — Does not make a quality first impression for a consumer app competing with Thumbtack/Angi. This is the most important screen in the app and it needs a full redesign.
- **Tool screens with mock/hardcoded data** — Budgeter, Service History, Survival Kit, Savings all show fake data to real users. This is a trust-breaking bug, not a design issue. Must be resolved before launch (show empty states, not fake data).
- **HomeScreen new user experience** — The empty state for new users needs a strong, clear CTA. Showing StatCards with zeros is actively counter-productive for first-run conversion.

### The gap to close:
The foundation is 70% of the way to a premium consumer app. The glass aesthetic, component consistency, haptics, animations, and iOS navigation patterns are genuinely good. What's missing is the emotional layer at the top of the funnel (WelcomeScreen, onboarding) and the integrity layer in the tools section (no fake data). Fix those two areas and this is a 7.5+ design.
