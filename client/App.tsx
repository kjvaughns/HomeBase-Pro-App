import React, { useEffect, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useFonts } from "expo-font";
import { Feather } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useThemeStore } from "@/state/themeStore";
import { useOnboardingStore } from "@/state/onboardingStore";
import { useAuthStore } from "@/state/authStore";
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
    Platform.OS !== "web" ? { ...Feather.font } : {},
  );

  useEffect(() => {
    if (Platform.OS === "web") {
      const style = document.createElement("style");
      style.textContent = `@font-face { font-family: "feather"; src: url("/assets/fonts/Feather.ttf") format("truetype"); font-display: block; }`;
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

  // Defer RevenueCat SDK configuration until the provider identity is
  // resolved. Configuring with a null/anonymous appUserID would create a
  // throwaway anonymous user and detach receipts from the real provider on
  // login — strictly disallowed in production. We re-login on identity
  // changes and only log out when the user signs out.
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
    hydrateTheme();
    hydrateOnboarding();

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
