import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { FilterChips, FilterOption } from "@/components/FilterChips";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

interface Invoice {
  id: string;
  providerId: string;
  clientId: string;
  jobId?: string;
  invoiceNumber?: string;
  amount: string;
  total?: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  dueDate?: string;
  paidAt?: string;
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
  exists: boolean;
  onboardingStatus: "not_started" | "pending" | "complete";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

type InvoiceFilter = "all" | "pending" | "paid";

const filterOptions: FilterOption<InvoiceFilter>[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
];

export default function FinancesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();

  const providerId = providerProfile?.id;
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

  const { data: stripeStatus } = useQuery<StripeStatus>({
    queryKey: ["/api/stripe/connect/status", providerId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/stripe/connect/status/${providerId}`);
      if (!response.ok) throw new Error("Failed to fetch Stripe status");
      return response.json();
    },
    enabled: !!providerId,
    retry: false,
  });

  const invoices = invoicesData?.invoices || [];
  const clients = clientsData?.clients || [];
  const stats = statsData?.stats || { revenueMTD: 0, jobsCompleted: 0, activeClients: 0, upcomingJobs: 0 };
  const isConnected = stripeStatus?.chargesEnabled && stripeStatus?.payoutsEnabled;

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
      .reduce((sum, inv) => sum + parseFloat(inv.total || inv.amount || "0"), 0);
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

  const renderInvoice = ({ item, index }: { item: Invoice; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
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
            {item.invoiceNumber || formatDate(item.createdAt)}
          </ThemedText>
        </View>
        <View style={styles.invoiceRight}>
          <ThemedText style={styles.invoiceAmount}>
            ${parseFloat(item.total || item.amount || "0").toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

  const ListHeader = () => (
    <View>
      <Animated.View entering={FadeInDown.delay(50).duration(400)}>
        <GlassCard style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <ThemedText style={[styles.balanceLabel, { color: theme.textSecondary }]}>
              Revenue This Month
            </ThemedText>
            <Pressable
              style={styles.newInvoiceBtn}
              onPress={() => { Haptics.selectionAsync(); navigation.navigate("AddInvoice"); }}
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
          <View style={styles.statsRow}>
            <View style={styles.miniStat}>
              <ThemedText style={[styles.miniStatValue, { color: Colors.accent }]}>
                {stats.jobsCompleted}
              </ThemedText>
              <ThemedText style={[styles.miniStatLabel, { color: theme.textSecondary }]}>jobs done</ThemedText>
            </View>
            <View style={[styles.miniDivider, { backgroundColor: theme.separator }]} />
            <View style={styles.miniStat}>
              <ThemedText style={[styles.miniStatValue, { color: theme.textSecondary }]}>
                ${pendingAmount.toLocaleString()}
              </ThemedText>
              <ThemedText style={[styles.miniStatLabel, { color: theme.textSecondary }]}>pending</ThemedText>
            </View>
            <View style={[styles.miniDivider, { backgroundColor: theme.separator }]} />
            <View style={styles.miniStat}>
              <ThemedText style={[styles.miniStatValue, { color: theme.textSecondary }]}>
                ${stats.jobsCompleted > 0 ? Math.round(stats.revenueMTD / stats.jobsCompleted).toLocaleString() : 0}
              </ThemedText>
              <ThemedText style={[styles.miniStatLabel, { color: theme.textSecondary }]}>avg/job</ThemedText>
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      {!isConnected ? (
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Pressable
            style={[styles.stripeCtaCard, { backgroundColor: theme.cardBackground, borderColor: Colors.accent + "30" }]}
            onPress={() => navigation.navigate("StripeConnect")}
          >
            <View style={styles.stripeCtaRow}>
              <View style={[styles.stripeCtaIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="credit-card" size={18} color={Colors.accent} />
              </View>
              <View style={styles.stripeCtaText}>
                <ThemedText style={styles.stripeCtaTitle}>
                  {stripeStatus?.onboardingStatus === "pending" ? "Stripe account in review" : "Connect Stripe to get paid"}
                </ThemedText>
                <ThemedText style={[styles.stripeCtaSubtitle, { color: theme.textSecondary }]}>
                  {stripeStatus?.onboardingStatus === "pending"
                    ? "Your account is under review. Usually takes 1-2 business days."
                    : "Accept payments and send payouts directly to your bank account."}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </View>
          </Pressable>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(isConnected ? 100 : 150).duration(400)}>
        <View style={styles.invoicesHeader}>
          <ThemedText style={styles.invoicesTitle}>Invoices</ThemedText>
        </View>
        <FilterChips
          options={filterOptions}
          selected={filter}
          onSelect={(v) => { Haptics.selectionAsync(); setFilter(v); }}
          scrollable={false}
          style={styles.filterChips}
        />
      </Animated.View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredInvoices}
        renderItem={renderInvoice}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<ListHeader />}
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
                primaryAction={{
                  label: "Create Invoice",
                  onPress: () => navigation.navigate("AddInvoice"),
                }}
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  newInvoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  newInvoiceBtnText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  balanceValue: {
    ...Typography.largeTitle,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  miniStat: {
    flex: 1,
    alignItems: "center",
  },
  miniStatValue: {
    ...Typography.headline,
    fontWeight: "600",
  },
  miniStatLabel: {
    ...Typography.caption2,
    marginTop: 2,
  },
  miniDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
  },
  stripeCtaCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  stripeCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  stripeCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  stripeCtaText: {
    flex: 1,
  },
  stripeCtaTitle: {
    ...Typography.callout,
    fontWeight: "600",
    marginBottom: 2,
  },
  stripeCtaSubtitle: {
    ...Typography.footnote,
    lineHeight: 18,
  },
  invoicesHeader: {
    marginBottom: Spacing.sm,
  },
  invoicesTitle: {
    ...Typography.title3,
    fontWeight: "600",
  },
  filterChips: {
    marginBottom: Spacing.sm,
  },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  invoiceIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceClient: {
    ...Typography.callout,
    fontWeight: "600",
    marginBottom: 2,
  },
  invoiceDate: {
    ...Typography.caption1,
  },
  invoiceRight: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  invoiceAmount: {
    ...Typography.callout,
    fontWeight: "700",
  },
  loadingRow: {
    paddingVertical: Spacing.xl * 2,
    alignItems: "center",
  },
  emptyContainer: {
    paddingTop: Spacing.xl,
  },
});
