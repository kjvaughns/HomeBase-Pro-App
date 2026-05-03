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
import { GlassCard } from "@/components/GlassCard";
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

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  weather_held: "Weather Hold",
};

export default function CrewJobDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route =
    useRoute<RouteProp<RootStackParamList, "CrewJobDetail">>();
  const { jobId } = route.params;
  const queryClient = useQueryClient();

  const { data: jobData, isLoading } = useQuery<{ job: JobRow }>({
    queryKey: ["/api/jobs", jobId],
  });
  const job = jobData?.job;

  const { data: photoData } = useQuery<{ photos: string[] }>({
    queryKey: ["/api/jobs", jobId, "photos"],
  });
  const photos = photoData?.photos || [];

  const [notes, setNotes] = useState("");
  const [notesEdited, setNotesEdited] = useState(false);

  useEffect(() => {
    if (job && !notesEdited) setNotes(job.notes ?? "");
  }, [job, notesEdited]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
  };

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/jobs/${jobId}/start`).then((r) => r.json()),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert("Couldn't start job", e.message),
  });

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/jobs/${jobId}/complete`).then((r) => r.json()),
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
      apiRequest("POST", `/api/jobs/${jobId}/photos`, {
        photos: encoded,
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "photos"] });
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
    const mime = result.assets[0].mimeType || "image/jpeg";
    const dataUrl = `data:${mime};base64,${result.assets[0].base64}`;
    photoMutation.mutate([dataUrl]);
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

  const dateLabel = job.scheduledDate
    ? new Date(job.scheduledDate).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Unscheduled";

  const canStart = job.status !== "in_progress" && job.status !== "completed";
  const canComplete = job.status !== "completed";

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["2xl"],
          paddingHorizontal: Spacing.screenPadding,
        }}
      >
        <ThemedText style={styles.title}>{job.title}</ThemedText>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <ThemedText
            style={[styles.statusText, { color: theme.textSecondary }]}
          >
            {STATUS_LABEL[job.status] ?? job.status}
          </ThemedText>
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.metaRow}>
            <Feather name="calendar" size={14} color={theme.textTertiary} />
            <ThemedText
              style={[styles.metaText, { color: theme.textSecondary }]}
            >
              {dateLabel}
              {job.scheduledTime ? ` · ${job.scheduledTime}` : ""}
            </ThemedText>
          </View>
          {job.address ? (
            <Pressable
              onPress={() =>
                Linking.openURL(
                  `https://maps.apple.com/?q=${encodeURIComponent(job.address!)}`,
                )
              }
              style={styles.metaRow}
            >
              <Feather name="map-pin" size={14} color={theme.textTertiary} />
              <ThemedText
                style={[styles.metaText, { color: Colors.accent }]}
                numberOfLines={2}
              >
                {job.address}
              </ThemedText>
            </Pressable>
          ) : null}
          {job.description ? (
            <ThemedText
              style={[
                styles.description,
                { color: theme.text, marginTop: Spacing.sm },
              ]}
            >
              {job.description}
            </ThemedText>
          ) : null}
        </GlassCard>

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
          placeholder="Add notes for the office..."
          multiline
          numberOfLines={4}
          style={{ minHeight: 100 }}
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
              { backgroundColor: theme.backgroundSecondary },
            ]}
            testID="button-add-crew-photo"
          >
            {photoMutation.isPending ? (
              <ActivityIndicator color={Colors.accent} />
            ) : (
              <>
                <Feather name="camera" size={18} color={theme.textSecondary} />
                <ThemedText
                  style={[
                    styles.addPhotoText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Add
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.actions}>
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
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { ...Typography.title2, fontWeight: "700", marginBottom: Spacing.sm },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  statusText: { ...Typography.caption, fontWeight: "600" },
  card: { padding: Spacing.md, marginBottom: Spacing.lg },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  metaText: { ...Typography.body, flex: 1 },
  description: { ...Typography.body, lineHeight: 22 },
  sectionLabel: {
    ...Typography.footnote,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.sm,
  },
  addPhoto: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addPhotoText: { ...Typography.caption },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
