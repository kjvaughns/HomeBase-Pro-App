import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
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
import { ListRow } from "@/components/ListRow";
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

interface StripeStatus {
  status: "not_started" | "pending" | "complete" | "restricted";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountId?: string;
}

type InvoiceFilter = "all" | "pending" | "paid";
type ActiveTab = "invoices" | "account";

const filterOptions: FilterOption<InvoiceFilter>[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
];

export default function FinancesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();

  const providerId = providerProfile?.id;
  const [activeTab, setActiveTab] = useState<ActiveTab>("invoices");
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

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

  const { data: stripeData } = useQuery<{ connectStatus: StripeStatus }>({
    queryKey: ["/api/stripe/connect/status"],
    enabled: !!providerId,
    retry: false,
  });

  const invoices = invoicesData?.invoices || [];
  const clients = clientsData?.clients || [];
  const stats = statsData?.stats || { revenueMTD: 0, jobsCompleted: 0, activeClients: 0, upcomingJobs: 0 };
  const connectStatus = stripeData?.connectStatus;
  const isConnected = connectStatus?.chargesEnabled && connectStatus?.payoutsEnabled;
  const isPending = connectStatus?.status === "pending";

  const getClientName = (clientId: string): string => {
    const client = clients.find((c) => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : "Unknown Client";
  };

  const filteredInvoices = useMemo(() => {
    let filtered = invoices;
    if (filter === "pending") {
      filtered = invoices.filter((inv) => inv.status === "sent" || inv.status === "draft" || inv.status === "overdue");
    } else if (filter === "paid") {
      filtered = invoices.filter((inv) => inv.status === "paid");
    }
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  const getInvoiceStatusType = (status: Invoice["status"]): "success" | "warning" | "info" | "neutral" => {
    switch (status) {
      case "paid": return "success";
      case "sent": return "info";
      case "overdue": return "warning";
      default: return "neutral";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getStripeStatusPill = () => {
    if (!connectStatus || connectStatus.status === "not_started") {
      return <StatusPill status="warning" label="Not Connected" size="small" />;
    }
    if (isConnected) return <StatusPill status="success" label="Active" size="small" />;
    if (isPending) return <StatusPill status="warning" label="In Review" size="small" />;
    return <StatusPill status="error" label="Restricted" size="small" />;
  };

  const getStripeDescription = () => {
    if (!connectStatus || connectStatus.status === "not_started") {
      return "Connect your Stripe account to receive direct client payments, manage invoices, and get paid faster.";
    }
    if (isConnected) return "Your Stripe account is fully set up. You can receive payments and send payouts.";
    if (isPending) return "Your account is under review. This usually takes 1-2 business days.";
    return "Some features are restricted. Complete your Stripe onboarding to resolve this.";
  };

  const renderSegment = () => (
    <View style={[styles.segmentContainer, { backgroundColor: theme.backgroundSecondary }]}>
      <Pressable
        style={[styles.segment, activeTab === "invoices" && { backgroundColor: theme.cardBackground }]}
        onPress={() => { Haptics.selectionAsync(); setActiveTab("invoices"); }}
      >
        <Feather name="file-text" size={14} color={activeTab === "invoices" ? Colors.accent : theme.textSecondary} style={{ marginRight: 6 }} />
        <ThemedText style={[styles.segmentText, { color: activeTab === "invoices" ? Colors.accent : theme.textSecondary }]}>
          Invoices
        </ThemedText>
      </Pressable>
      <Pressable
        style={[styles.segment, activeTab === "account" && { backgroundColor: theme.cardBackground }]}
        onPress={() => { Haptics.selectionAsync(); setActiveTab("account"); }}
      >
        <Feather name="credit-card" size={14} color={activeTab === "account" ? Colors.accent : theme.textSecondary} style={{ marginRight: 6 }} />
        <ThemedText style={[styles.segmentText, { color: activeTab === "account" ? Colors.accent : theme.textSecondary }]}>
          Account
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderInvoicesHeader = () => (
    <View style={styles.headerContainer}>
      <Animated.View entering={FadeInDown.delay(50).duration(400)}>
        <GlassCard style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <ThemedText style={[styles.balanceLabel, { color: theme.textSecondary }]}>
              Revenue This Month
            </ThemedText>
            <Pressable
              style={styles.newInvoiceBtn}
              onPress={() => navigation.navigate("AddInvoice")}
            >
              <Feather name="plus" size={14} color={Colors.accent} />
              <ThemedText style={[styles.newInvoiceBtnText, { color: Colors.accent }]}>
                New Invoice
              </ThemedText>
            </Pressable>
          </View>
          <ThemedText style={styles.balanceValue}>
            ${stats.revenueMTD.toLocaleString()}
          </ThemedText>
          <View style={styles.pendingRow}>
            <Feather name="clock" size={13} color={theme.textTertiary} />
            <ThemedText style={[styles.pendingText, { color: theme.textTertiary }]}>
              ${pendingAmount.toLocaleString()} pending
            </ThemedText>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsRow}>
        <GlassCard style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name="trending-up" size={18} color={Colors.accent} />
          </View>
          <ThemedText style={styles.statValue}>{stats.jobsCompleted}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Jobs done</ThemedText>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name="dollar-sign" size={18} color={Colors.accent} />
          </View>
          <ThemedText style={styles.statValue}>
            ${stats.jobsCompleted > 0 ? Math.round(stats.revenueMTD / stats.jobsCompleted) : 0}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Avg per job</ThemedText>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(400)}>
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

  const renderInvoice = ({ item, index }: { item: Invoice; index: number }) => (
    <Animated.View entering={FadeInDown.delay(200 + index * 40).duration(300)}>
      <Pressable
        style={[styles.invoiceRow, { backgroundColor: theme.cardBackground }]}
        onPress={() => navigation.navigate("InvoiceDetail", { invoiceId: item.id })}
        testID={`invoice-${item.id}`}
      >
        <View style={[styles.invoiceIcon, { backgroundColor: Colors.accentLight }]}>
          <Feather name="file-text" size={16} color={Colors.accent} />
        </View>
        <View style={styles.invoiceInfo}>
          <ThemedText style={styles.invoiceClient}>{getClientName(item.clientId)}</ThemedText>
          <ThemedText style={[styles.invoiceDate, { color: theme.textSecondary }]}>
            {formatDate(item.createdAt)}
          </ThemedText>
        </View>
        <View style={styles.invoiceRight}>
          <ThemedText style={styles.invoiceAmount}>
            ${parseFloat(item.amount || "0").toLocaleString()}
          </ThemedText>
          <StatusPill
            status={getInvoiceStatusType(item.status)}
            label={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            size="small"
          />
        </View>
      </Pressable>
    </Animated.View>
  );

  const renderAccountTab = () => (
    <ScrollView
      contentContainerStyle={[styles.accountContent, { paddingBottom: tabBarHeight + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.delay(50).duration(300)}>
        <GlassCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Feather name="zap" size={16} color={Colors.accent} />
              <ThemedText style={styles.sectionTitle}>Stripe Connect</ThemedText>
            </View>
            {getStripeStatusPill()}
          </View>
          <ThemedText style={[styles.sectionDesc, { color: theme.textSecondary }]}>
            {getStripeDescription()}
          </ThemedText>
          {isConnected ? (
            <View style={styles.connectedRow}>
              <View style={[styles.connectedBadge, { backgroundColor: Colors.accentLight }]}>
                <Feather name="check-circle" size={14} color={Colors.accent} />
                <ThemedText style={[styles.connectedText, { color: Colors.accent }]}>Payments enabled</ThemedText>
              </View>
              <View style={[styles.connectedBadge, { backgroundColor: Colors.accentLight }]}>
                <Feather name="send" size={14} color={Colors.accent} />
                <ThemedText style={[styles.connectedText, { color: Colors.accent }]}>Payouts enabled</ThemedText>
              </View>
            </View>
          ) : null}
          <View style={[styles.menuSection, { backgroundColor: theme.backgroundSecondary }]}>
            <ListRow
              title="Stripe Account Setup"
              subtitle="Onboarding, identity, bank account"
              leftIcon="credit-card"
              onPress={() => navigation.navigate("StripeConnect")}
              isFirst
              isLast
            />
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(300)}>
        <GlassCard style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Feather name="file-plus" size={16} color={Colors.accent} />
            <ThemedText style={styles.sectionTitle}>Invoicing</ThemedText>
          </View>
          <ThemedText style={[styles.sectionDesc, { color: theme.textSecondary }]}>
            Create professional invoices, send them directly to clients, and track payment status.
          </ThemedText>
          <View style={[styles.menuSection, { backgroundColor: theme.backgroundSecondary }]}>
            <ListRow
              title="Create Invoice"
              subtitle="Bill clients with itemized invoices"
              leftIcon="file-plus"
              onPress={() => navigation.navigate("AddInvoice")}
              isFirst
            />
            <ListRow
              title="Invoice History"
              subtitle="View and manage all invoices"
              leftIcon="list"
              onPress={() => setActiveTab("invoices")}
              isLast
            />
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(300)}>
        <GlassCard style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Feather name="trending-up" size={16} color={Colors.accent} />
            <ThemedText style={styles.sectionTitle}>Earnings</ThemedText>
          </View>
          <ThemedText style={[styles.sectionDesc, { color: theme.textSecondary }]}>
            Track revenue, monitor trends, and understand your business performance.
          </ThemedText>
          <View style={[styles.menuSection, { backgroundColor: theme.backgroundSecondary }]}>
            <ListRow
              title="Payout History"
              subtitle="View all payouts to your bank account"
              leftIcon="send"
              onPress={() => navigation.navigate("StripeConnect")}
              isFirst
            />
            <ListRow
              title="Platform Credits"
              subtitle="Credits earned and applied"
              leftIcon="gift"
              onPress={() => navigation.navigate("StripeConnect")}
              isLast
            />
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(300)}>
        <View style={[styles.infoBox, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="lock" size={13} color={Colors.accent} />
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            All financial data is encrypted and secured by Stripe. HomeBase never stores your banking credentials.
          </ThemedText>
        </View>
      </Animated.View>
    </ScrollView>
  );

  return (
    <ThemedView style={styles.container}>
      {activeTab === "invoices" ? (
        <FlatList
          data={filteredInvoices}
          renderItem={renderInvoice}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View>
              {renderSegment()}
              {renderInvoicesHeader()}
            </View>
          }
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <EmptyState
                  image={require("../../../assets/images/empty-bookings.png")}
                  title="No invoices yet"
                  description="Create your first invoice to start tracking payments."
                />
              </View>
            )
          }
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
          }}
          scrollIndicatorInsets={{ bottom: insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.md,
            paddingHorizontal: Spacing.screenPadding,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
        >
          {renderSegment()}
          {renderAccountTab()}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentContainer: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 3,
    marginBottom: Spacing.lg,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  segmentText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  headerContainer: {
    marginBottom: Spacing.sm,
  },
  balanceCard: {
    marginBottom: Spacing.md,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  balanceLabel: {
    ...Typography.subhead,
  },
  balanceValue: {
    ...Typography.largeTitle,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  newInvoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  newInvoiceBtnText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pendingText: {
    ...Typography.caption1,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  statValue: {
    ...Typography.headline,
    marginBottom: 2,
  },
  statLabel: {
    ...Typography.caption2,
  },
  filterChips: {
    marginBottom: Spacing.sm,
  },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    marginBottom: Spacing.sm,
  },
  invoiceIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.iconContainer,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  invoiceInfo: { flex: 1 },
  invoiceClient: {
    ...Typography.body,
    fontWeight: "500",
  },
  invoiceDate: {
    ...Typography.caption1,
    marginTop: 2,
  },
  invoiceRight: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  invoiceAmount: {
    ...Typography.body,
    fontWeight: "600",
  },
  loadingRow: {
    paddingVertical: Spacing["2xl"],
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: Spacing.xl,
  },
  accountContent: {},
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.headline,
  },
  sectionDesc: {
    ...Typography.body,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  connectedRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
    marginBottom: Spacing.md,
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  connectedText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  menuSection: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoText: {
    ...Typography.caption1,
    flex: 1,
    lineHeight: 18,
  },
});
