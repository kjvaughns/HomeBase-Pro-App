import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getAuthHeaders, getApiUrl } from "@/lib/query-client";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
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
  averageJobValue: number;
  revenueByPeriod: { label: string; value: number }[];
}

interface StripeStatus {
  exists: boolean;
  hasAccount: boolean;
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

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  totalCents: number;
  status: string;
  dueDate: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
  clientId: string | null;
  clientName?: string | null;
  homeownerUserId?: string | null;
}

type SectionTab = "overview" | "transactions" | "more";
type TransactionTab = "invoices" | "payouts";
type DateRange = "week" | "month" | "quarter" | "year" | "custom";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatDollars(amount: number | null | undefined): string {
  const n = amount ?? 0;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatArrivalDate(iso: string | null): string {
  if (!iso) return "Pending";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
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

function invoiceStatusType(status: string): StatusType {
  switch (status) {
    case "paid": return "success";
    case "sent": return "info";
    case "overdue": return "error";
    case "partially_paid": return "pending";
    case "draft": return "neutral";
    case "cancelled":
    case "canceled": return "neutral";
    default: return "neutral";
  }
}

function invoiceStatusLabel(status: string): string {
  switch (status) {
    case "partially_paid": return "Partial";
    case "cancelled":
    case "canceled": return "Cancelled";
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function getDateRange(
  range: DateRange,
  customStart?: Date,
  customEnd?: Date
): { start: Date; end: Date } {
  if (range === "custom" && customStart && customEnd) {
    const s = new Date(customStart);
    s.setHours(0, 0, 0, 0);
    const e = new Date(customEnd);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }

  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);

  switch (range) {
    case "week":
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "quarter":
      start.setMonth(now.getMonth() - 2);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "year":
      start.setMonth(0);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

const DATE_RANGE_OPTIONS: { key: DateRange; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Qtr" },
  { key: "year", label: "Year" },
  { key: "custom", label: "Custom" },
];

// ─── Bar Chart ───────────────────────────────────────────────────────────────

function BarChart({
  data,
  maxValue,
  theme,
}: {
  data: { label: string; value: number }[];
  maxValue: number;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - Spacing.screenPadding * 2 - Spacing.lg * 2;
  const gap = data.length > 12 ? 2 : 4;
  const barWidth = Math.max(6, Math.floor((chartWidth - data.length * gap) / data.length));
  const maxBarHeight = 120;
  const maxIdx = data.reduce((best, item, i) => (item.value > data[best].value ? i : best), 0);

  const gridLines = [0.25, 0.5, 0.75, 1];

  return (
    <View style={chartStyles.wrapper}>
      {/* Y-axis grid lines */}
      <View style={[chartStyles.gridContainer, { height: maxBarHeight }]}>
        {gridLines.map((pct) => (
          <View
            key={pct}
            style={[
              chartStyles.gridLine,
              {
                bottom: maxBarHeight * pct,
                borderColor: theme.separator,
              },
            ]}
          />
        ))}
      </View>

      {/* Bars */}
      <View style={[chartStyles.barsRow, { gap }]}>
        {data.map((item, i) => {
          const barH = maxValue > 0 ? Math.max(3, (item.value / maxValue) * maxBarHeight) : 3;
          const isMax = i === maxIdx && item.value > 0;
          const hasValue = item.value > 0;
          return (
            <View key={i} style={[chartStyles.barColumn, { width: barWidth }]}>
              {isMax ? (
                <ThemedText style={[chartStyles.peakLabel, { color: Colors.accent }]}>
                  {formatDollars(item.value)}
                </ThemedText>
              ) : null}
              <View
                style={[
                  chartStyles.bar,
                  {
                    height: barH,
                    width: barWidth,
                    backgroundColor: hasValue ? Colors.accent : theme.separator,
                    borderRadius: Math.min(barWidth / 2, 4),
                    opacity: hasValue ? 1 : 0.4,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* X-axis labels */}
      <View style={[chartStyles.labelsRow, { gap }]}>
        {data.map((item, i) => {
          const showLabel =
            data.length <= 7 || i % Math.ceil(data.length / 6) === 0 || i === data.length - 1;
          return (
            <View key={i} style={[chartStyles.labelColumn, { width: barWidth }]}>
              {showLabel ? (
                <ThemedText style={[chartStyles.label, { color: theme.textTertiary }]} numberOfLines={1}>
                  {item.label}
                </ThemedText>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  wrapper: { paddingTop: Spacing.md, position: "relative" },
  gridContainer: { position: "absolute", left: 0, right: 0, top: Spacing.md + 20 },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    opacity: 0.6,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 140,
  },
  barColumn: { alignItems: "center", justifyContent: "flex-end" },
  bar: {},
  peakLabel: {
    fontSize: 9,
    fontWeight: "700",
    marginBottom: 3,
    textAlign: "center",
  },
  labelsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 5,
  },
  labelColumn: { alignItems: "center" },
  label: { fontSize: 8, fontWeight: "500" },
});

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow({ theme }: { theme: ReturnType<typeof useTheme>["theme"] }) {
  return (
    <View style={[styles.row, { backgroundColor: theme.cardBackground }]}>
      <View style={[styles.rowIcon, { backgroundColor: theme.separator }]} />
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

export default function FinancialsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();
  const queryClient = useQueryClient();

  const providerId = providerProfile?.id ?? "";
  const [sectionTab, setSectionTab] = useState<SectionTab>("overview");
  const [transactionTab, setTransactionTab] = useState<TransactionTab>("invoices");
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [refreshing, setRefreshing] = useState(false);

  const defaultCustomStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [customStart, setCustomStart] = useState<Date>(defaultCustomStart);
  const [customEnd, setCustomEnd] = useState<Date>(new Date());
  // Android: show one picker at a time
  const [androidPickerField, setAndroidPickerField] = useState<"start" | "end" | null>(null);

  const { start, end } = useMemo(
    () => getDateRange(dateRange, customStart, customEnd),
    [dateRange, customStart, customEnd]
  );

  useFocusEffect(
    useCallback(() => {
      if (providerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "stats"] });
      }
    }, [providerId, queryClient])
  );

  // ── Stats ──────────────────────────────────────────────────────────────────

  const {
    data: statsData,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery<{ stats: ProviderStats }>({
    queryKey: ["/api/provider", providerId, "stats", dateRange, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const url = new URL(`/api/provider/${providerId}/stats`, getApiUrl());
      url.searchParams.set("startDate", start.toISOString());
      url.searchParams.set("endDate", end.toISOString());
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!providerId,
    staleTime: 30_000,
  });

  // ── Stripe status ──────────────────────────────────────────────────────────

  const {
    data: stripeStatus,
    isLoading: stripeStatusLoading,
    refetch: refetchStripeStatus,
  } = useQuery<StripeStatus>({
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

  // ── Invoices (Income tab) ─────────────────────────────────────────────────

  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useQuery<{ invoices: InvoiceRecord[] }>({
    queryKey: ["/api/provider", providerId, "invoices"],
    queryFn: async () => {
      const url = new URL(`/api/provider/${providerId}/invoices`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (res.status === 404) return { invoices: [] };
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    },
    enabled: !!providerId,
    staleTime: 30_000,
  });

  interface ClientRecord { id: string; firstName: string; lastName: string; }

  const { data: clientsData } = useQuery<{ clients: ClientRecord[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
    staleTime: 60_000,
  });

  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clientsData?.clients ?? []) {
      map.set(c.id, [c.firstName, c.lastName].filter(Boolean).join(" "));
    }
    return map;
  }, [clientsData]);

  // ── Stripe Payouts ─────────────────────────────────────────────────────────

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

  // ── Stripe onboard mutation ────────────────────────────────────────────────

  const onboardMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/stripe/connect/onboard/${providerId}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.onboardingUrl) {
        Linking.openURL(data.onboardingUrl);
      }
      refetchStripeStatus();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to start onboarding";
      Alert.alert("Error", message);
    },
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  const stats = statsData?.stats ?? {
    revenueMTD: 0,
    jobsCompleted: 0,
    activeClients: 0,
    upcomingJobs: 0,
    averageJobValue: 0,
    revenueByPeriod: [],
  };
  const invoices = invoicesData?.invoices ?? [];
  const stripePayouts = payoutsData?.payouts ?? [];
  const maxChartValue = Math.max(...(stats.revenueByPeriod?.map((p) => p.value) ?? [0]), 1);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchStats(),
      refetchStripeStatus(),
      refetchInvoices(),
      refetchPayouts(),
    ]);
    setRefreshing(false);
  }, [refetchStats, refetchStripeStatus, refetchInvoices, refetchPayouts]);

  const SECTION_TABS: { key: SectionTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "transactions", label: "Transactions" },
    { key: "more", label: "More" },
  ];

  const TRANS_TABS: { key: TransactionTab; label: string }[] = [
    { key: "invoices", label: "Invoices" },
    { key: "payouts", label: "Payouts" },
  ];

  // ── Row renderers ──────────────────────────────────────────────────────────

  const renderInvoice = ({ item, index }: { item: InvoiceRecord; index: number }) => {
    const isOverdue =
      item.status !== "paid" &&
      item.status !== "draft" &&
      item.dueDate &&
      new Date(item.dueDate) < new Date();
    const effectiveStatus = isOverdue ? "overdue" : item.status;
    const clientName = item.clientId ? clientMap.get(item.clientId) : null;

    return (
      <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
        <Pressable
          style={[styles.row, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.navigate("InvoiceDetail", { invoiceId: item.id })}
          testID={`invoice-${item.id}`}
        >
          <View style={[styles.rowIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name="file-text" size={16} color={Colors.accent} />
          </View>
          <View style={styles.rowInfo}>
            <ThemedText style={styles.rowTitle}>
              {clientName ?? `Invoice ${item.invoiceNumber}`}
            </ThemedText>
            <ThemedText style={[styles.rowSub, { color: theme.textSecondary }]}>
              {item.invoiceNumber}{item.dueDate ? ` \u00b7 Due ${formatDate(item.dueDate)}` : ""}
            </ThemedText>
          </View>
          <View style={styles.rowRight}>
            <ThemedText style={styles.rowAmount}>{formatCents(item.totalCents)}</ThemedText>
            <StatusPill
              status={invoiceStatusType(effectiveStatus)}
              label={invoiceStatusLabel(effectiveStatus)}
              size="small"
            />
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderPayout = ({ item, index }: { item: StripePayout; index: number }) => {
    const isPending = item.status === "pending" || item.status === "in_transit";
    return (
      <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
        <View
          style={[styles.row, { backgroundColor: theme.cardBackground }]}
          testID={`payout-${item.id}`}
        >
          <View style={[styles.rowIcon, { backgroundColor: isPending ? "#FF9F0A14" : "#34C75914" }]}>
            <Feather
              name={isPending ? "clock" : "check-circle"}
              size={16}
              color={isPending ? "#FF9F0A" : "#34C759"}
            />
          </View>
          <View style={styles.rowInfo}>
            <ThemedText style={styles.rowTitle}>
              {item.bankLast4
                ? `Bank \u2022\u2022\u2022\u2022${item.bankLast4}`
                : "Bank Account"}
            </ThemedText>
            <ThemedText style={[styles.rowSub, { color: isPending ? "#FF9F0A" : theme.textSecondary }]}>
              {item.status === "in_transit" || item.status === "pending"
                ? `Arrives ${formatArrivalDate(item.arrivalDate)}`
                : item.arrivalDate
                ? `Deposited ${formatDate(item.arrivalDate)}`
                : formatDate(item.createdAt)}
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
  };

  // ── Section tab bar ────────────────────────────────────────────────────────

  const SectionTabBar = () => (
    <View style={[styles.sectionTabBar, { borderBottomColor: theme.separator }]}>
      {SECTION_TABS.map((tab) => {
        const isActive = sectionTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={styles.sectionTabItem}
            onPress={() => { Haptics.selectionAsync(); setSectionTab(tab.key); }}
            testID={`section-tab-${tab.key}`}
          >
            <ThemedText
              style={[
                styles.sectionTabLabel,
                isActive
                  ? { color: Colors.accent, fontWeight: "700" }
                  : { color: theme.textSecondary },
              ]}
            >
              {tab.label}
            </ThemedText>
            {isActive ? (
              <View style={[styles.sectionTabIndicator, { backgroundColor: Colors.accent }]} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  // ── Overview header content ────────────────────────────────────────────────

  const OverviewContent = () => (
    <View>
      {/* Date range toggler */}
      <Animated.View entering={FadeInDown.delay(60).duration(400)}>
        <View style={[styles.dateRangeBar, { backgroundColor: theme.backgroundSecondary }]}>
          {DATE_RANGE_OPTIONS.map((opt) => {
            const isActive = dateRange === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={[
                  styles.dateRangeItem,
                  isActive && { backgroundColor: theme.cardBackground },
                ]}
                onPress={() => { Haptics.selectionAsync(); setDateRange(opt.key); }}
                testID={`date-range-${opt.key}`}
              >
                <ThemedText
                  style={[
                    styles.dateRangeLabel,
                    isActive
                      ? { color: Colors.accent, fontWeight: "700" }
                      : { color: theme.textSecondary },
                  ]}
                >
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Custom date pickers */}
      {dateRange === "custom" ? (
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <View style={[styles.customDateRow, { backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.md }]}>
            {/* From */}
            <View style={styles.customDateField}>
              <ThemedText style={[styles.customDateFieldLabel, { color: theme.textSecondary }]}>From</ThemedText>
              {Platform.OS === "ios" ? (
                <DateTimePicker
                  value={customStart}
                  mode="date"
                  display="compact"
                  maximumDate={customEnd}
                  onChange={(_, date) => { if (date) setCustomStart(date); }}
                  style={styles.iosCompactPicker}
                />
              ) : (
                <Pressable
                  style={[styles.androidDateBtn, { borderColor: theme.separator }]}
                  onPress={() => setAndroidPickerField("start")}
                  testID="button-custom-start"
                >
                  <Feather name="calendar" size={13} color={Colors.accent} />
                  <ThemedText style={styles.androidDateBtnText}>
                    {customStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </ThemedText>
                </Pressable>
              )}
            </View>

            <View style={[styles.customDateDivider, { backgroundColor: theme.separator }]} />

            {/* To */}
            <View style={styles.customDateField}>
              <ThemedText style={[styles.customDateFieldLabel, { color: theme.textSecondary }]}>To</ThemedText>
              {Platform.OS === "ios" ? (
                <DateTimePicker
                  value={customEnd}
                  mode="date"
                  display="compact"
                  minimumDate={customStart}
                  maximumDate={new Date()}
                  onChange={(_, date) => { if (date) setCustomEnd(date); }}
                  style={styles.iosCompactPicker}
                />
              ) : (
                <Pressable
                  style={[styles.androidDateBtn, { borderColor: theme.separator }]}
                  onPress={() => setAndroidPickerField("end")}
                  testID="button-custom-end"
                >
                  <Feather name="calendar" size={13} color={Colors.accent} />
                  <ThemedText style={styles.androidDateBtnText}>
                    {customEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </View>

          {/* Android pickers (rendered as modals, one at a time) */}
          {Platform.OS === "android" && androidPickerField === "start" ? (
            <DateTimePicker
              value={customStart}
              mode="date"
              display="default"
              maximumDate={customEnd}
              onChange={(_, date) => {
                setAndroidPickerField(null);
                if (date) setCustomStart(date);
              }}
            />
          ) : null}
          {Platform.OS === "android" && androidPickerField === "end" ? (
            <DateTimePicker
              value={customEnd}
              mode="date"
              display="default"
              minimumDate={customStart}
              maximumDate={new Date()}
              onChange={(_, date) => {
                setAndroidPickerField(null);
                if (date) setCustomEnd(date);
              }}
            />
          ) : null}
        </Animated.View>
      ) : null}

      {/* Revenue + chart card */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <GlassCard style={styles.revenueCard}>
          <View style={styles.revenueHeader}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.revenueLabel, { color: theme.textSecondary }]}>
                {dateRange === "week"
                  ? "Revenue This Week"
                  : dateRange === "month"
                  ? "Revenue This Month"
                  : dateRange === "quarter"
                  ? "Revenue This Quarter"
                  : dateRange === "custom"
                  ? `${customStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u2013 ${customEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                  : "Revenue This Year"}
              </ThemedText>
              {statsLoading ? (
                <View style={[styles.skeletonLine, { backgroundColor: theme.separator, width: 140, height: 36, marginTop: 4 }]} />
              ) : (
                <ThemedText style={styles.revenueValue}>
                  {formatDollars(stats.revenueMTD ?? 0)}
                </ThemedText>
              )}
            </View>
            <Pressable
              style={styles.newInvoiceBtn}
              onPress={() => { Haptics.selectionAsync(); navigation.navigate("AddInvoice"); }}
              testID="button-new-invoice"
            >
              <Feather name="plus" size={14} color={Colors.accent} />
              <ThemedText style={[styles.newInvoiceBtnText, { color: Colors.accent }]}>
                Invoice
              </ThemedText>
            </Pressable>
          </View>

          {statsLoading ? (
            <View style={[styles.chartSkeleton, { backgroundColor: theme.separator }]} />
          ) : stats.revenueByPeriod != null && stats.revenueByPeriod.length > 0 ? (
            <BarChart data={stats.revenueByPeriod} maxValue={maxChartValue} theme={theme} />
          ) : null}
        </GlassCard>
      </Animated.View>

      {/* Stat cards */}
      <Animated.View entering={FadeInDown.delay(140).duration(400)}>
        <View style={styles.statCardsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
            <Feather name="check-circle" size={18} color={Colors.accent} />
            <ThemedText style={styles.statCardValue}>
              {statsLoading ? "-" : stats.jobsCompleted}
            </ThemedText>
            <ThemedText style={[styles.statCardLabel, { color: theme.textSecondary }]}>
              Jobs Done
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
            <Feather name="trending-up" size={18} color={Colors.accent} />
            <ThemedText style={styles.statCardValue}>
              {statsLoading ? "-" : formatDollars(stats.averageJobValue ?? 0)}
            </ThemedText>
            <ThemedText style={[styles.statCardLabel, { color: theme.textSecondary }]}>
              Avg Job
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
            <Feather name="users" size={18} color={Colors.accent} />
            <ThemedText style={styles.statCardValue}>
              {statsLoading ? "-" : stats.activeClients}
            </ThemedText>
            <ThemedText style={[styles.statCardLabel, { color: theme.textSecondary }]}>
              Clients
            </ThemedText>
          </View>
        </View>
      </Animated.View>

    </View>
  );

  // ── More tab content (Stripe settings) ─────────────────────────────────────

  const MoreContent = () => (
    <View>
      <Animated.View entering={FadeInDown.delay(60).duration(400)}>
        <ThemedText style={[styles.moreSectionTitle, { color: theme.textSecondary }]}>
          Payments
        </ThemedText>
        <Pressable
          style={[
            styles.stripeSettingsRow,
            {
              backgroundColor: theme.cardBackground,
              borderColor: isConnected ? "#34C75920" : Colors.accent + "25",
            },
          ]}
          onPress={() => { Haptics.selectionAsync(); navigation.navigate("StripeConnect"); }}
          testID="button-stripe-settings"
        >
          <View style={[styles.stripeSettingsIcon, { backgroundColor: isConnected ? "#34C75914" : Colors.accentLight }]}>
            {stripeStatusLoading ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Feather
                name={isConnected ? "check-circle" : "alert-circle"}
                size={18}
                color={isConnected ? "#34C759" : Colors.accent}
              />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.stripeSettingsTitle, { color: isConnected ? "#34C759" : Colors.accent }]}>
              {isConnected
                ? "Payouts Enabled"
                : stripeStatus?.onboardingStatus === "pending"
                ? "Stripe Setup Pending"
                : "Set Up Stripe Payouts"}
            </ThemedText>
            <ThemedText style={[styles.stripeSettingsSub, { color: theme.textSecondary }]}>
              {isConnected
                ? "Manage your Stripe account and payout settings"
                : stripeStatus?.onboardingStatus === "pending"
                ? "Complete onboarding to enable payouts"
                : "Connect your bank account to get paid"}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={16} color={theme.textSecondary} />
        </Pressable>
      </Animated.View>
    </View>
  );

  // ── Transactions header content ─────────────────────────────────────────────

  const TransactionsHeader = () => (
    <View>
      {/* New invoice CTA + sub-tabs */}
      <Animated.View entering={FadeInDown.delay(60).duration(400)}>
        <View style={styles.transHeaderRow}>
          <View style={[styles.transTabBar, { borderColor: theme.separator }]}>
            {TRANS_TABS.map((tab) => {
              const isActive = transactionTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={[
                    styles.transTabItem,
                    isActive && { backgroundColor: theme.cardBackground },
                  ]}
                  onPress={() => { Haptics.selectionAsync(); setTransactionTab(tab.key); }}
                  testID={`trans-tab-${tab.key}`}
                >
                  <ThemedText
                    style={[
                      styles.transTabLabel,
                      isActive
                        ? { color: Colors.accent, fontWeight: "700" }
                        : { color: theme.textSecondary },
                    ]}
                  >
                    {tab.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {transactionTab === "invoices" ? (
            <Pressable
              style={[styles.addInvoiceBtn, { backgroundColor: Colors.accentLight }]}
              onPress={() => { Haptics.selectionAsync(); navigation.navigate("AddInvoice"); }}
              testID="button-add-invoice"
            >
              <Feather name="plus" size={15} color={Colors.accent} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>

      {/* Stripe setup nudge for payouts when not connected */}
      {transactionTab === "payouts" && !isConnected ? (
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <Pressable
            style={[styles.stripeNudge, { backgroundColor: theme.cardBackground, borderColor: Colors.accent + "30" }]}
            onPress={() => { Haptics.selectionAsync(); navigation.navigate("StripeConnect"); }}
          >
            <View style={[styles.stripeNudgeIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name="credit-card" size={16} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.stripeNudgeTitle, { color: Colors.accent }]}>
                Connect Stripe to see payouts
              </ThemedText>
              <ThemedText style={[styles.stripeNudgeSub, { color: theme.textSecondary }]}>
                Set up your bank account to receive payments
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={14} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );

  // ── Shared list header ─────────────────────────────────────────────────────

  const SharedHeader = () => (
    <View style={styles.sharedHeaderWrapper}>
      <SectionTabBar />
      {sectionTab === "overview" ? (
        <OverviewContent />
      ) : sectionTab === "more" ? (
        <MoreContent />
      ) : (
        <TransactionsHeader />
      )}
    </View>
  );

  // ── Overview / More rendering (ScrollView) ─────────────────────────────────

  if (sectionTab === "overview" || sectionTab === "more") {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
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
        >
          <SharedHeader />
        </ScrollView>
      </ThemedView>
    );
  }

  // Transactions — Invoices tab
  if (transactionTab === "invoices") {
    const IncomeEmpty = () => {
      if (invoicesLoading) {
        return <View>{SKELETON_KEYS.map((k) => <SkeletonRow key={k} theme={theme} />)}</View>;
      }
      return (
        <View style={styles.emptyContainer}>
          <EmptyState
            image={require("../../../assets/images/empty-bookings.png")}
            title="No invoices yet"
            description="Create your first invoice to start tracking income."
            primaryAction={{
              label: "New Invoice",
              onPress: () => navigation.navigate("AddInvoice"),
            }}
          />
        </View>
      );
    };

    return (
      <ThemedView style={styles.container}>
        <FlatList<InvoiceRecord>
          data={invoices}
          renderItem={renderInvoice}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={<SharedHeader />}
          ListEmptyComponent={<IncomeEmpty />}
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

  // Transactions — Payouts tab (bank transfers)
  const PayoutsEmpty = () => {
    if (payoutsLoading) {
      return <View>{SKELETON_KEYS.map((k) => <SkeletonRow key={k} theme={theme} />)}</View>;
    }
    if (!isConnected) return null;
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          image={require("../../../assets/images/empty-bookings.png")}
          title="No payouts yet"
          description="Completed payouts from HomeBase will show up here with expected deposit dates."
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
        ListHeaderComponent={<SharedHeader />}
        ListEmptyComponent={<PayoutsEmpty />}
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  sharedHeaderWrapper: { marginBottom: Spacing.sm },

  // Section tab bar
  sectionTabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
  },
  sectionTabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    position: "relative",
  },
  sectionTabLabel: { ...Typography.callout },
  sectionTabIndicator: {
    position: "absolute",
    bottom: 0,
    left: "15%",
    right: "15%",
    height: 2,
    borderRadius: 1,
  },

  // Date range toggler
  dateRangeBar: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 3,
    marginBottom: Spacing.md,
  },
  dateRangeItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: BorderRadius.sm,
  },
  dateRangeLabel: { ...Typography.footnote, fontWeight: "500" },

  // Custom date picker
  customDateRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    gap: 0,
  },
  customDateField: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  customDateFieldLabel: { ...Typography.caption2, fontWeight: "600", marginBottom: 4 },
  iosCompactPicker: { height: 34 },
  androidDateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    marginTop: 2,
  },
  androidDateBtnText: { ...Typography.footnote, fontWeight: "600" },
  customDateDivider: { width: StyleSheet.hairlineWidth, height: 40 },

  // Revenue card
  revenueCard: { marginBottom: Spacing.md },
  revenueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  revenueLabel: { ...Typography.subhead },
  revenueValue: { ...Typography.largeTitle, fontWeight: "700", marginTop: 2 },
  newInvoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    marginTop: 4,
  },
  newInvoiceBtnText: { ...Typography.footnote, fontWeight: "600" },
  chartSkeleton: { height: 140, borderRadius: BorderRadius.sm, marginTop: Spacing.sm },

  // Stat cards
  statCardsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    gap: 4,
  },
  statCardValue: { ...Typography.headline, fontWeight: "700" },
  statCardLabel: { ...Typography.caption1, textAlign: "center" },

  // Stripe settings row
  stripeSettingsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  stripeSettingsIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  stripeSettingsTitle: { ...Typography.callout, fontWeight: "600", marginBottom: 2 },
  stripeSettingsSub: { ...Typography.caption1, lineHeight: 17 },

  // Transactions tab bar
  transHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  transTabBar: {
    flex: 1,
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    overflow: "hidden",
  },
  transTabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: BorderRadius.sm - 1,
  },
  transTabLabel: { ...Typography.footnote, fontWeight: "500" },

  addInvoiceBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  // Stripe nudge (for payouts when disconnected)
  stripeNudge: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  stripeNudgeIcon: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  stripeNudgeTitle: { ...Typography.callout, fontWeight: "600", marginBottom: 2 },
  stripeNudgeSub: { ...Typography.caption1, lineHeight: 17 },

  // Transaction rows
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
  skeletonLine: { height: 12, borderRadius: 6 },
  skeletonPill: { height: 20, width: 60, borderRadius: 10, marginTop: 4 },

  // More tab
  moreSectionTitle: {
    ...Typography.footnote,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: 2,
  },

  // Empty
  emptyContainer: { paddingTop: Spacing["2xl"], alignItems: "center" },
});
