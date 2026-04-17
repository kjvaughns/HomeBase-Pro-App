import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || "";

// The entitlement identifier configured in RevenueCat for the HomeBase Pro
// provider subscription. All gating in the app keys off this entitlement.
export const PRO_ENTITLEMENT_ID = "pro";

let configured = false;
let currentAppUserId: string | null = null;

export function isPurchasesAvailable(): boolean {
  return Platform.OS !== "web" && !!REVENUECAT_API_KEY;
}

/**
 * Configure the RevenueCat SDK once per app launch. Safe to call multiple
 * times — subsequent calls after configuration are no-ops. On web this is a
 * no-op since IAP is iOS/Android only (web subscribers use Stripe).
 */
export function configurePurchases(appUserId?: string | null) {
  if (!isPurchasesAvailable()) return;
  if (configured) return;
  try {
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
    configurePurchases(appUserId);
    return;
  }
  if (currentAppUserId === appUserId) return;
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
  try {
    const offerings = await Purchases.getOfferings();
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
  return "https://homebaseproapp.com/subscribe";
}

export type { CustomerInfo, PurchasesOffering, PurchasesPackage };
