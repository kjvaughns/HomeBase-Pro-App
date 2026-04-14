import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const UPCOMING_FEATURES = [
  { icon: "trending-up" as const, label: "Budget by Category", desc: "Set monthly limits for HVAC, plumbing, landscaping, and more" },
  { icon: "list" as const, label: "Auto-tracked Transactions", desc: "Completed bookings are automatically logged to the right category" },
  { icon: "alert-circle" as const, label: "Overspend Alerts", desc: "Get notified before you exceed any budget category" },
  { icon: "bar-chart-2" as const, label: "Annual Spending Reports", desc: "See how your home costs change year over year" },
];

export default function BudgeterScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl + 88,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.heroSection}>
          <View style={[styles.badgeRow]}>
            <View style={[styles.badge, { backgroundColor: Colors.accentLight }]}>
              <Feather name="clock" size={13} color={Colors.accent} />
              <ThemedText style={[styles.badgeText, { color: Colors.accent }]}>Coming Soon</ThemedText>
            </View>
          </View>

          <View style={[styles.iconCircle, { backgroundColor: Colors.accentLight }]}>
            <Feather name="dollar-sign" size={36} color={Colors.accent} />
          </View>

          <ThemedText style={styles.heroTitle}>Home Budget Tracker</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            Track every home expense, set budgets by category, and see exactly where your money goes — automatically.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>What you'll get</ThemedText>
          <View style={styles.featureGrid}>
            {UPCOMING_FEATURES.map((feature, idx) => (
              <GlassCard key={idx} style={styles.featureCard}>
                <View style={[styles.featureIconContainer, { backgroundColor: Colors.accentLight }]}>
                  <Feather name={feature.icon} size={18} color={Colors.accent} />
                </View>
                <ThemedText style={styles.featureLabel}>{feature.label}</ThemedText>
                <ThemedText style={[styles.featureDesc, { color: theme.textSecondary }]}>{feature.desc}</ThemedText>
              </GlassCard>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <GlassCard style={styles.ctaCard}>
            <Feather name="home" size={22} color={Colors.accent} />
            <ThemedText style={styles.ctaTitle}>Start building your history</ThemedText>
            <ThemedText style={[styles.ctaSubtitle, { color: theme.textSecondary }]}>
              Book your first service and your spending will start tracking automatically when Budgeter launches.
            </ThemedText>
            <PrimaryButton onPress={() => navigation.navigate("SmartIntake")}>
              Find a Pro
            </PrimaryButton>
          </GlassCard>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.xl,
  },
  heroSection: {
    alignItems: "center",
    gap: Spacing.md,
  },
  badgeRow: {
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    ...Typography.caption1,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    ...Typography.title2,
    textAlign: "center",
  },
  heroSubtitle: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 24,
  },
  sectionTitle: {
    ...Typography.footnote,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  featureGrid: {
    gap: Spacing.sm,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureLabel: {
    ...Typography.headline,
    flex: 1,
    marginTop: 2,
  },
  featureDesc: {
    ...Typography.footnote,
    flex: 1,
    marginTop: 2,
    lineHeight: 18,
  },
  ctaCard: {
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  ctaTitle: {
    ...Typography.title3,
    textAlign: "center",
  },
  ctaSubtitle: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 24,
  },
});
