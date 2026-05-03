import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

interface CrewJob {
  id: string;
  title: string;
  status: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  address: string | null;
  notes: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  weather_held: "Weather Hold",
};

export default function MyJobsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeCrewProviderId, crewMemberships } = useAuthStore();
  const membership = crewMemberships.find(
    (m) => m.providerId === activeCrewProviderId,
  );

  const { data, isLoading, refetch, isFetching } = useQuery<{
    jobs: CrewJob[];
  }>({
    queryKey: [`/api/crew/me/jobs?providerId=${activeCrewProviderId ?? ""}`],
    enabled: !!activeCrewProviderId,
  });

  const jobs = data?.jobs || [];
  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  }, []);

  const upcoming = jobs.filter((j) => {
    if (!j.scheduledDate) return false;
    const d = new Date(j.scheduledDate).getTime();
    return d >= today && j.status !== "completed" && j.status !== "cancelled";
  });
  const recent = jobs.filter((j) => !upcoming.includes(j)).slice(0, 25);

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
        {membership ? (
          <ThemedText style={[styles.crewBanner, { color: theme.textSecondary }]}>
            Working as crew for {membership.providerName}
          </ThemedText>
        ) : null}

        {isLoading || isFetching ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.xl }} />
        ) : null}

        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Upcoming
        </ThemedText>
        {upcoming.length === 0 ? (
          <ThemedText
            style={[styles.empty, { color: theme.textTertiary }]}
            testID="text-no-upcoming-crew-jobs"
          >
            No upcoming jobs assigned to you.
          </ThemedText>
        ) : (
          upcoming.map((j) => renderJob(j, navigation, theme))
        )}

        {recent.length > 0 ? (
          <>
            <ThemedText
              style={[
                styles.sectionTitle,
                { color: theme.textSecondary, marginTop: Spacing.xl },
              ]}
            >
              History
            </ThemedText>
            {recent.map((j) => renderJob(j, navigation, theme))}
          </>
        ) : null}

        <Pressable
          onPress={() => refetch()}
          style={{ alignSelf: "center", marginTop: Spacing.xl }}
          testID="button-refresh-crew-jobs"
        >
          <ThemedText style={{ color: Colors.accent, ...Typography.body }}>
            Refresh
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

function renderJob(
  job: CrewJob,
  navigation: NativeStackNavigationProp<RootStackParamList>,
  theme: ReturnType<typeof useTheme>["theme"],
) {
  const dateLabel = job.scheduledDate
    ? new Date(job.scheduledDate).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "Unscheduled";
  return (
    <Pressable
      key={job.id}
      onPress={() =>
        navigation.navigate("CrewJobDetail", { jobId: job.id })
      }
      testID={`crew-job-${job.id}`}
    >
      <GlassCard style={styles.jobCard}>
        <View style={styles.jobHead}>
          <ThemedText style={styles.jobTitle} numberOfLines={1}>
            {job.title}
          </ThemedText>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <ThemedText
              style={[styles.statusText, { color: theme.textSecondary }]}
            >
              {STATUS_LABEL[job.status] ?? job.status}
            </ThemedText>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Feather name="calendar" size={13} color={theme.textTertiary} />
          <ThemedText
            style={[styles.metaText, { color: theme.textSecondary }]}
          >
            {dateLabel}
            {job.scheduledTime ? ` · ${job.scheduledTime}` : ""}
          </ThemedText>
        </View>
        {job.address ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={13} color={theme.textTertiary} />
            <ThemedText
              style={[styles.metaText, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {job.address}
            </ThemedText>
          </View>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  crewBanner: {
    ...Typography.caption,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.footnote,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  empty: {
    ...Typography.body,
    paddingVertical: Spacing.lg,
  },
  jobCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  jobHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  jobTitle: {
    ...Typography.body,
    fontWeight: "600",
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    ...Typography.caption,
  },
});
