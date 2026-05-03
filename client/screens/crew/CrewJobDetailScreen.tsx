import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

interface JobRow {
  id: string;
  title: string;
  status: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  address: string | null;
  notes: string | null;
  description: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  scheduled: {
    label: "Scheduled",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.12)",
  },
  confirmed: {
    label: "Confirmed",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.12)",
  },
  in_progress: {
    label: "In Progress",
    color: Colors.accent,
    bg: Colors.accentLight,
  },
  completed: {
    label: "Completed",
    color: "#6B7280",
    bg: "rgba(107,114,128,0.12)",
  },
  cancelled: {
    label: "Cancelled",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.12)",
  },
  weather_held: {
    label: "Weather Hold",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
  },
};

function formatTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function CrewJobDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, "CrewJobDetail">>();
  const { jobId } = route.params;
  const queryClient = useQueryClient();

  const { data: jobData, isLoading } = useQuery<{ job: JobRow }>({
    queryKey: ["/api/jobs", jobId],
  });
  const job = jobData?.job;

  const { data: photoData } = useQuery<{ photos: string[] }>({
    queryKey: ["/api/jobs", jobId, "photos"],
  });
  const photos = photoData?.photos ?? [];

  const [notes, setNotes] = useState("");
  const [notesEdited, setNotesEdited] = useState(false);
  useEffect(() => {
    if (job && !notesEdited) setNotes(job.notes ?? "");
  }, [job, notesEdited]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });

  const startMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/jobs/${jobId}/start`).then((r) => r.json()),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert("Couldn't start job", e.message),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/jobs/${jobId}/complete`).then((r) => r.json()),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert("Couldn't complete job", e.message),
  });

  const notesMutation = useMutation({
    mutationFn: (text: string) =>
      apiRequest("PUT", `/api/jobs/${jobId}`, { notes: text }).then((r) =>
        r.json(),
      ),
    onSuccess: () => {
      setNotesEdited(false);
      invalidate();
    },
    onError: (e: Error) => Alert.alert("Couldn't save notes", e.message),
  });

  const photoMutation = useMutation({
    mutationFn: (encoded: string[]) =>
      apiRequest("POST", `/api/jobs/${jobId}/photos`, { photos: encoded }).then(
        (r) => r.json(),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "photos"],
      });
    },
    onError: (e: Error) => Alert.alert("Couldn't upload photo", e.message),
  });

  const handleAddPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow access to your photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const mime = result.assets[0].mimeType ?? "image/jpeg";
    photoMutation.mutate([`data:${mime};base64,${result.assets[0].base64}`]);
  };

  if (isLoading || !job) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator
          color={Colors.accent}
          style={{ marginTop: headerHeight + Spacing["2xl"] }}
        />
      </ThemedView>
    );
  }

  const cfg = STATUS_CONFIG[job.status] ?? {
    label: job.status,
    color: "#6B7280",
    bg: "rgba(107,114,128,0.12)",
  };

  const dateLabel = job.scheduledDate
    ? new Date(job.scheduledDate).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const timeLabel = formatTime(job.scheduledTime);

  const canStart = job.status !== "in_progress" && job.status !== "completed";
  const canComplete = job.status !== "completed";
  const hasDetailCard = !!(dateLabel ?? job.address ?? job.description);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["2xl"],
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <ThemedText style={styles.title}>{job.title}</ThemedText>
          <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
            <ThemedText style={[styles.statusText, { color: cfg.color }]}>
              {cfg.label}
            </ThemedText>
          </View>
        </View>

        {hasDetailCard ? (
          <View
            style={[
              styles.detailCard,
              { backgroundColor: theme.cardBackground },
            ]}
          >
            {dateLabel ? (
              <View
                style={[
                  styles.detailRow,
                  { borderBottomColor: theme.separator },
                ]}
              >
                <View
                  style={[
                    styles.iconBubble,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Feather
                    name="calendar"
                    size={14}
                    color={theme.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    style={[styles.detailMicro, { color: theme.textTertiary }]}
                  >
                    DATE & TIME
                  </ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {dateLabel}
                    {timeLabel ? `  ·  ${timeLabel}` : ""}
                  </ThemedText>
                </View>
              </View>
            ) : null}

            {job.address ? (
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    `https://maps.apple.com/?q=${encodeURIComponent(job.address!)}`,
                  )
                }
                style={[
                  styles.detailRow,
                  { borderBottomColor: theme.separator },
                ]}
              >
                <View
                  style={[
                    styles.iconBubble,
                    { backgroundColor: Colors.accentLight },
                  ]}
                >
                  <Feather name="map-pin" size={14} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    style={[styles.detailMicro, { color: theme.textTertiary }]}
                  >
                    ADDRESS
                  </ThemedText>
                  <ThemedText
                    style={[styles.detailValue, { color: Colors.accent }]}
                    numberOfLines={2}
                  >
                    {job.address}
                  </ThemedText>
                </View>
                <Feather name="external-link" size={13} color={Colors.accent} />
              </Pressable>
            ) : null}

            {job.description ? (
              <View
                style={[
                  styles.detailRow,
                  { borderBottomWidth: 0, alignItems: "flex-start" },
                ]}
              >
                <View
                  style={[
                    styles.iconBubble,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Feather
                    name="file-text"
                    size={14}
                    color={theme.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    style={[styles.detailMicro, { color: theme.textTertiary }]}
                  >
                    DESCRIPTION
                  </ThemedText>
                  <ThemedText style={[styles.detailValue, { lineHeight: 20 }]}>
                    {job.description}
                  </ThemedText>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <ThemedText
          style={[styles.sectionLabel, { color: theme.textSecondary }]}
        >
          Job Notes
        </ThemedText>
        <TextField
          value={notes}
          onChangeText={(t) => {
            setNotes(t);
            setNotesEdited(true);
          }}
          placeholder="Add notes visible to the office..."
          multiline
          numberOfLines={4}
          style={{ minHeight: 96 }}
        />
        {notesEdited ? (
          <PrimaryButton
            onPress={() => notesMutation.mutate(notes)}
            loading={notesMutation.isPending}
            style={{ marginTop: Spacing.sm }}
            testID="button-save-crew-notes"
          >
            Save Notes
          </PrimaryButton>
        ) : null}

        <ThemedText
          style={[
            styles.sectionLabel,
            { color: theme.textSecondary, marginTop: Spacing.lg },
          ]}
        >
          Photos
        </ThemedText>
        <View style={styles.photoGrid}>
          {photos.map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.photo} />
          ))}
          <Pressable
            onPress={handleAddPhoto}
            style={[
              styles.addPhoto,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.borderLight,
              },
            ]}
            testID="button-add-crew-photo"
          >
            {photoMutation.isPending ? (
              <ActivityIndicator color={Colors.accent} size="small" />
            ) : (
              <>
                <Feather name="camera" size={18} color={theme.textSecondary} />
                <ThemedText
                  style={[styles.addPhotoLabel, { color: theme.textSecondary }]}
                >
                  Add photo
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>

        {canStart || canComplete ? (
          <View
            style={[
              styles.actionsCard,
              { backgroundColor: theme.cardBackground },
            ]}
          >
            <ThemedText
              style={[styles.actionsLabel, { color: theme.textSecondary }]}
            >
              Update job status
            </ThemedText>
            <View style={styles.actionsRow}>
              {canStart ? (
                <SecondaryButton
                  onPress={() => startMutation.mutate()}
                  loading={startMutation.isPending}
                  style={{ flex: 1 }}
                  testID="button-crew-start"
                >
                  Start Job
                </SecondaryButton>
              ) : null}
              {canComplete ? (
                <PrimaryButton
                  onPress={() => completeMutation.mutate()}
                  loading={completeMutation.isPending}
                  style={{ flex: 1 }}
                  testID="button-crew-complete"
                >
                  Mark Complete
                </PrimaryButton>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  titleBlock: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.title2,
    fontWeight: "700",
    lineHeight: 30,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...Typography.caption, fontWeight: "700" },

  detailCard: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  detailMicro: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    ...Typography.body,
    fontWeight: "500",
  },

  sectionLabel: {
    ...Typography.footnote,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },

  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.md,
  },
  addPhoto: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addPhotoLabel: { ...Typography.caption, fontSize: 11 },

  actionsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  actionsLabel: {
    ...Typography.caption,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: Spacing.md,
  },
  actionsRow: { flexDirection: "row", gap: Spacing.sm },
});
