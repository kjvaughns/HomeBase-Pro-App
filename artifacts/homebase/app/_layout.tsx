import { setBaseUrl } from "@workspace/api-client-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Slot } from "expo-router";
import { useFonts } from "expo-font";
// @ts-ignore
import { Feather, Ionicons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [webFontReady, setWebFontReady] = useState(Platform.OS !== "web");

  const [fontsLoaded, fontError] = useFonts(
    Platform.OS !== "web" ? { ...Feather.font, ...Ionicons.font } : {},
  );

  useEffect(() => {
    if (Platform.OS === "web") {
      // @ts-ignore
      const style = document.createElement("style");
      style.textContent = `
        @font-face { font-family: "feather"; src: url("/assets/fonts/Feather.ttf") format("truetype"); font-display: block; }
        @font-face { font-family: "Ionicons"; src: url("/assets/fonts/Ionicons.ttf") format("truetype"); font-display: block; }
      `;
      // @ts-ignore
      document.head.appendChild(style);
      setWebFontReady(true);
    }
  }, []);

  const ready = Platform.OS === "web" ? webFontReady : fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          {/* @ts-ignore React 19 GestureHandlerRootView children type */}
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <Slot />
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
