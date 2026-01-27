import React from "react";
import { StyleSheet, View, Image, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

export default function WelcomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + Spacing["3xl"] }]}>
        <View style={styles.logoContainer}>
          <View style={[styles.logoCircle, { backgroundColor: Colors.accent }]}>
            <Feather name="home" size={48} color="#FFFFFF" />
          </View>
          <ThemedText type="h1" style={styles.appName}>
            HomeBase
          </ThemedText>
          <ThemedText type="body" style={[styles.tagline, { color: theme.textSecondary }]}>
            Your home, simplified
          </ThemedText>
        </View>

        <View style={styles.features}>
          <FeatureRow icon="search" text="Find trusted home service providers" />
          <FeatureRow icon="calendar" text="Book and manage appointments" />
          <FeatureRow icon="message-circle" text="Chat directly with providers" />
          <FeatureRow icon="star" text="Access home management tools" />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <PrimaryButton
          onPress={() => navigation.navigate("SignUp")}
          testID="button-signup"
        >
          Create Account
        </PrimaryButton>

        <SecondaryButton
          onPress={() => navigation.navigate("Login")}
          testID="button-login"
        >
          Sign In
        </SecondaryButton>

        <Pressable
          onPress={() => navigation.navigate("Main")}
          style={styles.skipButton}
          testID="button-skip"
        >
          <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
            Continue as Guest
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function FeatureRow({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  const { theme } = useTheme();

  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIcon, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name={icon} size={20} color={Colors.accent} />
      </View>
      <ThemedText type="body" style={styles.featureText}>
        {text}
      </ThemedText>
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
  },
  logoContainer: {
    alignItems: "center",
    marginTop: Spacing["2xl"],
    marginBottom: Spacing.xl,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  appName: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: 16,
  },
  features: {
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.md,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  skipText: {
    ...Typography.callout,
    fontWeight: "500",
  },
});
