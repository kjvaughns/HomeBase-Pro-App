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
  /** Epoch ms set when the user first taps a "signup_started" CTA.
   *  Used to measure end-to-end provider sign-up duration for the
   *  `provider_first_booking_link_ready` analytics event. */
  signupStartedAt: number | null;
  /** Keys of Getting Started checklist steps the provider has dismissed
   *  from the dashboard. Persisted across launches. */
  dismissedChecklistSteps: string[];
  isHydrated: boolean;

  setHasCompletedFirstLaunch: (completed: boolean) => void;
  setHasCompletedProviderSetup: (completed: boolean) => void;
  setNeedsProviderSetup: (v: boolean) => void;
  setAccountType: (type: AccountType) => void;
  setProviderPreSignupData: (data: ProviderPreSignupData | null) => void;
  setPendingOnboardingService: (data: OnboardingServiceData | null) => void;
  startSignupTimer: () => void;
  clearSignupTimer: () => void;
  dismissChecklistStep: (key: string) => void;
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
      signupStartedAt: state.signupStartedAt,
      dismissedChecklistSteps: state.dismissedChecklistSteps,
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
  signupStartedAt: null,
  dismissedChecklistSteps: [],
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

  startSignupTimer: () => {
    // Only start the timer once per signup attempt — don't reset if a
    // user re-taps a role card after already starting.
    if (get().signupStartedAt) return;
    set({ signupStartedAt: Date.now() });
    saveToStorage(get());
  },

  clearSignupTimer: () => {
    set({ signupStartedAt: null });
    saveToStorage(get());
  },

  dismissChecklistStep: (key: string) => {
    const current = get().dismissedChecklistSteps;
    if (current.includes(key)) return;
    set({ dismissedChecklistSteps: [...current, key] });
    saveToStorage(get());
  },

  reset: () => {
    set({
      hasCompletedFirstLaunch: false,
      hasCompletedProviderSetup: false,
      needsProviderSetup: false,
      selectedAccountType: null,
      providerPreSignupData: null,
      pendingOnboardingService: null,
      signupStartedAt: null,
      dismissedChecklistSteps: [],
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
          signupStartedAt: parsed.signupStartedAt ?? null,
          dismissedChecklistSteps: Array.isArray(parsed.dismissedChecklistSteps)
            ? parsed.dismissedChecklistSteps
            : [],
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
