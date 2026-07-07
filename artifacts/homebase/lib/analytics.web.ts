export function initAnalytics(): Promise<void> {
  return Promise.resolve();
}

export function trackEvent(_event: string, _properties?: Record<string, unknown>) {}

export function identifyUser(_userId: string, _traits?: Record<string, unknown>) {}

export function resetAnalytics() {}

export const AnalyticsEvents = {
  SignupStarted: "signup_started",
  SignupCompleted: "signup_completed",
  BookingCreated: "booking_created",
  InvoicePaid: "invoice_paid",
  ProviderFirstBookingLinkReady: "provider_first_booking_link_ready",
} as const;
