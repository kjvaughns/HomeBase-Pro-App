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
  const result = await fetchProOffering();
  return result.status === "ok" ? result.offering : null;
}

export type OfferingFetchResult =
  | { status: "ok"; offering: PurchasesOffering }
  | { status: "empty"; reason: string }
  | { status: "error"; errorCode?: string; errorMessage: string };

/**
 * Fetch the current "pro" offering from RevenueCat with retry/backoff on
 * transient errors. Distinguishes three outcomes so the UI can render the
 * right state:
 *   - ok: a current offering with at least one package is available
 *   - empty: SDK responded but no current offering / no packages are configured
 *            (a dashboard/StoreKit configuration issue, not a transient error)
 *   - error: SDK threw or returned in a way that suggests retry may help
 *            (network down, store unreachable, SDK not yet configured, etc.)
 */
export async function fetchProOffering(): Promise<OfferingFetchResult> {
  if (!isPurchasesAvailable()) {
    return {
      status: "error",
      errorMessage: "In-app purchases are only available on iOS.",
    };
  }
  const Purchases = await loadPurchases();
  if (!Purchases) {
    return {
      status: "error",
      errorMessage: "In-app purchases failed to load.",
    };
  }

  const maxAttempts = 3;
  let lastErr: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      const packageCount = current?.availablePackages?.length ?? 0;
      console.log(
        "[revenuecat] getOfferings result:",
        JSON.stringify({
          attempt,
          currentId: current?.identifier ?? null,
          currentPackageCount: packageCount,
          allOfferingIds: Object.keys(offerings.all || {}),
        }),
      );
      if (current && packageCount > 0) {
        return { status: "ok", offering: current };
      }
      // SDK responded successfully but no current offering / packages are
      // configured. Retrying won't help — surface as "empty" immediately.
      return {
        status: "empty",
        reason: !current
          ? "No current offering is set in RevenueCat."
          : "Current offering has no available packages.",
      };
    } catch (err: any) {
      lastErr = err;
      console.error(
        `[revenuecat] getOfferings error (attempt ${attempt}/${maxAttempts}):`,
        {
          code: err?.code,
          message: err?.message,
          underlyingErrorMessage: err?.underlyingErrorMessage,
        },
      );
      if (attempt < maxAttempts) {
        // Exponential-ish backoff: 400ms, 1000ms.
        const delay = attempt === 1 ? 400 : 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  return {
    status: "error",
    errorCode: lastErr?.code,
    errorMessage:
      lastErr?.message ||
      "Couldn't reach the App Store. Check your connection and try again.",
  };
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
