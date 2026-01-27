import Purchases, { 
  PurchasesPackage, 
  CustomerInfo,
  LOG_LEVEL 
} from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';

let isConfigured = false;

export async function configurePurchases(userId?: string) {
  if (isConfigured) return;
  
  if (!REVENUECAT_API_KEY) {
    console.warn('RevenueCat API key not configured');
    return;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    
    if (userId) {
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: userId });
    } else {
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    }
    
    isConfigured = true;
    console.log('RevenueCat configured successfully');
  } catch (error) {
    console.error('Error configuring RevenueCat:', error);
  }
}

export async function getOfferings() {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.error('Error fetching offerings:', error);
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) {
      console.log('User cancelled purchase');
    } else {
      console.error('Error making purchase:', error);
    }
    return null;
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    return null;
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('Error getting customer info:', error);
    return null;
  }
}

export async function loginUser(userId: string): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    return customerInfo;
  } catch (error) {
    console.error('Error logging in to RevenueCat:', error);
    return null;
  }
}

export async function logoutUser(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.logOut();
    return customerInfo;
  } catch (error) {
    console.error('Error logging out of RevenueCat:', error);
    return null;
  }
}

export function isProUser(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return customerInfo.entitlements.active['pro'] !== undefined;
}

export { Purchases };
