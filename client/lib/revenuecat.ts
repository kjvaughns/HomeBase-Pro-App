import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';

export function initializePurchases(userId?: string) {
  const apiKey =
    Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

  if (!apiKey) return;
  Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({ apiKey, appUserID: userId || null });
}

export async function getProviderSubscriptionOfferings() {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (e) {
    console.error('RevenueCat offerings error:', e);
    return null;
  }
}

export async function purchaseProviderSubscription(pkg: PurchasesPackage) {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { success: true, customerInfo };
  } catch (e: any) {
    if (!e.userCancelled) console.error('Purchase error:', e);
    return { success: false, error: e };
  }
}

export async function checkProviderSubscriptionStatus() {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch {
    return null;
  }
}

export async function logOutPurchases() {
  try {
    await Purchases.logOut();
  } catch {
    // already logged out or anonymous
  }
}
