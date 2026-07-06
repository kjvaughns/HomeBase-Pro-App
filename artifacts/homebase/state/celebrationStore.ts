import { create } from "zustand";

// Task #490: lightweight pub/sub for the "you got paid" celebration moment.
// Any screen/listener that detects an invoice/payment transitioning to "paid"
// can call triggerPaidCelebration — the overlay is mounted once at the app
// root (app/index.tsx) so the celebration shows regardless of which screen
// the provider is currently on. There are two independent triggers that can
// both fire for the same invoice — InvoiceDetailScreen's 5s status poll (only
// while that screen is open) and the global "invoice_paid" push-notification
// listener in usePushNotifications.ts (fires everywhere, including Home) — so
// this store dedupes by invoiceId within a short window to avoid a double
// celebration when both happen to observe the same payment.
interface PaidCelebrationPayload {
  amountCents: number;
  key: string;
}

interface CelebrationState {
  celebration: PaidCelebrationPayload | null;
  recentInvoiceIds: Map<string, number>;
  triggerPaidCelebration: (amountCents: number, invoiceId?: string) => void;
  clearCelebration: () => void;
}

const DEDUPE_WINDOW_MS = 15_000;

export const useCelebrationStore = create<CelebrationState>((set, get) => ({
  celebration: null,
  recentInvoiceIds: new Map(),
  triggerPaidCelebration: (amountCents: number, invoiceId?: string) => {
    if (invoiceId) {
      const { recentInvoiceIds } = get();
      const lastFired = recentInvoiceIds.get(invoiceId);
      const now = Date.now();
      if (lastFired && now - lastFired < DEDUPE_WINDOW_MS) {
        return;
      }
      // Prune stale entries opportunistically so this map never grows unbounded.
      for (const [id, ts] of recentInvoiceIds) {
        if (now - ts > DEDUPE_WINDOW_MS) recentInvoiceIds.delete(id);
      }
      recentInvoiceIds.set(invoiceId, now);
    }
    set({ celebration: { amountCents, key: `${Date.now()}-${Math.random()}` } });
  },
  clearCelebration: () => set({ celebration: null }),
}));
