import React, { useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Share,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
// react-native-view-shot and expo-sharing are native modules loaded lazily
// inside handleShare so a missing native binary (old EAS build, Expo Go)
// does NOT crash the app at startup when this module is first evaluated.
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type RecapRoute = RouteProp<RootStackParamList, "MonthlyRecap">;

interface RecapData {
  month: string;
  jobsCompleted: number;
  uniqueClients: number;
  totalRevenueCents: number;
  topService: string | null;
  prevJobsCompleted: number;
  prevUniqueClients: number;
  prevTotalRevenueCents: number;
}

function formatDollarsFull(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function Delta({ current, prev, format }: { current: number; prev: number; format: (n: number) => string }) {
  const { theme } = useTheme();
  if (prev === 0 && current === 0) return null;
  if (prev === 0) {
    return (
      <ThemedText style={[styles.deltaText, { color: Colors.accent }]}>
        New this month
      </ThemedText>
    );
  }
  const pct = Math.round(((current - prev) / prev) * 100);
  const up = pct >= 0;
  const color = up ? Colors.accent : "#ef4444";
  return (
    <View style={styles.deltaRow}>
      <Feather name={up ? "trending-up" : "trending-down"} size={13} color={color} />
      <ThemedText style={[styles.deltaText, { color }]}>
        {up ? "+" : ""}{pct}% vs last month ({format(prev)})
      </ThemedText>
    </View>
  );
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.statRow}>
      <View style={[styles.statIcon, { backgroundColor: Colors.accentLight }]}>
        <Feather name={icon as any} size={16} color={Colors.accent} />
      </View>
      <View style={styles.statRowTexts}>
        <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
        <ThemedText style={styles.statValue}>{value}</ThemedText>
      </View>
    </View>
  );
}

export default function MonthlyRecapScreen() {
  const route = useRoute<RecapRoute>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;
  const month = route.params?.month;

  const captureViewRef = useRef<View>(null);

  const { data, isLoading, isError } = useQuery<{ recap: RecapData }>({
    queryKey: ["/api/provider/recap", month],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/provider/recap?month=${month}`);
      if (!res.ok) throw new Error("Failed to load recap");
      return res.json();
    },
    enabled: !!providerId && !!month,
  });

  const recap = data?.recap;

  const handleShare = async () => {
    if (!recap) return;
    const monthLabel = month ? formatMonthLabel(month) : "Monthly Recap";
    try {
      // Lazy-load native modules so the app doesn't crash on startup when
      // running on an old EAS binary or Expo Go that lacks the native bridge.
      let captureRef: ((view: any, opts?: any) => Promise<string>) | null = null;
      let Sharing: { isAvailableAsync: () => Promise<boolean>; shareAsync: (uri: string, opts?: any) => Promise<void> } | null = null;
      try { captureRef = require("react-native-view-shot").captureRef; } catch { /* not linked */ }
      try { Sharing = require("expo-sharing"); } catch { /* not available */ }

      if (captureRef && captureViewRef.current) {
        const uri = await captureRef(captureViewRef, {
          format: "jpg",
          quality: 0.92,
          result: "tmpfile",
        });

        if (Platform.OS === "ios") {
          await Share.share({ url: uri });
        } else {
          const isAvailable = Sharing ? await Sharing.isAvailableAsync() : false;
          if (isAvailable && Sharing) {
            await Sharing.shareAsync(uri, { mimeType: "image/jpeg", dialogTitle: "Share your recap" });
          } else {
            await Share.share({
              message:
                `My ${monthLabel} HomeBase recap 🎉\n` +
                `✅ ${recap.jobsCompleted} jobs completed\n` +
                `👥 ${recap.uniqueClients} clients served\n` +
                `💰 ${formatDollarsFull(recap.totalRevenueCents)} in revenue` +
                (recap.topService ? `\n⭐ Top service: ${recap.topService}` : ""),
            });
          }
        }
      } else {
        // Native module not available — fall back to text share
        await Share.share({
          message:
            `My ${monthLabel} HomeBase recap 🎉\n` +
            `✅ ${recap.jobsCompleted} jobs completed\n` +
            `👥 ${recap.uniqueClients} clients served\n` +
            `💰 ${formatDollarsFull(recap.totalRevenueCents)} in revenue` +
            (recap.topService ? `\n⭐ Top service: ${recap.topService}` : ""),
        });
      }
    } catch {
      // user cancelled or share failed
    }
  };

  const monthLabel = month ? formatMonthLabel(month) : "Monthly Recap";

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.md,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
              Calculating your recap…
            </ThemedText>
          </View>
        ) : isError ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={32} color={theme.textSecondary} />
            <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
              Couldn't load your recap. Pull down to retry.
            </ThemedText>
          </View>
        ) : recap ? (
          <>
            {/* Capturable recap card — this entire view is screenshotted on Share */}
            <Animated.View
              entering={FadeInDown.delay(0).duration(400)}
              ref={captureViewRef}
            >
              <GlassCard style={[styles.recapCard, { backgroundColor: theme.backgroundRoot }]}>
                {/* Header */}
                <View style={[styles.cardHeader, { backgroundColor: Colors.accent }]}>
                  <View style={styles.headerIconBg}>
                    <Feather name="bar-chart-2" size={26} color={Colors.accent} />
                  </View>
                  <ThemedText style={styles.headerTitle}>{monthLabel}</ThemedText>
                  <ThemedText style={styles.headerSubtitle}>Monthly performance recap</ThemedText>
                </View>

                {/* Stats */}
                <View style={styles.statsBlock}>
                  <View style={styles.statItem}>
                    <StatRow
                      icon="check-circle"
                      label="Jobs Completed"
                      value={String(recap.jobsCompleted)}
                    />
                    <Delta
                      current={recap.jobsCompleted}
                      prev={recap.prevJobsCompleted}
                      format={(n) => `${n} job${n !== 1 ? "s" : ""}`}
                    />
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.separator }]} />

                  <View style={styles.statItem}>
                    <StatRow
                      icon="users"
                      label="Clients Served"
                      value={String(recap.uniqueClients)}
                    />
                    <Delta
                      current={recap.uniqueClients}
                      prev={recap.prevUniqueClients}
                      format={(n) => `${n} client${n !== 1 ? "s" : ""}`}
                    />
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.separator }]} />

                  <View style={styles.statItem}>
                    <StatRow
                      icon="dollar-sign"
                      label="Revenue Processed"
                      value={formatDollarsFull(recap.totalRevenueCents)}
                    />
                    <Delta
                      current={recap.totalRevenueCents}
                      prev={recap.prevTotalRevenueCents}
                      format={(n) => formatDollarsFull(n)}
                    />
                  </View>

                  {recap.topService ? (
                    <>
                      <View style={[styles.divider, { backgroundColor: theme.separator }]} />
                      <View style={styles.statItem}>
                        <StatRow
                          icon="star"
                          label="Most-Used Service"
                          value={recap.topService}
                        />
                      </View>
                    </>
                  ) : null}
                </View>

                {/* Watermark */}
                <View style={styles.watermark}>
                  <ThemedText style={[styles.watermarkText, { color: theme.textTertiary }]}>
                    HomeBase
                  </ThemedText>
                </View>
              </GlassCard>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <Pressable
                style={[styles.shareButton, { backgroundColor: Colors.accent }]}
                onPress={handleShare}
                testID="button-share-recap"
              >
                <Feather name="share-2" size={18} color="#fff" />
                <ThemedText style={styles.shareButtonText}>Share My Recap</ThemedText>
              </Pressable>
            </Animated.View>

            {recap.jobsCompleted === 0 && recap.uniqueClients === 0 && recap.totalRevenueCents === 0 ? (
              <Animated.View entering={FadeInDown.delay(300).duration(400)}>
                <View style={[styles.emptyNote, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                  <Feather name="info" size={16} color={theme.textSecondary} />
                  <ThemedText style={[styles.emptyNoteText, { color: theme.textSecondary }]}>
                    No completed jobs or paid invoices found for this month. Data appears once jobs are marked complete or invoices are paid.
                  </ThemedText>
                </View>
              </Animated.View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: Spacing.md,
  },
  recapCard: {
    overflow: "hidden",
    padding: 0,
  },
  cardHeader: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    gap: 4,
  },
  headerIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  statsBlock: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  statItem: {
    gap: 4,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statRowTexts: {
    flex: 1,
    gap: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 40,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginVertical: 2,
  },
  watermark: {
    alignItems: "center",
    paddingBottom: Spacing.md,
  },
  watermarkText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 15,
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  errorText: {
    fontSize: 15,
    textAlign: "center",
  },
  emptyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  emptyNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
