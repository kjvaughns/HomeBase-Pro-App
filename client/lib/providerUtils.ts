import { Provider } from "@/state/types";

export interface ApiProviderBase {
  id: string;
  businessName?: string | null;
  avatarUrl?: string | null;
  averageRating?: string | null;
  rating?: string | null;
  reviewCount?: number | null;
  hourlyRate?: string | null;
  isVerified?: boolean | null;
  description?: string | null;
  yearsExperience?: number | null;
  completedJobs?: number | null;
  responseTime?: string | null;
  distance?: number | null;
  phone?: string | null;
}

export interface ApiServiceItem {
  id?: string;
  name: string;
}

export function mapApiProvider(p: ApiProviderBase, serviceList: ApiServiceItem[]): Provider {
  return {
    id: p.id,
    name: p.businessName ?? "",
    businessName: p.businessName ?? "",
    avatarUrl: p.avatarUrl ?? undefined,
    rating: parseFloat(p.averageRating ?? p.rating ?? "0") || 0,
    reviewCount: p.reviewCount ?? 0,
    services: serviceList.map((s) => s.name ?? ""),
    categoryIds: [],
    hourlyRate: parseFloat(p.hourlyRate ?? "0") || 0,
    verified: p.isVerified ?? false,
    description: p.description ?? "",
    yearsExperience: p.yearsExperience ?? 0,
    completedJobs: p.completedJobs ?? 0,
    responseTime: p.responseTime ?? "< 1 hour",
    distance: p.distance ?? undefined,
    gallery: [],
    phone: p.phone ?? undefined,
  };
}
