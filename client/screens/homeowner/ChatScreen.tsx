import React, { useState, useRef, useEffect, useMemo } from "react";
import { StyleSheet, View, FlatList, Pressable, TextInput, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ChatMessage } from "@/state/types";

type ScreenRouteProp = RouteProp<RootStackParamList, "Chat">;

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const { theme } = useTheme();
  const { jobId } = route.params;

  const messageThreads = useHomeownerStore((s) => s.messageThreads);
  const sendMessage = useHomeownerStore((s) => s.sendMessage);
  const markThreadAsRead = useHomeownerStore((s) => s.markThreadAsRead);
  const profile = useHomeownerStore((s) => s.profile);
  
  const thread = useMemo(() => messageThreads.find((t) => t.jobId === jobId), [messageThreads, jobId]);

  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (thread) {
      markThreadAsRead(thread.id);
    }
  }, [thread?.id]);

  const handleSend = () => {
    if (!inputText.trim() || !thread) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(thread.id, inputText.trim());
    setInputText("");
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwn = item.senderId === profile?.id;

    return (
      <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
        {!isOwn && <Avatar name={item.senderName} size={32} />}
        <View
          style={[
            styles.messageBubble,
            isOwn
              ? { backgroundColor: Colors.accent }
              : { backgroundColor: theme.cardBackground, borderColor: theme.borderLight, borderWidth: 1 },
          ]}
        >
          <ThemedText style={[styles.messageText, isOwn && { color: "#fff" }]}>
            {item.content}
          </ThemedText>
          <ThemedText
            style={[
              styles.messageTime,
              { color: isOwn ? "rgba(255,255,255,0.7)" : theme.textTertiary },
            ]}
          >
            {formatTime(item.timestamp)}
          </ThemedText>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="message-circle" size={48} color={theme.textTertiary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
        No messages yet
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textTertiary }]}>
        Start a conversation with your provider
      </ThemedText>
    </View>
  );

  const messages = thread?.messages || [];
  const reversedMessages = [...messages].reverse();

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted={messages.length > 0}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[
            styles.messageList,
            {
              paddingTop: messages.length > 0 ? Spacing.md : 0,
              paddingBottom: headerHeight + Spacing.md,
            },
          ]}
          showsVerticalScrollIndicator={false}
        />

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.borderLight,
              paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.md,
            },
          ]}
        >
          <View style={[styles.inputWrapper, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Type a message..."
              placeholderTextColor={theme.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim()}
              style={[
                styles.sendButton,
                { backgroundColor: inputText.trim() ? Colors.accent : theme.borderLight },
              ]}
            >
              <Feather name="send" size={18} color="#fff" />
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
  messageList: {
    paddingHorizontal: Spacing.screenPadding,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  messageRowOwn: {
    flexDirection: "row-reverse",
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
  messageTime: {
    ...Typography.caption2,
    marginTop: 4,
    textAlign: "right",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    ...Typography.headline,
    marginTop: Spacing.md,
  },
  emptyText: {
    ...Typography.subhead,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  inputContainer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  input: {
    flex: 1,
    ...Typography.body,
    maxHeight: 100,
    paddingVertical: Platform.OS === "ios" ? Spacing.xs : 0,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
