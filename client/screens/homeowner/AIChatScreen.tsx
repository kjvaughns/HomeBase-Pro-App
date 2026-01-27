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
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
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
  const { theme, isDark } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

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
      const response = await fetch(new URL("/api/chat/simple", apiUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim() }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
      };

      setMessages((prev) => [...prev, assistantMessage]);
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
  }, [isLoading]);

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
        <View
          style={[
            styles.messageBubble,
            isUser
              ? { backgroundColor: Colors.accent }
              : { backgroundColor: theme.backgroundSecondary },
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
        <ThemedText style={styles.emptyTitle}>Ask Homebase AI</ThemedText>
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
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages.length > 0 ? [...messages].reverse() : []}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted={messages.length > 0}
          contentContainerStyle={[
            styles.messagesContent,
            {
              paddingTop: Spacing.lg,
              paddingBottom: headerHeight + Spacing.lg,
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
  messageBubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    maxWidth: "100%",
  },
  messageText: {
    ...Typography.body,
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
