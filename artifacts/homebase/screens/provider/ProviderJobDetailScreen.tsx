import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { StyleSheet, View, ScrollView, Pressable, Linking, Alert, ActivityIndicator, Image, Platform, TextInput, Modal, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { formatMoney, formatDate } from "@/lib/format";
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
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { RecordPaymentSheet } from "@/components/RecordPaymentSheet";
import { NoShowFeeSheet } from "@/components/NoShowFeeSheet";
import { HomeProfileSection, type HomeProfile } from "@/components/HomeProfileSection";
import { useNetworkStore } from "@/state/networkStore";
import { loadScheduleSnapshot } from "@/lib/offline-cache";
import { recordHappyMoment } from "@/state/appReviewStore";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";

type JobStatus = "scheduled" | "confirmed" | "on_my_way" | "arrived" | "in_progress" | "completed" | "cancelled" | "weather_held" | "no_show";

type DBJobStatus = JobStatus;
type DisplayStatus = JobStatus;

import { SkeletonLoader, SkeletonCard, SkeletonListRow } from "@/components/SkeletonLoader";

function JobDetailSkeleton() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: horizontalPadding,
        }}
      >
        <SkeletonLoader height={140} style={{ marginBottom: Spacing.md }} borderRadius={BorderRadius.lg} />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    </ThemedView>
  );
}
import { BottomSheet } from "@/components/BottomSheet";
import { NativeDatePickerSheet } from "@/components/NativeDatePickerSheet";

export function HomeownerNotesBanner({ homeId }: { homeId: string }) {
  const [notes, setNotes] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiRequest("GET", `/api/homes/${homeId}/profile/provider-view`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.home?.knownIssues) {
          setNotes(String(data.home.knownIssues));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [homeId]);
  if (!notes) return null;
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.warning,
        backgroundColor: "rgba(255, 193, 7, 0.08)",
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Feather name="alert-circle" size={14} color={Colors.warning} />
        <ThemedText style={{ fontWeight: "700", fontSize: 13, color: Colors.warning }}>
          Homeowner notes for you
        </ThemedText>
      </View>
      <ThemedText style={{ fontSize: 14, lineHeight: 20, color: Colors.warning }}>{notes}</ThemedText>
    </View>
  );
}

function ProviderHomeProfile({ homeId }: { homeId: string }) {
  const { theme } = useTheme();
  const [home, setHome] = useState<HomeProfile | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiRequest("GET", `/api/homes/${homeId}/profile/provider-view`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.home) setHome(data.home as HomeProfile);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [homeId]);
  const [expanded, setExpanded] = useState(false);
  if (!home) return null;
  if (!expanded) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        style={{
          padding: 14,
          borderRadius: BorderRadius.md,
          backgroundColor: theme.backgroundSecondary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginVertical: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Feather name="home" size={16} color={theme.text} />
          <ThemedText style={{ fontWeight: "600" }}>
            Home profile{home.knownIssues ? " · Notes from homeowner" : ""}
          </ThemedText>
        </View>
        <Feather name="chevron-down" size={18} color={theme.text} />
      </Pressable>
    );
  }
  return (
    <View>
      <Pressable
        onPress={() => setExpanded(false)}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}
      >
        <Feather name="chevron-up" size={16} color={theme.text} />
        <ThemedText style={{ fontWeight: "600" }}>Hide home profile</ThemedText>
      </Pressable>
      <HomeProfileSection home={home} editable={false} highlightKnownIssues />
    </View>
  );
}

interface ApiJob {
  id: string;
  providerId: string;
  clientId: string;
  serviceId: string | null;
  title: string;
  description: string | null;
  scheduledDate: string;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  status: DBJobStatus;
  address: string | null;
  estimatedPrice: string | null;
  finalPrice: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isRecurring?: boolean;
  recurringFrequency?: string | null;
  checklist?: JobChecklistItem[] | null;
  homeId?: string | null;
  appointmentId?: string | null;
  // Present when this job is part of a recurring series.
  seriesId?: string | null;
  assignedCrewMemberId?: string | null;
}

interface ApiClient {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
}

interface JobChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

const STATUS_CONFIG: Record<DisplayStatus, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  scheduled: { label: "Scheduled", color: Colors.info, icon: "calendar" },
  confirmed: { label: "Confirmed", color: "#8B5CF6", icon: "check-circle" },
  on_my_way: { label: "On My Way", color: Colors.warning, icon: "navigation" },
  arrived: { label: "Arrived", color: Colors.warning, icon: "map-pin" },
  in_progress: { label: "In Progress", color: Colors.warning, icon: "tool" },
  completed: { label: "Completed", color: Colors.accent, icon: "check" },
  cancelled: { label: "Cancelled", color: Colors.error, icon: "x-circle" },
  weather_held: { label: "Weather Hold", color: "#6B7280", icon: "cloud-rain" },
  no_show: { label: "No Show", color: Colors.error, icon: "user-x" },
};

const STATUS_ORDER: DisplayStatus[] = ["scheduled", "confirmed", "on_my_way", "arrived", "in_progress", "completed"];


function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getClientName(client: ApiClient): string {
  return [client.firstName, client.lastName].filter(Boolean).join(" ") || "Unknown Client";
}

function mapDbStatusToDisplay(status: DBJobStatus): DisplayStatus {
  return status;
}


interface StatusBannerProps {
  status: DisplayStatus;
}

function StatusBanner({ status }: StatusBannerProps) {
  const { theme } = useTheme();
  const config = STATUS_CONFIG[status];
  const currentIndex = STATUS_ORDER.indexOf(status);

  return (
    <GlassCard style={styles.statusBanner}>
      <View style={styles.statusHeader}>
        <View style={[styles.statusIcon, { backgroundColor: config.color + "20" }]}>
          <Feather name={config.icon} size={24} color={config.color} />
        </View>
        <View style={styles.statusInfo}>
          <ThemedText type="h3" style={{ color: config.color }}>
            {config.label}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {status === "completed"
              ? "Job finished"
              : status === "cancelled"
                ? "Job cancelled"
                : status === "no_show"
                  ? "Client didn't show up for this appointment"
                  : status === "weather_held"
                    ? "Paused for weather"
                    : "In progress"}
          </ThemedText>
        </View>
      </View>

      {status !== "cancelled" && status !== "weather_held" && status !== "no_show" ? (
        <View style={styles.progressBar}>
          {STATUS_ORDER.map((s, index) => {
            const isCompleted = index <= currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <View key={s} style={styles.progressItem}>
                <View
                  style={[
                    styles.progressDot,
                    isCompleted && { backgroundColor: Colors.accent },
                    isCurrent && [styles.progressDotCurrent, { backgroundColor: theme.backgroundRoot }],
                    !isCompleted && { backgroundColor: theme.separator },
                  ]}
                />
                {index < STATUS_ORDER.length - 1 ? (
                  <View
                    style={[
                      styles.progressLine,
                      { backgroundColor: isCompleted ? Colors.accent : theme.separator },
                    ]}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </GlassCard>
  );
}

interface ChecklistSectionProps {
  checklist: JobChecklistItem[];
  onToggle: (id: string) => void;
  onAddStep: (label: string) => void;
  loading?: boolean;
  isOnline?: boolean;
  onOfflineAttempt?: () => void;
}

function ChecklistSection({ checklist, onToggle, onAddStep, loading, isOnline = true, onOfflineAttempt }: ChecklistSectionProps) {
  const { theme } = useTheme();
  const completedCount = checklist.filter((item) => item.completed).length;
  const [adding, setAdding] = useState(false);
  const [newStepText, setNewStepText] = useState("");

  const submitNewStep = () => {
    const label = newStepText.trim();
    if (!label) return;
    onAddStep(label);
    setNewStepText("");
    setAdding(false);
  };

  return (
    <GlassCard style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="label" style={{ color: theme.textSecondary }}>CHECKLIST</ThemedText>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.accent} />
        ) : (
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {completedCount}/{checklist.length}
          </ThemedText>
        )}
      </View>
      {checklist.length > 0
        ? checklist.map((item) => (
            <Pressable
              key={item.id}
              style={styles.checklistItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggle(item.id);
              }}
              testID={`checklist-item-${item.id}`}
            >
              <View
                style={[
                  styles.checkbox,
                  item.completed && { backgroundColor: Colors.accent, borderColor: Colors.accent },
                  !item.completed && { borderColor: theme.textSecondary },
                ]}
              >
                {item.completed ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
              </View>
              <ThemedText
                type="body"
                style={[
                  { flex: 1 },
                  item.completed && { textDecorationLine: "line-through", color: theme.textSecondary },
                ]}
              >
                {item.label}
              </ThemedText>
            </Pressable>
          ))
        : !adding && !loading ? (
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            No checklist for this service yet.
          </ThemedText>
        ) : null}

      {adding ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm }}>
          <TextInput
            value={newStepText}
            onChangeText={setNewStepText}
            placeholder="e.g., Lay drop cloths"
            placeholderTextColor={theme.textTertiary}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submitNewStep}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: theme.borderLight,
              borderRadius: BorderRadius.sm,
              paddingHorizontal: Spacing.sm,
              paddingVertical: Spacing.xs,
              color: theme.text,
            }}
            testID="input-new-checklist-step"
          />
          <Pressable
            onPress={submitNewStep}
            disabled={!newStepText.trim()}
            hitSlop={11}
            accessibilityRole="button"
            accessibilityLabel="Confirm add step"
            testID="button-confirm-add-step"
          >
            <Feather name="check" size={20} color={newStepText.trim() ? Colors.accent : theme.textTertiary} />
          </Pressable>
          <Pressable
            onPress={() => { setAdding(false); setNewStepText(""); }}
            accessibilityRole="button"
            accessibilityLabel="Cancel add step"
            hitSlop={8}
            testID="button-cancel-add-step"
          >
            <Feather name="x" size={20} color={theme.textTertiary} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            if (!isOnline) {
              onOfflineAttempt?.();
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAdding(true);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: Spacing.sm, alignSelf: "flex-start", opacity: isOnline ? 1 : 0.5 }}
          testID="button-add-checklist-step-job"
        >
          <Feather name="plus" size={16} color={Colors.accent} />
          <ThemedText type="body" style={{ color: Colors.accent, fontWeight: "600" }}>
            Add a step
          </ThemedText>
        </Pressable>
      )}
    </GlassCard>
  );
}

export default function ProviderJobDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<{ ProviderJobDetail: { jobId: string } }, "ProviderJobDetail">>();
  const { jobId } = route.params;
  const { providerProfile, user } = useAuthStore();
  const providerId = providerProfile?.id;
  const queryClient = useQueryClient();

  const [displayStatus, setDisplayStatus] = useState<DisplayStatus | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const checklistFetched = useRef(false);

  // Task #485: before/after photo pair capture state.
  const [beforeAfterCaptureVisible, setBeforeAfterCaptureVisible] = useState(false);
  const [capturedBeforeUri, setCapturedBeforeUri] = useState<string | null>(null);
  const [capturedAfterUri, setCapturedAfterUri] = useState<string | null>(null);
  const [isCapturingPair, setIsCapturingPair] = useState(false);
  const [sharingPairId, setSharingPairId] = useState<string | null>(null);

  const [rescheduleSheetVisible, setRescheduleSheetVisible] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null);
  const [weatherHoldSheetVisible, setWeatherHoldSheetVisible] = useState(false);
  const [weatherHoldDate, setWeatherHoldDate] = useState<Date | null>(null);
  const [cancelSeriesSheetVisible, setCancelSeriesSheetVisible] = useState(false);

  // Task #486: live "On My Way" tracking — shareable link + background
  // location watch while the job is in the on_my_way state.
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const isOnline = useNetworkStore((s) => s.isOnline);

  const { data: jobData, isLoading } = useQuery<{ job: ApiJob }>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId && isOnline,
  });

  // Offline fallback: hydrate this job (and its client) from the schedule
  // snapshot the provider previously cached. Read-only — write actions stay
  // gated behind the connectivity check below.
  const [offlineJob, setOfflineJob] = useState<ApiJob | null>(null);
  const [offlineClient, setOfflineClient] = useState<ApiClient | null>(null);
  const [offlineHydrated, setOfflineHydrated] = useState(false);
  useEffect(() => {
    if (!providerId || !jobId) return;
    let cancelled = false;
    loadScheduleSnapshot<ApiJob, ApiClient>(providerId).then((snap) => {
      if (cancelled) return;
      if (snap) {
        const matchedJob = snap.jobs.find((j) => j.id === jobId) ?? null;
        setOfflineJob(matchedJob);
        if (matchedJob) {
          setOfflineClient(
            snap.clients.find((c) => c.id === matchedJob.clientId) ?? null,
          );
        }
      }
      setOfflineHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [providerId, jobId]);

  // When connectivity returns, refetch the live data so the screen exits
  // read-only mode and reflects any server changes.
  useEffect(() => {
    if (!isOnline || !jobId) return;
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
  }, [isOnline, jobId, queryClient]);

  const job = jobData?.job ?? offlineJob ?? undefined;

  const { data: clientData } = useQuery<{ client: ApiClient }>({
    queryKey: ["/api/clients", job?.clientId],
    enabled: !!job?.clientId && isOnline,
  });
  const client = clientData?.client ?? offlineClient ?? undefined;

  const blockOffline = useCallback((): boolean => {
    if (isOnline) return false;
    Alert.alert(
      "You're offline",
      "Reconnect to update this job.",
    );
    return true;
  }, [isOnline]);

  const resolvedDisplayStatus: DisplayStatus = useMemo(() => {
    if (displayStatus !== null) return displayStatus;
    return job ? mapDbStatusToDisplay(job.status) : "scheduled";
  }, [displayStatus, job]);

  const [localChecklist, setLocalChecklist] = useState<JobChecklistItem[]>([]);

  // The job's persisted checklist is authoritative. An empty array is a
  // valid state (the provider intentionally cleared it or the service had
  // no template at job-creation time) and must NOT be rehydrated from the
  // current service template. Only legacy rows where checklist is null
  // get a one-time server-side backfill from the parent service template.
  useEffect(() => {
    if (!job || checklistFetched.current) return;
    if (Array.isArray(job.checklist)) {
      setLocalChecklist(job.checklist);
      checklistFetched.current = true;
      return;
    }
    if (!isOnline) return;
    checklistFetched.current = true;
    const url = new URL(`/api/jobs/${jobId}/generate-checklist`, getApiUrl());
    apiRequest("POST", url.toString(), {})
      .then((r) => r.json())
      .then((data: { checklist?: JobChecklistItem[] }) => {
        if (Array.isArray(data?.checklist)) setLocalChecklist(data.checklist);
      })
      .catch(() => setLocalChecklist([]));
  }, [job, jobId, isOnline]);

  const persistChecklist = useCallback(
    (next: JobChecklistItem[]) => {
      const url = new URL(`/api/jobs/${jobId}/checklist-state`, getApiUrl());
      apiRequest("PATCH", url.toString(), { checklist: next }).catch(() => {});
    },
    [jobId],
  );

  const handleToggleChecklist = useCallback(
    (id: string) => {
      if (!isOnline) {
        blockOffline();
        return;
      }
      setLocalChecklist((prev) => {
        const updated = prev.map((item) =>
          item.id === id ? { ...item, completed: !item.completed } : item,
        );
        persistChecklist(updated);
        return updated;
      });
    },
    [persistChecklist, isOnline],
  );

  const handleAddChecklistStep = useCallback(
    (label: string) => {
      if (!isOnline) {
        blockOffline();
        return;
      }
      setLocalChecklist((prev) => {
        const next: JobChecklistItem[] = [
          ...prev,
          { id: `c_${Date.now()}`, label, completed: false },
        ];
        persistChecklist(next);
        return next;
      });
    },
    [persistChecklist, isOnline],
  );

  const updateJobMutation = useMutation({
    mutationFn: async (newStatus: DBJobStatus) => {
      const url = new URL(`/api/jobs/${jobId}`, getApiUrl());
      const res = await apiRequest("PUT", url.toString(), { status: newStatus });
      return (await res.json()) as { job: ApiJob };
    },
    // Roll the optimistic UI back to the server's truth on the way in and out.
    // (Task #217) Previously the optimistic `setDisplayStatus` ran from the
    // caller and was never reverted when the request failed, so users saw a
    // success-looking status change AND a "Failed to update" alert at the same
    // time. We now drive the local optimistic state from the mutation itself
    // and reset it whenever the request errors.
    onMutate: (newStatus: DBJobStatus) => {
      const previous = displayStatus;
      setDisplayStatus(newStatus);
      return { previous };
    },
    onSuccess: (data) => {
      if (data?.job?.status) {
        setDisplayStatus(mapDbStatusToDisplay(data.job.status));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "jobs"] });
    },
    onError: (error: unknown, _vars, context) => {
      setDisplayStatus(context?.previous ?? null);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to update job status";
      Alert.alert("Couldn't update status", message);
    },
  });

  const completeJobMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/jobs/${jobId}/complete`, getApiUrl());
      const res = await apiRequest("POST", url.toString(), { finalPrice: job?.estimatedPrice });
      return (await res.json()) as { job: ApiJob; invoiceId?: string | null };
    },
    onSuccess: (data) => {
      // Task #480: route straight into the auto-drafted invoice instead of
      // leaving the provider to rebuild one via AddInvoice.
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "invoice"] });
      if (data?.invoiceId) {
        navigation.navigate("InvoiceDetail", { invoiceId: data.invoiceId });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "jobs"] });
      setDisplayStatus("completed");
      recordHappyMoment("provider_job_completed", { payload: { jobId } }).catch(() => {});
    },
    onError: () => {
      Alert.alert("Error", "Failed to complete job");
    },
  });

  const handleUpdateStatus = useCallback((newDisplayStatus: DisplayStatus) => {
    if (!job) return;
    if (blockOffline()) return;
    if (updateJobMutation.isPending || completeJobMutation.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (newDisplayStatus === "completed") {
      completeJobMutation.mutate();
    } else {
      // Optimistic update + rollback are owned by updateJobMutation itself
      // (Task #217). Don't touch displayStatus here or the rollback gets
      // overwritten when the request fails.
      updateJobMutation.mutate(newDisplayStatus);
    }
  }, [job, updateJobMutation, completeJobMutation, blockOffline]);

  // Task #486: while the job is "on_my_way", fetch the live tracking link
  // and stream location updates to the server so the shared page can show
  // a live map + ETA. Stops automatically (and ends server-side) once the
  // status advances past on_my_way — the server also enforces a timeout,
  // this just tears down the local watcher/UI in step with it.
  useEffect(() => {
    if (resolvedDisplayStatus !== "on_my_way" || !jobId || !isOnline) {
      setTrackingUrl(null);
      setIsSharingLocation(false);
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const url = new URL(`/api/jobs/${jobId}/tracking`, getApiUrl());
        const res = await apiRequest("GET", url.toString());
        const data = (await res.json()) as { active: boolean; trackingUrl?: string };
        if (!cancelled && data.active && data.trackingUrl) {
          setTrackingUrl(data.trackingUrl);
        }
      } catch {
        // Best-effort — the share link is a bonus affordance, not required
        // for the homeowner to receive the link (it also goes out via the
        // status-changed push/email/SMS).
      }
    })();

    (async () => {
      try {
        const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
        let granted = status === Location.PermissionStatus.GRANTED;
        if (!granted && canAskAgain) {
          const req = await Location.requestForegroundPermissionsAsync();
          granted = req.status === Location.PermissionStatus.GRANTED;
        }
        if (!granted || cancelled) return;

        setIsSharingLocation(true);
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15000,
            distanceInterval: 50,
          },
          (pos) => {
            const trackUrl = new URL(`/api/jobs/${jobId}/tracking/location`, getApiUrl());
            apiRequest("POST", trackUrl.toString(), {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }).catch(() => {
              // transient network errors are fine — the next tick retries
            });
          },
        );
        if (cancelled) {
          subscription.remove();
          return;
        }
        locationSubscriptionRef.current = subscription;
      } catch {
        // permission/hardware failure — sharing simply won't happen; the
        // provider can still share the link once it's fetched above.
      }
    })();

    return () => {
      cancelled = true;
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
      setIsSharingLocation(false);
    };
  }, [resolvedDisplayStatus, jobId, isOnline]);

  const handleShareTrackingLink = useCallback(() => {
    if (!trackingUrl) return;
    Haptics.selectionAsync().catch(() => {});
    Share.share({
      message: `Track my live location and ETA: ${trackingUrl}`,
      url: trackingUrl,
    }).catch(() => {});
  }, [trackingUrl]);

  const [rescheduleStep, setRescheduleStep] = useState<"closed" | "date" | "time">(
    "closed",
  );
  const [rescheduleDraft, setRescheduleDraft] = useState<Date>(new Date());

  const rescheduleMutation = useMutation({
    mutationFn: async (params: { newDate: Date; scope: "single" | "following" }) => {
      const path =
        params.scope === "following"
          ? `/api/jobs/${jobId}?scope=following`
          : `/api/jobs/${jobId}`;
      const url = new URL(path, getApiUrl());
      const hh = String(params.newDate.getHours()).padStart(2, "0");
      const mm = String(params.newDate.getMinutes()).padStart(2, "0");
      const res = await apiRequest("PUT", url.toString(), {
        scheduledDate: params.newDate.toISOString(),
        scheduledTime: `${hh}:${mm}`,
      });
      return (await res.json()) as { job: ApiJob };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "jobs"],
      });
      if (job?.seriesId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/series", job.seriesId],
        });
      }
    },
    onError: () => {
      Alert.alert("Couldn't reschedule", "Please try again.");
    },
  });

  const handleReschedulePress = useCallback(() => {
    if (!job?.scheduledDate) return;
    if (blockOffline()) return;
    setRescheduleDraft(new Date(job.scheduledDate));
    setRescheduleStep("date");
  }, [job?.scheduledDate, blockOffline]);

  const finalizeReschedule = useCallback(
    (newDate: Date) => {
      setRescheduleStep("closed");
      if (!job) return;
      // For series jobs, ask the provider whether the change should apply to
      // just this occurrence or to this and every following occurrence.
      if (job.seriesId) {
        setRescheduleDate(newDate);
        setRescheduleSheetVisible(true);
      } else {
        rescheduleMutation.mutate({ newDate, scope: "single" });
      }
    },
    [job, rescheduleMutation],
  );

  const weatherHoldMutation = useMutation({
    mutationFn: async (params: { newDate?: Date }) => {
      const url = new URL(`/api/jobs/${jobId}/weather-hold`, getApiUrl());
      const body: { newDate?: string; newTime?: string } = {};
      if (params.newDate) {
        body.newDate = params.newDate.toISOString();
        const hh = String(params.newDate.getHours()).padStart(2, "0");
        const mm = String(params.newDate.getMinutes()).padStart(2, "0");
        body.newTime = `${hh}:${mm}`;
      }
      const res = await apiRequest("POST", url.toString(), body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to hold for weather");
      }
      return (await res.json()) as { job: ApiJob };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "jobs"],
      });
      setDisplayStatus("weather_held");
      Alert.alert(
        "Weather hold set",
        "We've notified your customer. The job is paused — restore it any time once skies clear.",
      );
    },
    onError: (err: Error) => {
      Alert.alert("Couldn't hold for weather", err.message);
    },
  });

  const restoreJobMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/jobs/${jobId}/restore`, getApiUrl());
      const res = await apiRequest("POST", url.toString(), {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to restore job");
      }
      return (await res.json()) as { job: ApiJob };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "jobs"],
      });
      setDisplayStatus("scheduled");
    },
    onError: (err: Error) => {
      Alert.alert("Couldn't restore job", err.message);
    },
  });

  const handleWeatherHold = useCallback(() => {
    if (!job) return;
    if (blockOffline()) return;
    const base = job.scheduledDate ? new Date(job.scheduledDate) : new Date();
    const nextWeek = new Date(base);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const timeMatch = job.scheduledTime
      ? /^(\d{1,2}):(\d{2})/.exec(job.scheduledTime)
      : null;
    if (timeMatch) {
      nextWeek.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    }
    const niceDate = nextWeek.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    setWeatherHoldDate(nextWeek);
    setWeatherHoldSheetVisible(true);
  }, [job, weatherHoldMutation, blockOffline]);

  const handleRestore = useCallback(() => {
    if (blockOffline()) return;
    restoreJobMutation.mutate();
  }, [restoreJobMutation, blockOffline]);

  const cancelSeriesMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/jobs/${jobId}?scope=series`, getApiUrl());
      return apiRequest("DELETE", url.toString());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "jobs"] });
      if (job?.seriesId) {
        queryClient.invalidateQueries({ queryKey: ["/api/series", job.seriesId] });
      }
      setDisplayStatus("cancelled");
    },
    onError: () => {
      Alert.alert("Couldn't cancel series", "Please try again.");
    },
  });

  const handleCancel = useCallback(() => {
    if (blockOffline()) return;
    // When this job belongs to a recurring series, ask the provider whether
    // they're cancelling just this occurrence or the whole series. For
    // one-offs, keep the original two-button confirm.
    if (job?.seriesId) {
      setCancelSeriesSheetVisible(true);
      return;
    }
    Alert.alert(
      "Cancel Job",
      "Are you sure you want to cancel this job?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () => {
            updateJobMutation.mutate("cancelled");
          },
        },
      ]
    );
  }, [updateJobMutation, cancelSeriesMutation, job?.seriesId, blockOffline]);

  const handleCall = useCallback(() => {
    if (client?.phone) {
      Linking.openURL(`tel:${client.phone}`);
    }
  }, [client]);

  const handleMessage = useCallback(() => {
    if (client?.phone) {
      Linking.openURL(`sms:${client.phone}`);
    }
  }, [client]);

  const handleNavigate = useCallback(() => {
    if (job?.address) {
      Linking.openURL(`maps://?address=${encodeURIComponent(job.address)}`);
    }
  }, [job]);

  const handleCreateInvoice = useCallback(() => {
    if (blockOffline()) return;
    if (job) {
      navigation.navigate("AddInvoice", { clientId: job.clientId });
    }
  }, [job, navigation, blockOffline]);

  // Task #480: secondary "update status" control — the primary button only
  // drives Start/Complete now, so the granular courier-style states
  // (confirmed/on_my_way/arrived/in_progress) live behind this menu instead.
  const handleOpenStatusMenu = useCallback(() => {
    if (!job) return;
    if (blockOffline()) return;
    const options: DisplayStatus[] = ["confirmed", "on_my_way", "arrived", "in_progress"];
    Alert.alert(
      "Update Status",
      "Pick a more specific status for this job.",
      [
        ...options
          .filter((s) => s !== resolvedDisplayStatus)
          .map((s) => ({
            text: STATUS_CONFIG[s].label,
            onPress: () => updateJobMutation.mutate(s),
          })),
        { text: "Cancel", style: "cancel" as const },
      ],
    );
  }, [job, resolvedDisplayStatus, updateJobMutation, blockOffline]);

  // Task #295: surface manual payment recording on completed jobs that have
  // a generated invoice — providers often collect cash/check on-site.
  interface JobInvoice {
    id: string;
    status: string;
    invoiceNumber: string | null;
  }
  // Task #485: before/after photo pairs captured for this job. Feeds the
  // job detail slider, and is fetched independently by the invoice and
  // review screens so the pairs auto-attach without touching those routes.
  interface JobPhotoPair {
    id: string;
    beforePhotoUrl: string;
    afterPhotoUrl: string;
    label: string | null;
    createdAt: string;
  }
  const { data: photoPairsData } = useQuery<{ pairs: JobPhotoPair[] }>({
    queryKey: ["/api/jobs", jobId, "photo-pairs"],
    enabled: !!jobId && isOnline,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/photo-pairs`);
      if (!res.ok) throw new Error("Failed to load photo pairs");
      return res.json();
    },
  });
  const photoPairs = photoPairsData?.pairs ?? [];

  const { data: jobInvoiceData } = useQuery<{ invoice: JobInvoice | null }>({
    queryKey: ["/api/jobs", jobId, "invoice"],
    enabled: !!jobId && isOnline,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/invoice`);
      if (!res.ok) {
        if (res.status === 404) return { invoice: null };
        throw new Error("Failed to load invoice");
      }
      return res.json();
    },
  });
  const jobInvoice = jobInvoiceData?.invoice ?? null;
  const canRecordPayment =
    !!jobInvoice &&
    (jobInvoice.status === "sent" ||
      jobInvoice.status === "overdue" ||
      jobInvoice.status === "partially_paid");
  const jobInvoiceIsDraft = !!jobInvoice && jobInvoice.status === "draft";
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [noShowSheetOpen, setNoShowSheetOpen] = useState(false);

  // Task #480: instead of sending the provider back into AddInvoice to
  // rebuild an invoice from scratch, open the auto-drafted invoice that was
  // already created for this job on completion (see /api/jobs/:id/complete).
  const handleViewJobInvoice = useCallback(() => {
    if (blockOffline()) return;
    if (jobInvoice) {
      navigation.navigate("InvoiceDetail", { invoiceId: jobInvoice.id });
    }
  }, [jobInvoice, navigation, blockOffline]);

  const requestReviewMutation = useMutation({
    mutationFn: async () => {
      if (!job) throw new Error("Missing job");
      return apiRequest("POST", "/api/reviews/request", {
        appointmentId: job.appointmentId ?? undefined,
        clientId: job.clientId,
      });
    },
    onSuccess: () => {
      Alert.alert("Review Request Sent", "We've emailed your client a link to leave a review.");
    },
    onError: (err: any) => {
      Alert.alert(
        "Couldn't send request",
        err?.message || "Please try again in a moment.",
      );
    },
  });

  const handleRequestReview = useCallback(() => {
    if (blockOffline()) return;
    requestReviewMutation.mutate();
  }, [requestReviewMutation, blockOffline]);

  const handleUploadPhotos = useCallback(async () => {
    if (blockOffline()) return;
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Photo upload is available on mobile devices via Expo Go.");
      return;
    }

    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library to upload job photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets) return;

    setIsUploadingPhotos(true);
    try {
      const photoUris = result.assets
        .filter(a => a.base64)
        .map(a => `data:image/jpeg;base64,${a.base64}`);

      if (photoUris.length === 0) {
        Alert.alert("Error", "Could not process selected photos");
        return;
      }

      const url = new URL(`/api/jobs/${jobId}/photos`, getApiUrl());
      const response = await apiRequest("POST", url.toString(), { photos: photoUris });
      if (response.ok) {
        setUploadedPhotos(prev => [...prev, ...photoUris]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        Alert.alert("Upload Failed", errorData.error || "Failed to save photos to HouseFax. Please try again.");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to upload photos");
    } finally {
      setIsUploadingPhotos(false);
    }
  }, [jobId, blockOffline]);

  // Task #485: capture a single before/after photo. Opens the camera twice
  // (before, then after) and submits both together to the photo-pairs API,
  // which auto-attaches the pair to this job's invoice and review request.
  const pickPhotoForPair = useCallback(async (): Promise<string | null> => {
    const permResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permResult.granted) {
      const libraryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!libraryPerm.granted) {
        Alert.alert("Permission Required", "Please allow camera or photo library access to capture before/after photos.");
        return null;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return null;
      return `data:image/jpeg;base64,${result.assets[0].base64}`;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return null;
    return `data:image/jpeg;base64,${result.assets[0].base64}`;
  }, []);

  const handleCaptureBefore = useCallback(async () => {
    if (blockOffline()) return;
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Camera capture is available on mobile devices.");
      return;
    }
    const uri = await pickPhotoForPair();
    if (uri) setCapturedBeforeUri(uri);
  }, [pickPhotoForPair, blockOffline]);

  const handleCaptureAfter = useCallback(async () => {
    if (blockOffline()) return;
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Camera capture is available on mobile devices.");
      return;
    }
    const uri = await pickPhotoForPair();
    if (uri) setCapturedAfterUri(uri);
  }, [pickPhotoForPair, blockOffline]);

  const savePhotoPairMutation = useMutation({
    mutationFn: async () => {
      if (!capturedBeforeUri || !capturedAfterUri) throw new Error("Capture both photos first");
      const res = await apiRequest("POST", `/api/jobs/${jobId}/photo-pairs`, {
        beforePhoto: capturedBeforeUri,
        afterPhoto: capturedAfterUri,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to save before/after photos");
      }
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "photo-pairs"] });
      setBeforeAfterCaptureVisible(false);
      setCapturedBeforeUri(null);
      setCapturedAfterUri(null);
    },
    onError: (err: any) => {
      Alert.alert("Couldn't save photos", err?.message || "Please try again.");
    },
  });

  const handleSaveBeforeAfterPair = useCallback(() => {
    if (blockOffline()) return;
    savePhotoPairMutation.mutate();
  }, [savePhotoPairMutation, blockOffline]);

  // Task #485: branded share/export. Renders an off-screen side-by-side
  // composite (with provider logo/name footer) and captures it as an image
  // for sharing, mirroring the MonthlyRecapScreen share pattern.
  const shareCaptureRef = useRef<View>(null);
  const [pairPendingShare, setPairPendingShare] = useState<JobPhotoPair | null>(null);

  const handleSharePhotoPair = useCallback(async (pair: JobPhotoPair) => {
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Sharing is available on mobile devices.");
      return;
    }
    try {
      setSharingPairId(pair.id);
      setPairPendingShare(pair);
      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      let captureRef: ((view: any, opts?: any) => Promise<string>) | null = null;
      let Sharing: { isAvailableAsync: () => Promise<boolean>; shareAsync: (uri: string, opts?: any) => Promise<void> } | null = null;
      try { captureRef = require("react-native-view-shot").captureRef; } catch { /* not linked */ }
      try { Sharing = require("expo-sharing"); } catch { /* not available */ }

      if (captureRef && shareCaptureRef.current) {
        const uri = await captureRef(shareCaptureRef, {
          format: "jpg",
          quality: 0.92,
          result: "tmpfile",
        });
        if (Platform.OS === "ios") {
          await Share.share({ url: uri });
        } else {
          const isAvailable = Sharing ? await Sharing.isAvailableAsync() : false;
          if (isAvailable && Sharing) {
            await Sharing.shareAsync(uri, { mimeType: "image/jpeg", dialogTitle: "Share before & after" });
          } else {
            await Share.share({ message: "Check out this before & after from " + (providerProfile?.businessName || "my job") });
          }
        }
      } else {
        Alert.alert("Not Available", "Photo sharing needs a development build (not available in Expo Go).");
      }
    } catch (e: any) {
      Alert.alert("Couldn't share", e?.message || "Please try again.");
    } finally {
      setSharingPairId(null);
      setPairPendingShare(null);
    }
  }, [providerProfile]);

  if ((isLoading || (!isOnline && !offlineHydrated)) && !job) {
    return <JobDetailSkeleton />;
  }

  if (!job) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.notFound, { paddingTop: headerHeight }]}>
          <ThemedText type="h2">
            {isOnline ? "Job not found" : "Not available offline"}
          </ThemedText>
          {!isOnline ? (
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
            >
              Reconnect to load this job.
            </ThemedText>
          ) : null}
        </View>
      </ThemedView>
    );
  }

  // Task #480: collapse the primary action to two effective states — Start
  // and Complete. The granular courier-style states (confirmed/on_my_way/
  // arrived) are still available via the secondary "Update Status" menu
  // below, but no longer gate progress through the main button.
  const getNextAction = (): { label: string; status: DisplayStatus } | null => {
    switch (resolvedDisplayStatus) {
      case "scheduled":
      case "confirmed":
      case "on_my_way":
      case "arrived":
        return { label: "Start Job", status: "in_progress" };
      case "in_progress":
        return { label: "Complete Job", status: "completed" };
      default: return null;
    }
  };

  const nextAction = getNextAction();
  const clientName = client ? getClientName(client) : "Loading...";
  const price = job.finalPrice || job.estimatedPrice;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: horizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <StatusBanner status={resolvedDisplayStatus} />
        </Animated.View>

        {!isOnline ? (
          <Animated.View entering={FadeInDown.duration(250)}>
            <View
              style={[
                styles.offlineBanner,
                { borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
              ]}
              testID="banner-job-offline"
            >
              <Feather name="wifi-off" size={16} color={theme.text} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.offlineBannerTitle}>
                  Offline — read-only
                </ThemedText>
                <ThemedText style={[styles.offlineBannerSubtitle, { color: theme.textSecondary }]}>
                  Reconnect to update this job. Call, text, and directions still work.
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        ) : null}

        {job.homeId ? <HomeownerNotesBanner homeId={job.homeId} /> : null}

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.customerRow}>
              <View style={[styles.avatar, { backgroundColor: Colors.accent + "20" }]}>
                <ThemedText type="body" style={{ color: Colors.accent, fontWeight: "600" }}>
                  {getInitials(clientName)}
                </ThemedText>
              </View>
              <View style={styles.customerInfo}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{clientName}</ThemedText>
                <Pressable onPress={handleNavigate} style={styles.addressRow}>
                  <Feather name="map-pin" size={14} color={theme.textSecondary} />
                  <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4, flex: 1 }} numberOfLines={1}>
                    {job.address || "No address"}
                  </ThemedText>
                  {job.address ? <Feather name="external-link" size={14} color={Colors.accent} /> : null}
                </Pressable>
                {client?.phone ? (
                  <View style={styles.addressRow}>
                    <Feather name="phone" size={14} color={theme.textSecondary} />
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginLeft: 4, flex: 1 }}
                      numberOfLines={1}
                      testID="text-client-phone"
                    >
                      {client.phone}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={[styles.contactRow, { borderTopColor: theme.separator }]}>
              <Pressable
                style={styles.contactButton}
                onPress={handleCall}
                accessibilityRole="button"
                accessibilityLabel="Call client"
              >
                <Feather name="phone" size={18} color={Colors.accent} />
                <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: 4 }}>Call</ThemedText>
              </Pressable>
              <Pressable
                style={styles.contactButton}
                onPress={handleMessage}
                accessibilityRole="button"
                accessibilityLabel="Text client"
              >
                <Feather name="message-circle" size={18} color={Colors.accent} />
                <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: 4 }}>Text</ThemedText>
              </Pressable>
              <Pressable
                style={styles.contactButton}
                onPress={handleNavigate}
                accessibilityRole="button"
                accessibilityLabel="Get directions to client"
              >
                <Feather name="navigation" size={18} color={Colors.accent} />
                <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: 4 }}>Directions</ThemedText>
              </Pressable>
            </View>
          </GlassCard>
        </Animated.View>

        <CrewAssignmentCard
          jobId={job.id}
          providerId={job.providerId}
          assignedCrewMemberId={job.assignedCrewMemberId ?? null}
          isOnline={isOnline}
          onOfflineAttempt={blockOffline}
          onChanged={() =>
            queryClient.invalidateQueries({ queryKey: ["/api/jobs", job.id] })
          }
        />

        <TimeTrackingCard jobId={job.id} isOnline={isOnline} />

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <GlassCard style={styles.section}>
            <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              JOB DETAILS
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs, flexWrap: "wrap" }}>
              <ThemedText type="h3">{job.title}</ThemedText>
              {job.isRecurring || job.seriesId ? (
                <Pressable
                  onPress={
                    job.seriesId
                      ? () =>
                          navigation.navigate("SeriesDetail", {
                            seriesId: job.seriesId!,
                          })
                      : undefined
                  }
                  testID="link-view-series"
                >
                  <View style={[styles.recurringBadge, { backgroundColor: Colors.accent + "22" }]}>
                    <Feather name="repeat" size={11} color={Colors.accent} />
                    <ThemedText style={[styles.recurringBadgeText, { color: Colors.accent }]}>
                      {job.recurringFrequency
                        ? job.recurringFrequency.charAt(0).toUpperCase() + job.recurringFrequency.slice(1)
                        : "Recurring"}
                    </ThemedText>
                    {job.seriesId ? (
                      <Feather name="chevron-right" size={11} color={Colors.accent} />
                    ) : null}
                  </View>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.detailRow}>
              <Feather name="calendar" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {formatDate(job.scheduledDate, { style: "weekday" })}
                {job.scheduledTime ? ` at ${job.scheduledTime}` : ""}
              </ThemedText>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
          <GlassCard style={styles.section}>
            <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              WHAT YOU'RE HERE FOR
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
              <View style={[styles.serviceIconWrap, { backgroundColor: Colors.accent + "18" }]}>
                <Feather name="tool" size={18} color={Colors.accent} />
              </View>
              <ThemedText type="body" style={{ fontWeight: "600", flex: 1 }}>{job.title}</ThemedText>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <GlassCard style={styles.section}>
            <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              WHAT THE CLIENT NEEDS
            </ThemedText>
            {(() => {
              const desc = job.description?.trim() ?? "";
              const isGeneric = desc.length === 0 || desc.length < 10 || desc.toLowerCase() === job.title.toLowerCase();
              return (
                <ThemedText type="body" style={{ lineHeight: 22, color: isGeneric ? theme.textSecondary : theme.text }}>
                  {isGeneric ? "No detailed intake description available." : desc}
                </ThemedText>
              );
            })()}
          </GlassCard>
        </Animated.View>

        {resolvedDisplayStatus !== "cancelled" && resolvedDisplayStatus !== "completed" && resolvedDisplayStatus !== "no_show" ? (
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <ChecklistSection
              checklist={localChecklist}
              onToggle={handleToggleChecklist}
              onAddStep={handleAddChecklistStep}
              isOnline={isOnline}
              onOfflineAttempt={blockOffline}
            />
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <GlassCard style={styles.section}>
            <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              PRICING
            </ThemedText>
            {price ? (
              <View style={styles.priceRow}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {job.finalPrice ? "Final Price" : "Estimated"}
                </ThemedText>
                <ThemedText type="h3" style={{ color: Colors.accent }}>
                  {formatMoney(price, { showCents: false })}
                </ThemedText>
              </View>
            ) : (
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                Price TBD
              </ThemedText>
            )}
          </GlassCard>
        </Animated.View>

        {job.notes ? (
          <Animated.View entering={FadeInDown.delay(600).duration(400)}>
            <GlassCard style={styles.section}>
              <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                NOTES
              </ThemedText>
              <ThemedText type="body">{job.notes}</ThemedText>
            </GlassCard>
          </Animated.View>
        ) : null}

        {job.homeId ? (
          <Animated.View entering={FadeInDown.delay(650).duration(400)}>
            <ProviderHomeProfile homeId={job.homeId} />
          </Animated.View>
        ) : null}

        {resolvedDisplayStatus === "completed" ? (
          <Animated.View entering={FadeInDown.delay(700).duration(400)}>
            <GlassCard style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="label" style={{ color: theme.textSecondary }}>
                  JOB PHOTOS
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {uploadedPhotos.length} added
                </ThemedText>
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                Photos are saved to the homeowner's HouseFax record
              </ThemedText>
              {uploadedPhotos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                  <View style={styles.photosRow}>
                    {uploadedPhotos.map((uri, index) => (
                      <Image
                        key={index}
                        source={{ uri }}
                        style={styles.photoThumb}
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                </ScrollView>
              ) : null}
              <Pressable
                testID="button-upload-job-photos"
                style={[
                  styles.photoUploadButton,
                  { borderColor: Colors.accent, opacity: isOnline ? 1 : 0.5 },
                ]}
                onPress={handleUploadPhotos}
                disabled={isUploadingPhotos}
              >
                {isUploadingPhotos ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Feather name="camera" size={18} color={Colors.accent} />
                )}
                <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: Spacing.xs }}>
                  {isUploadingPhotos ? "Uploading..." : "Add Photos"}
                </ThemedText>
              </Pressable>
            </GlassCard>
          </Animated.View>
        ) : null}

        {resolvedDisplayStatus === "completed" ? (
          <Animated.View entering={FadeInDown.delay(720).duration(400)}>
            <GlassCard style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="label" style={{ color: theme.textSecondary }}>
                  BEFORE &amp; AFTER
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {photoPairs.length} captured
                </ThemedText>
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                Drag to reveal — auto-attached to the invoice and review request
              </ThemedText>

              {photoPairs.map((pair) => (
                <View key={pair.id} style={{ marginBottom: Spacing.md }}>
                  <BeforeAfterSlider
                    beforeUri={pair.beforePhotoUrl}
                    afterUri={pair.afterPhotoUrl}
                    height={200}
                  />
                  <Pressable
                    testID={`button-share-photo-pair-${pair.id}`}
                    style={[styles.photoUploadButton, { borderColor: Colors.accent, marginTop: Spacing.sm }]}
                    onPress={() => handleSharePhotoPair(pair)}
                    disabled={sharingPairId === pair.id}
                  >
                    {sharingPairId === pair.id ? (
                      <ActivityIndicator size="small" color={Colors.accent} />
                    ) : (
                      <Feather name="share-2" size={16} color={Colors.accent} />
                    )}
                    <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: Spacing.xs }}>
                      {sharingPairId === pair.id ? "Preparing..." : "Share Comparison"}
                    </ThemedText>
                  </Pressable>
                </View>
              ))}

              <Pressable
                testID="button-capture-before-after"
                style={[
                  styles.photoUploadButton,
                  { borderColor: Colors.accent, opacity: isOnline ? 1 : 0.5 },
                ]}
                onPress={() => {
                  if (blockOffline()) return;
                  setCapturedBeforeUri(null);
                  setCapturedAfterUri(null);
                  setBeforeAfterCaptureVisible(true);
                }}
              >
                <Feather name="image" size={18} color={Colors.accent} />
                <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: Spacing.xs }}>
                  Capture Before/After
                </ThemedText>
              </Pressable>
            </GlassCard>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundRoot, paddingHorizontal: horizontalPadding }]}>
        {!isOnline ? (
          <ThemedText
            style={[styles.offlineBottomCaption, { color: theme.textSecondary }]}
            testID="text-offline-reconnect"
          >
            Reconnect to update
          </ThemedText>
        ) : null}
        {resolvedDisplayStatus === "completed" ? (
          <>
            {/* Task #480: exactly one primary CTA on the completed-job screen —
                Send Invoice (draft auto-created on completion), Get Paid (an
                invoice is already out and awaiting payment), or Create Invoice
                as a fallback for the rare case no invoice exists at all
                (e.g. subscription expired when the job was completed). */}
            {canRecordPayment ? (
              <PrimaryButton
                onPress={() => {
                  if (!isOnline) { blockOffline(); return; }
                  setPaymentSheetOpen(true);
                }}
                style={[styles.actionButton, !isOnline && { opacity: 0.5 }]}
                testID="button-record-payment-job"
              >
                Get Paid
              </PrimaryButton>
            ) : jobInvoiceIsDraft ? (
              <PrimaryButton
                onPress={handleViewJobInvoice}
                style={[styles.actionButton, !isOnline && { opacity: 0.5 }]}
                testID="button-send-job-invoice"
              >
                Send Invoice
              </PrimaryButton>
            ) : jobInvoice ? null : (
              <PrimaryButton
                onPress={handleCreateInvoice}
                style={[styles.actionButton, !isOnline && { opacity: 0.5 }]}
                testID="button-create-invoice-job"
              >
                Create Invoice
              </PrimaryButton>
            )}
            <SecondaryButton
              onPress={handleRequestReview}
              style={[styles.actionButton, !isOnline && { opacity: 0.5 }]}
              loading={requestReviewMutation.isPending}
              disabled={requestReviewMutation.isPending}
              testID="button-request-review-job"
            >
              Request a Review
            </SecondaryButton>
          </>
        ) : nextAction ? (
          <>
            <PrimaryButton
              onPress={() => handleUpdateStatus(nextAction.status)}
              style={[styles.actionButton, !isOnline && { opacity: 0.5 }]}
              disabled={updateJobMutation.isPending || completeJobMutation.isPending}
            >
              {(updateJobMutation.isPending || completeJobMutation.isPending) ? "Updating..." : nextAction.label}
            </PrimaryButton>
            <Pressable
              style={[
                styles.cancelButton,
                { borderColor: theme.border, opacity: isOnline ? 1 : 0.5 },
              ]}
              onPress={handleOpenStatusMenu}
              disabled={updateJobMutation.isPending}
              testID="button-update-status-menu"
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name={STATUS_CONFIG[resolvedDisplayStatus].icon} size={16} color={theme.text} />
                <ThemedText type="body">Update Status ({STATUS_CONFIG[resolvedDisplayStatus].label})</ThemedText>
              </View>
            </Pressable>
          </>
        ) : null}

        {resolvedDisplayStatus === "on_my_way" ? (
          <Pressable
            style={[
              styles.cancelButton,
              { borderColor: Colors.accent, opacity: trackingUrl ? 1 : 0.5 },
            ]}
            onPress={handleShareTrackingLink}
            disabled={!trackingUrl}
            testID="button-share-tracking-link"
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="map-pin" size={16} color={Colors.accent} />
              <ThemedText type="body" style={{ color: Colors.accent }}>
                {trackingUrl
                  ? isSharingLocation
                    ? "Share live tracking link"
                    : "Share tracking link"
                  : "Preparing tracking link…"}
              </ThemedText>
            </View>
          </Pressable>
        ) : null}

        {resolvedDisplayStatus === "weather_held" ? (
          <Pressable
            style={[
              styles.cancelButton,
              { borderColor: Colors.accent, opacity: isOnline ? 1 : 0.5 },
            ]}
            onPress={handleRestore}
            disabled={restoreJobMutation.isPending}
            testID="button-restore-job"
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="sun" size={16} color={Colors.accent} />
              <ThemedText type="body" style={{ color: Colors.accent }}>
                {restoreJobMutation.isPending ? "Restoring..." : "Restore job"}
              </ThemedText>
            </View>
          </Pressable>
        ) : null}

        {resolvedDisplayStatus !== "cancelled" && resolvedDisplayStatus !== "completed" && resolvedDisplayStatus !== "weather_held" && resolvedDisplayStatus !== "no_show" ? (
          <>
            <Pressable
              style={[
                styles.cancelButton,
                { borderColor: theme.border, opacity: isOnline ? 1 : 0.5 },
              ]}
              onPress={handleReschedulePress}
              disabled={rescheduleMutation.isPending}
              testID="button-reschedule-job"
            >
              <ThemedText type="body">
                {rescheduleMutation.isPending ? "Rescheduling..." : "Reschedule"}
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.cancelButton,
                { borderColor: theme.border, opacity: isOnline ? 1 : 0.5 },
              ]}
              onPress={handleWeatherHold}
              disabled={weatherHoldMutation.isPending}
              testID="button-weather-hold-job"
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name="cloud-rain" size={16} color={theme.text} />
                <ThemedText type="body">
                  {weatherHoldMutation.isPending ? "Holding..." : "Hold for weather"}
                </ThemedText>
              </View>
            </Pressable>
            <Pressable
              style={[
                styles.cancelButton,
                { borderColor: theme.border, opacity: isOnline ? 1 : 0.5 },
              ]}
              onPress={() => {
                if (blockOffline()) return;
                Haptics.selectionAsync().catch(() => {});
                setNoShowSheetOpen(true);
              }}
              testID="button-no-show-job"
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name="user-x" size={16} color={theme.text} />
                <ThemedText type="body">No Show</ThemedText>
              </View>
            </Pressable>
            <Pressable
              style={[
                styles.cancelButton,
                { borderColor: Colors.error, opacity: isOnline ? 1 : 0.5 },
              ]}
              onPress={handleCancel}
            >
              <ThemedText type="body" style={{ color: Colors.error }}>Cancel Job</ThemedText>
            </Pressable>
          </>
        ) : null}
      </View>
      {jobInvoice ? (
        <RecordPaymentSheet
          visible={paymentSheetOpen}
          onClose={() => setPaymentSheetOpen(false)}
          invoiceId={jobInvoice.id}
          providerId={providerId}
          onSuccess={() => setPaymentSheetOpen(false)}
        />
      ) : null}
      {job ? (
        <NoShowFeeSheet
          visible={noShowSheetOpen}
          onClose={() => setNoShowSheetOpen(false)}
          jobId={job.id}
          providerId={providerId}
          suggestedAmountCents={
            job.finalPrice
              ? Math.round(parseFloat(job.finalPrice) * 100)
              : job.estimatedPrice
              ? Math.round(parseFloat(job.estimatedPrice) * 100)
              : undefined
          }
          onSuccess={() => setDisplayStatus("no_show")}
        />
      ) : null}

      <BottomSheet
        visible={rescheduleSheetVisible}
        title="Apply to which occurrences?"
        message="Update only this date, or shift this and all following occurrences by the same amount?"
        onClose={() => setRescheduleSheetVisible(false)}
        options={[
          { key: "single", label: "This Occurrence", icon: "calendar" },
          { key: "following", label: "This + Following", icon: "repeat" },
        ]}
        onSelect={(key) => {
          setRescheduleSheetVisible(false);
          if (rescheduleDate) {
            rescheduleMutation.mutate({ newDate: rescheduleDate, scope: key as "single" | "following" });
          }
        }}
      />

      <BottomSheet
        visible={weatherHoldSheetVisible}
        title="Hold for weather?"
        message={`We'll let your customer know:\n\n"Heads up — weather is moving us. We've placed your appointment on a weather hold and will reschedule shortly."\n\nWould you also like to move it to ${weatherHoldDate?.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} (same time) now?`}
        onClose={() => setWeatherHoldSheetVisible(false)}
        options={[
          { key: "hold_only", label: "Hold only", icon: "cloud-rain" },
          { key: "hold_move", label: `Hold & move to ${weatherHoldDate?.toLocaleDateString("en-US", { weekday: "long" }).split(",")[0]}`, icon: "calendar" },
        ]}
        onSelect={(key) => {
          setWeatherHoldSheetVisible(false);
          if (key === "hold_only") {
            weatherHoldMutation.mutate({});
          } else if (key === "hold_move" && weatherHoldDate) {
            weatherHoldMutation.mutate({ newDate: weatherHoldDate });
          }
        }}
      />

      <BottomSheet
        visible={cancelSeriesSheetVisible}
        title="Cancel Repeating Job"
        message="Cancel just this visit, or all future repeats?"
        onClose={() => setCancelSeriesSheetVisible(false)}
        options={[
          { key: "visit", label: "This Visit", icon: "x-circle" },
          { key: "series", label: "Cancel All Repeats", icon: "trash-2", destructive: true },
        ]}
        onSelect={(key) => {
          setCancelSeriesSheetVisible(false);
          if (key === "visit") {
            updateJobMutation.mutate("cancelled");
          } else {
            cancelSeriesMutation.mutate();
          }
        }}
      />

      <NativeDatePickerSheet
        visible={rescheduleStep === "date"}
        value={rescheduleDraft}
        mode="date"
        title="New date"
        minimumDate={new Date()}
        onConfirm={(d) => {
          // Preserve the existing time-of-day from the previous draft.
          const merged = new Date(d);
          merged.setHours(
            rescheduleDraft.getHours(),
            rescheduleDraft.getMinutes(),
            0,
            0,
          );
          setRescheduleDraft(merged);
          setRescheduleStep("time");
        }}
        onCancel={() => setRescheduleStep("closed")}
      />
      <NativeDatePickerSheet
        visible={rescheduleStep === "time"}
        value={rescheduleDraft}
        mode="time"
        title="New time"
        minuteInterval={15}
        onConfirm={(t) => {
          const merged = new Date(rescheduleDraft);
          merged.setHours(t.getHours(), t.getMinutes(), 0, 0);
          finalizeReschedule(merged);
        }}
        onCancel={() => setRescheduleStep("closed")}
      />

      <Modal
        visible={beforeAfterCaptureVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBeforeAfterCaptureVisible(false)}
      >
        <View style={styles.captureModalOverlay}>
          <View style={[styles.captureModalCard, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.sectionHeader}>
              <ThemedText type="h3">Capture Before &amp; After</ThemedText>
              <Pressable onPress={() => setBeforeAfterCaptureVisible(false)} testID="button-close-before-after-capture">
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.captureRow}>
              <Pressable
                testID="button-capture-before-photo"
                style={[styles.capturePane, { borderColor: Colors.accent }]}
                onPress={handleCaptureBefore}
              >
                {capturedBeforeUri ? (
                  <Image source={{ uri: capturedBeforeUri }} style={styles.capturePaneImage} resizeMode="cover" />
                ) : (
                  <>
                    <Feather name="camera" size={22} color={Colors.accent} />
                    <ThemedText type="caption" style={{ color: Colors.accent, marginTop: Spacing.xs }}>Before</ThemedText>
                  </>
                )}
              </Pressable>
              <Pressable
                testID="button-capture-after-photo"
                style={[styles.capturePane, { borderColor: Colors.accent }]}
                onPress={handleCaptureAfter}
              >
                {capturedAfterUri ? (
                  <Image source={{ uri: capturedAfterUri }} style={styles.capturePaneImage} resizeMode="cover" />
                ) : (
                  <>
                    <Feather name="camera" size={22} color={Colors.accent} />
                    <ThemedText type="caption" style={{ color: Colors.accent, marginTop: Spacing.xs }}>After</ThemedText>
                  </>
                )}
              </Pressable>
            </View>
            <PrimaryButton
              onPress={handleSaveBeforeAfterPair}
              disabled={!capturedBeforeUri || !capturedAfterUri || savePhotoPairMutation.isPending}
              loading={savePhotoPairMutation.isPending}
              style={{ marginTop: Spacing.lg }}
              testID="button-save-before-after"
            >
              Save Comparison
            </PrimaryButton>
          </View>
        </View>
      </Modal>

      {/* Off-screen composite used only to render a branded share image via
          react-native-view-shot; kept out of the visible layout. */}
      {pairPendingShare ? (
        <View style={styles.shareCaptureOffscreen} pointerEvents="none">
          <View ref={shareCaptureRef} style={styles.shareCaptureCard} collapsable={false}>
            <View style={styles.shareCaptureImages}>
              <View style={styles.shareCaptureImageWrap}>
                <Image source={{ uri: pairPendingShare.beforePhotoUrl }} style={styles.shareCaptureImage} resizeMode="cover" />
                <View style={styles.shareCaptureBadge}>
                  <ThemedText style={styles.shareCaptureBadgeText}>BEFORE</ThemedText>
                </View>
              </View>
              <View style={styles.shareCaptureImageWrap}>
                <Image source={{ uri: pairPendingShare.afterPhotoUrl }} style={styles.shareCaptureImage} resizeMode="cover" />
                <View style={styles.shareCaptureBadge}>
                  <ThemedText style={styles.shareCaptureBadgeText}>AFTER</ThemedText>
                </View>
              </View>
            </View>
            <View style={styles.shareCaptureFooter}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.shareCaptureLogo} />
              ) : null}
              <ThemedText style={styles.shareCaptureFooterText} numberOfLines={1}>
                {providerProfile?.businessName || "HomeBase Pro"}
              </ThemedText>
            </View>
          </View>
        </View>
      ) : null}
    </ThemedView>
  );
}

interface CrewAssignmentCardProps {
  jobId: string;
  providerId: string;
  assignedCrewMemberId: string | null;
  isOnline: boolean;
  onOfflineAttempt: () => void;
  onChanged: () => void;
}

function CrewAssignmentCard({
  jobId,
  providerId,
  assignedCrewMemberId,
  isOnline,
  onOfflineAttempt,
  onChanged,
}: CrewAssignmentCardProps) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data } = useQuery<{
    crew: { id: string; name: string; color: string; isActive: boolean }[];
  }>({
    queryKey: ["/api/provider", providerId, "crew"],
    enabled: !!providerId && isOnline,
  });
  const crew = (data?.crew || []).filter((c) => c.isActive);

  const assigned = crew.find((c) => c.id === assignedCrewMemberId) || null;

  const updateMutation = useMutation({
    mutationFn: (newId: string | null) => {
      if (!isOnline) {
        onOfflineAttempt();
        return Promise.reject(new Error("offline"));
      }
      return apiRequest("PUT", `/api/jobs/${jobId}`, {
        assignedCrewMemberId: newId,
      }).then((r) => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "jobs"],
      });
      onChanged();
      setPickerOpen(false);
    },
  });

  return (
    <Animated.View entering={FadeInDown.delay(150).duration(400)}>
      <GlassCard style={[styles.section, !isOnline && { opacity: 0.6 }]}>
        <ThemedText
          type="label"
          style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}
        >
          ASSIGNED TO
        </ThemedText>
        <Pressable
          onPress={() => {
            if (!isOnline) {
              onOfflineAttempt();
              return;
            }
            setPickerOpen(true);
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.sm,
          }}
          testID="button-assign-crew"
        >
          {assigned ? (
            <>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: assigned.color,
                }}
              />
              <ThemedText style={{ flex: 1 }} type="body">
                {assigned.name}
              </ThemedText>
            </>
          ) : (
            <ThemedText
              style={{ flex: 1, color: theme.textSecondary }}
              type="body"
            >
              Unassigned — tap to assign a crew member
            </ThemedText>
          )}
          <Feather name="chevron-right" size={16} color={theme.textTertiary} />
        </Pressable>
      </GlassCard>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            paddingHorizontal: Spacing.lg,
          }}
          onPress={() => setPickerOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.backgroundRoot,
              borderRadius: BorderRadius.lg,
              padding: Spacing.lg,
              maxHeight: "70%",
            }}
            onPress={() => {}}
          >
            <ThemedText
              type="h3"
              style={{ marginBottom: Spacing.md, fontWeight: "600" }}
            >
              Assign To
            </ThemedText>
            {crew.length === 0 ? (
              <ThemedText style={{ color: theme.textSecondary }}>
                You haven't added crew yet. Open Business Hub → Manage Crew to
                add team members.
              </ThemedText>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                <Pressable
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: Spacing.sm,
                    paddingVertical: 12,
                  }}
                  onPress={() => updateMutation.mutate(null)}
                  testID="crew-pick-unassigned"
                >
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: theme.separator,
                    }}
                  />
                  <ThemedText style={{ flex: 1 }}>Unassigned</ThemedText>
                  {!assigned ? (
                    <Feather
                      name="check"
                      size={16}
                      color={Colors.accent}
                    />
                  ) : null}
                </Pressable>
                {crew.map((m) => (
                  <Pressable
                    key={m.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: Spacing.sm,
                      paddingVertical: 12,
                    }}
                    onPress={() => updateMutation.mutate(m.id)}
                    testID={`crew-pick-${m.id}`}
                  >
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: m.color,
                      }}
                    />
                    <ThemedText style={{ flex: 1 }}>{m.name}</ThemedText>
                    {assigned?.id === m.id ? (
                      <Feather
                        name="check"
                        size={16}
                        color={Colors.accent}
                      />
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

interface JobTimeEntry {
  id: string;
  crewMemberId: string;
  crewMemberName: string;
  clockInAt: string;
  clockOutAt: string | null;
}

function formatHoursMinutes(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTimeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function TimeTrackingCard({ jobId, isOnline }: { jobId: string; isOnline: boolean }) {
  const { theme } = useTheme();
  const { data } = useQuery<{ timeEntries: JobTimeEntry[] }>({
    queryKey: ["/api/jobs", jobId, "time-entries"],
    enabled: isOnline,
  });
  const entries = data?.timeEntries ?? [];
  if (entries.length === 0) return null;

  const totalMs = entries.reduce((sum, e) => {
    const end = e.clockOutAt ? new Date(e.clockOutAt).getTime() : Date.now();
    return sum + (end - new Date(e.clockInAt).getTime());
  }, 0);
  const isAnyOpen = entries.some((e) => !e.clockOutAt);

  return (
    <Animated.View entering={FadeInDown.delay(170).duration(400)}>
      <GlassCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText type="label" style={{ color: theme.textSecondary }}>
            TIME LOGGED
          </ThemedText>
          <ThemedText type="body" style={{ fontWeight: "700", color: isAnyOpen ? Colors.accent : theme.text }}>
            {formatHoursMinutes(totalMs)}
            {isAnyOpen ? " · active" : ""}
          </ThemedText>
        </View>
        {entries.map((entry) => {
          const durationMs = (entry.clockOutAt ? new Date(entry.clockOutAt).getTime() : Date.now()) - new Date(entry.clockInAt).getTime();
          return (
            <View key={entry.id} style={[styles.detailRow, { justifyContent: "space-between", marginTop: Spacing.sm }]}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {entry.crewMemberName} · {formatTimeOfDay(entry.clockInAt)}
                {entry.clockOutAt ? ` – ${formatTimeOfDay(entry.clockOutAt)}` : " – now"}
              </ThemedText>
              <ThemedText type="caption" style={{ fontWeight: "600" }}>
                {formatHoursMinutes(durationMs)}
              </ThemedText>
            </View>
          );
        })}
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBanner: { marginBottom: Spacing.md },
  statusHeader: { flexDirection: "row", alignItems: "center" },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  statusInfo: { marginLeft: Spacing.md },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  progressItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressDotCurrent: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  progressLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
  },
  section: { marginBottom: Spacing.md },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  customerRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  customerInfo: { flex: 1, marginLeft: Spacing.md },
  addressRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: 1,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  detailRow: { flexDirection: "row", alignItems: "center", marginTop: Spacing.xs },
  recurringBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  recurringBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  serviceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistItem: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
  },
  offlineBannerTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  offlineBannerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  offlineBottomCaption: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  actionButton: { marginBottom: Spacing.sm },
  cancelButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  photosRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
  },
  photoUploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    borderStyle: "dashed",
    gap: Spacing.xs,
  },
  captureModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  captureModalCard: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  captureRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  capturePane: {
    flex: 1,
    height: 160,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  capturePaneImage: {
    width: "100%",
    height: "100%",
  },
  shareCaptureOffscreen: {
    position: "absolute",
    top: -9999,
    left: -9999,
  },
  shareCaptureCard: {
    width: 1080,
    backgroundColor: "#000",
  },
  shareCaptureImages: {
    flexDirection: "row",
  },
  shareCaptureImageWrap: {
    flex: 1,
    height: 720,
    position: "relative",
  },
  shareCaptureImage: {
    width: "100%",
    height: "100%",
  },
  shareCaptureBadge: {
    position: "absolute",
    top: 24,
    left: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareCaptureBadgeText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
  },
  shareCaptureFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: "#111111",
  },
  shareCaptureLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  shareCaptureFooterText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
});
