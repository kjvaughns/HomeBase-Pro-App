import { Alert } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN || '';

export async function createPaymentIntentForBooking(params: {
  amount: number;
  currency?: string;
  bookingId: string;
  customerId?: string;
  token: string;
}) {
  const response = await fetch(`${API_BASE}/api/payments/create-intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency ?? 'usd',
      bookingId: params.bookingId,
      customerId: params.customerId,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.message ?? 'Failed to create payment intent');
  }

  return response.json();
}
