import React, { useMemo, useCallback, useEffect, useState } from "react";
import { StyleSheet, View, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useNavigation, useFocusEffect, CompositeNavigationProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { HomeownerTabParamList } from "@/navigation/HomeownerTabNavigator";
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
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface Appointment {
  id: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  estimatedPrice?: string;
  provider?: {
    businessName: string;
  };
}

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<HomeownerTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

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
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuthStore();
  
  const categories = useHomeownerStore((s) => s.categories);
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAppointments = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await apiRequest("GET", `/api/users/${user.id}/appointments`);
      if (response.ok) {
        const data = await response.json();
        setAppointments(data.appointments || []);
      }
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchAppointments();
    }, [fetchAppointments])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  const upcomingAppointments = useMemo(() => 
    appointments.filter((a) => {
      const date = new Date(a.scheduledDate);
      return date >= new Date() && (a.status === "confirmed" || a.status === "pending");
    }), 
    [appointments]
  );
  
  const activeAppointments = useMemo(() => 
    appointments.filter((a) => a.status === "in_progress"), 
    [appointments]
  );
  
  const recentAppointments = useMemo(() => {
    return [...appointments]
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
      .slice(0, 3);
  }, [appointments]);

  const handleAppointmentPress = (appointmentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("AppointmentDetail", { appointmentId });
  };

  const handleViewAllJobs = () => {
    navigation.getParent()?.navigate("ManageTab");
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pending",
      confirmed: "Confirmed",
      in_progress: "In Progress",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    return labels[status] || status;
  };

  const getStatusStyle = (status: string): "success" | "info" | "warning" | "neutral" | "pending" | "scheduled" | "inProgress" | "completed" => {
    const styles: Record<string, "success" | "info" | "warning" | "neutral" | "pending" | "scheduled" | "inProgress" | "completed"> = {
      pending: "pending",
      confirmed: "scheduled",
      in_progress: "inProgress",
      completed: "completed",
      cancelled: "neutral",
    };
    return styles[status] || "neutral";
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
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl + 40,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.greeting}>
            <View>
              <ThemedText style={styles.welcomeText}>Welcome back,</ThemedText>
              <ThemedText style={styles.userName}>
                {user?.name?.split(" ")[0] || "Homeowner"}
              </ThemedText>
            </View>
            <Avatar name={user?.name || "User"} size="medium" />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Pressable onPress={handleAIPress}>
            <GlassCard style={styles.aiCard}>
              <View style={styles.aiCardContent}>
                <View style={[styles.aiIconContainer, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="message-circle" size={24} color={Colors.accent} />
                </View>
                <View style={styles.aiTextContainer}>
                  <ThemedText style={styles.aiTitle}>Ask HomeBase AI</ThemedText>
                  <ThemedText style={[styles.aiSubtitle, { color: theme.textSecondary }]}>
                    Get instant help with any home question
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </View>
            </GlassCard>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <StatCard
                title="Upcoming"
                value={upcomingAppointments.length}
                icon="calendar"
              />
            </View>
            <View style={styles.statCard}>
              <StatCard
                title="In Progress"
                value={activeAppointments.length}
                icon="tool"
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          {recentAppointments.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>Recent Bookings</ThemedText>
                <Pressable onPress={handleViewAllJobs}>
                  <ThemedText style={[styles.viewAll, { color: Colors.accent }]}>View All</ThemedText>
                </Pressable>
              </View>

              {recentAppointments.map((appt) => (
                <Pressable key={appt.id} onPress={() => handleAppointmentPress(appt.id)}>
                  <GlassCard style={styles.jobCard}>
                    <View style={styles.jobHeader}>
                      <Avatar name={appt.provider?.businessName || "Provider"} size="small" />
                      <View style={styles.jobInfo}>
                        <ThemedText style={styles.jobService}>{appt.serviceName}</ThemedText>
                        <ThemedText style={[styles.jobProvider, { color: theme.textSecondary }]}>
                          {appt.provider?.businessName || "Service Provider"}
                        </ThemedText>
                      </View>
                      <StatusPill
                        label={getStatusLabel(appt.status)}
                        status={getStatusStyle(appt.status)}
                      />
                    </View>
                    {appt.scheduledDate ? (
                      <View style={styles.jobFooter}>
                        <Feather name="calendar" size={14} color={theme.textSecondary} />
                        <ThemedText style={[styles.jobDate, { color: theme.textSecondary }]}>
                          {formatDate(appt.scheduledDate)} at {appt.scheduledTime}
                        </ThemedText>
                      </View>
                    ) : null}
                  </GlassCard>
                </Pressable>
              ))}
            </>
          ) : (
            <GlassCard style={styles.emptyCard}>
              <Feather name="inbox" size={40} color={theme.textSecondary} />
              <ThemedText style={styles.emptyText}>No bookings yet</ThemedText>
              <ThemedText style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                Book your first service to get started
              </ThemedText>
            </GlassCard>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Quick Search</ThemedText>
            <Pressable onPress={() => navigation.navigate("FindTab")}>
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
  },
  jobFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
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
