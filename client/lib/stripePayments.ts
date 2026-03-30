import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN || 'https://home-base-pro-app.replit.app';

export async function createPaymentIntentForBooking(bookingId: string, amount: number, currency: string = 'usd') {
  const response = await fetch(`${API_BASE}/api/payments/create-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId, amount, currency }),
  });
  if (!response.ok) throw new Error('Failed to create payment intent');
  return response.json();
}

export async function confirmBookingPayment(paymentIntentId: string, bookingId: string) {
  const response = await fetch(`${API_BASE}/api/payments/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentIntentId, bookingId }),
  });
  if (!response.ok) throw new Error('Failed to confirm payment');
  return response.json();
}
