import { useColorScheme as useRNColorScheme, ColorSchemeName } from "react-native";
import { useThemeStore } from "@/state/themeStore";

export function useColorScheme(): ColorSchemeName {
  const systemColorScheme = useRNColorScheme();
  const mode = useThemeStore((s) => s.mode);

  if (mode === "system") {
    return systemColorScheme;
  }
  return mode;
}
