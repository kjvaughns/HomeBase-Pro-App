import React, { useEffect, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useFonts } from "expo-font";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useThemeStore } from "@/state/themeStore";
import { useOnboardingStore } from "@/state/onboardingStore";
import { initAppReviewTracker } from "@/state/appReviewStore";
import { useAuthStore } from "@/state/authStore";
import { initNetworkStore } from "@/state/networkStore";
import { initSentry, setSentryUser } from "@/lib/sentry";
import { initAnalytics, identifyUser, resetAnalytics } from "@/lib/analytics";
import { useTheme } from "@/hooks/useTheme";
import {
  configurePurchases,
  loginPurchasesUser,
  logoutPurchasesUser,
  isPurchasesAvailable,
} from "@/lib/revenuecat";

const linking = {
  prefixes: ["homebase://", "exp+homebase://"],
  config: {
    screens: {
      SimpleBooking: "SimpleBooking",
      Subscription: "Subscription",
      // Stripe Checkout return — homebase://payment-result?invoiceId=...&jobId=...&status=paid|cancelled
      Payment: "payment-result",
      JobDetail: "job/:jobId",
      InvoiceDetail: "invoice/:invoiceId",
    },
  },
};

function AppContent() {
  const { isDark } = useTheme();

  return (
    <>
      <NavigationContainer linking={linking}>
        <RootStackNavigator />
      </NavigationContainer>
      <StatusBar style={isDark ? "light" : "dark"} />
    </>
  );
}

SplashScreen.preventAutoHideAsync();

export default function App() {
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);
  const [webFontReady, setWebFontReady] = useState(Platform.OS !== "web");

  const [fontsLoaded, fontError] = useFonts(
    Platform.OS !== "web" ? { ...Feather.font, ...Ionicons.font } : {},
  );

  useEffect(() => {
    if (Platform.OS === "web") {
      const style = document.createElement("style");
      style.textContent = `
        @font-face { font-family: "feather"; src: url("/assets/fonts/Feather.ttf") format("truetype"); font-display: block; }
        @font-face { font-family: "Ionicons"; src: url("/assets/fonts/Ionicons.ttf") format("truetype"); font-display: block; }
      `;
      document.head.appendChild(style);
      setWebFontReady(true);
    }
  }, []);

  const ready =
    Platform.OS === "web" ? webFontReady : fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  // Initialize RevenueCat once on launch (no-op on web), then sync the active
  // appUserID to the current providerProfile so receipts attach to the right
  // account on this device. Re-runs whenever auth or provider identity changes.
  const providerId = useAuthStore((s) => s.providerProfile?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  useEffect(() => {
    // Ensure SDKs are initialized before associating user identity. Both
    // init helpers are idempotent + no-op when env keys are missing, so
    // calling them here is safe even when also called in the boot effect.
    initSentry();
    initNetworkStore();
    void initAnalytics().then(() => {
      if (isAuthenticated && userId) {
        setSentryUser({ id: userId });
        identifyUser(userId);
      } else {
        setSentryUser(null);
        resetAnalytics();
      }
    });
  }, [isAuthenticated, userId]);

  // Configure RevenueCat only once the provider identity is resolved so we
  // never create an anonymous appUserID on launch.
  useEffect(() => {
    if (!isPurchasesAvailable()) return;
    if (isAuthenticated && providerId) {
      void (async () => {
        await configurePurchases(providerId);
        await loginPurchasesUser(providerId);
      })();
    } else if (!isAuthenticated) {
      void logoutPurchasesUser();
    }
  }, [isAuthenticated, providerId]);

  useEffect(() => {
    initSentry();
    void initAnalytics();
    hydrateTheme();
    hydrateOnboarding();
    void initAppReviewTracker();

    async function downloadUpdateIfAvailable() {
      if (__DEV__) return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
        }
      } catch (_) {}
    }
    downloadUpdateIfAvailable();
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <AppContent />
              <OfflineBanner />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
