// Shared onboarding constants used by both entry points into provider
// onboarding: the pre-signup funnel (ProviderOnboardingScreen) and the
// post-signup flow for existing homeowners upgrading to provider
// (ProviderSetupFlow). Keeping these in one place ensures both flows show
// identical categories, days, and time options.

export const SERVICE_CATEGORIES = [
  { id: "plumbing", label: "Plumbing", icon: "droplet" as const },
  { id: "electrical", label: "Electrical", icon: "zap" as const },
  { id: "hvac", label: "HVAC", icon: "wind" as const },
  { id: "cleaning", label: "Cleaning", icon: "home" as const },
  { id: "landscaping", label: "Landscaping", icon: "sun" as const },
  { id: "handyman", label: "Handyman", icon: "tool" as const },
  { id: "roofing", label: "Roofing", icon: "umbrella" as const },
  { id: "painting", label: "Painting", icon: "edit-2" as const },
  { id: "pest", label: "Pest Control", icon: "shield" as const },
  { id: "moving", label: "Moving", icon: "truck" as const },
  { id: "appliance", label: "Appliances", icon: "settings" as const },
  { id: "other", label: "Other", icon: "more-horizontal" as const },
];

export const DAYS_OF_WEEK = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

export const START_TIMES = ["6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM"];
export const END_TIMES = ["4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"];

export const DURATION_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "2 hrs", value: 120 },
  { label: "3+ hrs", value: 180 },
];
