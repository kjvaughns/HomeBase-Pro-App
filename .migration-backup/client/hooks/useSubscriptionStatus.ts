import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/state/authStore";

export type SubscriptionStatus =
  | "free"
  | "grace_period"
  | "expired"
  | "subscribed";

export interface SubscriptionStatusInfo {
  status: SubscriptionStatus;
  daysRemainingInGrace: number | null;
  firstPaidBookingAt: string | null;
  gracePeriodEndsAt: string | null;
  isSubscribed: boolean;
  subscriptionSource: string | null;
  currentPeriodEnd: string | null;
}

export function useSubscriptionStatus() {
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;
  const queryClient = useQueryClient();

  const queryKey = [
    "/api/providers",
    providerId,
    "subscription-status",
  ] as const;

  const query = useQuery<SubscriptionStatusInfo>({
    queryKey,
    enabled: !!providerId,
    staleTime: 60_000,
    // Refetch on every mount so freshly-granted Partner status takes effect
    // without needing a cold app start. Without this, the trial banner could
    // linger for up to a minute after a grant because of staleTime caching.
    refetchOnMount: "always",
  });

  // Refetch when the app returns to foreground — picks up subscription changes
  // made via the hosted Stripe Checkout / Customer Portal flows (Task #124).
  useEffect(() => {
    let lastState: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (
        lastState.match(/inactive|background/) &&
        next === "active" &&
        providerId
      ) {
        queryClient.invalidateQueries({ queryKey });
      }
      lastState = next;
    });
    return () => sub.remove();
  }, [queryClient, providerId]);

  // HomeBase Partner (Task #211, #220, #222): admin-granted complimentary Pro
  // access. Server reports status="subscribed" with subscriptionSource="partner"
  // so the paywall, grace banner, and billing UI all bypass automatically.
  // We also OR in the auth store's providerProfile.isPartner flag (rehydrated
  // from /api/auth/me on app start) as a defense-in-depth so a stale
  // subscription-status cache can never show the trial banner to a Partner.
  const isPartner =
    query.data?.subscriptionSource === "partner" ||
    providerProfile?.isPartner === true;
  const rawStatus = query.data?.status;
  // When the auth store says Partner but the cached query hasn't caught up,
  // promote the resolved status to "subscribed" so every consumer of this
  // hook (banners, gates, More-screen subtitle) treats the user as paid.
  const status: SubscriptionStatus | undefined =
    isPartner && rawStatus !== "subscribed" ? "subscribed" : rawStatus;
  return {
    ...query,
    providerId,
    status,
    daysRemainingInGrace: isPartner
      ? null
      : (query.data?.daysRemainingInGrace ?? null),
    isFree: status === "free" && !isPartner,
    isInGrace: status === "grace_period" && !isPartner,
    isGated: status === "expired" && !isPartner,
    isSubscribed: status === "subscribed",
    isPartner,
  };
}
