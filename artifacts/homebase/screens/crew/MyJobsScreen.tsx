import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
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
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
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

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  scheduled: {
    label: "Scheduled",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.12)",
  },
  confirmed: {
    label: "Confirmed",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.12)",
  },
  in_progress: {
    label: "In Progress",
    color: Colors.accent,
    bg: Colors.accentLight,
  },
  completed: {
    label: "Completed",
    color: "#6B7280",
    bg: "rgba(107,114,128,0.12)",
  },
  cancelled: {
    label: "Cancelled",
    color: Colors.error,
    bg: "rgba(239,68,68,0.12)",
  },
  weather_held: {
    label: "Weather Hold",
    color: Colors.warning,
    bg: Colors.warningLight,
  },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function MyJobsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const { theme } = useTheme();
  const { horizontalPadding } = useLayout();
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

  const jobs = data?.jobs ?? [];
  const todayStart = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  }, []);

  const upcoming = jobs.filter((j) => {
    if (!j.scheduledDate) return false;
    return (
      new Date(j.scheduledDate).getTime() >= todayStart &&
      j.status !== "completed" &&
      j.status !== "cancelled"
    );
  });
  const history = jobs.filter((j) => !upcoming.includes(j)).slice(0, 25);

  const todayCount = upcoming.filter((j) => {
    if (!j.scheduledDate) return false;
    const d = new Date(j.scheduledDate);
    return (
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() ===
      todayStart
    );
  }).length;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: horizontalPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={Colors.accent}
          />
        }
      >
        {membership ? (
          <View
            style={[styles.banner, { backgroundColor: Colors.accentLight }]}
          >
            <View
              style={[styles.bannerDot, { backgroundColor: Colors.accent }]}
            />
            <View style={{ flex: 1 }}>
              <ThemedText
                style={[styles.bannerProvider, { color: Colors.accent }]}
              >
                {membership.providerName}
              </ThemedText>
              <ThemedText style={[styles.bannerSub, { color: Colors.accent }]}>
                {todayCount > 0
                  ? `${todayCount} job${todayCount !== 1 ? "s" : ""} assigned today`
                  : "No jobs scheduled today"}
              </ThemedText>
            </View>
            <Feather name="users" size={17} color={Colors.accent} />
          </View>
        ) : null}

        {isLoading ? (
          <ActivityIndicator
            color={Colors.accent}
            style={{ marginTop: Spacing["2xl"] }}
          />
        ) : (
          <>
            <ThemedText
              style={[styles.sectionTitle, { color: theme.textSecondary }]}
            >
              Upcoming
            </ThemedText>

            {upcoming.length === 0 ? (
              <View
                style={[
                  styles.emptyBox,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="calendar" size={20} color={theme.textTertiary} />
                <ThemedText
                  style={[styles.emptyText, { color: theme.textSecondary }]}
                >
                  No upcoming jobs assigned to you
                </ThemedText>
              </View>
            ) : (
              upcoming.map((j) => (
                <JobCard
                  key={j.id}
                  job={j}
                  navigation={navigation}
                  theme={theme}
                />
              ))
            )}

            {history.length > 0 ? (
              <>
                <ThemedText
                  style={[
                    styles.sectionTitle,
                    { color: theme.textSecondary, marginTop: Spacing.xl },
                  ]}
                >
                  History
                </ThemedText>
                {history.map((j) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    navigation={navigation}
                    theme={theme}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function JobCard({
  job,
  navigation,
  theme,
}: {
  job: CrewJob;
  navigation: NativeStackNavigationProp<RootStackParamList>;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const cfg = STATUS_CONFIG[job.status] ?? {
    label: job.status,
    color: "#6B7280",
    bg: "rgba(107,114,128,0.12)",
  };
  const dateLabel = job.scheduledDate
    ? formatDate(job.scheduledDate)
    : "Unscheduled";
  const timeLabel = formatTime(job.scheduledTime);

  return (
    <Pressable
      onPress={() => navigation.navigate("CrewJobDetail", { jobId: job.id })}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.cardBackground, opacity: pressed ? 0.88 : 1 },
      ]}
      testID={`crew-job-${job.id}`}
    >
      <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <ThemedText style={styles.cardTitle} numberOfLines={1}>
            {job.title}
          </ThemedText>
          <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
            <ThemedText style={[styles.pillText, { color: cfg.color }]}>
              {cfg.label}
            </ThemedText>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Feather name="calendar" size={12} color={theme.textTertiary} />
          <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
            {dateLabel}
            {timeLabel ? `  ·  ${timeLabel}` : ""}
          </ThemedText>
        </View>
        {job.address ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={12} color={theme.textTertiary} />
            <ThemedText
              style={[styles.metaText, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {job.address}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.chevronWrap}>
        <Feather name="chevron-right" size={16} color={theme.textTertiary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  bannerProvider: {
    ...Typography.subhead,
    fontWeight: "700",
  },
  bannerSub: {
    ...Typography.caption,
    opacity: 0.85,
    marginTop: 1,
  },

  sectionTitle: {
    ...Typography.footnote,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },

  emptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  emptyText: { ...Typography.body },

  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  cardBody: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.md,
    gap: 4,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  cardTitle: {
    ...Typography.body,
    fontWeight: "600",
    flex: 1,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    flexShrink: 0,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: { ...Typography.caption },
  chevronWrap: {
    paddingHorizontal: Spacing.sm,
  },
});
