import { Platform } from 'react-native';

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';

let isConfigured = false;
let PurchasesRef: any = null;

export function setPurchasesModule(module: any) {
  PurchasesRef = module;
}

export async function configurePurchases(userId?: string) {
  if (Platform.OS === 'web') {
    console.log('RevenueCat not available on web - use mobile app for subscriptions');
    return;
  }
  
  if (isConfigured) return;
  
  if (!REVENUECAT_API_KEY) {
    console.warn('RevenueCat API key not configured');
    return;
  }

  if (!PurchasesRef) {
    console.warn('RevenueCat module not initialized - call setPurchasesModule first on native');
    return;
  }

  try {
    PurchasesRef.setLogLevel(1);
    
    if (userId) {
      await PurchasesRef.configure({ apiKey: REVENUECAT_API_KEY, appUserID: userId });
    } else {
      await PurchasesRef.configure({ apiKey: REVENUECAT_API_KEY });
    }
    
    isConfigured = true;
    console.log('RevenueCat configured successfully');
  } catch (error) {
    console.error('Error configuring RevenueCat:', error);
  }
}

export async function getOfferings() {
  if (Platform.OS === 'web' || !PurchasesRef) return null;
  
  try {
    const offerings = await PurchasesRef.getOfferings();
    return offerings;
  } catch (error) {
    console.error('Error fetching offerings:', error);
    return null;
  }
}

export async function purchasePackage(pkg: any): Promise<any | null> {
  if (Platform.OS === 'web' || !PurchasesRef) {
    console.log('Purchases not available');
    return null;
  }
  
  try {
    const { customerInfo } = await PurchasesRef.purchasePackage(pkg);
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

export async function restorePurchases(): Promise<any | null> {
  if (Platform.OS === 'web' || !PurchasesRef) return null;
  
  try {
    const customerInfo = await PurchasesRef.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    return null;
  }
}

export async function getCustomerInfo(): Promise<any | null> {
  if (Platform.OS === 'web' || !PurchasesRef) return null;
  
  try {
    const customerInfo = await PurchasesRef.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('Error getting customer info:', error);
    return null;
  }
}

export async function loginUser(userId: string): Promise<any | null> {
  if (Platform.OS === 'web' || !PurchasesRef) return null;
  
  try {
    const { customerInfo } = await PurchasesRef.logIn(userId);
    return customerInfo;
  } catch (error) {
    console.error('Error logging in to RevenueCat:', error);
    return null;
  }
}

export async function logoutUser(): Promise<any | null> {
  if (Platform.OS === 'web' || !PurchasesRef) return null;
  
  try {
    const customerInfo = await PurchasesRef.logOut();
    return customerInfo;
  } catch (error) {
    console.error('Error logging out of RevenueCat:', error);
    return null;
  }
}

export function isProUser(customerInfo: any | null): boolean {
  if (!customerInfo) return false;
  return customerInfo.entitlements?.active?.['pro'] !== undefined;
}

export function getPurchasesModule() {
  return PurchasesRef;
}

export function isRevenueCatAvailable(): boolean {
  return Platform.OS !== 'web' && PurchasesRef !== null;
}
