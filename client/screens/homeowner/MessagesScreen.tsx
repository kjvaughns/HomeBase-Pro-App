import React, { useState } from "react";
import { StyleSheet, FlatList, RefreshControl, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonListRow } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { MessageThread } from "@/state/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { isAuthenticated } = useAuthStore();

  const messageThreads = useHomeownerStore((s) => s.messageThreads);
  const isHydrated = useHomeownerStore((s) => s.isHydrated);

  const [refreshing, setRefreshing] = useState(false);

  const threads = isAuthenticated ? messageThreads : [];

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleThreadPress = (thread: MessageThread) => {
    navigation.navigate("Chat", { jobId: thread.jobId });
  };

  const renderThread = ({ item, index }: { item: MessageThread; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <Pressable
        onPress={() => handleThreadPress(item)}
        style={[styles.threadCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}
        testID={`thread-${item.id}`}
      >
        <Avatar name={item.providerName} size={48} imageUrl={item.providerAvatar} />
        <View style={styles.threadContent}>
          <View style={styles.threadHeader}>
            <ThemedText style={styles.providerName} numberOfLines={1}>
              {item.providerName}
            </ThemedText>
            <ThemedText style={[styles.threadTime, { color: theme.textTertiary }]}>
              {item.lastMessageTime}
            </ThemedText>
          </View>
          <ThemedText style={[styles.serviceName, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.service}
          </ThemedText>
          <View style={styles.lastMessageRow}>
            <ThemedText
              style={[
                styles.lastMessage,
                { color: theme.textSecondary },
                item.unreadCount > 0 && styles.lastMessageUnread,
              ]}
              numberOfLines={1}
            >
              {item.lastMessage}
            </ThemedText>
            {item.unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: Colors.accent }]}>
                <ThemedText style={styles.unreadCount}>{item.unreadCount}</ThemedText>
              </View>
            )}
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={theme.textTertiary} />
      </Pressable>
    </Animated.View>
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../../assets/images/empty-messages.png")}
      title="No messages yet"
      description="When you connect with a service provider, your conversations will appear here."
      primaryAction={{
        label: "Find a Pro",
        onPress: () => navigation.navigate("Main"),
      }}
    />
  );

  if (!isHydrated) {
    return (
      <ThemedView style={styles.container}>
        <FlatList
          data={[1, 2, 3, 4, 5]}
          renderItem={() => <SkeletonListRow />}
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
          }}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={threads}
        renderItem={renderThread}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
          },
          threads.length === 0 && styles.emptyContainer,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
  },
  threadCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  threadContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  threadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  providerName: {
    ...Typography.subhead,
    fontWeight: "600",
    flex: 1,
  },
  threadTime: {
    ...Typography.caption2,
    marginLeft: Spacing.sm,
  },
  serviceName: {
    ...Typography.caption1,
    marginTop: 2,
  },
  lastMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  lastMessage: {
    ...Typography.caption1,
    flex: 1,
  },
  lastMessageUnread: {
    fontWeight: "600",
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: Spacing.sm,
  },
  unreadCount: {
    ...Typography.caption2,
    color: "#fff",
    fontWeight: "700",
  },
});
