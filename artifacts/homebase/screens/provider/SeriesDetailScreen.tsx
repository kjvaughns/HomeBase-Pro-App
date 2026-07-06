/**
 * Series detail screen.
 *
 * Shows the recurring job_series template (frequency, next occurrence, price)
 * along with a chronological list of every materialized occurrence. From here
 * a provider can jump into any individual occurrence or cancel the entire
 * series. Single-occurrence cancellation lives on the job detail screen.
 */
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { GlassCard } from "@/components/GlassCard";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { useAuthStore } from "@/state/authStore";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

interface ApiSeries {
  id: string;
  providerId: string;
  clientId: string | null;
  customServiceId: string | null;
  title: string;
  frequency: string;
  scheduledTime: string | null;
  estimatedPrice: string | null;
  address: string | null;
  anchorDate: string;
  generatedThrough: string | null;
  status: "active" | "paused" | "cancelled";
  cancelledAt: string | null;
  pausedAt: string | null;
  autopayEnabled: boolean;
}

interface ApiOccurrence {
  id: string;
  title: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: string;
  estimatedPrice: string | null;
  finalPrice: string | null;
}

interface SeriesResponse {
  series: ApiSeries;
  occurrences: ApiOccurrence[];
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: Colors.info,
  confirmed: "#8B5CF6",
  on_my_way: Colors.warning,
  arrived: Colors.warning,
  in_progress: Colors.warning,
  completed: Colors.accent,
  cancelled: "#9CA3AF",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(time?: string | null): string {
  if (!time) return "";
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return time;
  const hour = parseInt(m[1], 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m[2]} ${ampm}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function SeriesDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { horizontalPadding } = useLayout();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "SeriesDetail">>();
  const { seriesId } = route.params;
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<SeriesResponse>({
    queryKey: ["/api/series", seriesId],
    enabled: !!seriesId,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/series/${seriesId}/cancel`, getApiUrl());
      return apiRequest("POST", url.toString(), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series", seriesId] });
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "jobs"],
      });
    },
    onError: () => {
      Alert.alert("Couldn't cancel series", "Please try again.");
    },
  });

  const autopayMutation = useMutation({
    mutationFn: async (autopayEnabled: boolean) => {
      const url = new URL(`/api/series/${seriesId}/autopay`, getApiUrl());
      return apiRequest("PATCH", url.toString(), { autopayEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series", seriesId] });
    },
    onError: () => {
      Alert.alert("Couldn't update autopay", "Please try again.");
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/series/${seriesId}/pause`, getApiUrl());
      return apiRequest("POST", url.toString(), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series", seriesId] });
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "jobs"],
      });
    },
    onError: () => {
      Alert.alert("Couldn't pause series", "Please try again.");
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/series/${seriesId}/resume`, getApiUrl());
      return apiRequest("POST", url.toString(), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series", seriesId] });
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "jobs"],
      });
    },
    onError: () => {
      Alert.alert("Couldn't resume series", "Please try again.");
    },
  });

  const handlePause = useCallback(() => {
    Alert.alert(
      "Pause Repeating Job",
      "Upcoming scheduled visits will be removed from the calendar until you resume. Past and in-progress jobs are kept as-is.",
      [
        { text: "Nevermind", style: "cancel" },
        {
          text: "Pause",
          style: "destructive",
          onPress: () => pauseMutation.mutate(),
        },
      ],
    );
  }, [pauseMutation]);

  const handleResume = useCallback(() => {
    resumeMutation.mutate();
  }, [resumeMutation]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      "Cancel Repeating Job",
      "All future repeats will be cancelled. Past and in-progress jobs are kept as-is.",
      [
        { text: "Nevermind", style: "cancel" },
        {
          text: "Cancel All Repeats",
          style: "destructive",
          onPress: () => cancelMutation.mutate(),
        },
      ],
    );
  }, [cancelMutation]);

  const series = data?.series;
  const occurrences = data?.occurrences ?? [];

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const upcoming: ApiOccurrence[] = [];
    const past: ApiOccurrence[] = [];
    for (const o of occurrences) {
      if (new Date(o.scheduledDate).getTime() >= now - 24 * 60 * 60 * 1000) {
        upcoming.push(o);
      } else {
        past.push(o);
      }
    }
    return { upcoming, past };
  }, [occurrences]);

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.center, { paddingTop: headerHeight }]}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </ThemedView>
    );
  }

  if (isError || !series) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.center, { paddingTop: headerHeight }]}>
          <ThemedText type="h2">Repeating job not found</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const isCancelled = series.status === "cancelled";
  const isPaused = series.status === "paused";

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: horizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.section}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.sm,
              marginBottom: Spacing.xs,
              flexWrap: "wrap",
            }}
          >
            <ThemedText type="h2" testID="text-series-title">
              {series.title}
            </ThemedText>
            <View
              style={[
                styles.recurringBadge,
                { backgroundColor: Colors.accent + "22" },
              ]}
            >
              <Feather name="repeat" size={11} color={Colors.accent} />
              <ThemedText
                style={[styles.recurringBadgeText, { color: Colors.accent }]}
              >
                {capitalize(series.frequency)}
              </ThemedText>
            </View>
            {isCancelled ? (
              <View
                style={[
                  styles.recurringBadge,
                  { backgroundColor: "#9CA3AF" + "22" },
                ]}
              >
                <Feather name="x-circle" size={11} color="#9CA3AF" />
                <ThemedText
                  style={[styles.recurringBadgeText, { color: "#9CA3AF" }]}
                >
                  Cancelled
                </ThemedText>
              </View>
            ) : null}
            {isPaused ? (
              <View
                style={[
                  styles.recurringBadge,
                  { backgroundColor: Colors.warning + "22" },
                ]}
              >
                <Feather name="pause-circle" size={11} color={Colors.warning} />
                <ThemedText
                  style={[styles.recurringBadgeText, { color: Colors.warning }]}
                >
                  Paused
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.detailRow}>
            <Feather name="calendar" size={14} color={theme.textSecondary} />
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}
            >
              Started {formatDate(series.anchorDate)}
              {series.scheduledTime
                ? ` · ${formatTime(series.scheduledTime)}`
                : ""}
            </ThemedText>
          </View>
          {series.estimatedPrice ? (
            <View style={styles.detailRow}>
              <Feather
                name="dollar-sign"
                size={14}
                color={theme.textSecondary}
              />
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}
              >
                ${parseFloat(series.estimatedPrice).toFixed(0)} per visit
              </ThemedText>
            </View>
          ) : null}
          {series.address ? (
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={14} color={theme.textSecondary} />
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}
                numberOfLines={1}
              >
                {series.address}
              </ThemedText>
            </View>
          ) : null}
        </GlassCard>

        {!isCancelled ? (
          <GlassCard style={styles.section}>
            <View style={styles.autopayRow}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  Autopay
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  Auto-charge the client's saved card when each visit's
                  invoice is due. Falls back to a manual invoice if the
                  charge fails.
                </ThemedText>
              </View>
              <Switch
                testID="switch-autopay"
                value={series.autopayEnabled}
                onValueChange={(value) => autopayMutation.mutate(value)}
                disabled={autopayMutation.isPending}
                trackColor={{ true: Colors.accent }}
              />
            </View>
          </GlassCard>
        ) : null}

        {upcoming.length > 0 ? (
          <GlassCard style={styles.section}>
            <ThemedText
              type="label"
              style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}
            >
              UPCOMING ({upcoming.length})
            </ThemedText>
            {upcoming.map((o) => (
              <OccurrenceRow
                key={o.id}
                occurrence={o}
                onPress={() =>
                  navigation.navigate("ProviderJobDetail", { jobId: o.id })
                }
              />
            ))}
          </GlassCard>
        ) : null}

        {past.length > 0 ? (
          <GlassCard style={styles.section}>
            <ThemedText
              type="label"
              style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}
            >
              HISTORY ({past.length})
            </ThemedText>
            {past.slice(0, 20).map((o) => (
              <OccurrenceRow
                key={o.id}
                occurrence={o}
                onPress={() =>
                  navigation.navigate("ProviderJobDetail", { jobId: o.id })
                }
              />
            ))}
          </GlassCard>
        ) : null}

        {occurrences.length === 0 ? (
          <GlassCard style={styles.section}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              No occurrences yet. They will appear here as the schedule fills in.
            </ThemedText>
          </GlassCard>
        ) : null}
      </ScrollView>

      {!isCancelled ? (
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + Spacing.md,
              backgroundColor: theme.backgroundRoot,
            },
          ]}
        >
          {isPaused ? (
            <Pressable
              style={[styles.cancelButton, { borderColor: Colors.accent, marginBottom: Spacing.sm }]}
              onPress={handleResume}
              disabled={resumeMutation.isPending}
              testID="button-resume-series"
            >
              {resumeMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <ThemedText type="body" style={{ color: Colors.accent }}>
                  Resume
                </ThemedText>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={[styles.cancelButton, { borderColor: Colors.warning, marginBottom: Spacing.sm }]}
              onPress={handlePause}
              disabled={pauseMutation.isPending}
              testID="button-pause-series"
            >
              {pauseMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.warning} />
              ) : (
                <ThemedText type="body" style={{ color: Colors.warning }}>
                  Pause
                </ThemedText>
              )}
            </Pressable>
          )}
          <Pressable
            style={[styles.cancelButton, { borderColor: Colors.error }]}
            onPress={handleCancel}
            disabled={cancelMutation.isPending}
            testID="button-cancel-series"
          >
            {cancelMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.error} />
            ) : (
              <ThemedText type="body" style={{ color: Colors.error }}>
                Cancel All Repeats
              </ThemedText>
            )}
          </Pressable>
        </View>
      ) : null}
    </ThemedView>
  );
}

interface OccurrenceRowProps {
  occurrence: ApiOccurrence;
  onPress: () => void;
}

function OccurrenceRow({ occurrence, onPress }: OccurrenceRowProps) {
  const { theme } = useTheme();
  const color = STATUS_COLOR[occurrence.status] || Colors.info;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { borderBottomColor: theme.separator }]}
      testID={`occurrence-row-${occurrence.id}`}
    >
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <ThemedText type="body" style={{ fontWeight: "600" }}>
          {formatDate(occurrence.scheduledDate)}
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {occurrence.scheduledTime
            ? `${formatTime(occurrence.scheduledTime)} · `
            : ""}
          {capitalize(occurrence.status.replace(/_/g, " "))}
        </ThemedText>
      </View>
      {occurrence.finalPrice || occurrence.estimatedPrice ? (
        <ThemedText
          type="body"
          style={{ color: Colors.accent, marginRight: Spacing.sm }}
        >
          $
          {parseFloat(
            occurrence.finalPrice || occurrence.estimatedPrice || "0",
          ).toFixed(0)}
        </ThemedText>
      ) : null}
      <Feather name="chevron-right" size={16} color={theme.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { marginBottom: Spacing.md, padding: Spacing.md },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  recurringBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  recurringBadgeText: { fontSize: 11, fontWeight: "600" },
  autopayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  cancelButton: {
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
