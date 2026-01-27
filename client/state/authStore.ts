import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
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
  
  login: (user: User) => void;
  logout: () => void;
  setActiveRole: (role: UserRole) => void;
  createProviderProfile: (profile: ProviderProfile) => void;
  updateProviderStatus: (status: ProviderStatus) => void;
  hasProviderProfile: () => boolean;
  canAccessProviderMode: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      activeRole: "guest",
      providerProfile: null,

      login: (user: User) => {
        set({
          isAuthenticated: true,
          user,
          activeRole: "homeowner",
        });
      },

      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          activeRole: "guest",
          providerProfile: null,
        });
      },

      setActiveRole: (role: UserRole) => {
        const state = get();
        if (role === "provider" && !state.canAccessProviderMode()) {
          return;
        }
        set({ activeRole: role });
      },

      createProviderProfile: (profile: ProviderProfile) => {
        set({ providerProfile: profile });
      },

      updateProviderStatus: (status: ProviderStatus) => {
        const { providerProfile } = get();
        if (providerProfile) {
          set({
            providerProfile: { ...providerProfile, status },
          });
        }
      },

      hasProviderProfile: () => {
        return get().providerProfile !== null;
      },

      canAccessProviderMode: () => {
        const { providerProfile } = get();
        return providerProfile?.status === "approved";
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
