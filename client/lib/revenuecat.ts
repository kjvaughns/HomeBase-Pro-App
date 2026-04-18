import { Platform } from "react-native";

// react-native-purchases is iOS/Android only. Importing it eagerly on the
// web build can break the bundler (it pulls in native-only modules). We
// lazy-load it only when running on a native platform.
type PurchasesModule = typeof import("react-native-purchases");
type PurchasesNamespace = PurchasesModule["default"];
type CustomerInfo = import("react-native-purchases").CustomerInfo;
type PurchasesOffering = import("react-native-purchases").PurchasesOffering;
type PurchasesPackage = import("react-native-purchases").PurchasesPackage;

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || "";

// The entitlement identifier configured in RevenueCat for the HomeBase Pro
// provider subscription. All gating in the app keys off this entitlement.
export const PRO_ENTITLEMENT_ID = "pro";

let configured = false;
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
 * Configure the RevenueCat SDK once per app launch. Safe to call multiple
 * times — subsequent calls after configuration are no-ops. On web this is a
 * no-op since IAP is iOS/Android only (web subscribers use Stripe).
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
  if (configured) return;
  const Purchases = await loadPurchases();
  if (!Purchases) return;
  try {
    const { LOG_LEVEL } = await import("react-native-purchases");
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: appUserId || null,
    });
    configured = true;
    currentAppUserId = appUserId || null;
  } catch (err) {
    console.error("[revenuecat] configure error:", err);
  }
}

export async function loginPurchasesUser(appUserId: string): Promise<void> {
  if (!isPurchasesAvailable()) return;
  if (!configured) {
    await configurePurchases(appUserId);
    return;
  }
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
  if (!configured) return;
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

export async function getProOffering(): Promise<PurchasesOffering | null> {
  if (!isPurchasesAvailable()) return null;
  const Purchases = await loadPurchases();
  if (!Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    console.log("[revenuecat] getOfferings result:", JSON.stringify({
      currentId: offerings.current?.identifier ?? null,
      currentPackageCount: offerings.current?.availablePackages?.length ?? 0,
      allOfferingIds: Object.keys(offerings.all || {}),
    }));
    return offerings.current ?? null;
  } catch (err) {
    console.error("[revenuecat] getOfferings error:", err);
    return null;
  }
}

export interface PurchaseResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  userCancelled?: boolean;
  errorMessage?: string;
}

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<PurchaseResult> {
  if (!isPurchasesAvailable()) {
    return {
      success: false,
      errorMessage: "Purchases unavailable on this platform",
    };
  }
  const Purchases = await loadPurchases();
  if (!Purchases) {
    return {
      success: false,
      errorMessage: "In-app purchases failed to load. Please try again.",
    };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { success: true, customerInfo };
  } catch (err: any) {
    if (err?.userCancelled) return { success: false, userCancelled: true };
    console.error("[revenuecat] purchase error:", err);
    return { success: false, errorMessage: err?.message || "Purchase failed" };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (!isPurchasesAvailable()) {
    return {
      success: false,
      errorMessage: "Purchases unavailable on this platform",
    };
  }
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

export type { CustomerInfo, PurchasesOffering, PurchasesPackage };
