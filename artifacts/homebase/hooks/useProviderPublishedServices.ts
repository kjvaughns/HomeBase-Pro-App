import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import {
  parseIntakeQuestions,
  type IntakeQuestionDef,
} from "@/shared/jobSummary";

/**
 * Shared description of a published provider service, used by every booking
 * entry point in the client (provider Add Job, homeowner Simple Booking).
 *
 * The shape mirrors the columns returned by `/api/provider/:id/custom-services`
 * so each screen can pick the fields it needs without re-declaring the type.
 */
export interface PublishedProviderService {
  id: string;
  name: string;
  category: string;
  description: string | null;
  pricingType: string;
  basePrice: string | null;
  priceFrom: string | null;
  priceTo: string | null;
  priceTiersJson: string | null;
  duration: number | null;
  isAddon: boolean;
  addOnsJson: string | null;
  intakeQuestionsJson: string | null;
  bookingMode: string | null;
}

export interface UseProviderPublishedServicesResult {
  services: PublishedProviderService[];
  isLoading: boolean;
  isError: boolean;
  /** Pre-parsed intake questions, keyed by service id for O(1) lookup. */
  intakeQuestionsByService: Record<string, IntakeQuestionDef[]>;
}

/**
 * Single source of truth for fetching a provider's published service catalog.
 * Both AddJobScreen and SimpleBookingScreen use this so any change to a
 * service is reflected everywhere without per-screen drift.
 */
export function useProviderPublishedServices(
  providerId: string | null | undefined,
): UseProviderPublishedServicesResult {
  const { data, isLoading, isError } = useQuery<{
    services: PublishedProviderService[];
  }>({
    queryKey: ["/api/provider", providerId, "custom-services", "published"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/provider/${providerId}/custom-services?publishedOnly=true`,
      );
      return res.json();
    },
    enabled: !!providerId,
  });

  const services = data?.services ?? [];

  const intakeQuestionsByService = useMemo(() => {
    const map: Record<string, IntakeQuestionDef[]> = {};
    for (const svc of services) {
      map[svc.id] = parseIntakeQuestions(svc.intakeQuestionsJson);
    }
    return map;
  }, [services]);

  return { services, isLoading, isError, intakeQuestionsByService };
}
