import React, { useCallback, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRoute, useFocusEffect } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type Message = {
  id: string;
  senderType: string;
  body: string;
  createdAt: string;
};

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  message: string;
  createdAt: string;
  updatedAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Open", color: "#1d6fb5", bg: "#1d6fb520" },
  in_progress: { label: "In Progress", color: "#b57a1d", bg: "#b57a1d20" },
  resolved: { label: "Resolved", color: "#1d9b5a", bg: "#1d9b5a20" },
  closed: { label: "Closed", color: "#6b7280", bg: "#6b728020" },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageBubble({ msg, isDark }: { msg: Message; isDark: boolean }) {
  const isUser = msg.senderType === "user";
  const isAi = msg.senderType === "ai";

  const bubbleBg = isUser
    ? Colors.accent
    : isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(0,0,0,0.05)";

  const textColor = isUser ? "#FFF" : undefined;
  const metaColor = isUser ? "rgba(255,255,255,0.7)" : undefined;

  const senderLabel = isUser ? "You" : isAi ? "HomeBase AI" : "Support Team";
  const senderIcon: "user" | "cpu" | "headphones" = isUser
    ? "user"
    : isAi
    ? "cpu"
    : "headphones";

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: Colors.accent + "20" }]}>
          <Feather name={senderIcon} size={14} color={Colors.accent} />
        </View>
      )}
      <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser]}>
        {!isUser && (
          <ThemedText style={[styles.senderLabel, { color: Colors.accent }]}>
            {senderLabel}
          </ThemedText>
        )}
        <View style={[styles.bubble, { backgroundColor: bubbleBg }]}>
          <ThemedText style={[styles.bubbleText, textColor ? { color: textColor } : {}]}>
            {msg.body}
          </ThemedText>
        </View>
        <ThemedText
          style={[
            styles.bubbleTime,
            isUser ? styles.bubbleTimeUser : {},
            metaColor ? { color: metaColor } : {},
          ]}
        >
          {formatTime(msg.createdAt)}
        </ThemedText>
      </View>
    </View>
  );
}

export default function TicketDetailScreen() {
  const { theme, isDark } = useTheme();
  const { horizontalPadding } = useLayout();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const qc = useQueryClient();
  const flatRef = useRef<FlatList>(null);

  const { ticketId } = route.params as { ticketId: string };

  const [replyText, setReplyText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{
    ticket: Ticket;
    messages: Message[];
  }>({
    queryKey: ["support-ticket", ticketId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/support/tickets/${ticketId}`);
      if (!res.ok) throw new Error("Failed to fetch ticket");
      return res.json();
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const { mutate: sendReply, isPending: isSending } = useMutation({
    mutationFn: async (body: string) => {
      const res = await apiRequest("POST", `/api/support/tickets/${ticketId}/messages`, { body });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed to send reply");
      }
      return res.json();
    },
    onSuccess: () => {
      setReplyText("");
      setSendError(null);
      qc.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["my-support-tickets"] });
    },
    onError: (err: any) => {
      setSendError(err.message || "Failed to send reply. Please try again.");
    },
  });

  const handleSend = () => {
    const trimmed = replyText.trim();
    if (!trimmed || isSending) return;
    sendReply(trimmed);
  };

  const ticket = data?.ticket;
  const messages = data?.messages ?? [];

  const allMessages: Message[] = ticket
    ? [
        {
          id: "__original__",
          senderType: "user",
          body: ticket.message,
          createdAt: ticket.createdAt,
        },
        ...messages,
      ]
    : messages;

  const statusCfg = ticket ? (STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open) : null;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : isError || !ticket ? (
          <View style={styles.center}>
            <Feather name="alert-circle" size={40} color={theme.textTertiary} />
            <ThemedText style={[styles.errText, { color: theme.textSecondary }]}>
              Couldn't load this ticket
            </ThemedText>
            <Pressable onPress={() => refetch()} style={[styles.retryBtn, { backgroundColor: Colors.accent }]}>
              <ThemedText style={styles.retryText}>Try Again</ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Header card */}
            <View
              style={[
                styles.headerCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderBottomColor: theme.border,
                  paddingHorizontal: horizontalPadding,
                  paddingTop: headerHeight + Spacing.sm,
                },
              ]}
            >
              <View style={styles.headerRow}>
                <ThemedText style={styles.ticketSubject} numberOfLines={2}>
                  {ticket.subject}
                </ThemedText>
                {statusCfg && (
                  <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
                    <ThemedText style={[styles.badgeText, { color: statusCfg.color }]}>
                      {statusCfg.label}
                    </ThemedText>
                  </View>
                )}
              </View>
              <ThemedText style={[styles.ticketMeta, { color: theme.textSecondary }]}>
                {ticket.category} · #{ticket.id.slice(0, 8).toUpperCase()}
              </ThemedText>
            </View>

            {/* Message thread */}
            <FlatList
              ref={flatRef}
              data={allMessages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={[
                styles.thread,
                { paddingHorizontal: horizontalPadding },
              ]}
              onContentSizeChange={() =>
                flatRef.current?.scrollToEnd({ animated: false })
              }
              renderItem={({ item }) => <MessageBubble msg={item} isDark={isDark} />}
              ListFooterComponent={<View style={{ height: Spacing.md }} />}
            />

            {/* Reply input */}
            <View
              style={[
                styles.replyBar,
                {
                  backgroundColor: theme.cardBackground,
                  borderTopColor: theme.border,
                  paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.md,
                  paddingHorizontal: horizontalPadding,
                },
              ]}
            >
              {sendError ? (
                <View
                  style={[
                    styles.errBanner,
                    { backgroundColor: "#fee2e2", borderColor: "#fca5a5" },
                  ]}
                >
                  <Feather name="alert-circle" size={14} color="#dc2626" />
                  <ThemedText style={[styles.errBannerText, { color: "#dc2626" }]}>
                    {sendError}
                  </ThemedText>
                </View>
              ) : null}
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                    },
                  ]}
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="Write a reply…"
                  placeholderTextColor={theme.textTertiary}
                  multiline
                  maxLength={5000}
                  returnKeyType="default"
                />
                <Pressable
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor:
                        replyText.trim().length > 0 && !isSending
                          ? Colors.accent
                          : theme.backgroundSecondary,
                    },
                  ]}
                  onPress={handleSend}
                  disabled={isSending || replyText.trim().length === 0}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <Feather
                      name="send"
                      size={18}
                      color={replyText.trim().length > 0 ? "#FFF" : theme.textTertiary}
                    />
                  )}
                </Pressable>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  kav: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  errText: { ...Typography.body, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  retryText: { ...Typography.callout, fontWeight: "600", color: "#FFF" },
  headerCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  ticketSubject: {
    ...Typography.headline,
    fontWeight: "700",
    flex: 1,
    lineHeight: 22,
  },
  ticketMeta: {
    ...Typography.footnote,
    fontWeight: "500",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  badgeText: { ...Typography.caption1, fontWeight: "700" },
  thread: {
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  bubbleRowUser: {
    flexDirection: "row-reverse",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bubbleWrap: {
    maxWidth: "78%",
  },
  bubbleWrapUser: {
    alignItems: "flex-end",
  },
  senderLabel: {
    ...Typography.caption1,
    fontWeight: "700",
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },
  bubbleText: {
    ...Typography.callout,
    lineHeight: 22,
  },
  bubbleTime: {
    ...Typography.caption2,
    marginTop: 4,
    marginLeft: 4,
    opacity: 0.6,
  },
  bubbleTimeUser: {
    textAlign: "right",
    marginRight: 4,
    marginLeft: 0,
  },
  replyBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
  },
  errBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  errBannerText: {
    ...Typography.footnote,
    flex: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    ...Typography.body,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
