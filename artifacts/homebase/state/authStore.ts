import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl, queryClient } from "@/lib/query-client";
import { registerSessionHandlers } from "@/lib/sessionExpiry";
import { setSessionToken as secureSetSessionToken, getSessionToken as secureGetSessionToken } from "@/lib/secureSession";

export type UserRole = "guest" | "homeowner" | "provider" | "crew";
export type ProviderStatus = "draft" | "pending" | "approved" | "rejected" | "paused";

export interface CrewMembership {
  providerId: string;
  providerName: string;
  crewMemberId: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
  isProvider?: boolean;
  /** Task #220: DB-backed admin flag exposed via /api/auth/me. Drives the
   *  More-tab visibility of the HomeBase Partners admin entry. The server's
   *  requireAdmin middleware is the source of truth for actual access. */
  isAdmin?: boolean;
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
  description?: string;
  capabilityTags?: string[];
  yearsExperience?: number;
  specialty?: string;
  isActive?: boolean;
  isPublic?: boolean;
  isPartner?: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  sessionToken: string | null;
  activeRole: UserRole;
  /** Last explicit role chosen by the user — persisted through logout/login so
   *  dual-role users return to whichever view they were using last. */
  lastActiveRole: UserRole | null;
  /** Task #291: Persisted preferred role. Set from signup intent (provider
   *  signup → "provider", homeowner signup → "homeowner") and any explicit
   *  role switch. When set, the launch flow bypasses any role-selection
   *  gateway and routes directly into the matching tab navigator. Stays
   *  null only for users who have never picked a side. */
  preferredRole: UserRole | null;
  providerProfile: ProviderProfile | null;
  /** Task #328: every provider for whom this user is a linked, active crew
   *  member. Populated by /login + /api/auth/me. Crew is a capability flag,
   *  not a role; a user may simultaneously be homeowner, provider, and crew
   *  of N providers. */
  crewMemberships: CrewMembership[];
  /** Task #328: when set, the app renders the minimized 3-tab Crew portal
   *  scoped to that provider. Cleared when the user switches back. */
  activeCrewProviderId: string | null;
  isHydrated: boolean;
  needsRoleSelection: boolean;

  login: (user: User, providerProfile?: ProviderProfile | null, token?: string | null, crewMemberships?: CrewMembership[]) => void;
  logout: () => void;
  setActiveRole: (role: UserRole) => void;
  activateProviderMode: () => void;
  setPreferredRole: (role: UserRole | null) => void;
  setNeedsRoleSelection: (needs: boolean) => void;
  updateUser: (updates: Partial<User>) => void;
  setSessionToken: (token: string | null) => void;
  createProviderProfile: (profile: ProviderProfile) => void;
  clearProviderProfile: () => void;
  updateProviderStatus: (status: ProviderStatus) => void;
  updateProviderProfile: (updates: Partial<ProviderProfile>) => void;
  setCrewMemberships: (memberships: CrewMembership[]) => void;
  setActiveCrewProvider: (providerId: string | null) => void;
  hasProviderProfile: () => boolean;
  canAccessProviderMode: () => boolean;
  hydrate: () => Promise<void>;
  syncFromServer: () => Promise<void>;
}

const STORAGE_KEY = "auth-storage";

export const useAuthStore = create<AuthState>()((set, get) => ({
  isAuthenticated: false,
  user: null,
  sessionToken: null,
  activeRole: "guest",
  lastActiveRole: null,
  preferredRole: null,
  providerProfile: null,
  crewMemberships: [],
  activeCrewProviderId: null,
  isHydrated: false,
  needsRoleSelection: true,

  login: (user: User, providerProfile?: ProviderProfile | null, token?: string | null, crewMemberships?: CrewMembership[]) => {
    const hasApprovedProvider = providerProfile?.status === "approved";

    // Determine starting role. Priority order:
    //   1. Persisted preferredRole (Task #291) — the explicit choice from
    //      signup intent or a prior switch. Always wins for dual-role users.
    //   2. lastActiveRole — restores whichever view was used last.
    //   3. Default to "provider" for users with an approved profile,
    //      "homeowner" otherwise.
    const { lastActiveRole, preferredRole } = get();
    let activeRole: UserRole = "homeowner";
    if (hasApprovedProvider) {
      if (preferredRole === "homeowner" || preferredRole === "provider") {
        activeRole = preferredRole;
      } else if (lastActiveRole === "homeowner" || lastActiveRole === "provider") {
        activeRole = lastActiveRole;
      } else {
        activeRole = "provider";
      }
    } else if (preferredRole === "homeowner") {
      activeRole = "homeowner";
    }

    // Seed preferredRole on first login so dual-role gateways stay quiet on
    // future launches, even if the user never explicitly switches.
    const nextPreferred: UserRole | null = preferredRole ?? activeRole;

    const newState = {
      isAuthenticated: true,
      user,
      sessionToken: token || null,
      activeRole,
      preferredRole: nextPreferred,
      providerProfile: providerProfile || null,
      crewMemberships: crewMemberships || [],
      activeCrewProviderId: null,
      needsRoleSelection: false,
    };
    set(newState);
    secureSetSessionToken(token || null);
    saveToStorage(get());
  },

  logout: () => {
    const { lastActiveRole, preferredRole, sessionToken } = get();
    // Deactivate ONLY this device's push token (not the user's other devices).
    // Capture the bearer token NOW (before clearing auth state) and send it
    // explicitly so the request is authenticated even though the store is
    // wiped immediately after. Fire and forget: never block logout.
    (async () => {
      try {
        const pushToken = await AsyncStorage.getItem(
          "@homebase/current_push_token",
        );
        if (!pushToken || !sessionToken) return;
        const url = new URL("/api/push-tokens", getApiUrl()).toString();
        await fetch(url, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ token: pushToken }),
        });
        await AsyncStorage.removeItem("@homebase/current_push_token");
      } catch {}
    })();
    const newState = {
      isAuthenticated: false,
      user: null,
      sessionToken: null,
      activeRole: "guest" as UserRole,
      providerProfile: null,
      crewMemberships: [],
      activeCrewProviderId: null,
      // Keep lastActiveRole and preferredRole across logout so the next login
      // restores the prior view without re-prompting (Task #291).
      lastActiveRole,
      preferredRole,
    };
    set(newState);
    secureSetSessionToken(null);
    saveToStorage(get());
    queryClient.clear();
  },

  setActiveRole: (role: UserRole) => {
    const state = get();
    if (role === "provider" && !state.canAccessProviderMode()) {
      return;
    }
    // Task #291: any explicit role choice updates preferredRole so the launch
    // flow remembers it across restarts.
    set({ activeRole: role, lastActiveRole: role, preferredRole: role });
    saveToStorage(get());
  },

  activateProviderMode: () => {
    // Bypasses the canAccessProviderMode guard for use only after completing
    // ProviderSetupFlow — new providers don't have an approved backend profile yet.
    set({ activeRole: "provider", lastActiveRole: "provider", preferredRole: "provider" });
    saveToStorage(get());
  },

  setPreferredRole: (role: UserRole | null) => {
    set({ preferredRole: role });
    saveToStorage(get());
  },

  setNeedsRoleSelection: (needs: boolean) => {
    set({ needsRoleSelection: needs });
    saveToStorage(get());
  },

  updateUser: (updates: Partial<User>) => {
    const { user } = get();
    if (user) {
      const updated = { ...user, ...updates };
      set({ user: updated });
      saveToStorage(get());
    }
  },

  setSessionToken: (token: string | null) => {
    set({ sessionToken: token });
    secureSetSessionToken(token);
    saveToStorage(get());
  },

  clearProviderProfile: () => {
    set({ providerProfile: null });
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

  updateProviderProfile: (updates: Partial<ProviderProfile>) => {
    const { providerProfile } = get();
    if (providerProfile) {
      set({
        providerProfile: { ...providerProfile, ...updates },
      });
      saveToStorage(get());
    }
  },

  setCrewMemberships: (memberships: CrewMembership[]) => {
    const { activeCrewProviderId } = get();
    // If the active provider is no longer in the list (revoked / removed),
    // drop the active selection so the portal switcher reverts gracefully.
    const stillValid =
      activeCrewProviderId &&
      memberships.some((m) => m.providerId === activeCrewProviderId);
    set({
      crewMemberships: memberships,
      activeCrewProviderId: stillValid ? activeCrewProviderId : null,
    });
    saveToStorage(get());
  },

  setActiveCrewProvider: (providerId: string | null) => {
    set({ activeCrewProviderId: providerId });
    saveToStorage(get());
  },

  // Task #220: rehydrate user.isAdmin and providerProfile.isPartner from
  // server truth on app start. Admin can be granted via SQL (or by another
  // admin in the app) without invalidating the persisted auth blob, so we
  // explicitly fetch /api/auth/me whenever a session token exists. Failures
  // are silent — stale persisted values keep the app usable offline.
  syncFromServer: async () => {
    const { sessionToken, user, providerProfile } = get();
    if (!sessionToken) return;
    try {
      const { apiRequest } = await import("@/lib/query-client");
      const res = await apiRequest("GET", "/api/auth/me");
      const data = await res.json();
      if (!data?.user) return;

      const nextUser: User | null = user
        ? {
            ...user,
            id: data.user.id ?? user.id,
            name: data.user.name ?? user.name,
            email: data.user.email ?? user.email,
            phone: data.user.phone ?? user.phone,
            avatarUrl: data.user.avatarUrl ?? user.avatarUrl,
            isProvider: data.user.isProvider ?? user.isProvider,
            isAdmin: data.user.isAdmin === true,
          }
        : null;

      // /api/auth/me is authoritative for the provider record:
      // - If present, always overwrite id/userId/businessName from the
      //   server (a stale local id silently scopes provider screens to the
      //   wrong record). Status is forced to "approved" because the
      //   existence of a provider row means the user IS a provider;
      //   isActive only reflects the "available for work" toggle.
      // - If absent, clear the local profile — keeping a stale persisted
      //   record around scopes provider screens to a deleted row.
      const nextProfile: ProviderProfile | null = data.providerProfile
        ? {
            ...(providerProfile ?? {
              status: "approved" as const,
              rating: 0,
              reviewCount: 0,
              completedJobs: 0,
            }),
            id: data.providerProfile.id,
            userId: data.providerProfile.userId,
            businessName:
              data.providerProfile.businessName ??
              providerProfile?.businessName ??
              "",
            services:
              data.providerProfile.capabilityTags ??
              providerProfile?.services ??
              [],
            status: "approved" as const,
            rating:
              parseFloat(data.providerProfile.rating) ||
              providerProfile?.rating ||
              0,
            reviewCount:
              data.providerProfile.reviewCount ??
              providerProfile?.reviewCount ??
              0,
            isPartner: data.providerProfile.isPartner === true,
          }
        : null;

      const nextMemberships: CrewMembership[] = Array.isArray(
        data.crewMemberships,
      )
        ? data.crewMemberships
        : get().crewMemberships;
      const { activeCrewProviderId } = get();
      const stillValid =
        activeCrewProviderId &&
        nextMemberships.some((m) => m.providerId === activeCrewProviderId);

      set({
        user: nextUser,
        providerProfile: nextProfile,
        crewMemberships: nextMemberships,
        activeCrewProviderId: stillValid ? activeCrewProviderId : null,
      });
      saveToStorage(get());
    } catch {
      // Network / auth error — keep persisted values, surface elsewhere.
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
      // Prefer the SecureStore-backed session token. Migrate any legacy token
      // that was previously persisted in the AsyncStorage JSON blob.
      let secureToken = await secureGetSessionToken();
      if (stored) {
        const data = JSON.parse(stored);
        if (!secureToken && data.sessionToken) {
          await secureSetSessionToken(data.sessionToken);
          secureToken = data.sessionToken;
        }
        if (data.sessionToken) {
          // Clear it from the JSON blob so it's no longer persisted in plain storage.
          delete data.sessionToken;
          try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch {}
        }
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
          sessionToken: secureToken || null,
          activeRole,
          lastActiveRole: data.lastActiveRole || null,
          preferredRole: data.preferredRole || null,
          providerProfile,
          crewMemberships: Array.isArray(data.crewMemberships) ? data.crewMemberships : [],
          activeCrewProviderId: typeof data.activeCrewProviderId === "string" ? data.activeCrewProviderId : null,
          needsRoleSelection,
          isHydrated: true,
        });
      } else {
        set({ sessionToken: secureToken || null, isHydrated: true });
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
      // sessionToken is intentionally omitted: it lives in SecureStore.
      activeRole: state.activeRole,
      lastActiveRole: state.lastActiveRole,
      preferredRole: state.preferredRole,
      providerProfile: state.providerProfile,
      crewMemberships: state.crewMemberships,
      activeCrewProviderId: state.activeCrewProviderId,
      needsRoleSelection: state.needsRoleSelection,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save auth state:", error);
  }
}

registerSessionHandlers({
  getSessionToken: () => useAuthStore.getState().sessionToken,
  onExpiry: () => useAuthStore.getState().logout(),
});

useAuthStore.getState().hydrate();
