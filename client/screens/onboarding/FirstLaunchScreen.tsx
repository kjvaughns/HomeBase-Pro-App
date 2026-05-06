import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Animated, Image, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Colors, BorderRadius, Spacing } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useOnboardingStore } from "@/state/onboardingStore";

const AppLogo = require("../../../assets/images/icon.png");

type Props = NativeStackScreenProps<RootStackParamList, "FirstLaunch">;

export default function FirstLaunchScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useLayout();

  const logoScale = useRef(new Animated.Value(0.78)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const [advanced, setAdvanced] = useState(false);

  const { setHasCompletedFirstLaunch } = useOnboardingStore();

  const goNext = () => {
    if (advanced) return;
    setAdvanced(true);
    // Persist that the value-prop / first-launch screen has been seen so
    // returning unauthenticated users skip straight to AccountType / Login.
    setHasCompletedFirstLaunch(true);
    navigation.navigate("AccountTypeSelection");
  };

  const goLogin = () => {
    if (advanced) return;
    setAdvanced(true);
    setHasCompletedFirstLaunch(true);
    navigation.navigate("Login");
  };

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 480,
          useNativeDriver: false,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 52,
          friction: 9,
          useNativeDriver: false,
        }),
      ]),
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={
          isDark
            ? [Colors.accent + "14", "transparent"]
            : [Colors.accent + "10", "transparent"]
        }
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          styles.logoContainer,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <View
          style={[
            styles.logoRing,
            {
              borderColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(56,174,95,0.14)",
              backgroundColor: isDark
                ? "rgba(255,255,255,0.04)"
                : "rgba(255,255,255,0.9)",
            },
          ]}
        >
          <Image source={AppLogo} style={styles.logo} resizeMode="contain" />
        </View>
        <ThemedText
          style={[styles.brand, { color: theme.text }]}
          numberOfLines={1}
        >
          HomeBase
        </ThemedText>
        <ThemedText
          style={[styles.tagline, { color: theme.textSecondary }]}
        >
          Home services, simplified.
        </ThemedText>
      </Animated.View>

      <Animated.View
        style={[
          styles.ctaArea,
          {
            opacity: ctaOpacity,
            paddingHorizontal: horizontalPadding,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
      >
        <Pressable
          onPress={goNext}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: Colors.accent,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
          testID="button-get-started"
        >
          <ThemedText style={styles.primaryButtonText}>Get started</ThemedText>
        </Pressable>
        <Pressable
          onPress={goLogin}
          style={({ pressed }) => [
            styles.loginButton,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.04)",
              borderColor: isDark
                ? "rgba(255,255,255,0.10)"
                : "rgba(0,0,0,0.08)",
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
          testID="button-first-launch-login"
        >
          <Feather name="log-in" size={18} color={Colors.accent} />
          <ThemedText
            style={[styles.loginButtonText, { color: Colors.accent }]}
          >
            Log in
          </ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 120,
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    alignSelf: "stretch",
  },
  brand: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  tagline: {
    fontSize: 15,
    marginTop: 6,
  },
  ctaArea: {
    width: "100%",
    gap: Spacing.sm,
  },
  primaryButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    width: "100%",
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  logoRing: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 92,
    height: 92,
    borderRadius: 20,
  },
});
