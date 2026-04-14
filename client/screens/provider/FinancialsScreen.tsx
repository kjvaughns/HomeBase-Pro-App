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
  Modal,
} from "react-native";
import Svg, { Rect, Text as SvgText, Line, G } from "react-native-svg";
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

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────

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
  const HORIZ_PAD = Spacing.screenPadding * 2 + Spacing.lg * 2;
  const chartWidth = screenWidth - HORIZ_PAD;
  const chartHeight = 120;
  const BOTTOM_AXIS = 24;
  const totalH = chartHeight + BOTTOM_AXIS;
  const n = data.length;
  const gap = n > 12 ? 2 : n > 7 ? 3 : 4;
  const barW = Math.max(4, Math.floor((chartWidth - (n - 1) * gap) / n));
  const maxIdx = data.reduce((best, item, i) => (item.value > data[best].value ? i : best), 0);
  const gridLines = [0.25, 0.5, 0.75, 1.0];

  return (
    <Svg width={chartWidth} height={totalH} style={{ marginTop: Spacing.md }}>
      {/* Grid lines */}
      {gridLines.map((pct) => {
        const y = chartHeight - chartHeight * pct;
        return (
          <Line
            key={pct}
            x1={0}
            y1={y}
            x2={chartWidth}
            y2={y}
            stroke={theme.separator}
            strokeWidth={0.5}
            strokeOpacity={0.6}
          />
        );
      })}

      {/* Bars + labels */}
      {data.map((item, i) => {
        const barH = maxValue > 0 ? Math.max(3, (item.value / maxValue) * chartHeight) : 3;
        const x = i * (barW + gap);
        const y = chartHeight - barH;
        const hasValue = item.value > 0;
        const isMax = i === maxIdx && hasValue;
        const showLabel =
          n <= 7 || i % Math.ceil(n / 6) === 0 || i === n - 1;

        return (
          <G key={i}>
            {/* Peak label */}
            {isMax ? (
              <SvgText
                x={x + barW / 2}
                y={y - 5}
                fontSize={8}
                fontWeight="700"
                fill={Colors.accent}
                textAnchor="middle"
              >
                {formatDollars(item.value)}
              </SvgText>
            ) : null}

            {/* Bar */}
            <Rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={Math.min(barW / 2, 4)}
              fill={hasValue ? Colors.accent : theme.separator}
              opacity={hasValue ? 1 : 0.35}
            />

            {/* X-axis label */}
            {showLabel ? (
              <SvgText
                x={x + barW / 2}
                y={chartHeight + 16}
                fontSize={8}
                fontWeight="500"
                fill={theme.textTertiary ?? theme.textSecondary}
                textAnchor="middle"
              >
                {item.label}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

// ─── HomeBase Date Range Picker ───────────────────────────────────────────────

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function stripTime(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

interface DateRangePickerProps {
  visible: boolean;
  initialStart: Date;
  initialEnd: Date;
  maxDate?: Date;
  onApply: (start: Date, end: Date) => void;
  onClose: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
}

function HomeBaseDateRangePicker({
  visible,
  initialStart,
  initialEnd,
  maxDate,
  onApply,
  onClose,
  theme,
}: DateRangePickerProps) {
  const insets = useSafeAreaInsets();
  const today = stripTime(maxDate ?? new Date());

  const [displayMonth, setDisplayMonth] = useState<Date>(() => {
    const d = new Date(initialStart);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [rangeStart, setRangeStart] = useState<Date | null>(stripTime(initialStart));
  const [rangeEnd, setRangeEnd] = useState<Date | null>(stripTime(initialEnd));

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const goToPrevMonth = () => {
    const d = new Date(displayMonth);
    d.setMonth(d.getMonth() - 1);
    setDisplayMonth(d);
  };

  const goToNextMonth = () => {
    const d = new Date(displayMonth);
    d.setMonth(d.getMonth() + 1);
    setDisplayMonth(d);
  };

  const canGoNext = () => {
    const nextMonth = new Date(year, month + 1, 1);
    return nextMonth <= today;
  };

  const handleDayPress = (day: number) => {
    const tapped = new Date(year, month, day);
    tapped.setHours(0, 0, 0, 0);

    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(tapped);
      setRangeEnd(null);
    } else {
      if (tapped < rangeStart) {
        setRangeStart(tapped);
        setRangeEnd(rangeStart);
      } else {
        setRangeEnd(tapped);
      }
    }
    Haptics.selectionAsync();
  };

  const getDayState = (day: number): "start" | "end" | "inRange" | "single" | "none" => {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    if (!rangeStart) return "none";
    const isStart = isSameDay(d, rangeStart);
    const isEnd = rangeEnd ? isSameDay(d, rangeEnd) : false;
    if (!rangeEnd) return isStart ? "single" : "none";
    if (isStart && isEnd) return "single";
    if (isStart) return "start";
    if (isEnd) return "end";
    if (d > rangeStart && d < rangeEnd) return "inRange";
    return "none";
  };

  const isFuture = (day: number): boolean => {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return d > today;
  };

  const formattedStart = rangeStart
    ? rangeStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Start date";
  const formattedEnd = rangeEnd
    ? rangeEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : rangeStart
    ? "End date"
    : "End date";

  const canApply = !!(rangeStart && rangeEnd);

  const CELL_SIZE = Math.floor((Dimensions.get("window").width - 32 - 40) / 7);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            pickerStyles.sheet,
            {
              backgroundColor: theme.background,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
        >
          {/* Header */}
          <View style={pickerStyles.sheetHeader}>
            <View style={[pickerStyles.handle, { backgroundColor: theme.separator }]} />
            <ThemedText style={pickerStyles.sheetTitle}>Select Date Range</ThemedText>
          </View>

          {/* Selected range display */}
          <View style={[pickerStyles.rangeDisplay, { backgroundColor: theme.backgroundSecondary, borderColor: theme.separator }]}>
            <View style={pickerStyles.rangeField}>
              <ThemedText style={[pickerStyles.rangeFieldLabel, { color: theme.textSecondary }]}>From</ThemedText>
              <ThemedText
                style={[
                  pickerStyles.rangeFieldValue,
                  { color: rangeStart ? Colors.accent : theme.textSecondary },
                ]}
              >
                {formattedStart}
              </ThemedText>
            </View>
            <View style={[pickerStyles.rangeDivider, { backgroundColor: Colors.accent + "40" }]} />
            <View style={pickerStyles.rangeField}>
              <ThemedText style={[pickerStyles.rangeFieldLabel, { color: theme.textSecondary }]}>To</ThemedText>
              <ThemedText
                style={[
                  pickerStyles.rangeFieldValue,
                  { color: rangeEnd ? Colors.accent : theme.textSecondary },
                ]}
              >
                {formattedEnd}
              </ThemedText>
            </View>
          </View>

          {/* Month navigator */}
          <View style={pickerStyles.monthNav}>
            <Pressable
              style={[pickerStyles.navBtn, { backgroundColor: theme.backgroundSecondary }]}
              onPress={goToPrevMonth}
              hitSlop={12}
            >
              <Feather name="chevron-left" size={18} color={theme.text} />
            </Pressable>
            <ThemedText style={pickerStyles.monthTitle}>
              {MONTHS[month]} {year}
            </ThemedText>
            <Pressable
              style={[
                pickerStyles.navBtn,
                { backgroundColor: theme.backgroundSecondary },
                !canGoNext() && { opacity: 0.3 },
              ]}
              onPress={canGoNext() ? goToNextMonth : undefined}
              hitSlop={12}
              disabled={!canGoNext()}
            >
              <Feather name="chevron-right" size={18} color={theme.text} />
            </Pressable>
          </View>

          {/* Day of week headers */}
          <View style={pickerStyles.dowRow}>
            {DAYS_OF_WEEK.map((d) => (
              <View key={d} style={[pickerStyles.dowCell, { width: CELL_SIZE }]}>
                <ThemedText style={[pickerStyles.dowLabel, { color: theme.textSecondary }]}>{d[0]}</ThemedText>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={pickerStyles.grid}>
            {Array.from({ length: Math.ceil(cells.length / 7) }, (_, weekIdx) => (
              <View key={weekIdx} style={pickerStyles.weekRow}>
                {cells.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, dayIdx) => {
                  const cellKey = `w${weekIdx}-d${dayIdx}`;
                  if (!day) {
                    return <View key={cellKey} style={{ width: CELL_SIZE, height: CELL_SIZE }} />;
                  }
                  const state = getDayState(day);
                  const future = isFuture(day);
                  const isSelected = state === "start" || state === "end" || state === "single";
                  const inRange = state === "inRange";

                  const isFirstInWeek = dayIdx === 0;
                  const isLastInWeek = dayIdx === 6;
                  const isStartDay = state === "start";
                  const isEndDay = state === "end";

                  // Left half green: inRange OR end day
                  const showLeft = inRange || isEndDay;
                  // Right half green: inRange OR start day
                  const showRight = inRange || isStartDay;

                  return (
                    <Pressable
                      key={cellKey}
                      style={[pickerStyles.dayCell, { width: CELL_SIZE, height: CELL_SIZE }]}
                      onPress={() => !future && handleDayPress(day)}
                      disabled={future}
                      testID={`calendar-day-${day}`}
                    >
                      {/* Left half strip */}
                      {showLeft ? (
                        <View
                          style={[
                            pickerStyles.rangeStrip,
                            {
                              left: 0,
                              right: "50%",
                              backgroundColor: Colors.accent + "22",
                              borderTopLeftRadius: isFirstInWeek ? 8 : 0,
                              borderBottomLeftRadius: isFirstInWeek ? 8 : 0,
                            },
                          ]}
                        />
                      ) : null}
                      {/* Right half strip */}
                      {showRight ? (
                        <View
                          style={[
                            pickerStyles.rangeStrip,
                            {
                              left: "50%",
                              right: 0,
                              backgroundColor: Colors.accent + "22",
                              borderTopRightRadius: isLastInWeek ? 8 : 0,
                              borderBottomRightRadius: isLastInWeek ? 8 : 0,
                            },
                          ]}
                        />
                      ) : null}

                      {/* Circle for selected days */}
                      <View
                        style={[
                          pickerStyles.dayCircle,
                          { width: Math.min(CELL_SIZE - 4, 36), height: Math.min(CELL_SIZE - 4, 36) },
                          isSelected && { backgroundColor: Colors.accent },
                        ]}
                      >
                        <ThemedText
                          style={[
                            pickerStyles.dayText,
                            isSelected && { color: "#FFFFFF", fontWeight: "700" },
                            inRange && { color: Colors.accent, fontWeight: "600" },
                            future && { opacity: 0.3 },
                          ]}
                        >
                          {day}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Hint text */}
          {rangeStart && !rangeEnd ? (
            <ThemedText style={[pickerStyles.hintText, { color: theme.textSecondary }]}>
              Tap another date to set the end
            </ThemedText>
          ) : null}

          {/* Actions */}
          <View style={pickerStyles.actions}>
            <Pressable
              style={[pickerStyles.cancelBtn, { borderColor: theme.separator }]}
              onPress={onClose}
            >
              <ThemedText style={[pickerStyles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              style={[pickerStyles.applyBtn, { backgroundColor: canApply ? Colors.accent : Colors.accent + "40" }]}
              onPress={() => {
                if (rangeStart && rangeEnd) {
                  onApply(rangeStart, rangeEnd);
                }
              }}
              disabled={!canApply}
              testID="button-apply-date-range"
            >
              <ThemedText style={[pickerStyles.applyBtnText, { color: canApply ? "#FFFFFF" : "#FFFFFF80" }]}>
                Apply Range
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHeader: { alignItems: "center", marginBottom: 16 },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },

  rangeDisplay: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
    overflow: "hidden",
  },
  rangeField: { flex: 1, alignItems: "center", paddingVertical: 12 },
  rangeFieldLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 },
  rangeFieldValue: { fontSize: 14, fontWeight: "700" },
  rangeDivider: { width: 1 },

  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: { fontSize: 17, fontWeight: "700" },

  dowRow: { flexDirection: "row", marginBottom: 8 },
  dowCell: { alignItems: "center", justifyContent: "center" },
  dowLabel: { fontSize: 12, fontWeight: "600" },

  grid: { marginBottom: 8 },
  weekRow: { flexDirection: "row" },
  dayCell: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  rangeStrip: {
    position: "absolute",
    top: 2,
    bottom: 2,
  },
  dayCircle: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  dayText: { fontSize: 15, fontWeight: "500" },

  hintText: { textAlign: "center", fontSize: 12, marginBottom: 8 },

  actions: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 16, fontWeight: "600" },
  applyBtn: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: { fontSize: 16, fontWeight: "700" },
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
  const [showDatePicker, setShowDatePicker] = useState(false);

  const defaultCustomStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [customStart, setCustomStart] = useState<Date>(defaultCustomStart);
  const [customEnd, setCustomEnd] = useState<Date>(new Date());

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

  // ── Invoices ───────────────────────────────────────────────────────────────

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
      if (data.onboardingUrl) Linking.openURL(data.onboardingUrl);
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

  // ── Custom date range display chip ─────────────────────────────────────────

  const customRangeSummary =
    dateRange === "custom"
      ? `${customStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${customEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      : null;

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
                onPress={() => {
                  Haptics.selectionAsync();
                  setDateRange(opt.key);
                  if (opt.key === "custom") setShowDatePicker(true);
                }}
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

      {/* Custom range chip — tappable to re-open picker */}
      {dateRange === "custom" ? (
        <Animated.View entering={FadeInDown.delay(70).duration(300)}>
          <Pressable
            style={[styles.customChip, { backgroundColor: Colors.accentLight }]}
            onPress={() => setShowDatePicker(true)}
            testID="button-open-date-picker"
          >
            <Feather name="calendar" size={13} color={Colors.accent} />
            <ThemedText style={[styles.customChipText, { color: Colors.accent }]}>
              {customRangeSummary}
            </ThemedText>
            <Feather name="chevron-down" size={13} color={Colors.accent} />
          </Pressable>
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
                  : dateRange === "year"
                  ? "Revenue This Year"
                  : customRangeSummary ?? "Custom Range"}
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

        <HomeBaseDateRangePicker
          visible={showDatePicker}
          initialStart={customStart}
          initialEnd={customEnd}
          maxDate={new Date()}
          onApply={(s, e) => {
            setCustomStart(s);
            setCustomEnd(e);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
          theme={theme}
        />
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
        <HomeBaseDateRangePicker
          visible={showDatePicker}
          initialStart={customStart}
          initialEnd={customEnd}
          maxDate={new Date()}
          onApply={(s, e) => {
            setCustomStart(s);
            setCustomEnd(e);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
          theme={theme}
        />
      </ThemedView>
    );
  }

  // Transactions — Payouts tab
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
      <HomeBaseDateRangePicker
        visible={showDatePicker}
        initialStart={customStart}
        initialEnd={customEnd}
        maxDate={new Date()}
        onApply={(s, e) => {
          setCustomStart(s);
          setCustomEnd(e);
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
        theme={theme}
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
    marginBottom: Spacing.sm,
  },
  dateRangeItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: BorderRadius.sm,
  },
  dateRangeLabel: { ...Typography.footnote, fontWeight: "500" },

  // Custom date chip
  customChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: Spacing.md,
  },
  customChipText: { ...Typography.footnote, fontWeight: "600" },

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
  chartSkeleton: { height: 144, borderRadius: BorderRadius.sm, marginTop: Spacing.sm },

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

  // Stripe nudge
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
