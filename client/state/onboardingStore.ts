import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AccountType = "homeowner" | "provider";

interface OnboardingState {
  hasCompletedFirstLaunch: boolean;
  selectedAccountType: AccountType | null;
  isHydrated: boolean;
  
  setHasCompletedFirstLaunch: (completed: boolean) => void;
  setAccountType: (type: AccountType) => void;
  reset: () => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = "onboarding-storage";

async function saveToStorage(state: Partial<OnboardingState>) {
  try {
    const toSave = {
      hasCompletedFirstLaunch: state.hasCompletedFirstLaunch,
      selectedAccountType: state.selectedAccountType,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (error) {
    console.error("Failed to save onboarding state:", error);
  }
}

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  hasCompletedFirstLaunch: false,
  selectedAccountType: null,
  isHydrated: false,

  setHasCompletedFirstLaunch: (completed: boolean) => {
    set({ hasCompletedFirstLaunch: completed });
    saveToStorage(get());
  },

  setAccountType: (type: AccountType) => {
    set({ selectedAccountType: type });
    saveToStorage(get());
  },

  reset: () => {
    set({
      hasCompletedFirstLaunch: false,
      selectedAccountType: null,
    });
    AsyncStorage.removeItem(STORAGE_KEY);
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({
          hasCompletedFirstLaunch: parsed.hasCompletedFirstLaunch ?? false,
          selectedAccountType: parsed.selectedAccountType ?? null,
          isHydrated: true,
        });
      } else {
        set({ isHydrated: true });
      }
    } catch (error) {
      console.error("Failed to hydrate onboarding state:", error);
      set({ isHydrated: true });
    }
  },
}));
