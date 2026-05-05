import { Platform } from "react-native";

// react-native-purchases and react-native-purchases-ui are iOS/Android only.
// Importing them eagerly on the web build can break the bundler (they pull in
// native-only modules). We lazy-load them only when running on a native platform.
type PurchasesModule = typeof import("react-native-purchases");
type PurchasesNamespace = PurchasesModule["default"];
type CustomerInfo = import("react-native-purchases").CustomerInfo;
type PurchasesOffering = import("react-native-purchases").PurchasesOffering;
type PurchasesPackage = import("react-native-purchases").PurchasesPackage;

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || "";

// The entitlement identifier configured in RevenueCat for the HomeBase Pro
// provider subscription. All gating in the app keys off this entitlement.
export const PRO_ENTITLEMENT_ID = "pro";

// Replaced the `configured: boolean` flag with a Promise so that any code
// calling SDK methods can await configuration completion rather than racing
// against it. The promise is set once and reused on subsequent calls.
let configurePromise: Promise<void> | null = null;
let currentAppUserId: string | null = null;
let purchasesPromise: Promise<PurchasesNamespace | null> | null = null;

/**
 * RevenueCat IAP currently runs on iOS only. Android is not yet configured
 * in the RevenueCat dashboard (no `goog_…` key, no Play Billing products),
 * so Android builds must skip IAP entirely until that's set up. The web
 * build keeps using Stripe Checkout. We do **not** key this off the API
 * key — iOS must always take the IAP code path so it never displays
 * Stripe/website subscription copy (Apple compliance).
 */
export function isPurchasesAvailable(): boolean {
  return Platform.OS === "ios";
}

async function loadPurchases(): Promise<PurchasesNamespace | null> {
  if (!isPurchasesAvailable()) return null;
  if (!purchasesPromise) {
    purchasesPromise = import("react-native-purchases")
      .then((m) => m.default)
      .catch((err) => {
        console.error("[revenuecat] failed to load native module:", err);
        return null;
      });
  }
  return purchasesPromise;
}

/**
 * Configure the RevenueCat SDK once per app launch. Returns a stable Promise
 * so callers can await configuration completion before calling other SDK
 * methods. Subsequent calls return the same promise (no-op once configured).
 * On web this is a no-op since IAP is iOS/Android only (web uses Stripe).
 */
export async function configurePurchases(
  appUserId?: string | null,
): Promise<void> {
  if (!isPurchasesAvailable()) return;
  if (!REVENUECAT_API_KEY) {
    console.warn(
      "[revenuecat] EXPO_PUBLIC_REVENUECAT_API_KEY not set — IAP disabled",
    );
    return;
  }
  if (configurePromise) return configurePromise;

  configurePromise = (async () => {
    const Purchases = await loadPurchases();
    if (!Purchases) return;
    try {
      const { LOG_LEVEL } = await import("react-native-purchases");
      Purchases.setLogLevel(LOG_LEVEL.WARN);
      Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
        appUserID: appUserId || null,
      });
      currentAppUserId = appUserId || null;
    } catch (err) {
      // Reset so a subsequent call can retry configuration.
      configurePromise = null;
      console.error("[revenuecat] configure error:", err);
    }
  })();

  return configurePromise;
}

/**
 * Await SDK configuration before calling any method that requires it.
 * If configurePurchases hasn't been called yet (e.g. the paywall is opened
 * before App.tsx auth state resolves), this triggers configuration with no
 * app user ID so the SDK is at least usable anonymously, rather than silently
 * no-oping and leaving callers blocked on a null promise.
 */
export async function waitForConfiguration(): Promise<void> {
  if (!configurePromise) {
    return configurePurchases();
  }
  return configurePromise;
}

export async function loginPurchasesUser(appUserId: string): Promise<void> {
  if (!isPurchasesAvailable()) return;
  await waitForConfiguration();
  if (currentAppUserId === appUserId) return;
  const Purchases = await loadPurchases();
  if (!Purchases) return;
  try {
    await Purchases.logIn(appUserId);
    currentAppUserId = appUserId;
  } catch (err) {
    console.error("[revenuecat] logIn error:", err);
  }
}

export async function logoutPurchasesUser(): Promise<void> {
  if (!isPurchasesAvailable()) return;
  if (!configurePromise) return;
  const Purchases = await loadPurchases();
  if (!Purchases) return;
  try {
    await Purchases.logOut();
    currentAppUserId = null;
  } catch (err: any) {
    // logOut throws if the current user is anonymous — safe to ignore.
    if (err?.code !== "22") console.error("[revenuecat] logOut error:", err);
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (!isPurchasesAvailable()) {
    return {
      success: false,
      errorMessage: "Purchases unavailable on this platform",
    };
  }
  await waitForConfiguration();
  const Purchases = await loadPurchases();
  if (!Purchases) {
    return {
      success: false,
      errorMessage: "In-app purchases failed to load. Please try again.",
    };
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { success: true, customerInfo };
  } catch (err: any) {
    console.error("[revenuecat] restore error:", err);
    return { success: false, errorMessage: err?.message || "Restore failed" };
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isPurchasesAvailable()) return null;
  await waitForConfiguration();
  const Purchases = await loadPurchases();
  if (!Purchases) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    console.error("[revenuecat] getCustomerInfo error:", err);
    return null;
  }
}

export function isProEntitled(
  customerInfo: CustomerInfo | null | undefined,
): boolean {
  if (!customerInfo) return false;
  return !!customerInfo.entitlements?.active?.[PRO_ENTITLEMENT_ID];
}

/**
 * Build a deep link to the App Store / Play Store subscription management
 * page so users can cancel or update payment method per Apple/Google rules.
 */
export function getManageSubscriptionUrl(): string {
  if (Platform.OS === "ios") {
    return "https://apps.apple.com/account/subscriptions";
  }
  if (Platform.OS === "android") {
    return "https://play.google.com/store/account/subscriptions";
  }
  return "";
}

export interface PurchaseResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  userCancelled?: boolean;
  errorMessage?: string;
}

export type { CustomerInfo, PurchasesOffering, PurchasesPackage };
