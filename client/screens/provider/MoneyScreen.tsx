import React, { useState, useMemo } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { FilterChips, FilterOption } from "@/components/FilterChips";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useProviderStore, Invoice, Payout } from "@/state/providerStore";

type TransactionFilter = "all" | "invoices" | "payouts";

const filterOptions: FilterOption<TransactionFilter>[] = [
  { key: "all", label: "All" },
  { key: "invoices", label: "Invoices" },
  { key: "payouts", label: "Payouts" },
];

type TransactionItem = 
  | { type: "invoice"; data: Invoice }
  | { type: "payout"; data: Payout };

export default function MoneyScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const invoices = useProviderStore((s) => s.invoices);
  const payouts = useProviderStore((s) => s.payouts);
  const getStats = useProviderStore((s) => s.getStats);

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<TransactionFilter>("all");

  const stats = useMemo(() => getStats(), [invoices, payouts]);

  const transactions = useMemo(() => {
    const items: TransactionItem[] = [];
    
    if (filter === "all" || filter === "invoices") {
      invoices.forEach((inv) => items.push({ type: "invoice", data: inv }));
    }
    if (filter === "all" || filter === "payouts") {
      payouts.forEach((p) => items.push({ type: "payout", data: p }));
    }

    return items.sort((a, b) => {
      const dateA = a.type === "invoice" ? a.data.date : a.data.requestedAt;
      const dateB = b.type === "invoice" ? b.data.date : b.data.requestedAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [invoices, payouts, filter]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleWithdraw = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getInvoiceStatusType = (status: Invoice["status"]) => {
    switch (status) {
      case "paid": return "success";
      case "sent": return "pending";
      case "overdue": return "error";
      case "draft": return "neutral";
      default: return "neutral";
    }
  };

  const getPayoutStatusType = (status: Payout["status"]) => {
    switch (status) {
      case "completed": return "success";
      case "processing": return "pending";
      case "pending": return "info";
      case "failed": return "error";
      default: return "neutral";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
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
            ${stats.availableBalance.toLocaleString()}
          </ThemedText>

          <View style={styles.pendingRow}>
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              ${stats.pendingEarnings.toLocaleString()} pending
            </ThemedText>
          </View>

          <PrimaryButton onPress={handleWithdraw} style={styles.withdrawButton}>
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
          <ThemedText type="h3">{stats.completedJobs}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Jobs this month
          </ThemedText>
        </GlassCard>

        <GlassCard style={styles.statCard}>
          <View style={styles.statIcon}>
            <Feather name="dollar-sign" size={20} color={Colors.accent} />
          </View>
          <ThemedText type="h3">
            ${stats.completedJobs > 0 ? Math.round(stats.totalEarnings / stats.completedJobs) : 0}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Avg per job
          </ThemedText>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Transactions
        </ThemedText>
        <FilterChips
          options={filterOptions}
          selected={filter}
          onSelect={setFilter}
          scrollable={false}
          style={styles.filterChips}
        />
      </Animated.View>
    </View>
  );

  const renderTransaction = ({ item, index }: { item: TransactionItem; index: number }) => {
    if (item.type === "invoice") {
      const inv = item.data;
      return (
        <Animated.View entering={FadeInDown.delay(400 + index * 50).duration(300)}>
          <Pressable style={[styles.transactionCard, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.transactionIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name="file-text" size={18} color={Colors.accent} />
            </View>
            <View style={styles.transactionInfo}>
              <ThemedText style={styles.transactionTitle}>{inv.customerName}</ThemedText>
              <ThemedText style={[styles.transactionSubtitle, { color: theme.textSecondary }]}>
                {inv.service}
              </ThemedText>
            </View>
            <View style={styles.transactionRight}>
              <ThemedText style={styles.transactionAmount}>
                ${inv.amount.toLocaleString()}
              </ThemedText>
              <StatusPill
                status={getInvoiceStatusType(inv.status)}
                label={inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                size="small"
              />
            </View>
          </Pressable>
        </Animated.View>
      );
    }

    const payout = item.data;
    return (
      <Animated.View entering={FadeInDown.delay(400 + index * 50).duration(300)}>
        <Pressable style={[styles.transactionCard, { backgroundColor: theme.cardBackground }]}>
          <View style={[styles.transactionIcon, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="arrow-up-right" size={18} color={theme.text} />
          </View>
          <View style={styles.transactionInfo}>
            <ThemedText style={styles.transactionTitle}>Payout</ThemedText>
            <ThemedText style={[styles.transactionSubtitle, { color: theme.textSecondary }]}>
              To bank ***{payout.bankLast4}
            </ThemedText>
          </View>
          <View style={styles.transactionRight}>
            <ThemedText style={[styles.transactionAmount, { color: theme.textSecondary }]}>
              -${payout.amount.toLocaleString()}
            </ThemedText>
            <StatusPill
              status={getPayoutStatusType(payout.status)}
              label={payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
              size="small"
            />
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item, index) => `${item.type}-${item.type === "invoice" ? item.data.id : item.data.id}-${index}`}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
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
  headerContainer: {
    marginBottom: Spacing.md,
  },
  balanceCard: {
    marginBottom: Spacing.lg,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    marginBottom: Spacing.sectionGap,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.iconContainer,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.footnote,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  filterChips: {
    marginBottom: Spacing.md,
  },
  transactionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    marginBottom: Spacing.sm,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.iconContainer,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    ...Typography.body,
    fontWeight: "500",
  },
  transactionSubtitle: {
    ...Typography.caption1,
    marginTop: 2,
  },
  transactionRight: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  transactionAmount: {
    ...Typography.body,
    fontWeight: "600",
  },
});
