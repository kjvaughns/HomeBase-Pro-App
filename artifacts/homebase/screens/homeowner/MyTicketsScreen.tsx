import React, { useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  updatedAt: string;
  createdAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Open", color: "#1d6fb5", bg: "#1d6fb520" },
  in_progress: { label: "In Progress", color: "#b57a1d", bg: "#b57a1d20" },
  resolved: { label: "Resolved", color: "#1d9b5a", bg: "#1d9b5a20" },
  closed: { label: "Closed", color: "#6b7280", bg: "#6b728020" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <ThemedText style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</ThemedText>
    </View>
  );
}

export default function MyTicketsScreen() {
  const { theme } = useTheme();
  const { horizontalPadding } = useLayout();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ tickets: Ticket[] }>({
    queryKey: ["my-support-tickets"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/support/tickets");
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const tickets = data?.tickets ?? [];

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: horizontalPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={Colors.accent}
          />
        }
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Feather name="alert-circle" size={40} color={theme.textTertiary} />
            <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
              Couldn't load tickets
            </ThemedText>
            <Pressable onPress={() => refetch()} style={[styles.retryBtn, { backgroundColor: Colors.accent }]}>
              <ThemedText style={styles.retryText}>Try Again</ThemedText>
            </Pressable>
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.center}>
            <View style={[styles.emptyIcon, { backgroundColor: Colors.accent + "15" }]}>
              <Feather name="inbox" size={36} color={Colors.accent} />
            </View>
            <ThemedText style={styles.emptyTitle}>No tickets yet</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Submit a support request and you'll be able to follow the conversation here.
            </ThemedText>
            <Pressable
              style={[styles.retryBtn, { backgroundColor: Colors.accent }]}
              onPress={() => navigation.navigate("ContactUs")}
            >
              <Feather name="message-square" size={16} color="#FFF" />
              <ThemedText style={styles.retryText}>Contact Support</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {tickets.map((ticket, index) => (
              <Pressable
                key={ticket.id}
                style={[
                  styles.row,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                    marginBottom: index < tickets.length - 1 ? Spacing.sm : 0,
                  },
                ]}
                onPress={() => navigation.navigate("TicketDetail", { ticketId: ticket.id })}
              >
                <View style={styles.rowTop}>
                  <ThemedText style={styles.subject} numberOfLines={2}>
                    {ticket.subject}
                  </ThemedText>
                  <StatusBadge status={ticket.status} />
                </View>
                <View style={styles.rowBottom}>
                  <View style={[styles.categoryPill, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText style={[styles.categoryText, { color: theme.textSecondary }]}>
                      {ticket.category}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.timestamp, { color: theme.textTertiary }]}>
                    {relativeTime(ticket.updatedAt)}
                  </ThemedText>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={theme.textTertiary}
                  style={styles.chevron}
                />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.title3,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    ...Typography.subhead,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  retryText: {
    ...Typography.callout,
    fontWeight: "600",
    color: "#FFF",
  },
  list: {},
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    paddingRight: Spacing.xl + 4,
    position: "relative",
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  subject: {
    ...Typography.callout,
    fontWeight: "600",
    flex: 1,
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  badgeText: {
    ...Typography.caption1,
    fontWeight: "700",
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  timestamp: {
    ...Typography.caption2,
  },
  chevron: {
    position: "absolute",
    right: Spacing.md,
    top: "50%",
    marginTop: -9,
  },
});
