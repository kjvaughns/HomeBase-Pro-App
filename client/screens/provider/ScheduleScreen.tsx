import React, { useState, useMemo, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
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

type ViewMode = "list" | "day" | "week" | "month";
type DateRangePreset = "today" | "week" | "month" | "custom";

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
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatDateShort(date: Date): string {
  return `${MONTHS[date.getMonth()].substring(0, 3)} ${date.getDate()}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function getWeekDates(date: Date): Date[] {
  const week: Date[] = [];
  const current = new Date(date);
  const day = current.getDay();
  current.setDate(current.getDate() - day);
  for (let i = 0; i < 7; i++) {
    week.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return week;
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
    case "scheduled":
      return "info";
    case "in_progress":
      return "warning";
    case "completed":
      return "success";
    default:
      return "neutral";
  }
}

function getStatusLabel(status: Job["status"]): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

type StatusFilter = "all" | "scheduled" | "in_progress" | "completed";

interface StatusFilterChipsProps {
  selected: StatusFilter;
  onSelect: (filter: StatusFilter) => void;
}

function StatusFilterChips({ selected, onSelect }: StatusFilterChipsProps) {
  const { theme } = useTheme();
  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "scheduled", label: "Scheduled" },
    { key: "in_progress", label: "In Progress" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.statusFilterContainer}
    >
      {filters.map((filter) => (
        <Pressable
          key={filter.key}
          style={[
            styles.statusFilterChip,
            { borderColor: theme.separator },
            selected === filter.key && { backgroundColor: Colors.accent, borderColor: Colors.accent },
          ]}
          onPress={() => onSelect(filter.key)}
        >
          <ThemedText
            type="caption"
            style={[
              { color: theme.textSecondary },
              selected === filter.key && { color: "#FFFFFF", fontWeight: "600" },
            ]}
          >
            {filter.label}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

interface ViewModeTabsProps {
  selected: ViewMode;
  onSelect: (mode: ViewMode) => void;
}

function ViewModeTabs({ selected, onSelect }: ViewModeTabsProps) {
  const { theme } = useTheme();
  const modes: { key: ViewMode; label: string }[] = [
    { key: "list", label: "List" },
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
  ];

  return (
    <View style={[styles.viewModeTabs, { backgroundColor: theme.cardBackground }]}>
      {modes.map((mode) => (
        <Pressable
          key={mode.key}
          style={[
            styles.viewModeTab,
            selected === mode.key && { backgroundColor: Colors.accent },
          ]}
          onPress={() => onSelect(mode.key)}
        >
          <ThemedText
            type="caption"
            style={[
              { color: theme.textSecondary },
              selected === mode.key && { color: "#FFFFFF", fontWeight: "600" },
            ]}
          >
            {mode.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

interface DateRangePickerProps {
  preset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  customStart: Date | null;
  customEnd: Date | null;
  onCustomStartChange: (date: Date) => void;
  onCustomEndChange: (date: Date) => void;
}

function DateRangePicker({ 
  preset, 
  onPresetChange, 
  customStart, 
  customEnd,
  onCustomStartChange,
  onCustomEndChange 
}: DateRangePickerProps) {
  const { theme } = useTheme();
  const presets: { key: DateRangePreset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "custom", label: "Custom" },
  ];

  const handlePresetChange = (newPreset: DateRangePreset) => {
    onPresetChange(newPreset);
    if (newPreset === "custom" && !customStart) {
      onCustomStartChange(new Date());
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      onCustomEndChange(endDate);
    }
  };

  return (
    <View style={styles.dateRangePicker}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateRangePresets}
      >
        {presets.map((p) => (
          <Pressable
            key={p.key}
            style={[
              styles.dateRangeChip,
              { borderColor: theme.separator },
              preset === p.key && { backgroundColor: Colors.accent, borderColor: Colors.accent },
            ]}
            onPress={() => handlePresetChange(p.key)}
          >
            <ThemedText
              type="caption"
              style={[
                { color: theme.textSecondary },
                preset === p.key && { color: "#FFFFFF", fontWeight: "600" },
              ]}
            >
              {p.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
      
      {preset === "custom" ? (
        <View style={styles.customDateRow}>
          <Pressable
            style={[styles.customDateButton, { backgroundColor: theme.cardBackground }]}
            onPress={() => {
              const newDate = new Date(customStart || new Date());
              newDate.setDate(newDate.getDate() - 1);
              onCustomStartChange(newDate);
            }}
          >
            <Feather name="chevron-left" size={16} color={theme.text} />
          </Pressable>
          <View style={styles.customDateLabels}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {customStart ? formatDateShort(customStart) : "Start"}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}> - </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {customEnd ? formatDateShort(customEnd) : "End"}
            </ThemedText>
          </View>
          <Pressable
            style={[styles.customDateButton, { backgroundColor: theme.cardBackground }]}
            onPress={() => {
              const newDate = new Date(customEnd || new Date());
              newDate.setDate(newDate.getDate() + 1);
              onCustomEndChange(newDate);
            }}
          >
            <Feather name="chevron-right" size={16} color={theme.text} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

interface DateNavigatorProps {
  date: Date;
  viewMode: ViewMode;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

function DateNavigator({ date, viewMode, onPrevious, onNext, onToday }: DateNavigatorProps) {
  const { theme } = useTheme();
  const today = new Date();
  const isToday = isSameDay(date, today);

  const getTitle = () => {
    switch (viewMode) {
      case "list":
      case "day":
        return formatDate(date);
      case "week":
        const weekDates = getWeekDates(date);
        return `${formatDateShort(weekDates[0])} - ${formatDateShort(weekDates[6])}`;
      case "month":
        return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    }
  };

  return (
    <View style={styles.dateNavigator}>
      <View style={styles.dateNavRow}>
        <Pressable
          style={[styles.navButton, { backgroundColor: theme.cardBackground }]}
          onPress={onPrevious}
        >
          <Feather name="chevron-left" size={20} color={theme.text} />
        </Pressable>
        <View style={styles.dateTitle}>
          <ThemedText type="h3">{getTitle()}</ThemedText>
        </View>
        <Pressable
          style={[styles.navButton, { backgroundColor: theme.cardBackground }]}
          onPress={onNext}
        >
          <Feather name="chevron-right" size={20} color={theme.text} />
        </Pressable>
      </View>
      {!isToday ? (
        <Pressable style={styles.todayButton} onPress={onToday}>
          <ThemedText type="caption" style={{ color: Colors.accent }}>
            Today
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
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
  showTime?: boolean;
}

function JobListItem({ job, onPress, showTime = true }: JobListItemProps) {
  const { theme } = useTheme();

  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.jobListItem}>
        <View style={styles.jobListRow}>
          {showTime ? (
            <View style={styles.timeColumn}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {job.time || "TBD"}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.jobDetails}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{job.customerName}</ThemedText>
            <ThemedText type="caption" style={{ color: Colors.accent }}>
              {job.service}
            </ThemedText>
            {job.address ? (
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
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

interface DayTimelineProps {
  jobs: FormattedJob[];
  onJobPress: (job: FormattedJob) => void;
}

function DayTimeline({ jobs, onJobPress }: DayTimelineProps) {
  const { theme } = useTheme();
  const hours = Array.from({ length: 12 }, (_, i) => i + 7);

  const getJobsForHour = (hour: number) => {
    return jobs.filter((job) => {
      if (!job.time) return false;
      const timeParts = job.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!timeParts) return false;
      let jobHour = parseInt(timeParts[1]);
      const isPM = timeParts[3].toUpperCase() === "PM";
      if (isPM && jobHour !== 12) jobHour += 12;
      if (!isPM && jobHour === 12) jobHour = 0;
      return jobHour === hour;
    });
  };

  return (
    <ScrollView style={styles.dayTimeline} showsVerticalScrollIndicator={false}>
      {hours.map((hour) => {
        const hourJobs = getJobsForHour(hour);
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const ampm = hour >= 12 ? "PM" : "AM";

        return (
          <View key={hour} style={styles.timelineRow}>
            <View style={styles.timelineHour}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {displayHour} {ampm}
              </ThemedText>
            </View>
            <View style={[styles.timelineLine, { backgroundColor: theme.separator }]} />
            <View style={styles.timelineContent}>
              {hourJobs.map((job) => (
                <Pressable key={job.id} onPress={() => onJobPress(job)}>
                  <View style={[styles.timelineJob, { backgroundColor: Colors.accent + "20" }]}>
                    <ThemedText type="caption" style={{ color: Colors.accent, fontWeight: "600" }}>
                      {job.service}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {job.customerName}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

interface WeekViewProps {
  selectedDate: Date;
  jobs: FormattedJob[];
  onDateSelect: (date: Date) => void;
  onJobPress: (job: FormattedJob) => void;
}

function WeekView({ selectedDate, jobs, onDateSelect, onJobPress }: WeekViewProps) {
  const { theme } = useTheme();
  const weekDates = getWeekDates(selectedDate);
  const today = new Date();

  const getJobsForDate = (date: Date) => {
    return jobs.filter((job) => isSameDay(new Date(job.date), date));
  };

  const selectedDayJobs = getJobsForDate(selectedDate);

  return (
    <View style={styles.weekView}>
      <View style={styles.weekDayRow}>
        {weekDates.map((date, index) => {
          const isSelected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);
          const dayJobs = getJobsForDate(date);

          return (
            <Pressable
              key={index}
              style={[
                styles.weekDay,
                isSelected && { backgroundColor: Colors.accent },
                isToday && !isSelected && { borderWidth: 1, borderColor: Colors.accent },
              ]}
              onPress={() => onDateSelect(date)}
            >
              <ThemedText
                type="caption"
                style={[
                  { color: theme.textSecondary },
                  isSelected && { color: "#FFFFFF" },
                ]}
              >
                {DAYS_OF_WEEK[date.getDay()]}
              </ThemedText>
              <ThemedText
                type="body"
                style={[
                  { fontWeight: "600" },
                  isSelected && { color: "#FFFFFF" },
                ]}
              >
                {date.getDate()}
              </ThemedText>
              {dayJobs.length > 0 ? (
                <View style={[styles.weekDayDot, isSelected && { backgroundColor: "#FFFFFF" }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView style={styles.weekJobList} showsVerticalScrollIndicator={false}>
        {selectedDayJobs.length > 0 ? (
          selectedDayJobs.map((job) => (
            <JobListItem key={job.id} job={job} onPress={() => onJobPress(job)} />
          ))
        ) : (
          <View style={styles.emptyDay}>
            <Feather name="calendar" size={40} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              No jobs scheduled
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </View>
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

  const getJobsForDate = (date: Date) => {
    return jobs.filter((job) => isSameDay(new Date(job.date), date));
  };

  const selectedDayJobs = getJobsForDate(selectedDate);

  return (
    <View style={styles.monthView}>
      <View style={styles.calendarHeader}>
        {DAYS_OF_WEEK.map((day) => (
          <View key={day} style={styles.calendarHeaderDay}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {day}
            </ThemedText>
          </View>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.calendarWeek}>
          {week.map((date, dayIndex) => {
            if (!date) {
              return <View key={dayIndex} style={styles.calendarDay} />;
            }

            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, today);
            const dayJobs = getJobsForDate(date);

            return (
              <Pressable
                key={dayIndex}
                style={[
                  styles.calendarDay,
                  isSelected && { backgroundColor: Colors.accent },
                  isToday && !isSelected && { borderWidth: 1, borderColor: Colors.accent },
                ]}
                onPress={() => onDateSelect(date)}
              >
                <ThemedText
                  type="caption"
                  style={[
                    isSelected && { color: "#FFFFFF", fontWeight: "600" },
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

      <View style={styles.monthSummary}>
        <GlassCard>
          <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            {formatDateShort(selectedDate)}
          </ThemedText>
          {selectedDayJobs.length > 0 ? (
            selectedDayJobs.map((job) => (
              <Pressable key={job.id} onPress={() => onJobPress(job)} style={styles.monthJobItem}>
                <View style={[styles.monthJobDot, { backgroundColor: Colors.accent }]} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="caption" style={{ fontWeight: "600" }}>
                    {job.time || "TBD"} - {job.service}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {job.customerName}
                  </ThemedText>
                </View>
              </Pressable>
            ))
          ) : (
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              No jobs scheduled
            </ThemedText>
          )}
        </GlassCard>
      </View>
    </View>
  );
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
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
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "in_progress" | "completed">("all");
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("week");
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<"start" | "end" | null>(null);

  const jobs = jobsData?.jobs || [];
  const clients = clientsData?.clients || [];

  const getClientName = (clientId: string): string => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      return `${client.firstName} ${client.lastName}`;
    }
    return "Unknown Client";
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

  const formattedJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        if (job.status === "cancelled") return false;
        if (statusFilter === "all") return true;
        return job.status === statusFilter;
      })
      .map(formatJobForDisplay)
      .sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });
  }, [jobs, clients, statusFilter]);

  const dayJobs = useMemo(() => {
    return formattedJobs.filter((job) => isSameDay(new Date(job.date), selectedDate));
  }, [formattedJobs, selectedDate]);

  const getDateRange = useCallback((): { start: Date; end: Date } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (dateRangePreset) {
      case "today":
        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);
        return { start: today, end: endOfToday };
      case "week": {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return { start: startOfWeek, end: endOfWeek };
      }
      case "month": {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return { start: startOfMonth, end: endOfMonth };
      }
      case "custom":
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        return { start: today, end: today };
      default:
        return { start: today, end: today };
    }
  }, [dateRangePreset, customStartDate, customEndDate]);

  const rangeJobs = useMemo(() => {
    const { start, end } = getDateRange();
    return formattedJobs.filter((job) => {
      const jobDate = new Date(job.date);
      return jobDate >= start && jobDate <= end;
    });
  }, [formattedJobs, getDateRange]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handlePrevious = useCallback(() => {
    const newDate = new Date(selectedDate);
    switch (viewMode) {
      case "list":
      case "day":
        newDate.setDate(newDate.getDate() - 1);
        break;
      case "week":
        newDate.setDate(newDate.getDate() - 7);
        break;
      case "month":
        newDate.setMonth(newDate.getMonth() - 1);
        break;
    }
    setSelectedDate(newDate);
  }, [selectedDate, viewMode]);

  const handleNext = useCallback(() => {
    const newDate = new Date(selectedDate);
    switch (viewMode) {
      case "list":
      case "day":
        newDate.setDate(newDate.getDate() + 1);
        break;
      case "week":
        newDate.setDate(newDate.getDate() + 7);
        break;
      case "month":
        newDate.setMonth(newDate.getMonth() + 1);
        break;
    }
    setSelectedDate(newDate);
  }, [selectedDate, viewMode]);

  const handleToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const handleJobPress = (job: FormattedJob) => {
    navigation.navigate("ProviderJobDetail" as any, { jobId: job.id });
  };

  const handleAddJob = () => {
    navigation.navigate("AddJob" as any);
  };

  const renderListView = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      );
    }

    const { start, end } = getDateRange();
    const dateRangeLabel = dateRangePreset === "custom" 
      ? `${formatDateShort(start)} - ${formatDateShort(end)}`
      : dateRangePreset === "today" 
        ? "Today"
        : dateRangePreset === "week"
          ? "This Week"
          : "This Month";

    return (
      <FlatList
        data={rangeJobs}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
            <View style={styles.listJobItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: 4 }}>
                {formatDate(new Date(item.date))}
              </ThemedText>
              <JobListItem job={item} onPress={() => handleJobPress(item)} />
            </View>
          </Animated.View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          rangeJobs.length === 0 && styles.emptyContainer,
        ]}
        ListHeaderComponent={
          <ThemedText type="caption" style={[styles.listHeader, { color: theme.textSecondary }]}>
            {rangeJobs.length} job{rangeJobs.length !== 1 ? "s" : ""} in {dateRangeLabel}
          </ThemedText>
        }
        ListEmptyComponent={
          <EmptyState
            image={require("../../../assets/images/empty-bookings.png")}
            title="No jobs scheduled"
            description={`No jobs found in the selected time range.`}
          />
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      />
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: headerHeight + Spacing.md },
        ]}
      >
        <View style={styles.headerRow}>
          {viewMode === "list" ? (
            <View style={{ flex: 1 }}>
              <DateRangePicker
                preset={dateRangePreset}
                onPresetChange={setDateRangePreset}
                customStart={customStartDate}
                customEnd={customEndDate}
                onCustomStartChange={setCustomStartDate}
                onCustomEndChange={setCustomEndDate}
              />
            </View>
          ) : (
            <DateNavigator
              date={selectedDate}
              viewMode={viewMode}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onToday={handleToday}
            />
          )}
          <Pressable
            style={[styles.addButton, { backgroundColor: Colors.accent }]}
            onPress={handleAddJob}
          >
            <Feather name="plus" size={20} color="white" />
          </Pressable>
        </View>
        <ViewModeTabs selected={viewMode} onSelect={setViewMode} />
        <StatusFilterChips selected={statusFilter} onSelect={setStatusFilter} />
      </View>

      <View style={[styles.content, { paddingBottom: tabBarHeight + Spacing.lg }]}>
        {viewMode === "list" && renderListView()}
        {viewMode === "day" && (
          <DayTimeline jobs={dayJobs} onJobPress={handleJobPress} />
        )}
        {viewMode === "week" && (
          <WeekView
            selectedDate={selectedDate}
            jobs={formattedJobs}
            onDateSelect={setSelectedDate}
            onJobPress={handleJobPress}
          />
        )}
        {viewMode === "month" && (
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
    paddingBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  dateNavigator: {
    alignItems: "center",
    marginBottom: Spacing.md,
    flex: 1,
  },
  dateNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  dateTitle: {
    minWidth: 180,
    alignItems: "center",
  },
  todayButton: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  viewModeTabs: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    padding: 4,
  },
  viewModeTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.md,
  },
  statusFilterContainer: {
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    flexDirection: "row",
  },
  statusFilterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
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
    gap: Spacing.sm,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
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
    width: 60,
  },
  jobDetails: {
    flex: 1,
    gap: 2,
  },
  dayTimeline: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
  },
  timelineRow: {
    flexDirection: "row",
    minHeight: 60,
    marginBottom: Spacing.xs,
  },
  timelineHour: {
    width: 50,
    paddingRight: Spacing.sm,
  },
  timelineLine: {
    width: StyleSheet.hairlineWidth,
    marginRight: Spacing.md,
  },
  timelineContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  timelineJob: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  weekView: {
    flex: 1,
  },
  weekDayRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.md,
  },
  weekDay: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  weekDayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginTop: 4,
  },
  weekJobList: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
  },
  emptyDay: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
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
  dateRangePicker: {
    gap: Spacing.sm,
  },
  dateRangePresets: {
    gap: Spacing.sm,
    flexDirection: "row",
  },
  dateRangeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  customDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  customDateButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  customDateLabels: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  listJobItem: {
    marginBottom: Spacing.sm,
  },
  listHeader: {
    marginBottom: Spacing.sm,
  },
});
