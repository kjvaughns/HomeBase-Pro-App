import { useWindowDimensions } from "react-native";
import { Spacing } from "@/constants/theme";

const TABLET_BREAKPOINT = 768;
const CONTENT_MAX_WIDTH = 680;

export interface LayoutValues {
  width: number;
  height: number;
  isTablet: boolean;
  contentMaxWidth: number;
  horizontalPadding: number;
}

/**
 * Responsive layout utility. Exposes isTablet (width >= 768), a centered
 * contentMaxWidth cap (680 px), and a horizontalPadding that automatically
 * centers content on wider viewports (iPad).
 *
 * Usage:
 *   const { isTablet, horizontalPadding } = useLayout();
 *   // In contentContainerStyle: paddingHorizontal: horizontalPadding
 */
export function useLayout(): LayoutValues {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const contentMaxWidth = CONTENT_MAX_WIDTH;
  const horizontalPadding = isTablet
    ? Math.max(Spacing.screenPadding, (width - contentMaxWidth) / 2)
    : Spacing.screenPadding;

  return { width, height, isTablet, contentMaxWidth, horizontalPadding };
}
