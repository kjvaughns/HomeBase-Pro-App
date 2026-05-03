import React, { useState, useMemo, useEffect } from "react";
import { StyleSheet, View, ScrollView, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useLayout } from "@/hooks/useLayout";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/GlassCard";
import { JobCard } from "@/components/JobCard";
import { SectionHeader } from "@/components/SectionHeader";
import { StatCard } from "@/components/StatCard";
import { GracePeriodBanner } from "@/components/GracePeriodBanner";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useProviderStore } from "@/state/providerStore";
import { useOnboardingStore } from "@/state/onboardingStore";
import { isUpcomingJob } from "@/lib/jobUtils";

type BusinessHourEntry = { enabled?: boolean; open?: string; close?: string };
type BusinessHoursMap = Record<string, BusinessHourEntry | undefined>;
type BookingPoliciesShape = {
  instantBooking?: boolean;
  depositRequired?: boolean;
  depositAmount?: number;
};

function isAnyBusinessHourEnabled(
  hours: BusinessHoursMap | null | undefined,
): boolean {
  if (!hours || typeof hours !== "object") return false;
  return Object.values(hours).some((d) => !!d && d.enabled === true);
}

interface ProviderStats {
  revenueMTD: number;
  jobsCompleted: number;
  activeClients: number;
  upcomingJobs: number;
}

interface ProviderInsights {
  revenueMtd: number;
  revenueMtdDelta: number | null;
  jobsCompleted: number;
  jobsCompletedDelta: number | null;
  activeClients: number;
  activeClientsDelta: number | null;
  avgJobValue: number;
  avgJobValueDelta: number | null;
  weeklyRevenueSeries: { label: string; value: number }[];
  hasAnyData: boolean;
}

function formatDollarsCompact(amount: number): string {
  if (amount >= 1000) {
    const k = amount / 1000;
    const rounded = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
    return `$${rounded}K`;
  }
  return `$${Math.round(amount)}`;
}

function MiniBarChart({
  data,
  theme,
}: {
  data: { label: string; value: number }[];
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const CHART_HEIGHT = 64;
  const EMPTY_BAR_H = 4;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View>
      <View
        style={{
          height: CHART_HEIGHT,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 4,
        }}
      >
        {data.map((item, i) => {
          const hasValue = item.value > 0;
          const h = hasValue
            ? Math.max(EMPTY_BAR_H + 2, (item.value / max) * CHART_HEIGHT)
            : EMPTY_BAR_H;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: h,
                borderRadius: 3,
                backgroundColor: hasValue ? Colors.accent : theme.separator,
                opacity: hasValue ? 1 : 0.5,
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
        {data.map((item, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            {i === 0 || i === data.length - 1 ? (
              <ThemedText
                style={{ fontSize: 10, color: theme.textSecondary }}
                numberOfLines={1}
              >
                {item.label}
              </ThemedText>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
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
  isRecurring?: boolean;
  recurringFrequency?: string | null;
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
  const { horizontalPadding } = useLayout();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user, providerProfile, createProviderProfile, updateProviderProfile } = useAuthStore();
  const queryClient = useQueryClient();

  const providerId = providerProfile?.id;

  const { data: quickQuotesData } = useQuery<{
    quotes: {
      id: string;
      address: string;
      formattedAddress?: string | null;
      serviceName: string;
      finalPrice: string;
      status: string;
      createdAt: string;
    }[];
  }>({
    queryKey: ["/api/provider", providerId, "quick-quotes"],
    enabled: !!providerId,
  });
  const recentQuickQuotes = (quickQuotesData?.quotes ?? []).slice(0, 3);

  // Auto-recover: if providerProfile is null in the store, try fetching from API
  const { data: fetchedProviderData, isLoading: profileLoading } = useQuery<{ provider: any }>({
    queryKey: ["/api/provider/user", user?.id],
    enabled: !providerId && !!user?.id,
    retry: false,
  });

  const hydrateAvailableForWork = useProviderStore((s) => s.hydrateAvailableForWork);

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
        isActive: p.isActive ?? true,
      });
      if (p.isActive !== null && p.isActive !== undefined) {
        hydrateAvailableForWork(p.isActive);
      }
    }
  }, [fetchedProviderData, providerId, createProviderProfile, hydrateAvailableForWork]);

  // Guaranteed server hydration on app start: even when providerId is already
  // in the persisted authStore, refetch the profile so isActive (and other
  // fields) reflect server truth and don't drift from local storage.
  const { data: freshProviderData } = useQuery<{ provider: any }>({
    queryKey: ["/api/provider", providerId],
    enabled: !!providerId,
    staleTime: 30_000,
  });

  useEffect(() => {
    const p = freshProviderData?.provider;
    if (p && typeof p.isActive === "boolean") {
      hydrateAvailableForWork(p.isActive);
      if (providerProfile && providerProfile.isActive !== p.isActive) {
        updateProviderProfile({ isActive: p.isActive });
      }
    }
  }, [freshProviderData, hydrateAvailableForWork, updateProviderProfile, providerProfile]);

  // Bootstrap "Available for Work" toggle from persisted providerProfile
  // immediately on mount so the UI shows the last-known value while the
  // server refresh is in-flight.
  useEffect(() => {
    if (providerProfile?.isActive !== undefined && providerProfile?.isActive !== null) {
      hydrateAvailableForWork(providerProfile.isActive);
    }
  }, [providerProfile?.isActive, hydrateAvailableForWork]);

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery<{ stats: ProviderStats }>({
    queryKey: ["/api/provider", providerId, "stats"],
    enabled: !!providerId,
  });

  const { data: leadsData } = useQuery<{ leads: { id: string; status: string }[] }>({
    queryKey: ["/api/providers", providerId, "leads"],
    enabled: !!providerId,
    refetchInterval: 60_000,
  });
  const newLeadCount = (leadsData?.leads ?? []).filter(
    (l) => l.status === "new" || l.status === "pending",
  ).length;

  const { data: insightsData, isLoading: insightsLoading, isError: insightsError } = useQuery<{ insights: ProviderInsights }>({
    queryKey: ["/api/provider", providerId, "insights"],
    enabled: !!providerId,
    retry: 1,
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

  const { data: bookingLinksData } = useQuery<{
    bookingLinks: {
      id: string;
      intakeQuestions?: unknown[] | string | null;
    }[];
  }>({
    queryKey: ["/api/providers", providerId, "booking-links"],
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

  const upcomingJobsAll = useMemo(() => {
    const now = new Date();
    return jobs
      .filter((job) => isUpcomingJob(job, now))
      .sort((a, b) => {
        // in_progress first (oldest start first), then scheduled by date+time asc
        if (a.status === "in_progress" && b.status !== "in_progress") return -1;
        if (b.status === "in_progress" && a.status !== "in_progress") return 1;
        const da = new Date(a.scheduledDate).getTime();
        const db = new Date(b.scheduledDate).getTime();
        if (da !== db) return da - db;
        return (a.scheduledTime || "").localeCompare(b.scheduledTime || "");
      });
  }, [jobs]);

  const upcomingJobs = useMemo(() => upcomingJobsAll.slice(0, 3), [upcomingJobsAll]);
  const upcomingCount = upcomingJobsAll.length;

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
    isRecurring: job.isRecurring ?? false,
    recurringFrequency: job.recurringFrequency ?? null,
  });

  const isLoading = statsLoading || jobsLoading;

  const isStripeConnected = stripeStatusData?.chargesEnabled && stripeStatusData?.payoutsEnabled;
  const stripeReady = !!stripeStatusData?.chargesEnabled;
  const profileIsPublic =
    freshProviderData?.provider?.isPublic ?? providerProfile?.isPublic ?? false;
  // Provider is unlisted from homeowner discovery when their public toggle is
  // off OR when Stripe isn't ready (server filters them out either way).
  const isUnlisted = !!providerId && (!profileIsPublic || !stripeReady);
  // Show "you're ready — publish your profile" prompt when Stripe just
  // finished but the toggle is still off.
  const showPublishPrompt = stripeReady && profileIsPublic === false;

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/provider/${providerId}`, {
        isPublic: true,
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.message || body?.error || "Failed to publish");
      }
      return body;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId] });
    },
  });
  const hasServices = (providerProfile?.services?.length ?? 0) > 0;
  const hasMultipleServices = (providerProfile?.services?.length ?? 0) > 1;
  const hasClients = clients.length > 0;
  const firstBookingLink = bookingLinksData?.bookingLinks?.[0];
  const hasBookingLink = (bookingLinksData?.bookingLinks?.length ?? 0) > 0;
  const providerRecord = freshProviderData?.provider as
    | {
        description?: string | null;
        businessHours?: BusinessHoursMap | null;
        bookingPolicies?: BookingPoliciesShape | null;
      }
    | undefined;
  const hasBio = !!providerRecord?.description?.trim?.();
  const hasBusinessHours = isAnyBusinessHourEnabled(
    providerRecord?.businessHours,
  );
  const bookingPolicies = providerRecord?.bookingPolicies ?? undefined;
  const hasCustomPolicies =
    !!bookingPolicies &&
    (bookingPolicies.instantBooking === true ||
      bookingPolicies.depositRequired === true);
  const intakeQuestionsRaw = firstBookingLink?.intakeQuestions;
  const hasIntakeQuestions = (() => {
    if (!intakeQuestionsRaw) return false;
    if (Array.isArray(intakeQuestionsRaw))
      return intakeQuestionsRaw.length > 0;
    if (typeof intakeQuestionsRaw === "string") {
      try {
        const parsed = JSON.parse(intakeQuestionsRaw);
        return Array.isArray(parsed) && parsed.length > 0;
      } catch {
        return intakeQuestionsRaw.trim().length > 0;
      }
    }
    return false;
  })();

  const dismissedChecklistSteps = useOnboardingStore(
    (s) => s.dismissedChecklistSteps,
  );
  const dismissChecklistStep = useOnboardingStore(
    (s) => s.dismissChecklistStep,
  );

  const allGettingStartedSteps = [
    {
      key: "stripe",
      label: "Set up payments",
      subtitle: "Connect Stripe to get paid",
      icon: "credit-card" as const,
      done: !!isStripeConnected,
      onPress: () => navigation.navigate("StripeConnect"),
    },
    {
      key: "service",
      label: "Create your first service",
      subtitle: "Define what you offer",
      icon: "tool" as const,
      done: hasServices,
      onPress: () => navigation.navigate("BusinessHub"),
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
      label: "Share your booking link",
      subtitle: "Send clients a link to book online",
      icon: "link" as const,
      done: hasBookingLink,
      onPress: () => navigation.navigate("MoreTab"),
    },
    {
      key: "bio",
      label: "Polish your bio",
      subtitle: "AI can draft one in seconds",
      icon: "edit-3" as const,
      done: hasBio,
      onPress: () => navigation.navigate("BusinessHub"),
    },
    {
      key: "hours",
      label: "Set your business hours",
      subtitle: "Tell clients when you're available",
      icon: "clock" as const,
      done: hasBusinessHours,
      onPress: () => navigation.navigate("BusinessHub"),
    },
    {
      key: "policies",
      label: "Booking policies & deposits",
      subtitle: "Optional — instant booking, deposits, cancellations",
      icon: "shield" as const,
      done: hasCustomPolicies,
      onPress: () => navigation.navigate("BusinessHub"),
    },
    {
      key: "intake-questions",
      label: "Add intake questions",
      subtitle: "Capture details before clients book",
      icon: "help-circle" as const,
      done: hasIntakeQuestions,
      onPress: () => navigation.navigate("BookingLink"),
    },
    {
      key: "more-services",
      label: "Add more services",
      subtitle: "AI service blueprint can scaffold the next one",
      icon: "plus-circle" as const,
      done: hasMultipleServices,
      onPress: () =>
        navigation.navigate("NewService", { onboardingMode: false }),
    },
  ];

  const gettingStartedSteps = allGettingStartedSteps.filter(
    (s) => !s.done && !dismissedChecklistSteps.includes(s.key),
  );
  const showGettingStarted = !isLoading && gettingStartedSteps.length > 0;

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
          paddingHorizontal: horizontalPadding,
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
        <View style={{ marginHorizontal: -Spacing.screenPadding }}>
          <GracePeriodBanner />
        </View>

        {showPublishPrompt ? (
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <GlassCard style={[styles.greetingCard, { borderColor: Colors.accent, borderWidth: 1 }]}>
              <View style={styles.publishRow}>
                <View style={[styles.publishIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="globe" size={20} color={Colors.accent} />
                </View>
                <View style={styles.publishText}>
                  <ThemedText style={styles.publishTitle}>You're ready to go live</ThemedText>
                  <ThemedText style={[styles.publishSubtitle, { color: theme.textSecondary }]}>
                    Stripe is set up. Publish your profile so clients can discover and book you.
                  </ThemedText>
                </View>
              </View>
              <PrimaryButton
                onPress={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                style={{ marginTop: Spacing.sm }}
                testID="button-publish-profile"
              >
                {publishMutation.isPending ? "Publishing..." : "Publish my profile"}
              </PrimaryButton>
            </GlassCard>
          </Animated.View>
        ) : isUnlisted && !isLoading ? (
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <Pressable
              onPress={() =>
                navigation.navigate(stripeReady ? "BusinessHub" : "StripeConnect")
              }
              testID="banner-unlisted"
            >
              <GlassCard style={[styles.greetingCard, { borderColor: theme.separator, borderWidth: 1 }]}>
                <View style={styles.publishRow}>
                  <View style={[styles.publishIcon, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="eye-off" size={20} color={theme.text} />
                  </View>
                  <View style={styles.publishText}>
                    <ThemedText style={styles.publishTitle}>Your profile is unlisted</ThemedText>
                    <ThemedText style={[styles.publishSubtitle, { color: theme.textSecondary }]}>
                      {!stripeReady
                        ? "Finish Stripe setup to start accepting bookings."
                        : "Turn on visibility in Business Details to be discoverable."}
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.textTertiary} />
                </View>
              </GlassCard>
            </Pressable>
          </Animated.View>
        ) : null}

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
                <ThemedText style={styles.statValue}>{upcomingCount}</ThemedText>
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
                onPress={() => navigation.navigate("FinancialsTab")}
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

        {newLeadCount > 0 ? (
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <Pressable
              testID="card-leads-banner"
              onPress={() => navigation.navigate("Leads")}
            >
              <GlassCard
                style={[
                  styles.greetingCard,
                  { borderColor: Colors.accent, borderWidth: 1 },
                ]}
              >
                <View style={styles.greetingContent}>
                  <View
                    style={[
                      styles.statIcon,
                      { backgroundColor: Colors.accentLight },
                    ]}
                  >
                    <Feather name="inbox" size={18} color={Colors.accent} />
                  </View>
                  <View style={styles.greetingText}>
                    <ThemedText style={styles.greetingName}>
                      {newLeadCount} new {newLeadCount === 1 ? "lead" : "leads"}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.greetingLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Tap to review and accept
                    </ThemedText>
                  </View>
                  <View
                    style={{
                      backgroundColor: Colors.error,
                      borderRadius: 12,
                      minWidth: 24,
                      height: 24,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 6,
                    }}
                  >
                    <ThemedText
                      style={{
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {newLeadCount > 99 ? "99+" : newLeadCount}
                    </ThemedText>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          </Animated.View>
        ) : null}

        {showGettingStarted ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <SectionHeader title="Getting Started" />
            <GlassCard style={styles.checklistCard}>
              {gettingStartedSteps.map((step, index) => (
                <View
                  key={step.key}
                  style={[
                    styles.checklistRow,
                    index < gettingStartedSteps.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.separator,
                    },
                  ]}
                >
                  <Pressable
                    style={styles.checklistRowMain}
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
                  {!step.done ? (
                    <Pressable
                      onPress={() => dismissChecklistStep(step.key)}
                      style={styles.checklistDismiss}
                      hitSlop={10}
                      testID={`checklist-dismiss-${step.key}`}
                      accessibilityLabel={`Dismiss ${step.label}`}
                    >
                      <Feather name="x" size={14} color={theme.textTertiary} />
                    </Pressable>
                  ) : null}
                </View>
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

        <Animated.View entering={FadeInDown.delay(inProgressJobs.length > 0 ? 450 : 350).duration(400)}>
          <SectionHeader title="Business Insights" />
          {insightsLoading ? (
            <View>
              <View style={styles.insightGridRow}>
                <View style={[styles.insightSkeletonTile, { backgroundColor: theme.separator }]} />
                <View style={[styles.insightSkeletonTile, { backgroundColor: theme.separator }]} />
              </View>
              <View style={styles.insightGridRow}>
                <View style={[styles.insightSkeletonTile, { backgroundColor: theme.separator }]} />
                <View style={[styles.insightSkeletonTile, { backgroundColor: theme.separator }]} />
              </View>
              <View style={[styles.insightChartSkeleton, { backgroundColor: theme.separator }]} />
            </View>
          ) : insightsError || !insightsData?.insights ? (
            <GlassCard style={styles.insightsEmptyCard}>
              <ThemedText style={[styles.insightsEmptyText, { color: theme.textSecondary }]}>
                Insights are temporarily unavailable. Pull to refresh.
              </ThemedText>
            </GlassCard>
          ) : !insightsData.insights.hasAnyData ? (
            <GlassCard style={styles.insightsEmptyCard}>
              <Feather name="bar-chart-2" size={28} color={theme.textSecondary} style={{ marginBottom: Spacing.sm }} />
              <ThemedText style={[styles.insightsEmptyText, { color: theme.textSecondary }]}>
                Your first numbers will show up here as you complete jobs.
              </ThemedText>
            </GlassCard>
          ) : (
            <View>
              <View style={styles.insightGridRow}>
                <StatCard
                  title="Revenue MTD"
                  value={formatDollarsCompact(insightsData.insights.revenueMtd)}
                  icon="dollar-sign"
                  trend={
                    insightsData.insights.revenueMtdDelta !== null
                      ? {
                          value: Math.abs(insightsData.insights.revenueMtdDelta),
                          positive: insightsData.insights.revenueMtdDelta >= 0,
                        }
                      : undefined
                  }
                />
                <StatCard
                  title="Jobs Completed"
                  value={insightsData.insights.jobsCompleted}
                  icon="check-circle"
                  trend={
                    insightsData.insights.jobsCompletedDelta !== null
                      ? {
                          value: Math.abs(insightsData.insights.jobsCompletedDelta),
                          positive: insightsData.insights.jobsCompletedDelta >= 0,
                        }
                      : undefined
                  }
                />
              </View>
              <View style={styles.insightGridRow}>
                <StatCard
                  title="Active Clients"
                  value={insightsData.insights.activeClients}
                  icon="users"
                  trend={
                    insightsData.insights.activeClientsDelta !== null
                      ? {
                          value: Math.abs(insightsData.insights.activeClientsDelta),
                          positive: insightsData.insights.activeClientsDelta >= 0,
                        }
                      : undefined
                  }
                />
                <StatCard
                  title="Avg Job Value"
                  value={formatDollarsCompact(insightsData.insights.avgJobValue)}
                  icon="trending-up"
                  trend={
                    insightsData.insights.avgJobValueDelta !== null
                      ? {
                          value: Math.abs(insightsData.insights.avgJobValueDelta),
                          positive: insightsData.insights.avgJobValueDelta >= 0,
                        }
                      : undefined
                  }
                />
              </View>
              <GlassCard style={styles.insightChartCard}>
                <View style={styles.insightChartHeader}>
                  <ThemedText style={styles.insightChartTitle}>Revenue, last 8 weeks</ThemedText>
                </View>
                <MiniBarChart
                  data={insightsData.insights.weeklyRevenueSeries}
                  theme={theme}
                />
              </GlassCard>
            </View>
          )}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(inProgressJobs.length > 0 ? 450 : 350).duration(400)}
        >
          <Pressable
            style={[
              styles.quickQuoteCta,
              { backgroundColor: Colors.accentLight, borderColor: Colors.accent + "40" },
            ]}
            onPress={() => navigation.navigate("QuickQuote")}
            testID="button-home-quick-quote"
          >
            <View style={[styles.quickQuoteIcon, { backgroundColor: Colors.accent }]}>
              <Feather name="zap" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontWeight: "700", color: Colors.accent }}>
                Quick Quote
              </ThemedText>
              <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                Get an instant price from just an address
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.accent} />
          </Pressable>
        </Animated.View>

        {recentQuickQuotes.length > 0 ? (
          <Animated.View
            entering={FadeInDown.delay(inProgressJobs.length > 0 ? 475 : 375).duration(400)}
          >
            <SectionHeader
              title="Recent Quotes"
              actionLabel="New Quote"
              onAction={() => navigation.navigate("QuickQuote")}
            />
            {recentQuickQuotes.map((q) => (
              <Pressable
                key={q.id}
                onPress={() => navigation.navigate("QuickQuote")}
                testID={`home-quote-${q.id}`}
              >
                <GlassCard style={styles.recentQuoteCard}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: "600" }} numberOfLines={1}>
                      {q.serviceName}
                    </ThemedText>
                    <ThemedText
                      style={{ color: theme.textSecondary, fontSize: 12 }}
                      numberOfLines={1}
                    >
                      {q.formattedAddress || q.address}
                    </ThemedText>
                  </View>
                  <ThemedText style={{ color: Colors.accent, fontWeight: "700" }}>
                    ${Math.round(parseFloat(q.finalPrice)).toLocaleString()}
                  </ThemedText>
                </GlassCard>
              </Pressable>
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
  quickQuoteCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  quickQuoteIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  recentQuoteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
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
  },
  checklistRowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  checklistDismiss: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
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
  insightGridRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  insightSkeletonTile: {
    flex: 1,
    height: 110,
    borderRadius: BorderRadius.card,
    opacity: 0.4,
  },
  insightChartSkeleton: {
    height: 100,
    borderRadius: BorderRadius.card,
    opacity: 0.4,
    marginTop: Spacing.xs,
  },
  insightsEmptyCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  insightsEmptyText: {
    ...Typography.body,
    textAlign: "center",
  },
  insightChartCard: {
    marginTop: Spacing.xs,
  },
  insightChartHeader: {
    marginBottom: Spacing.sm,
  },
  insightChartTitle: {
    ...Typography.callout,
    fontWeight: "600",
  },
  publishRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  publishIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  publishText: {
    flex: 1,
  },
  publishTitle: {
    ...Typography.callout,
    fontWeight: "600",
  },
  publishSubtitle: {
    ...Typography.caption1,
    marginTop: 2,
    lineHeight: 16,
  },
});
