import React, { useEffect, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { StripeProviderWrapper } from "@/components/StripeProviderWrapper";
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

SplashScreen.preventAutoHideAsync();

export default function App() {
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);
  const [stripeKey, setStripeKey] = useState<string>("");
  const [webFontReady, setWebFontReady] = useState(Platform.OS !== "web");

  const [fontsLoaded, fontError] = useFonts(
    Platform.OS !== "web" ? { ...Feather.font } : {}
  );

  useEffect(() => {
    if (Platform.OS === "web") {
      const style = document.createElement("style");
      style.textContent = `@font-face { font-family: "feather"; src: url("/assets/fonts/Feather.ttf") format("truetype"); font-display: block; }`;
      document.head.appendChild(style);
      setWebFontReady(true);
    }
  }, []);

  const ready = Platform.OS === "web"
    ? webFontReady
    : fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing; cleanup tracked in Task #107
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
