import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/state/authStore";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";

interface LeadLite {
  id: string;
  status: string;
  createdAt?: string | null;
}

interface IntakeSubmissionLite {
  id: string;
  status: string;
  createdAt?: string | null;
}

const BADGE_LAST_VIEWED_KEY_PREFIX = "@homebase/leads_badge_last_viewed_at:";

const cachedLastViewedAt = new Map<string, number>();
const listeners = new Set<(scope: string, t: number) => void>();

function storageKey(scope: string): string {
  return `${BADGE_LAST_VIEWED_KEY_PREFIX}${scope}`;
}

async function loadLastViewedAt(scope: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(scope));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Mark the Leads badge as viewed for the active provider. Call from
 * `LeadsScreen` whenever it gains focus. The `scope` should be the
 * provider id; pass undefined to clear the global/anonymous bucket.
 */
export async function markLeadsBadgeViewed(scope?: string): Promise<void> {
  const key = scope ?? "anon";
  const ts = Date.now();
  cachedLastViewedAt.set(key, ts);
  try {
    await AsyncStorage.setItem(storageKey(key), String(ts));
  } catch {
    // ignore — in-memory cache still works for the current session
  }
  listeners.forEach((fn) => fn(key, ts));
}

function isPending(status: string): boolean {
  return status === "new" || status === "pending";
}

function isPendingSubmission(status: string): boolean {
  return status === "submitted";
}

/**
 * Returns the number of new leads + intake submissions the provider
 * has not yet opened. The count is based on items with a "needs action"
 * status (`new`/`pending` for leads, `submitted` for intake submissions)
 * created after the last time the provider opened the Leads tab. Call
 * `markLeadsBadgeViewed()` from the Leads screen to clear the badge.
 */
export function useLeadsBadgeCount(): number {
  const { providerProfile, activeRole } = useAuthStore();
  const providerId = providerProfile?.id;
  const enabled = !!providerId && activeRole === "provider";

  const scope = providerId ?? "anon";
  const [lastViewedAt, setLastViewedAt] = useState<number>(
    () => cachedLastViewedAt.get(scope) ?? 0,
  );

  useEffect(() => {
    let mounted = true;
    const cached = cachedLastViewedAt.get(scope);
    if (cached !== undefined) {
      setLastViewedAt(cached);
    } else {
      loadLastViewedAt(scope).then((ts) => {
        cachedLastViewedAt.set(scope, ts);
        if (mounted) setLastViewedAt(ts);
      });
    }
    const sub = (s: string, ts: number) => {
      if (mounted && s === scope) setLastViewedAt(ts);
    };
    listeners.add(sub);
    return () => {
      mounted = false;
      listeners.delete(sub);
    };
  }, [scope]);

  const { data: leadsData } = useQuery<{ leads: LeadLite[] }>({
    queryKey: ["/api/providers", providerId, "leads"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const url = new URL(`/api/providers/${providerId}/leads`, getApiUrl());
      const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  const { data: submissionsData } = useQuery<{ submissions: IntakeSubmissionLite[] }>({
    queryKey: ["/api/providers", providerId, "intake-submissions"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const url = new URL(
        `/api/providers/${providerId}/intake-submissions`,
        getApiUrl(),
      );
      const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("Failed to fetch intake submissions");
      return res.json();
    },
  });

  const newerThanLastView = (createdAt?: string | null): boolean => {
    if (!lastViewedAt) return true;
    if (!createdAt) return true;
    const t = Date.parse(createdAt);
    if (!Number.isFinite(t)) return true;
    return t > lastViewedAt;
  };

  const newLeads = (leadsData?.leads ?? []).filter(
    (l) => isPending(l.status) && newerThanLastView(l.createdAt),
  ).length;
  const pendingSubmissions = (submissionsData?.submissions ?? []).filter(
    (s) => isPendingSubmission(s.status) && newerThanLastView(s.createdAt),
  ).length;

  return newLeads + pendingSubmissions;
}
