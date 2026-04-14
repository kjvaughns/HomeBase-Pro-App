export function useStripe() {
  return {
    initPaymentSheet: async (_params: any) => ({ error: null }),
    presentPaymentSheet: async () => ({ error: { code: "Canceled", message: "Stripe PaymentSheet not available on web. Use Expo Go on your device." } }),
  };
}
