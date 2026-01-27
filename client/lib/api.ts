import { useHomeownerStore } from "@/state/homeownerStore";
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
} from "@/state/types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  categories: {
    async getAll(): Promise<ServiceCategory[]> {
      await delay(100);
      return useHomeownerStore.getState().categories;
    },

    async getById(id: string): Promise<ServiceCategory | undefined> {
      await delay(50);
      return useHomeownerStore.getState().categories.find((c) => c.id === id);
    },
  },

  providers: {
    async getAll(): Promise<Provider[]> {
      await delay(150);
      return useHomeownerStore.getState().providers;
    },

    async getByCategory(categoryId: string): Promise<Provider[]> {
      await delay(100);
      return useHomeownerStore.getState().getProvidersByCategory(categoryId);
    },

    async getById(id: string): Promise<Provider | undefined> {
      await delay(50);
      return useHomeownerStore.getState().getProviderById(id);
    },

    async getAvailability(providerId: string): Promise<TimeSlot[]> {
      await delay(200);
      return useHomeownerStore.getState().getProviderAvailability(providerId);
    },

    async getReviews(providerId: string): Promise<Review[]> {
      await delay(100);
      return useHomeownerStore.getState().getProviderReviews(providerId);
    },
  },

  profile: {
    async get(): Promise<HomeownerProfile | null> {
      await delay(50);
      return useHomeownerStore.getState().profile;
    },

    async update(updates: Partial<HomeownerProfile>): Promise<void> {
      await delay(100);
      useHomeownerStore.getState().updateProfile(updates);
    },

    async addAddress(address: Address): Promise<void> {
      await delay(100);
      useHomeownerStore.getState().addAddress(address);
    },

    async updateAddress(id: string, updates: Partial<Address>): Promise<void> {
      await delay(100);
      useHomeownerStore.getState().updateAddress(id, updates);
    },

    async deleteAddress(id: string): Promise<void> {
      await delay(100);
      useHomeownerStore.getState().deleteAddress(id);
    },

    async setDefaultAddress(id: string): Promise<void> {
      await delay(50);
      useHomeownerStore.getState().setDefaultAddress(id);
    },

    async addPaymentMethod(method: PaymentMethod): Promise<void> {
      await delay(100);
      useHomeownerStore.getState().addPaymentMethod(method);
    },

    async updatePaymentMethod(id: string, updates: Partial<PaymentMethod>): Promise<void> {
      await delay(100);
      useHomeownerStore.getState().updatePaymentMethod(id, updates);
    },

    async deletePaymentMethod(id: string): Promise<void> {
      await delay(100);
      useHomeownerStore.getState().deletePaymentMethod(id);
    },

    async setDefaultPaymentMethod(id: string): Promise<void> {
      await delay(50);
      useHomeownerStore.getState().setDefaultPaymentMethod(id);
    },
  },

  jobs: {
    async getAll(): Promise<Job[]> {
      await delay(150);
      return useHomeownerStore.getState().jobs;
    },

    async getById(id: string): Promise<Job | undefined> {
      await delay(50);
      return useHomeownerStore.getState().getJobById(id);
    },

    async getUpcoming(): Promise<Job[]> {
      await delay(100);
      return useHomeownerStore.getState().getUpcomingJobs();
    },

    async getActive(): Promise<Job[]> {
      await delay(100);
      return useHomeownerStore.getState().getActiveJobs();
    },

    async getPast(): Promise<Job[]> {
      await delay(100);
      return useHomeownerStore.getState().getPastJobs();
    },

    async create(request: BookingRequest): Promise<Job> {
      await delay(300);
      return useHomeownerStore.getState().createBooking(request);
    },

    async updateStatus(jobId: string, status: JobStatus): Promise<void> {
      await delay(100);
      useHomeownerStore.getState().updateJobStatus(jobId, status);
    },

    async advanceStatus(jobId: string): Promise<void> {
      await delay(100);
      useHomeownerStore.getState().advanceJobStatus(jobId);
    },
  },

  messages: {
    async getThreads(): Promise<MessageThread[]> {
      await delay(150);
      return useHomeownerStore.getState().messageThreads;
    },

    async getThreadByJobId(jobId: string): Promise<MessageThread | undefined> {
      await delay(50);
      return useHomeownerStore.getState().getThreadByJobId(jobId);
    },

    async sendMessage(
      threadId: string,
      content: string,
      attachments?: ChatMessage["attachments"]
    ): Promise<void> {
      await delay(150);
      useHomeownerStore.getState().sendMessage(threadId, content, attachments);
    },

    async markAsRead(threadId: string): Promise<void> {
      await delay(50);
      useHomeownerStore.getState().markThreadAsRead(threadId);
    },
  },

  invoices: {
    async getById(id: string): Promise<Invoice | undefined> {
      await delay(50);
      return useHomeownerStore.getState().getInvoiceById(id);
    },

    async getByJobId(jobId: string): Promise<Invoice | undefined> {
      await delay(50);
      return useHomeownerStore.getState().getInvoiceByJobId(jobId);
    },

    async pay(invoiceId: string, paymentMethodId: string): Promise<Receipt> {
      await delay(500);
      return useHomeownerStore.getState().payInvoice(invoiceId, paymentMethodId);
    },
  },

  receipts: {
    async getById(id: string): Promise<Receipt | undefined> {
      await delay(50);
      return useHomeownerStore.getState().getReceiptById(id);
    },

    async getByJobId(jobId: string): Promise<Receipt | undefined> {
      await delay(50);
      return useHomeownerStore.getState().getReceiptByJobId(jobId);
    },
  },

  reviews: {
    async submit(jobId: string, rating: number, comment: string): Promise<Review> {
      await delay(200);
      return useHomeownerStore.getState().submitReview(jobId, rating, comment);
    },

    async getByJobId(jobId: string): Promise<Review | undefined> {
      await delay(50);
      return useHomeownerStore.getState().getReviewByJobId(jobId);
    },
  },

  quotes: {
    async getPending(): Promise<Quote[]> {
      await delay(100);
      return useHomeownerStore.getState().getQuotes();
    },

    async accept(quoteId: string): Promise<Job> {
      await delay(200);
      return useHomeownerStore.getState().acceptQuote(quoteId);
    },

    async decline(quoteId: string): Promise<void> {
      await delay(100);
      useHomeownerStore.getState().declineQuote(quoteId);
    },
  },
};

export type Api = typeof api;
