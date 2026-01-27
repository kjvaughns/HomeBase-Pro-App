import React, { useState, useMemo } from "react";
import { StyleSheet, View, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { JobCard } from "@/components/JobCard";
import { GlassCard } from "@/components/GlassCard";
import { FilterChips, FilterOption } from "@/components/FilterChips";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { useProviderStore, Job } from "@/state/providerStore";

type JobFilter = "all" | "scheduled" | "in_progress" | "completed";

const filterOptions: FilterOption<JobFilter>[] = [
  { key: "all", label: "All" },
  { key: "scheduled", label: "Scheduled" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const jobs = useProviderStore((s) => s.jobs);
  const startJob = useProviderStore((s) => s.startJob);
  const completeJob = useProviderStore((s) => s.completeJob);

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<JobFilter>("all");

  const filteredJobs = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (a.status !== "completed" && b.status === "completed") return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    if (filter === "all") return sorted;
    return sorted.filter((job) => job.status === filter);
  }, [jobs, filter]);

  const filterOptionsWithCounts = useMemo(() => {
    return filterOptions.map((opt) => ({
      ...opt,
      count: opt.key === "all" ? jobs.length : jobs.filter((j) => j.status === opt.key).length,
    }));
  }, [jobs]);

  const stats = useMemo(() => ({
    scheduled: jobs.filter((j) => j.status === "scheduled").length,
    inProgress: jobs.filter((j) => j.status === "in_progress").length,
    completed: jobs.filter((j) => j.status === "completed").length,
  }), [jobs]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleJobPress = (job: Job) => {
    // Navigate to job details
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <GlassCard style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <ThemedText type="h2" style={{ color: Colors.accent }}>
                {stats.scheduled}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Scheduled
              </ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.separator }]} />
            <View style={styles.stat}>
              <ThemedText type="h2" style={{ color: Colors.warning }}>
                {stats.inProgress}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                In Progress
              </ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.separator }]} />
            <View style={styles.stat}>
              <ThemedText type="h2" style={{ color: theme.text }}>
                {stats.completed}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Completed
              </ThemedText>
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <FilterChips
          options={filterOptionsWithCounts}
          selected={filter}
          onSelect={setFilter}
          showCounts
          style={styles.filterChips}
        />
      </Animated.View>
    </View>
  );

  const renderJob = ({ item, index }: { item: Job; index: number }) => (
    <Animated.View entering={FadeInDown.delay(300 + index * 50).duration(300)}>
      <JobCard
        job={item}
        onPress={() => handleJobPress(item)}
        testID={`job-${item.id}`}
      />
    </Animated.View>
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../../assets/images/empty-bookings.png")}
      title={filter === "all" ? "No jobs yet" : `No ${filter.replace("_", " ")} jobs`}
      description={
        filter === "all"
          ? "Your scheduled jobs will appear here. Accept leads to start building your schedule!"
          : `You don't have any ${filter.replace("_", " ")} jobs at the moment.`
      }
    />
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredJobs}
        renderItem={renderJob}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
          filteredJobs.length === 0 && styles.emptyContainer,
        ]}
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
  headerContainer: {
    paddingHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.md,
  },
  statsCard: {
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 40,
  },
  filterChips: {
    paddingHorizontal: 0,
    marginBottom: Spacing.sm,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.screenPadding,
  },
});
