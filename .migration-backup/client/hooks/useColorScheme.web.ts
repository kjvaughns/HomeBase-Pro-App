import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";
import { useThemeStore } from "@/state/themeStore";

export function useColorScheme(): "light" | "dark" {
  const [hasHydrated, setHasHydrated] = useState(false);
  const systemColorScheme = useRNColorScheme();
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) {
    return "light";
  }

  if (mode === "system") {
    return systemColorScheme === "dark" ? "dark" : "light";
  }
  return mode;
}
