import * as Sentry from "@sentry/react-native";

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (__DEV__) console.log("[sentry] no DSN configured, skipping init");
    return;
  }
  try {
    Sentry.init({
      dsn,
      debug: false,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
    initialized = true;
  } catch (err) {
    console.warn("[sentry] init failed:", err);
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>) {
  if (!initialized) {
    if (__DEV__) console.log("[sentry] (noop) captureException:", err);
    return;
  }
  try {
    if (context) {
      Sentry.withScope((scope) => {
        scope.setExtras(context);
        Sentry.captureException(err);
      });
    } else {
      Sentry.captureException(err);
    }
  } catch {}
}

export function setSentryUser(user: { id: string; email?: string } | null) {
  if (!initialized) return;
  try {
    if (user) {
      Sentry.setUser({ id: user.id });
    } else {
      Sentry.setUser(null);
    }
  } catch {}
}
