import React, { useState } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { SectionHeader } from "@/components/SectionHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { providerStats, mockEarnings, Earning } from "@/state/mockData";

export default function MoneyScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getStatusType = (status: Earning["status"]) => {
    switch (status) {
      case "paid":
        return "success";
      case "processing":
        return "pending";
      case "pending":
        return "info";
      default:
        return "neutral";
    }
  };

  const renderHeader = () => (
    <>
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <GlassCard style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Available Balance
            </ThemedText>
            <Pressable style={styles.historyButton}>
              <Feather name="clock" size={16} color={Colors.accent} />
              <ThemedText type="label" style={{ color: Colors.accent }}>
                History
              </ThemedText>
            </Pressable>
          </View>

          <ThemedText type="display" style={styles.balance}>
            ${providerStats.totalEarnings.toLocaleString()}
          </ThemedText>

          <View style={styles.pendingRow}>
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              ${providerStats.pendingEarnings} pending
            </ThemedText>
          </View>

          <PrimaryButton onPress={() => {}} style={styles.withdrawButton}>
            Withdraw Funds
          </PrimaryButton>
        </GlassCard>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(200).duration(400)}
        style={styles.statsRow}
      >
        <GlassCard style={styles.statCard}>
          <View style={styles.statIcon}>
            <Feather name="trending-up" size={20} color={Colors.accent} />
          </View>
          <ThemedText type="h3">{providerStats.completedJobs}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Jobs this month
          </ThemedText>
        </GlassCard>

        <GlassCard style={styles.statCard}>
          <View style={styles.statIcon}>
            <Feather name="dollar-sign" size={20} color={Colors.accent} />
          </View>
          <ThemedText type="h3">
            ${Math.round(providerStats.totalEarnings / providerStats.completedJobs)}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Avg per job
          </ThemedText>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <SectionHeader title="Recent Transactions" />
      </Animated.View>
    </>
  );

  const renderEarning = ({ item, index }: { item: Earning; index: number }) => (
    <Animated.View entering={FadeInDown.delay(400 + index * 100).duration(400)}>
      <Pressable
        style={({ pressed }) => [
          styles.transactionRow,
          {
            backgroundColor: pressed ? theme.backgroundDefault : "transparent",
          },
        ]}
      >
        <View style={styles.transactionInfo}>
          <ThemedText type="h4">{item.service}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {item.customerName} · {new Date(item.date).toLocaleDateString()}
          </ThemedText>
        </View>

        <View style={styles.transactionAmount}>
          <ThemedText
            type="h4"
            style={{ color: item.status === "paid" ? Colors.accent : theme.text }}
          >
            ${item.amount}
          </ThemedText>
          <StatusPill status={getStatusType(item.status)} label={item.status} />
        </View>
      </Pressable>
      {index < mockEarnings.length - 1 ? (
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
      ) : null}
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={mockEarnings}
        renderItem={renderEarning}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  balanceCard: {
    marginBottom: Spacing.lg,
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  balance: {
    marginBottom: Spacing.xs,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  withdrawButton: {
    marginTop: Spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${Colors.accent}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
  },
  transactionInfo: {
    flex: 1,
    gap: 2,
  },
  transactionAmount: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  divider: {
    height: 1,
  },
});
