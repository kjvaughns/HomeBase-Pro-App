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

  const status = query.data?.status;
  return {
    ...query,
    providerId,
    status,
    daysRemainingInGrace: query.data?.daysRemainingInGrace ?? null,
    isFree: status === "free",
    isInGrace: status === "grace_period",
    isGated: status === "expired",
    isSubscribed: status === "subscribed",
  };
}
