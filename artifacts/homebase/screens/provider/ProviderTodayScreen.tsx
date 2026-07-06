import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Linking,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useNetworkStore } from "@/state/networkStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type JobStatus =
  | "scheduled"
  | "confirmed"
  | "on_my_way"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "weather_held"
  | "no_show";

interface JobChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

interface Job {
  id: string;
  providerId: string;
  clientId: string;
  title: string;
  description?: string | null;
  scheduledDate: string;
  scheduledTime?: string | null;
  status: JobStatus;
  address?: string | null;
  notes?: string | null;
  estimatedPrice?: string | null;
  checklist?: JobChecklistItem[] | null;
  homeId?: string | null;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(time?: string | null): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

const ACTIVE_STATUSES: JobStatus[] = [
  "scheduled",
  "confirmed",
  "on_my_way",
  "arrived",
  "in_progress",
];

const STATUS_LABEL: Record<JobStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  on_my_way: "On My Way",
  arrived: "Arrived",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  weather_held: "Weather Hold",
  no_show: "No Show",
};

const STATUS_COLOR: Record<JobStatus, string> = {
  scheduled: Colors.info,
  confirmed: "#8B5CF6",
  on_my_way: "#F59E0B",
  arrived: "#F59E0B",
  in_progress: Colors.accent,
  completed: Colors.success,
  cancelled: Colors.error,
  weather_held: Colors.warning,
  no_show: Colors.error,
};

const SWIPE_THRESHOLD = 110;
const SCREEN_EXIT_X = 500;

export default function ProviderTodayScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { providerProfile } = useAuthStore();
  const isOnline = useNetworkStore((s) => s.isOnline);

  const providerId = providerProfile?.id;
  const today = useMemo(() => new Date(), []);
  const dateKey = useMemo(() => ymd(today), [today]);

  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useQuery<{
    jobs: Job[];
  }>({
    queryKey: ["/api/provider", providerId, "jobs"],
    enabled: !!providerId && isOnline,
  });

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId && isOnline,
  });

  const { data: routeOrderData } = useQuery<{ order: string[] | null }>({
    queryKey: ["/api/provider", providerId, "route-order", dateKey],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/provider/${providerId}/route/order/${dateKey}`,
      );
      return res.json();
    },
    enabled: !!providerId && isOnline,
    retry: false,
  });

  const jobs = jobsData?.jobs || [];
  const clients = clientsData?.clients || [];
  const manualOrder = routeOrderData?.order;

  const stops = useMemo(() => {
    const todays = jobs.filter(
      (job) =>
        ACTIVE_STATUSES.includes(job.status) &&
        isSameDay(new Date(job.scheduledDate), today),
    );
    if (manualOrder && manualOrder.length > 0) {
      const orderIndex = new Map(manualOrder.map((id, idx) => [id, idx]));
      return [...todays].sort((a, b) => {
        const ia = orderIndex.has(a.id) ? orderIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
        const ib = orderIndex.has(b.id) ? orderIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
        if (ia !== ib) return ia - ib;
        return (a.scheduledTime || "").localeCompare(b.scheduledTime || "");
      });
    }
    return [...todays].sort((a, b) =>
      (a.scheduledTime || "").localeCompare(b.scheduledTime || ""),
    );
  }, [jobs, manualOrder, today]);

  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => {
    setCurrentIndex((i) => Math.min(i, Math.max(stops.length - 1, 0)));
  }, [stops.length]);

  const getClientName = useCallback(
    (clientId: string): string => {
      const c = clients.find((c) => c.id === clientId);
      return c ? `${c.firstName} ${c.lastName}` : "Client";
    },
    [clients],
  );

  const getClient = useCallback(
    (clientId: string) => clients.find((c) => c.id === clientId),
    [clients],
  );

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, stops.length - 1));
  }, [stops.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const [checklistOverrides, setChecklistOverrides] = useState<
    Record<string, JobChecklistItem[]>
  >({});
  const [generatingChecklistFor, setGeneratingChecklistFor] = useState<string | null>(null);
  const [expandedChecklist, setExpandedChecklist] = useState(false);

  const getChecklist = useCallback(
    (job: Job): JobChecklistItem[] | null => {
      if (checklistOverrides[job.id]) return checklistOverrides[job.id];
      return Array.isArray(job.checklist) ? job.checklist : null;
    },
    [checklistOverrides],
  );

  const persistChecklist = useCallback(
    (jobId: string, next: JobChecklistItem[]) => {
      setChecklistOverrides((prev) => ({ ...prev, [jobId]: next }));
      apiRequest("PATCH", `/api/jobs/${jobId}/checklist-state`, {
        checklist: next,
      }).catch(() => {});
    },
    [],
  );

  const handleToggleChecklistItem = useCallback(
    (job: Job, itemId: string) => {
      const current = getChecklist(job) || [];
      const next = current.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item,
      );
      Haptics.selectionAsync();
      persistChecklist(job.id, next);
    },
    [getChecklist, persistChecklist],
  );

  const handleGenerateChecklist = useCallback(
    async (job: Job) => {
      if (!isOnline) return;
      setGeneratingChecklistFor(job.id);
      try {
        const res = await apiRequest("POST", `/api/jobs/${job.id}/generate-checklist`, {});
        const data = (await res.json()) as { checklist?: JobChecklistItem[] };
        if (Array.isArray(data?.checklist)) {
          setChecklistOverrides((prev) => ({ ...prev, [job.id]: data.checklist! }));
        }
      } catch {
        // Non-fatal — provider can retry from the job detail screen.
      } finally {
        setGeneratingChecklistFor(null);
      }
    },
    [isOnline],
  );

  const updateStatusMutation = useMutation({
    mutationFn: async (params: { jobId: string; status: JobStatus }) => {
      const res = await apiRequest("PUT", `/api/jobs/${params.jobId}`, {
        status: params.status,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "jobs"] });
    },
  });

  const completeJobMutation = useMutation({
    mutationFn: async (job: Job) => {
      const res = await apiRequest("POST", `/api/jobs/${job.id}/complete`, {
        finalPrice: job.estimatedPrice,
      });
      return res.json() as Promise<{ invoiceId?: string | null }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "jobs"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExpandedChecklist(false);
      goNext();
    },
  });

  const handleNavigate = useCallback((job: Job) => {
    if (!job.address) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const address = encodeURIComponent(job.address);
    const url =
      Platform.OS === "ios"
        ? `maps://?address=${address}`
        : `https://www.google.com/maps/dir/?api=1&destination=${address}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${address}`);
    });
  }, []);

  const handleOnMyWay = useCallback(
    (job: Job) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      updateStatusMutation.mutate({ jobId: job.id, status: "on_my_way" });
    },
    [updateStatusMutation],
  );

  const handleComplete = useCallback(
    (job: Job) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      completeJobMutation.mutate(job);
    },
    [completeJobMutation],
  );

  const translateX = useSharedValue(0);
  const isAnimatingOff = useRef(false);

  const advanceAfterSwipe = useCallback(
    (direction: 1 | -1) => {
      isAnimatingOff.current = false;
      translateX.value = 0;
      setExpandedChecklist(false);
      if (direction === 1) goNext();
      else goPrev();
    },
    [goNext, goPrev],
  );

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD && !isAnimatingOff.current) {
        isAnimatingOff.current = true;
        const dir = e.translationX > 0 ? 1 : -1;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        translateX.value = withTiming(
          dir * SCREEN_EXIT_X,
          { duration: 220 },
          (finished) => {
            if (finished) {
              runOnJS(advanceAfterSwipe)(dir === 1 ? 1 : -1);
            }
          },
        );
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const topCardStyle = useAnimatedStyle(() => {
    const rotateZ = interpolate(
      translateX.value,
      [-SCREEN_EXIT_X, 0, SCREEN_EXIT_X],
      [-14, 0, 14],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateX: translateX.value }, { rotateZ: `${rotateZ}deg` }],
    };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ scale: 0.94 + progress * 0.06 }],
      opacity: 0.7 + progress * 0.3,
    };
  });

  const job = stops[currentIndex];
  const nextJob = stops[currentIndex + 1];

  if (jobsLoading && stops.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.centerFill, { paddingTop: headerHeight }]}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </ThemedView>
    );
  }

  if (stops.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View
          style={[
            styles.centerFill,
            { paddingTop: headerHeight, paddingHorizontal: horizontalPadding },
          ]}
        >
          <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="sun" size={32} color={Colors.accent} />
          </View>
          <ThemedText type="h3" style={styles.emptyTitle}>
            No stops today
          </ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Enjoy the day off — your schedule is clear.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!job) {
    return (
      <ThemedView style={styles.container}>
        <View
          style={[
            styles.centerFill,
            { paddingTop: headerHeight, paddingHorizontal: horizontalPadding },
          ]}
        >
          <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="check-circle" size={32} color={Colors.success} />
          </View>
          <ThemedText type="h3" style={styles.emptyTitle}>
            All done for today
          </ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            You've made it through every stop.
          </ThemedText>
          <SecondaryButton style={{ marginTop: Spacing.lg }} onPress={goPrev} testID="button-review-stops">
            Review stops
          </SecondaryButton>
        </View>
      </ThemedView>
    );
  }

  const client = getClient(job.clientId);
  const checklist = getChecklist(job);
  const checklistDone = checklist ? checklist.filter((c) => c.completed).length : 0;
  const checklistTotal = checklist ? checklist.length : 0;
  const isBusy = updateStatusMutation.isPending || completeJobMutation.isPending;
  const isCompleted = job.status === "completed";
  const isOnMyWayOrLater = job.status !== "scheduled" && job.status !== "confirmed";

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: headerHeight + Spacing.sm, paddingHorizontal: horizontalPadding },
        ]}
      >
        <Pressable
          onPress={goPrev}
          disabled={currentIndex === 0}
          style={styles.pagerArrow}
          testID="button-prev-stop"
        >
          <Feather
            name="chevron-left"
            size={22}
            color={currentIndex === 0 ? theme.textTertiary : theme.text}
          />
        </Pressable>
        <ThemedText style={[styles.pagerLabel, { color: theme.textSecondary }]}>
          Stop {currentIndex + 1} of {stops.length}
        </ThemedText>
        <Pressable
          onPress={goNext}
          disabled={currentIndex === stops.length - 1}
          style={styles.pagerArrow}
          testID="button-next-stop"
        >
          <Feather
            name="chevron-right"
            size={22}
            color={currentIndex === stops.length - 1 ? theme.textTertiary : theme.text}
          />
        </Pressable>
      </View>

      <View style={[styles.stackArea, { paddingHorizontal: horizontalPadding }]}>
        {nextJob ? (
          <Animated.View
            key={nextJob.id}
            style={[styles.card, styles.behindCard, nextCardStyle]}
            pointerEvents="none"
          >
            <GlassCard style={styles.cardInner} noPadding>
              <View style={styles.cardContent} />
            </GlassCard>
          </Animated.View>
        ) : null}

        <GestureDetector gesture={panGesture}>
          <Animated.View
            key={job.id}
            entering={FadeIn.duration(150)}
            style={[styles.card, styles.topCard, topCardStyle]}
          >
            <GlassCard style={styles.cardInner} noPadding>
              <ScrollView
                style={styles.cardContent}
                contentContainerStyle={{ paddingBottom: Spacing.lg }}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: `${STATUS_COLOR[job.status]}22` },
                    ]}
                  >
                    <ThemedText
                      style={[styles.statusPillText, { color: STATUS_COLOR[job.status] }]}
                    >
                      {STATUS_LABEL[job.status]}
                    </ThemedText>
                  </View>
                  {job.scheduledTime ? (
                    <ThemedText style={[styles.timeText, { color: theme.textSecondary }]}>
                      {formatTime(job.scheduledTime)}
                    </ThemedText>
                  ) : null}
                </View>

                <ThemedText type="h2" style={styles.clientName} testID="text-today-client">
                  {getClientName(job.clientId)}
                </ThemedText>
                <ThemedText style={[styles.serviceTitle, { color: theme.textSecondary }]}>
                  {job.title}
                </ThemedText>

                {job.address ? (
                  <Pressable
                    style={styles.addressRow}
                    onPress={() => handleNavigate(job)}
                    testID="row-today-address"
                  >
                    <Feather name="map-pin" size={16} color={Colors.accent} />
                    <ThemedText style={[styles.addressText, { color: theme.text }]}>
                      {job.address}
                    </ThemedText>
                  </Pressable>
                ) : null}

                {client?.phone ? (
                  <View style={styles.contactRow}>
                    <Pressable
                      style={styles.contactButton}
                      onPress={() => Linking.openURL(`tel:${client.phone}`)}
                      testID="button-today-call"
                    >
                      <Feather name="phone" size={14} color={Colors.accent} />
                      <ThemedText style={[styles.contactButtonText, { color: Colors.accent }]}>
                        Call
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      style={styles.contactButton}
                      onPress={() => Linking.openURL(`sms:${client.phone}`)}
                      testID="button-today-text"
                    >
                      <Feather name="message-circle" size={14} color={Colors.accent} />
                      <ThemedText style={[styles.contactButtonText, { color: Colors.accent }]}>
                        Text
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : null}

                {job.notes ? (
                  <View
                    style={[
                      styles.notesBox,
                      { backgroundColor: theme.backgroundSecondary },
                    ]}
                  >
                    <View style={styles.notesHeader}>
                      <Feather name="key" size={14} color={theme.textSecondary} />
                      <ThemedText
                        style={[styles.notesLabel, { color: theme.textSecondary }]}
                      >
                        Gate / access notes
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.notesText, { color: theme.text }]}>
                      {job.notes}
                    </ThemedText>
                  </View>
                ) : null}

                <Pressable
                  style={[styles.checklistToggle, { borderColor: theme.separator }]}
                  onPress={() => setExpandedChecklist((v) => !v)}
                  testID="button-toggle-checklist"
                >
                  <Feather name="check-square" size={16} color={theme.text} />
                  <ThemedText style={[styles.checklistToggleText, { color: theme.text }]}>
                    Checklist
                    {checklistTotal > 0 ? ` (${checklistDone}/${checklistTotal})` : ""}
                  </ThemedText>
                  <Feather
                    name={expandedChecklist ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={theme.textSecondary}
                  />
                </Pressable>

                {expandedChecklist ? (
                  <View style={styles.checklistBody}>
                    {checklist === null ? (
                      <View style={styles.checklistEmpty}>
                        <ThemedText
                          style={[styles.checklistEmptyText, { color: theme.textSecondary }]}
                        >
                          No checklist yet for this job.
                        </ThemedText>
                        <SecondaryButton
                          onPress={() => handleGenerateChecklist(job)}
                          loading={generatingChecklistFor === job.id}
                          testID="button-generate-checklist"
                        >
                          Generate checklist
                        </SecondaryButton>
                      </View>
                    ) : checklist.length === 0 ? (
                      <ThemedText
                        style={[styles.checklistEmptyText, { color: theme.textSecondary }]}
                      >
                        This job has no checklist steps.
                      </ThemedText>
                    ) : (
                      checklist.map((item) => (
                        <Pressable
                          key={item.id}
                          style={styles.checklistRow}
                          onPress={() => handleToggleChecklistItem(job, item.id)}
                          testID={`checklist-item-${item.id}`}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              {
                                borderColor: item.completed
                                  ? Colors.success
                                  : theme.separator,
                                backgroundColor: item.completed
                                  ? Colors.success
                                  : "transparent",
                              },
                            ]}
                          >
                            {item.completed ? (
                              <Feather name="check" size={18} color="#FFF" />
                            ) : null}
                          </View>
                          <ThemedText
                            style={[
                              styles.checklistLabel,
                              {
                                color: item.completed ? theme.textSecondary : theme.text,
                                textDecorationLine: item.completed
                                  ? "line-through"
                                  : "none",
                              },
                            ]}
                          >
                            {item.label}
                          </ThemedText>
                        </Pressable>
                      ))
                    )}
                  </View>
                ) : null}
              </ScrollView>
            </GlassCard>
          </Animated.View>
        </GestureDetector>
      </View>

      <View
        style={[
          styles.actionBar,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}
      >
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.bigActionButton, { backgroundColor: theme.cardBackground }]}
            onPress={() => handleNavigate(job)}
            testID="button-today-navigate"
          >
            <Feather name="navigation" size={26} color={Colors.accent} />
            <ThemedText style={[styles.bigActionLabel, { color: theme.text }]}>
              Navigate
            </ThemedText>
          </Pressable>

          <Pressable
            style={[
              styles.bigActionButton,
              { backgroundColor: theme.cardBackground },
              (isOnMyWayOrLater || isBusy || isCompleted) && styles.bigActionButtonDisabled,
            ]}
            onPress={() => handleOnMyWay(job)}
            disabled={isOnMyWayOrLater || isBusy || isCompleted}
            testID="button-today-on-my-way"
          >
            <Feather name="truck" size={26} color={isOnMyWayOrLater ? theme.textTertiary : "#F59E0B"} />
            <ThemedText
              style={[
                styles.bigActionLabel,
                { color: isOnMyWayOrLater ? theme.textTertiary : theme.text },
              ]}
            >
              On My Way
            </ThemedText>
          </Pressable>
        </View>

        <PrimaryButton
          onPress={() => handleComplete(job)}
          disabled={isCompleted}
          loading={completeJobMutation.isPending}
          style={styles.completeButton}
          testID="button-today-complete"
        >
          {isCompleted ? "Completed" : "Complete Stop"}
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Spacing.sm,
  },
  pagerArrow: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pagerLabel: {
    ...Typography.label,
  },
  stackArea: {
    flex: 1,
    position: "relative",
  },
  card: {
    position: "absolute",
    top: Spacing.sm,
    left: 0,
    right: 0,
    bottom: Spacing.md,
  },
  topCard: {
    zIndex: 2,
  },
  behindCard: {
    zIndex: 1,
  },
  cardInner: {
    flex: 1,
  },
  cardContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  statusPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusPillText: {
    ...Typography.caption,
    fontWeight: "700",
  },
  timeText: {
    ...Typography.body,
    fontWeight: "600",
  },
  clientName: {
    marginBottom: 2,
  },
  serviceTitle: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  addressText: {
    ...Typography.body,
    flex: 1,
  },
  contactRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contactButtonText: {
    ...Typography.body,
    fontWeight: "600",
  },
  notesBox: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  notesLabel: {
    ...Typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  notesText: {
    ...Typography.body,
  },
  checklistToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  checklistToggleText: {
    ...Typography.body,
    fontWeight: "600",
    flex: 1,
  },
  checklistBody: {
    marginTop: Spacing.sm,
  },
  checklistEmpty: {
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  checklistEmptyText: {
    ...Typography.body,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistLabel: {
    ...Typography.body,
    flex: 1,
  },
  actionBar: {
    paddingTop: Spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  bigActionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  bigActionButtonDisabled: {
    opacity: 0.5,
  },
  bigActionLabel: {
    ...Typography.body,
    fontWeight: "700",
  },
  completeButton: {
    paddingVertical: Spacing.lg,
  },
});
