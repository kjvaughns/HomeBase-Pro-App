import React, { useMemo, useState } from "react";
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
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  scheduled: { color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  confirmed: { color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  in_progress: { color: Colors.accent, bg: Colors.accentLight },
  completed: { color: "#6B7280", bg: "rgba(107,114,128,0.12)" },
  cancelled: { color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  weather_held: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
};

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatTime(t: string | null): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function CrewScheduleScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeCrewProviderId } = useAuthStore();
  const [offset, setOffset] = useState(0);

  const selected = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + offset);
    t.setHours(0, 0, 0, 0);
    return t;
  }, [offset]);

  const { data, isLoading } = useQuery<{ jobs: CrewJob[] }>({
    queryKey: [`/api/crew/me/jobs?providerId=${activeCrewProviderId ?? ""}`],
    enabled: !!activeCrewProviderId,
  });

  const grouped = useMemo(() => {
    const jobs = data?.jobs ?? [];
    const map = new Map<string, CrewJob[]>();
    for (const j of jobs) {
      if (!j.scheduledDate || j.status === "cancelled") continue;
      const k = dateKey(new Date(j.scheduledDate));
      const arr = map.get(k) ?? [];
      arr.push(j);
      map.set(k, arr);
    }
    return map;
  }, [data]);

  const dayJobs = (grouped.get(dateKey(selected)) ?? []).sort((a, b) =>
    (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""),
  );

  const days = useMemo(() => {
    const arr: Date[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = -1; i <= 12; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  const todayKey = dateKey(new Date());

  const selectedDayLabel = selected.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <ThemedView style={styles.container}>
      <View style={{ paddingTop: headerHeight + Spacing.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.dayStrip,
            { paddingHorizontal: Spacing.screenPadding },
          ]}
        >
          {days.map((d) => {
            const k = dateKey(d);
            const isSelected = k === dateKey(selected);
            const isToday = k === todayKey;
            const jobCount = (grouped.get(k) ?? []).length;

            return (
              <Pressable
                key={k}
                onPress={() => {
                  const ms =
                    d.getTime() -
                    new Date(new Date().setHours(0, 0, 0, 0)).getTime();
                  setOffset(Math.round(ms / 86400000));
                }}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: isSelected
                      ? Colors.accent
                      : theme.backgroundSecondary,
                  },
                ]}
                testID={`crew-day-${k}`}
              >
                <ThemedText
                  style={[
                    styles.dayDow,
                    { color: isSelected ? "#FFF" : theme.textSecondary },
                  ]}
                >
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.dayNum,
                    {
                      color: isSelected
                        ? "#FFF"
                        : isToday
                          ? Colors.accent
                          : theme.text,
                    },
                  ]}
                >
                  {d.getDate()}
                </ThemedText>
                {isToday && !isSelected ? (
                  <View
                    style={[styles.dot, { backgroundColor: Colors.accent }]}
                  />
                ) : jobCount > 0 && !isSelected ? (
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: theme.textTertiary },
                    ]}
                  />
                ) : isSelected && jobCount > 0 ? (
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: "rgba(255,255,255,0.7)" },
                    ]}
                  />
                ) : (
                  <View style={styles.dot} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <ThemedText
          style={[
            styles.dayLabel,
            {
              color: theme.textSecondary,
              paddingHorizontal: Spacing.screenPadding,
            },
          ]}
        >
          {selectedDayLabel}
        </ThemedText>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator
            color={Colors.accent}
            style={{ marginTop: Spacing.xl }}
          />
        ) : dayJobs.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Feather name="sun" size={20} color={theme.textTertiary} />
            <ThemedText
              style={[styles.emptyText, { color: theme.textSecondary }]}
            >
              No jobs scheduled for this day
            </ThemedText>
          </View>
        ) : (
          <View style={styles.timeline}>
            {dayJobs.map((j, idx) => {
              const cfg = STATUS_CONFIG[j.status] ?? {
                color: "#6B7280",
                bg: "rgba(107,114,128,0.12)",
              };
              const isLast = idx === dayJobs.length - 1;
              return (
                <View key={j.id} style={styles.timelineRow}>
                  <View style={styles.timeCol}>
                    <ThemedText
                      style={[styles.timeText, { color: theme.textSecondary }]}
                    >
                      {formatTime(j.scheduledTime)}
                    </ThemedText>
                    {!isLast ? (
                      <View
                        style={[
                          styles.connector,
                          { backgroundColor: theme.separator },
                        ]}
                      />
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.timeDot,
                      {
                        backgroundColor: cfg.color,
                        borderColor: theme.backgroundRoot,
                      },
                    ]}
                  />

                  <Pressable
                    onPress={() =>
                      navigation.navigate("CrewJobDetail", { jobId: j.id })
                    }
                    style={({ pressed }) => [
                      styles.timelineCard,
                      {
                        backgroundColor: theme.cardBackground,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                    testID={`crew-schedule-job-${j.id}`}
                  >
                    <View
                      style={[styles.cardBar, { backgroundColor: cfg.color }]}
                    />
                    <View style={styles.cardContent}>
                      <ThemedText style={styles.cardTitle} numberOfLines={1}>
                        {j.title}
                      </ThemedText>
                      {j.address ? (
                        <View style={styles.addrRow}>
                          <Feather
                            name="map-pin"
                            size={11}
                            color={theme.textTertiary}
                          />
                          <ThemedText
                            style={[
                              styles.addrText,
                              { color: theme.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {j.address}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.chevronWrap}>
                      <Feather
                        name="chevron-right"
                        size={14}
                        color={theme.textTertiary}
                      />
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  dayStrip: { gap: Spacing.sm, paddingVertical: Spacing.sm },
  dayChip: {
    width: 52,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    gap: 2,
  },
  dayDow: {
    ...Typography.caption,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  dayNum: { ...Typography.body, fontWeight: "700" },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },

  dayLabel: {
    ...Typography.caption,
    fontWeight: "500",
    marginTop: Spacing.sm,
    marginBottom: 2,
  },

  emptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  emptyText: { ...Typography.body },

  timeline: { gap: 0 },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  timeCol: {
    width: 68,
    alignItems: "flex-end",
    paddingRight: Spacing.sm,
    position: "relative",
  },
  timeText: {
    ...Typography.caption,
    fontWeight: "600",
    lineHeight: 20,
  },
  connector: {
    position: "absolute",
    top: 20,
    right: 7,
    width: 1.5,
    bottom: -Spacing.md,
  },
  timeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    marginTop: 5,
    marginRight: Spacing.sm,
    flexShrink: 0,
  },
  timelineCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardBar: { width: 3, alignSelf: "stretch" },
  cardContent: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    gap: 3,
  },
  cardTitle: { ...Typography.body, fontWeight: "600" },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  addrText: { ...Typography.caption, flex: 1 },
  chevronWrap: { paddingHorizontal: Spacing.xs },
});
