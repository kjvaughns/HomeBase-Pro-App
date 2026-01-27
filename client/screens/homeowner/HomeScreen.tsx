import React, { useMemo } from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import { Avatar } from "@/components/Avatar";
import { StatusPill } from "@/components/StatusPill";
import { CategoryCard } from "@/components/CategoryCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Job, JobStatus, ServiceCategory } from "@/state/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_MAP: Record<JobStatus, { label: string; status: "success" | "info" | "warning" | "neutral" | "pending" | "scheduled" | "inProgress" | "completed" }> = {
  requested: { label: "Requested", status: "info" },
  scheduled: { label: "Scheduled", status: "scheduled" },
  in_progress: { label: "In Progress", status: "inProgress" },
  awaiting_payment: { label: "Payment Due", status: "warning" },
  completed: { label: "Completed", status: "completed" },
  paid: { label: "Paid", status: "success" },
  closed: { label: "Closed", status: "neutral" },
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuthStore();
  
  const jobs = useHomeownerStore((s) => s.jobs);
  const categories = useHomeownerStore((s) => s.categories);

  const upcomingJobs = useMemo(() => 
    jobs.filter((j) => j.status === "scheduled" || j.status === "requested"), 
    [jobs]
  );
  
  const activeJobs = useMemo(() => 
    jobs.filter((j) => j.status === "in_progress" || j.status === "awaiting_payment"), 
    [jobs]
  );
  
  const recentJobs = useMemo(() => jobs.slice(0, 3), [jobs]);

  const handleJobPress = (job: Job) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("JobDetail", { jobId: job.id });
  };

  const handleViewAllJobs = () => {
    navigation.getParent()?.navigate("ManageTab");
  };

  const handleAIPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("AIChat");
  };

  const handleCategoryPress = (category: ServiceCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("ProviderList", {
      categoryId: category.id,
      categoryName: category.name,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.greeting}>
            <View>
              <ThemedText style={styles.welcomeText}>Welcome back,</ThemedText>
              <ThemedText style={styles.userName}>{user?.name?.split(" ")[0] || "Homeowner"}</ThemedText>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Pressable onPress={handleAIPress} testID="ask-homebase-ai-card">
            <GlassCard style={styles.aiCard}>
              <View style={styles.aiCardContent}>
                <View style={[styles.aiIconContainer, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="message-circle" size={24} color={Colors.accent} />
                </View>
                <View style={styles.aiTextContainer}>
                  <ThemedText style={styles.aiTitle}>Ask Homebase AI</ThemedText>
                  <ThemedText style={[styles.aiSubtitle, { color: theme.textSecondary }]}>
                    Get instant answers or find the right pro for your project
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textTertiary} />
              </View>
            </GlassCard>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <View style={styles.statsRow}>
            <Pressable onPress={handleViewAllJobs} style={styles.statCard}>
              <StatCard
                title="Upcoming"
                value={upcomingJobs.length.toString()}
                icon="calendar"
              />
            </Pressable>
            <Pressable onPress={handleViewAllJobs} style={styles.statCard}>
              <StatCard
                title="Active"
                value={activeJobs.length.toString()}
                icon="clock"
              />
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
            <Pressable onPress={handleViewAllJobs}>
              <ThemedText style={[styles.viewAll, { color: Colors.accent }]}>View All</ThemedText>
            </Pressable>
          </View>

          {recentJobs.length > 0 ? (
            recentJobs.map((job) => {
              const statusInfo = STATUS_MAP[job.status];
              return (
                <GlassCard
                  key={job.id}
                  style={styles.jobCard}
                  onPress={() => handleJobPress(job)}
                >
                  <View style={styles.jobHeader}>
                    <Avatar name={job.providerName} size="small" uri={job.providerAvatar} />
                    <View style={styles.jobInfo}>
                      <ThemedText style={styles.jobService} numberOfLines={1}>
                        {job.service}
                      </ThemedText>
                      <ThemedText style={[styles.jobProvider, { color: theme.textSecondary }]} numberOfLines={1}>
                        {job.providerBusinessName || job.providerName}
                      </ThemedText>
                    </View>
                    <StatusPill label={statusInfo.label} status={statusInfo.status} />
                  </View>
                  <View style={styles.jobFooter}>
                    <View style={styles.jobMeta}>
                      <Feather name="calendar" size={14} color={theme.textTertiary} />
                      <ThemedText style={[styles.jobDate, { color: theme.textTertiary }]}>
                        {formatDate(job.scheduledDate)}
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={18} color={theme.textTertiary} />
                  </View>
                </GlassCard>
              );
            })
          ) : (
            <GlassCard style={styles.emptyCard}>
              <Feather name="clipboard" size={32} color={theme.textTertiary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No recent activity
              </ThemedText>
              <ThemedText style={[styles.emptySubtext, { color: theme.textTertiary }]}>
                Book a service to get started
              </ThemedText>
            </GlassCard>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Quick Search</ThemedText>
            <Pressable onPress={() => navigation.getParent()?.navigate("FindTab")}>
              <ThemedText style={[styles.viewAll, { color: Colors.accent }]}>See All</ThemedText>
            </Pressable>
          </View>

          <View style={styles.categoriesGrid}>
            {categories.slice(0, 6).map((category) => (
              <View key={category.id} style={styles.categoryItem}>
                <CategoryCard
                  name={category.name}
                  icon={category.icon as any}
                  onPress={() => handleCategoryPress(category)}
                  compact
                />
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Home Tools</ThemedText>
          </View>

          <View style={styles.quickActions}>
            <Pressable
              style={[styles.quickAction, { backgroundColor: theme.cardBackground }]}
              onPress={() => navigation.navigate("SurvivalKit")}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="shield" size={20} color={Colors.accent} />
              </View>
              <ThemedText style={styles.quickActionText}>Survival Kit</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.quickAction, { backgroundColor: theme.cardBackground }]}
              onPress={() => navigation.navigate("HealthScore")}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="activity" size={20} color={Colors.accent} />
              </View>
              <ThemedText style={styles.quickActionText}>Health Score</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.quickAction, { backgroundColor: theme.cardBackground }]}
              onPress={() => navigation.navigate("ServiceHistory")}
              testID="quick-action-service-history"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="clock" size={20} color={Colors.accent} />
              </View>
              <ThemedText style={styles.quickActionText}>Service History</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.quickAction, { backgroundColor: theme.cardBackground }]}
              onPress={() => navigation.navigate("HouseFax")}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="file-text" size={20} color={Colors.accent} />
              </View>
              <ThemedText style={styles.quickActionText}>HouseFax</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  greeting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  welcomeText: {
    ...Typography.subhead,
    opacity: 0.7,
  },
  userName: {
    ...Typography.largeTitle,
  },
  aiCard: {
    marginBottom: Spacing.lg,
  },
  aiCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  aiTextContainer: {
    flex: 1,
  },
  aiTitle: {
    ...Typography.headline,
    marginBottom: 2,
  },
  aiSubtitle: {
    ...Typography.subhead,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.title3,
  },
  viewAll: {
    ...Typography.subhead,
  },
  jobCard: {
    marginBottom: Spacing.sm,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  jobInfo: {
    flex: 1,
  },
  jobService: {
    ...Typography.headline,
  },
  jobProvider: {
    ...Typography.subhead,
    marginTop: 2,
  },
  jobFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  jobMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  jobDate: {
    ...Typography.caption1,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    ...Typography.headline,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    ...Typography.subhead,
    marginTop: Spacing.xs,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  categoryItem: {
    width: "31%",
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  quickAction: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: {
    ...Typography.subhead,
    flex: 1,
  },
});
