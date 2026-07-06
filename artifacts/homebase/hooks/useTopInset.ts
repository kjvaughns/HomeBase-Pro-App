import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Guardrail for top safe-area padding.
 *
 * `useHeaderHeight()` already bakes in `insets.top` whenever a header exists
 * anywhere in the ancestor navigator chain (stack or tab), so adding
 * `insets.top` on top of it double-counts and over-pads. But on screens
 * where no header is shown anywhere above (`headerShown: false` with no
 * parent header), `useHeaderHeight()` falls back to 0, and forgetting
 * `insets.top` there lets content bleed under the status bar/notch.
 *
 * `Math.max(headerHeight, insets.top)` is correct in both cases:
 * - Header present: headerHeight already >= insets.top, so the max is headerHeight.
 * - No header: headerHeight is 0, so the max falls back to insets.top.
 *
 * Usage:
 *   const topInset = useTopInset(Spacing.lg); // extra breathing room below the header/notch
 *   <ScrollView contentContainerStyle={{ paddingTop: topInset }} />
 */
export function useTopInset(extra: number = 0): number {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  return Math.max(headerHeight, insets.top) + extra;
}
