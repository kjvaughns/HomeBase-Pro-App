import { apiRequest } from './query-client';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export async function getStripeConfig() {
  try {
    const response = await apiRequest('GET', '/api/stripe/config');
    return response.json();
  } catch (error) {
    console.error('Error getting Stripe config:', error);
    return { publishableKey: STRIPE_PUBLISHABLE_KEY };
  }
}

// createPaymentIntent removed in Task #150 — provider-payment intents must be
// created via the Stripe Connect destination-charge flow. Use the homeowner
// payment-sheet API or POST /api/invoices/:invoiceId/checkout instead.

export async function createStripeCustomer(email: string, userId: string) {
  try {
    const response = await apiRequest('POST', '/api/stripe/create-customer', {
      email,
      userId,
    });
    return response.json();
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
}

export async function getProductsWithPrices() {
  try {
    const response = await apiRequest('GET', '/api/stripe/products-with-prices');
    return response.json();
  } catch (error) {
    console.error('Error getting products:', error);
    return { products: [] };
  }
}

export async function createCheckoutSession(customerId: string, priceId: string, successUrl?: string, cancelUrl?: string) {
  try {
    const response = await apiRequest('POST', '/api/stripe/create-checkout-session', {
      customerId,
      priceId,
      successUrl,
      cancelUrl,
    });
    return response.json();
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

export async function openCustomerPortal(customerId: string, returnUrl?: string) {
  try {
    const response = await apiRequest('POST', '/api/stripe/customer-portal', {
      customerId,
      returnUrl,
    });
    return response.json();
  } catch (error) {
    console.error('Error opening customer portal:', error);
    throw error;
  }
}

export { STRIPE_PUBLISHABLE_KEY };
