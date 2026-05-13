export interface AdminUserRow extends Record<string, unknown> {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isProvider: boolean;
  isAdmin: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  homeCount: number;
  bookingCount: number;
  creditBalanceCents: number;
}

export interface AdminProviderRow extends Record<string, unknown> {
  id: string;
  userId: string | null;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  isActive: boolean;
  isPublic: boolean;
  isVerified: boolean | null;
  averageRating: string | null;
  reviewCount: number | null;
  serviceArea: string | null;
  logoUrl: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
  stripeAccountId: string | null;
  stripeAccountStatus: string | null;
  subscriptionStatus: string | null;
  isSubscribed: boolean;
  isPartner: boolean;
  partnerSince: string | null;
  bookingCount: number;
  totalRevenueCents: number;
}

export interface AdminTicketRow extends Record<string, unknown> {
  id: string;
  userId: string | null;
  name: string | null;
  email: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  userType: string | null;
  category: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface AdminAuditLogRow extends Record<string, unknown> {
  id: string;
  adminUserId: string;
  adminName?: string | null;
  adminEmail?: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalProviders: number;
  activeProviders: number;
  inactiveProviders: number;
  partnerProviders: number;
  totalAppointments: number;
  totalJobs: number;
  totalRevenueCents: number;
  openTickets: number;
  totalTickets: number;
}

export interface RecentSignup {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isProvider: boolean;
  createdAt: string;
}

export interface RecentBooking {
  id: string;
  scheduledDate: string | null;
  status: string;
  providerName: string | null;
  homeownerName: string | null;
  homeownerEmail: string | null;
}

export interface AdminBroadcastRow extends Record<string, unknown> {
  id: string;
  title: string;
  body: string;
  audience: string;
  channel: string;
  recipientCount: number;
  status: string;
  sentAt: string | null;
  sentByName?: string | null;
  sentByUserId: string;
}
