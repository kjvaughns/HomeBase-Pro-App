import { Platform, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import Constants from "expo-constants";

const STORAGE_KEY = "app-review-tracker.v1";
// Public landing page that links out to both store listings. Used as the
// fallback when the native in-app review sheet isn't available (e.g. web,
// or when the OS-level throttle is exhausted). The dedicated /rate path
// resolves to the live App Store / Play Store listings once they exist,
// and to the marketing page otherwise — so this URL is always valid.
const STORE_FALLBACK_URL = "https://homebaseproapp.com/rate";

const FIRST_SESSION_DELAY_MS = 24 * 60 * 60 * 1000;
const PROMPT_THROTTLE_MS = 90 * 24 * 60 * 60 * 1000;

export type HappyMomentKey =
  | "homeowner_onboarding_complete"
  | "homeowner_feature_used"
  | "homeowner_high_review_submitted"
  | "provider_five_star_received"
  | "provider_invoice_paid";

interface TrackerData {
  firstSeenAt: number | null;
  lastPromptedAt: number | null;
  lastPromptedVersion: string | null;
  happyMomentCount: number;
  recordedKeys: string[];
  acknowledgedReviewIds: string[];
  paidInvoiceIds: string[];
  homeownerOnboardedAt: number | null;
  hasUsedFeatureSinceOnboarding: boolean;
}

const DEFAULT: TrackerData = {
  firstSeenAt: null,
  lastPromptedAt: null,
  lastPromptedVersion: null,
  happyMomentCount: 0,
  recordedKeys: [],
  acknowledgedReviewIds: [],
  paidInvoiceIds: [],
  homeownerOnboardedAt: null,
  hasUsedFeatureSinceOnboarding: false,
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

function currentVersion(): string {
  return Constants.expoConfig?.version ?? "1.0.0";
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
  if (state.lastPromptedVersion === currentVersion()) {
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
      lastPromptedVersion: currentVersion(),
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
      // Don't prompt at onboarding — wait for a feature-use moment 24h later.
      return;

    case "homeowner_feature_used": {
      // Mark the feature-use flag so we know the user has actually engaged
      // with the app at some point after onboarding.
      next.hasUsedFeatureSinceOnboarding = true;
      const onboardedAt = state.homeownerOnboardedAt;
      const elapsed =
        onboardedAt !== null && Date.now() - onboardedAt >= FIRST_SESSION_DELAY_MS;
      // Only count the happy moment once the *combined* condition is true:
      // (a) at least 24h has elapsed since onboarding, and (b) they've used
      // a feature at any point after onboarding (current call satisfies b).
      // We dedup so multiple feature-use events don't inflate the counter.
      if (!elapsed) {
        await persist(next);
        return;
      }
      if (state.recordedKeys.includes("homeowner_feature_used")) {
        await persist(next);
        return;
      }
      next.recordedKeys = [...state.recordedKeys, "homeowner_feature_used"];
      next.happyMomentCount = state.happyMomentCount + 1;
      break;
    }

    case "homeowner_high_review_submitted":
      next.happyMomentCount = state.happyMomentCount + 1;
      next.recordedKeys = [...state.recordedKeys, key];
      break;

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
      // Only count the third (and later) successfully paid invoice as the
      // happy moment, per spec.
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
          lastPromptedVersion: currentVersion(),
        });
        return;
      }
    } catch (err) {
      console.warn("[appReview] settings invocation failed:", err);
    }
  }
  try {
    await Linking.openURL(STORE_FALLBACK_URL);
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
