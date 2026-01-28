import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";

interface SpendCategory {
  id: string;
  name: string;
  amount: number;
  color: string;
  icon: keyof typeof Feather.glyphMap;
}

interface SavingsWin {
  id: string;
  title: string;
  description: string;
  amount: number;
  date: string;
  type: "emergency" | "discount" | "timing";
}

const MOCK_CATEGORIES: SpendCategory[] = [
  { id: "1", name: "HVAC", amount: 1850, color: "#3B82F6", icon: "wind" },
  { id: "2", name: "Plumbing", amount: 1425, color: "#8B5CF6", icon: "droplet" },
  { id: "3", name: "Electrical", amount: 890, color: "#F59E0B", icon: "zap" },
  { id: "4", name: "Lawn Care", amount: 720, color: Colors.accent, icon: "sun" },
  { id: "5", name: "Cleaning", amount: 560, color: "#EC4899", icon: "home" },
  { id: "6", name: "Other", amount: 340, color: "#6B7280", icon: "tool" },
];

const MOCK_SAVINGS_WINS: SavingsWin[] = [
  {
    id: "1",
    title: "Avoided AC Emergency",
    description: "Preventive maintenance caught failing capacitor",
    amount: 800,
    date: "Nov 2025",
    type: "emergency",
  },
  {
    id: "2",
    title: "Seasonal Discount",
    description: "10% off HVAC tune-up during off-peak",
    amount: 150,
    date: "Oct 2025",
    type: "discount",
  },
  {
    id: "3",
    title: "Early Plumbing Fix",
    description: "Fixed small leak before water damage",
    amount: 2500,
    date: "Aug 2025",
    type: "emergency",
  },
  {
    id: "4",
    title: "Bundle Savings",
    description: "Combined gutter + roof inspection",
    amount: 75,
    date: "Jul 2025",
    type: "timing",
  },
];

const TOTAL_SPENT_LIFETIME = 12450;
const TOTAL_SPENT_YEAR = 5785;
const TOTAL_SAVED_LIFETIME = 4525;
const TOTAL_SAVED_YEAR = 3525;

export default function SavingsSpendScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalCategorySpend = MOCK_CATEGORIES.reduce((sum, cat) => sum + cat.amount, 0);

  const getWinIcon = (type: SavingsWin["type"]): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "emergency":
        return "shield";
      case "discount":
        return "tag";
      case "timing":
        return "clock";
    }
  };

  const getWinColor = (type: SavingsWin["type"]) => {
    switch (type) {
      case "emergency":
        return Colors.accent;
      case "discount":
        return "#8B5CF6";
      case "timing":
        return "#3B82F6";
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl + 88,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.summaryRow}>
            <GlassCard style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View style={[styles.summaryIcon, { backgroundColor: theme.backgroundTertiary }]}>
                  <Feather name="credit-card" size={18} color={theme.textSecondary} />
                </View>
                <Pressable onPress={() => setShowInfoDrawer(true)}>
                  <Feather name="info" size={16} color={theme.textTertiary} />
                </Pressable>
              </View>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Total Spent
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {formatCurrency(TOTAL_SPENT_LIFETIME)}
              </ThemedText>
              <ThemedText style={[styles.summarySubtext, { color: theme.textTertiary }]}>
                {formatCurrency(TOTAL_SPENT_YEAR)} this year
              </ThemedText>
            </GlassCard>

            <GlassCard style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View style={[styles.summaryIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="trending-up" size={18} color={Colors.accent} />
                </View>
              </View>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Estimated Saved
              </ThemedText>
              <ThemedText style={[styles.summaryValue, { color: Colors.accent }]}>
                {formatCurrency(TOTAL_SAVED_LIFETIME)}
              </ThemedText>
              <ThemedText style={[styles.summarySubtext, { color: theme.textTertiary }]}>
                {formatCurrency(TOTAL_SAVED_YEAR)} this year
              </ThemedText>
            </GlassCard>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <GlassCard style={styles.breakdownCard}>
            <View style={styles.breakdownHeader}>
              <ThemedText style={styles.sectionTitle}>Savings Breakdown</ThemedText>
            </View>
            <View style={styles.breakdownItems}>
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownDot}>
                  <Feather name="shield" size={14} color={Colors.accent} />
                </View>
                <ThemedText style={styles.breakdownLabel}>Avoided Emergencies</ThemedText>
                <ThemedText style={[styles.breakdownValue, { color: Colors.accent }]}>
                  {formatCurrency(3300)}
                </ThemedText>
              </View>
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownDot}>
                  <Feather name="tag" size={14} color="#8B5CF6" />
                </View>
                <ThemedText style={styles.breakdownLabel}>Discounts & Promos</ThemedText>
                <ThemedText style={[styles.breakdownValue, { color: "#8B5CF6" }]}>
                  {formatCurrency(850)}
                </ThemedText>
              </View>
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownDot}>
                  <Feather name="clock" size={14} color="#3B82F6" />
                </View>
                <ThemedText style={styles.breakdownLabel}>Optimized Timing</ThemedText>
                <ThemedText style={[styles.breakdownValue, { color: "#3B82F6" }]}>
                  {formatCurrency(375)}
                </ThemedText>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <ThemedText style={styles.sectionHeader}>Where Your Money Went</ThemedText>
          <GlassCard style={styles.categoryCard}>
            {MOCK_CATEGORIES.map((category, index) => {
              const percentage = Math.round((category.amount / totalCategorySpend) * 100);
              return (
                <View
                  key={category.id}
                  style={[
                    styles.categoryRow,
                    index < MOCK_CATEGORIES.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.separator,
                    },
                  ]}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
                    <Feather name={category.icon} size={16} color={category.color} />
                  </View>
                  <View style={styles.categoryInfo}>
                    <ThemedText style={styles.categoryName}>{category.name}</ThemedText>
                    <View style={[styles.categoryBar, { backgroundColor: theme.backgroundTertiary }]}>
                      <View
                        style={[
                          styles.categoryBarFill,
                          { width: `${percentage}%`, backgroundColor: category.color },
                        ]}
                      />
                    </View>
                  </View>
                  <ThemedText style={styles.categoryAmount}>
                    {formatCurrency(category.amount)}
                  </ThemedText>
                </View>
              );
            })}
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <ThemedText style={styles.sectionHeader}>Your Best Savings Wins</ThemedText>
          {MOCK_SAVINGS_WINS.map((win, index) => (
            <Animated.View
              key={win.id}
              entering={FadeInDown.delay(450 + index * 50).duration(400)}
            >
              <GlassCard style={styles.winCard}>
                <View style={styles.winHeader}>
                  <View style={[styles.winIcon, { backgroundColor: `${getWinColor(win.type)}20` }]}>
                    <Feather name={getWinIcon(win.type)} size={16} color={getWinColor(win.type)} />
                  </View>
                  <View style={styles.winInfo}>
                    <ThemedText style={styles.winTitle}>{win.title}</ThemedText>
                    <ThemedText style={[styles.winDescription, { color: theme.textSecondary }]}>
                      {win.description}
                    </ThemedText>
                  </View>
                  <View style={styles.winAmount}>
                    <ThemedText style={[styles.winSaved, { color: Colors.accent }]}>
                      +{formatCurrency(win.amount)}
                    </ThemedText>
                    <ThemedText style={[styles.winDate, { color: theme.textTertiary }]}>
                      {win.date}
                    </ThemedText>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
          <GlassCard style={styles.ctaCard}>
            <View style={[styles.ctaIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name="check-circle" size={24} color={Colors.accent} />
            </View>
            <ThemedText style={styles.ctaTitle}>Keep Saving</ThemedText>
            <ThemedText style={[styles.ctaDescription, { color: theme.textSecondary }]}>
              Complete your maintenance plan to maximize savings and avoid costly emergencies.
            </ThemedText>
            <PrimaryButton
              onPress={() => navigation.navigate("SurvivalKit")}
              style={styles.ctaButton}
            >
              View Maintenance Plan
            </PrimaryButton>
          </GlassCard>
        </Animated.View>

        {showInfoDrawer ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[styles.infoDrawer, { backgroundColor: theme.cardBackground }]}
          >
            <View style={styles.infoHeader}>
              <ThemedText style={styles.infoTitle}>How Savings Are Calculated</ThemedText>
              <Pressable onPress={() => setShowInfoDrawer(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              HomeBase estimates your savings by comparing your actual costs to industry averages 
              for similar homes and service needs. Savings include:
            </ThemedText>
            <View style={styles.infoList}>
              <ThemedText style={[styles.infoItem, { color: theme.textSecondary }]}>
                - Emergency costs avoided through preventive maintenance
              </ThemedText>
              <ThemedText style={[styles.infoItem, { color: theme.textSecondary }]}>
                - Discounts and seasonal promotions applied
              </ThemedText>
              <ThemedText style={[styles.infoItem, { color: theme.textSecondary }]}>
                - Optimized timing to avoid peak pricing
              </ThemedText>
            </View>
            <View style={styles.confidenceRow}>
              <ThemedText style={styles.confidenceLabel}>Confidence Level</ThemedText>
              <View style={[styles.confidenceBadge, { backgroundColor: Colors.accentLight }]}>
                <ThemedText style={[styles.confidenceText, { color: Colors.accent }]}>
                  High
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        ) : null}
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
  },
  summaryRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    flex: 1,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    ...Typography.caption1,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 2,
  },
  summarySubtext: {
    ...Typography.caption2,
  },
  breakdownCard: {
    marginBottom: Spacing.lg,
  },
  breakdownHeader: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.headline,
  },
  breakdownItems: {
    gap: Spacing.sm,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  breakdownDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56, 174, 95, 0.1)",
  },
  breakdownLabel: {
    ...Typography.subhead,
    flex: 1,
  },
  breakdownValue: {
    ...Typography.headline,
  },
  sectionHeader: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  categoryCard: {
    padding: 0,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    ...Typography.subhead,
    marginBottom: 4,
  },
  categoryBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  categoryBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  categoryAmount: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  winCard: {
    marginBottom: Spacing.sm,
  },
  winHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  winIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  winInfo: {
    flex: 1,
  },
  winTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: 2,
  },
  winDescription: {
    ...Typography.caption1,
  },
  winAmount: {
    alignItems: "flex-end",
  },
  winSaved: {
    ...Typography.headline,
  },
  winDate: {
    ...Typography.caption2,
  },
  ctaCard: {
    alignItems: "center",
    marginTop: Spacing.md,
  },
  ctaIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  ctaTitle: {
    ...Typography.title3,
    marginBottom: Spacing.xs,
  },
  ctaDescription: {
    ...Typography.subhead,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  ctaButton: {
    minWidth: 200,
  },
  infoDrawer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  infoTitle: {
    ...Typography.headline,
  },
  infoText: {
    ...Typography.subhead,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  infoList: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  infoItem: {
    ...Typography.subhead,
    lineHeight: 22,
  },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  confidenceLabel: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  confidenceBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
  },
  confidenceText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
});
