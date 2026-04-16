import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { StyleSheet, View, ScrollView, Pressable, Linking, Alert, ActivityIndicator, Image, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type JobStatus = "scheduled" | "confirmed" | "on_my_way" | "arrived" | "in_progress" | "completed" | "cancelled";

type DBJobStatus = JobStatus;
type DisplayStatus = JobStatus;

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
  scheduled: { label: "Scheduled", color: "#3B82F6", icon: "calendar" },
  confirmed: { label: "Confirmed", color: "#8B5CF6", icon: "check-circle" },
  on_my_way: { label: "On My Way", color: "#F59E0B", icon: "navigation" },
  arrived: { label: "Arrived", color: "#F59E0B", icon: "map-pin" },
  in_progress: { label: "In Progress", color: "#F59E0B", icon: "tool" },
  completed: { label: "Completed", color: Colors.accent, icon: "check" },
  cancelled: { label: "Cancelled", color: "#EF4444", icon: "x-circle" },
};

const STATUS_ORDER: DisplayStatus[] = ["scheduled", "confirmed", "on_my_way", "arrived", "in_progress", "completed"];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

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
            {status === "completed" ? "Job finished" : status === "cancelled" ? "Job cancelled" : "In progress"}
          </ThemedText>
        </View>
      </View>

      {status !== "cancelled" ? (
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
                    isCurrent && styles.progressDotCurrent,
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
  loading?: boolean;
}

function ChecklistSection({ checklist, onToggle, loading }: ChecklistSectionProps) {
  const { theme } = useTheme();
  const completedCount = checklist.filter((item) => item.completed).length;

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
      {loading ? (
        <View style={{ paddingVertical: Spacing.lg, alignItems: "center" }}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Generating smart checklist...
          </ThemedText>
        </View>
      ) : checklist.length > 0 ? (
        checklist.map((item) => (
          <Pressable
            key={item.id}
            style={styles.checklistItem}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggle(item.id);
            }}
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
      ) : (
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          No checklist items
        </ThemedText>
      )}
    </GlassCard>
  );
}

export default function ProviderJobDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<{ ProviderJobDetail: { jobId: string } }, "ProviderJobDetail">>();
  const { jobId } = route.params;
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;
  const queryClient = useQueryClient();

  const [displayStatus, setDisplayStatus] = useState<DisplayStatus | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const checklistFetched = useRef(false);

  const { data: jobData, isLoading } = useQuery<{ job: ApiJob }>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  const job = jobData?.job;

  const { data: clientData } = useQuery<{ client: ApiClient }>({
    queryKey: ["/api/clients", job?.clientId],
    enabled: !!job?.clientId,
  });
  const client = clientData?.client;

  const resolvedDisplayStatus: DisplayStatus = useMemo(() => {
    if (displayStatus !== null) return displayStatus;
    return job ? mapDbStatusToDisplay(job.status) : "scheduled";
  }, [displayStatus, job]);

  const [localChecklist, setLocalChecklist] = useState<JobChecklistItem[]>([]);

  // Fetch (or generate) AI checklist on mount, once job is loaded
  useEffect(() => {
    if (!job || checklistFetched.current) return;
    // If job already has a checklist from the server, use it immediately
    if (job.checklist && Array.isArray(job.checklist) && job.checklist.length > 0) {
      setLocalChecklist(job.checklist);
      checklistFetched.current = true;
      return;
    }
    checklistFetched.current = true;
    setChecklistLoading(true);
    const url = new URL(`/api/jobs/${jobId}/generate-checklist`, getApiUrl());
    apiRequest("POST", url.toString(), {})
      .then(r => r.json())
      .then((data: { checklist?: JobChecklistItem[] }) => {
        if (data.checklist && Array.isArray(data.checklist)) {
          setLocalChecklist(data.checklist);
        }
      })
      .catch(() => {
        // Fallback to generic checklist on error
        setLocalChecklist([
          { id: "1", label: "Arrive at location", completed: false },
          { id: "2", label: "Assess the issue", completed: false },
          { id: "3", label: "Discuss scope with client", completed: false },
          { id: "4", label: "Complete main work", completed: false },
          { id: "5", label: "Clean up area", completed: false },
          { id: "6", label: "Walkthrough with client", completed: false },
        ]);
      })
      .finally(() => setChecklistLoading(false));
  }, [job, jobId]);

  const handleToggleChecklist = useCallback((id: string) => {
    setLocalChecklist((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item));
      // Fire-and-forget state persistence
      const url = new URL(`/api/jobs/${jobId}/checklist-state`, getApiUrl());
      apiRequest("PATCH", url.toString(), { checklist: updated }).catch(() => {});
      return updated;
    });
  }, [jobId]);

  const updateJobMutation = useMutation({
    mutationFn: async (newStatus: DBJobStatus) => {
      const url = new URL(`/api/jobs/${jobId}`, getApiUrl());
      return apiRequest("PUT", url.toString(), { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "jobs"] });
    },
    onError: () => {
      Alert.alert("Error", "Failed to update job status");
    },
  });

  const completeJobMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/jobs/${jobId}/complete`, getApiUrl());
      return apiRequest("POST", url.toString(), { finalPrice: job?.estimatedPrice });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "jobs"] });
      setDisplayStatus("completed");
    },
    onError: () => {
      Alert.alert("Error", "Failed to complete job");
    },
  });

  const handleUpdateStatus = useCallback((newDisplayStatus: DisplayStatus) => {
    if (!job) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (newDisplayStatus === "completed") {
      completeJobMutation.mutate();
    } else {
      updateJobMutation.mutate(newDisplayStatus);
      setDisplayStatus(newDisplayStatus);
    }
  }, [job, updateJobMutation, completeJobMutation]);

  const handleCancel = useCallback(() => {
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
            setDisplayStatus("cancelled");
          },
        },
      ]
    );
  }, [updateJobMutation]);

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
    if (job) {
      navigation.navigate("AddInvoice", { clientId: job.clientId });
    }
  }, [job, navigation]);

  const handleUploadPhotos = useCallback(async () => {
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
  }, [jobId]);

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.notFound, { paddingTop: headerHeight + Spacing.xl }]}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </ThemedView>
    );
  }

  if (!job) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.notFound, { paddingTop: headerHeight }]}>
          <ThemedText type="h2">Job not found</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const getNextAction = (): { label: string; status: DisplayStatus } | null => {
    switch (resolvedDisplayStatus) {
      case "scheduled": return { label: "Confirm Job", status: "confirmed" };
      case "confirmed": return { label: "On My Way", status: "on_my_way" };
      case "on_my_way": return { label: "I've Arrived", status: "arrived" };
      case "arrived": return { label: "Start Work", status: "in_progress" };
      case "in_progress": return { label: "Complete Job", status: "completed" };
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
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <StatusBanner status={resolvedDisplayStatus} />
        </Animated.View>

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
              </View>
            </View>

            <View style={[styles.contactRow, { borderTopColor: theme.separator }]}>
              <Pressable style={styles.contactButton} onPress={handleCall}>
                <Feather name="phone" size={18} color={Colors.accent} />
                <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: 4 }}>Call</ThemedText>
              </Pressable>
              <Pressable style={styles.contactButton} onPress={handleMessage}>
                <Feather name="message-circle" size={18} color={Colors.accent} />
                <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: 4 }}>Text</ThemedText>
              </Pressable>
              <Pressable style={styles.contactButton} onPress={handleNavigate}>
                <Feather name="navigation" size={18} color={Colors.accent} />
                <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: 4 }}>Directions</ThemedText>
              </Pressable>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <GlassCard style={styles.section}>
            <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              JOB DETAILS
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs, flexWrap: "wrap" }}>
              <ThemedText type="h3">{job.title}</ThemedText>
              {job.isRecurring ? (
                <View style={[styles.recurringBadge, { backgroundColor: Colors.accent + "22" }]}>
                  <Feather name="repeat" size={11} color={Colors.accent} />
                  <ThemedText style={[styles.recurringBadgeText, { color: Colors.accent }]}>
                    {job.recurringFrequency
                      ? job.recurringFrequency.charAt(0).toUpperCase() + job.recurringFrequency.slice(1)
                      : "Recurring"}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <View style={styles.detailRow}>
              <Feather name="calendar" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {formatDate(job.scheduledDate)}
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
              CLIENT'S ISSUE
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

        {resolvedDisplayStatus !== "cancelled" && resolvedDisplayStatus !== "completed" ? (
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <ChecklistSection checklist={localChecklist} onToggle={handleToggleChecklist} loading={checklistLoading} />
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
                  {formatCurrency(parseFloat(price))}
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
                style={[styles.photoUploadButton, { borderColor: Colors.accent }]}
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
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundRoot }]}>
        {resolvedDisplayStatus === "completed" ? (
          <PrimaryButton onPress={handleCreateInvoice} style={styles.actionButton}>
            Create Invoice
          </PrimaryButton>
        ) : nextAction ? (
          <PrimaryButton
            onPress={() => handleUpdateStatus(nextAction.status)}
            style={styles.actionButton}
            disabled={updateJobMutation.isPending || completeJobMutation.isPending}
          >
            {(updateJobMutation.isPending || completeJobMutation.isPending) ? "Updating..." : nextAction.label}
          </PrimaryButton>
        ) : null}

        {resolvedDisplayStatus !== "cancelled" && resolvedDisplayStatus !== "completed" ? (
          <Pressable
            style={[styles.cancelButton, { borderColor: "#EF4444" }]}
            onPress={handleCancel}
          >
            <ThemedText type="body" style={{ color: "#EF4444" }}>Cancel Job</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </ThemedView>
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
    backgroundColor: "#FFFFFF",
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
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.screenPadding,
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
});
