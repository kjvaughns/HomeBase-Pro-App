import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Job,
  JobStatus,
  MessageThread,
  ChatMessage,
  Invoice,
  Receipt,
  Review,
  Quote,
  HomeownerProfile,
  Address,
  PaymentMethod,
  Provider,
  ServiceCategory,
  BookingRequest,
  TimeSlot,
} from "./types";
import {
  SERVICE_CATEGORIES,
  PROVIDERS,
  SEED_JOBS,
  SEED_INVOICES,
  SEED_RECEIPTS,
  SEED_REVIEWS,
  SEED_MESSAGE_THREADS,
  SEED_QUOTES,
  DEFAULT_HOMEOWNER,
  generateTimeSlots,
} from "./seedData";

const STORAGE_KEY = "homeowner-store";

interface HomeownerState {
  isHydrated: boolean;
  profile: HomeownerProfile | null;
  categories: ServiceCategory[];
  providers: Provider[];
  jobs: Job[];
  messageThreads: MessageThread[];
  invoices: Invoice[];
  receipts: Receipt[];
  reviews: Review[];
  quotes: Quote[];

  hydrate: () => Promise<void>;
  resetToSeedData: () => Promise<void>;

  setProfile: (profile: HomeownerProfile) => void;
  updateProfile: (updates: Partial<HomeownerProfile>) => void;

  addAddress: (address: Address) => void;
  updateAddress: (id: string, updates: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;

  addPaymentMethod: (method: PaymentMethod) => void;
  updatePaymentMethod: (id: string, updates: Partial<PaymentMethod>) => void;
  deletePaymentMethod: (id: string) => void;
  setDefaultPaymentMethod: (id: string) => void;

  getProvidersByCategory: (categoryId: string) => Provider[];
  getProviderById: (id: string) => Provider | undefined;
  getProviderAvailability: (providerId: string) => TimeSlot[];
  getProviderReviews: (providerId: string) => Review[];

  createBooking: (request: BookingRequest) => Job;
  getJobById: (id: string) => Job | undefined;
  getUpcomingJobs: () => Job[];
  getActiveJobs: () => Job[];
  getPastJobs: () => Job[];
  updateJobStatus: (jobId: string, status: JobStatus) => void;
  advanceJobStatus: (jobId: string) => void;

  getThreadByJobId: (jobId: string) => MessageThread | undefined;
  sendMessage: (threadId: string, content: string, attachments?: ChatMessage["attachments"]) => void;
  markThreadAsRead: (threadId: string) => void;

  getInvoiceById: (id: string) => Invoice | undefined;
  getInvoiceByJobId: (jobId: string) => Invoice | undefined;

  payInvoice: (invoiceId: string, paymentMethodId: string) => Receipt;
  getReceiptById: (id: string) => Receipt | undefined;
  getReceiptByJobId: (jobId: string) => Receipt | undefined;

  submitReview: (jobId: string, rating: number, comment: string) => Review;
  getReviewByJobId: (jobId: string) => Review | undefined;

  getQuotes: () => Quote[];
  acceptQuote: (quoteId: string) => Job;
  declineQuote: (quoteId: string) => void;
}

const JOB_STATUS_ORDER: JobStatus[] = [
  "requested",
  "scheduled",
  "in_progress",
  "awaiting_payment",
  "completed",
  "paid",
  "closed",
];

export const useHomeownerStore = create<HomeownerState>()((set, get) => ({
  isHydrated: false,
  profile: null,
  categories: SERVICE_CATEGORIES,
  providers: PROVIDERS,
  jobs: [],
  messageThreads: [],
  invoices: [],
  receipts: [],
  reviews: [],
  quotes: [],

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({
          profile: data.profile || DEFAULT_HOMEOWNER,
          jobs: data.jobs || SEED_JOBS,
          messageThreads: data.messageThreads || SEED_MESSAGE_THREADS,
          invoices: data.invoices || SEED_INVOICES,
          receipts: data.receipts || SEED_RECEIPTS,
          reviews: data.reviews || SEED_REVIEWS,
          quotes: data.quotes || SEED_QUOTES,
          isHydrated: true,
        });
      } else {
        set({
          profile: DEFAULT_HOMEOWNER,
          jobs: SEED_JOBS,
          messageThreads: SEED_MESSAGE_THREADS,
          invoices: SEED_INVOICES,
          receipts: SEED_RECEIPTS,
          reviews: SEED_REVIEWS,
          quotes: SEED_QUOTES,
          isHydrated: true,
        });
        saveToStorage(get());
      }
    } catch (error) {
      console.error("Failed to hydrate homeowner store:", error);
      set({
        profile: DEFAULT_HOMEOWNER,
        jobs: SEED_JOBS,
        messageThreads: SEED_MESSAGE_THREADS,
        invoices: SEED_INVOICES,
        receipts: SEED_RECEIPTS,
        reviews: SEED_REVIEWS,
        quotes: SEED_QUOTES,
        isHydrated: true,
      });
    }
  },

  resetToSeedData: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({
      profile: DEFAULT_HOMEOWNER,
      jobs: SEED_JOBS,
      messageThreads: SEED_MESSAGE_THREADS,
      invoices: SEED_INVOICES,
      receipts: SEED_RECEIPTS,
      reviews: SEED_REVIEWS,
      quotes: SEED_QUOTES,
    });
  },

  setProfile: (profile) => {
    set({ profile });
    saveToStorage(get());
  },

  updateProfile: (updates) => {
    const { profile } = get();
    if (profile) {
      set({ profile: { ...profile, ...updates } });
      saveToStorage(get());
    }
  },

  addAddress: (address) => {
    const { profile } = get();
    if (profile) {
      const addresses = address.isDefault
        ? profile.addresses.map((a) => ({ ...a, isDefault: false }))
        : profile.addresses;
      set({ profile: { ...profile, addresses: [...addresses, address] } });
      saveToStorage(get());
    }
  },

  updateAddress: (id, updates) => {
    const { profile } = get();
    if (profile) {
      const addresses = profile.addresses.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      );
      set({ profile: { ...profile, addresses } });
      saveToStorage(get());
    }
  },

  deleteAddress: (id) => {
    const { profile } = get();
    if (profile) {
      const addresses = profile.addresses.filter((a) => a.id !== id);
      set({ profile: { ...profile, addresses } });
      saveToStorage(get());
    }
  },

  setDefaultAddress: (id) => {
    const { profile } = get();
    if (profile) {
      const addresses = profile.addresses.map((a) => ({
        ...a,
        isDefault: a.id === id,
      }));
      set({ profile: { ...profile, addresses } });
      saveToStorage(get());
    }
  },

  addPaymentMethod: (method) => {
    const { profile } = get();
    if (profile) {
      const methods = method.isDefault
        ? profile.paymentMethods.map((m) => ({ ...m, isDefault: false }))
        : profile.paymentMethods;
      set({ profile: { ...profile, paymentMethods: [...methods, method] } });
      saveToStorage(get());
    }
  },

  updatePaymentMethod: (id, updates) => {
    const { profile } = get();
    if (profile) {
      const methods = profile.paymentMethods.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      );
      set({ profile: { ...profile, paymentMethods: methods } });
      saveToStorage(get());
    }
  },

  deletePaymentMethod: (id) => {
    const { profile } = get();
    if (profile) {
      const methods = profile.paymentMethods.filter((m) => m.id !== id);
      set({ profile: { ...profile, paymentMethods: methods } });
      saveToStorage(get());
    }
  },

  setDefaultPaymentMethod: (id) => {
    const { profile } = get();
    if (profile) {
      const methods = profile.paymentMethods.map((m) => ({
        ...m,
        isDefault: m.id === id,
      }));
      set({ profile: { ...profile, paymentMethods: methods } });
      saveToStorage(get());
    }
  },

  getProvidersByCategory: (categoryId) => {
    return get().providers.filter((p) => p.categoryIds.includes(categoryId));
  },

  getProviderById: (id) => {
    return get().providers.find((p) => p.id === id);
  },

  getProviderAvailability: (providerId) => {
    return generateTimeSlots(providerId, new Date(), 14);
  },

  getProviderReviews: (providerId) => {
    return get().reviews.filter((r) => r.providerId === providerId);
  },

  createBooking: (request) => {
    const { profile, providers } = get();
    const provider = providers.find((p) => p.id === request.providerId);
    const address = profile?.addresses.find((a) => a.id === request.addressId);

    const jobId = `job-${Date.now()}`;
    const now = new Date().toISOString();

    const newJob: Job = {
      id: jobId,
      homeownerId: profile?.id || "homeowner-1",
      providerId: request.providerId,
      providerName: provider?.name || "",
      providerBusinessName: provider?.businessName || "",
      providerAvatar: provider?.avatarUrl,
      categoryId: request.categoryId,
      service: request.service,
      status: "scheduled",
      description: request.description,
      urgency: request.urgency,
      size: request.size,
      addressId: request.addressId,
      address: address
        ? `${address.street}, ${address.city}, ${address.state} ${address.zip}`
        : "",
      scheduledDate: request.scheduledDate,
      scheduledTime: request.scheduledTime,
      estimatedPrice: provider ? provider.hourlyRate * 2 : 150,
      photosBefore: request.photoUrls,
      photosAfter: [],
      timeline: [
        {
          id: `tl-${jobId}-1`,
          type: "status_change",
          title: "Job Requested",
          description: "You submitted a service request",
          timestamp: now,
        },
        {
          id: `tl-${jobId}-2`,
          type: "status_change",
          title: "Job Scheduled",
          description: `Scheduled for ${request.scheduledDate} at ${request.scheduledTime}`,
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const newThread: MessageThread = {
      id: `thread-${jobId}`,
      jobId,
      homeownerId: profile?.id || "homeowner-1",
      providerId: request.providerId,
      providerName: provider?.name || "",
      providerAvatar: provider?.avatarUrl,
      service: request.service,
      lastMessage: "Your booking has been confirmed!",
      lastMessageTime: "Just now",
      unreadCount: 1,
      messages: [
        {
          id: `msg-${jobId}-1`,
          threadId: `thread-${jobId}`,
          senderId: request.providerId,
          senderName: provider?.name || "",
          senderType: "provider",
          content: `Thank you for booking with ${provider?.businessName}! I've confirmed your appointment for ${request.scheduledDate} at ${request.scheduledTime}. Looking forward to helping you!`,
          attachments: [],
          timestamp: now,
          read: false,
        },
      ],
    };

    set((state) => ({
      jobs: [newJob, ...state.jobs],
      messageThreads: [newThread, ...state.messageThreads],
    }));
    saveToStorage(get());

    return newJob;
  },

  getJobById: (id) => {
    return get().jobs.find((j) => j.id === id);
  },

  getUpcomingJobs: () => {
    return get().jobs.filter((j) => j.status === "scheduled");
  },

  getActiveJobs: () => {
    return get().jobs.filter((j) =>
      ["in_progress", "awaiting_payment", "requested"].includes(j.status)
    );
  },

  getPastJobs: () => {
    return get().jobs.filter((j) =>
      ["completed", "paid", "closed"].includes(j.status)
    );
  },

  updateJobStatus: (jobId, status) => {
    const now = new Date().toISOString();
    set((state) => ({
      jobs: state.jobs.map((j) => {
        if (j.id === jobId) {
          const statusTitles: Record<JobStatus, string> = {
            requested: "Job Requested",
            scheduled: "Job Scheduled",
            in_progress: "Work Started",
            awaiting_payment: "Awaiting Payment",
            completed: "Work Completed",
            paid: "Payment Received",
            closed: "Job Closed",
          };
          return {
            ...j,
            status,
            updatedAt: now,
            timeline: [
              ...j.timeline,
              {
                id: `tl-${jobId}-${j.timeline.length + 1}`,
                type: "status_change" as const,
                title: statusTitles[status],
                timestamp: now,
              },
            ],
          };
        }
        return j;
      }),
    }));
    saveToStorage(get());
  },

  advanceJobStatus: (jobId) => {
    const job = get().getJobById(jobId);
    if (!job) return;

    const currentIndex = JOB_STATUS_ORDER.indexOf(job.status);
    if (currentIndex < JOB_STATUS_ORDER.length - 1) {
      const nextStatus = JOB_STATUS_ORDER[currentIndex + 1];

      if (nextStatus === "awaiting_payment" && !job.invoiceId) {
        const invoice: Invoice = {
          id: `inv-${Date.now()}`,
          jobId,
          providerId: job.providerId,
          homeownerId: job.homeownerId,
          items: [
            {
              description: job.service,
              quantity: 1,
              unitPrice: job.estimatedPrice * 0.6,
              total: job.estimatedPrice * 0.6,
            },
          ],
          laborHours: 2,
          laborRate: 50,
          laborTotal: 100,
          materialsTotal: job.estimatedPrice * 0.6,
          subtotal: job.estimatedPrice,
          tax: 0,
          total: job.estimatedPrice,
          status: "sent",
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          invoices: [...state.invoices, invoice],
          jobs: state.jobs.map((j) =>
            j.id === jobId
              ? { ...j, invoiceId: invoice.id, finalPrice: job.estimatedPrice }
              : j
          ),
        }));
      }

      get().updateJobStatus(jobId, nextStatus);
    }
  },

  getThreadByJobId: (jobId) => {
    return get().messageThreads.find((t) => t.jobId === jobId);
  },

  sendMessage: (threadId, content, attachments = []) => {
    const { profile } = get();
    const now = new Date().toISOString();
    const messageId = `msg-${Date.now()}`;

    set((state) => ({
      messageThreads: state.messageThreads.map((t) => {
        if (t.id === threadId) {
          return {
            ...t,
            lastMessage: content,
            lastMessageTime: "Just now",
            messages: [
              ...t.messages,
              {
                id: messageId,
                threadId,
                senderId: profile?.id || "homeowner-1",
                senderName: profile?.name || "You",
                senderType: "homeowner",
                content,
                attachments,
                timestamp: now,
                read: true,
              },
            ],
          };
        }
        return t;
      }),
    }));
    saveToStorage(get());
  },

  markThreadAsRead: (threadId) => {
    set((state) => ({
      messageThreads: state.messageThreads.map((t) => {
        if (t.id === threadId) {
          return {
            ...t,
            unreadCount: 0,
            messages: t.messages.map((m) => ({ ...m, read: true })),
          };
        }
        return t;
      }),
    }));
    saveToStorage(get());
  },

  getInvoiceById: (id) => {
    return get().invoices.find((i) => i.id === id);
  },

  getInvoiceByJobId: (jobId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    return job?.invoiceId ? get().invoices.find((i) => i.id === job.invoiceId) : undefined;
  },

  payInvoice: (invoiceId, paymentMethodId) => {
    const { profile, invoices, jobs } = get();
    const invoice = invoices.find((i) => i.id === invoiceId);
    const paymentMethod = profile?.paymentMethods.find((m) => m.id === paymentMethodId);
    const now = new Date().toISOString();

    if (!invoice) throw new Error("Invoice not found");

    const receipt: Receipt = {
      id: `rcpt-${Date.now()}`,
      invoiceId,
      jobId: invoice.jobId,
      amount: invoice.total,
      paymentMethod: paymentMethod
        ? `${paymentMethod.label} ending in ${paymentMethod.last4}`
        : "Card",
      transactionId: `txn_${Date.now()}`,
      createdAt: now,
    };

    set((state) => ({
      invoices: state.invoices.map((i) =>
        i.id === invoiceId ? { ...i, status: "paid", paidAt: now } : i
      ),
      receipts: [...state.receipts, receipt],
      jobs: state.jobs.map((j) => {
        if (j.id === invoice.jobId) {
          return {
            ...j,
            status: "paid" as JobStatus,
            receiptId: receipt.id,
            updatedAt: now,
            timeline: [
              ...j.timeline,
              {
                id: `tl-${j.id}-pay`,
                type: "payment" as const,
                title: "Payment Received",
                description: `Paid $${invoice.total}`,
                timestamp: now,
              },
            ],
          };
        }
        return j;
      }),
    }));
    saveToStorage(get());

    return receipt;
  },

  getReceiptById: (id) => {
    return get().receipts.find((r) => r.id === id);
  },

  getReceiptByJobId: (jobId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    return job?.receiptId ? get().receipts.find((r) => r.id === job.receiptId) : undefined;
  },

  submitReview: (jobId, rating, comment) => {
    const { profile, jobs } = get();
    const job = jobs.find((j) => j.id === jobId);
    const now = new Date().toISOString();

    if (!job) throw new Error("Job not found");

    const review: Review = {
      id: `rev-${Date.now()}`,
      jobId,
      providerId: job.providerId,
      homeownerId: profile?.id || "homeowner-1",
      homeownerName: profile?.name || "Homeowner",
      rating,
      comment,
      createdAt: now,
    };

    set((state) => ({
      reviews: [...state.reviews, review],
      jobs: state.jobs.map((j) =>
        j.id === jobId
          ? { ...j, reviewId: review.id, status: "closed" as JobStatus, updatedAt: now }
          : j
      ),
    }));
    saveToStorage(get());

    return review;
  },

  getReviewByJobId: (jobId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    return job?.reviewId ? get().reviews.find((r) => r.id === job.reviewId) : undefined;
  },

  getQuotes: () => {
    return get().quotes.filter((q) => q.status === "pending");
  },

  acceptQuote: (quoteId) => {
    const { quotes, profile, providers } = get();
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) throw new Error("Quote not found");

    const provider = providers.find((p) => p.id === quote.providerId);
    const defaultAddress = profile?.addresses.find((a) => a.isDefault);
    const now = new Date().toISOString();
    const jobId = `job-${Date.now()}`;

    const newJob: Job = {
      id: jobId,
      homeownerId: profile?.id || "homeowner-1",
      providerId: quote.providerId,
      providerName: quote.providerName,
      providerBusinessName: provider?.businessName || "",
      providerAvatar: provider?.avatarUrl,
      categoryId: provider?.categoryIds[0] || "",
      service: quote.service,
      status: "requested",
      description: quote.description,
      urgency: "flexible",
      size: "medium",
      addressId: defaultAddress?.id || "",
      address: defaultAddress
        ? `${defaultAddress.street}, ${defaultAddress.city}, ${defaultAddress.state} ${defaultAddress.zip}`
        : "",
      scheduledDate: "",
      scheduledTime: "",
      estimatedPrice: quote.totalEstimate,
      photosBefore: [],
      photosAfter: [],
      timeline: [
        {
          id: `tl-${jobId}-1`,
          type: "status_change",
          title: "Quote Accepted",
          description: "You accepted the quote",
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      quotes: state.quotes.map((q) =>
        q.id === quoteId ? { ...q, status: "accepted", jobId } : q
      ),
      jobs: [newJob, ...state.jobs],
    }));
    saveToStorage(get());

    return newJob;
  },

  declineQuote: (quoteId) => {
    set((state) => ({
      quotes: state.quotes.map((q) =>
        q.id === quoteId ? { ...q, status: "declined" } : q
      ),
    }));
    saveToStorage(get());
  },
}));

async function saveToStorage(state: HomeownerState) {
  try {
    const data = {
      profile: state.profile,
      jobs: state.jobs,
      messageThreads: state.messageThreads,
      invoices: state.invoices,
      receipts: state.receipts,
      reviews: state.reviews,
      quotes: state.quotes,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save homeowner state:", error);
  }
}

useHomeownerStore.getState().hydrate();
