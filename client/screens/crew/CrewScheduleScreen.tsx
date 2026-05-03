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
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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
  const jobs = data?.jobs || [];

  const grouped = useMemo(() => {
    const map = new Map<string, CrewJob[]>();
    for (const j of jobs) {
      if (!j.scheduledDate) continue;
      if (j.status === "cancelled") continue;
      const d = new Date(j.scheduledDate);
      const k = dateKey(d);
      const arr = map.get(k) || [];
      arr.push(j);
      map.set(k, arr);
    }
    return map;
  }, [jobs]);

  const dayJobs = (grouped.get(dateKey(selected)) || []).sort((a, b) => {
    const at = a.scheduledTime || "";
    const bt = b.scheduledTime || "";
    return at.localeCompare(bt);
  });

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

  return (
    <ThemedView style={styles.container}>
      <View
        style={{
          paddingTop: headerHeight + Spacing.sm,
          paddingHorizontal: Spacing.screenPadding,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayStrip}
        >
          {days.map((d) => {
            const k = dateKey(d);
            const isSelected = k === dateKey(selected);
            const isToday = k === todayKey;
            const hasJobs = (grouped.get(k) || []).length > 0;
            return (
              <Pressable
                key={k}
                onPress={() => {
                  const ms = d.getTime() - new Date(new Date().setHours(0, 0, 0, 0)).getTime();
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
                    {
                      color: isSelected
                        ? "#FFFFFF"
                        : theme.textSecondary,
                    },
                  ]}
                >
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.dayNum,
                    { color: isSelected ? "#FFFFFF" : theme.text },
                  ]}
                >
                  {d.getDate()}
                </ThemedText>
                {isToday ? (
                  <View
                    style={[
                      styles.todayDot,
                      {
                        backgroundColor: isSelected ? "#FFFFFF" : Colors.accent,
                      },
                    ]}
                  />
                ) : hasJobs ? (
                  <View
                    style={[
                      styles.hasDot,
                      {
                        backgroundColor: isSelected
                          ? "#FFFFFF"
                          : theme.textTertiary,
                      },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.accent} />
        ) : dayJobs.length === 0 ? (
          <ThemedText
            style={[styles.empty, { color: theme.textTertiary }]}
            testID="text-crew-no-jobs-this-day"
          >
            No jobs assigned to you on this day.
          </ThemedText>
        ) : (
          dayJobs.map((j) => (
            <Pressable
              key={j.id}
              onPress={() =>
                navigation.navigate("CrewJobDetail", { jobId: j.id })
              }
              testID={`crew-schedule-job-${j.id}`}
            >
              <GlassCard style={styles.jobCard}>
                <View style={styles.jobHead}>
                  <ThemedText style={styles.jobTime}>
                    {j.scheduledTime ?? "—"}
                  </ThemedText>
                  <ThemedText style={styles.jobTitle} numberOfLines={1}>
                    {j.title}
                  </ThemedText>
                </View>
                {j.address ? (
                  <View style={styles.metaRow}>
                    <Feather
                      name="map-pin"
                      size={13}
                      color={theme.textTertiary}
                    />
                    <ThemedText
                      style={[styles.metaText, { color: theme.textSecondary }]}
                      numberOfLines={1}
                    >
                      {j.address}
                    </ThemedText>
                  </View>
                ) : null}
              </GlassCard>
            </Pressable>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dayStrip: {
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  dayChip: {
    width: 56,
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
  dayNum: {
    ...Typography.body,
    fontWeight: "700",
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  hasDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  empty: {
    ...Typography.body,
    paddingVertical: Spacing.xl,
    textAlign: "center",
  },
  jobCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  jobHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  jobTime: {
    ...Typography.body,
    fontWeight: "700",
    minWidth: 60,
  },
  jobTitle: {
    ...Typography.body,
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    ...Typography.caption,
  },
});
