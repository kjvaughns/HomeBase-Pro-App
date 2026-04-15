import React, { useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { AccountGateModal } from "@/components/AccountGateModal";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  needsService?: boolean;
  category?: string | null;
  problemSummary?: string | null;
}

const SUGGESTED_QUESTIONS = [
  "What home maintenance should I do this month?",
  "How do I find a reliable plumber?",
  "Tips for reducing energy bills",
  "When should I replace my water heater?",
];

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const { isAuthenticated } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAccountGate, setShowAccountGate] = useState(false);
  const [pendingServiceRequest, setPendingServiceRequest] = useState<{
    category: string;
    problemSummary: string;
  } | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    if (!isAuthenticated) {
      setShowAccountGate(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const apiUrl = getApiUrl();
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      
      const response = await apiRequest("POST", "/api/chat/simple", { message: text.trim(), history });
      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        needsService: data.needsService,
        category: data.category,
        problemSummary: data.problemSummary,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      if (data.needsService && data.category && data.problemSummary) {
        setPendingServiceRequest({
          category: data.category,
          problemSummary: data.problemSummary,
        });
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I couldn't process your request. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages]);
  
  const handleFindPro = (category?: string | null, problemSummary?: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("SmartIntake", {
      prefillCategory: category || undefined,
      prefillProblem: problemSummary || undefined,
    });
  };

  const handleSend = () => {
    sendMessage(inputText);
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.role === "user";

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50).duration(300)}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
      >
        {!isUser ? (
          <View style={[styles.avatarContainer, { backgroundColor: Colors.accentLight }]}>
            <Feather name="home" size={16} color={Colors.accent} />
          </View>
        ) : null}
        <View style={styles.messageContent}>
          <View
            style={[
              styles.messageBubble,
              isUser
                ? { backgroundColor: Colors.accent }
                : { 
                    backgroundColor: theme.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                  },
            ]}
          >
            <ThemedText
              style={[
                styles.messageText,
                isUser ? { color: "#FFFFFF" } : { color: theme.text },
              ]}
            >
              {item.content}
            </ThemedText>
          </View>
          {!isUser && item.needsService ? (
            <Pressable
              onPress={() => handleFindPro(item.category, item.problemSummary)}
              style={styles.findProButton}
            >
              <Feather name="users" size={16} color="#fff" />
              <ThemedText style={styles.findProText}>Find a Pro</ThemedText>
              <Feather name="chevron-right" size={16} color="#fff" />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Animated.View entering={FadeIn.delay(100).duration(400)}>
        <View style={[styles.logoContainer, { backgroundColor: Colors.accentLight }]}>
          <Feather name="home" size={32} color={Colors.accent} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(200).duration(400)}>
        <ThemedText style={styles.emptyTitle}>Ask HomeBase AI</ThemedText>
        <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          Get instant answers about home maintenance, repairs, and finding service providers.
        </ThemedText>
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(300).duration(400)}
        style={styles.suggestionsContainer}
      >
        {SUGGESTED_QUESTIONS.map((question, index) => (
          <Pressable
            key={index}
            onPress={() => handleSuggestedQuestion(question)}
            style={[
              styles.suggestionButton,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.borderLight,
              },
            ]}
          >
            <ThemedText style={styles.suggestionText}>{question}</ThemedText>
            <Feather name="arrow-right" size={14} color={Colors.accent} />
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior="padding"
        keyboardVerticalOffset={headerHeight}
      >
        <FlatList
          ref={flatListRef}
          data={messages.length > 0 ? [...messages].reverse() : []}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted={messages.length > 0}
          style={{ backgroundColor: theme.backgroundRoot }}
          contentContainerStyle={[
            styles.messagesContent,
            messages.length > 0
              ? {
                  // Inverted list: visual top = list bottom; clear header there
                  paddingTop: Spacing.md,
                  paddingBottom: headerHeight + Spacing.md,
                }
              : {
                  // Non-inverted empty state: clear header at the real top
                  paddingTop: headerHeight + Spacing.md,
                  paddingBottom: Spacing.xl,
                },
          ]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: isDark ? theme.backgroundSecondary : theme.backgroundRoot,
              borderTopColor: theme.borderLight,
              paddingBottom: Math.max(insets.bottom, Spacing.md),
            },
          ]}
        >
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.borderLight,
              },
            ]}
          >
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Ask about home services..."
              placeholderTextColor={theme.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isLoading}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={handleSend}
            />
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
              style={[
                styles.sendButton,
                {
                  backgroundColor:
                    inputText.trim() && !isLoading ? Colors.accent : theme.backgroundTertiary,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="send" size={18} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <AccountGateModal
        visible={showAccountGate}
        onClose={() => setShowAccountGate(false)}
        onSignIn={() => { setShowAccountGate(false); navigation.navigate("Login"); }}
        onSignUp={() => { setShowAccountGate(false); navigation.navigate("SignUp"); }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screenPadding,
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    maxWidth: "85%",
  },
  userMessageContainer: {
    alignSelf: "flex-end",
  },
  assistantMessageContainer: {
    alignSelf: "flex-start",
  },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  messageContent: {
    flex: 1,
  },
  messageBubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    maxWidth: "100%",
  },
  messageText: {
    ...Typography.body,
  },
  findProButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  findProText: {
    ...Typography.subhead,
    color: "#fff",
    fontWeight: "600",
    flex: 1,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["4xl"],
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.title2,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  suggestionsContainer: {
    width: "100%",
    gap: Spacing.sm,
  },
  suggestionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  suggestionText: {
    ...Typography.subhead,
    flex: 1,
    marginRight: Spacing.sm,
  },
  inputContainer: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.screenPadding,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: BorderRadius["2xl"],
    borderWidth: 1,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    ...Typography.body,
    maxHeight: 100,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
