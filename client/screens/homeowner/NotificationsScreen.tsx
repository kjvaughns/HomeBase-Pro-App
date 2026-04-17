import React, { useCallback, useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  SectionList,
  Pressable,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  data?: string;
  createdAt: string;
}

interface NotificationSection {
  title: string;
  data: Notification[];
}

const NOTIFICATION_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  booking_confirmed: "check-circle",
  booking_cancelled: "x-circle",
  booking_update: "calendar",
  booking_request: "calendar",
  payment_received: "dollar-sign",
  invoice: "file-text",
  message: "message-circle",
  reminder: "bell",
  default: "bell",
};

const NOTIFICATION_COLORS: Record<string, string> = {
  booking_confirmed: Colors.success,
  booking_cancelled: Colors.error,
  booking_update: Colors.accent,
  booking_request: Colors.accent,
  payment_received: Colors.success,
  invoice: Colors.warning,
  message: Colors.accent,
  reminder: Colors.warning,
  default: Colors.accent,
};

function getDateLabel(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const notifDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (notifDay.getTime() === today.getTime()) return "Today";
  if (notifDay.getTime() === yesterday.getTime()) return "Yesterday";

  const diffDays = Math.floor((today.getTime() - notifDay.getTime()) / 86400000);
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function groupByDate(notifications: Notification[]): NotificationSection[] {
  const groups: Record<string, Notification[]> = {};
  for (const notif of notifications) {
    const label = getDateLabel(notif.createdAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(notif);
  }
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme, isDark } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading } = useQuery<{ notifications: Notification[] }>({
    queryKey: ["/api/notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return { notifications: [] };
      const response = await apiRequest("GET", `/api/notifications/${user.id}`);
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return response.json();
    },
    enabled: !!user?.id,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing; cleanup tracked in Task #107
  const notifications = data?.notifications || [];
  const sections = useMemo(() => groupByDate(notifications), [notifications]);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id, "unread-count"] });
    setRefreshing(false);
  }, [queryClient, user?.id]);

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await apiRequest("POST", `/api/notifications/${notificationId}/read`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id, "unread-count"] });
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }, [queryClient, user?.id]);

  const handleMarkAllRead = useCallback(async () => {
    if (!user?.id || unreadCount === 0) return;
    try {
      await apiRequest("POST", `/api/notifications/${user.id}/read-all`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id, "unread-count"] });
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  }, [queryClient, user?.id, unreadCount]);

  const handleNotificationPress = useCallback((notification: Notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }

    if (notification.data) {
      try {
        const parsedData = JSON.parse(notification.data);
        if (parsedData.appointmentId) {
          navigation.navigate("AppointmentDetail", { appointmentId: parsedData.appointmentId });
        } else if (parsedData.invoiceId) {
          navigation.navigate("InvoiceDetail", { invoiceId: parsedData.invoiceId });
        } else if (parsedData.clientId) {
          navigation.navigate("ClientDetail", { clientId: parsedData.clientId });
        }
      } catch {
        /* invalid JSON, ignore */
      }
    }
  }, [handleMarkAsRead, navigation]);

  const renderItem = useCallback(({ item, index }: { item: Notification; index: number }) => {
    const iconName = NOTIFICATION_ICONS[item.type] || NOTIFICATION_ICONS.default;
    const iconColor = NOTIFICATION_COLORS[item.type] || NOTIFICATION_COLORS.default;
    const isUnread = !item.isRead;

    return (
      <Animated.View entering={FadeInDown.delay(index * 30).duration(250)}>
        <Pressable
          testID={`notification-item-${item.id}`}
          style={[
            styles.notificationCard,
            {
              backgroundColor: isUnread
                ? isDark ? `${iconColor}18` : `${iconColor}0A`
                : theme.cardBackground,
              borderLeftColor: isUnread ? iconColor : "transparent",
            },
          ]}
          onPress={() => handleNotificationPress(item)}
        >
          <View style={[styles.iconContainer, { backgroundColor: `${iconColor}18` }]}>
            <Feather name={iconName} size={18} color={iconColor} />
          </View>
          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <ThemedText
                style={[styles.title, isUnread && styles.unreadTitle]}
                numberOfLines={1}
              >
                {item.title}
              </ThemedText>
              <ThemedText style={[styles.time, { color: theme.textTertiary }]}>
                {getTimeAgo(item.createdAt)}
              </ThemedText>
            </View>
            <ThemedText
              style={[styles.message, { color: theme.textSecondary }]}
              numberOfLines={2}
            >
              {item.message}
            </ThemedText>
          </View>
          {isUnread ? (
            <View style={[styles.unreadDot, { backgroundColor: iconColor }]} />
          ) : null}
        </Pressable>
      </Animated.View>
    );
  }, [theme, isDark, handleNotificationPress]);

  const renderSectionHeader = useCallback(({ section }: { section: NotificationSection }) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.backgroundRoot }]}>
      <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        {section.title}
      </ThemedText>
    </View>
  ), [theme]);

  const SkeletonCard = () => (
    <View style={[styles.skeletonCard, { backgroundColor: theme.cardBackground }]}>
      <SkeletonLoader width={40} height={40} borderRadius={20} />
      <View style={styles.skeletonContent}>
        <SkeletonLoader width="60%" height={14} borderRadius={4} />
        <SkeletonLoader width="100%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View
          style={{
            paddingTop: headerHeight + Spacing.md,
            paddingHorizontal: Spacing.screenPadding,
            gap: Spacing.sm,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      </ThemedView>
    );
  }

  if (notifications.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View
          style={{
            flex: 1,
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
          }}
        >
          <EmptyState
            image={require("../../../assets/images/empty-bookings.png")}
            title="No notifications"
            description="You're all caught up! Notifications about your bookings, messages, and updates will appear here."
          />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {unreadCount > 0 ? (
        <View
          style={[
            styles.markAllBar,
            {
              paddingTop: headerHeight + Spacing.sm,
              backgroundColor: theme.backgroundRoot,
              borderBottomColor: theme.borderLight,
            },
          ]}
        >
          <Pressable
            testID="button-mark-all-read"
            style={styles.markAllButton}
            onPress={handleMarkAllRead}
          >
            <Feather name="check-circle" size={14} color={Colors.accent} />
            <ThemedText style={[styles.markAllText, { color: Colors.accent }]}>
              Mark all as read ({unreadCount})
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: unreadCount > 0 ? Spacing.sm : headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
            progressViewOffset={headerHeight}
          />
        }
        stickySectionHeadersEnabled={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.borderLight }]} />
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  markAllBar: {
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.screenPadding,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 1,
  },
  markAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-end",
  },
  markAllText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  sectionHeader: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.footnote,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  notificationCard: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.md,
    borderLeftWidth: 3,
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginBottom: 3,
  },
  title: {
    ...Typography.subhead,
    fontWeight: "500",
    flex: 1,
  },
  unreadTitle: {
    fontWeight: "700",
  },
  time: {
    ...Typography.caption2,
    flexShrink: 0,
  },
  message: {
    ...Typography.footnote,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    flexShrink: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.screenPadding + 40 + Spacing.md,
  },
  skeletonCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  skeletonContent: {
    flex: 1,
    gap: 8,
  },
});
