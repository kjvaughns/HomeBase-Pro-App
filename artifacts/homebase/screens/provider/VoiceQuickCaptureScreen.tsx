import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from "expo-audio";
import { File } from "expo-file-system";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { GlassCard } from "@/components/GlassCard";
import { NativeDatePickerSheet } from "@/components/NativeDatePickerSheet";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, Typography, Colors, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";
import { formatDate } from "@/lib/format";

interface VoiceDraft {
  title: string;
  clientId: string | null;
  clientNameGuess: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  notes: string | null;
  confidence: "high" | "medium" | "low";
}

type Stage = "idle" | "recording" | "processing" | "review" | "error";

function combineDateAndTime(dateStr: string | null, timeStr: string | null): Date {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) {
    return new Date();
  }
  if (timeStr) {
    const [h, m] = timeStr.split(":").map((n) => parseInt(n, 10));
    if (!Number.isNaN(h)) base.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
  }
  return base;
}

// Task #489: voice quick-capture. Provider taps the mic, speaks a job/task
// request, we transcribe + AI-parse it into a draft, then the provider
// reviews/edits the draft before it is saved as a real job. This screen
// never silently creates data — everything requires explicit confirmation.
export default function VoiceQuickCaptureScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;

  const [stage, setStage] = useState<Stage>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage("Microphone permission is required to use voice quick-capture.");
        setStage("error");
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    })();
  }, []);

  const { data: clientsData } = useQuery<{ clients: { id: string; firstName: string; lastName: string }[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });
  const clients = clientsData?.clients ?? [];

  const captureMutation = useMutation({
    mutationFn: async (base64Audio: string) => {
      const response = await apiRequest(
        "POST",
        `/api/provider/${providerId}/voice-quick-capture`,
        { audio: base64Audio },
      );
      return response.json() as Promise<{ transcript: string; draft: VoiceDraft }>;
    },
    onSuccess: (data) => {
      setTranscript(data.transcript);
      setDraft(data.draft);
      setStage("review");
    },
    onError: (error: any) => {
      setErrorMessage(String(error?.message ?? "Failed to process your recording. Please try again."));
      setStage("error");
    },
  });

  const createJobMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await apiRequest("POST", "/api/jobs", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "stats"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    },
    onError: (error: any) => {
      setErrorMessage(String(error?.message ?? "Failed to save the job. Please try again."));
    },
  });

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAtRef.current = Date.now();
      setStage("recording");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      setErrorMessage("Could not start recording. Please check microphone permissions.");
      setStage("error");
    }
  };

  const stopRecording = async () => {
    try {
      const elapsed = Date.now() - startedAtRef.current;
      await recorder.stop();
      if (elapsed < 500) {
        setErrorMessage("Recording was too short. Please try again and speak your request.");
        setStage("error");
        return;
      }
      const uri = recorder.uri;
      if (!uri) {
        setErrorMessage("No audio was captured. Please try again.");
        setStage("error");
        return;
      }
      setStage("processing");
      const file = new File(uri);
      const base64Audio = await file.base64();
      captureMutation.mutate(base64Audio);
    } catch (error) {
      setErrorMessage("Something went wrong while processing your recording.");
      setStage("error");
    }
  };

  const handleConfirm = () => {
    if (!draft || !providerId) return;
    const scheduledDate = combineDateAndTime(draft.scheduledDate, draft.scheduledTime);
    createJobMutation.mutate({
      providerId,
      title: draft.title,
      clientId: draft.clientId || undefined,
      scheduledDate: scheduledDate.toISOString(),
      notes: draft.notes || undefined,
    });
  };

  const resetToIdle = () => {
    setStage("idle");
    setErrorMessage(null);
    setTranscript("");
    setDraft(null);
  };

  const scheduledDateObj = draft
    ? combineDateAndTime(draft.scheduledDate, draft.scheduledTime)
    : new Date();

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        {stage === "idle" || stage === "recording" ? (
          <View style={styles.centerStage}>
            <ThemedText style={styles.title}>Quick voice capture</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              {stage === "recording"
                ? "Listening... tap to stop"
                : "Tap the mic and describe the job or task, like \"Schedule a gutter cleaning for the Martins next Tuesday at 2pm.\""}
            </ThemedText>

            <Pressable
              onPress={stage === "recording" ? stopRecording : startRecording}
              style={[
                styles.micButton,
                {
                  backgroundColor: stage === "recording" ? Colors.error : Colors.accent,
                },
              ]}
              testID="voice-capture-mic-button"
            >
              <Feather name={stage === "recording" ? "square" : "mic"} size={36} color="#FFFFFF" />
            </Pressable>

            {stage === "recording" ? (
              <ThemedText style={[styles.recordingDuration, { color: theme.textSecondary }]}>
                {Math.floor(recorderState.durationMillis / 1000)}s
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {stage === "processing" ? (
          <View style={styles.centerStage}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary, marginTop: Spacing.md }]}>
              Transcribing and parsing your request...
            </ThemedText>
          </View>
        ) : null}

        {stage === "error" ? (
          <View style={styles.centerStage}>
            <Feather name="alert-circle" size={40} color={Colors.error} />
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
              {errorMessage}
            </ThemedText>
            <PrimaryButton onPress={resetToIdle} style={{ marginTop: Spacing.lg }}>
              Try Again
            </PrimaryButton>
          </View>
        ) : null}

        {stage === "review" && draft ? (
          <View style={{ gap: Spacing.md }}>
            <GlassCard>
              <ThemedText style={[styles.transcriptLabel, { color: theme.textTertiary }]}>
                We heard:
              </ThemedText>
              <ThemedText style={[styles.transcriptText, { color: theme.textSecondary }]}>
                "{transcript}"
              </ThemedText>
              {draft.confidence === "low" ? (
                <View style={[styles.confidenceBanner, { backgroundColor: theme.warning + "26" }]}>
                  <Feather name="info" size={14} color={theme.warning} />
                  <ThemedText style={[styles.confidenceText, { color: theme.warning }]}>
                    We weren't fully sure about some details — please review carefully.
                  </ThemedText>
                </View>
              ) : null}
            </GlassCard>

            <ThemedText style={styles.sectionTitle}>Review the draft job</ThemedText>

            <TextField
              label="Title"
              value={draft.title}
              onChangeText={(text) => setDraft({ ...draft, title: text })}
              placeholder="Job title"
              testID="voice-draft-title"
            />

            {draft.clientNameGuess && !draft.clientId ? (
              <View style={[styles.confidenceBanner, { backgroundColor: theme.warning + "26" }]}>
                <Feather name="user" size={14} color={theme.warning} />
                <ThemedText style={[styles.confidenceText, { color: theme.warning }]}>
                  Mentioned client "{draft.clientNameGuess}" — no exact match found. You can add a client after saving.
                </ThemedText>
              </View>
            ) : null}

            {draft.clientId ? (
              <ThemedText style={[styles.fieldValue, { color: theme.textSecondary }]}>
                Client: {clients.find((c) => c.id === draft.clientId)
                  ? `${clients.find((c) => c.id === draft.clientId)!.firstName} ${clients.find((c) => c.id === draft.clientId)!.lastName}`
                  : draft.clientNameGuess}
              </ThemedText>
            ) : null}

            <Pressable onPress={() => setShowDatePicker(true)} testID="voice-draft-date">
              <TextField
                label="Date"
                value={formatDate(scheduledDateObj.toISOString())}
                editable={false}
                pointerEvents="none"
                rightIcon="calendar"
              />
            </Pressable>

            <Pressable onPress={() => setShowTimePicker(true)} testID="voice-draft-time">
              <TextField
                label="Time"
                value={scheduledDateObj.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                editable={false}
                pointerEvents="none"
                rightIcon="clock"
              />
            </Pressable>

            <TextField
              label="Notes"
              value={draft.notes ?? ""}
              onChangeText={(text) => setDraft({ ...draft, notes: text })}
              placeholder="Additional notes"
              multiline
              numberOfLines={3}
              testID="voice-draft-notes"
            />

            <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md }}>
              <SecondaryButton onPress={resetToIdle} style={{ flex: 1 }}>
                Re-record
              </SecondaryButton>
              <PrimaryButton
                onPress={handleConfirm}
                loading={createJobMutation.isPending}
                disabled={!draft.title.trim()}
                style={{ flex: 1 }}
                testID="voice-draft-confirm"
              >
                Save Job
              </PrimaryButton>
            </View>
          </View>
        ) : null}
      </KeyboardAwareScrollViewCompat>

      <NativeDatePickerSheet
        visible={showDatePicker}
        value={scheduledDateObj}
        mode="date"
        title="Job Date"
        onConfirm={(date) => {
          if (draft) {
            setDraft({ ...draft, scheduledDate: date.toISOString().slice(0, 10) });
          }
          setShowDatePicker(false);
        }}
        onCancel={() => setShowDatePicker(false)}
      />

      <NativeDatePickerSheet
        visible={showTimePicker}
        value={scheduledDateObj}
        mode="time"
        title="Job Time"
        onConfirm={(date) => {
          if (draft) {
            const hh = String(date.getHours()).padStart(2, "0");
            const mm = String(date.getMinutes()).padStart(2, "0");
            setDraft({ ...draft, scheduledTime: `${hh}:${mm}` });
          }
          setShowTimePicker(false);
        }}
        onCancel={() => setShowTimePicker(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    flexGrow: 1,
  },
  centerStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    ...Typography.title2,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    ...Typography.body,
    textAlign: "center",
    paddingHorizontal: Spacing.md,
  },
  micButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
  },
  recordingDuration: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  sectionTitle: {
    ...Typography.headline,
    fontWeight: "700",
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 15,
    fontStyle: "italic",
    lineHeight: 21,
  },
  confidenceBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  confidenceText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  fieldValue: {
    fontSize: 14,
  },
});
