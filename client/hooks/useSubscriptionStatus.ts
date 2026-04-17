import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/state/authStore";

export type SubscriptionStatus = "free" | "grace_period" | "expired" | "subscribed";

export interface SubscriptionStatusInfo {
  status: SubscriptionStatus;
  daysRemainingInGrace: number | null;
  firstPaidBookingAt: string | null;
  gracePeriodEndsAt: string | null;
  isSubscribed: boolean;
}

export function useSubscriptionStatus() {
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;

  const query = useQuery<SubscriptionStatusInfo>({
    queryKey: ["/api/providers", providerId, "subscription-status"],
    enabled: !!providerId,
    staleTime: 60_000,
  });

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
