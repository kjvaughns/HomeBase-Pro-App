import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, queryClient } from "@/lib/query-client";
import { useAuthStore } from "./authStore";

// ============================================
// TYPES
// ============================================

/**
 * Thrown by `syncAvailableForWork` when the server rejects an
 * `isActive: true` PATCH because Stripe Connect isn't ready
 * (HTTP 422 with `{ error: "stripe_not_ready" }`).
 *
 * Callers should catch this specifically and route the user to the
 * Stripe Connect setup flow rather than showing the raw message in
 * an Alert.
 */
export class StripeNotReadyError extends Error {
  readonly code = "stripe_not_ready" as const;
  constructor(message: string) {
    super(message);
    this.name = "StripeNotReadyError";
  }
}

export interface Lead {
  id: string;
  providerId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  service?: string | null;
  message?: string | null;
  status: "new" | "contacted" | "quoted" | "won" | "lost";
  source?: string | null;
  createdAt: string | null;
  updatedAt?: string | null;
}

export interface JobChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface JobIntakeData {
  problemDescription?: string;
  followUpAnswers?: { question: string; answer: string }[];
  photos?: string[];
  estimatedDuration?: string;
  priceBreakdown?: { label: string; amount: number }[];
}

export interface Job {
  id: string;
  clientId?: string;
  leadId?: string;
  customerName: string;
  customerEmail?: string;
  customerAvatar?: string;
  customerPhone?: string;
  service: string;
  description?: string;
  address: string;
  date: string;
  time: string;
  endTime?: string;
  status: "scheduled" | "confirmed" | "on_my_way" | "arrived" | "in_progress" | "completed" | "cancelled";
  price: number;
  laborCost?: number;
  materialsCost?: number;
  notes?: string;
  internalNotes?: string;
  completedAt?: string;
  startedAt?: string;
  checklist?: JobChecklistItem[];
  intakeData?: JobIntakeData;
  invoiceId?: string;
  paymentStatus?: "unpaid" | "partial" | "paid";
  amountPaid?: number;
  isRecurring?: boolean;
  recurringFrequency?: string | null;
}

export interface Quote {
  id: string;
  leadId: string;
  laborCost: number;
  materialsCost: number;
  total: number;
  notes?: string;
  validUntil: string;
  createdAt: string;
  status: "pending" | "accepted" | "declined" | "expired";
}

export interface ProviderMessage {
  id: string;
  conversationId: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  jobId?: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderType: "provider" | "customer";
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Invoice {
  id: string;
  jobId: string;
  customerName: string;
  service: string;
  amount: number;
  date: string;
  dueDate: string;
  status: "draft" | "sent" | "paid" | "overdue";
  paidAt?: string;
}

export interface Payout {
  id: string;
  amount: number;
  invoiceIds: string[];
  status: "pending" | "processing" | "completed" | "failed";
  requestedAt: string;
  completedAt?: string;
  bankLast4?: string;
}

export interface ClientHome {
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  propertyType: "single_family" | "condo" | "townhouse" | "multi_family";
  roofAge?: number;
  hvacType?: string;
  hvacAge?: number;
  waterHeaterAge?: number;
  healthScore?: number;
  healthScoreDate?: string;
  survivalKitEstimate?: { min: number; max: number };
  notableRisks?: string[];
  lastUpdatedByHomeowner?: string;
  accessNotes?: string;
  pets?: string;
  parking?: string;
  gateCode?: string;
  preferredWindows?: string[];
  photos?: string[];
}

export interface ClientJob {
  id: string;
  clientId: string;
  service: string;
  description?: string;
  date: string;
  status: "pending" | "confirmed" | "on_my_way" | "arrived" | "in_progress" | "completed" | "invoice_sent" | "paid";
  price: number;
  paidAmount?: number;
}

export interface ClientInvoice {
  id: string;
  clientId: string;
  jobId: string;
  amount: number;
  date: string;
  dueDate: string;
  status: "draft" | "sent" | "paid" | "overdue";
  paidAt?: string;
}

export interface ClientNote {
  id: string;
  clientId: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  createdBy: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  status: "active" | "lead" | "inactive" | "archived";
  lastSeen: string;
  clientSince?: string;
  ltv: number;
  jobCount: number;
  address?: string;
  notes?: string;
  outstandingBalance?: number;
  avgTicket?: number;
  nextAppointment?: string;
  home?: ClientHome;
}

export interface ClientActivity {
  id: string;
  clientId: string;
  type: "job_completed" | "job_scheduled" | "invoice_sent" | "invoice_paid" | "message_sent" | "quote_sent";
  description: string;
  timestamp: string;
  jobId?: string;
  invoiceId?: string;
}

export interface ProviderStats {
  totalEarnings: number;
  pendingEarnings: number;
  availableBalance: number;
  completedJobs: number;
  rating: number;
  reviewCount: number;
  responseRate: number;
  upcomingJobs: number;
  newLeads: number;
  unreadMessages: number;
}

// ============================================

// ============================================
// STORE INTERFACE
// ============================================

export interface BookingPolicies {
  requireDeposit: boolean;
  depositPercent: number;
  cancellationHours: number;
  cancellationFeePercent: number;
  rescheduleHours: number;
  maxReschedules: number;
}

export interface OnboardingService {
  id: string;
  name: string;
  price: number | null;
  quoteRequired: boolean;
  durationMinutes: number;
}

export interface ProviderAvailability {
  activeDays: string[];
  startTime: string;
  endTime: string;
}

export interface ProviderBusinessProfile {
  businessName: string;
  category: string;
  serviceArea: string;
}

interface ProviderState {
  // Data
  jobs: Job[];
  quotes: Quote[];
  messages: ProviderMessage[];
  invoices: Invoice[];
  payouts: Payout[];
  clients: Client[];
  clientActivities: ClientActivity[];
  clientNotes: ClientNote[];
  
  // Onboarding-set provider data
  onboardingServices: OnboardingService[];
  providerAvailability: ProviderAvailability | null;
  providerBusinessProfile: ProviderBusinessProfile | null;
  
  // Settings
  availableForWork: boolean;
  notificationsEnabled: boolean;
  bookingPolicies: BookingPolicies | null;
  
  // Computed stats (cached)
  _statsCache: ProviderStats | null;
  
  // Job actions
  startJob: (jobId: string) => void;
  completeJob: (jobId: string) => void;
  cancelJob: (jobId: string) => void;
  
  // Invoice actions
  createInvoice: (jobId: string) => void;
  markInvoicePaid: (invoiceId: string) => void;
  
  // Payout actions
  requestPayout: (invoiceIds: string[]) => void;
  
  // Message actions
  sendMessage: (conversationId: string, content: string) => void;
  markConversationRead: (conversationId: string) => void;
  
  // Settings actions
  setAvailableForWork: (value: boolean) => void;
  syncAvailableForWork: (value: boolean, providerId: string) => Promise<void>;
  hydrateAvailableForWork: (value: boolean) => void;
  setNotificationsEnabled: (value: boolean) => void;
  setBookingPolicies: (policies: BookingPolicies) => void;
  
  // Onboarding setup actions
  addOnboardingService: (service: OnboardingService) => void;
  setProviderAvailability: (availability: ProviderAvailability) => void;
  setProviderBusinessProfile: (profile: ProviderBusinessProfile) => void;
  
  // Client actions
  addClientNote: (clientId: string, content: string, isInternal: boolean) => void;
  
  // Computed getters
  getStats: () => ProviderStats;
  getJobsByStatus: (status: Job["status"]) => Job[];
  getUnreadMessageCount: () => number;
  getNextJob: () => Job | undefined;
  getRecentEarnings: () => number;
  getClientActivities: (clientId: string) => ClientActivity[];
  getClientNotes: (clientId: string) => ClientNote[];
  getClientJobHistory: (clientId: string) => Job[];
  getClientInvoices: (clientId: string) => Invoice[];
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      // Initial data - empty arrays for new providers (no mock data)
      jobs: [],
      quotes: [],
      messages: [],
      invoices: [],
      payouts: [],
      clients: [],
      clientActivities: [],
      clientNotes: [],
      
      onboardingServices: [],
      providerAvailability: null,
      providerBusinessProfile: null,
      
      availableForWork: true,
      notificationsEnabled: true,
      bookingPolicies: null,
      
      _statsCache: null,
      
      // Job actions
      startJob: (jobId) => {
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId ? { ...j, status: "in_progress" as const } : j
          ),
          _statsCache: null,
        }));
      },
      
      completeJob: (jobId) => {
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId
              ? { ...j, status: "completed" as const, completedAt: new Date().toISOString().split("T")[0] }
              : j
          ),
          _statsCache: null,
        }));
      },
      
      cancelJob: (jobId) => {
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId ? { ...j, status: "cancelled" as const } : j
          ),
          _statsCache: null,
        }));
      },
      
      // Invoice actions
      createInvoice: (jobId) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;
        
        const invoice: Invoice = {
          id: `inv${Date.now()}`,
          jobId,
          customerName: job.customerName,
          service: job.service,
          amount: job.price,
          date: new Date().toISOString().split("T")[0],
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "sent",
        };
        
        set((state) => ({
          invoices: [...state.invoices, invoice],
          _statsCache: null,
        }));
      },
      
      markInvoicePaid: (invoiceId) => {
        set((state) => ({
          invoices: state.invoices.map((inv) =>
            inv.id === invoiceId
              ? { ...inv, status: "paid" as const, paidAt: new Date().toISOString().split("T")[0] }
              : inv
          ),
          _statsCache: null,
        }));
      },
      
      // Payout actions
      requestPayout: (invoiceIds) => {
        const invoices = get().invoices.filter((inv) => invoiceIds.includes(inv.id));
        const total = invoices.reduce((sum, inv) => sum + inv.amount, 0);
        
        const payout: Payout = {
          id: `p${Date.now()}`,
          amount: total,
          invoiceIds,
          status: "pending",
          requestedAt: new Date().toISOString(),
          bankLast4: "4521",
        };
        
        set((state) => ({
          payouts: [...state.payouts, payout],
          _statsCache: null,
        }));
      },
      
      // Message actions
      sendMessage: (conversationId, content) => {
        const message: ChatMessage = {
          id: `msg${Date.now()}`,
          senderId: "provider",
          senderType: "provider",
          content,
          timestamp: "Just now",
          read: true,
        };
        
        set((state) => ({
          messages: state.messages.map((m) =>
            m.conversationId === conversationId
              ? {
                  ...m,
                  messages: [...m.messages, message],
                  lastMessage: content,
                  timestamp: "Just now",
                }
              : m
          ),
        }));
      },
      
      markConversationRead: (conversationId) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.conversationId === conversationId
              ? {
                  ...m,
                  unreadCount: 0,
                  messages: m.messages.map((msg) => ({ ...msg, read: true })),
                }
              : m
          ),
          _statsCache: null,
        }));
      },
      
      // Settings actions
      setAvailableForWork: (value) => set({ availableForWork: value }),
      hydrateAvailableForWork: (value) => set({ availableForWork: value }),
      syncAvailableForWork: async (value, providerId) => {
        const previous = get().availableForWork;
        set({ availableForWork: value });
        try {
          await apiRequest("PATCH", `/api/provider/${providerId}`, {
            isActive: value,
          });
          // Keep authStore.providerProfile in sync so persisted hydration
          // doesn't overwrite the freshly-toggled value on remount.
          useAuthStore.getState().updateProviderProfile({ isActive: value });
          // Invalidate caches so provider profile + discovery lists reflect
          // the new availability immediately on this device.
          queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId] });
          queryClient.invalidateQueries({ queryKey: ["/api/provider/user"] });
          queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
          queryClient.invalidateQueries({ queryKey: ["/api/marketplace/providers"] });
          queryClient.invalidateQueries({ queryKey: ["/api/search/providers"] });
        } catch (error) {
          set({ availableForWork: previous });
          // Detect the server-side stripe_not_ready guard (Task #183) so
          // callers can surface the inline "Finish Stripe setup" hint instead
          // of an Alert with the raw server message. apiRequest throws a
          // generic Error of the form `${status}: ${body}` — parse that.
          if (error instanceof Error) {
            const match = error.message.match(/^(\d{3}):\s*(.*)$/s);
            if (match && match[1] === "422") {
              try {
                const body = JSON.parse(match[2]);
                if (body?.error === "stripe_not_ready") {
                  throw new StripeNotReadyError(
                    typeof body.message === "string" && body.message.length > 0
                      ? body.message
                      : "Finish Stripe setup to start accepting bookings.",
                  );
                }
              } catch (parseErr) {
                if (parseErr instanceof StripeNotReadyError) throw parseErr;
                // Fall through: not JSON or not the expected shape.
              }
            }
          }
          throw error;
        }
      },
      setNotificationsEnabled: (value) => set({ notificationsEnabled: value }),
      setBookingPolicies: (policies) => set({ bookingPolicies: policies }),
      
      addOnboardingService: (service) => {
        set((state) => ({
          onboardingServices: [...state.onboardingServices, service],
        }));
      },
      
      setProviderAvailability: (availability) => set({ providerAvailability: availability }),
      
      setProviderBusinessProfile: (profile) => set({ providerBusinessProfile: profile }),
      
      // Computed getters
      getStats: () => {
        const state = get();
        
        const paidInvoices = state.invoices.filter((i) => i.status === "paid");
        const pendingInvoices = state.invoices.filter((i) => i.status === "sent");
        const totalEarnings = paidInvoices.reduce((sum, i) => sum + i.amount, 0);
        const pendingEarnings = pendingInvoices.reduce((sum, i) => sum + i.amount, 0);
        
        const completedPayouts = state.payouts.filter((p) => p.status === "completed");
        const paidOut = completedPayouts.reduce((sum, p) => sum + p.amount, 0);
        const availableBalance = totalEarnings - paidOut;
        
        return {
          totalEarnings,
          pendingEarnings,
          availableBalance,
          completedJobs: state.jobs.filter((j) => j.status === "completed").length,
          rating: 4.9,
          reviewCount: 45,
          responseRate: 98,
          upcomingJobs: state.jobs.filter((j) => j.status === "scheduled").length,
          newLeads: 0,
          unreadMessages: state.messages.reduce((sum, m) => sum + m.unreadCount, 0),
        };
      },
      
      getJobsByStatus: (status) => get().jobs.filter((j) => j.status === status),
      getUnreadMessageCount: () => get().messages.reduce((sum, m) => sum + m.unreadCount, 0),
      
      getNextJob: () => {
        const scheduledJobs = get().jobs
          .filter((j) => j.status === "scheduled")
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return scheduledJobs[0];
      },
      
      getRecentEarnings: () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        return get()
          .invoices.filter(
            (i) => i.status === "paid" && new Date(i.paidAt || i.date) >= thirtyDaysAgo
          )
          .reduce((sum, i) => sum + i.amount, 0);
      },
      
      getClientActivities: (clientId) => {
        return get().clientActivities.filter((a) => a.clientId === clientId);
      },
      
      getClientNotes: (clientId) => {
        return get().clientNotes.filter((n) => n.clientId === clientId);
      },
      
      getClientJobHistory: (clientId) => {
        const client = get().clients.find((c) => c.id === clientId);
        if (!client) return [];
        return get().jobs.filter((j) => 
          j.customerName === client.name || 
          j.address === client.address
        );
      },
      
      getClientInvoices: (clientId) => {
        const client = get().clients.find((c) => c.id === clientId);
        if (!client) return [];
        return get().invoices.filter((i) => i.customerName === client.name);
      },
      
      // Client actions
      addClientNote: (clientId, content, isInternal) => {
        const note: ClientNote = {
          id: `cn${Date.now()}`,
          clientId,
          content,
          isInternal,
          createdAt: new Date().toISOString().split("T")[0],
          createdBy: "Demo Pro",
        };
        set((state) => ({
          clientNotes: [...state.clientNotes, note],
        }));
      },
      
    }),
    {
      name: "provider-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        jobs: state.jobs,
        quotes: state.quotes,
        messages: state.messages,
        invoices: state.invoices,
        payouts: state.payouts,
        clients: state.clients,
        clientActivities: state.clientActivities,
        clientNotes: state.clientNotes,
        onboardingServices: state.onboardingServices,
        providerAvailability: state.providerAvailability,
        providerBusinessProfile: state.providerBusinessProfile,
        availableForWork: state.availableForWork,
        notificationsEnabled: state.notificationsEnabled,
      }),
    }
  )
);
