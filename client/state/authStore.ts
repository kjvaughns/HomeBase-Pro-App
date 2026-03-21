import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { queryClient } from "@/lib/query-client";

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
  serviceArea?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  sessionToken: string | null;
  activeRole: UserRole;
  providerProfile: ProviderProfile | null;
  isHydrated: boolean;
  needsRoleSelection: boolean;
  
  login: (user: User, providerProfile?: ProviderProfile | null, token?: string | null) => void;
  logout: () => void;
  setActiveRole: (role: UserRole) => void;
  activateProviderMode: () => void;
  setNeedsRoleSelection: (needs: boolean) => void;
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
  sessionToken: null,
  activeRole: "guest",
  providerProfile: null,
  isHydrated: false,
  needsRoleSelection: true,

  login: (user: User, providerProfile?: ProviderProfile | null, token?: string | null) => {
    const newState = {
      isAuthenticated: true,
      user,
      sessionToken: token || null,
      activeRole: "guest" as UserRole,
      providerProfile: providerProfile || null,
      needsRoleSelection: true,
    };
    set(newState);
    saveToStorage(get());
  },

  logout: () => {
    const newState = {
      isAuthenticated: false,
      user: null,
      sessionToken: null,
      activeRole: "guest" as UserRole,
      providerProfile: null,
    };
    set(newState);
    saveToStorage(get());
    queryClient.clear();
  },

  setActiveRole: (role: UserRole) => {
    const state = get();
    if (role === "provider" && !state.canAccessProviderMode()) {
      return;
    }
    set({ activeRole: role });
    saveToStorage(get());
  },

  activateProviderMode: () => {
    // Bypasses the canAccessProviderMode guard for use only after completing
    // ProviderSetupFlow — new providers don't have an approved backend profile yet.
    set({ activeRole: "provider" });
    saveToStorage(get());
  },

  setNeedsRoleSelection: (needs: boolean) => {
    set({ needsRoleSelection: needs });
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
          sessionToken: data.sessionToken || null,
          activeRole: data.activeRole || "guest",
          providerProfile: data.providerProfile || null,
          needsRoleSelection: data.needsRoleSelection ?? true,
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
      sessionToken: state.sessionToken,
      activeRole: state.activeRole,
      providerProfile: state.providerProfile,
      needsRoleSelection: state.needsRoleSelection,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save auth state:", error);
  }
}

useAuthStore.getState().hydrate();
