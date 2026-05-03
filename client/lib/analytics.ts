import { PostHog } from "posthog-react-native";

let client: PostHog | null = null;
let initPromise: Promise<void> | null = null;

export function initAnalytics(): Promise<void> {
  if (initPromise) return initPromise;
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  if (!key) {
    if (__DEV__) console.log("[analytics] no PostHog key, skipping init");
    initPromise = Promise.resolve();
    return initPromise;
  }
  initPromise = (async () => {
    try {
      client = new PostHog(key, { host, captureAppLifecycleEvents: true });
    } catch (err) {
      console.warn("[analytics] init failed:", err);
    }
  })();
  return initPromise;
}

export function trackEvent(event: string, properties?: Record<string, any>) {
  if (!client) {
    if (__DEV__) console.log("[analytics] (noop) track:", event, properties);
    return;
  }
  try {
    client.capture(event, properties);
  } catch {}
}

export function identifyUser(userId: string, traits?: Record<string, any>) {
  if (!client) return;
  try {
    client.identify(userId, traits);
  } catch {}
}

export function resetAnalytics() {
  if (!client) return;
  try {
    client.reset();
  } catch {}
}

export const AnalyticsEvents = {
  SignupCompleted: "signup_completed",
  BookingCreated: "booking_created",
  InvoicePaid: "invoice_paid",
} as const;
