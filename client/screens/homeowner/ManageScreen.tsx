import React, { useState, useEffect } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable, SectionList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { StatusPill } from "@/components/StatusPill";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { AccountGateModal } from "@/components/AccountGateModal";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Job, JobStatus } from "@/state/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_CONFIG: Record<JobStatus, { label: string; variant: "success" | "info" | "warning" | "neutral" }> = {
  requested: { label: "Requested", variant: "info" },
  scheduled: { label: "Scheduled", variant: "info" },
  in_progress: { label: "In Progress", variant: "warning" },
  awaiting_payment: { label: "Awaiting Payment", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  paid: { label: "Paid", variant: "success" },
  closed: { label: "Closed", variant: "neutral" },
};

type Section = {
  title: string;
  data: Job[];
};

export default function ManageScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { isAuthenticated, login } = useAuthStore();

  const jobs = useHomeownerStore((s) => s.jobs);
  const isHydrated = useHomeownerStore((s) => s.isHydrated);

  const [refreshing, setRefreshing] = useState(false);
  const [showAccountGate, setShowAccountGate] = useState(false);

  const sections: Section[] = React.useMemo(() => {
    if (!isAuthenticated || jobs.length === 0) return [];

    const upcoming = jobs.filter((j) => j.status === "scheduled");
    const active = jobs.filter((j) =>
      ["requested", "in_progress", "awaiting_payment"].includes(j.status)
    );
    const past = jobs.filter((j) =>
      ["completed", "paid", "closed"].includes(j.status)
    );

    const result: Section[] = [];
    if (upcoming.length > 0) result.push({ title: "Upcoming", data: upcoming });
    if (active.length > 0) result.push({ title: "Active", data: active });
    if (past.length > 0) result.push({ title: "Past", data: past });

    return result;
  }, [jobs, isAuthenticated]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleJobPress = (job: Job) => {
    navigation.navigate("JobDetail", { jobId: job.id });
  };

  const handleMockSignIn = () => {
    login({
      id: "1",
      name: "Alex Johnson",
      email: "alex@example.com",
    });
    setShowAccountGate(false);
  };

  const renderJob = ({ item, index }: { item: Job; index: number }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
        <Pressable
          onPress={() => handleJobPress(item)}
          style={[styles.jobCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}
          testID={`job-${item.id}`}
        >
          <View style={styles.jobHeader}>
            <Avatar name={item.providerName} size={44} />
            <View style={styles.jobInfo}>
              <ThemedText style={styles.providerName}>{item.providerName}</ThemedText>
              <ThemedText style={[styles.serviceName, { color: theme.textSecondary }]}>
                {item.service}
              </ThemedText>
            </View>
            <StatusPill label={statusConfig.label} variant={statusConfig.variant} size="small" />
          </View>

          <View style={[styles.jobDetails, { borderTopColor: theme.borderLight }]}>
            <View style={styles.detailItem}>
              <Feather name="calendar" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                {item.scheduledDate || "TBD"}
              </ThemedText>
            </View>
            <View style={styles.detailItem}>
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                {item.scheduledTime || "TBD"}
              </ThemedText>
            </View>
            {item.estimatedPrice > 0 && (
              <View style={styles.detailItem}>
                <Feather name="dollar-sign" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  ${item.estimatedPrice}
                </ThemedText>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
      <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
      <ThemedText style={[styles.sectionCount, { color: theme.textSecondary }]}>
        {section.data.length}
      </ThemedText>
    </View>
  );

  const renderEmpty = () => {
    if (!isAuthenticated) {
      return (
        <EmptyState
          image={require("../../../assets/images/empty-bookings.png")}
          title="Sign in to manage jobs"
          description="Create an account to book services, track your projects, and manage your home."
          primaryAction={{
            label: "Sign In",
            onPress: () => setShowAccountGate(true),
          }}
        />
      );
    }

    return (
      <EmptyState
        image={require("../../../assets/images/empty-bookings.png")}
        title="No jobs yet"
        description="When you book a service, it will appear here. Start by finding a pro!"
        primaryAction={{
          label: "Find a Pro",
          onPress: () => navigation.navigate("Main"),
        }}
      />
    );
  };

  if (!isHydrated) {
    return (
      <ThemedView style={styles.container}>
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <SkeletonCard />}
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

  if (!isAuthenticated || sections.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View
          style={{
            flex: 1,
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
          }}
        >
          {renderEmpty()}
        </View>
        <AccountGateModal
          visible={showAccountGate}
          onClose={() => setShowAccountGate(false)}
          onSignIn={handleMockSignIn}
          onSignUp={handleMockSignIn}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SectionList
        sections={sections}
        renderItem={renderJob}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.headline,
    fontWeight: "600",
  },
  sectionCount: {
    ...Typography.subhead,
  },
  jobCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  jobInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  providerName: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  serviceName: {
    ...Typography.caption1,
    marginTop: 2,
  },
  jobDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  detailText: {
    ...Typography.caption1,
  },
});
