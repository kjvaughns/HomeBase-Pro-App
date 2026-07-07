import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
  Linking,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from "expo-audio";
import { File } from "expo-file-system";

import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { getApiUrl, apiRequest } from "@/lib/query-client";

type VoiceCaptureState = "idle" | "recording" | "processing";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  "What are my upcoming jobs this week?",
  "Summarize my business performance",
  "Help me draft an invoice",
  "What clients have overdue payments?",
];

interface JobRecord {
  id: string;
  status: string;
}

interface InvoiceRecord {
  id: string;
  status: string;
  total?: string;
  amount?: string;
}

export default function ProviderAIAssistantScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const flatListRef = useRef<FlatList>(null);
  
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Voice capture (Task #518): dictate into the chat input via the same
  // record -> transcribe pipeline that used to power the standalone
  // Voice Quick Capture screen. We only use the transcript here, not the
  // AI-parsed job draft.
  const [voiceState, setVoiceState] = useState<VoiceCaptureState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const voiceStartedAtRef = useRef<number>(0);
  const isRecordingRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Cache business context so we don't re-fetch on every message send
  const cachedContextRef = useRef<string | null>(null);

  useEffect(() => {
    if (voiceState === "recording") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [voiceState, pulseAnim]);

  // Ensure we never leave a dangling recording session if the user
  // navigates away from the screen mid-recording.
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        recorder.stop().catch(() => {});
        isRecordingRef.current = false;
      }
    };
  }, [recorder]);

  const startVoiceCapture = async () => {
    try {
      setVoiceError(null);
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Microphone Access Required",
          "HomeBase needs access to your microphone to transcribe voice notes. Please enable it in Settings.",
          [
            { text: "Not Now", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      isRecordingRef.current = true;
      voiceStartedAtRef.current = Date.now();
      setVoiceState("recording");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      setVoiceError("Could not start recording. Please check microphone permissions.");
      setVoiceState("idle");
    }
  };

  const stopVoiceCapture = async () => {
    try {
      const elapsed = Date.now() - voiceStartedAtRef.current;
      await recorder.stop();
      isRecordingRef.current = false;

      if (elapsed < 500) {
        setVoiceError("Recording was too short. Please try again.");
        setVoiceState("idle");
        return;
      }
      const uri = recorder.uri;
      if (!uri) {
        setVoiceError("No audio was captured. Please try again.");
        setVoiceState("idle");
        return;
      }
      if (!providerId) {
        setVoiceError("Unable to transcribe: missing provider profile.");
        setVoiceState("idle");
        return;
      }

      setVoiceState("processing");
      const file = new File(uri);
      const base64Audio = await file.base64();
      const response = await apiRequest(
        "POST",
        `/api/provider/${providerId}/voice-quick-capture`,
        { audio: base64Audio },
      );
      const data = (await response.json()) as { transcript: string };
      setInputText((prev) => {
        const trimmedPrev = prev.trim();
        return trimmedPrev ? `${trimmedPrev} ${data.transcript}` : data.transcript;
      });
      setVoiceState("idle");
    } catch (error) {
      isRecordingRef.current = false;
      setVoiceError("Something went wrong while processing your recording. Please try again.");
      setVoiceState("idle");
    }
  };

  const handleMicPress = () => {
    if (voiceState === "recording") {
      stopVoiceCapture();
    } else if (voiceState === "idle") {
      startVoiceCapture();
    }
  };

  const getBusinessContext = async (): Promise<string> => {
    // Return cached context if available (avoids refetching on every message)
    if (cachedContextRef.current !== null) {
      return cachedContextRef.current;
    }

    const fallback = `Provider Business Context:\n- Business Name: ${providerProfile?.businessName || "Unknown"}`;

    if (!providerId) {
      cachedContextRef.current = fallback;
      return fallback;
    }
    try {
      const [profileRes, clientsRes, jobsRes, invoicesRes, statsRes] = await Promise.allSettled([
        apiRequest("GET", `/api/providers/${providerId}`),
        apiRequest("GET", `/api/provider/${providerId}/clients`),
        apiRequest("GET", `/api/provider/${providerId}/jobs`),
        apiRequest("GET", `/api/provider/${providerId}/invoices`),
        apiRequest("GET", `/api/provider/${providerId}/stats`),
      ]);

      let businessName = providerProfile?.businessName || "Unknown";
      let totalClients = 0;
      let scheduledJobs = 0;
      let completedJobs = 0;
      let pendingInvoiceCount = 0;
      let pendingInvoiceTotal = 0;
      let revenueMTD = 0;
      let upcomingJobs = 0;

      if (profileRes.status === "fulfilled" && profileRes.value.ok) {
        const d = await profileRes.value.json();
        businessName = d.provider?.businessName || d.businessName || businessName;
      }
      if (clientsRes.status === "fulfilled" && clientsRes.value.ok) {
        const d = await clientsRes.value.json();
        totalClients = (d.clients as unknown[]).length;
      }
      if (jobsRes.status === "fulfilled" && jobsRes.value.ok) {
        const d = await jobsRes.value.json();
        const jobList = (d.jobs || []) as JobRecord[];
        scheduledJobs = jobList.filter((j) => j.status === "scheduled").length;
        completedJobs = jobList.filter((j) => j.status === "completed").length;
      }
      if (invoicesRes.status === "fulfilled" && invoicesRes.value.ok) {
        const d = await invoicesRes.value.json();
        const invList = (d.invoices || []) as InvoiceRecord[];
        const pending = invList.filter((i) => i.status === "sent" || i.status === "overdue");
        pendingInvoiceCount = pending.length;
        pendingInvoiceTotal = pending.reduce(
          (sum: number, i: InvoiceRecord) => sum + parseFloat(i.total || i.amount || "0"),
          0
        );
      }
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const d = await statsRes.value.json();
        revenueMTD = d.revenueMTD || 0;
        upcomingJobs = d.upcomingJobs || scheduledJobs;
      }

      const context = `
Provider Business Context:
- Business Name: ${businessName}
- Total Clients: ${totalClients}
- Scheduled/Upcoming Jobs: ${upcomingJobs || scheduledJobs}
- Completed Jobs: ${completedJobs}
- Pending Invoices: ${pendingInvoiceCount} (Total outstanding: $${pendingInvoiceTotal.toFixed(2)})
- Revenue This Month: $${revenueMTD.toFixed(2)}
      `.trim();

      cachedContextRef.current = context;
      return context;
    } catch {
      cachedContextRef.current = fallback;
      return fallback;
    }
  };
  
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    
    try {
      const businessContext = await getBusinessContext();
      const response = await apiRequest("POST", "/api/ai/provider-assistant", {
        message: text.trim(),
        businessContext,
        conversationHistory: messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
      
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const speakResponse = (text: string) => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      Speech.speak(text, {
        language: "en-US",
        rate: 0.9,
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
  };
  
  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    
    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.assistantMessage,
        ]}
      >
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: Colors.accentLight }]}>
            <Feather name="cpu" size={16} color={Colors.accent} />
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser
              ? { backgroundColor: Colors.accent }
              : {
                  backgroundColor: isDark
                    ? theme.backgroundSecondary
                    : theme.backgroundDefault,
                },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isUser ? "#FFFFFF" : theme.text },
            ]}
          >
            {item.content}
          </Text>
          {!isUser && (
            <Pressable
              onPress={() => speakResponse(item.content)}
              style={styles.speakButton}
              testID={`speak-message-${item.id}`}
            >
              <Feather
                name={isSpeaking ? "volume-x" : "volume-2"}
                size={16}
                color={theme.textSecondary}
              />
            </Pressable>
          )}
        </View>
      </View>
    );
  };
  
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.aiIcon, { backgroundColor: Colors.accentLight }]}>
        <Feather name="cpu" size={40} color={Colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        Business Assistant
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Ask me anything about your business, schedule jobs, create invoices, or get insights.
      </Text>
      
      <View style={styles.quickPrompts}>
        <Text style={[styles.quickPromptsTitle, { color: theme.textSecondary }]}>
          Try asking:
        </Text>
        {QUICK_PROMPTS.map((prompt, index) => (
          <Pressable
            key={index}
            onPress={() => sendMessage(prompt)}
            style={({ pressed }) => [
              styles.quickPrompt,
              {
                backgroundColor: isDark
                  ? theme.backgroundSecondary
                  : theme.backgroundDefault,
              },
              pressed && { opacity: 0.7 },
            ]}
            testID={`quick-prompt-${index}`}
          >
            <Text style={[styles.quickPromptText, { color: theme.text }]}>
              {prompt}
            </Text>
            <Feather name="arrow-right" size={16} color={Colors.accent} />
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.messagesList,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: Spacing.xl,
          },
          messages.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={renderEmptyState}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
        testID="messages-list"
      />
      
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: isDark
              ? "rgba(28, 28, 30, 0.95)"
              : "rgba(255, 255, 255, 0.95)",
            paddingBottom: insets.bottom + Spacing.sm,
            borderTopColor: theme.border,
          },
        ]}
      >
        {voiceState === "recording" ? (
          <View style={styles.voiceStatusRow}>
            <View style={[styles.voiceDot, { backgroundColor: Colors.error }]} />
            <Text style={[styles.voiceStatusText, { color: theme.textSecondary }]}>
              Listening... {Math.floor(recorderState.durationMillis / 1000)}s
            </Text>
          </View>
        ) : null}

        {voiceState === "processing" ? (
          <View style={styles.voiceStatusRow}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={[styles.voiceStatusText, { color: theme.textSecondary }]}>
              Transcribing...
            </Text>
          </View>
        ) : null}

        {voiceError ? (
          <View style={styles.voiceStatusRow}>
            <Feather name="alert-circle" size={14} color={Colors.error} />
            <Text style={[styles.voiceStatusText, { color: Colors.error }]}>
              {voiceError}
            </Text>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark
                  ? theme.backgroundSecondary
                  : theme.backgroundDefault,
                color: theme.text,
              },
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask your business assistant..."
            placeholderTextColor={theme.textTertiary}
            multiline
            maxLength={1000}
            testID="chat-input"
          />

          <Pressable
            onPress={handleMicPress}
            disabled={voiceState === "processing"}
            style={({ pressed }) => [
              styles.micButton,
              {
                backgroundColor:
                  voiceState === "recording"
                    ? Colors.error
                    : isDark
                    ? theme.backgroundSecondary
                    : theme.backgroundDefault,
              },
              pressed && { opacity: 0.7 },
            ]}
            testID="voice-input-button"
          >
            {voiceState === "processing" ? (
              <ActivityIndicator
                size="small"
                color={isDark ? theme.text : theme.textSecondary}
              />
            ) : (
              <Animated.View
                style={
                  voiceState === "recording"
                    ? { transform: [{ scale: pulseAnim }] }
                    : undefined
                }
              >
                <Feather
                  name={voiceState === "recording" ? "square" : "mic"}
                  size={18}
                  color={voiceState === "recording" ? "#FFFFFF" : theme.textSecondary}
                />
              </Animated.View>
            )}
          </Pressable>

          <Pressable
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor:
                  inputText.trim() && !isLoading
                    ? Colors.accent
                    : isDark
                    ? theme.backgroundSecondary
                    : theme.backgroundDefault,
              },
              pressed && { opacity: 0.7 },
            ]}
            testID="send-button"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather
                name="send"
                size={20}
                color={inputText.trim() ? "#FFFFFF" : theme.textTertiary}
              />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  emptyList: {
    justifyContent: "center",
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    alignItems: "flex-end",
  },
  userMessage: {
    justifyContent: "flex-end",
  },
  assistantMessage: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  messageBubble: {
    maxWidth: "75%",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  messageText: {
    ...Typography.body,
  },
  speakButton: {
    marginTop: Spacing.xs,
    alignSelf: "flex-end",
    padding: Spacing.xs,
  },
  voiceStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  voiceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  voiceStatusText: {
    ...Typography.footnote,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  aiIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.title2,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  quickPrompts: {
    width: "100%",
  },
  quickPromptsTitle: {
    ...Typography.footnote,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickPrompt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  quickPromptText: {
    ...Typography.subhead,
    flex: 1,
    marginRight: Spacing.sm,
  },
  inputContainer: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    ...Typography.body,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
