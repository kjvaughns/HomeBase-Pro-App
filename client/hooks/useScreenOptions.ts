import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { isLiquidGlassAvailable } from "expo-glass-effect";

import { useTheme } from "@/hooks/useTheme";
import { Typography } from "@/constants/theme";

interface UseScreenOptionsParams {
  transparent?: boolean;
  largeTitleEnabled?: boolean;
}

export function useScreenOptions({
  transparent = true,
  largeTitleEnabled = false,
}: UseScreenOptionsParams = {}): NativeStackNavigationOptions {
  const { theme, isDark } = useTheme();

  return {
    headerTitleAlign: "center",
    headerTransparent: transparent,
    headerBlurEffect: isDark ? "systemMaterialDark" : "systemMaterial",
    headerTintColor: theme.text,
    headerBackTitleVisible: false,
    headerTitleStyle: {
      ...Typography.headline,
      color: theme.text,
    },
    headerStyle: {
      backgroundColor: Platform.select({
        ios: transparent ? undefined : theme.backgroundRoot,
        android: theme.backgroundRoot,
        web: transparent ? "transparent" : theme.backgroundRoot,
      }),
    },
    headerShadowVisible: false,
    gestureEnabled: true,
    gestureDirection: "horizontal",
    fullScreenGestureEnabled: isLiquidGlassAvailable() ? false : true,
    animation: "default",
    contentStyle: {
      backgroundColor: theme.backgroundRoot,
    },
  };
}
