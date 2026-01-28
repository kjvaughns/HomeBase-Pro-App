import { Feather } from "@expo/vector-icons";

export type JobStatus = 
  | "requested"
  | "scheduled"
  | "in_progress"
  | "awaiting_payment"
  | "completed"
  | "paid"
  | "closed";

export type BookingStatus = "pending" | "confirmed" | "cancelled";

export type PaymentStatus = "pending" | "processing" | "completed" | "failed";

export type UrgencyLevel = "flexible" | "soon" | "urgent" | "emergency";

export type JobSize = "small" | "medium" | "large";

export interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean;
}

export interface PaymentMethod {
  id: string;
  type: "card" | "bank" | "apple_pay";
  label: string;
  last4: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
}

export interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface ProviderAvailability {
  providerId: string;
  slots: TimeSlot[];
}

export interface Review {
  id: string;
  jobId: string;
  providerId: string;
  homeownerId: string;
  homeownerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Provider {
  id: string;
  name: string;
  businessName: string;
  avatarUrl?: string;
  rating: number;
  reviewCount: number;
  services: string[];
  categoryIds: string[];
  hourlyRate: number;
  verified: boolean;
  description: string;
  yearsExperience: number;
  completedJobs: number;
  responseTime: string;
  distance?: number;
  gallery: string[];
  phone?: string;
}

export interface TimelineEvent {
  id: string;
  type: "status_change" | "message" | "photo" | "payment" | "note";
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Invoice {
  id: string;
  jobId: string;
  providerId: string;
  homeownerId: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  laborHours: number;
  laborRate: number;
  laborTotal: number;
  materialsTotal: number;
  subtotal: number;
  tax: number;
  total: number;
  status: "draft" | "sent" | "paid";
  createdAt: string;
  paidAt?: string;
}

export interface Receipt {
  id: string;
  invoiceId: string;
  jobId: string;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  createdAt: string;
}

export interface Job {
  id: string;
  homeownerId: string;
  providerId: string;
  providerName: string;
  providerBusinessName: string;
  providerAvatar?: string;
  categoryId: string;
  service: string;
  status: JobStatus;
  description: string;
  urgency: UrgencyLevel;
  size: JobSize;
  addressId: string;
  address: string;
  scheduledDate: string;
  scheduledTime: string;
  estimatedPrice: number;
  finalPrice?: number;
  photosBefore: string[];
  photosAfter: string[];
  timeline: TimelineEvent[];
  invoiceId?: string;
  receiptId?: string;
  reviewId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Quote {
  id: string;
  jobId?: string;
  providerId: string;
  providerName: string;
  providerAvatar?: string;
  homeownerId: string;
  service: string;
  description: string;
  estimatedHours: number;
  laborRate: number;
  materialsEstimate: number;
  totalEstimate: number;
  validUntil: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: string;
}

export interface HomeownerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  addresses: Address[];
  paymentMethods: PaymentMethod[];
  createdAt: string;
}

export interface BookingRequest {
  categoryId: string;
  providerId: string;
  service: string;
  description: string;
  urgency: UrgencyLevel;
  size: JobSize;
  photoUrls: string[];
  scheduledDate: string;
  scheduledTime: string;
  addressId: string;
}

export interface ConditionUpdate {
  id: string;
  description: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  providerId: string;
  providerName: string;
  category: string;
  service: string;
  description: string;
  scheduledDate: string;
  scheduledTime: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "rescheduled";
  estimatedPrice: { min: number; max: number };
  createdAt: string;
  conditionUpdates: ConditionUpdate[];
}
