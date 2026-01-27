import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";

interface BudgetCategory {
  id: string;
  name: string;
  icon: keyof typeof Feather.glyphMap;
  budgeted: number;
  spent: number;
  color: string;
}

interface Transaction {
  id: string;
  categoryId: string;
  description: string;
  amount: number;
  date: string;
}

const BUDGET_CATEGORIES: BudgetCategory[] = [
  { id: "repairs", name: "Repairs", icon: "tool", budgeted: 500, spent: 350, color: Colors.accent },
  { id: "utilities", name: "Utilities", icon: "zap", budgeted: 400, spent: 380, color: "#3B82F6" },
  { id: "landscaping", name: "Landscaping", icon: "sun", budgeted: 200, spent: 150, color: "#10B981" },
  { id: "cleaning", name: "Cleaning", icon: "home", budgeted: 300, spent: 180, color: "#8B5CF6" },
  { id: "upgrades", name: "Upgrades", icon: "trending-up", budgeted: 600, spent: 0, color: "#F59E0B" },
  { id: "emergency", name: "Emergency Fund", icon: "shield", budgeted: 500, spent: 0, color: "#EF4444" },
];

const RECENT_TRANSACTIONS: Transaction[] = [
  { id: "t1", categoryId: "repairs", description: "Plumber - faucet repair", amount: 150, date: "Jan 25" },
  { id: "t2", categoryId: "utilities", description: "Electric bill", amount: 185, date: "Jan 22" },
  { id: "t3", categoryId: "repairs", description: "Door lock replacement", amount: 85, date: "Jan 20" },
  { id: "t4", categoryId: "landscaping", description: "Lawn service", amount: 75, date: "Jan 18" },
  { id: "t5", categoryId: "cleaning", description: "Deep cleaning service", amount: 180, date: "Jan 15" },
  { id: "t6", categoryId: "utilities", description: "Water bill", amount: 95, date: "Jan 12" },
  { id: "t7", categoryId: "repairs", description: "HVAC filter replacement", amount: 45, date: "Jan 10" },
  { id: "t8", categoryId: "utilities", description: "Gas bill", amount: 100, date: "Jan 8" },
];

export default function BudgeterScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const totalBudgeted = BUDGET_CATEGORIES.reduce((acc, cat) => acc + cat.budgeted, 0);
  const totalSpent = BUDGET_CATEGORIES.reduce((acc, cat) => acc + cat.spent, 0);
  const remaining = totalBudgeted - totalSpent;
  const spentPercent = Math.round((totalSpent / totalBudgeted) * 100);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getCategoryById = (id: string) => {
    return BUDGET_CATEGORIES.find((cat) => cat.id === id);
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
          <GlassCard style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <ThemedText style={styles.summaryTitle}>Monthly Budget</ThemedText>
              <ThemedText style={[styles.monthLabel, { color: theme.textSecondary }]}>
                January 2026
              </ThemedText>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Budgeted
                </ThemedText>
                <ThemedText style={styles.summaryValue}>{formatCurrency(totalBudgeted)}</ThemedText>
              </View>
              <View style={styles.summaryItem}>
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Spent
                </ThemedText>
                <ThemedText style={styles.summaryValue}>{formatCurrency(totalSpent)}</ThemedText>
              </View>
              <View style={styles.summaryItem}>
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Remaining
                </ThemedText>
                <ThemedText style={[styles.summaryValue, { color: Colors.accent }]}>
                  {formatCurrency(remaining)}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.progressBar, { backgroundColor: theme.backgroundTertiary }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(spentPercent, 100)}%`,
                    backgroundColor: spentPercent > 90 ? Colors.error : Colors.accent,
                  },
                ]}
              />
            </View>
            <ThemedText style={[styles.progressLabel, { color: theme.textSecondary }]}>
              {spentPercent}% of budget used
            </ThemedText>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <ThemedText style={styles.sectionTitle}>Categories</ThemedText>
        </Animated.View>

        <View style={styles.categoriesGrid}>
          {BUDGET_CATEGORIES.map((category, index) => {
            const percent = Math.round((category.spent / category.budgeted) * 100);
            return (
              <Animated.View
                key={category.id}
                entering={FadeInDown.delay(300 + index * 50).duration(400)}
                style={styles.categoryWrapper}
              >
                <GlassCard style={styles.categoryCard}>
                  <View style={styles.categoryHeader}>
                    <View
                      style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}
                    >
                      <Feather name={category.icon} size={18} color={category.color} />
                    </View>
                    <ThemedText style={styles.categoryName}>{category.name}</ThemedText>
                  </View>
                  <View style={styles.categoryAmounts}>
                    <ThemedText style={styles.categorySpent}>
                      {formatCurrency(category.spent)}
                    </ThemedText>
                    <ThemedText style={[styles.categoryBudgeted, { color: theme.textSecondary }]}>
                      / {formatCurrency(category.budgeted)}
                    </ThemedText>
                  </View>
                  <View
                    style={[styles.categoryProgress, { backgroundColor: theme.backgroundTertiary }]}
                  >
                    <View
                      style={[
                        styles.categoryProgressFill,
                        {
                          width: `${Math.min(percent, 100)}%`,
                          backgroundColor: percent > 90 ? Colors.error : category.color,
                        },
                      ]}
                    />
                  </View>
                </GlassCard>
              </Animated.View>
            );
          })}
        </View>

        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
          <ThemedText style={styles.sectionTitle}>Recent Transactions</ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(700).duration(400)}>
          <GlassCard style={styles.transactionsCard}>
            {RECENT_TRANSACTIONS.map((transaction, index) => {
              const category = getCategoryById(transaction.categoryId);
              return (
                <View
                  key={transaction.id}
                  style={[
                    styles.transactionRow,
                    index < RECENT_TRANSACTIONS.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.separator,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.transactionIcon,
                      { backgroundColor: category ? `${category.color}20` : Colors.accentLight },
                    ]}
                  >
                    <Feather
                      name={category?.icon || "dollar-sign"}
                      size={16}
                      color={category?.color || Colors.accent}
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <ThemedText style={styles.transactionDesc}>
                      {transaction.description}
                    </ThemedText>
                    <ThemedText style={[styles.transactionDate, { color: theme.textSecondary }]}>
                      {transaction.date}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.transactionAmount}>
                    -{formatCurrency(transaction.amount)}
                  </ThemedText>
                </View>
              );
            })}
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
  },
  summaryCard: {
    marginBottom: Spacing.sectionGap,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    ...Typography.headline,
  },
  monthLabel: {
    ...Typography.subhead,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryLabel: {
    ...Typography.caption1,
    marginBottom: 2,
  },
  summaryValue: {
    ...Typography.headline,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressLabel: {
    ...Typography.caption1,
    textAlign: "center",
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.sectionGap,
  },
  categoryWrapper: {
    width: "47%",
  },
  categoryCard: {
    padding: Spacing.md,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  categoryName: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  categoryAmounts: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: Spacing.xs,
  },
  categorySpent: {
    ...Typography.headline,
  },
  categoryBudgeted: {
    ...Typography.footnote,
    marginLeft: 2,
  },
  categoryProgress: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  categoryProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  transactionsCard: {
    padding: 0,
    overflow: "hidden",
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDesc: {
    ...Typography.subhead,
    marginBottom: 2,
  },
  transactionDate: {
    ...Typography.caption1,
  },
  transactionAmount: {
    ...Typography.subhead,
    fontWeight: "600",
  },
});
