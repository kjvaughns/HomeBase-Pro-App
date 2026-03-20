import React, { useState, useMemo } from "react";
import { StyleSheet, View, ScrollView, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/GlassCard";
import { JobCard } from "@/components/JobCard";
import { SectionHeader } from "@/components/SectionHeader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";

interface ProviderStats {
  revenueMTD: number;
  jobsCompleted: number;
  activeClients: number;
  upcomingJobs: number;
}

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
  email?: string;
  phone?: string;
}

export default function ProviderHomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user, providerProfile } = useAuthStore();
  const queryClient = useQueryClient();

  const providerId = providerProfile?.id;

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery<{ stats: ProviderStats }>({
    queryKey: ["/api/provider", providerId, "stats"],
    enabled: !!providerId,
  });

  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useQuery<{ jobs: Job[] }>({
    queryKey: ["/api/provider", providerId, "jobs"],
    enabled: !!providerId,
  });

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const [refreshing, setRefreshing] = useState(false);

  const stats = statsData?.stats || {
    revenueMTD: 0,
    jobsCompleted: 0,
    activeClients: 0,
    upcomingJobs: 0,
  };

  const jobs = jobsData?.jobs || [];
  const clients = clientsData?.clients || [];

  const upcomingJobs = useMemo(() => {
    return jobs
      .filter((job) => job.status === "scheduled" || job.status === "in_progress")
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
      .slice(0, 3);
  }, [jobs]);

  const inProgressJobs = useMemo(() => {
    return jobs.filter((job) => job.status === "in_progress");
  }, [jobs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchJobs()]);
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getClientName = (clientId: string): string => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      return `${client.firstName} ${client.lastName}`;
    }
    return "Unknown Client";
  };

  const formatJobForCard = (job: Job) => ({
    id: job.id,
    customerName: getClientName(job.clientId),
    service: job.title,
    address: job.address || "",
    date: job.scheduledDate,
    time: job.scheduledTime || "",
    status: job.status,
    price: parseFloat(job.estimatedPrice || "0"),
    description: job.description,
  });

  const isLoading = statsLoading || jobsLoading;

  if (!providerId) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ThemedText style={styles.noProviderText}>Provider profile not found</ThemedText>
        </View>
      </ThemedView>
    );
  }

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
              <Pressable 
                style={styles.notificationIcon}
                onPress={() => navigation.navigate("Notifications")}
              >
                <Feather name="bell" size={24} color={theme.text} />
              </Pressable>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <GlassCard style={styles.todaySummary}>
            <ThemedText style={[styles.todayTitle, { color: theme.textSecondary }]}>
              Dashboard
            </ThemedText>
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <View style={styles.summaryGrid}>
                <Pressable 
                  style={styles.summaryItem}
                  onPress={() => navigation.navigate("ClientsTab")}
                >
                  <View style={[styles.summaryIcon, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="users" size={18} color={Colors.accent} />
                  </View>
                  <ThemedText style={styles.summaryValue}>{stats.activeClients}</ThemedText>
                  <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                    Clients
                  </ThemedText>
                </Pressable>

                <View style={[styles.summaryDivider, { backgroundColor: theme.separator }]} />

                <Pressable 
                  style={styles.summaryItem}
                  onPress={() => navigation.navigate("ScheduleTab")}
                >
                  <View style={[styles.summaryIcon, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="calendar" size={18} color={Colors.accent} />
                  </View>
                  <ThemedText style={styles.summaryValue}>{stats.upcomingJobs}</ThemedText>
                  <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                    Upcoming
                  </ThemedText>
                </Pressable>

                <View style={[styles.summaryDivider, { backgroundColor: theme.separator }]} />

                <Pressable style={styles.summaryItem}>
                  <View style={[styles.summaryIcon, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="check-circle" size={18} color={Colors.accent} />
                  </View>
                  <ThemedText style={styles.summaryValue}>{stats.jobsCompleted}</ThemedText>
                  <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                    Completed
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
                  <ThemedText style={styles.summaryValue}>${stats.revenueMTD.toLocaleString()}</ThemedText>
                  <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                    This Month
                  </ThemedText>
                </Pressable>
              </View>
            )}
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
                  Revenue MTD
                </ThemedText>
                <ThemedText style={styles.earningsValue}>
                  ${stats.revenueMTD.toLocaleString()}
                </ThemedText>
              </View>
              <View style={[styles.trendBadge, { backgroundColor: Colors.accentLight }]}>
                <Feather name="trending-up" size={14} color={Colors.accent} />
              </View>
            </View>
          </GlassCard>

          <GlassCard style={styles.ratingCard}>
            <View style={styles.ratingContent}>
              <View style={styles.ratingStars}>
                <Feather name="star" size={20} color={Colors.warning} />
                <ThemedText style={styles.ratingValue}>{providerProfile?.rating || 0}</ThemedText>
              </View>
              <ThemedText style={[styles.ratingLabel, { color: theme.textSecondary }]}>
                {providerProfile?.reviewCount || 0} reviews
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
                job={formatJobForCard(job)}
                onPress={() => navigation.navigate("ProviderJobDetail", { jobId: job.id })}
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

        {isLoading ? (
          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
            <GlassCard style={styles.emptyCard}>
              <ActivityIndicator size="small" color={Colors.accent} />
            </GlassCard>
          </Animated.View>
        ) : upcomingJobs.length > 0 ? (
          upcomingJobs.map((job, index) => (
            <Animated.View
              key={job.id}
              entering={FadeInDown.delay((inProgressJobs.length > 0 ? 600 : 500) + index * 100).duration(400)}
            >
              <JobCard 
                job={formatJobForCard(job)} 
                onPress={() => navigation.navigate("ProviderJobDetail", { jobId: job.id })} 
                testID={`job-${job.id}`} 
              />
            </Animated.View>
          ))
        ) : (
          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
            <GlassCard style={styles.emptyCard}>
              <Feather name="calendar" size={32} color={theme.textSecondary} style={{ marginBottom: Spacing.sm }} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No upcoming jobs scheduled
              </ThemedText>
              <Pressable 
                style={[styles.addJobButton, { backgroundColor: Colors.accentLight }]}
                onPress={() => navigation.navigate("ScheduleTab")}
              >
                <Feather name="plus" size={16} color={Colors.accent} />
                <ThemedText style={[styles.addJobText, { color: Colors.accent }]}>
                  Add a Job
                </ThemedText>
              </Pressable>
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
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noProviderText: {
    ...Typography.body,
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
    marginBottom: Spacing.md,
  },
  addJobButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  addJobText: {
    ...Typography.callout,
    fontWeight: "600",
  },
});
