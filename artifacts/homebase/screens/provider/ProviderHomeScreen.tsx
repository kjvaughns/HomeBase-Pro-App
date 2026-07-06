import React, { useState, useMemo, useEffect, useRef } from "react";
import { StyleSheet, View, ScrollView, RefreshControl, Pressable, ActivityIndicator, AppState, TextInput, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useLayout } from "@/hooks/useLayout";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import * as Haptics from "expo-haptics";

import { formatMoney } from "@/lib/format";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/GlassCard";
import { JobCard } from "@/components/JobCard";
import { SectionHeader } from "@/components/SectionHeader";
import { SkeletonLoader, SkeletonCard, SkeletonListRow } from "@/components/SkeletonLoader";

function StatsSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={styles.statsGrid}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
          <SkeletonLoader width={32} height={32} borderRadius={16} />
          <SkeletonLoader width={40} height={24} style={{ marginTop: Spacing.xs }} />
          <SkeletonLoader width={60} height={14} style={{ marginTop: Spacing.xs }} />
        </View>
      ))}
    </View>
  );
}

function JobsSkeleton() {
  return (
    <View style={{ gap: Spacing.md }}>
      {[1, 2].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}
import { GracePeriodBanner } from "@/components/GracePeriodBanner";
import { CrewWelcomeBanner } from "@/components/CrewWelcomeBanner";
import { RecapCard } from "@/components/RecapCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useSyncProviderTimezone } from "@/hooks/useSyncProviderTimezone";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useProviderStore } from "@/state/providerStore";
import { useOnboardingStore } from "@/state/onboardingStore";
import { isUpcomingJob } from "@/lib/jobUtils";
import { syncProviderWidgetData } from "@/lib/widgetData";
import { ProviderFeed, type FeedCardData } from "@/components/FeedCard";

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

const GOAL_PRESETS_DASHBOARD = [
  { label: "$1K", cents: 100_000 },
  { label: "$3K", cents: 300_000 },
  { label: "$5K", cents: 500_000 },
  { label: "$10K", cents: 1_000_000 },
];

function MonthlyGoalCard({
  providerId,
  revenueMTDDollars,
  monthlyGoalCents,
  theme,
  queryClient,
}: {
  providerId: string | undefined;
  revenueMTDDollars: number;
  monthlyGoalCents: number | null;
  theme: ReturnType<typeof useTheme>["theme"];
  queryClient: ReturnType<typeof import("@tanstack/react-query").useQueryClient>;
}) {
  const [editVisible, setEditVisible] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const goalMutation = useMutation({
    mutationFn: async (cents: number | null) => {
      const res = await apiRequest("PATCH", "/api/provider/goal", { monthlyGoalCents: cents });
      if (!res.ok) throw new Error("Failed to update goal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId] });
      setEditVisible(false);
      setCustomMode(false);
      setCustomValue("");
    },
  });

  const revenueMTDCents = Math.round(revenueMTDDollars * 100);
  const progress = monthlyGoalCents && monthlyGoalCents > 0
    ? Math.min(revenueMTDCents / monthlyGoalCents, 1)
    : 0;
  const goalDollars = monthlyGoalCents ? Math.round(monthlyGoalCents / 100) : 0;

  const handlePresetSelect = (cents: number) => {
    goalMutation.mutate(cents);
  };

  const handleCustomConfirm = () => {
    const dollars = parseFloat(customValue.replace(/[^0-9.]/g, ""));
    if (!isNaN(dollars) && dollars > 0) {
      goalMutation.mutate(Math.round(dollars * 100));
    }
  };

  if (!monthlyGoalCents) {
    return (
      <Animated.View entering={FadeInDown.delay(180).duration(400)}>
        <Pressable onPress={() => setEditVisible(true)} testID="card-set-monthly-goal">
          <GlassCard
            style={[styles.goalCard, { borderColor: Colors.accent + "40", borderWidth: 1, borderStyle: "dashed" }]}
          >
            <View style={styles.goalCardRow}>
              <View style={[styles.goalIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="target" size={18} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.goalTitle, { color: Colors.accent }]}>Set a monthly goal</ThemedText>
                <ThemedText style={[styles.goalSubtitle, { color: theme.textSecondary }]}>
                  Track your progress toward a revenue target
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.accent} />
            </View>
          </GlassCard>
        </Pressable>
        <GoalEditModal
          visible={editVisible}
          onClose={() => { setEditVisible(false); setCustomMode(false); setCustomValue(""); }}
          theme={theme}
          customMode={customMode}
          setCustomMode={setCustomMode}
          customValue={customValue}
          setCustomValue={setCustomValue}
          onPresetSelect={handlePresetSelect}
          onCustomConfirm={handleCustomConfirm}
          loading={goalMutation.isPending}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.delay(180).duration(400)}>
      <GlassCard style={styles.goalCard} testID="card-monthly-goal">
        <View style={styles.goalCardRow}>
          <View style={[styles.goalIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name="target" size={18} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.goalTitle}>Monthly Goal</ThemedText>
            <ThemedText style={[styles.goalSubtitle, { color: theme.textSecondary }]}>
              {formatMoney(revenueMTDDollars, { showCents: false })} of {formatMoney(goalDollars, { showCents: false })} goal
            </ThemedText>
          </View>
          <Pressable
            onPress={() => setEditVisible(true)}
            hitSlop={12}
            testID="button-update-goal"
          >
            <ThemedText style={[styles.goalEditLink, { color: Colors.accent }]}>Edit</ThemedText>
          </Pressable>
        </View>

        <View style={[styles.goalProgressTrack, { backgroundColor: theme.separator }]}>
          <View
            style={[
              styles.goalProgressFill,
              {
                backgroundColor: progress >= 1 ? Colors.accent : Colors.accent,
                width: `${Math.round(progress * 100)}%` as any,
              },
            ]}
          />
        </View>

        <View style={styles.goalProgressLabels}>
          <ThemedText style={[styles.goalProgressPct, { color: Colors.accent }]}>
            {Math.round(progress * 100)}%
          </ThemedText>
          {progress >= 1 ? (
            <ThemedText style={[styles.goalCelebration, { color: Colors.accent }]}>
              🎉 Goal reached!
            </ThemedText>
          ) : (
            <ThemedText style={[styles.goalProgressPct, { color: theme.textSecondary }]}>
              ${Math.max(0, goalDollars - Math.round(revenueMTDDollars)).toLocaleString()} to go
            </ThemedText>
          )}
        </View>
      </GlassCard>

      <GoalEditModal
        visible={editVisible}
        onClose={() => { setEditVisible(false); setCustomMode(false); setCustomValue(""); }}
        theme={theme}
        customMode={customMode}
        setCustomMode={setCustomMode}
        customValue={customValue}
        setCustomValue={setCustomValue}
        onPresetSelect={handlePresetSelect}
        onCustomConfirm={handleCustomConfirm}
        loading={goalMutation.isPending}
      />
    </Animated.View>
  );
}

function GoalEditModal({
  visible,
  onClose,
  theme,
  customMode,
  setCustomMode,
  customValue,
  setCustomValue,
  onPresetSelect,
  onCustomConfirm,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
  customMode: boolean;
  setCustomMode: (v: boolean) => void;
  customValue: string;
  setCustomValue: (v: string) => void;
  onPresetSelect: (cents: number) => void;
  onCustomConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.goalModalOverlay, { backgroundColor: theme.overlay }]} onPress={onClose}>
        <Pressable
          style={[styles.goalModalSheet, { backgroundColor: theme.backgroundRoot }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.goalModalHandle, { backgroundColor: theme.border }]} />
          <ThemedText style={styles.goalModalTitle}>Set monthly goal</ThemedText>
          <ThemedText style={[styles.goalModalSubtitle, { color: theme.textSecondary }]}>
            How much do you want to earn this month?
          </ThemedText>

          <View style={styles.goalModalGrid}>
            {GOAL_PRESETS_DASHBOARD.map((p) => (
              <Pressable
                key={p.cents}
                onPress={() => { Haptics.selectionAsync(); onPresetSelect(p.cents); }}
                disabled={loading}
                style={[
                  styles.goalModalPreset,
                  { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
                ]}
                testID={`modal-goal-preset-${p.cents}`}
              >
                <ThemedText style={[styles.goalModalPresetLabel, { color: theme.text }]}>{p.label}</ThemedText>
                <ThemedText style={[{ fontSize: 11, color: theme.textSecondary }]}>/ mo</ThemedText>
              </Pressable>
            ))}
          </View>

          {customMode ? (
            <View style={[styles.goalModalCustomInput, { backgroundColor: theme.backgroundSecondary, borderColor: Colors.accent }]}>
              <ThemedText style={{ color: theme.textSecondary, fontSize: 17 }}>$</ThemedText>
              <TextInput
                style={[{ flex: 1, fontSize: 17, color: theme.text, marginHorizontal: 6 }]}
                placeholder="Custom amount"
                placeholderTextColor={theme.textTertiary}
                value={customValue}
                onChangeText={setCustomValue}
                keyboardType="numeric"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={onCustomConfirm}
              />
              <Pressable
                onPress={onCustomConfirm}
                disabled={loading}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Confirm goal"
              >
                <Feather name="check" size={20} color={Colors.accent} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setCustomMode(true)}
              style={[styles.goalModalCustomBtn, { borderColor: theme.border }]}
            >
              <Feather name="edit-2" size={14} color={theme.textSecondary} />
              <ThemedText style={[{ color: theme.textSecondary, fontSize: 14 }]}>Custom amount</ThemedText>
            </Pressable>
          )}

          {loading ? (
            <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: Spacing.md }} />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ProfileMissingCTA({ navigation }: { navigation: any }) {
  return (
    <EmptyState
      icon="user-x"
      title="Profile setup needed"
      description="Your provider profile isn't set up yet. Complete setup to start taking jobs and managing clients."
      primaryAction={{
        label: "Complete Provider Setup",
        onPress: () => navigation.navigate("ProviderSetup"),
      }}
    />
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
  useSyncProviderTimezone();
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

  // Getting Started checklist needs the real service count, not the stale
  // snapshot cached in authStore.providerProfile.services (only ever set at
  // signup/login time and not kept in sync with later service edits).
  const { data: servicesChecklistData } = useQuery<{ services: unknown[] }>({
    queryKey: ["/api/provider", providerId, "custom-services"],
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

  const { data: feedData, refetch: refetchFeed } = useQuery<{ cards: FeedCardData[] }>({
    queryKey: ["/api/provider", providerId, "feed"],
    enabled: !!providerId,
    staleTime: 0,
  });

  const [dismissedFeedCards, setDismissedFeedCards] = useState<Set<string>>(new Set());

  const dismissFeedMutation = useMutation({
    mutationFn: async (cardId: string) => {
      await apiRequest("POST", `/api/provider/${providerId}/feed/dismiss`, { cardId });
    },
  });

  const handleDismissFeedCard = (cardId: string) => {
    setDismissedFeedCards((prev) => new Set(prev).add(cardId));
    dismissFeedMutation.mutate(cardId);
  };

  const visibleFeedCards = (feedData?.cards ?? []).filter(
    (c) => !dismissedFeedCards.has(c.id),
  );

  const [refreshing, setRefreshing] = useState(false);

  const stats = statsData?.stats || {
    revenueMTD: 0,
    jobsCompleted: 0,
    activeClients: 0,
    upcomingJobs: 0,
  };

  const jobs = jobsData?.jobs || [];
  const clients = clientsData?.clients || [];

  // ── Booking streak ──────────────────────────────────────────────────────
  const displayStreak = useMemo(() => {
    const rawStreak: number = (freshProviderData?.provider as any)?.currentBookingStreak ?? 0;
    const rawLastDate: string | null = (freshProviderData?.provider as any)?.lastStreakDate ?? null;
    if (!rawLastDate || rawStreak <= 0) return 0;
    const todayStr = new Date().toISOString().split("T")[0];
    const yest = new Date(); yest.setUTCDate(yest.getUTCDate() - 1);
    const yestStr = yest.toISOString().split("T")[0];
    const lastStr = new Date(rawLastDate).toISOString().split("T")[0];
    return (lastStr === todayStr || lastStr === yestStr) ? rawStreak : 0;
  }, [freshProviderData?.provider]);

  const prevStreakRef = useRef(0);
  const flameScale = useSharedValue(1);
  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: flameScale.value }] }));
  useEffect(() => {
    if (displayStreak > prevStreakRef.current && displayStreak > 0) {
      flameScale.value = withSequence(
        withSpring(1.5, { damping: 4, stiffness: 300 }),
        withSpring(1.0, { damping: 8, stiffness: 200 }),
      );
    }
    prevStreakRef.current = displayStreak;
  }, [displayStreak]);

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
    await Promise.all([refetchStats(), refetchJobs(), refetchFeed()]);
    setRefreshing(false);
  };

  // Keep the "Next Job" / "Earned Today" home & lock screen widgets fresh
  // whenever the underlying jobs or stats data changes (job created/updated,
  // invoice paid, etc.). No-op on non-iOS platforms.
  useEffect(() => {
    if (!providerId || jobsLoading || statsLoading) return;
    syncProviderWidgetData(providerId);
  }, [providerId, jobs, stats.revenueMTD, jobsLoading, statsLoading]);

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

  // First payment celebration trigger (Task #407).
  // Only fires once: when the provider has received their first payment but
  // hasn't yet seen the celebration screen. A local ref prevents re-triggering
  // during the same app session (the server flag handles future sessions).
  const celebrationShownRef = useRef(false);
  useEffect(() => {
    const p = freshProviderData?.provider as
      | { firstPaymentReceived?: boolean; firstPaymentCelebrated?: boolean; firstPaymentAmountCents?: number | null }
      | undefined;
    if (
      p?.firstPaymentReceived === true &&
      p?.firstPaymentCelebrated === false &&
      !celebrationShownRef.current
    ) {
      celebrationShownRef.current = true;
      setTimeout(() => {
        navigation.navigate("FirstPaymentCelebration", {
          amountCents: p.firstPaymentAmountCents ?? 0,
        });
      }, 600);
    }
  }, [freshProviderData?.provider, navigation]);

  // Refetch provider data on foreground so celebration trigger fires immediately
  // when provider returns to the app after receiving their first payment (Task #407).
  useEffect(() => {
    if (!providerId) return;
    let lastState = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (lastState.match(/inactive|background/) && next === "active") {
        queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId] });
      }
      lastState = next;
    });
    return () => sub.remove();
  }, [providerId, queryClient]);

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
  const servicesCount = servicesChecklistData?.services?.length ?? 0;
  const hasServices = servicesCount > 0;
  const hasMultipleServices = servicesCount > 1;
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
      key: "booking",
      label: "Share your booking link",
      subtitle: "Send clients a link to book online",
      icon: "link" as const,
      done: hasBookingLink,
      onPress: () => navigation.navigate("BookingLink"),
    },
    {
      key: "service",
      label: "Create your first service",
      subtitle: "Define what you offer",
      icon: "tool" as const,
      done: hasServices,
      onPress: () => navigation.navigate("BusinessHub", { initialTab: "services" }),
    },
    {
      key: "client",
      label: "Add your first client",
      subtitle: "Build your client list",
      icon: "user-plus" as const,
      done: hasClients,
      onPress: () => navigation.navigate("AddClient"),
    },
    {
      key: "bio",
      label: "Polish your bio",
      subtitle: "AI can draft one in seconds",
      icon: "edit-3" as const,
      done: hasBio,
      onPress: () => navigation.navigate("BusinessHub", { initialTab: "profile" }),
    },
    {
      key: "hours",
      label: "Set your business hours",
      subtitle: "Tell clients when you're available",
      icon: "clock" as const,
      done: hasBusinessHours,
      onPress: () => navigation.navigate("BusinessHub", { initialTab: "profile" }),
    },
    {
      key: "stripe",
      label: "Get paid",
      subtitle: "Set up payments to start getting paid",
      icon: "credit-card" as const,
      done: !!isStripeConnected,
      onPress: () => navigation.navigate("StripeConnect"),
    },
    {
      key: "policies",
      label: "Booking policies & deposits",
      subtitle: "Optional — instant booking, deposits, cancellations",
      icon: "shield" as const,
      done: hasCustomPolicies,
      onPress: () => navigation.navigate("BusinessHub", { initialTab: "policies" }),
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
  const completedStepsCount = allGettingStartedSteps.filter((s) => s.done).length;
  const dismissedChecklistCard = useOnboardingStore((s) => s.dismissedChecklistCard);
  const dismissChecklistCard = useOnboardingStore((s) => s.dismissChecklistCard);
  const showGettingStarted =
    !isLoading && gettingStartedSteps.length > 0 && !dismissedChecklistCard;
  // Once the provider has made real progress (more than one step done),
  // collapse the full checklist into a single dismissible summary row so it
  // doesn't dominate the dashboard.
  const showCollapsedChecklist = showGettingStarted && completedStepsCount > 1;

  // Loading — trying to recover the provider profile from API
  if (!providerId && profileLoading) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: horizontalPadding,
          }}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonLoader width={120} height={24} style={{ marginBottom: Spacing.md }} />
          <StatsSkeleton />
          <View style={{ marginTop: Spacing.xl }}>
            <SkeletonLoader width={140} height={24} style={{ marginBottom: Spacing.md }} />
            <JobsSkeleton />
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  // No profile found even after API fetch — show proper CTA
  if (!providerId && !profileLoading) {
    return <ProfileMissingCTA navigation={navigation} />;
  }

  return (
    <ThemedView style={styles.container}>
      {/* Layout audit ✓
          paddingTop: headerHeight (useHeaderHeight with headerTransparent:true
          includes the status-bar inset — no additional insets.top double-count)
          + Spacing.lg visual breathing room.
          paddingBottom: tabBarHeight (useFloatingTabBarHeight = pill height +
          insets.bottom) + Spacing.xl clears the floating tab pill. */}
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
        <View style={{ marginHorizontal: -horizontalPadding }}>
          <GracePeriodBanner
            firstPaymentAmountCents={
              (freshProviderData?.provider as any)?.firstPaymentAmountCents ?? null
            }
          />
          <CrewWelcomeBanner />
        </View>

        <RecapCard />

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
            {displayStreak > 0 ? (
              <View style={styles.streakRow}>
                <Animated.Text style={[styles.streakEmoji, flameStyle]}>🔥</Animated.Text>
                <ThemedText style={[styles.streakText, { color: theme.textSecondary }]}>
                  {displayStreak}-day booking streak — keep it going!
                </ThemedText>
              </View>
            ) : null}
          </GlassCard>
        </Animated.View>

        {inProgressJobs.length > 0 || upcomingJobsAll.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <Pressable
              onPress={() => navigation.navigate("ProviderToday")}
              testID="banner-today"
            >
              <GlassCard style={[styles.greetingCard, { borderColor: Colors.accent, borderWidth: 1 }]}>
                <View style={styles.publishRow}>
                  <View style={[styles.publishIcon, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="navigation" size={20} color={Colors.accent} />
                  </View>
                  <View style={styles.publishText}>
                    <ThemedText style={styles.publishTitle}>Today's Stops</ThemedText>
                    <ThemedText style={[styles.publishSubtitle, { color: theme.textSecondary }]}>
                      Swipe through your route, navigate, and check off jobs.
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.textTertiary} />
                </View>
              </GlassCard>
            </Pressable>
          </Animated.View>
        ) : null}

        <MonthlyGoalCard
          providerId={providerId}
          revenueMTDDollars={stats.revenueMTD}
          monthlyGoalCents={(freshProviderData?.provider as any)?.monthlyGoalCents ?? null}
          theme={theme}
          queryClient={queryClient}
        />

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          {isLoading ? (
            <StatsSkeleton />
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

        {inProgressJobs.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(220).duration(400)}>
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
          entering={FadeInDown.delay(inProgressJobs.length > 0 ? 260 : 230).duration(400)}
        >
          <SectionHeader
            title="Upcoming Jobs"
            actionLabel="See All"
            onAction={() => navigation.navigate("ScheduleTab")}
          />
        </Animated.View>

        {isLoading ? (
          <Animated.View entering={FadeInDown.delay(280).duration(400)}>
            <JobsSkeleton />
          </Animated.View>
        ) : upcomingJobs.length > 0 ? (
          upcomingJobs.map((job, index) => (
            <Animated.View
              key={job.id}
              entering={FadeInDown.delay((inProgressJobs.length > 0 ? 300 : 260) + index * 100).duration(400)}
            >
              <JobCard
                job={formatJobForCard(job)}
                onPress={() => navigation.navigate("ProviderJobDetail", { jobId: job.id })}
                testID={`job-${job.id}`}
              />
            </Animated.View>
          ))
        ) : (
          <Animated.View entering={FadeInDown.delay(280).duration(400)}>
            <GlassCard style={styles.emptyCard}>
              <EmptyState
                icon="calendar"
                title="No upcoming jobs"
                description="You don't have any jobs scheduled for today or the future."
                primaryAction={{
                  label: "Add a Job",
                  onPress: () => navigation.navigate("AddJob"),
                }}
              />
            </GlassCard>
          </Animated.View>
        )}

        {visibleFeedCards.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(320).duration(400)}>
            <ProviderFeed
              cards={visibleFeedCards}
              onDismiss={handleDismissFeedCard}
            />
          </Animated.View>
        ) : null}

        {newLeadCount > 0 ? (
          <Animated.View entering={FadeInDown.delay(340).duration(400)}>
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
          <Animated.View entering={FadeInDown.delay(360).duration(400)}>
            {showCollapsedChecklist ? (
              <View style={styles.checklistCollapsedRow}>
                <Pressable
                  style={[styles.checklistCollapsedMain, { backgroundColor: theme.cardBackground }]}
                  onPress={gettingStartedSteps[0]?.onPress}
                  testID="checklist-collapsed-summary"
                >
                  <View style={[styles.checklistIcon, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="check-circle" size={16} color={Colors.accent} />
                  </View>
                  <View style={styles.checklistText}>
                    <ThemedText style={styles.checklistLabel}>Finish setting up</ThemedText>
                    <ThemedText style={[styles.checklistSubtitle, { color: theme.textSecondary }]}>
                      {gettingStartedSteps.length} {gettingStartedSteps.length === 1 ? "step" : "steps"} left
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={16} color={theme.textTertiary} />
                </Pressable>
                <Pressable
                  onPress={dismissChecklistCard}
                  style={styles.checklistDismiss}
                  hitSlop={10}
                  testID="checklist-dismiss-card"
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss getting started"
                >
                  <Feather name="x" size={14} color={theme.textTertiary} />
                </Pressable>
              </View>
            ) : (
              <>
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
                          accessibilityRole="button"
                          accessibilityLabel={`Dismiss ${step.label}`}
                        >
                          <Feather name="x" size={14} color={theme.textTertiary} />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </GlassCard>
              </>
            )}
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
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
              <EmptyState
                icon="alert-circle"
                title="Insights unavailable"
                description="We had trouble loading your business analytics. Pull down to refresh."
              />
            </GlassCard>
          ) : !insightsData.insights.hasAnyData ? (
            <GlassCard style={styles.insightsEmptyCard}>
              <EmptyState
                icon="bar-chart-2"
                title="No data yet"
                description="Your business insights will appear here once you complete your first few jobs."
              />
            </GlassCard>
          ) : (
            <View>
              <View style={styles.insightGridRow}>
                <StatCard
                  title="Revenue MTD"
                  value={formatMoney(insightsData.insights.revenueMtd, { cents: true, compact: true })}
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
                  value={formatMoney(insightsData.insights.avgJobValue, { cents: true, compact: true })}
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

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  insightsEmptyCard: {
    paddingVertical: Spacing.sm,
  },
  // Monthly Goal card
  goalCard: {
    marginBottom: Spacing.lg,
  },
  goalCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  goalIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  goalTitle: {
    ...Typography.callout,
    fontWeight: "600",
  },
  goalSubtitle: {
    ...Typography.caption1,
    marginTop: 2,
  },
  goalEditLink: {
    ...Typography.callout,
    fontWeight: "600",
  },
  goalProgressTrack: {
    height: 8,
    borderRadius: 4,
    marginTop: Spacing.md,
    overflow: "hidden",
  },
  goalProgressFill: {
    height: 8,
    borderRadius: 4,
  },
  goalProgressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  goalProgressPct: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  goalCelebration: {
    ...Typography.caption1,
    fontWeight: "700",
  },
  goalModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  goalModalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.xl,
    paddingBottom: Spacing["2xl"],
  },
  goalModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  goalModalTitle: {
    ...Typography.title2,
    marginBottom: Spacing.xs,
  },
  goalModalSubtitle: {
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  goalModalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  goalModalPreset: {
    width: "47%",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 2,
  },
  goalModalPresetLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  goalModalCustomBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  goalModalCustomInput: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },

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
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.md,
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
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  streakEmoji: {
    fontSize: 15,
  },
  streakText: {
    ...Typography.subhead,
    flex: 1,
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
  checklistCard: {
    padding: 0,
    overflow: "hidden",
  },
  checklistCollapsedRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  checklistCollapsedMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
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
