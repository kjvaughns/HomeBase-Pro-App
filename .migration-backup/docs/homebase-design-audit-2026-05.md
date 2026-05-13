# HomeBase — Complete Design Audit (May 2, 2026)

**Audit type:** Design-only (visual / layout / theming / iOS-feel / a11y / states / animation).
**Out of scope:** Backend / API correctness (covered by `provider-portal-audit-may-2026.md`, `docs/homeowner-portal-audit-2026-05.md`, `BACKEND_AUDIT.md`), security (`threat_model.md`), web-only quirks beyond fallback gaps, and the marketing landing page / `static-build/`.
**Replaces / supersedes for design-only purposes:** `provider-design-audit-report.md` (Apr 14, 2026) and `docs/homeowner-design-ux-audit.md` (Apr 14, 2026). Those two files remain valid for context and for the historical "what was flagged" record.
**Companion:** the prioritized fix list in §10 directly feeds the queued follow-up implementation task ("HomeBase design fixes pass (P0 / P1 / P2)").

---

## 0. Method and ground rules

- Every code reference is anchored to `path:line` (or `path:line-line`) so the implementation task can locate it without a second hunt.
- Severity labels: **Critical** (broken / trust hit / blocks ship), **High** (visibly off-brand or off-pattern), **Medium** (polish), **Low** (nice-to-have).
- "One accent rule" is `#38AE5F` per `design_guidelines.md` and `replit.md`. Anything else loud is treated as a violation unless it's an icon-only semantic cue with neutral text.
- iOS-26 Liquid Glass is the target system feel for headers, tab bars, key cards, modals, and status pills.
- Every screen audit ends in a one-word verdict: **Polished / Needs polish / Trust hit / Broken**.

### Visual ground truth

Screenshots of the live web build (port 8081 via Expo Web) were captured against the surfaces reachable through the app's `linking.config` deep links (`SimpleBooking`, `Subscription`, `payment-result`, `job/:jobId`, `invoice/:invoiceId`) plus the public `/AccountTypeSelection` route. Saved under `docs/audit-screenshots/`:

| File | Surface | What it shows |
|---|---|---|
| `01-account-type-selection-web.png` | `AccountTypeSelectionScreen` | Header + intro copy render; the two role-selection cards do **not** render on web (they use native-only `expo-glass-effect` `GlassView`, which falls back silently). Audit-relevant: confirms the Liquid Glass cards lack a usable web fallback (gap added to §6 "Liquid Glass coverage"). |
| `02-subscription-web.png` | `SubscriptionScreen` (provider) | Fully renders. Trial / Subscribe primary button, footer links use `Colors.accent`. Useful baseline for §5 SubscriptionScreen findings. |
| `03-simple-booking-error-boundary-web.png` | `SimpleBookingScreen` | Triggers `ErrorBoundary` ("Something went wrong / Try Again") immediately on web. New audit finding (logged in §6 "Cross-cutting" and reflected in §5). |
| `04-payment-result-loading-web.png` | `PaymentScreen` (Stripe return) | Header renders ("Pay Invoice") then stalls on the green ring spinner with no skeleton, no empty-state, and no error after timeout when the invoice id is invalid. Reinforces §6 "Loading / empty / error consistency". |
| `05-job-detail-loading-web.png` | `JobDetailScreen` (homeowner) | Same stuck-spinner pattern as `04`. |
| `06-invoice-detail-loading-web.png` | `InvoiceDetailScreen` (provider) | Same stuck-spinner pattern as `04` and `05`. |

The Expo web preview on port 5000 (the static-build manifest router) does not bootstrap the JS bundle in a browser — it's wired for `exps://` deep linking into Expo Go and was the cause of the splash-only output observed during initial capture attempts. The screenshots above were therefore taken via the dev server on port 8081, which is the only path to real web output from this environment. Authenticated, in-tab screens (Homeowner Home / Find / Manage, Provider Home / Schedule / More, BusinessHub, ServiceSummary, StripeConnect, Financials) cannot be reached over the web preview because `linking.config` does not expose those routes and there is no test-account auto-login. Capturing those surfaces requires a real iOS device run — the implementation task should add `before-<n>-<screen>.jpg` / `after-<n>-<screen>.jpg` pairs from device alongside the web shots already on disk.

---

## 1. Re-verification of April 14 audit findings

Every concrete bug from `provider-design-audit-report.md` and `docs/homeowner-design-ux-audit.md` was re-checked against current code with `rg`. Status as of May 2:

| April 14 finding | Source | Status today | Evidence |
|---|---|---|---|
| `StatusPill` not actually pill-shaped | `client/components/StatusPill.tsx:69` | **Open** | `borderRadius: BorderRadius.sm` (= 8). Never changed to `BorderRadius.full`. |
| `FinancialsScreen` 7px chart label | `client/screens/provider/FinancialsScreen.tsx:268` | **Open** | `fontSize: 7` confirmed; line 304 also has `fontSize: 8`; lines 321, 693, 703 use `fontSize: 11`. |
| `TextField` invisible focus state | `client/components/TextField.tsx:35-37` | **Open** | Both branches of the focus-vs-resting `backgroundColor` ternary resolve to `theme.backgroundSecondary`; focus is conveyed only by border + 1.5px width (lines 55, 63). Functional but visually subtle. |
| Chat screens importing `KeyboardAvoidingView` from `react-native` | various | **Open in 7 files** | `AddInvoiceScreen.tsx`, `ReviewsScreen.tsx`, `ProviderAIAssistantScreen.tsx`, `SendMessageScreen.tsx` (provider) + `SmartIntakeScreen.tsx`, `ReviewScreen.tsx`, `AIChatScreen.tsx` (homeowner). Should import from `react-native-keyboard-controller`. |
| `ProviderFAB` raw `<Text>` | `client/components/ProviderFAB.tsx:241` | **Open** | Confirmed raw `<Text>` (also imports `Text` from `react-native` at line 5). Breaks dark-mode text color and the "all text via `ThemedText`" rule. |
| `StripeConnectScreen` test defaults still in production code | `client/screens/provider/StripeConnectScreen.tsx` | **Open** | Lines 371 ("Create Test Invoice"), 419 (`placeholder="e.g. Plumbing Repair"`), 426 (`placeholder="50.00"`), 472 ("No invoices yet. Create one above to test."). The whole "Create Test Invoice" UI is shipped to providers. |
| `ServicePreviewScreen` "Do you have pets?" placeholder | n/a | **Closed (file deleted)** | No `ServicePreviewScreen` anywhere in `client/`; `rg "Do you have pets"` returns zero matches. Replaced by `ServiceSummaryScreen.tsx` and `BookingLinkScreen.tsx`. |
| "$29.99/mo" hardcoded subtitle on Subscription row | n/a | **Closed** | `rg "29.99"` returns zero matches in `client/`. |
| `Colors.info` / `Colors.amber` referenced but undefined | n/a | **Closed in usage, still undefined in tokens** | `rg "Colors\.info\|Colors\.amber"` returns zero matches in `client/`. The tokens are still missing from `client/constants/theme.ts:3-59` (no `info`, no `amber`), but no code now reads them. **However**, screens have re-introduced the same colors as raw hex (see §2 and §5 — `#3B82F6`, `#F59E0B`, `#34C759`, `#FF9F0A`, `#EF4444`, `#FF3B30`, `#FF453A`, `#AF52DE` are all still present), so the underlying problem ("we have no semantic palette beyond accent/success/error/warning") persists, just expressed differently. |
| `SecondaryButton` border issue | `client/components/SecondaryButton.tsx` | **Changed** | Current implementation uses `theme.backgroundSecondary` as a fill (line 69) with `BorderRadius.button` (line 93) and no border. That's a deliberate "subtle filled secondary" style now, which works visually but no longer matches the `design_guidelines.md` spec (line 141: "transparent background, #38AE5F border 1.5px, #38AE5F text"). Either the spec or the component needs to move. |
| `ProviderMoreScreen` ~800ms stagger | `client/screens/provider/ProviderMoreScreen.tsx:144-382` | **Open** | The stagger is implemented as `FadeInDown.delay(index * 100).duration(400)` with the last decorated row at `delay(800)` (line 382). End-to-end first-paint reveal is roughly 800ms–1.2s, which is sluggish for a Settings-style list. |
| Dual typography scales | `client/components/ThemedText.tsx:9` + `client/constants/theme.ts:116-228` | **Open** | `theme.ts` defines two parallel scales: iOS HIG (`largeTitle / title1 / title2 / title3 / headline / body / callout / subhead / footnote / caption1 / caption2`, lines 117-182) **and** a generic web scale (`display / h1 / h2 / h3 / h4 / body / small / caption / label / link`, lines 184-228). `ThemedText`'s `type` prop only exposes the second scale (`display | h1 | h2 | h3 | h4 | body | small | caption | label | link`, line 9). The HIG scale is therefore unreachable through the public component API, but is consumed directly via `Typography.headline / .body / .footnote / .title2` etc. in 30+ files (see `rg "Typography\.(largeTitle\|title1\|title2\|title3\|headline\|body\|callout\|subhead\|footnote\|caption1\|caption2)"`). Result: the design system is silently bilingual. |

---

## 2. Design tokens (`client/constants/theme.ts`)

### 2a. What's there
- `Colors`: accent (single — `#38AE5F`), accentLight, accentPressed; semantic success/error/warning + each `*Light`; full `light` and `dark` palettes (text/textSecondary/textTertiary, three background tiers, separator, glass background/border/overlay, overlay, cardBackground).
- `Spacing`: T-shirt scale `none → 6xl`, plus semantic aliases (`screenPadding`, `cardPadding`, `sectionGap`, `itemGap`, `inputHeight`, `buttonHeight`, `buttonHeightSmall`, `listRowHeight`, three icon sizes, three avatar sizes, `tabBarHeight`, `headerHeight`, `largeTitleHeight`).
- `BorderRadius`: T-shirt scale `none → full`, plus semantic aliases (`card`, `button`, `buttonPill`, `input`, `iconContainer`, `avatar`, `modal`).
- `Typography`: 21 entries in two parallel scales (see §1).
- `Shadows`: 6-step scale (`none → xl`).
- `GlassEffect`: intensity / opacity tuples for light / medium / heavy.
- `Animation`: spring presets (fast / default / bouncy), duration (fast / default / slow), `pressScale: 0.97`.
- `Fonts`: per-platform.

### 2b. Findings

- **High** | `theme.ts:116-228` — Two competing typography scales, with only one exposed via `ThemedText`. Either expose HIG via `ThemedText` (recommended, matches the "iOS-26 first" stance in `design_guidelines.md` and the way the components are already coded) or delete the unused half.
- **High** | `theme.ts:3-13` — No semantic tokens for the colors screens are actually using: `info` (blue), `amber` (alt warning), `purple`, `mint`, `chart1..N`. Result: 238 hardcoded hex strings across `client/screens/` and `client/components/` (see top offenders below).
- **High** | `theme.ts:3-13` — Semantic colors (`success/warning/error` and the accent) are single global values; they don't have light/dark variants. `Colors.warning = #F59E0B` is the same in both modes — too saturated against `#1C1C1E` dark backgrounds.
- **Medium** | `theme.ts:96-114` — `BorderRadius` exposes both `buttonPill: 25` and `full: 9999`. `StatusPill` uses neither — it uses `sm` (8). Pick one pill token and document its use.
- **Medium** | `theme.ts:289-313` — `Animation.pressScale = 0.97` exists but components hardcode `0.97` / `0.98` / `0.8` (see §3 — `Card.tsx:67`, `FilterChips.tsx:53`, `GlassCard.tsx`). Token is unused.
- **Medium** | `theme.ts:60-94` — `Spacing.tabBarHeight: 49` is defined but the tab navigators ignore it and compute their own (`HomeownerTabNavigator.tsx:54`, `ProviderTabNavigator.tsx:65`). Either remove the token or have the navigators derive their min height from it.
- **Low** | `theme.ts:231-274` — `Shadows.*` exists but most cards now use `BlurView` + glass; only floating elements should have shadow per `design_guidelines.md:149-152`. Audit and trim screens that double up.

### 2c. Worst hardcoded-hex offenders (count of `#RRGGBB` literals per file, top 20)

```
client/screens/provider/ScheduleScreen.tsx                  18
client/screens/provider/ClientDetailScreen.tsx              18
client/screens/provider/ServiceBlueprintWizardScreen.tsx    10
client/screens/provider/ProviderJobDetailScreen.tsx         10
client/screens/homeowner/PaymentScreen.tsx                  10
client/screens/provider/ServicesScreen.tsx                   9
client/screens/provider/InvoiceDetailScreen.tsx              9
client/screens/provider/BusinessHubScreen.tsx                9
client/screens/auth/AccountSecurityScreen.tsx                9
client/screens/provider/SubscriptionScreen.tsx               8
client/screens/provider/BookingLinkScreen.tsx                8
client/screens/homeowner/AppointmentDetailScreen.tsx         7
client/screens/provider/ServiceSummaryScreen.tsx             6
client/screens/provider/FinancialsScreen.tsx                 6
client/screens/homeowner/SurvivalKitScreen.tsx               6
client/screens/homeowner/MoreScreen.tsx                      6
client/screens/homeowner/HouseFaxScreen.tsx                  6
client/components/GracePeriodBanner.tsx                      6
client/screens/provider/ProviderResourcesScreen.tsx          5
client/screens/provider/AddInvoiceScreen.tsx                 5
```

Total: **238 hardcoded hex literals** outside `client/constants/theme.ts`. Most fall into three buckets: (a) status colors that should be semantic tokens, (b) chart colors that should be a `chartPalette` token list, (c) `#FFFFFF` / `#FFF` for text on filled-accent surfaces (acceptable but should be `Colors.light.buttonText` for consistency).

---

## 3. Shared component library (`client/components/`)

For each component: design intent → variants supported → token discipline → file:line bugs.

### Buttons

- **`Button.tsx`** — Generic four-variant (primary / secondary / outline / ghost) base with spring + haptics.
  - **High** | line 103 — `small` size resolves to `Spacing.buttonHeightSmall` (36px); below the 44px tap-target floor.
  - **Medium** | lines 82, 89 — Hardcoded `#FFFFFF` for primary text; should be `Colors.light.buttonText`.
  - **Medium** | line 134 — `borderWidth: 1.5` hardcoded.
  - **Low** | line 58 — Always `Haptics.medium`; should differ by variant (primary medium, secondary/ghost light).
- **`PrimaryButton.tsx` / `SecondaryButton.tsx`** — Convenience wrappers, height `Spacing.buttonHeight` (50px), good tap target.
  - **Medium** | `PrimaryButton.tsx:76,102` — Hardcoded `#FFFFFF` text.
  - **Medium** | `SecondaryButton.tsx:69` — Now a filled-secondary (no border, `theme.backgroundSecondary` fill). Either rewrite to match `design_guidelines.md:141` (transparent + accent border) or update the spec; the inconsistency is worse than either choice.

### Containers

- **`Card.tsx`** — Three-elevation press-animated container.
  - **Medium** | line 67 — `0.98` press scale hardcoded; use `Animation.pressScale`.
  - **Medium** | lines 23-29 — Local `springConfig` re-declared instead of `Animation.spring.fast`.
  - **Low** | line 112 — Description opacity `0.7` hardcoded.
- **`GlassCard.tsx`** — iOS BlurView card. Liquid glass-conformant. Good. Minor: respects `pointerEvents: "none"` on the BlurView (line 75) — correct.
- **`StatCard.tsx`** — Iliquid-glass dashboard metric.
  - **Medium** | line 58 — Trend icon `14` size hardcoded; use `Spacing.iconSizeSmall` or token.
- **`ListRow.tsx`** — Standard list row, `minHeight: Spacing.listRowHeight` (56px). Good tap target.
  - **Medium** | line 101 — `${Colors.error}12` raw alpha-suffix string; use a token (`Colors.errorLight` exists at `theme.ts:11`).
  - **Medium** | lines 197-206 — Badge: hardcoded `borderRadius: 10`, `height: 20`, `fontSize: 11`, color `#FFFFFF`. Tokenize.
- **`StatusPill.tsx`** — See §1.
  - **High** | line 69 — Not a pill (`BorderRadius.sm` = 8). Should be `BorderRadius.full`.
  - **High** | lines 28, 33 — Hardcoded `#3B82F6` (info/scheduled) and `#808080` (neutral). No theme tokens for these states.
  - **Medium** | lines 19-34 — `${Colors.accent}14` alpha-suffix strings (8% opacity hex hack); fragile. Use `Colors.accentLight` and friends.
  - **Medium** | line 60 — `fontSize: isSmall ? 11 : 12` hardcoded; should map to `Typography.caption2` / `caption1`.

### Inputs

- **`TextField.tsx`** — 48px height (good), labeled, icon, error state.
  - **Medium** | lines 35-38 — Focus state visually invisible (background unchanged on focus); rely on border alone.
  - **Low** | line 55 — `borderWidth: 1.5` hardcoded.
  - **Low** | line 84 — `hitSlop: 8` hardcoded; may produce <44px on the right-icon eye/clear button.
- **`AddressAutocomplete.tsx`** — Custom input + dropdown.
  - **Medium** | line 274 — `height: 52` hardcoded (mismatches `Spacing.inputHeight` 48).
  - **Medium** | line 266 — `zIndex: 1000` magic.
- **`NativeDatePickerSheet.tsx`** — Modal sheet for native date picker.
  - **Medium** | line 84 — Container uses solid `theme.cardBackground`; should be a glass sheet (`AccountGateModal.tsx` already does this — pattern exists).
  - **Medium** | line 154 — Cancel/Done `minWidth: 60`, no explicit height; iOS HIG asks ≥44px square.
- **`ZipCodeAreaInput.tsx`** — Chip-list input.
  - **Medium** | line 132 — `+ "20"` alpha suffix; same anti-pattern as StatusPill.
- **`IntakeQuestionFields.tsx`** — Dynamic question renderer.
  - **Medium** | line 65 — `+ "18"` alpha suffix.
  - **Low** | line 43 — `borderTopWidth: StyleSheet.hairlineWidth` is correct, just confirming.

### Identity

- **`Avatar.tsx`** — Initials, image, badge.
  - **Medium** | line 121 — `#E5E7EB` placeholder bg hardcoded; use `theme.backgroundSecondary`.
  - **Medium** | line 74 — `#FFFFFF` initials hardcoded.
  - **Medium** | lines 65, 134 — `Colors.accent` always-on for initials background; doesn't dim in dark mode.
  - **Low** | line 107 — Online badge `borderColor: theme.backgroundRoot` will look wrong when the avatar sits on a card (needs to be the surface behind it).

### Floating / overlays

- **`ProviderFAB.tsx`** — Expanding FAB, 56px main, 48px actions.
  - **Critical** | line 241 — Raw `<Text>` (not `ThemedText`); breaks dark mode text color and is a hard rule violation.
  - **Medium** | lines 235-237 — Manual rgba label background instead of `BlurView` + glass tokens (despite importing `BlurView` at line 19).
  - **Medium** | line 100 — `setTimeout` for closing magic-numbered, decoupled from animation duration.
- **`AccountGateModal.tsx` / `SubscriptionGateModal.tsx`** — Bottom sheets.
  - **Medium** | both — `intensity={80}` hardcoded; use `GlassEffect.intensity.medium`.
  - **Medium** | `AccountGateModal.tsx:148` / `SubscriptionGateModal.tsx:156` — `rgba(128,128,128,0.3)` modal-handle hardcoded.
  - **Low** | `SubscriptionGateModal.tsx:47` — Empty `catch` block.
- **`OfflineBanner.tsx` / `GracePeriodBanner.tsx` / `PartnerBadge.tsx`** — Top banners. `GracePeriodBanner.tsx` has 6 hardcoded hexes (warning/danger reds + amber). Either use `Colors.warning` / `Colors.error` (and the `*Light` siblings) or add new semantic tokens.

### Domain cards

All domain cards use Liquid Glass on iOS — good. Specific issues:

- **`BookingCard.tsx:144,148`** — Hardcoded `Colors.accent` for price + action text (intentional, but document as a "this is an OK hardcode").
- **`JobCard.tsx:119`** — `+ "22"` alpha suffix on recurring badge.
- **`LeadCard.tsx:49-61`** — Local relative-time function; hoist to a util shared with `MessageRow` and `BookingCard`.
- **`MessageRow.tsx:112,119`** — Badge `borderRadius: 10`, color `#FFFFFF` hardcoded.
- **`ProviderCard.tsx`, `CategoryCard.tsx`** — Clean.

### Themed primitives

- **`ThemedText.tsx`** — Only exposes the duplicate web-style scale (display/h1/h2/h3/h4/body/small/caption/label/link). Does not expose the iOS HIG scale that `theme.ts` defines and that 30+ files use directly. **High** — fix scope decision needed: extend `type` to include HIG, or delete the unused HIG scale.
- **`ThemedView.tsx`** — Always falls back to `theme.backgroundRoot`, even when used as a sub-surface on a colored screen. Consumers are forced to pass `style={{backgroundColor: ...}}` to break this. Add a `surface?: "root" | "default" | "elevated" | "transparent"` prop.

### Loading / empty / error

- **`EmptyState.tsx`** (102 lines) — Title + body + optional action button. Uses `ThemedText` and `Spacing` correctly. **Medium** | the action button is rendered as a `Pressable` with `paddingVertical: Spacing.sm` only (≈32px tap target) — bump to `minHeight: Spacing.buttonHeightSmall` at minimum, ideally `Spacing.buttonHeight` (50). Used in only 6 screens app-wide; the rest reimplement empty states inline (see §5).
- **`SkeletonLoader.tsx`** (121 lines) — Reanimated shimmer.
  - **Low** | line 33 — Loop duration `1000` hardcoded; promote to `Animation.duration.slow`.
  - **Medium** | line 100 — `SkeletonCard` uses `BorderRadius.lg` and a fixed background that can clash with same-tone parent surfaces — accept a `surface` prop or read from `theme.backgroundElevated` vs `theme.backgroundSecondary` based on context.

### Misc

- **`HeaderTitle.tsx`** (45 lines) — `headerTitle: () => <HeaderTitle title=... />` for HomeBase / HomeBase Pro on the Home tabs. Icon path `require("../../assets/images/icon.png")` (line 17) — confirm asset exists. **Low** | line 37 — `borderRadius: 6` is a one-off radius for the inline icon; either accept or expose as `BorderRadius.iconInline`. **Low** | line 42 — `fontWeight: "600"` outside the type scale.
- **`SectionHeader.tsx`** (66 lines) — Title + optional action.
  - **Medium** | line 26 — `hitSlop={8}` on the action `Pressable` makes the effective hit area below 44px when the action label is short; bump to `hitSlop={12}` or wrap in a 44px container.
  - **Low** | lines 51, 61 — `fontWeight: "600" / "500"` outside the type scale.
- **`FormSectionHeader.tsx`** (50 lines) — Form-section label + icon container.
  - **Medium** | line 41 — Icon container `height: 30`; sub-44px and locks the icon to a fixed pixel size.
  - **Medium** | line 42 — Uses `BorderRadius.md` for an icon container; spec defines `BorderRadius.iconContainer` — use that.
- **`HomeProfileSection.tsx`** (894 lines) — Editable home profile blocks (rooms, snapshot, zestimate, etc.).
  - **High** | lines 450, 800 — Hardcoded `#fff` for primary action button text/icon — use `Colors.light.buttonText`.
  - **Medium** | lines 492, 538, 662 — `hitSlop={8}` on three icon-only `Pressable`s; bump to ≥12.
  - **Medium** | lines 733, 743, 755-756, 775-776, 784, 800 — Mix of raw `fontSize: 11/12/13/14/20` instead of `Typography.*`. Map to `caption2 / caption1 / footnote / body / title2`.
  - **Medium** | lines 740, 798, 807 — Borderradii via `BorderRadius.sm/md` instead of `BorderRadius.input` / `.button`.
- **`HomeSelector.tsx`** (491 lines) — Home dropdown + add-home flow.
  - **High** | lines 188, 246, 367 — Hardcoded `#FFFFFF` for icon/text on accent button — use `Colors.light.buttonText`.
  - **High** | line 380 — `borderRadius: 16` magic; should be `BorderRadius.lg` (16) — at least token-mapped, not literal.
  - **Medium** | lines 347, 404, 461, 475 — Raw `fontSize: 10/11` outside the type scale.
  - **Medium** | line 379 — `height: 32` for an interactive avatar; sub-44px tap target.
- **`Spacer.tsx`** — Defaults to `width: 1` / `height: 1` instead of `Spacing.md`. **Low**.
- **`KeyboardAwareScrollViewCompat.tsx`** — Thin wrapper around `react-native-keyboard-controller`'s `KeyboardAwareScrollView` for cross-platform behavior. Clean; no findings.
- **`ErrorBoundary.tsx`** — Class-component error boundary required by React's API. Catches render errors and delegates to `ErrorFallback`. Clean.
- **`ErrorFallback.tsx`** (~250 lines) — The crash-recovery UI.
  - **Medium** | line 188 — `shadowColor: "#000"` hardcoded; should be `theme.text` or `Colors.light.shadow` token (none exists — add).
  - **Medium** | lines 200, 224, 242 — Raw `fontSize: 16 / 12` outside type scale.
  - **Medium** | lines 198, 224 — `fontWeight: "600"` outside type scale.
  - **Low** — Per template rule, no local state; hooks into `useTheme` to render correctly in dark mode. Confirmed compliant with `replit.md` ErrorBoundary contract.
- **`OfflineBanner.tsx`** (90 lines) — Top banner shown when network is offline.
  - **Medium** | lines 52-53 — Hardcoded `#FFFFFF` for icon + text (intentional on the red banner, but should reference `Colors.light.buttonText`).
  - **Low** | line 77 — `borderRadius: 999` literal — use `BorderRadius.full`.
  - **Low** | line 81 — `fontWeight: "600"` outside type scale.
- **`PartnerBadge.tsx`** (~80 lines) — HomeBase Partner indicator.
  - **Medium** | lines 46, 72 — Hardcoded `#FFFFFF` for icon + text on accent fill.
  - **Medium** | line 53 — `fontSize: isSmall ? 11 : 12` outside type scale; map to `caption2 / caption1`.
  - **Low** | line 68 — `BorderRadius.sm` for a status badge; consider `BorderRadius.full` for consistency with `StatusPill` once that's fixed.
- **`MessageRow.tsx:112,119,121`** — Badge `borderRadius: 10`, color `#FFFFFF`, `fontSize: 11` — same anti-pattern as `ListRow` badge; share a `Badge` component.
- **`JobCard.tsx:204,207,208`** — Badge `borderRadius: 8`, `fontSize: 10`, `fontWeight: "600"` — same pattern; share a `Badge` component.

---

## 4. Navigation chrome

### `RootStackNavigator.tsx`
- 8 screens with `headerShown: false` (lines 237, 243, 251, 256, 261, 266, 288, 383). Mostly auth/onboarding/role-switch — correct usage. Each of those screens needs its own `useSafeAreaInsets().top` padding. Spot-check coverage in §5.

### `HomeownerTabNavigator.tsx`
- iOS Liquid Glass tab bar with BlurView + tint overlay (lines 73-89). Good.
- **Medium** | line 188 — Tab `borderRadius: 24` hardcoded; use `BorderRadius["2xl"]` (= 24).
- **Medium** | lines 53-57 — Custom `iconSize` / `fontSize` / `tabHeight` derived from `useWindowDimensions` instead of `Spacing.iconSize` etc. Functional, but doesn't reuse tokens.
- **Medium** | line 132 — Tab labels render via raw `<Text>` (imported from `react-native` at line 5). Should be `ThemedText` so dark-mode text color is consistent.
- **Low** | lines 140-200 — Header config sets `headerTransparent: true` always; `Manage` and `More` get `headerTitle: "Manage" / "More"` strings, leaving them rendered with `Typography.headline` over a transparent surface — that means the screens below need `headerHeight + Spacing.xl` top padding (verify in §5).

### `ProviderTabNavigator.tsx`
- Mirrors HomeownerTab. Same findings (lines 65, 130, 152, 191).
- **Medium** | line 132 — Raw `<Text>` for tab label.
- **Medium** | line 186 — `ClientsTab` uses `headerShown: false` — `ClientsScreen` must therefore handle its own top safe area. Worth a verify pass.
- **Medium** | line 234 — `ProviderFAB` is rendered as a sibling to the `Tab.Navigator`. It floats over **every** provider tab, including `ScheduleTab` and `FinancialsTab` where its actions ("New Job / New Client / New Invoice") may compete with screen-level CTAs (e.g. Schedule's "+" button, Finance's "Add Invoice"). Decide: hide on those tabs, or trim the FAB action set.

### `MainTabNavigator.tsx`, `HomeStackNavigator.tsx`, `ProfileStackNavigator.tsx`
- Functional; no design-only issues beyond the same `Typography.headline` headerTitleStyle and transparent-header convention.

### Cross-cutting nav findings
- **Tab bar height** is recomputed in three navigators (`HomeownerTabNavigator.tsx:55`, `ProviderTabNavigator.tsx:65`, `MainTabNavigator.tsx`). `Spacing.tabBarHeight` (49) is unused. **Medium**.
- **Header titles** use `Typography.headline` (17 / 600) consistently — good.

---

## 5. Screen-by-screen

### Auth (`client/screens/auth/`)

- **`WelcomeScreen.tsx`** — *Polished.*
  - **Medium** | lines 24-25 — Hardcoded gradient hexes for brand background; promote to a `Colors.brandGradient` tuple in theme.
- **`LoginScreen.tsx` / `SignUpScreen.tsx` / `ForgotPasswordScreen.tsx`** — *Polished.* Good `TextField` usage.
- **`OnboardingScreen.tsx`** — *Polished.* Animated; uses HIG type scale.
- **`AccountSecurityScreen.tsx`** — *Needs polish.*
  - **High** | lines 162-166, 722, 786 — Destructive UI uses raw `#FF3B3014` / `#FF3B30` / `#D43838` instead of `Colors.error` + `Colors.errorLight`.
  - **Medium** — Custom delete-account modal duplicates `AccountGateModal` shell logic.

### Onboarding (`client/screens/onboarding/`)

- **`FirstLaunchScreen.tsx`** — *Polished.* Short, clean.
- **`AccountTypeSelectionScreen.tsx`** — *Needs polish.*
  - **High** | lines 129-146 — Role cards branch on `Platform.OS === "ios"` between `BlurView` and a static white fallback `View`. The fallback is fine visually, but the cards' opacity is driven by `card1Opacity` / `card2Opacity` `Animated.Value(0)` (top of file) interpolated by `Animated.timing` with `useNativeDriver: false`. On web that timing fires but the driver behaviour is inconsistent; the captured `01-account-type-selection-web.png` shows the cards invisible (opacity stuck at 0). Either start opacity at 1 on web, or move to `react-native-reanimated` `withTiming`.
  - **High** | lines 122-124, 140-142 — `rgba(255,255,255,0.09)` / `rgba(0,0,0,0.07)` / `rgba(255,255,255,0.05/0.92)` borders and fills hardcoded; lift to `Colors.{light,dark}.{glassBorder,glassFill}` tokens.
  - **High** | line 149 — `Colors.accent + "16"` alpha-suffix tinting; use `Colors.accentLight`.
  - **Medium** | line 125 — Press-state `scale: 0.97` instead of `Animation.pressScale`.
  - **Medium** | lines 286, 293, 325, 331, 343 — Raw `fontSize: 30 / 15 / 16 / 13 / 14` outside the type scale; map to `Typography.title1 / subhead / callout / footnote / subhead`.
  - **Medium** | line 274 — `height: 52` for the card (close to but above 44px tap target — fine, but the inner `iconBox` `height: 40` < 44px is hit-area-ambiguous if pressed directly).
- **`HomeownerOnboardingScreen.tsx`** — *Needs polish.*
  - **High** | `client/screens/onboarding/HomeownerOnboardingScreen.tsx` (legacy `Animated.timing` calls) — Uses legacy `Animated` with `useNativeDriver: false` (per April 14 audit, still present); causes potential jank on iOS.
  - **Medium** | line 159 — Hardcoded white check icon.
- **`ProviderOnboardingScreen.tsx`** — *Needs polish.*
  - **High** | lines 766, 769 — Hardcoded `#FF453A10` for remove buttons.
  - **High** | lines 909, 929, 947 — Hardcoded white text in selection states.
  - 1650 lines — candidate for split into sub-screens.
- **`ProviderSetupFlow.tsx`** — *Needs polish.*
  - 1878 lines, no skip on Hours / First Service steps (April 14 finding still open per UX audit; not a pure-design issue but a layout decision).

### Role / gateway (`client/screens/`)

- **`RoleGatewayScreen.tsx`** — *Polished.* Uses `Card` + HIG type. Tap targets ≥44px on the two role buttons.
- **`RoleSwitchConfirmationScreen.tsx`** — *Polished.* Uses HIG type, has visual confirmation illustration.
- **`BecomeProviderScreen.tsx`** — *Needs polish.* Verify CTA primary button height matches `Spacing.buttonHeight` (50).

### Homeowner (`client/screens/homeowner/`)

- **`HomeScreen.tsx`** — *Needs polish.*
  - **Medium** | line 430 — `rgba(0,0,0,0.1)` border ignores dark mode; use `theme.separator`.
  - **Medium** | line 200 — `theme.textSecondary` style applied manually instead of `<ThemedText type="caption">`.
  - **Medium** | line 243 — Custom `GlassCard` for upcoming appointment instead of `BookingCard`. Inconsistent with Manage tab.
- **`FindScreen.tsx`** — *Needs polish.*
  - **High** | lines 520, 525, 821, 861, 909 — Hardcoded `#fff` for active filter state text/icon. Use `Colors.light.buttonText`.
  - **Medium** | line 586 — Hardcoded `#fff` background.
  - **Medium** | `client/components/FilterChips.tsx` (chip render block, ≈ paddingVertical Spacing.sm = 8 plus single-line text → ≈36px) — Chip tap target below 44px; either set `minHeight: 44` or bump padding.
- **`ManageScreen.tsx`** — *Polished.* Good `BookingCard` + `EmptyState` reuse.
- **`MoreScreen.tsx`** — *Needs polish.*
  - **High** | lines 448, 449, 457 — Account-deletion modal uses raw `#FF3B3014` / `#FF3B30`. Use `Colors.errorLight` / `Colors.error`.
  - **High** | line 652 — Destructive action `backgroundColor: "#FF3B30"`. Use `Colors.error`.
  - **Medium** | lines 511, 530, 581 — Mixes `Typography.subhead` next to standard `ListRow` text styles inline.
  - **Medium** | lines 664, 674 — Raw `fontSize: 16` outside the type scale.
  - **Medium** | lines 250-280 — Inline row pattern instead of `ListRow`.
- **`AIChatScreen.tsx`** — *Polished.*
  - **High** | `client/screens/homeowner/AIChatScreen.tsx` import block — `KeyboardAvoidingView` imported from `react-native` (must be from `react-native-keyboard-controller`).
  - **Medium** | line 166 — Hardcoded `#FFFFFF` user-bubble text.
- **`AppointmentDetailScreen.tsx`** — *Needs polish.*
  - **Medium** | `client/screens/homeowner/AppointmentDetailScreen.tsx` (status section, ≈ lines 612, 636) — Status row built inline (`color`/`fontWeight: "600"`) instead of `StatusPill`.
  - **Medium** | lines 1074, 1092, 1140, 1168, 1219, 1242 — Repeated `fontWeight: "600"` raw on detail rows; map to `Typography.subhead` or `Typography.callout`.
  - **Medium** | "Contact Provider" `Pressable` lacks an explicit `minHeight: 44` — tap target relies on padding only.
- **`BookingSuccessScreen.tsx`** — *Polished.*
- **`BudgeterScreen.tsx`** — *Needs polish.* "Coming soon" empty state; OK as a placeholder.
- **`HealthScoreScreen.tsx`** — *Trust hit.*
  - **High** | lines 696, 1067 — Hardcoded white icons.
  - **Medium** | line 1078 — Inline action buttons instead of `Button` / `SecondaryButton`.
- **`HelpCenterScreen.tsx` / `ContactUsScreen.tsx`** — *Polished.*
- **`HouseFaxScreen.tsx`** — *Trust hit.*
  - **High** | lines 264, 536, 629, 718 — Hardcoded `#F59E0B` and `#EF4444` (warning/error). Use `Colors.warning` / `Colors.error`.
  - **High** | line 1207 — Hardcoded white text in dark-mode-fragile context.
- **`JobDetailScreen.tsx`** — *Polished.* **Medium** | (loading state) — Stuck spinner indefinitely on missing/invalid `jobId` (`05-job-detail-loading-web.png`); add error / empty handling.
- **`NotificationPreferencesScreen.tsx`** — *Needs polish.*
  - **Medium** | lines 115, 169 — Hardcoded white activity indicator and Switch thumb color.
- **`NotificationsScreen.tsx`** — *Polished.* Add unread tint distinction (Medium).
- **`PaymentScreen.tsx`** — *Trust hit.*
  - **High** | lines 198-256, 347, 409 — Hardcoded `#D1FAE5` / `#FEF3C7` / `#FEF2F2` status backgrounds and matching text colors. Should use `Colors.successLight` / `Colors.warningLight` / `Colors.errorLight` + `StatusPill`.
  - **Medium** | (loading state) — Stuck on the green ring spinner indefinitely when invoiceId is missing/invalid (`04-payment-result-loading-web.png`); needs an error/empty path with retry CTA.
- **`ProfileEditScreen.tsx`** — *Needs polish.*
  - **Medium** | lines 141, 143, 232 — Hardcoded white indicators and borders.
- **`ProviderListScreen.tsx`** — *Needs polish.*
  - **High** | lines 254, 324, 332, 400, 523 — Hardcoded `#fff` for active filter state.
  - **Medium** | line 586 — Hardcoded `#fff` background.
- **`ProviderProfileScreen.tsx`** — *Polished.* Uses `ProviderCard`, `ListRow`.
- **`ReviewScreen.tsx`** — *Polished.* **High** | `client/screens/homeowner/ReviewScreen.tsx` import block — `KeyboardAvoidingView` from `react-native` (move to `react-native-keyboard-controller`).
- **`SavedProvidersScreen.tsx`** — *Needs polish.*
  - **High** | lines 158, 295, 302 — Hardcoded `#FFF` text.
  - **Medium** | line 273 — Hardcoded `#000` shadow + custom sort menu instead of a shared sheet.
- **`ServiceHistoryScreen.tsx`** — *Needs polish.*
  - **High** | lines 304, 530, 621, 628 — Hardcoded `#FFF`.
  - **Medium** — No `EmptyState` for users with no history.
- **`SimpleBookingScreen.tsx`** — *Broken on web / Trust hit on native.*
  - **Critical** | `client/screens/homeowner/SimpleBookingScreen.tsx` (web path) — Crashes immediately on web build, surfaces the global `ErrorBoundary` "Something went wrong / Try Again" UI (see `03-simple-booking-error-boundary-web.png`). Either gate the offending native-only code with `Platform.OS !== 'web'` or render a web-friendly fallback.
  - **High** | lines 956, 1038 — Hardcoded `#AF52DE` (purple) for "Quote Only" — direct violation of the one-accent rule.
  - **Medium** | lines 663, 704, 858 — Hardcoded white icons.
  - **Medium** | line 749 — Hardcoded `#F59E0B`.
- **`SmartIntakeScreen.tsx`** — *Polished.*
  - **High** | `client/screens/homeowner/SmartIntakeScreen.tsx` import block — `KeyboardAvoidingView` from `react-native` instead of `react-native-keyboard-controller`.
  - **Low** | line 423 — Hardcoded white check icon.
- **`SurvivalKitScreen.tsx`** — *Trust hit.*
  - **High** | lines 1288-1293 — Chart palette `#3B82F6`, `#8B5CF6`, `#F59E0B`, `#EC4899`, `#6B7280` hardcoded. Establish a `Colors.chart[]` token list.
  - **Medium** | line 614 — Hardcoded white icon color.
- **`AddressesScreen.tsx`** — *Polished.*

### Provider (`client/screens/provider/`)

- **`ProviderHomeScreen.tsx`** — *Needs polish.*
  - **High** | lines 471-514 — Inline stats grid instead of `StatCard`.
  - **Medium** | line 554 — `Colors.error` notification badge — fine, but no light-variant for dark mode.
  - **Medium** | line 566 — `fontSize: 12` hardcoded; use `Typography.caption1`.
- **`LeadsScreen.tsx`** — *Polished.* Good `LeadCard` + `EmptyState`.
- **`ScheduleScreen.tsx`** — *Trust hit.*
  - **High** | lines 74-82, 431-436 — Hardcoded `#3B82F6` / `#F59E0B` / `#9CA3AF` status colors.
  - **High** | lines 825-830 — Calendar labels at `fontSize: 9 / 10 / 11`. Below iOS HIG minimum readable.
  - **Medium** — No month-navigation forward/back (still open from April 14).
- **`FinancialsScreen.tsx`** — *Trust hit.*
  - **Critical** | line 268 — `fontSize: 7` chart label. Unreadable.
  - **High** | line 304 — `fontSize: 8`.
  - **High** | lines 755-757 — Hardcoded `#34C759` / `#FF9F0A` for transaction statuses.
  - **Medium** | lines 321, 693, 703 — `fontSize: 11`, no token mapping.
  - **Medium** | lines 635-651 — Date Picker apply button hardcoded `#FFFFFF`.
- **`ProviderMoreScreen.tsx`** — *Needs polish.*
  - **High** | lines 144-382 — Stagger reveal `FadeInDown.delay(index * 100)` ramping to 800ms total — sluggish for a Settings list. Cap at 300ms total or remove the stagger.
- **`ProviderJobDetailScreen.tsx`** — *Trust hit.*
  - **High** | lines 31-36 — Re-implements status colors with hardcoded hex; same palette issue as `ScheduleScreen`.
  - **Medium** — Before/after photo upload still loses images on app restart (April 14 finding) — UX issue, flagged for follow-up.
- **`StripeConnectScreen.tsx`** — *Needs polish.*
  - **High** | lines 371, 419, 426, 472 — "Create Test Invoice" UI shipped to providers in production code. Either dev-gate or remove.
  - **Medium** | lines 415-428 — Manual `<Text>` + `TextInput` rather than `TextField`.
- **`SubscriptionScreen.tsx`** — *Needs polish.* (Confirmed fully renders on web — see `02-subscription-web.png`.)
  - **High** | lines 314, 325, 339, 340, 352, 353, 361, 787 — `iconBg`/`iconColor` per-state hardcoded (`#1C2E24` / `#F0FAF4` / `#3a2f1a` / `#fffbeb` / `#b45309` / `#3a1f1f` / `#fef2f2` / `#dc2626`); needs `Colors.{success,warning,error}{,Light}` per-mode tokens.
  - **High** | lines 511, 550, 553, 578, 581, 880 — Hardcoded `#fff` for icons/text inside primary buttons.
- **`ServiceSummaryScreen.tsx`** — *Needs polish.*
  - **Medium** | line 220 — `#38AE5F18` (accent at 9% via hex alpha). Use `Colors.accentLight`.
  - **Medium** | lines 392, 435-445 — Custom "Edit" chip and `fontWeight: "800"` outside the type scale.
  - **Medium** | line 82 — Private `SectionRow` duplicates `ListRow`.
- **`BusinessHubScreen.tsx`** — *Needs polish.*
  - **High** | lines 584, 1074, 1141, 1429, 1434, 1807 — Hardcoded `#FFFFFF` icons/labels; should use `Colors.light.buttonText`.
  - **Medium** | lines 840, 1210, 1233 — `Switch thumbColor="#FFFFFF"` hardcoded.
- **`ClientDetailScreen.tsx`** — *Trust hit.*
  - **High** | lines 268, 338, 343, 347, 462-466, 590-593, 689, 763-764 — Status colors hardcoded (`#3B82F6` lead, `#EF4444` error/danger, `#F59E0B` warning, `#22C55E` success) with raw `+ "20"` alpha-suffix tinting. Replace with `StatusPill` + `Colors.{success,warning,error,info}` + `*Light` tokens.
  - **High** | lines 155, 158, 503, 504, 563, 564 — Hardcoded `#FFFFFF` for primary-action text/icons.
  - **Medium** | line 348 — Raw `Pressable` "Send Reminder" with hex-colored fill instead of `Button` variant.
- **`InvoiceDetailScreen.tsx`** — *Needs polish.*
  - **High** | lines 350, 351 — `#FFF3CD` / `#FBBF24` / `#B45309` Stripe Connect banner hardcoded; replace with `Colors.warningLight` / `Colors.warning` text.
  - **High** | lines 496, 515, 516 — `#16A34A` (alt success) hardcoded for copy-confirmation; use `Colors.success`.
  - **High** | lines 684, 685, 699, 700, 762, 770 — Action button "done" state uses `#16A34A` and `#fff` directly.
  - **High** | line 736 — Destructive confirm uses raw `#DC2626`; should be `Colors.error`.
  - **Medium** | line 939 — Hardcoded `#92400E` brown for the "due soon" hint.
  - Otherwise uses `StatusPill` + `Card` correctly.
  - **Medium** | (loading state) — Stuck spinner indefinitely on missing/invalid `invoiceId` (`06-invoice-detail-loading-web.png`); add error/empty handling.
- **`AddJobScreen.tsx`** — *Needs polish.*
  - **Medium** | lines 744, 745 — `fontSize: 13`, `11` for avatar text.
  - **Medium** — Service-type picker shows hardcoded options instead of provider's real services (April 14 finding).
- **`AddInvoiceScreen.tsx` / `AddClientScreen.tsx`** — *Needs polish.*
  - **High** | `client/screens/provider/AddInvoiceScreen.tsx` import block — `KeyboardAvoidingView` from `react-native`.
- **`ServicesScreen.tsx`** — *Trust hit.*
  - **High** | lines 109-111 — Service-type color map hardcoded: `#FF9500` (variable), `#5AC8FA` (service_call), `#AF52DE` (quote). These are iOS system colors, not theme tokens; `#AF52DE` violates one-accent.
  - **High** | lines 203-205, 282, 285, 671-672 — Quote-only state uses `#AF52DE` + alpha-suffix `#AF52DE18`.
  - **High** | lines 415-417 — Delete-confirm row hardcodes `#FF3B3010` / `#FF3B30`.
  - **High** | lines 285, 328, 435, 473, 607, 671, 672, 909 — `#fff` / `#FFFFFF` for active filter / button text.
  - **High** | line 901 — `backgroundColor: "#FF3B30"` for destructive row.
- **`ServiceBlueprintWizardScreen.tsx`** — *Needs polish.* Long wizard flow.
  - **High** | lines 1283, 1285, 1286, 1308, 1318, 1321, 1322, 1638, 1759, 1798 — Destructive UI hardcodes `#FF3B30` family.
  - **High** | lines 1370, 1371, 1372, 1412 — Quote-only state hardcodes `#AF52DE`.
  - **High** | lines 564, 825, 1701, 1802, 1877 — `#fff` text/spinners.
- **`BookingLinkScreen.tsx`** — *Needs polish.*
  - **High** | lines 359, 360, 375, 380, 388, 392, 393 — Destructive UI hardcodes `#EF4444` and `#EF444440 / 50`.
  - **Medium** | lines 321, 522, 538 — `Switch thumbColor="#FFFFFF"`.
- **`PublicProfileScreen.tsx`** — *Polished.* `StatusPill` + `Card`.
- **`ReviewsScreen.tsx`** — *Needs polish.* **High** | `client/screens/provider/ReviewsScreen.tsx` import block — `KeyboardAvoidingView` from `react-native`.
- **`SendMessageScreen.tsx`** — *Trust hit.*
  - **High** | `client/screens/provider/SendMessageScreen.tsx` import block — `KeyboardAvoidingView` from `react-native`. Combined with the chat layout pattern, this manifests as keyboard-overlapping bugs on real devices.
- **`ProviderAIAssistantScreen.tsx`** — *Trust hit.*
  - **High** | `client/screens/provider/ProviderAIAssistantScreen.tsx` import block — same `KeyboardAvoidingView` import bug.
  - **Medium** — Microphone button is decorative-only (April 14 finding).
- **`AdminPartnersScreen.tsx`** — *Polished.* Internal tool.
- **`CommunicationsScreen.tsx`** — *Needs polish.*
  - **High** | lines 220, 320, 484 — Hardcoded `#fff` for active-tab text and primary-button fill.
- **`ProviderResourcesScreen.tsx`** — *Needs polish.*
  - **High** | line 168 — Hardcoded `#3B82F6` for info status; use `Colors.info` (after token added).
  - **High** | lines 304, 330, 414, 539 — Hardcoded `#FFFFFF` text/spinners.
- **`ClientsScreen.tsx`** — *Needs polish.*
  - **High** | line 112 — Hardcoded `#3B82F6` for "lead" status; use `Colors.info`.
  - **High** | lines 186, 219, 220 — Hardcoded `#EF4444` and `#FFFFFF` raw.

---

## 6. Cross-cutting themes

| Theme | Severity | One-line summary |
|---|---|---|
| **Typography duplication** | High | Two parallel scales in `theme.ts`; `ThemedText` exposes only the web one; HIG one is consumed via direct `Typography.*` import in 30+ files. Pick one. |
| **Color discipline** | High | 238 hardcoded hex literals across screens/components. Need new tokens for `info`, `chart[]`, `purple`, plus per-mode variants of `success / warning / error`. |
| **One-accent rule** | High | `SimpleBookingScreen` uses `#AF52DE` (purple); chart palettes use 5+ accents. Either expand the rule explicitly to "+ a chart palette" or restrict charts. |
| **Liquid Glass coverage** | Medium | Tab bars and key cards (BookingCard / JobCard / LeadCard / ProviderCard / CategoryCard / StatCard) all use BlurView correctly. Gaps: `NativeDatePickerSheet`, `ProviderFAB` labels, several inline status pills. |
| **Component reuse** | High | `StatusPill`, `EmptyState`, `ListRow`, `StatCard`, `BookingCard` are reimplemented inline in 10+ screens. Worst offenders: `ProviderHomeScreen`, `AppointmentDetailScreen`, `MoreScreen`, `ServiceSummaryScreen`, `ClientDetailScreen`. |
| **Dark mode** | High | Hardcoded `#FFFFFF`, `#FFF`, hex statuses, and `rgba(0,0,0,0.x)` separators all break or look wrong in dark mode. ~80 such occurrences. |
| **Accessibility — tap target** | High | `Button` `small` (36px), `FilterChips` (~36px), `TextField` right icon (`hitSlop: 8` → 36px effective), `NativeDatePickerSheet` Cancel/Done — all <44px. |
| **Accessibility — Dynamic Type** | High | Typography scale is fixed-pixel; no `PixelRatio.getFontScale()` clamping or `allowFontScaling` policy documented. |
| **Loading / empty / error consistency** | High | `EmptyState` exists but is used in only 6 screens; `SkeletonLoader` exists but most data screens use spinners or nothing. Detail screens (`PaymentScreen`, `JobDetailScreen`, `InvoiceDetailScreen`) hang on the spinner indefinitely when their id param resolves to nothing — confirmed in `04/05/06-*-loading-web.png`. Need a global "stale-after-Xs" pattern that flips to `EmptyState` with retry. |
| **Web fallbacks for native-only components** | Medium | `expo-glass-effect` `GlassView` falls back to `View` silently on non-iOS, leaving role-selection and similar surfaces blank on web (confirmed in `01-account-type-selection-web.png`). `SimpleBookingScreen` crashes outright on web (`03-simple-booking-error-boundary-web.png`). Either feature-detect and provide a web-safe alternative or hide entry points on web. |
| **Haptics consistency** | Low | `Button` always medium; `PrimaryButton` medium; `SecondaryButton` light. Standardize: primary = medium, secondary/ghost = light, destructive = warning. |
| **Animation timing** | Medium | `Animation.spring/duration/pressScale` defined but components hardcode `0.97` / `0.98` / `0.8` / `200ms` / `300ms` / 800ms staggers. Tokens are largely unused. |
| **Chat-screen keyboard** | High | 7 screens import `KeyboardAvoidingView` from `react-native` (must be from `react-native-keyboard-controller` per project rules). Manifests as keyboard-overlapping inputs on iOS. |
| **Header / safe area** | Low | Tab navigators use `headerTransparent: true` consistently. Screens generally pass `headerHeight + Spacing.xl` or `insets.top + Spacing.xl` correctly. Spot-check `headerShown: false` screens (`RoleGateway`, `RoleSwitchConfirmation`, `BecomeProvider`, several auth) for `insets.top` usage. |

---

## 7. Delta vs April 14, 2026

### Resolved since April 14
- `ServicePreviewScreen` removed entirely (replaced by `ServiceSummaryScreen` + `BookingLinkScreen`); the "Do you have pets?" placeholder and "$29.99/mo" subtitle are gone.
- `Colors.info` / `Colors.amber` are no longer referenced by name in any screen (the underlying need is still unmet — see "Still open").
- Domain cards (Booking / Job / Lead / Provider / Category) now correctly use Liquid Glass via BlurView.

### Still open since April 14
- `StatusPill` not pill-shaped (`StatusPill.tsx:69`).
- `FinancialsScreen` 7px chart label (`FinancialsScreen.tsx:268`) plus 8px sibling.
- `TextField` near-invisible focus state (`TextField.tsx:35-37`).
- 7 screens importing `KeyboardAvoidingView` from `react-native`.
- `ProviderFAB` raw `<Text>` (`ProviderFAB.tsx:241`).
- `StripeConnectScreen` "Create Test Invoice" UI shipped to providers.
- `ProviderMoreScreen` ramp-to-800ms stagger.
- Dual typography scales in `theme.ts`.
- `ProviderHomeScreen` inline stats grid instead of `StatCard`.
- `ScheduleScreen` hardcoded status palette.
- Mock data in `BudgeterScreen` / `SurvivalKitScreen` / `ServiceHistoryScreen` (UX issue, called out for visibility).

### New since April 14
- `SimpleBookingScreen` introduced `#AF52DE` purple — first explicit one-accent-rule violation.
- `SimpleBookingScreen` now crashes the web build on first paint (ErrorBoundary trip, `03-simple-booking-error-boundary-web.png`).
- `ServiceSummaryScreen` introduced a private `SectionRow` (lines 82, 392, 435-445) that duplicates `ListRow`.
- `SecondaryButton` was reworked to a filled secondary (`SecondaryButton.tsx:69`); now diverges from `design_guidelines.md:141`.
- 8 hardcoded hex literals on `SubscriptionScreen` (lines 140-150) — new in May.
- `MoreScreen` destructive-row hex strings (`#FF3B30*`, lines 448-460) — new since the role-switch refactor.
- `AccountTypeSelectionScreen` role cards no longer render on web (silent `GlassView` fallback) — `01-account-type-selection-web.png`.
- `PaymentScreen` / `JobDetailScreen` / `InvoiceDetailScreen` confirmed stuck-spinner behavior on missing ids — `04/05/06-*-loading-web.png`.

---

## 8. Highest-impact surfaces — visual ground-truth list

Already captured (web, in `docs/audit-screenshots/`):

1. `01-account-type-selection-web.png` — partial web render (cards missing).
2. `02-subscription-web.png` — full web render.
3. `03-simple-booking-error-boundary-web.png` — web ErrorBoundary trip.
4. `04-payment-result-loading-web.png` — stuck loader.
5. `05-job-detail-loading-web.png` — stuck loader.
6. `06-invoice-detail-loading-web.png` — stuck loader.

Still required from a real iOS device run (not reachable via web `linking.config`; the implementation task should add these as `before-<n>-<screen>.jpg` / `after-<n>-<screen>.jpg` pairs):

7. `WelcomeScreen` (auth)
8. `HomeScreen` (homeowner)
9. `FindScreen` (homeowner)
10. `ManageScreen` (homeowner)
11. `MoreScreen` (homeowner)
12. `ProviderHomeScreen`
13. `ScheduleScreen` (provider)
14. `ProviderMoreScreen`
15. `BusinessHubScreen`
16. `ServiceSummaryScreen`
17. `StripeConnectScreen`
18. `FinancialsScreen`

---

## 9. Component / screen inventory (for completeness)

### Auth (6) — `client/screens/auth/`
WelcomeScreen, LoginScreen, SignUpScreen, ForgotPasswordScreen, OnboardingScreen, AccountSecurityScreen.

### Onboarding (5) — `client/screens/onboarding/`
FirstLaunchScreen, AccountTypeSelectionScreen, HomeownerOnboardingScreen, ProviderOnboardingScreen, ProviderSetupFlow.

### Role / gateway (3) — `client/screens/`
RoleGatewayScreen, RoleSwitchConfirmationScreen, BecomeProviderScreen.

### Homeowner (24) — `client/screens/homeowner/`
HomeScreen, FindScreen, ManageScreen, MoreScreen, AIChatScreen, AppointmentDetailScreen, BookingSuccessScreen, BudgeterScreen, HealthScoreScreen, HelpCenterScreen, ContactUsScreen, HouseFaxScreen, JobDetailScreen, NotificationPreferencesScreen, NotificationsScreen, PaymentScreen, ProfileEditScreen, ProviderListScreen, ProviderProfileScreen, ReviewScreen, SavedProvidersScreen, ServiceHistoryScreen, SimpleBookingScreen, SmartIntakeScreen, SurvivalKitScreen, AddressesScreen.

### Provider (26) — `client/screens/provider/`
ProviderHomeScreen, LeadsScreen, ScheduleScreen, FinancialsScreen, ProviderMoreScreen, AddClientScreen, AddInvoiceScreen, AddJobScreen, AdminPartnersScreen, BookingLinkScreen, BusinessHubScreen, ClientDetailScreen, ClientsScreen, CommunicationsScreen, InvoiceDetailScreen, ProviderAIAssistantScreen, ProviderJobDetailScreen, ProviderResourcesScreen, PublicProfileScreen, ReviewsScreen, SendMessageScreen, ServiceBlueprintWizardScreen, ServicesScreen, ServiceSummaryScreen, StripeConnectScreen, SubscriptionScreen.

### Components (39) — `client/components/`
Buttons: Button, PrimaryButton, SecondaryButton.
Containers: Card, GlassCard, ListRow, StatCard, StatusPill, FilterChips.
Inputs: TextField, AddressAutocomplete, ZipCodeAreaInput, IntakeQuestionFields, NativeDatePickerSheet.
Identity: Avatar.
Floating / overlays: ProviderFAB, AccountGateModal, SubscriptionGateModal, OfflineBanner, GracePeriodBanner, PartnerBadge.
Domain cards: BookingCard, JobCard, LeadCard, ProviderCard, CategoryCard, MessageRow.
Themed primitives: ThemedText, ThemedView.
Loading / empty: EmptyState, SkeletonLoader.
Misc: HeaderTitle, SectionHeader, FormSectionHeader, HomeProfileSection, HomeSelector, KeyboardAwareScrollViewCompat, ErrorBoundary, ErrorFallback, Spacer.

### Navigators (6) — `client/navigation/`
RootStackNavigator, MainTabNavigator, HomeownerTabNavigator, ProviderTabNavigator, HomeStackNavigator, ProfileStackNavigator.

---

## 10. Prioritized fix list (input for the design-fixes implementation task)

Effort: **S** = <1h, **M** = 1–4h, **L** = 4–16h, **XL** = >16h.

### P0 — must-fix-before-ship (trust / readability / hard rule violations)

| # | Surface | File:line | Fix | Effort |
|---|---|---|---|---|
| 1 | FinancialsScreen chart | `client/screens/provider/FinancialsScreen.tsx:268,304` | Bump `fontSize: 7` / `8` to `Typography.caption2.fontSize` (11) minimum; ensure label collision logic. | S |
| 2 | StripeConnectScreen | `client/screens/provider/StripeConnectScreen.tsx:371,419,426,472` | Remove or `__DEV__`-gate "Create Test Invoice" UI block. | M |
| 3 | ProviderFAB | `client/components/ProviderFAB.tsx:5,241` | Replace raw `<Text>` with `ThemedText`; drop `Text` import. | S |
| 4 | One-accent violation | `client/screens/homeowner/SimpleBookingScreen.tsx:956,1038` | Replace `#AF52DE` with neutral text + `Colors.accent` icon, or accept the new color and add `Colors.info` token. | S |
| 5 | Chat keyboard imports | `client/screens/provider/{AddInvoiceScreen,ReviewsScreen,ProviderAIAssistantScreen,SendMessageScreen}.tsx`, `client/screens/homeowner/{SmartIntakeScreen,ReviewScreen,AIChatScreen}.tsx` | Move all `KeyboardAvoidingView` imports to `react-native-keyboard-controller`. | M |
| 6 | StatusPill not a pill | `client/components/StatusPill.tsx:69` | `borderRadius: BorderRadius.full`. | S |
| 7 | SimpleBookingScreen crashes on web | `client/screens/homeowner/SimpleBookingScreen.tsx` | Identify the native-only call that throws on web (`03-simple-booking-error-boundary-web.png`); gate with `Platform.OS !== 'web'` or render web fallback. | M |
| 8 | Detail screens hang on missing id | `client/screens/homeowner/PaymentScreen.tsx`, `client/screens/homeowner/JobDetailScreen.tsx`, `client/screens/provider/InvoiceDetailScreen.tsx` | Add stale-after-Xs timeout that flips to `EmptyState` with retry when query resolves to no record (`04/05/06-*-loading-web.png`). | M |
| 9 | AccountTypeSelection cards missing on web | `client/screens/onboarding/AccountTypeSelectionScreen.tsx` | Add web-safe fallback for `expo-glass-effect` GlassView role cards (`01-account-type-selection-web.png`). | S |

### P1 — design-system + high-visibility polish

| # | Surface | File:line | Fix | Effort |
|---|---|---|---|---|
| 7 | Typography scale collapse | `client/constants/theme.ts:116-228`, `client/components/ThemedText.tsx:9` | Pick one scale (recommend HIG); update `ThemedText` `type` union and migrate `display/h1..h4/small/caption/label/link` callers. | L |
| 8 | Semantic color tokens | `client/constants/theme.ts:3-13` | Add `info`, `infoLight`, `chart[1..6]`, plus per-mode variants of `success/warning/error`. | M |
| 9 | Hardcoded statuses → semantic tokens | `ScheduleScreen.tsx:74-82,431-436`, `ProviderJobDetailScreen.tsx:31-36`, `PaymentScreen.tsx:198-256,347,409`, `HouseFaxScreen.tsx:264,536,629,718`, `MoreScreen.tsx:448,457,460`, `AccountSecurityScreen.tsx:162-166,722,786` | Swap hex for `Colors.{success,warning,error,info}` + `*Light`. | L |
| 10 | StatusPill hardcoded info / neutral | `client/components/StatusPill.tsx:19-34,60` | Use the new `Colors.info / .infoLight`; map font sizes to `Typography.caption1/2`. | S |
| 11 | Inline stats grid → StatCard | `client/screens/provider/ProviderHomeScreen.tsx:471-514` | Replace 3 inline blocks with `StatCard`. | M |
| 12 | ProviderMoreScreen stagger | `client/screens/provider/ProviderMoreScreen.tsx:144-382` | Cap total stagger at ≤300ms (or remove). | S |
| 13 | TextField focus state | `client/components/TextField.tsx:35-38` | Distinct focused background (e.g. `theme.backgroundElevated` or accentLight tint). | S |
| 14 | FilterChips / Button small tap target | `client/components/FilterChips.tsx:103`, `client/components/Button.tsx:103` | `minHeight: 44` or larger `paddingVertical`. | S |
| 15 | SecondaryButton spec drift | `client/components/SecondaryButton.tsx:69`, `design_guidelines.md:141` | Decide spec; align both. | S |
| 16 | Chart palette | `client/screens/homeowner/SurvivalKitScreen.tsx:1288-1293` | Use `Colors.chart[]` from new tokens. | S |
| 17 | Inline status / list reimplementations | `AppointmentDetailScreen.tsx`, `ServiceSummaryScreen.tsx:82,392,435-445`, `ClientDetailScreen.tsx`, `MoreScreen.tsx:250-280` | Replace with `StatusPill` / `ListRow`. | M |
| 18 | Hardcoded `#FFF` for active filter states | `FindScreen.tsx:520,525,821,861,909`, `ProviderListScreen.tsx:254,324,332,400,523`, `SavedProvidersScreen.tsx:158,295,302`, `ServiceHistoryScreen.tsx:304,530,621,628`, `SimpleBookingScreen.tsx:663,704,858` | Use `Colors.light.buttonText`. | M |
| 19 | Tab bar raw `<Text>` labels | `client/navigation/HomeownerTabNavigator.tsx:5,132`, `client/navigation/ProviderTabNavigator.tsx:5,132` | Use `ThemedText`. | S |

### P2 — broad polish / consistency

| # | Surface | File:line | Fix | Effort |
|---|---|---|---|---|
| 20 | Dark-mode-fragile alphas via hex suffix | `JobCard.tsx:119`, `ZipCodeAreaInput.tsx:132`, `IntakeQuestionFields.tsx:65`, `ServiceSummaryScreen.tsx:220`, `ListRow.tsx:101`, `StatusPill.tsx:19-34` | Replace `${Color}NN` patterns with proper `*Light` tokens or `rgba()`. | M |
| 21 | Animation token adoption | `Card.tsx:67`, `FilterChips.tsx:53`, `GlassCard.tsx`, anywhere using `0.97/0.98` press scale or local spring config | Use `Animation.pressScale` and `Animation.spring.*`. | M |
| 22 | Avatar dark mode | `Avatar.tsx:65,74,107,121,134` | Use `theme.backgroundSecondary` placeholder, theme-aware initials bg. | S |
| 23 | NativeDatePickerSheet glass | `NativeDatePickerSheet.tsx:84,154` | Wrap in glass surface; ensure 44px Cancel/Done. | M |
| 24 | EmptyState coverage | `NotificationsScreen`, `ServiceHistoryScreen`, `ClientsScreen` first-load, `SavedProvidersScreen` | Add `<EmptyState>` for zero-data states. | M |
| 25 | `Spacing.tabBarHeight` unused | `client/constants/theme.ts:91`, both tab navigators | Either remove the token or have navigators derive min height from it. | S |
| 26 | Hardcoded radii | `BookingLinkScreen`, `BusinessHubScreen`, `ServicesScreen`, `ClientDetailScreen` (any `borderRadius: <number>`) | Map to `BorderRadius.*`. | M |
| 27 | Tab bar `borderRadius: 24` literal | `HomeownerTabNavigator.tsx:188`, `ProviderTabNavigator.tsx:188` | Use `BorderRadius["2xl"]`. | S |
| 28 | Header padding spot-check on `headerShown: false` screens | `RootStackNavigator.tsx:237-288,383`, target screens | Verify each uses `insets.top + Spacing.xl`. | M |
| 29 | ProviderFAB tab-aware visibility | `ProviderTabNavigator.tsx:234`, `ProviderFAB.tsx` | Hide FAB on Schedule/Finance tabs or trim its actions. | M |
| 30 | Haptics policy | `Button.tsx:58`, `PrimaryButton.tsx`, `SecondaryButton.tsx`, `Card.tsx` | Standardize: primary medium, secondary/ghost light, destructive warning. | S |

### P3 — nice-to-have

| # | Surface | File:line | Fix | Effort |
|---|---|---|---|---|
| 31 | Dynamic Type | All screen typography | Adopt `allowFontScaling`/clamping policy; document in `design_guidelines.md`. | L |
| 32 | Welcome gradient → token | `WelcomeScreen.tsx:24-25` | Promote to `Colors.brandGradient`. | S |
| 33 | `ThemedView` surface variants | `client/components/ThemedView.tsx` | Add `surface?: "root" \| "default" \| "elevated" \| "transparent"`. | S |
| 34 | `Spacer` defaults | `client/components/Spacer.tsx:9-10` | Default to `Spacing.md`. | S |
| 35 | Relative-time util hoisting | `LeadCard.tsx:49-61`, `MessageRow`, `BookingCard` | Extract into `client/lib/relativeTime.ts`. | S |

Total effort estimate: ~1 designer-week (P0+P1) and ~1 additional week (P2), with P3 trickling in.

---

## 11. Quick wins (ordered for the implementation task)

These are the cheapest items from the P0 table — knock them out first to bank visible polish quickly. The remaining P0 items (web crash on `SimpleBookingScreen`, stuck-loader fallbacks on the three detail screens, web fallback for the role cards) are larger and tracked separately in §10's P0 table — they are **not** covered by this quick-wins list.

1. `StatusPill` borderRadius → `full` (5 min, fixes every status-pill site app-wide). [P0 #6]
2. `FinancialsScreen` 7px → 11px (5 min, removes the most embarrassing bug). [P0 #1]
3. Remove "Create Test Invoice" from `StripeConnectScreen` (15 min, removes test artifact from production). [P0 #2]
4. Move 7 chat screens to `react-native-keyboard-controller` import (30 min, fixes a class of keyboard bugs). [P0 #5]
5. `ProviderFAB` raw `<Text>` → `ThemedText` (5 min). [P0 #3]
6. Replace `#AF52DE` quote-only purple in `SimpleBookingScreen` (5 min). [P0 #4]
7. `ProviderMoreScreen` stagger cap (5 min). [P1 polish]

The remaining P0s — #7 (`SimpleBookingScreen` web crash), #8 (detail-screen stuck loaders), and #9 (`AccountTypeSelection` cards on web) — require root-cause investigation and are sized M / M / S in §10.
