import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, ColorSchemeName } from "react-native";

interface ThemeState {
  mode: "system" | "light" | "dark";
  isHydrated: boolean;
  getColorScheme: () => ColorSchemeName;
  setMode: (mode: "system" | "light" | "dark") => void;
  toggleDarkMode: () => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = "theme-storage";

export const useThemeStore = create<ThemeState>()((set, get) => ({
  mode: "system",
  isHydrated: false,

  getColorScheme: () => {
    const { mode } = get();
    if (mode === "system") {
      return Appearance.getColorScheme();
    }
    return mode;
  },

  setMode: (mode) => {
    set({ mode });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ mode })).catch(() => {});
  },

  toggleDarkMode: () => {
    const { getColorScheme } = get();
    const currentScheme = getColorScheme();
    const newMode = currentScheme === "dark" ? "light" : "dark";
    set({ mode: newMode });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: newMode })).catch(() => {});
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({ mode: data.mode || "system", isHydrated: true });
      } else {
        set({ isHydrated: true });
      }
    } catch {
      set({ isHydrated: true });
    }
  },
}));
