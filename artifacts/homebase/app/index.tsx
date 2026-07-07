import React, { useEffect } from "react";
// @ts-ignore
import { NavigationContainer, NavigationIndependentTree, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
// @ts-ignore
import * as Updates from "expo-updates";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PaidCelebrationOverlay } from "@/components/PaidCelebrationOverlay";
import { useThemeStore } from "@/state/themeStore";
import { useOnboardingStore } from "@/state/onboardingStore";
import { initAppReviewTracker } from "@/state/appReviewStore";
import { useAuthStore } from "@/state/authStore";
import { initNetworkStore } from "@/state/networkStore";
import { initAnalytics, identifyUser, resetAnalytics } from "@/lib/analytics";
import { useTheme } from "@/hooks/useTheme";
import { Colors } from "@/constants/theme";
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
  const isHydrated = useThemeStore((s) => s.isHydrated);

  if (!isHydrated) return null;

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: Colors.dark.backgroundRoot,
          card: Colors.dark.backgroundRoot,
          text: Colors.dark.text,
          border: Colors.dark.border,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: Colors.light.backgroundRoot,
          card: Colors.light.backgroundRoot,
          text: Colors.light.text,
          border: Colors.light.border,
        },
      };

  return (
    <>
      <NavigationIndependentTree>
        <NavigationContainer linking={linking} theme={navTheme}>
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
    initNetworkStore();
    void initAnalytics().then(() => {
      if (isAuthenticated && userId) {
        identifyUser(userId);
      } else {
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
      <PaidCelebrationOverlay />
    </>
  );
}
