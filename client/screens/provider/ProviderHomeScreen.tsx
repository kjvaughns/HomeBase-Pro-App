import React, { useState, useMemo } from "react";
import { StyleSheet, View, ScrollView, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/GlassCard";
import { JobCard } from "@/components/JobCard";
import { SectionHeader } from "@/components/SectionHeader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useProviderStore } from "@/state/providerStore";

export default function ProviderHomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user } = useAuthStore();

  const jobs = useProviderStore((s) => s.jobs);
  const leads = useProviderStore((s) => s.leads);
  const messages = useProviderStore((s) => s.messages);
  const invoices = useProviderStore((s) => s.invoices);
  const getStats = useProviderStore((s) => s.getStats);

  const [refreshing, setRefreshing] = useState(false);

  const stats = useMemo(() => getStats(), [jobs, leads, invoices, messages]);

  const upcomingJobs = useMemo(() => {
    return jobs
      .filter((job) => job.status === "scheduled" || job.status === "in_progress")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  }, [jobs]);

  const inProgressJobs = useMemo(() => {
    return jobs.filter((job) => job.status === "in_progress");
  }, [jobs]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const unreadCount = useMemo(() => {
    return messages.reduce((sum, m) => sum + m.unreadCount, 0);
  }, [messages]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassCard style={styles.greetingCard}>
            <View style={styles.greetingContent}>
              <Avatar uri={user?.avatarUrl} name={user?.name} size="medium" />
              <View style={styles.greetingText}>
                <ThemedText style={[styles.greetingLabel, { color: theme.textSecondary }]}>
                  {getGreeting()},
                </ThemedText>
                <ThemedText style={styles.greetingName}>{user?.name?.split(" ")[0]}</ThemedText>
              </View>
              <Pressable style={styles.notificationIcon}>
                <Feather name="bell" size={24} color={theme.text} />
                {unreadCount > 0 ? (
                  <View style={[styles.notificationBadge, { borderColor: theme.backgroundRoot }]} />
                ) : null}
              </Pressable>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <GlassCard style={styles.todaySummary}>
            <ThemedText style={[styles.todayTitle, { color: theme.textSecondary }]}>
              Today's Summary
            </ThemedText>
            <View style={styles.summaryGrid}>
              <Pressable 
                style={styles.summaryItem}
                onPress={() => navigation.navigate("LeadsTab")}
              >
                <View style={[styles.summaryIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="users" size={18} color={Colors.accent} />
                </View>
                <ThemedText style={styles.summaryValue}>{stats.newLeads}</ThemedText>
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  New Leads
                </ThemedText>
              </Pressable>

              <View style={[styles.summaryDivider, { backgroundColor: theme.separator }]} />

              <Pressable style={styles.summaryItem}>
                <View style={[styles.summaryIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="calendar" size={18} color={Colors.accent} />
                </View>
                <ThemedText style={styles.summaryValue}>{stats.upcomingJobs}</ThemedText>
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Scheduled
                </ThemedText>
              </Pressable>

              <View style={[styles.summaryDivider, { backgroundColor: theme.separator }]} />

              <Pressable style={styles.summaryItem}>
                <View style={[styles.summaryIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="message-circle" size={18} color={Colors.accent} />
                </View>
                <ThemedText style={styles.summaryValue}>{unreadCount}</ThemedText>
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Messages
                </ThemedText>
              </Pressable>

              <View style={[styles.summaryDivider, { backgroundColor: theme.separator }]} />

              <Pressable 
                style={styles.summaryItem}
                onPress={() => navigation.navigate("MoneyTab")}
              >
                <View style={[styles.summaryIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="dollar-sign" size={18} color={Colors.accent} />
                </View>
                <ThemedText style={styles.summaryValue}>${stats.pendingEarnings.toLocaleString()}</ThemedText>
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Pending
                </ThemedText>
              </Pressable>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(300).duration(400)}
          style={styles.earningsRow}
        >
          <GlassCard style={styles.earningsCard}>
            <View style={styles.earningsContent}>
              <View>
                <ThemedText style={[styles.earningsLabel, { color: theme.textSecondary }]}>
                  This Month
                </ThemedText>
                <ThemedText style={styles.earningsValue}>
                  ${stats.totalEarnings.toLocaleString()}
                </ThemedText>
              </View>
              <View style={[styles.trendBadge, { backgroundColor: Colors.accentLight }]}>
                <Feather name="trending-up" size={14} color={Colors.accent} />
                <ThemedText style={[styles.trendText, { color: Colors.accent }]}>
                  12%
                </ThemedText>
              </View>
            </View>
          </GlassCard>

          <GlassCard style={styles.ratingCard}>
            <View style={styles.ratingContent}>
              <View style={styles.ratingStars}>
                <Feather name="star" size={20} color={Colors.warning} />
                <ThemedText style={styles.ratingValue}>{stats.rating}</ThemedText>
              </View>
              <ThemedText style={[styles.ratingLabel, { color: theme.textSecondary }]}>
                {stats.reviewCount} reviews
              </ThemedText>
            </View>
          </GlassCard>
        </Animated.View>

        {inProgressJobs.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <SectionHeader title="In Progress" />
            {inProgressJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onPress={() => {}}
                testID={`job-${job.id}`}
              />
            ))}
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(inProgressJobs.length > 0 ? 500 : 400).duration(400)}>
          <SectionHeader
            title="Upcoming Jobs"
            actionLabel="See All"
            onAction={() => navigation.navigate("ScheduleTab")}
          />
        </Animated.View>

        {upcomingJobs.length > 0 ? (
          upcomingJobs.map((job, index) => (
            <Animated.View
              key={job.id}
              entering={FadeInDown.delay((inProgressJobs.length > 0 ? 600 : 500) + index * 100).duration(400)}
            >
              <JobCard job={job} onPress={() => {}} testID={`job-${job.id}`} />
            </Animated.View>
          ))
        ) : (
          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
            <GlassCard style={styles.emptyCard}>
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No upcoming jobs scheduled
              </ThemedText>
            </GlassCard>
          </Animated.View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  greetingCard: {
    marginBottom: Spacing.lg,
  },
  greetingContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  greetingText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  greetingLabel: {
    ...Typography.subhead,
  },
  greetingName: {
    ...Typography.title2,
  },
  notificationIcon: {
    position: "relative",
    padding: Spacing.xs,
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    borderWidth: 2,
  },
  todaySummary: {
    marginBottom: Spacing.lg,
  },
  todayTitle: {
    ...Typography.footnote,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  summaryGrid: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    ...Typography.headline,
    marginBottom: 2,
  },
  summaryLabel: {
    ...Typography.caption2,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 48,
  },
  earningsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.sectionGap,
  },
  earningsCard: {
    flex: 1,
  },
  earningsContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  earningsLabel: {
    ...Typography.caption1,
    marginBottom: 4,
  },
  earningsValue: {
    ...Typography.title2,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  trendText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  ratingCard: {
    flex: 1,
  },
  ratingContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  ratingStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: 4,
  },
  ratingValue: {
    ...Typography.title2,
  },
  ratingLabel: {
    ...Typography.caption1,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    ...Typography.body,
  },
});
