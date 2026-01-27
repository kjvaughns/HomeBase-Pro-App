import React, { useCallback, useState } from "react";
import { StyleSheet, View, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
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
import { apiRequest, getApiUrl } from "@/lib/query-client";

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

const NOTIFICATION_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  booking_confirmed: "check-circle",
  booking_cancelled: "x-circle",
  booking_update: "calendar",
  payment_received: "dollar-sign",
  message: "message-circle",
  reminder: "bell",
  default: "bell",
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error } = useQuery<{ notifications: Notification[] }>({
    queryKey: ["/api/notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return { notifications: [] };
      const response = await fetch(new URL(`/api/notifications/${user.id}`, getApiUrl()).toString());
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return response.json();
    },
    enabled: !!user?.id,
  });

  const notifications = data?.notifications || [];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    setRefreshing(false);
  }, [queryClient]);

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await apiRequest("POST", `/api/notifications/${notificationId}/read`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }, [queryClient]);

  const handleNotificationPress = useCallback((notification: Notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    
    if (notification.data) {
      try {
        const parsedData = JSON.parse(notification.data);
        if (parsedData.appointmentId) {
          (navigation as any).navigate("AppointmentDetail", { appointmentId: parsedData.appointmentId });
        }
      } catch {
        // Unable to parse, just mark as read
      }
    }
  }, [handleMarkAsRead, navigation]);

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const renderNotification = ({ item, index }: { item: Notification; index: number }) => {
    const iconName = NOTIFICATION_ICONS[item.type] || NOTIFICATION_ICONS.default;
    const isUnread = !item.isRead;

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
        <Pressable
          style={[
            styles.notificationCard,
            { 
              backgroundColor: isUnread 
                ? (isDark ? `${Colors.accent}14` : `${Colors.accent}08`)
                : theme.cardBackground,
              borderColor: isUnread ? Colors.accent : theme.borderLight,
            },
          ]}
          onPress={() => handleNotificationPress(item)}
        >
          <View style={[styles.iconContainer, { backgroundColor: `${Colors.accent}14` }]}>
            <Feather name={iconName} size={20} color={Colors.accent} />
          </View>
          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <ThemedText style={[styles.title, isUnread && styles.unreadTitle]}>
                {item.title}
              </ThemedText>
              {isUnread ? (
                <View style={[styles.unreadDot, { backgroundColor: Colors.accent }]} />
              ) : null}
            </View>
            <ThemedText style={[styles.message, { color: theme.textSecondary }]} numberOfLines={2}>
              {item.message}
            </ThemedText>
            <ThemedText style={[styles.time, { color: theme.textTertiary }]}>
              {getTimeAgo(item.createdAt)}
            </ThemedText>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const SkeletonCard = () => (
    <View style={[styles.skeletonCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
      <SkeletonLoader width={44} height={44} borderRadius={22} />
      <View style={styles.skeletonContent}>
        <SkeletonLoader width="60%" height={16} borderRadius={4} />
        <SkeletonLoader width="100%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
        <SkeletonLoader width="30%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <FlatList
          data={[1, 2, 3, 4, 5]}
          renderItem={() => <SkeletonCard />}
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
            gap: Spacing.sm,
          }}
        />
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
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
          gap: Spacing.sm,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notificationCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    ...Typography.subhead,
    fontWeight: "500",
    flex: 1,
  },
  unreadTitle: {
    fontWeight: "600",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: Spacing.xs,
  },
  message: {
    ...Typography.body,
    marginTop: 4,
  },
  time: {
    ...Typography.caption2,
    marginTop: 6,
  },
  skeletonCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  skeletonContent: {
    flex: 1,
  },
});
