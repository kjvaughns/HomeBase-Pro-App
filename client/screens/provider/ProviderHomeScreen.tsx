import React, { useState } from "react";
import { StyleSheet, View, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import { JobCard } from "@/components/JobCard";
import { SectionHeader } from "@/components/SectionHeader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { providerStats, mockJobs } from "@/state/mockData";

export default function ProviderHomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, providerProfile } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const upcomingJobs = mockJobs.filter((job) => job.status !== "completed").slice(0, 3);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassCard style={styles.greetingCard}>
            <View style={styles.greetingContent}>
              <Avatar uri={user?.avatarUrl} name={user?.name} size="medium" />
              <View style={styles.greetingText}>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  {getGreeting()},
                </ThemedText>
                <ThemedText type="h2">{user?.name?.split(" ")[0]}</ThemedText>
              </View>
              <View style={styles.notificationIcon}>
                <Feather name="bell" size={24} color={theme.text} />
                <View style={styles.notificationBadge} />
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          style={styles.statsRow}
        >
          <StatCard
            title="This Month"
            value={`$${providerStats.totalEarnings.toLocaleString()}`}
            icon="dollar-sign"
            trend={{ value: 12, positive: true }}
          />
          <StatCard
            title="Pending"
            value={`$${providerStats.pendingEarnings}`}
            icon="clock"
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(300).duration(400)}
          style={styles.statsRow}
        >
          <StatCard
            title="Jobs Done"
            value={providerStats.completedJobs}
            icon="check-circle"
          />
          <StatCard
            title="Rating"
            value={providerStats.rating.toFixed(1)}
            subtitle={`${providerStats.reviewCount} reviews`}
            icon="star"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <GlassCard style={styles.quickActions}>
            <View style={styles.quickActionsRow}>
              <View style={styles.quickAction}>
                <View
                  style={[
                    styles.quickActionIcon,
                    { backgroundColor: `${Colors.accent}15` },
                  ]}
                >
                  <Feather name="users" size={20} color={Colors.accent} />
                </View>
                <ThemedText type="label">{providerStats.newLeads}</ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  New Leads
                </ThemedText>
              </View>

              <View
                style={[styles.quickActionDivider, { backgroundColor: theme.border }]}
              />

              <View style={styles.quickAction}>
                <View
                  style={[
                    styles.quickActionIcon,
                    { backgroundColor: `${Colors.accent}15` },
                  ]}
                >
                  <Feather name="calendar" size={20} color={Colors.accent} />
                </View>
                <ThemedText type="label">{providerStats.upcomingJobs}</ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  Upcoming
                </ThemedText>
              </View>

              <View
                style={[styles.quickActionDivider, { backgroundColor: theme.border }]}
              />

              <View style={styles.quickAction}>
                <View
                  style={[
                    styles.quickActionIcon,
                    { backgroundColor: `${Colors.accent}15` },
                  ]}
                >
                  <Feather name="percent" size={20} color={Colors.accent} />
                </View>
                <ThemedText type="label">{providerStats.responseRate}%</ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  Response
                </ThemedText>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <SectionHeader
            title="Upcoming Jobs"
            actionLabel="See All"
            onAction={() => {}}
          />
        </Animated.View>

        {upcomingJobs.map((job, index) => (
          <Animated.View
            key={job.id}
            entering={FadeInDown.delay(600 + index * 100).duration(400)}
          >
            <JobCard job={job} onPress={() => {}} testID={`job-${job.id}`} />
          </Animated.View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  greetingCard: {
    marginBottom: Spacing.lg,
  },
  greetingContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  greetingText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  notificationIcon: {
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  quickActions: {
    marginBottom: Spacing.xl,
  },
  quickActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  quickAction: {
    alignItems: "center",
    flex: 1,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  quickActionDivider: {
    width: 1,
    height: 60,
  },
});
