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

const SAVINGS_FEATURES = [
  { icon: "shield" as const, color: Colors.accent, label: "Emergency Savings", desc: "Know how much you avoided by catching problems early" },
  { icon: "tag" as const, color: "#8B5CF6", label: "Discounts Captured", desc: "Track off-peak and bundle savings from your providers" },
  { icon: "pie-chart" as const, color: "#3B82F6", label: "Spend by Category", desc: "See where your home budget actually goes each year" },
  { icon: "trending-up" as const, color: "#F59E0B", label: "Year-over-Year Trends", desc: "Understand if your home costs are rising or stabilizing" },
];

export default function SavingsSpendScreen() {
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
          <View style={[styles.badge, { backgroundColor: Colors.accentLight }]}>
            <Feather name="clock" size={13} color={Colors.accent} />
            <ThemedText style={[styles.badgeText, { color: Colors.accent }]}>Coming Soon</ThemedText>
          </View>

          <View style={[styles.iconCircle, { backgroundColor: Colors.accentLight }]}>
            <Feather name="trending-up" size={36} color={Colors.accent} />
          </View>

          <ThemedText style={styles.heroTitle}>Savings & Spending</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            See every dollar you've spent on your home — and every dollar you've saved by staying ahead of problems.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>What you'll track</ThemedText>
          <View style={styles.featureList}>
            {SAVINGS_FEATURES.map((feature, idx) => (
              <GlassCard key={idx} style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: `${feature.color}18` }]}>
                  <Feather name={feature.icon} size={20} color={feature.color} />
                </View>
                <View style={styles.featureText}>
                  <ThemedText style={styles.featureLabel}>{feature.label}</ThemedText>
                  <ThemedText style={[styles.featureDesc, { color: theme.textSecondary }]}>{feature.desc}</ThemedText>
                </View>
              </GlassCard>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <GlassCard style={styles.ctaCard}>
            <View style={[styles.ctaIconRing, { backgroundColor: Colors.accentLight }]}>
              <Feather name="home" size={24} color={Colors.accent} />
            </View>
            <ThemedText style={styles.ctaTitle}>Your data starts with your first booking</ThemedText>
            <ThemedText style={[styles.ctaSubtitle, { color: theme.textSecondary }]}>
              Once you complete a service, your spend and savings summary will build automatically.
            </ThemedText>
            <PrimaryButton onPress={() => navigation.navigate("SmartIntake")}>
              Book a Service
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
  sectionLabel: {
    ...Typography.footnote,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  featureList: {
    gap: Spacing.sm,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureLabel: {
    ...Typography.headline,
  },
  featureDesc: {
    ...Typography.footnote,
    lineHeight: 18,
  },
  ctaCard: {
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  ctaIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
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
