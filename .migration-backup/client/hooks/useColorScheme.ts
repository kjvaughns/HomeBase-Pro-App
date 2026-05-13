import { useColorScheme as useRNColorScheme } from "react-native";
import { useThemeStore } from "@/state/themeStore";

export function useColorScheme(): "light" | "dark" {
  const systemColorScheme = useRNColorScheme();
  const mode = useThemeStore((s) => s.mode);

  if (mode === "system") {
    return systemColorScheme === "dark" ? "dark" : "light";
  }
  return mode;
}
