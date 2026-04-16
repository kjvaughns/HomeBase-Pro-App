import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { StripeProviderWrapper } from "@/components/StripeProviderWrapper";
import * as Updates from "expo-updates";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useThemeStore } from "@/state/themeStore";
import { useOnboardingStore } from "@/state/onboardingStore";
import { useTheme } from "@/hooks/useTheme";
import { getApiUrl } from "@/lib/query-client";

const linking = {
  prefixes: ["homebase://", "exp+homebase://"],
  config: {
    screens: {
      SimpleBooking: "SimpleBooking",
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

export default function App() {
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);
  const [stripeKey, setStripeKey] = useState<string>("");

  useEffect(() => {
    hydrateTheme();
    hydrateOnboarding();
    fetch(new URL("/api/stripe/config", getApiUrl()).toString())
      .then((r) => r.json())
      .then((d) => { if (d.publishableKey) setStripeKey(d.publishableKey); })
      .catch(() => {});

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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <StripeProviderWrapper publishableKey={stripeKey}>
                <AppContent />
              </StripeProviderWrapper>
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
