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
  isProvider?: boolean;
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
  licenseNumber?: string;
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
    const hasApprovedProvider = providerProfile?.status === "approved";
    const newState = {
      isAuthenticated: true,
      user,
      sessionToken: token || null,
      // Providers land directly in provider mode. Homeowners land in homeowner mode.
      // Role is stored persistently so returning users keep their last used view.
      activeRole: hasApprovedProvider ? "provider" as UserRole : "homeowner" as UserRole,
      providerProfile: providerProfile || null,
      needsRoleSelection: false,
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
    const { providerProfile, user } = get();
    // Primary: explicit approved status set at login
    if (providerProfile?.status === "approved") return true;
    // Fallback: DB-sourced isProvider flag combined with a stored profile ID
    // Covers stale AsyncStorage where status was never written or got wiped
    if (user?.isProvider && providerProfile?.id) return true;
    return false;
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const isAuthenticated = data.isAuthenticated || false;
        const needsRoleSelection = isAuthenticated ? false : (data.needsRoleSelection ?? true);
        const storedUser = data.user || null;
        let providerProfile = data.providerProfile || null;

        // Repair stale cache: if a providerProfile.id is present but status is
        // missing or non-approved, infer "approved" from the DB-sourced
        // user.isProvider flag that was stored alongside the user object.
        if (providerProfile?.id && providerProfile.status !== "approved") {
          if (storedUser?.isProvider) {
            providerProfile = { ...providerProfile, status: "approved" as ProviderStatus };
          }
        }

        const isApprovedProvider = providerProfile?.status === "approved";
        let activeRole: UserRole = data.activeRole || "guest";
        // Recover from a "guest" role stored while authenticated (shouldn't happen
        // normally, but guards against edge-case corruption).
        if (isAuthenticated && activeRole === "guest") {
          activeRole = isApprovedProvider ? "provider" : "homeowner";
        }
        set({
          isAuthenticated,
          user: storedUser,
          sessionToken: data.sessionToken || null,
          activeRole,
          providerProfile,
          needsRoleSelection,
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
