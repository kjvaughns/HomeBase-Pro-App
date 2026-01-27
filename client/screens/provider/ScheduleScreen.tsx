import React, { useState } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { JobCard } from "@/components/JobCard";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { mockJobs, Job } from "@/state/mockData";

type FilterType = "all" | "scheduled" | "in_progress" | "completed";

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const filteredJobs = mockJobs.filter((job) => {
    if (filter === "all") return true;
    return job.status === filter;
  });

  const handleJobPress = (job: Job) => {
    // Navigate to job details
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "scheduled", label: "Scheduled" },
    { key: "in_progress", label: "In Progress" },
    { key: "completed", label: "Completed" },
  ];

  const renderHeader = () => (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <View style={styles.filterContainer}>
        {filters.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filter === f.key ? Colors.accent : theme.backgroundDefault,
              },
            ]}
          >
            <ThemedText
              type="label"
              style={{
                color: filter === f.key ? "#FFFFFF" : theme.textSecondary,
              }}
            >
              {f.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <GlassCard style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText type="h2" style={{ color: Colors.accent }}>
              {mockJobs.filter((j) => j.status === "scheduled").length}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Scheduled
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <ThemedText type="h2" style={{ color: "#F59E0B" }}>
              {mockJobs.filter((j) => j.status === "in_progress").length}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              In Progress
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <ThemedText type="h2" style={{ color: theme.text }}>
              {mockJobs.filter((j) => j.status === "completed").length}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Completed
            </ThemedText>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderJob = ({ item, index }: { item: Job; index: number }) => (
    <Animated.View entering={FadeInDown.delay(200 + index * 100).duration(400)}>
      <JobCard job={item} onPress={() => handleJobPress(item)} testID={`job-${item.id}`} />
    </Animated.View>
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../../assets/images/empty-bookings.png")}
      title="No jobs found"
      description={
        filter === "all"
          ? "You don't have any jobs scheduled. New jobs will appear here once you win leads."
          : `No ${filter.replace("_", " ")} jobs found.`
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
        contentContainerStyle={[
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.lg,
          },
          filteredJobs.length === 0 && styles.emptyContainer,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
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
  emptyContainer: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  statsCard: {
    marginBottom: Spacing.lg,
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
    width: 1,
    height: 40,
  },
});
