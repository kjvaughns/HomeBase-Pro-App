import React, { useState, useMemo, useEffect } from "react";
import { StyleSheet, View, ScrollView, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/GlassCard";
import { JobCard } from "@/components/JobCard";
import { SectionHeader } from "@/components/SectionHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
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

function ProfileMissingCTA({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  return (
    <ThemedView style={styles.container}>
      <View style={styles.centerContent}>
        <View style={[styles.missingIcon, { backgroundColor: Colors.accentLight }]}>
          <Feather name="user-x" size={32} color={Colors.accent} />
        </View>
        <ThemedText style={styles.missingTitle}>Profile setup needed</ThemedText>
        <ThemedText style={[styles.missingSubtitle, { color: theme.textSecondary }]}>
          Your provider profile isn't set up yet. Complete setup to start taking jobs and managing clients.
        </ThemedText>
        <PrimaryButton
          onPress={() => navigation.navigate("ProviderSetup")}
          style={styles.setupButton}
        >
          Complete Provider Setup
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

export default function ProviderHomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user, providerProfile, createProviderProfile } = useAuthStore();
  const queryClient = useQueryClient();

  const providerId = providerProfile?.id;

  // Auto-recover: if providerProfile is null in the store, try fetching from API
  const { data: fetchedProviderData, isLoading: profileLoading } = useQuery<{ provider: any }>({
    queryKey: ["/api/provider/user", user?.id],
    enabled: !providerId && !!user?.id,
    retry: false,
  });

  useEffect(() => {
    if (fetchedProviderData?.provider && !providerId) {
      const p = fetchedProviderData.provider;
      createProviderProfile({
        id: p.id,
        userId: p.userId,
        businessName: p.businessName,
        services: p.services || [],
        status: p.status || "approved",
        rating: p.rating || 0,
        reviewCount: p.reviewCount || 0,
        completedJobs: p.completedJobs || 0,
        serviceArea: p.serviceArea,
      });
    }
  }, [fetchedProviderData, providerId]);

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

  const { data: stripeStatusData } = useQuery<{ chargesEnabled: boolean; payoutsEnabled: boolean }>({
    queryKey: ["/api/stripe/connect/status", providerId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/stripe/connect/status/${providerId}`);
      if (!response.ok) throw new Error("Failed to fetch Stripe status");
      return response.json();
    },
    enabled: !!providerId,
    retry: false,
  });

  const { data: bookingLinksData } = useQuery<{ bookingLinks: { id: string }[] }>({
    queryKey: ["/api/provider", providerId, "booking-links"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/booking-links?providerId=${providerId}`);
      if (!response.ok) throw new Error("Failed to fetch booking links");
      return response.json();
    },
    enabled: !!providerId,
    retry: false,
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

  const isStripeConnected = stripeStatusData?.chargesEnabled && stripeStatusData?.payoutsEnabled;
  const hasClients = clients.length > 0;
  const hasBookingLink = (bookingLinksData?.bookingLinks?.length ?? 0) > 0;
  const hasCompletedJob = stats.jobsCompleted > 0;

  const gettingStartedSteps = [
    {
      key: "stripe",
      label: "Set up payments",
      subtitle: "Connect Stripe to get paid",
      icon: "credit-card" as const,
      done: !!isStripeConnected,
      onPress: () => navigation.navigate("StripeConnect"),
    },
    {
      key: "client",
      label: "Add your first client",
      subtitle: "Build your client list",
      icon: "user-plus" as const,
      done: hasClients,
      onPress: () => navigation.navigate("ClientsTab"),
    },
    {
      key: "booking",
      label: "Create a booking link",
      subtitle: "Let clients book you online",
      icon: "link" as const,
      done: hasBookingLink,
      onPress: () => navigation.navigate("MoreTab"),
    },
    {
      key: "job",
      label: "Complete your first job",
      subtitle: "Start earning with HomeBase",
      icon: "check-circle" as const,
      done: hasCompletedJob,
      onPress: () => navigation.navigate("ScheduleTab"),
    },
  ];

  const showGettingStarted = !isLoading && gettingStartedSteps.some((s) => !s.done);

  // Loading — trying to recover the provider profile from API
  if (!providerId && profileLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading your profile...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // No profile found even after API fetch — show proper CTA
  if (!providerId && !profileLoading) {
    return <ProfileMissingCTA navigation={navigation} />;
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
          {isLoading ? (
            <GlassCard style={styles.todaySummary}>
              <ActivityIndicator size="small" color={Colors.accent} />
            </GlassCard>
          ) : (
            <View style={styles.statsGrid}>
              <Pressable
                style={[styles.statCard, { backgroundColor: theme.cardBackground }]}
                onPress={() => navigation.navigate("ClientsTab")}
              >
                <View style={[styles.statIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="users" size={16} color={Colors.accent} />
                </View>
                <ThemedText style={styles.statValue}>{stats.activeClients}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Clients</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.statCard, { backgroundColor: theme.cardBackground }]}
                onPress={() => navigation.navigate("ScheduleTab")}
              >
                <View style={[styles.statIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="calendar" size={16} color={Colors.accent} />
                </View>
                <ThemedText style={styles.statValue}>{stats.upcomingJobs}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Upcoming</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.statCard, { backgroundColor: theme.cardBackground }]}
              >
                <View style={[styles.statIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="check-circle" size={16} color={Colors.accent} />
                </View>
                <ThemedText style={styles.statValue}>{stats.jobsCompleted}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Completed</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.statCard, { backgroundColor: theme.cardBackground }]}
                onPress={() => navigation.navigate("FinancesTab")}
              >
                <View style={[styles.statIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="dollar-sign" size={16} color={Colors.accent} />
                </View>
                <ThemedText style={styles.statValue}>${stats.revenueMTD.toLocaleString()}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>This Month</ThemedText>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {showGettingStarted ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <SectionHeader title="Getting Started" />
            <GlassCard style={styles.checklistCard}>
              {gettingStartedSteps.map((step, index) => (
                <Pressable
                  key={step.key}
                  style={[
                    styles.checklistRow,
                    index < gettingStartedSteps.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.separator,
                    },
                  ]}
                  onPress={step.done ? undefined : step.onPress}
                  testID={`checklist-${step.key}`}
                >
                  <View
                    style={[
                      styles.checklistIcon,
                      { backgroundColor: step.done ? Colors.accentLight : theme.backgroundSecondary },
                    ]}
                  >
                    <Feather
                      name={step.done ? "check" : step.icon}
                      size={16}
                      color={step.done ? Colors.accent : theme.textSecondary}
                    />
                  </View>
                  <View style={styles.checklistText}>
                    <ThemedText
                      style={[styles.checklistLabel, step.done && { color: theme.textSecondary }]}
                    >
                      {step.label}
                    </ThemedText>
                    <ThemedText style={[styles.checklistSubtitle, { color: theme.textSecondary }]}>
                      {step.subtitle}
                    </ThemedText>
                  </View>
                  {step.done ? (
                    <ThemedText style={[styles.doneLabel, { color: Colors.accent }]}>Done</ThemedText>
                  ) : (
                    <Feather name="chevron-right" size={16} color={theme.textTertiary} />
                  )}
                </Pressable>
              ))}
            </GlassCard>
          </Animated.View>
        ) : null}

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

        <Animated.View
          entering={FadeInDown.delay(inProgressJobs.length > 0 ? 500 : 400).duration(400)}
        >
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
    paddingHorizontal: Spacing.screenPadding,
  },
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  missingIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  missingTitle: {
    ...Typography.title2,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  missingSubtitle: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  setupButton: {
    width: "100%",
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: "48%",
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    alignItems: "flex-start",
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  statValue: {
    ...Typography.title2,
    marginBottom: 2,
  },
  statLabel: {
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
  checklistCard: {
    padding: 0,
    overflow: "hidden",
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  checklistIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistText: {
    flex: 1,
  },
  checklistLabel: {
    ...Typography.callout,
    fontWeight: "600",
  },
  checklistSubtitle: {
    ...Typography.caption1,
    marginTop: 1,
  },
  doneLabel: {
    ...Typography.footnote,
    fontWeight: "600",
  },
});
