import React, { useEffect } from "react";
// @ts-ignore
import { NavigationContainer, NavigationIndependentTree } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
// @ts-ignore
import * as Updates from "expo-updates";

import RootStackNavigator from "@/navigation/RootStackNavigator";
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
      <NavigationIndependentTree>
        <NavigationContainer linking={linking}>
          <RootStackNavigator />
        </NavigationContainer>
      </NavigationIndependentTree>
      <StatusBar style={isDark ? "light" : "dark"} />
    </>
  );
}

export default function AppIndex() {
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);

  const providerId = useAuthStore((s) => s.providerProfile?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  useEffect(() => {
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

  return (
    <>
      <AppContent />
      <OfflineBanner />
    </>
  );
}
