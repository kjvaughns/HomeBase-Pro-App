import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { getApiUrl, apiRequest } from "@/lib/query-client";

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
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Cache business context so we don't re-fetch on every message send
  const cachedContextRef = useRef<string | null>(null);
  
  const pulseScale = useSharedValue(1);
  
  useEffect(() => {
    if (isListening) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing; cleanup tracked in Task #107
  }, [isListening]);
  
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

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
  
  const handleVoicePress = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      setIsListening(true);
      // Voice input is not yet integrated — just toggle the listening indicator
      setTimeout(() => {
        setIsListening(false);
      }, 3000);
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
        {isListening && (
          <View style={styles.listeningIndicator}>
            <Animated.View style={[styles.pulseDot, pulseStyle]} />
            <Text style={[styles.listeningText, { color: Colors.accent }]}>
              Listening...
            </Text>
          </View>
        )}
        
        <View style={styles.inputRow}>
          <Pressable
            onPress={handleVoicePress}
            style={({ pressed }) => [
              styles.voiceButton,
              {
                backgroundColor: isListening
                  ? Colors.accent
                  : isDark
                  ? theme.backgroundSecondary
                  : theme.backgroundDefault,
              },
              pressed && { opacity: 0.7 },
            ]}
            testID="voice-button"
          >
            <Feather
              name={isListening ? "mic-off" : "mic"}
              size={20}
              color={isListening ? "#FFFFFF" : theme.text}
            />
          </Pressable>
          
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
  listeningIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: Spacing.sm,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    marginRight: Spacing.sm,
  },
  listeningText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
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
