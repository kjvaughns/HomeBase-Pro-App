import React, { useState, useMemo } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { FilterChips, FilterOption } from "@/components/FilterChips";
import { PrimaryButton } from "@/components/PrimaryButton";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";

interface Invoice {
  id: string;
  providerId: string;
  clientId: string;
  jobId?: string;
  amount: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  dueDate?: string;
  paidDate?: string;
  notes?: string;
  createdAt: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

interface ProviderStats {
  revenueMTD: number;
  jobsCompleted: number;
  activeClients: number;
  upcomingJobs: number;
}

type InvoiceFilter = "all" | "pending" | "paid";

const filterOptions: FilterOption<InvoiceFilter>[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
];

export default function MoneyScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();

  const providerId = providerProfile?.id;

  const { data: invoicesData, isLoading, refetch } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["/api/provider", providerId, "invoices"],
    enabled: !!providerId,
  });

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const { data: statsData } = useQuery<{ stats: ProviderStats }>({
    queryKey: ["/api/provider", providerId, "stats"],
    enabled: !!providerId,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<InvoiceFilter>("all");

  // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing; cleanup tracked in Task #107
  const invoices = invoicesData?.invoices || [];
  const clients = clientsData?.clients || [];
  const stats = statsData?.stats || { revenueMTD: 0, jobsCompleted: 0, activeClients: 0, upcomingJobs: 0 };

  const getClientName = (clientId: string): string => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      return `${client.firstName} ${client.lastName}`;
    }
    return "Unknown Client";
  };

  const filteredInvoices = useMemo(() => {
    let filtered = invoices;
    
    if (filter === "pending") {
      filtered = invoices.filter((inv) => inv.status === "sent" || inv.status === "draft" || inv.status === "overdue");
    } else if (filter === "paid") {
      filtered = invoices.filter((inv) => inv.status === "paid");
    }

    return filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [invoices, filter]);

  const pendingAmount = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === "sent" || inv.status === "overdue")
      .reduce((sum, inv) => sum + parseFloat(inv.amount || "0"), 0);
  }, [invoices]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleWithdraw = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCreateInvoice = () => {
    navigation.navigate("AddInvoice");
  };

  const handleInvoicePress = (invoice: Invoice) => {
    navigation.navigate("InvoiceDetail", { invoiceId: invoice.id });
  };

  const getInvoiceStatusType = (status: Invoice["status"]): "success" | "warning" | "info" | "neutral" => {
    switch (status) {
      case "paid": return "success";
      case "sent": return "info";
      case "overdue": return "warning";
      case "draft": return "neutral";
      case "cancelled": return "neutral";
      default: return "neutral";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleStripeConnect = () => {
    navigation.navigate("StripeConnect");
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Animated.View entering={FadeInDown.delay(50).duration(400)}>
        <Pressable 
          style={[styles.stripeButton, { backgroundColor: theme.cardBackground }]}
          onPress={handleStripeConnect}
        >
          <View style={[styles.stripeIcon, { backgroundColor: Colors.accent + "20" }]}>
            <Feather name="credit-card" size={18} color={Colors.accent} />
          </View>
          <View style={styles.stripeInfo}>
            <ThemedText style={{ fontWeight: "600" }}>Stripe Payments</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Test invoices and Connect onboarding
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <GlassCard style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Revenue This Month
            </ThemedText>
            <Pressable 
              style={styles.addButton}
              onPress={handleCreateInvoice}
            >
              <Feather name="plus" size={16} color={Colors.accent} />
              <ThemedText type="label" style={{ color: Colors.accent }}>
                New Invoice
              </ThemedText>
            </Pressable>
          </View>

          <ThemedText type="display" style={styles.balance}>
            ${stats.revenueMTD.toLocaleString()}
          </ThemedText>

          <View style={styles.pendingRow}>
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              ${pendingAmount.toLocaleString()} pending
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
          <ThemedText type="h3">{stats.jobsCompleted}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Jobs this month
          </ThemedText>
        </GlassCard>

        <GlassCard style={styles.statCard}>
          <View style={styles.statIcon}>
            <Feather name="dollar-sign" size={20} color={Colors.accent} />
          </View>
          <ThemedText type="h3">
            ${stats.jobsCompleted > 0 ? Math.round(stats.revenueMTD / stats.jobsCompleted) : 0}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Avg per job
          </ThemedText>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Invoices
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

  const renderInvoice = ({ item, index }: { item: Invoice; index: number }) => {
    return (
      <Animated.View entering={FadeInDown.delay(400 + index * 50).duration(300)}>
        <Pressable 
          style={[styles.transactionCard, { backgroundColor: theme.cardBackground }]}
          onPress={() => handleInvoicePress(item)}
        >
          <View style={[styles.transactionIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name="file-text" size={18} color={Colors.accent} />
          </View>
          <View style={styles.transactionInfo}>
            <ThemedText style={styles.transactionTitle}>
              {getClientName(item.clientId)}
            </ThemedText>
            <ThemedText style={[styles.transactionSubtitle, { color: theme.textSecondary }]}>
              {formatDate(item.createdAt)}
            </ThemedText>
          </View>
          <View style={styles.transactionRight}>
            <ThemedText style={styles.transactionAmount}>
              ${parseFloat(item.amount || "0").toLocaleString()}
            </ThemedText>
            <StatusPill
              status={getInvoiceStatusType(item.status)}
              label={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            />
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredInvoices}
        renderItem={renderInvoice}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <EmptyState
              image={require("../../../assets/images/empty-bookings.png")}
              title="No invoices yet"
              description="Create your first invoice to start tracking payments."
            />
          </View>
        }
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContainer: {
    marginBottom: Spacing.md,
  },
  stripeButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    marginBottom: Spacing.md,
  },
  stripeIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.iconContainer,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  stripeInfo: {
    flex: 1,
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
  addButton: {
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
  emptyContainer: {
    paddingVertical: Spacing.xl,
  },
});
