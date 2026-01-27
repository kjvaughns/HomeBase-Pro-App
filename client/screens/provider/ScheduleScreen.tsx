import React, { useState, useMemo, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useProviderStore, Job } from "@/state/providerStore";

type ViewMode = "list" | "day" | "week" | "month";

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

interface JobListItemProps {
  job: Job;
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
                {job.time}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.jobDetails}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{job.customerName}</ThemedText>
            <ThemedText type="caption" style={{ color: Colors.accent }}>
              {job.service}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {job.address}
            </ThemedText>
            <StatusPill status={getStatusType(job.status)} label={getStatusLabel(job.status)} />
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

interface DayTimelineProps {
  jobs: Job[];
  onJobPress: (job: Job) => void;
}

function DayTimeline({ jobs, onJobPress }: DayTimelineProps) {
  const { theme } = useTheme();
  const hours = Array.from({ length: 12 }, (_, i) => i + 7);

  const getJobsForHour = (hour: number) => {
    return jobs.filter((job) => {
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
  jobs: Job[];
  onDateSelect: (date: Date) => void;
  onJobPress: (job: Job) => void;
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
  jobs: Job[];
  onDateSelect: (date: Date) => void;
  onJobPress: (job: Job) => void;
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
                    {job.time} - {job.service}
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
  const { theme } = useTheme();

  const jobs = useProviderStore((s) => s.jobs);

  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedDate, setSelectedDate] = useState(new Date());

  const filteredJobs = useMemo(() => {
    return jobs
      .filter((job) => job.status !== "cancelled")
      .sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });
  }, [jobs]);

  const dayJobs = useMemo(() => {
    return filteredJobs.filter((job) => isSameDay(new Date(job.date), selectedDate));
  }, [filteredJobs, selectedDate]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
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

  const handleJobPress = (job: Job) => {
    // Navigate to job details
  };

  const renderListView = () => (
    <FlatList
      data={dayJobs}
      renderItem={({ item, index }) => (
        <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
          <JobListItem job={item} onPress={() => handleJobPress(item)} />
        </Animated.View>
      )}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.listContent,
        dayJobs.length === 0 && styles.emptyContainer,
      ]}
      ListEmptyComponent={
        <EmptyState
          image={require("../../../assets/images/empty-bookings.png")}
          title="No jobs scheduled"
          description="You don't have any jobs scheduled for this day."
        />
      }
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
      }
    />
  );

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: headerHeight + Spacing.md },
        ]}
      >
        <DateNavigator
          date={selectedDate}
          viewMode={viewMode}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onToday={handleToday}
        />
        <ViewModeTabs selected={viewMode} onSelect={setViewMode} />
      </View>

      <View style={[styles.content, { paddingBottom: tabBarHeight + Spacing.lg }]}>
        {viewMode === "list" && renderListView()}
        {viewMode === "day" && (
          <DayTimeline jobs={dayJobs} onJobPress={handleJobPress} />
        )}
        {viewMode === "week" && (
          <WeekView
            selectedDate={selectedDate}
            jobs={filteredJobs}
            onDateSelect={setSelectedDate}
            onJobPress={handleJobPress}
          />
        )}
        {viewMode === "month" && (
          <MonthView
            selectedDate={selectedDate}
            jobs={filteredJobs}
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
  dateNavigator: {
    alignItems: "center",
    marginBottom: Spacing.md,
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
  content: {
    flex: 1,
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
    gap: 2,
  },
  weekDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
  },
  weekJobList: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
  },
  emptyDay: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  monthView: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
  },
  calendarHeader: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
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
});
