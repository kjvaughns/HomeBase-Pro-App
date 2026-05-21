import { Platform, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

const STORAGE_KEY = "app-review-tracker.v2";
// Direct links to the live App Store / Play Store listings. Used as the
// fallback when the native in-app review sheet isn't available (e.g. web,
// or when the OS-level throttle is exhausted). Keep these in sync with
// `APP_STORE_URL` / `PLAY_STORE_URL` in `server/redirectPages.ts`.
const APP_STORE_URL =
  "https://apps.apple.com/app/homebase-pro/id6739456140?action=write-review";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.homebase.app";
const WEB_FALLBACK_URL = "https://homebaseproapp.com/rate";

function storeFallbackUrl(): string {
  if (Platform.OS === "ios") return APP_STORE_URL;
  if (Platform.OS === "android") return PLAY_STORE_URL;
  return WEB_FALLBACK_URL;
}

// Wait 48h after first install before ever prompting — prevents the "right
// after signup" prompt the user would otherwise see on their first return session.
const FIRST_SESSION_DELAY_MS = 48 * 60 * 60 * 1000;
// Once prompted, wait 30 days before prompting again (was 90 days).
const PROMPT_THROTTLE_MS = 30 * 24 * 60 * 60 * 1000;
// homeowner_feature_used counts at most once per 30-day window.
const FEATURE_USED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type HappyMomentKey =
  | "homeowner_onboarding_complete"
  | "homeowner_feature_used"
  | "homeowner_high_review_submitted"
  | "homeowner_booking_confirmed"
  | "homeowner_job_completed"
  | "provider_five_star_received"
  | "provider_invoice_paid"
  | "provider_job_completed";

interface TrackerData {
  firstSeenAt: number | null;
  lastPromptedAt: number | null;
  happyMomentCount: number;
  recordedKeys: string[];
  acknowledgedReviewIds: string[];
  paidInvoiceIds: string[];
  homeownerOnboardedAt: number | null;
  hasUsedFeatureSinceOnboarding: boolean;
  lastFeatureUsedAt: number | null;
  confirmedBookingIds: string[];
  completedHomeownerJobIds: string[];
  providerCompletedJobIds: string[];
}

const DEFAULT: TrackerData = {
  firstSeenAt: null,
  lastPromptedAt: null,
  happyMomentCount: 0,
  recordedKeys: [],
  acknowledgedReviewIds: [],
  paidInvoiceIds: [],
  homeownerOnboardedAt: null,
  hasUsedFeatureSinceOnboarding: false,
  lastFeatureUsedAt: null,
  confirmedBookingIds: [],
  completedHomeownerJobIds: [],
  providerCompletedJobIds: [],
};

let cache: TrackerData | null = null;
let loadPromise: Promise<TrackerData> | null = null;

async function load(): Promise<TrackerData> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<TrackerData>) : {};
      const merged: TrackerData = { ...DEFAULT, ...parsed };
      if (!merged.firstSeenAt) {
        merged.firstSeenAt = Date.now();
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
      cache = merged;
      return merged;
    } catch (err) {
      console.warn("[appReview] failed to load tracker:", err);
      cache = { ...DEFAULT, firstSeenAt: Date.now() };
      return cache;
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

async function persist(next: TrackerData): Promise<void> {
  cache = next;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("[appReview] failed to persist tracker:", err);
  }
}

function isSupportedPlatform(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

async function shouldPrompt(state: TrackerData): Promise<boolean> {
  if (!isSupportedPlatform()) return false;
  if (state.happyMomentCount === 0) return false;
  if (state.firstSeenAt && Date.now() - state.firstSeenAt < FIRST_SESSION_DELAY_MS) {
    return false;
  }
  if (state.lastPromptedAt && Date.now() - state.lastPromptedAt < PROMPT_THROTTLE_MS) {
    return false;
  }
  try {
    const available = await StoreReview.isAvailableAsync();
    if (!available) return false;
    const hasAction = await StoreReview.hasAction();
    if (!hasAction) return false;
  } catch {
    return false;
  }
  return true;
}

async function requestNativeReview(state: TrackerData): Promise<boolean> {
  try {
    await StoreReview.requestReview();
    const next: TrackerData = {
      ...state,
      lastPromptedAt: Date.now(),
    };
    await persist(next);
    return true;
  } catch (err) {
    console.warn("[appReview] requestReview failed:", err);
    return false;
  }
}

/**
 * Initialize the tracker on app start. Records the first-seen timestamp so we
 * can enforce the "never on first session" rule.
 */
export async function initAppReviewTracker(): Promise<void> {
  await load();
}

// Serialize all tracker mutations so concurrent callers can't clobber each
// other's writes. Each call appends to a single chain; the chain settles
// even when an individual update throws.
let mutationChain: Promise<void> = Promise.resolve();

function enqueueMutation(work: () => Promise<void>): Promise<void> {
  const next = mutationChain.then(work, work);
  mutationChain = next.catch(() => undefined);
  return next;
}

/**
 * Record that a happy moment occurred. Call this after a clearly positive user
 * action. The function will internally decide whether to prompt right now.
 */
export async function recordHappyMoment(
  key: HappyMomentKey,
  options?: { onlyOncePerKey?: boolean; payload?: Record<string, string> },
): Promise<void> {
  return enqueueMutation(() => recordHappyMomentInternal(key, options));
}

async function recordHappyMomentInternal(
  key: HappyMomentKey,
  options?: { onlyOncePerKey?: boolean; payload?: Record<string, string> },
): Promise<void> {
  const state = await load();
  const next: TrackerData = { ...state };

  if (options?.onlyOncePerKey && state.recordedKeys.includes(key)) {
    return;
  }

  switch (key) {
    case "homeowner_onboarding_complete":
      next.homeownerOnboardedAt = Date.now();
      next.hasUsedFeatureSinceOnboarding = false;
      next.recordedKeys = [...state.recordedKeys, key];
      await persist(next);
      // Don't prompt at onboarding — wait for a feature-use moment 48h later.
      return;

    case "homeowner_feature_used": {
      next.hasUsedFeatureSinceOnboarding = true;
      const onboardedAt = state.homeownerOnboardedAt;
      const elapsed =
        onboardedAt !== null && Date.now() - onboardedAt >= FIRST_SESSION_DELAY_MS;
      // Require 48h since onboarding before counting feature use.
      if (!elapsed) {
        await persist(next);
        return;
      }
      // Allow once per 30-day window (replaces the old lifetime dedup).
      if (
        state.lastFeatureUsedAt &&
        Date.now() - state.lastFeatureUsedAt < FEATURE_USED_WINDOW_MS
      ) {
        await persist(next);
        return;
      }
      next.lastFeatureUsedAt = Date.now();
      next.happyMomentCount = state.happyMomentCount + 1;
      break;
    }

    case "homeowner_high_review_submitted":
      next.happyMomentCount = state.happyMomentCount + 1;
      next.recordedKeys = [...state.recordedKeys, key];
      break;

    case "homeowner_booking_confirmed": {
      const bookingId = options?.payload?.bookingId;
      if (!bookingId) return;
      if (state.confirmedBookingIds.includes(bookingId)) return;
      next.confirmedBookingIds = [...state.confirmedBookingIds, bookingId].slice(-50);
      next.happyMomentCount = state.happyMomentCount + 1;
      break;
    }

    case "homeowner_job_completed": {
      const jobId = options?.payload?.jobId;
      if (!jobId) return;
      if (state.completedHomeownerJobIds.includes(jobId)) return;
      const nextIds = [...state.completedHomeownerJobIds, jobId];
      next.completedHomeownerJobIds = nextIds.slice(-50);
      // Count from the 2nd completed job onward — the first is still
      // "honeymoon" territory and the user hasn't formed a real opinion yet.
      if (nextIds.length < 2) {
        await persist(next);
        return;
      }
      next.happyMomentCount = state.happyMomentCount + 1;
      break;
    }

    case "provider_five_star_received": {
      const reviewId = options?.payload?.reviewId;
      if (!reviewId) return;
      if (state.acknowledgedReviewIds.includes(reviewId)) return;
      next.acknowledgedReviewIds = [...state.acknowledgedReviewIds, reviewId].slice(-50);
      next.happyMomentCount = state.happyMomentCount + 1;
      break;
    }

    case "provider_invoice_paid": {
      const invoiceId = options?.payload?.invoiceId;
      if (!invoiceId) return;
      if (state.paidInvoiceIds.includes(invoiceId)) return;
      const nextIds = [...state.paidInvoiceIds, invoiceId];
      next.paidInvoiceIds = nextIds.slice(-25);
      // Only count from the third paid invoice onward.
      if (nextIds.length < 3) {
        await persist(next);
        return;
      }
      next.happyMomentCount = state.happyMomentCount + 1;
      break;
    }

    case "provider_job_completed": {
      const jobId = options?.payload?.jobId;
      if (!jobId) return;
      if (state.providerCompletedJobIds.includes(jobId)) return;
      const nextIds = [...state.providerCompletedJobIds, jobId];
      next.providerCompletedJobIds = nextIds.slice(-50);
      // Count from the 3rd completed job onward — by then the provider
      // has earned real value from the platform.
      if (nextIds.length < 3) {
        await persist(next);
        return;
      }
      next.happyMomentCount = state.happyMomentCount + 1;
      break;
    }
  }

  await persist(next);

  if (await shouldPrompt(next)) {
    await requestNativeReview(next);
  }
}

/**
 * Direct invocation from the Settings entry. Always tries the native sheet
 * first; falls back to opening the store page in a browser.
 */
export async function openAppReviewFromSettings(): Promise<void> {
  if (isSupportedPlatform()) {
    try {
      const available = await StoreReview.isAvailableAsync();
      const hasAction = await StoreReview.hasAction();
      if (available && hasAction) {
        await StoreReview.requestReview();
        const state = await load();
        await persist({
          ...state,
          lastPromptedAt: Date.now(),
        });
        return;
      }
    } catch (err) {
      console.warn("[appReview] settings invocation failed:", err);
    }
  }
  try {
    await Linking.openURL(storeFallbackUrl());
  } catch (err) {
    console.warn("[appReview] could not open store URL:", err);
  }
}

/**
 * Test helper used by QA / debug screens to force-reset the tracker.
 */
export async function resetAppReviewTracker(): Promise<void> {
  cache = { ...DEFAULT, firstSeenAt: Date.now() };
  await AsyncStorage.removeItem(STORAGE_KEY);
}
