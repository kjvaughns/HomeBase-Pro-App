import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getAuthHeaders, getApiUrl } from "@/lib/query-client";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill, StatusType } from "@/components/StatusPill";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface StripePayout {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  arrivalDate: string | null;
  description: string | null;
  createdAt: string;
  bankLast4: string | null;
}

interface StripePayment {
  chargeId: string;
  amountCents: number;
  currency: string;
  status: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  clientName: string | null;
  createdAt: string;
  refunded: boolean;
}

interface StripeRefund {
  refundId: string;
  chargeId: string | null;
  amountCents: number;
  originalAmountCents: number | null;
  currency: string;
  reason: string | null;
  status: string;
  createdAt: string;
}

interface ProviderInvoice {
  id: string;
  providerId: string;
  clientId: string | null;
  invoiceNumber: string | null;
  total: string | null;
  totalCents: number | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

interface ProviderClient {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

type TabKey = "payouts" | "payments" | "refunds";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatArrivalDate(iso: string | null): string {
  if (!iso) return "Pending";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function payoutStatusType(status: string): StatusType {
  switch (status) {
    case "paid": return "success";
    case "in_transit": return "info";
    case "pending": return "pending";
    case "failed":
    case "canceled":
    case "cancelled": return "error";
    default: return "neutral";
  }
}

function payoutStatusLabel(status: string): string {
  if (status === "in_transit") return "In Transit";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function paymentStatusType(status: string, refunded: boolean): StatusType {
  if (refunded) return "error";
  switch (status) {
    case "succeeded": return "success";
    case "pending": return "pending";
    case "failed": return "error";
    default: return "neutral";
  }
}

function paymentStatusLabel(status: string, refunded: boolean): string {
  if (refunded) return "Refunded";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function refundStatusType(status: string): StatusType {
  switch (status) {
    case "succeeded": return "success";
    case "pending": return "pending";
    case "failed": return "error";
    case "canceled": return "neutral";
    default: return "neutral";
  }
}

function formatRefundReason(reason: string | null): string {
  if (!reason) return "Refunded";
  return reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function invoiceStatusType(status: string): StatusType {
  switch (status) {
    case "overdue": return "error";
    case "sent": return "pending";
    case "viewed": return "info";
    case "partially_paid": return "warning";
    default: return "neutral";
  }
}

function invoiceStatusLabel(status: string): string {
  if (status === "partially_paid") return "Partial";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatInvoiceAmount(invoice: ProviderInvoice): string {
  if (invoice.totalCents != null && invoice.totalCents > 0) {
    return formatCents(invoice.totalCents);
  }
  const num = parseFloat(invoice.total ?? "0");
  return isNaN(num) ? "$0.00" : `$${num.toFixed(2)}`;
}

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return "No due date";
  const d = new Date(dueDate);
  const now = new Date();
  const isOverdue = d < now;
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return isOverdue ? `Overdue ${label}` : `Due ${label}`;
}

// ─── Skeleton Loading ─────────────────────────────────────────────────────────

function SkeletonRow({ theme }: { theme: ReturnType<typeof useTheme>["theme"] }) {
  return (
    <View style={[styles.row, { backgroundColor: theme.cardBackground }]}>
      <View style={[styles.skeletonIcon, { backgroundColor: theme.separator }]} />
      <View style={styles.rowInfo}>
        <View style={[styles.skeletonLine, { backgroundColor: theme.separator, width: "50%" }]} />
        <View style={[styles.skeletonLine, { backgroundColor: theme.separator, width: "35%", marginTop: 6 }]} />
      </View>
      <View style={styles.rowRight}>
        <View style={[styles.skeletonLine, { backgroundColor: theme.separator, width: 64 }]} />
        <View style={[styles.skeletonPill, { backgroundColor: theme.separator }]} />
      </View>
    </View>
  );
}

const SKELETON_KEYS = ["sk1", "sk2", "sk3", "sk4", "sk5"];

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function FinancesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();

  const providerId = providerProfile?.id ?? "";
  const [activeTab, setActiveTab] = useState<TabKey>("payouts");
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Refetch outstanding invoices whenever this tab comes into focus
  useFocusEffect(
    useCallback(() => {
      if (providerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "invoices"] });
      }
    }, [providerId, queryClient])
  );

  // ── Stats & Stripe status ──────────────────────────────────────────────────

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

  const isConnected = !!(stripeStatus?.chargesEnabled && stripeStatus?.payoutsEnabled);

  // ── Stripe live data queries ───────────────────────────────────────────────

  const {
    data: payoutsData,
    isLoading: payoutsLoading,
    refetch: refetchPayouts,
  } = useQuery<{ payouts: StripePayout[] }>({
    queryKey: ["/api/providers", providerId, "stripe-payouts"],
    queryFn: async () => {
      const url = new URL(`/api/providers/${providerId}/stripe-payouts`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (res.status === 404) return { payouts: [] };
      if (!res.ok) throw new Error("Failed to fetch payouts");
      return res.json();
    },
    enabled: !!providerId && isConnected,
    staleTime: 60_000,
  });

  const {
    data: paymentsData,
    isLoading: paymentsLoading,
    refetch: refetchPayments,
  } = useQuery<{ payments: StripePayment[] }>({
    queryKey: ["/api/providers", providerId, "stripe-payments"],
    queryFn: async () => {
      const url = new URL(`/api/providers/${providerId}/stripe-payments`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (res.status === 404) return { payments: [] };
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
    enabled: !!providerId && isConnected,
    staleTime: 60_000,
  });

  const {
    data: refundsData,
    isLoading: refundsLoading,
    refetch: refetchRefunds,
  } = useQuery<{ refunds: StripeRefund[] }>({
    queryKey: ["/api/providers", providerId, "stripe-refunds"],
    queryFn: async () => {
      const url = new URL(`/api/providers/${providerId}/stripe-refunds`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (res.status === 404) return { refunds: [] };
      if (!res.ok) throw new Error("Failed to fetch refunds");
      return res.json();
    },
    enabled: !!providerId && isConnected,
    staleTime: 60_000,
  });

  // ── Provider invoices (outstanding) ───────────────────────────────────────

  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useQuery<{ invoices: ProviderInvoice[] }>({
    queryKey: ["/api/provider", providerId, "invoices"],
    queryFn: async () => {
      const url = new URL(`/api/provider/${providerId}/invoices`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (res.status === 404) return { invoices: [] };
      if (!res.ok) throw new Error(`Failed to fetch invoices (${res.status})`);
      return res.json();
    },
    enabled: !!providerId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const {
    data: clientsData,
  } = useQuery<{ clients: ProviderClient[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    queryFn: async () => {
      const url = new URL(`/api/provider/${providerId}/clients`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (res.status === 404) return { clients: [] };
      if (!res.ok) throw new Error(`Failed to fetch clients (${res.status})`);
      return res.json();
    },
    enabled: !!providerId,
    staleTime: 60_000,
  });

  const stats = statsData?.stats ?? { revenueMTD: 0, jobsCompleted: 0, activeClients: 0, upcomingJobs: 0 };
  const stripePayouts = payoutsData?.payouts ?? [];
  const stripePayments = paymentsData?.payments ?? [];
  const stripeRefunds = refundsData?.refunds ?? [];

  // Build a clientId → display name map
  const clientNameMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const c of clientsData?.clients ?? []) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
      map[c.id] = name || "Client";
    }
    return map;
  }, [clientsData]);

  // Outstanding = sent / viewed / overdue / partially_paid, sorted by dueDate asc
  const outstandingInvoices = useMemo<ProviderInvoice[]>(() => {
    const OUTSTANDING = new Set(["sent", "viewed", "overdue", "partially_paid"]);
    return (invoicesData?.invoices ?? [])
      .filter((inv) => OUTSTANDING.has(inv.status))
      .sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return dateA - dateB;
      });
  }, [invoicesData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchPayouts(), refetchPayments(), refetchRefunds(), refetchInvoices()]);
    setRefreshing(false);
  }, [refetchPayouts, refetchPayments, refetchRefunds, refetchInvoices]);

  // ── Renderers ─────────────────────────────────────────────────────────────

  const renderPayout = ({ item, index }: { item: StripePayout; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
      <View style={[styles.row, { backgroundColor: theme.cardBackground }]} testID={`payout-${item.id}`}>
        <View style={[styles.rowIcon, { backgroundColor: Colors.accentLight }]}>
          <Feather name="arrow-down-circle" size={16} color={Colors.accent} />
        </View>
        <View style={styles.rowInfo}>
          <ThemedText style={styles.rowTitle}>
            {item.bankLast4 ? `Bank \u2022\u2022\u2022\u2022${item.bankLast4}` : "Bank Account"}
          </ThemedText>
          <ThemedText style={[styles.rowSub, { color: theme.textSecondary }]}>
            {item.arrivalDate
              ? `Arrives ${formatArrivalDate(item.arrivalDate)}`
              : `Initiated ${formatDate(item.createdAt)}`}
          </ThemedText>
        </View>
        <View style={styles.rowRight}>
          <ThemedText style={styles.rowAmount}>{formatCents(item.amountCents)}</ThemedText>
          <StatusPill
            status={payoutStatusType(item.status)}
            label={payoutStatusLabel(item.status)}
            size="small"
          />
        </View>
      </View>
    </Animated.View>
  );

  const renderPayment = ({ item, index }: { item: StripePayment; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
      <Pressable
        style={[styles.row, { backgroundColor: theme.cardBackground }]}
        onPress={() => {
          if (item.invoiceId) navigation.navigate("InvoiceDetail", { invoiceId: item.invoiceId });
        }}
        testID={`payment-${item.chargeId}`}
      >
        <View style={[styles.rowIcon, { backgroundColor: Colors.accentLight }]}>
          <Feather name="credit-card" size={16} color={Colors.accent} />
        </View>
        <View style={styles.rowInfo}>
          <ThemedText style={styles.rowTitle}>
            {item.clientName ?? "Unknown Client"}
          </ThemedText>
          <ThemedText style={[styles.rowSub, { color: theme.textSecondary }]}>
            {item.invoiceNumber ? `Invoice ${item.invoiceNumber}` : item.chargeId.slice(-8).toUpperCase()} · {formatDate(item.createdAt)}
          </ThemedText>
        </View>
        <View style={styles.rowRight}>
          <ThemedText style={styles.rowAmount}>{formatCents(item.amountCents)}</ThemedText>
          <StatusPill
            status={paymentStatusType(item.status, item.refunded)}
            label={paymentStatusLabel(item.status, item.refunded)}
            size="small"
          />
        </View>
      </Pressable>
    </Animated.View>
  );

  const renderRefund = ({ item, index }: { item: StripeRefund; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
      <View style={[styles.row, { backgroundColor: theme.cardBackground }]} testID={`refund-${item.refundId}`}>
        <View style={[styles.rowIcon, { backgroundColor: "#FF3B3014" }]}>
          <Feather name="rotate-ccw" size={16} color="#FF3B30" />
        </View>
        <View style={styles.rowInfo}>
          <ThemedText style={styles.rowTitle}>{formatRefundReason(item.reason)}</ThemedText>
          <ThemedText style={[styles.rowSub, { color: theme.textSecondary }]}>
            {item.chargeId ? `Charge ${item.chargeId.slice(-8).toUpperCase()}` : "Refund"} · {formatDate(item.createdAt)}
          </ThemedText>
          {item.originalAmountCents != null ? (
            <ThemedText style={[styles.rowSub, { color: theme.textSecondary }]}>
              Original: {formatCents(item.originalAmountCents)}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.rowRight}>
          <ThemedText style={[styles.rowAmount, { color: "#FF3B30" }]}>
            -{formatCents(item.amountCents)}
          </ThemedText>
          <StatusPill
            status={refundStatusType(item.status)}
            label={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            size="small"
          />
        </View>
      </View>
    </Animated.View>
  );

  // ── Shared header + tab bar ────────────────────────────────────────────────

  const SharedListHeader = () => (
    <View>
      {/* Revenue summary card */}
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
                {stripePayouts.filter((p) => p.status === "in_transit").length}
              </ThemedText>
              <ThemedText style={[styles.miniStatLabel, { color: theme.textSecondary }]}>in transit</ThemedText>
            </View>
            <View style={[styles.miniDivider, { backgroundColor: theme.separator }]} />
            <View style={styles.miniStat}>
              <ThemedText style={[styles.miniStatValue, { color: theme.textSecondary }]}>
                {stripeRefunds.length}
              </ThemedText>
              <ThemedText style={[styles.miniStatLabel, { color: theme.textSecondary }]}>refunds</ThemedText>
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      {/* Outstanding Invoices section */}
      <Animated.View entering={FadeInDown.delay(75).duration(400)}>
        <View style={[styles.outstandingCard, { backgroundColor: theme.cardBackground }]}>
          {/* Section header */}
          <View style={styles.outstandingHeader}>
            <ThemedText style={styles.outstandingTitle}>Outstanding Invoices</ThemedText>
            {outstandingInvoices.length > 0 ? (
              <View style={[styles.outstandingBadge, { backgroundColor: Colors.accent }]}>
                <ThemedText style={styles.outstandingBadgeText}>{outstandingInvoices.length}</ThemedText>
              </View>
            ) : null}
          </View>

          {/* Loading skeleton */}
          {invoicesLoading ? (
            <View>
              {["os1", "os2"].map((k) => (
                <View key={k} style={styles.outstandingRow}>
                  <View style={styles.outstandingRowInfo}>
                    <View style={[styles.skeletonLine, { backgroundColor: theme.separator, width: "55%", marginBottom: 6 }]} />
                    <View style={[styles.skeletonLine, { backgroundColor: theme.separator, width: "40%" }]} />
                  </View>
                  <View style={styles.outstandingRowRight}>
                    <View style={[styles.skeletonLine, { backgroundColor: theme.separator, width: 64, marginBottom: 6 }]} />
                    <View style={[styles.skeletonPill, { backgroundColor: theme.separator }]} />
                  </View>
                </View>
              ))}
            </View>
          ) : outstandingInvoices.length > 0 ? (
            <View>
              {outstandingInvoices.map((inv, index) => {
                const clientName = (inv.clientId ? clientNameMap[inv.clientId] : null) ?? "Client";
                const isOverdue = inv.status === "overdue" ||
                  (inv.dueDate != null && new Date(inv.dueDate) < new Date() && inv.status !== "paid");
                return (
                  <Pressable
                    key={inv.id}
                    style={[
                      styles.outstandingRow,
                      index < outstandingInvoices.length - 1
                        ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator }
                        : null,
                    ]}
                    onPress={() => { Haptics.selectionAsync(); navigation.navigate("InvoiceDetail", { invoiceId: inv.id }); }}
                    testID={`outstanding-invoice-${inv.id}`}
                  >
                    <View style={[styles.outstandingIcon, { backgroundColor: isOverdue ? "#FF3B3014" : Colors.accentLight }]}>
                      <Feather name="file-text" size={15} color={isOverdue ? "#FF3B30" : Colors.accent} />
                    </View>
                    <View style={styles.outstandingRowInfo}>
                      <ThemedText style={styles.outstandingClientName} numberOfLines={1}>{clientName}</ThemedText>
                      <ThemedText style={[styles.outstandingMeta, { color: isOverdue ? "#FF3B30" : theme.textSecondary }]}>
                        {inv.invoiceNumber ? `#${inv.invoiceNumber}` : "Invoice"} · {formatDueDate(inv.dueDate)}
                      </ThemedText>
                    </View>
                    <View style={styles.outstandingRowRight}>
                      <ThemedText style={[styles.outstandingAmount, isOverdue ? { color: "#FF3B30" } : null]}>
                        {formatInvoiceAmount(inv)}
                      </ThemedText>
                      <StatusPill
                        status={invoiceStatusType(isOverdue && inv.status !== "overdue" ? "overdue" : inv.status)}
                        label={invoiceStatusLabel(isOverdue && inv.status !== "overdue" ? "overdue" : inv.status)}
                        size="small"
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.outstandingEmpty}>
              <Feather name="check-circle" size={20} color={Colors.accent} />
              <ThemedText style={[styles.outstandingEmptyText, { color: theme.textSecondary }]}>
                All caught up
              </ThemedText>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Stripe connect CTA */}
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

      {/* Tab bar */}
      <Animated.View entering={FadeInDown.delay(isConnected ? 100 : 150).duration(400)}>
        <View style={[styles.tabBar, { borderBottomColor: theme.separator }]}>
          {(["payouts", "payments", "refunds"] as TabKey[]).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab.charAt(0).toUpperCase() + tab.slice(1);
            return (
              <Pressable
                key={tab}
                style={styles.tabItem}
                onPress={() => { Haptics.selectionAsync(); setActiveTab(tab); }}
                testID={`tab-${tab}`}
              >
                <ThemedText
                  style={[
                    styles.tabLabel,
                    isActive
                      ? { color: Colors.accent, fontWeight: "700" }
                      : { color: theme.textSecondary },
                  ]}
                >
                  {label}
                </ThemedText>
                {isActive ? (
                  <View style={[styles.tabIndicator, { backgroundColor: Colors.accent }]} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );

  const contentStyle = {
    paddingTop: headerHeight + Spacing.md,
    paddingBottom: tabBarHeight + Spacing.xl,
    paddingHorizontal: Spacing.screenPadding,
  };

  const scrollIndicatorInsets = { bottom: insets.bottom };

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
  );

  const noStripeEmpty = (
    <View style={styles.emptyContainer}>
      <EmptyState
        image={require("../../../assets/images/empty-bookings.png")}
        title="Connect Stripe to see data"
        description="Complete your Stripe setup to view payouts, payments, and refunds."
        primaryAction={{
          label: "Set Up Stripe",
          onPress: () => navigation.navigate("StripeConnect"),
        }}
      />
    </View>
  );

  // ── Per-tab skeleton lists ─────────────────────────────────────────────────

  if (activeTab === "payouts") {
    const PayoutEmpty = () => {
      if (payoutsLoading) {
        return (
          <View>
            {SKELETON_KEYS.map((k) => <SkeletonRow key={k} theme={theme} />)}
          </View>
        );
      }
      if (!isConnected) return noStripeEmpty;
      return (
        <View style={styles.emptyContainer}>
          <EmptyState
            image={require("../../../assets/images/empty-bookings.png")}
            title="No payouts yet"
            description="Payouts from completed invoices will appear here."
          />
        </View>
      );
    };

    return (
      <ThemedView style={styles.container}>
        <FlatList<StripePayout>
          data={stripePayouts}
          renderItem={renderPayout}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={<SharedListHeader />}
          ListEmptyComponent={<PayoutEmpty />}
          contentContainerStyle={contentStyle}
          scrollIndicatorInsets={scrollIndicatorInsets}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        />
      </ThemedView>
    );
  }

  if (activeTab === "payments") {
    const PaymentEmpty = () => {
      if (paymentsLoading) {
        return (
          <View>
            {SKELETON_KEYS.map((k) => <SkeletonRow key={k} theme={theme} />)}
          </View>
        );
      }
      if (!isConnected) return noStripeEmpty;
      return (
        <View style={styles.emptyContainer}>
          <EmptyState
            image={require("../../../assets/images/empty-bookings.png")}
            title="No payments yet"
            description="Completed payments from clients will appear here."
          />
        </View>
      );
    };

    return (
      <ThemedView style={styles.container}>
        <FlatList<StripePayment>
          data={stripePayments}
          renderItem={renderPayment}
          keyExtractor={(item) => item.chargeId}
          ListHeaderComponent={<SharedListHeader />}
          ListEmptyComponent={<PaymentEmpty />}
          contentContainerStyle={contentStyle}
          scrollIndicatorInsets={scrollIndicatorInsets}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        />
      </ThemedView>
    );
  }

  // activeTab === "refunds"
  const RefundEmpty = () => {
    if (refundsLoading) {
      return (
        <View>
          {SKELETON_KEYS.map((k) => <SkeletonRow key={k} theme={theme} />)}
        </View>
      );
    }
    if (!isConnected) return noStripeEmpty;
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          image={require("../../../assets/images/empty-bookings.png")}
          title="No refunds"
          description="Any refunds issued will appear here."
        />
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList<StripeRefund>
        data={stripeRefunds}
        renderItem={renderRefund}
        keyExtractor={(item) => item.refundId}
        ListHeaderComponent={<SharedListHeader />}
        ListEmptyComponent={<RefundEmpty />}
        contentContainerStyle={contentStyle}
        scrollIndicatorInsets={scrollIndicatorInsets}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
    </ThemedView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Summary card
  balanceCard: { marginBottom: Spacing.md },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  balanceLabel: { ...Typography.subhead },
  newInvoiceBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  newInvoiceBtnText: { ...Typography.subhead, fontWeight: "600" },
  balanceValue: {
    ...Typography.largeTitle,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  statsRow: { flexDirection: "row", alignItems: "center" },
  miniStat: { flex: 1, alignItems: "center" },
  miniStatValue: { ...Typography.headline, fontWeight: "600" },
  miniStatLabel: { ...Typography.caption2, marginTop: 2 },
  miniDivider: { width: StyleSheet.hairlineWidth, height: 32 },

  // Stripe CTA
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
  stripeCtaText: { flex: 1 },
  stripeCtaTitle: { ...Typography.callout, fontWeight: "600", marginBottom: 2 },
  stripeCtaSubtitle: { ...Typography.footnote, lineHeight: 18 },

  // Tabs
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    position: "relative",
  },
  tabLabel: { ...Typography.callout },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: "10%",
    right: "10%",
    height: 2,
    borderRadius: 1,
  },

  // Row items
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: { flex: 1 },
  rowTitle: { ...Typography.callout, fontWeight: "600" },
  rowSub: { ...Typography.caption1, marginTop: 2 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowAmount: { ...Typography.callout, fontWeight: "700" },

  // Skeleton
  skeletonIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  skeletonPill: {
    height: 20,
    width: 60,
    borderRadius: 10,
    marginTop: 4,
  },

  // Empty
  emptyContainer: {
    paddingTop: Spacing["2xl"],
    alignItems: "center",
  },
  loadingRow: {
    paddingTop: Spacing["2xl"],
    alignItems: "center",
  },

  // Outstanding Invoices section
  outstandingCard: {
    borderRadius: BorderRadius.card,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  outstandingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  outstandingTitle: {
    ...Typography.callout,
    fontWeight: "700",
  },
  outstandingBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  outstandingBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  outstandingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  outstandingIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  outstandingRowInfo: { flex: 1, minWidth: 0 },
  outstandingClientName: { ...Typography.callout, fontWeight: "600" },
  outstandingMeta: { ...Typography.caption1, marginTop: 2 },
  outstandingRowRight: { alignItems: "flex-end", gap: 4 },
  outstandingAmount: { ...Typography.callout, fontWeight: "700" },
  outstandingEmpty: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingBottom: Spacing.md,
  },
  outstandingEmptyText: { ...Typography.callout },
});
