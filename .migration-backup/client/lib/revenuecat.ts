/*
 * ─── REVENUECAT ERROR 23 — MANUAL CONFIGURATION CHECKLIST ───────────────────
 *
 * Error 23 (configurationError / STORE_PROBLEM) means StoreKit cannot find the
 * product identifiers registered in RevenueCat. Work through this checklist in
 * order — each item has silently broken IAP in production apps before.
 *
 * APP STORE CONNECT
 * ─────────────────
 * 1. Bundle ID: Confirm the app in App Store Connect has bundle ID
 *    `com.homebasepro.app` — exactly as declared in app.json.
 * 2. Products: Under the app → Subscriptions, confirm at least one
 *    Auto-Renewable Subscription product exists and its status is
 *    "Ready to Submit". Status of "Missing Metadata" or "Waiting for Review"
 *    means StoreKit will refuse to return the product to the SDK.
 * 3. Pricing: The subscription group must have a price tier set for the US
 *    storefront. Missing pricing = StoreKit returns no products.
 * 4. Agreements, Tax & Banking: In App Store Connect → Agreements, Tax, and
 *    Banking, ALL three agreements must be Active. A missing banking agreement
 *    silently prevents StoreKit from returning any products to any build.
 * 5. Sandbox tester: The sandbox Apple ID used for testing must be listed in
 *    App Store Connect → Users and Access → Sandbox Testers. On the device,
 *    sign in under Settings → App Store (sandbox section — scroll down), NOT
 *    as the main Apple ID. Using the production Apple ID for sandbox purchases
 *    will always fail with error 23.
 *
 * REVENUECAT DASHBOARD
 * ────────────────────
 * 6. Bundle ID: Under the RevenueCat project → Apple App → Configuration,
 *    confirm bundle ID is `com.homebasepro.app` (not a placeholder or old value).
 * 7. Product ID: Under the app → Products, confirm the product identifier
 *    exactly matches the product ID string in App Store Connect
 *    (character-for-character, e.g. `com.homebasepro.app.pro_monthly`).
 * 8. Offering: An Offering named "default" must exist and have at least one
 *    Package attached that points to the product above.
 * 9. Entitlement: An Entitlement named `HomeBase Pro` must exist and the product
 *    must be attached to it.
 * 10. API Key: `EXPO_PUBLIC_REVENUECAT_API_KEY` in Replit Secrets must match
 *     the Apple **public** SDK key shown in RevenueCat → Project Settings →
 *     API Keys. It starts with `appl_`. Using a secret key here will not work.
 *
 * HOW TO READ THE DIAGNOSTICS
 * ───────────────────────────
 * In a dev build, set __DEV__ = true and open the Subscription screen. The
 * debug panel calls getRevenueCatDiagnostics() on mount and renders:
 *   - Default offering ID (should be "default")
 *   - Package count (should be ≥ 1)
 *   - First package product ID (must match App Store Connect exactly)
 *   - Entitlement active (should be true after a sandbox purchase)
 * The Metro console will show the full RevenueCat DEBUG trace including the
 * StoreKit product fetch attempts, surfacing the exact failure reason.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Platform } from "react-native";

// react-native-purchases and react-native-purchases-ui are iOS/Android only.
// Importing them eagerly on the web build can break the bundler (they pull in
// native-only modules). We lazy-load them only when running on a native platform.
type PurchasesModule = typeof import("react-native-purchases");
type PurchasesNamespace = PurchasesModule["default"];
type CustomerInfo = import("react-native-purchases").CustomerInfo;
type PurchasesOffering = import("react-native-purchases").PurchasesOffering;
type PurchasesPackage = import("react-native-purchases").PurchasesPackage;
type PurchasesStoreProduct =
  import("react-native-purchases").PurchasesStoreProduct;

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || "";

// The entitlement identifier configured in RevenueCat for the HomeBase Pro
// provider subscription. All gating in the app keys off this entitlement.
export const PRO_ENTITLEMENT_ID = "HomeBase Pro";

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
 *
 * Log level is set to DEBUG in development so the full StoreKit product-fetch
 * trace appears in the Metro console — the fastest way to diagnose error 23.
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
      // Use DEBUG in dev builds so the full StoreKit trace (including product
      // fetch attempts) appears in Metro. Use WARN in production to stay quiet.
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
      Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
        appUserID: appUserId || null,
      });
      currentAppUserId = appUserId || null;
      if (__DEV__) {
        console.log(
          "[revenuecat] configured — appUserId:",
          appUserId || "(anonymous)",
          "| apiKey prefix:",
          REVENUECAT_API_KEY.slice(0, 8),
        );
      }
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

/**
 * Lightweight production-safe price fetch. Calls getOfferings() once and
 * returns the localised price string for the first package in the default
 * offering. No raw JSON logging — safe to call in production builds.
 * Returns null on any failure so callers can fall back to static copy.
 */
export async function getRevenueCatLivePrice(): Promise<string | null> {
  if (!isPurchasesAvailable()) return null;
  await waitForConfiguration();
  const Purchases = await loadPurchases();
  if (!Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const firstPkg: PurchasesPackage | null =
      offerings?.current?.availablePackages?.[0] ?? null;
    const firstProduct: PurchasesStoreProduct | undefined = firstPkg?.product;
    return firstProduct?.priceString ?? null;
  } catch (err) {
    console.warn("[revenuecat] getRevenueCatLivePrice error:", err);
    return null;
  }
}

export interface RevenueCatDiagnosticsResult {
  offeringsAvailable: boolean;
  defaultOfferingId: string | null;
  packageCount: number;
  firstPackageProductId: string | null;
  firstPackagePriceString: string | null;
  entitlementActive: boolean;
  rawOfferingsJson: string;
  rawCustomerInfoJson: string;
  error: string | null;
  errorCode: string | null;
}

/**
 * Fetch RevenueCat offerings and customer info, log the raw JSON, and return
 * a structured diagnostic object. Call this on mount in dev mode to surface
 * the exact failure (wrong product ID, missing entitlement, wrong environment)
 * without needing to attach a debugger.
 *
 * On error 23 (configurationError), `offeringsAvailable` will be false and
 * `error` will contain the SDK message pointing to the dashboard misconfiguration.
 */
export async function getRevenueCatDiagnostics(): Promise<RevenueCatDiagnosticsResult> {
  const empty: RevenueCatDiagnosticsResult = {
    offeringsAvailable: false,
    defaultOfferingId: null,
    packageCount: 0,
    firstPackageProductId: null,
    firstPackagePriceString: null,
    entitlementActive: false,
    rawOfferingsJson: "{}",
    rawCustomerInfoJson: "{}",
    error: null,
    errorCode: null,
  };

  if (!isPurchasesAvailable()) {
    return { ...empty, error: "IAP not available on this platform" };
  }

  await waitForConfiguration();
  const Purchases = await loadPurchases();
  if (!Purchases) {
    return { ...empty, error: "Native purchases module failed to load" };
  }

  try {
    const [offerings, customerInfo] = await Promise.all([
      Purchases.getOfferings().catch((err: any) => {
        console.error("[revenuecat] getOfferings error:", err);
        throw err;
      }),
      Purchases.getCustomerInfo().catch((err: any) => {
        console.error("[revenuecat] getCustomerInfo (diagnostics) error:", err);
        return null;
      }),
    ]);

    const defaultOffering = offerings?.current ?? null;
    const packages = defaultOffering?.availablePackages ?? [];
    const firstPkg: PurchasesPackage | null = packages[0] ?? null;
    const firstProduct: PurchasesStoreProduct | undefined = firstPkg?.product;
    const firstProductId = firstProduct?.identifier ?? null;
    const firstPriceString = firstProduct?.priceString ?? null;
    const entitlementActive =
      !!customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID];

    const rawOfferingsJson = JSON.stringify(offerings, null, 2);
    const rawCustomerInfoJson = JSON.stringify(customerInfo, null, 2);

    console.log("[revenuecat] === DIAGNOSTICS ===");
    console.log("[revenuecat] defaultOfferingId:", defaultOffering?.identifier ?? null);
    console.log("[revenuecat] packageCount:", packages.length);
    console.log("[revenuecat] firstPackageProductId:", firstProductId);
    console.log("[revenuecat] firstPackagePriceString:", firstPriceString);
    console.log("[revenuecat] entitlementActive:", entitlementActive);
    console.log("[revenuecat] raw offerings JSON:", rawOfferingsJson);
    console.log("[revenuecat] raw customerInfo JSON:", rawCustomerInfoJson);

    return {
      offeringsAvailable: packages.length > 0,
      defaultOfferingId: defaultOffering?.identifier ?? null,
      packageCount: packages.length,
      firstPackageProductId: firstProductId,
      firstPackagePriceString: firstPriceString,
      entitlementActive,
      rawOfferingsJson,
      rawCustomerInfoJson,
      error: null,
      errorCode: null,
    };
  } catch (err: any) {
    const errCode = err?.code != null ? String(err.code) : null;
    const errMsg = err?.message ?? String(err);
    console.error(
      `[revenuecat] diagnostics failed — code ${errCode}:`,
      errMsg,
    );
    return {
      ...empty,
      error: errMsg,
      errorCode: errCode,
    };
  }
}

export interface PurchaseResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  userCancelled?: boolean;
  errorMessage?: string;
}

export type { CustomerInfo, PurchasesOffering, PurchasesPackage };
