import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AccountType = "homeowner" | "provider";

export interface ProviderPreSignupData {
  businessName: string;
  category: string;
  serviceArea: string;
}

export interface OnboardingServiceData {
  name: string;
  category: string;
  description: string;
  pricingType: "flat" | "starts_at" | "quote";
  basePrice: string;
  priceUnit: string;
  duration: number;
  bookingMode: "instant" | "starts_at" | "quote_only";
}

interface OnboardingState {
  hasCompletedFirstLaunch: boolean;
  hasCompletedProviderSetup: boolean;
  needsProviderSetup: boolean;
  selectedAccountType: AccountType | null;
  providerPreSignupData: ProviderPreSignupData | null;
  pendingOnboardingService: OnboardingServiceData | null;
  isHydrated: boolean;
  
  setHasCompletedFirstLaunch: (completed: boolean) => void;
  setHasCompletedProviderSetup: (completed: boolean) => void;
  setNeedsProviderSetup: (v: boolean) => void;
  setAccountType: (type: AccountType) => void;
  setProviderPreSignupData: (data: ProviderPreSignupData | null) => void;
  setPendingOnboardingService: (data: OnboardingServiceData | null) => void;
  reset: () => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = "onboarding-storage";

async function saveToStorage(state: Partial<OnboardingState>) {
  try {
    const toSave = {
      hasCompletedFirstLaunch: state.hasCompletedFirstLaunch,
      hasCompletedProviderSetup: state.hasCompletedProviderSetup,
      selectedAccountType: state.selectedAccountType,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (error) {
    console.error("Failed to save onboarding state:", error);
  }
}

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  hasCompletedFirstLaunch: false,
  hasCompletedProviderSetup: false,
  needsProviderSetup: false,
  selectedAccountType: null,
  providerPreSignupData: null,
  pendingOnboardingService: null,
  isHydrated: false,

  setHasCompletedFirstLaunch: (completed: boolean) => {
    set({ hasCompletedFirstLaunch: completed });
    saveToStorage(get());
  },

  setHasCompletedProviderSetup: (completed: boolean) => {
    set({ hasCompletedProviderSetup: completed });
    saveToStorage(get());
  },

  setNeedsProviderSetup: (v: boolean) => {
    set({ needsProviderSetup: v });
  },

  setAccountType: (type: AccountType) => {
    set({ selectedAccountType: type });
    saveToStorage(get());
  },

  setProviderPreSignupData: (data: ProviderPreSignupData | null) => {
    set({ providerPreSignupData: data });
  },

  setPendingOnboardingService: (data: OnboardingServiceData | null) => {
    set({ pendingOnboardingService: data });
  },

  reset: () => {
    set({
      hasCompletedFirstLaunch: false,
      hasCompletedProviderSetup: false,
      needsProviderSetup: false,
      selectedAccountType: null,
      providerPreSignupData: null,
      pendingOnboardingService: null,
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
          hasCompletedProviderSetup: parsed.hasCompletedProviderSetup ?? false,
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
