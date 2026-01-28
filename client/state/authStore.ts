import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserRole = "guest" | "homeowner" | "provider";
export type ProviderStatus = "draft" | "pending" | "approved" | "rejected" | "paused";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
}

export interface ProviderProfile {
  id: string;
  userId: string;
  businessName: string;
  services: string[];
  status: ProviderStatus;
  rating: number;
  reviewCount: number;
  completedJobs: number;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  activeRole: UserRole;
  providerProfile: ProviderProfile | null;
  isHydrated: boolean;
  
  login: (user: User, providerProfile?: ProviderProfile | null) => void;
  logout: () => void;
  setActiveRole: (role: UserRole) => void;
  createProviderProfile: (profile: ProviderProfile) => void;
  updateProviderStatus: (status: ProviderStatus) => void;
  hasProviderProfile: () => boolean;
  canAccessProviderMode: () => boolean;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = "auth-storage";

export const useAuthStore = create<AuthState>()((set, get) => ({
  isAuthenticated: false,
  user: null,
  activeRole: "guest",
  providerProfile: null,
  isHydrated: false,

  login: (user: User, providerProfile?: ProviderProfile | null) => {
    const newState = {
      isAuthenticated: true,
      user,
      activeRole: "homeowner" as UserRole,
      providerProfile: providerProfile || null,
    };
    set(newState);
    saveToStorage(get());
  },

  logout: () => {
    const newState = {
      isAuthenticated: false,
      user: null,
      activeRole: "guest" as UserRole,
      providerProfile: null,
    };
    set(newState);
    saveToStorage(get());
  },

  setActiveRole: (role: UserRole) => {
    const state = get();
    if (role === "provider" && !state.canAccessProviderMode()) {
      return;
    }
    set({ activeRole: role });
    saveToStorage(get());
  },

  createProviderProfile: (profile: ProviderProfile) => {
    set({ providerProfile: profile });
    saveToStorage(get());
  },

  updateProviderStatus: (status: ProviderStatus) => {
    const { providerProfile } = get();
    if (providerProfile) {
      set({
        providerProfile: { ...providerProfile, status },
      });
      saveToStorage(get());
    }
  },

  hasProviderProfile: () => {
    return get().providerProfile !== null;
  },

  canAccessProviderMode: () => {
    const { providerProfile } = get();
    return providerProfile?.status === "approved";
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({
          isAuthenticated: data.isAuthenticated || false,
          user: data.user || null,
          activeRole: data.activeRole || "guest",
          providerProfile: data.providerProfile || null,
          isHydrated: true,
        });
      } else {
        set({ isHydrated: true });
      }
    } catch (error) {
      console.error("Failed to hydrate auth store:", error);
      set({ isHydrated: true });
    }
  },
}));

async function saveToStorage(state: AuthState) {
  try {
    const data = {
      isAuthenticated: state.isAuthenticated,
      user: state.user,
      activeRole: state.activeRole,
      providerProfile: state.providerProfile,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save auth state:", error);
  }
}

useAuthStore.getState().hydrate();
