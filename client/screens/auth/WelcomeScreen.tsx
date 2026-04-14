import React from "react";
import { StyleSheet, View, Image, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const AppLogo = require("../../../assets/images/icon.png");

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

export default function WelcomeScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const gradientColors = isDark
    ? (["#0D1F15", "#0A1A10", "#000000"] as const)
    : (["#F0FBF4", "#E6F7EC", "#FFFFFF"] as const);

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + Spacing["2xl"] }]}>
        <View style={styles.logoSection}>
          <Image source={AppLogo} style={styles.logo} resizeMode="contain" />
          <ThemedText style={styles.appName}>HomeBase</ThemedText>
          <ThemedText style={[styles.tagline, { color: theme.textSecondary }]}>
            Trusted pros. Peace of mind.
          </ThemedText>
        </View>

        <View style={styles.trustRow}>
          <TrustBadge value="10k+" label="Homeowners" />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <TrustBadge value="500+" label="Verified Pros" />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <TrustBadge value="4.9" label="Avg Rating" />
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", borderColor: theme.borderLight }]}>
          <ProofRow icon="shield" text="Background-checked, licensed professionals" />
          <ProofRow icon="dollar-sign" text="Upfront pricing — no hidden fees" />
          <ProofRow icon="clock" text="Book in under 2 minutes" />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <PrimaryButton onPress={() => navigation.navigate("SignUp")} testID="button-signup">
          Get Started
        </PrimaryButton>

        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={[styles.signInButton, { borderColor: theme.border }]}
          testID="button-login"
        >
          <ThemedText style={[styles.signInText, { color: theme.text }]}>
            I already have an account
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("Main")}
          style={styles.guestButton}
          testID="button-skip"
        >
          <ThemedText style={[styles.guestText, { color: theme.textSecondary }]}>
            Browse as guest
          </ThemedText>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function TrustBadge({ value, label }: { value: string; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.trustBadge}>
      <ThemedText style={[styles.trustValue, { color: Colors.accent }]}>{value}</ThemedText>
      <ThemedText style={[styles.trustLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
    </View>
  );
}

function ProofRow({ icon, text }: { icon: string; text: string }) {
  const { theme } = useTheme();
  const { Feather } = require("@expo/vector-icons");
  return (
    <View style={styles.proofRow}>
      <View style={[styles.proofIcon, { backgroundColor: Colors.accentLight }]}>
        <Feather name={icon} size={16} color={Colors.accent} />
      </View>
      <ThemedText style={[styles.proofText, { color: theme.textSecondary }]}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
    justifyContent: "center",
    gap: Spacing.xl,
  },
  logoSection: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xs,
  },
  appName: {
    ...Typography.title1,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  tagline: {
    ...Typography.title3,
    fontWeight: "400",
    textAlign: "center",
  },
  trustRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.lg,
  },
  trustBadge: {
    alignItems: "center",
    gap: 2,
  },
  trustValue: {
    ...Typography.title2,
    fontWeight: "700",
  },
  trustLabel: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  divider: {
    width: 1,
    height: 28,
    opacity: 0.4,
  },
  card: {
    borderRadius: BorderRadius["2xl"],
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  proofRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  proofIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  proofText: {
    ...Typography.subhead,
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.md,
  },
  signInButton: {
    height: 50,
    borderRadius: BorderRadius.button,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  signInText: {
    ...Typography.callout,
    fontWeight: "500",
  },
  guestButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    minHeight: 44,
    justifyContent: "center",
  },
  guestText: {
    ...Typography.callout,
    textDecorationLine: "underline",
  },
});
