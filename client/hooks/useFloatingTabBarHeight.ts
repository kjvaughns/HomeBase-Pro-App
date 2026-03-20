import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Returns the total height occupied by the custom floating pill tab bar
 * (tabHeight + bottomOffset). Use this in place of useBottomTabBarHeight()
 * for screens inside either HomeownerTabNavigator or ProviderTabNavigator,
 * because those navigators use an absolutely-positioned custom tab bar that
 * does not report its height to React Navigation's context.
 */
export function useFloatingTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabHeight = width < 375 ? 52 : 60;
  const bottomOffset = Math.max(insets.bottom > 0 ? insets.bottom + 8 : 20, 20);
  return tabHeight + bottomOffset;
}
