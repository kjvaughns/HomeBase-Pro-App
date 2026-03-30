import React, { useState, useMemo } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type ViewMode = "list" | "month";
type DateRange = "today" | "week" | "month" | "all";

interface Job {
  id: string;
  providerId: string;
  clientId: string;
  title: string;
  description?: string;
  scheduledDate: string;
  scheduledTime?: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  estimatedPrice?: string;
  address?: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDate(date: Date): string {
  return `${MONTHS[date.getMonth()].substring(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function getMonthDates(date: Date): (Date | null)[][] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const weeks: (Date | null)[][] = [];

  let currentWeek: (Date | null)[] = [];
  for (let i = 0; i < firstDay.getDay(); i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

function getStatusType(status: Job["status"]): "info" | "warning" | "success" | "neutral" {
  switch (status) {
    case "scheduled": return "info";
    case "in_progress": return "warning";
    case "completed": return "success";
    default: return "neutral";
  }
}

function getStatusLabel(status: Job["status"]): string {
  switch (status) {
    case "scheduled": return "Scheduled";
    case "in_progress": return "In Progress";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    default: return status;
  }
}

interface FormattedJob {
  id: string;
  customerName: string;
  service: string;
  address: string;
  date: string;
  time: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  price: number;
}

interface JobListItemProps {
  job: FormattedJob;
  onPress: () => void;
}

function JobListItem({ job, onPress }: JobListItemProps) {
  const { theme } = useTheme();

  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.jobListItem}>
        <View style={styles.jobListRow}>
          {job.time ? (
            <View style={styles.timeColumn}>
              <ThemedText style={styles.timeText}>{job.time}</ThemedText>
            </View>
          ) : null}
          <View style={styles.jobDetails}>
            <ThemedText style={styles.jobCustomer}>{job.customerName}</ThemedText>
            <ThemedText style={[styles.jobService, { color: Colors.accent }]}>{job.service}</ThemedText>
            {job.address ? (
              <ThemedText style={[styles.jobAddress, { color: theme.textSecondary }]}>
                {job.address}
              </ThemedText>
            ) : null}
            <StatusPill status={getStatusType(job.status)} label={getStatusLabel(job.status)} />
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

interface MonthViewProps {
  selectedDate: Date;
  jobs: FormattedJob[];
  onDateSelect: (date: Date) => void;
  onJobPress: (job: FormattedJob) => void;
}

function MonthView({ selectedDate, jobs, onDateSelect, onJobPress }: MonthViewProps) {
  const { theme } = useTheme();
  const weeks = getMonthDates(selectedDate);
  const today = new Date();

  const getJobsForDate = (date: Date) => jobs.filter((j) => isSameDay(new Date(j.date), date));
  const selectedDayJobs = getJobsForDate(selectedDate);

  return (
    <View style={styles.monthView}>
      <View style={styles.calendarHeader}>
        {DAYS_OF_WEEK.map((day) => (
          <View key={day} style={styles.calendarHeaderDay}>
            <ThemedText style={[styles.calendarDayLabel, { color: theme.textSecondary }]}>{day}</ThemedText>
          </View>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.calendarWeek}>
          {week.map((date, dayIndex) => {
            if (!date) {
              return <View key={`empty-${dayIndex}`} style={styles.calendarDay} />;
            }
            const dayJobs = getJobsForDate(date);
            const isToday = isSameDay(date, today);
            const isSelected = isSameDay(date, selectedDate);

            return (
              <Pressable
                key={date.toISOString()}
                style={[
                  styles.calendarDay,
                  isToday && { backgroundColor: Colors.accentLight },
                  isSelected && { backgroundColor: Colors.accent },
                ]}
                onPress={() => onDateSelect(date)}
              >
                <ThemedText
                  style={[
                    styles.calendarDayNum,
                    isSelected && { color: "#FFFFFF" },
                  ]}
                >
                  {date.getDate()}
                </ThemedText>
                {dayJobs.length > 0 ? (
                  <View style={styles.calendarDots}>
                    {dayJobs.slice(0, 3).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.calendarDot,
                          { backgroundColor: isSelected ? "#FFFFFF" : Colors.accent },
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

      <GlassCard style={styles.monthSummary}>
        <ThemedText style={[styles.selectedDateLabel, { color: theme.textSecondary }]}>
          {formatDate(selectedDate)}
        </ThemedText>
        {selectedDayJobs.length > 0 ? (
          selectedDayJobs.map((job) => (
            <Pressable key={job.id} onPress={() => onJobPress(job)} style={styles.monthJobItem}>
              <View style={[styles.monthJobDot, { backgroundColor: Colors.accent }]} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.monthJobTitle}>
                  {job.time ? `${job.time} - ` : ""}{job.service}
                </ThemedText>
                <ThemedText style={[styles.monthJobCustomer, { color: theme.textSecondary }]}>
                  {job.customerName}
                </ThemedText>
              </View>
            </Pressable>
          ))
        ) : (
          <ThemedText style={[styles.monthJobCustomer, { color: theme.textSecondary }]}>
            No jobs scheduled
          </ThemedText>
        )}
      </GlassCard>
    </View>
  );
}

const DATE_RANGE_CHIPS: { key: DateRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
];

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();

  const providerId = providerProfile?.id;

  const { data: jobsData, isLoading, refetch } = useQuery<{ jobs: Job[] }>({
    queryKey: ["/api/provider", providerId, "jobs"],
    enabled: !!providerId,
  });

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateRange, setDateRange] = useState<DateRange>("week");

  const jobs = jobsData?.jobs || [];
  const clients = clientsData?.clients || [];

  const getClientName = (clientId: string): string => {
    const client = clients.find((c) => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : "Unknown Client";
  };

  const formatJobForDisplay = (job: Job): FormattedJob => ({
    id: job.id,
    customerName: getClientName(job.clientId),
    service: job.title,
    address: job.address || "",
    date: job.scheduledDate,
    time: job.scheduledTime || "",
    status: job.status,
    price: parseFloat(job.estimatedPrice || "0"),
  });

  const filteredJobs = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000 - 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return jobs
      .filter((job) => {
        if (job.status === "cancelled") return false;
        if (dateRange === "all") return true;
        const jobDate = new Date(job.scheduledDate);
        if (dateRange === "today") return jobDate >= todayStart && jobDate <= todayEnd;
        if (dateRange === "week") return jobDate >= todayStart && jobDate <= weekEnd;
        if (dateRange === "month") return jobDate >= todayStart && jobDate <= monthEnd;
        return true;
      })
      .map(formatJobForDisplay)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [jobs, clients, dateRange]);

  const formattedJobs = useMemo(() => {
    return jobs
      .filter((job) => job.status !== "cancelled")
      .map(formatJobForDisplay)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [jobs, clients]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleJobPress = (job: FormattedJob) => {
    navigation.navigate("ProviderJobDetail", { jobId: job.id });
  };

  const handleAddJob = () => {
    navigation.navigate("AddJob");
  };

  const isCalendarView = viewMode === "month";

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: headerHeight + Spacing.md }]}>
        <View style={styles.headerRow}>
          <ThemedText style={styles.headerTitle}>
            {isCalendarView
              ? `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
              : "Schedule"}
          </ThemedText>
          <View style={styles.headerActions}>
            <Pressable
              style={[
                styles.calendarToggle,
                {
                  backgroundColor: isCalendarView ? Colors.accent : theme.cardBackground,
                  borderColor: isCalendarView ? Colors.accent : theme.borderLight,
                },
              ]}
              onPress={() => {
                setViewMode(isCalendarView ? "list" : "month");
                setSelectedDate(new Date());
              }}
              testID="button-calendar-toggle"
            >
              <Feather name="calendar" size={16} color={isCalendarView ? "#fff" : theme.textSecondary} />
            </Pressable>
            <Pressable
              style={[styles.addButton, { backgroundColor: Colors.accent }]}
              onPress={handleAddJob}
              testID="button-add-job"
            >
              <Feather name="plus" size={20} color="white" />
            </Pressable>
          </View>
        </View>

        {!isCalendarView ? (
          <View style={styles.chipsRow}>
            {DATE_RANGE_CHIPS.map((chip) => {
              const isActive = dateRange === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => setDateRange(chip.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isActive ? Colors.accent : theme.cardBackground,
                      borderColor: isActive ? Colors.accent : theme.borderLight,
                    },
                  ]}
                  testID={`chip-range-${chip.key}`}
                >
                  <ThemedText
                    style={[
                      styles.chipText,
                      { color: isActive ? "#FFFFFF" : theme.textSecondary },
                    ]}
                  >
                    {chip.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={[styles.content, { paddingBottom: tabBarHeight + Spacing.lg }]}>
        {!isCalendarView ? (
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.accent} />
            </View>
          ) : (
            <FlatList
              data={filteredJobs}
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
                  <View style={styles.listJobItem}>
                    <ThemedText style={[styles.dateLabel, { color: theme.textSecondary }]}>
                      {formatDate(new Date(item.date))}
                    </ThemedText>
                    <JobListItem job={item} onPress={() => handleJobPress(item)} />
                  </View>
                </Animated.View>
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.listContent,
                filteredJobs.length === 0 && styles.emptyContainer,
              ]}
              ListEmptyComponent={
                <EmptyState
                  image={require("../../../assets/images/empty-bookings.png")}
                  title="No jobs scheduled"
                  description={dateRange === "today" ? "No jobs for today." : dateRange === "week" ? "No jobs this week." : "Add a job to get started."}
                />
              }
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
              }
            />
          )
        ) : (
          <MonthView
            selectedDate={selectedDate}
            jobs={formattedJobs}
            onDateSelect={setSelectedDate}
            onJobPress={handleJobPress}
          />
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.sm,
  },
  chipsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    ...Typography.title3,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  calendarToggle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.xl,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  listJobItem: {
    marginBottom: Spacing.sm,
  },
  dateLabel: {
    ...Typography.caption1,
    marginBottom: Spacing.xs,
  },
  jobListItem: {
    marginBottom: 0,
  },
  jobListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  timeColumn: {
    width: 56,
  },
  timeText: {
    ...Typography.callout,
    fontWeight: "600",
  },
  jobDetails: {
    flex: 1,
    gap: 2,
  },
  jobCustomer: {
    ...Typography.callout,
    fontWeight: "600",
  },
  jobService: {
    ...Typography.footnote,
  },
  jobAddress: {
    ...Typography.caption1,
  },
  monthView: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
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
    borderRadius: BorderRadius.sm,
  },
  calendarDayNum: {
    ...Typography.footnote,
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
  monthSummary: {
    marginTop: Spacing.md,
  },
  selectedDateLabel: {
    ...Typography.caption1,
    marginBottom: Spacing.sm,
  },
  monthJobItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  monthJobDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  monthJobTitle: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  monthJobCustomer: {
    ...Typography.caption2,
  },
});
