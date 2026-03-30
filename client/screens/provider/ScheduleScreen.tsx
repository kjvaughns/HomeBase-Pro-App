import React, { useState, useMemo, useRef, useCallback } from "react";
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
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus =
  | "scheduled"
  | "confirmed"
  | "on_my_way"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

type StatusFilter = "all" | "scheduled" | "active" | "done";
type ViewMode = "list" | "month";

interface Job {
  id: string;
  providerId: string;
  clientId: string;
  title: string;
  description?: string | null;
  scheduledDate: string;
  scheduledTime?: string | null;
  estimatedDuration?: number | null;
  status: JobStatus;
  estimatedPrice?: string | null;
  address?: string | null;
  notes?: string | null;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_COLOR: Record<JobStatus, string> = {
  scheduled: "#3B82F6",
  confirmed: "#8B5CF6",
  on_my_way: "#F59E0B",
  arrived: "#F59E0B",
  in_progress: "#F59E0B",
  completed: Colors.accent,
  cancelled: "#9CA3AF",
};

const STATUS_LABEL: Record<JobStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  on_my_way: "On My Way",
  arrived: "Arrived",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "scheduled", label: "Scheduled" },
  { key: "active", label: "Active" },
  { key: "done", label: "Done" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDateLabel(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, tomorrow)) return "Tomorrow";
  return `${DAYS_SHORT[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

function formatTime(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function matchesFilter(status: JobStatus, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "scheduled") return status === "scheduled" || status === "confirmed";
  if (filter === "active") return ["on_my_way", "arrived", "in_progress"].includes(status);
  if (filter === "done") return status === "completed";
  return true;
}

function getQuickAction(status: JobStatus): { label: string; next: string; icon: keyof typeof Feather.glyphMap } | null {
  if (status === "scheduled" || status === "confirmed") {
    return { label: "Start", next: "start", icon: "play" };
  }
  if (status === "on_my_way" || status === "arrived" || status === "in_progress") {
    return { label: "Complete", next: "complete", icon: "check" };
  }
  return null;
}

function getMonthDates(date: Date): (Date | null)[][] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];
  for (let i = 0; i < firstDay.getDay(); i++) currentWeek.push(null);
  for (let day = 1; day <= lastDay.getDate(); day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }
  return weeks;
}

// ─── Week Strip ───────────────────────────────────────────────────────────────

interface WeekStripProps {
  selectedDate: Date;
  jobs: Job[];
  onDateSelect: (date: Date) => void;
}

function WeekStrip({ selectedDate, jobs, onDateSelect }: WeekStripProps) {
  const { theme } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const today = useMemo(() => startOfDay(new Date()), []);
  const CELL_WIDTH = 52;
  const DAYS_WINDOW = 60;

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = -14; i < DAYS_WINDOW - 14; i++) {
      result.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
    }
    return result;
  }, []);

  const jobCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const job of jobs) {
      if (job.status === "cancelled") continue;
      const key = startOfDay(new Date(job.scheduledDate)).toDateString();
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [jobs]);

  const scrollToToday = useCallback(() => {
    const todayIdx = 14;
    const offset = todayIdx * CELL_WIDTH - 120;
    scrollRef.current?.scrollTo({ x: Math.max(0, offset), animated: false });
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={scrollToToday}
      contentContainerStyle={styles.weekStripContent}
      style={styles.weekStrip}
    >
      {days.map((date) => {
        const isToday = isSameDay(date, today);
        const isSelected = isSameDay(date, selectedDate);
        const jobCount = jobCountByDate[date.toDateString()] || 0;

        return (
          <Pressable
            key={date.toISOString()}
            style={[
              styles.weekDay,
              isToday && !isSelected && { backgroundColor: Colors.accentLight },
              isSelected && { backgroundColor: Colors.accent },
            ]}
            onPress={() => onDateSelect(date)}
          >
            <ThemedText
              style={[
                styles.weekDayName,
                isSelected && { color: "#FFFFFF" },
                isToday && !isSelected && { color: Colors.accent },
                !isToday && !isSelected && { color: theme.textTertiary },
              ]}
            >
              {DAYS_SHORT[date.getDay()].slice(0, 3)}
            </ThemedText>
            <ThemedText
              style={[
                styles.weekDayNum,
                isSelected && { color: "#FFFFFF" },
                isToday && !isSelected && { color: Colors.accent },
              ]}
            >
              {date.getDate()}
            </ThemedText>
            {jobCount > 0 ? (
              <View
                style={[
                  styles.weekDotBadge,
                  { backgroundColor: isSelected ? "rgba(255,255,255,0.7)" : Colors.accent },
                ]}
              >
                <ThemedText
                  style={[
                    styles.weekDotText,
                    { color: isSelected ? Colors.accent : "#FFFFFF" },
                  ]}
                >
                  {jobCount}
                </ThemedText>
              </View>
            ) : (
              <View style={styles.weekDotPlaceholder} />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Today Banner ─────────────────────────────────────────────────────────────

interface TodayBannerProps {
  jobs: Job[];
  clients: Client[];
  getClientName: (id: string) => string;
}

function TodayBanner({ jobs, getClientName }: TodayBannerProps) {
  const { theme } = useTheme();
  const now = new Date();

  const todayJobs = jobs.filter(
    (j) => j.status !== "cancelled" && isSameDay(new Date(j.scheduledDate), now)
  );
  const totalRevenue = todayJobs.reduce((sum, j) => sum + parseFloat(j.estimatedPrice || "0"), 0);

  const upcomingJob = todayJobs
    .filter((j) => j.status !== "completed" && j.status !== "cancelled")
    .sort((a, b) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""))[0];

  const nextUpText = upcomingJob
    ? `${upcomingJob.title}${upcomingJob.scheduledTime ? ` @ ${formatTime(upcomingJob.scheduledTime)}` : ""}`
    : "All caught up today";

  if (todayJobs.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.duration(300)}>
      <GlassCard style={styles.todayBanner}>
        <View style={styles.todayStats}>
          <View style={styles.todayStat}>
            <View style={[styles.todayStatIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name="briefcase" size={14} color={Colors.accent} />
            </View>
            <View>
              <ThemedText style={styles.todayStatNum}>{todayJobs.length}</ThemedText>
              <ThemedText style={[styles.todayStatLabel, { color: theme.textTertiary }]}>Jobs</ThemedText>
            </View>
          </View>

          <View style={[styles.todayDivider, { backgroundColor: theme.separator }]} />

          <View style={styles.todayStat}>
            <View style={[styles.todayStatIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name="dollar-sign" size={14} color={Colors.accent} />
            </View>
            <View>
              <ThemedText style={styles.todayStatNum}>
                ${totalRevenue > 0 ? totalRevenue.toLocaleString() : "—"}
              </ThemedText>
              <ThemedText style={[styles.todayStatLabel, { color: theme.textTertiary }]}>Expected</ThemedText>
            </View>
          </View>

          <View style={[styles.todayDivider, { backgroundColor: theme.separator }]} />

          <View style={[styles.todayStat, { flex: 1 }]}>
            <View style={[styles.todayStatIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name="clock" size={14} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.todayStatNum} numberOfLines={1}>
                {upcomingJob ? "Next Up" : "Done"}
              </ThemedText>
              <ThemedText
                style={[styles.todayStatLabel, { color: theme.textTertiary }]}
                numberOfLines={1}
              >
                {nextUpText}
              </ThemedText>
            </View>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

// ─── Enhanced Job Card ────────────────────────────────────────────────────────

interface EnhancedJobCardProps {
  job: Job;
  clientName: string;
  onPress: () => void;
  onQuickAction: (action: string) => void;
  isActionLoading: boolean;
}

function EnhancedJobCard({ job, clientName, onPress, onQuickAction, isActionLoading }: EnhancedJobCardProps) {
  const { theme } = useTheme();
  const statusColor = STATUS_COLOR[job.status];
  const quickAction = getQuickAction(job.status);

  return (
    <Pressable onPress={onPress} testID={`job-card-${job.id}`}>
      <GlassCard style={styles.jobCard} noPadding>
        <View style={styles.jobCardInner}>
          <View style={[styles.jobStatusBar, { backgroundColor: statusColor }]} />

          <View style={styles.jobCardContent}>
            <View style={styles.jobCardTop}>
              {/* Left: Time */}
              <View style={styles.jobTimeCol}>
                {job.scheduledTime ? (
                  <>
                    <ThemedText style={styles.jobTime}>{formatTime(job.scheduledTime).split(" ")[0]}</ThemedText>
                    <ThemedText style={[styles.jobTimeAmPm, { color: theme.textTertiary }]}>
                      {formatTime(job.scheduledTime).split(" ")[1]}
                    </ThemedText>
                  </>
                ) : (
                  <ThemedText style={[styles.jobTimeAmPm, { color: theme.textTertiary }]}>—</ThemedText>
                )}
              </View>

              {/* Middle: Info */}
              <View style={styles.jobInfoCol}>
                <View style={styles.jobClientRow}>
                  <View style={[styles.jobAvatar, { backgroundColor: statusColor + "22" }]}>
                    <ThemedText style={[styles.jobAvatarText, { color: statusColor }]}>
                      {getInitials(clientName)}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.jobClientName} numberOfLines={1}>{clientName}</ThemedText>
                    <ThemedText style={[styles.jobService, { color: Colors.accent }]} numberOfLines={1}>
                      {job.title}
                    </ThemedText>
                  </View>
                </View>

                {job.address ? (
                  <View style={styles.jobAddressRow}>
                    <Feather name="map-pin" size={11} color={theme.textTertiary} />
                    <ThemedText style={[styles.jobAddress, { color: theme.textTertiary }]} numberOfLines={1}>
                      {job.address}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              {/* Right: Price + Chevron */}
              <View style={styles.jobRightCol}>
                {job.estimatedPrice ? (
                  <ThemedText style={[styles.jobPrice, { color: Colors.accent }]}>
                    ${parseFloat(job.estimatedPrice).toFixed(0)}
                  </ThemedText>
                ) : null}
                <Feather name="chevron-right" size={16} color={theme.textTertiary} />
              </View>
            </View>

            {/* Footer: Status pill + Quick Action */}
            <View style={styles.jobCardFooter}>
              <View
                style={[
                  styles.statusPillInline,
                  { backgroundColor: statusColor + "18", borderColor: statusColor + "30" },
                ]}
              >
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <ThemedText style={[styles.statusPillText, { color: statusColor }]}>
                  {STATUS_LABEL[job.status]}
                </ThemedText>
              </View>

              {quickAction ? (
                <Pressable
                  style={[styles.quickActionBtn, { backgroundColor: statusColor }]}
                  onPress={() => onQuickAction(quickAction.next)}
                  disabled={isActionLoading}
                  testID={`quick-action-${job.id}`}
                >
                  {isActionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name={quickAction.icon} size={12} color="#FFFFFF" />
                      <ThemedText style={styles.quickActionText}>{quickAction.label}</ThemedText>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

// ─── Month Calendar ───────────────────────────────────────────────────────────

interface MonthViewProps {
  selectedDate: Date;
  calendarMonth: Date;
  jobs: Job[];
  clients: Client[];
  getClientName: (id: string) => string;
  onDateSelect: (date: Date) => void;
  onMonthChange: (delta: number) => void;
  onJobPress: (jobId: string) => void;
  onQuickAction: (jobId: string, action: string) => void;
  actionLoadingId: string | null;
}

function MonthView({
  selectedDate,
  calendarMonth,
  jobs,
  getClientName,
  onDateSelect,
  onMonthChange,
  onJobPress,
  onQuickAction,
  actionLoadingId,
}: MonthViewProps) {
  const { theme } = useTheme();
  const weeks = getMonthDates(calendarMonth);
  const today = new Date();

  const getJobsForDate = (date: Date) =>
    jobs.filter((j) => j.status !== "cancelled" && isSameDay(new Date(j.scheduledDate), date));

  const selectedDayJobs = getJobsForDate(selectedDate);

  return (
    <ScrollView style={styles.monthScroll} showsVerticalScrollIndicator={false}>
      {/* Month Navigation */}
      <View style={styles.monthNavRow}>
        <Pressable style={styles.monthNavBtn} onPress={() => onMonthChange(-1)} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.textSecondary} />
        </Pressable>
        <ThemedText style={styles.monthNavTitle}>
          {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
        </ThemedText>
        <Pressable style={styles.monthNavBtn} onPress={() => onMonthChange(1)} hitSlop={8}>
          <Feather name="chevron-right" size={22} color={theme.textSecondary} />
        </Pressable>
      </View>

      {/* Day-of-week header */}
      <View style={styles.calendarHeader}>
        {DAYS_SHORT.map((day) => (
          <View key={day} style={styles.calendarHeaderDay}>
            <ThemedText style={[styles.calendarDayLabel, { color: theme.textTertiary }]}>
              {day.slice(0, 2)}
            </ThemedText>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.calendarWeek}>
          {week.map((date, di) => {
            if (!date) return <View key={`e-${di}`} style={styles.calendarDay} />;
            const dayJobs = getJobsForDate(date);
            const isToday = isSameDay(date, today);
            const isSelected = isSameDay(date, selectedDate);

            return (
              <Pressable
                key={date.toISOString()}
                style={[
                  styles.calendarDay,
                  isToday && !isSelected && { backgroundColor: Colors.accentLight },
                  isSelected && { backgroundColor: Colors.accent },
                ]}
                onPress={() => onDateSelect(date)}
              >
                <ThemedText
                  style={[
                    styles.calendarDayNum,
                    isSelected && { color: "#FFFFFF" },
                    isToday && !isSelected && { color: Colors.accent },
                  ]}
                >
                  {date.getDate()}
                </ThemedText>
                {dayJobs.length > 0 ? (
                  <View style={styles.calendarDots}>
                    {dayJobs.slice(0, 3).map((j, i) => (
                      <View
                        key={i}
                        style={[
                          styles.calendarDot,
                          { backgroundColor: isSelected ? "rgba(255,255,255,0.8)" : STATUS_COLOR[j.status] },
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Selected Day Job List */}
      <View style={[styles.monthDayPanel, { borderTopColor: theme.separator }]}>
        <ThemedText style={[styles.monthDayTitle, { color: theme.textSecondary }]}>
          {formatDateLabel(selectedDate).toUpperCase()}
        </ThemedText>

        {selectedDayJobs.length === 0 ? (
          <ThemedText style={[styles.monthEmpty, { color: theme.textTertiary }]}>
            No jobs on this day
          </ThemedText>
        ) : (
          selectedDayJobs.map((job) => (
            <EnhancedJobCard
              key={job.id}
              job={job}
              clientName={getClientName(job.clientId)}
              onPress={() => onJobPress(job.id)}
              onQuickAction={(action) => onQuickAction(job.id, action)}
              isActionLoading={actionLoadingId === job.id}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();
  const queryClient = useQueryClient();

  const providerId = providerProfile?.id;
  const today = useMemo(() => startOfDay(new Date()), []);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const { data: jobsData, isLoading, refetch } = useQuery<{ jobs: Job[] }>({
    queryKey: ["/api/provider", providerId, "jobs"],
    enabled: !!providerId,
  });

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const jobs = jobsData?.jobs || [];
  const clients = clientsData?.clients || [];

  const getClientName = useCallback(
    (clientId: string) => {
      const c = clients.find((cl) => cl.id === clientId);
      return c ? `${c.firstName} ${c.lastName}` : "Client";
    },
    [clients]
  );

  const startMutation = useMutation({
    mutationFn: (jobId: string) => apiRequest("POST", `/api/jobs/${jobId}/start`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "jobs"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onSettled: () => setActionLoadingId(null),
  });

  const completeMutation = useMutation({
    mutationFn: (jobId: string) => apiRequest("POST", `/api/jobs/${jobId}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "jobs"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onSettled: () => setActionLoadingId(null),
  });

  const handleQuickAction = useCallback(
    (jobId: string, action: string) => {
      setActionLoadingId(jobId);
      if (action === "start") startMutation.mutate(jobId);
      else if (action === "complete") completeMutation.mutate(jobId);
    },
    [startMutation, completeMutation]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleJobPress = (jobId: string) => {
    navigation.navigate("ProviderJobDetail", { jobId });
  };

  const handleAddJob = () => {
    navigation.navigate("AddJob");
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    if (viewMode === "month") {
      setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const isToday = isSameDay(selectedDate, today);

  // Filter jobs by selected date + status filter
  const filteredJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        if (job.status === "cancelled") return false;
        if (!isSameDay(new Date(job.scheduledDate), selectedDate)) return false;
        return matchesFilter(job.status, statusFilter);
      })
      .sort((a, b) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""));
  }, [jobs, selectedDate, statusFilter]);

  // Build FlatList rows with a single date header
  type ListRow =
    | { type: "banner"; key: string }
    | { type: "dateHeader"; key: string; label: string }
    | { type: "job"; key: string; job: Job }
    | { type: "empty"; key: string };

  const listData = useMemo((): ListRow[] => {
    const rows: ListRow[] = [];
    if (isToday && jobs.length > 0) {
      rows.push({ type: "banner", key: "banner" });
    }
    rows.push({ type: "dateHeader", key: "dateHeader", label: formatDateLabel(selectedDate) });
    if (filteredJobs.length === 0) {
      rows.push({ type: "empty", key: "empty" });
    } else {
      for (const job of filteredJobs) {
        rows.push({ type: "job", key: `job-${job.id}`, job });
      }
    }
    return rows;
  }, [filteredJobs, isToday, jobs.length, selectedDate]);

  const isCalendarMode = viewMode === "month";

  return (
    <ThemedView style={styles.container}>
      {/* ── Fixed Header ── */}
      <View style={[styles.header, { paddingTop: headerHeight + Spacing.md }]}>
        {/* Title Row */}
        <View style={styles.headerRow}>
          <ThemedText style={styles.headerTitle}>
            {isCalendarMode
              ? `${MONTHS[calendarMonth.getMonth()]} ${calendarMonth.getFullYear()}`
              : "Schedule"}
          </ThemedText>
          <View style={styles.headerActions}>
            <Pressable
              style={[
                styles.iconBtn,
                {
                  backgroundColor: isCalendarMode ? Colors.accent : theme.backgroundSecondary,
                },
              ]}
              onPress={() => {
                setViewMode(isCalendarMode ? "list" : "month");
                setSelectedDate(today);
                setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              }}
              testID="button-calendar-toggle"
            >
              <Feather name="calendar" size={16} color={isCalendarMode ? "#FFFFFF" : theme.textSecondary} />
            </Pressable>
            <Pressable
              style={[styles.addBtn, { backgroundColor: Colors.accent }]}
              onPress={handleAddJob}
              testID="button-add-job"
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Week Strip (list mode only) */}
        {!isCalendarMode ? (
          <View style={styles.weekStripWrapper}>
            <WeekStrip
              selectedDate={selectedDate}
              jobs={jobs}
              onDateSelect={handleDateSelect}
            />
          </View>
        ) : null}

        {/* Status Filter Chips */}
        {!isCalendarMode ? (
          <View style={styles.chipsRow}>
            {STATUS_CHIPS.map((chip) => {
              const isActive = statusFilter === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isActive ? Colors.accent : theme.backgroundSecondary,
                    },
                  ]}
                  onPress={() => setStatusFilter(chip.key)}
                  testID={`chip-status-${chip.key}`}
                >
                  <ThemedText style={[styles.chipText, { color: isActive ? "#FFFFFF" : theme.textSecondary }]}>
                    {chip.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* ── Content ── */}
      <View style={[styles.content, { paddingBottom: tabBarHeight }]}>
        {isCalendarMode ? (
          <MonthView
            selectedDate={selectedDate}
            calendarMonth={calendarMonth}
            jobs={jobs}
            clients={clients}
            getClientName={getClientName}
            onDateSelect={handleDateSelect}
            onMonthChange={(delta) =>
              setCalendarMonth(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
              )
            }
            onJobPress={handleJobPress}
            onQuickAction={handleQuickAction}
            actionLoadingId={actionLoadingId}
          />
        ) : isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item.key}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              listData.every((r) => r.type !== "job") && styles.listEmpty,
            ]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
            }
            renderItem={({ item, index }) => {
              if (item.type === "banner") {
                return (
                  <Animated.View entering={FadeInDown.delay(0).duration(350)}>
                    <TodayBanner jobs={jobs} clients={clients} getClientName={getClientName} />
                  </Animated.View>
                );
              }
              if (item.type === "dateHeader") {
                return (
                  <Animated.View entering={FadeInDown.delay(50).duration(300)}>
                    <View style={styles.dateLabelRow}>
                      <ThemedText style={[styles.dateLabel, { color: theme.textSecondary }]}>
                        {item.label}
                      </ThemedText>
                      {filteredJobs.length > 0 ? (
                        <View style={[styles.jobCountBadge, { backgroundColor: Colors.accentLight }]}>
                          <ThemedText style={[styles.jobCountText, { color: Colors.accent }]}>
                            {filteredJobs.length}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                  </Animated.View>
                );
              }
              if (item.type === "empty") {
                return (
                  <Animated.View entering={FadeInDown.delay(80).duration(300)}>
                    <View style={styles.emptyBox}>
                      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
                        <Feather name="calendar" size={28} color={theme.textTertiary} />
                      </View>
                      <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
                        {statusFilter === "all" ? "Nothing scheduled" : `No ${statusFilter} jobs`}
                      </ThemedText>
                      <ThemedText style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
                        {formatDateLabel(selectedDate)}
                      </ThemedText>
                      <Pressable
                        style={[styles.emptyAddBtn, { backgroundColor: Colors.accent }]}
                        onPress={handleAddJob}
                      >
                        <Feather name="plus" size={16} color="#FFFFFF" />
                        <ThemedText style={styles.emptyAddText}>Add Job</ThemedText>
                      </Pressable>
                    </View>
                  </Animated.View>
                );
              }
              if (item.type === "job") {
                return (
                  <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
                    <EnhancedJobCard
                      job={item.job}
                      clientName={getClientName(item.job.clientId)}
                      onPress={() => handleJobPress(item.job.id)}
                      onQuickAction={(action) => handleQuickAction(item.job.id, action)}
                      isActionLoading={actionLoadingId === item.job.id}
                    />
                  </Animated.View>
                );
              }
              return null;
            }}
          />
        )}
      </View>
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.title3,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  // Week Strip
  weekStripWrapper: {
    marginHorizontal: -Spacing.screenPadding,
    marginBottom: Spacing.md,
  },
  weekStrip: {
    flexGrow: 0,
  },
  weekStripContent: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.xs,
  },
  weekDay: {
    width: 48,
    alignItems: "center",
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
    gap: 2,
  },
  weekDayName: {
    ...Typography.caption2,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  weekDayNum: {
    ...Typography.subhead,
    fontWeight: "700",
  },
  weekDotBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  weekDotText: {
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
  },
  weekDotPlaceholder: {
    height: 16,
  },

  // Status Chips
  chipsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    ...Typography.caption1,
    fontWeight: "600",
  },

  // Content
  content: { flex: 1 },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  listEmpty: {
    flexGrow: 1,
  },

  // Today Banner
  todayBanner: {
    marginBottom: Spacing.xs,
  },
  todayStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  todayStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  todayStatIcon: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  todayStatNum: {
    ...Typography.callout,
    fontWeight: "700",
  },
  todayStatLabel: {
    ...Typography.caption2,
  },
  todayDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
  },

  // Date label row
  dateLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  dateLabel: {
    ...Typography.callout,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  jobCountBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  jobCountText: {
    ...Typography.caption1,
    fontWeight: "700",
  },

  // Enhanced Job Card
  jobCard: {
    overflow: "hidden",
  },
  jobCardInner: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  jobStatusBar: {
    width: 4,
    borderRadius: 0,
  },
  jobCardContent: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  jobCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  jobTimeCol: {
    width: 44,
    alignItems: "center",
    paddingTop: 2,
  },
  jobTime: {
    ...Typography.headline,
    fontWeight: "800",
    lineHeight: 20,
  },
  jobTimeAmPm: {
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 12,
    letterSpacing: 0.3,
  },
  jobInfoCol: {
    flex: 1,
    gap: Spacing.xs,
  },
  jobClientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  jobAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  jobAvatarText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  jobClientName: {
    ...Typography.subhead,
    fontWeight: "700",
  },
  jobService: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  jobAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 40,
  },
  jobAddress: {
    ...Typography.caption2,
    flex: 1,
  },
  jobRightCol: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  jobPrice: {
    ...Typography.callout,
    fontWeight: "700",
  },

  // Job card footer
  jobCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: 40 + Spacing.md,
  },
  statusPillInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  // Empty State
  emptyBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.title3,
    fontWeight: "600",
  },
  emptySubtitle: {
    ...Typography.body,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  emptyAddText: {
    ...Typography.subhead,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Month View
  monthScroll: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
  },
  monthNavBtn: {
    padding: Spacing.xs,
  },
  monthNavTitle: {
    ...Typography.headline,
    fontWeight: "700",
  },
  calendarHeader: {
    flexDirection: "row",
    marginBottom: Spacing.xs,
  },
  calendarHeaderDay: {
    flex: 1,
    alignItems: "center",
  },
  calendarDayLabel: {
    ...Typography.caption2,
    fontWeight: "600",
  },
  calendarWeek: {
    flexDirection: "row",
    marginBottom: 4,
  },
  calendarDay: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.md,
  },
  calendarDayNum: {
    ...Typography.footnote,
    fontWeight: "600",
  },
  calendarDots: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },
  calendarDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  monthDayPanel: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  monthDayTitle: {
    ...Typography.caption1,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  monthEmpty: {
    ...Typography.body,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
});
