import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useLayout } from "@/hooks/useLayout";
import { Feather, Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { MilestoneBadge, type BadgeType } from "@/components/MilestoneBadge";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";

interface BadgeRow {
  badgeType: BadgeType;
  earnedAt: string;
}

interface MilestoneRow {
  key: string;
  label: string;
  description: string;
  progress: number;
  target: number;
  rewardLabel: string;
  earned: boolean;
}

interface AchievementsStats {
  completedJobs: number;
  totalRevenueCents: number;
  referralCount: number;
  hasFiveStar: boolean;
  hasFeaturedPlacement: boolean;
  permanentDiscountPercent: number;
}

interface AchievementsResponse {
  badges: BadgeRow[];
  stats: AchievementsStats;
  nextMilestones: MilestoneRow[];
}

function fmtRevenue(cents: number): string {
  const d = cents / 100;
  if (d >= 1000) return `$${(d / 1000).toFixed(1)}K`;
  return `$${d.toFixed(0)}`;
}

function ProgressBar({ progress, target }: { progress: number; target: number }) {
  const { theme } = useTheme();
  const pct = target > 0 ? Math.min(progress / target, 1) : 1;
  return (
    <View style={[progressStyles.track, { backgroundColor: theme.backgroundTertiary }]}>
      <View style={[progressStyles.fill, { width: `${pct * 100}%` as any }]} />
    </View>
  );
}

const progressStyles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: Spacing.sm,
  },
  fill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
});

function StatCell({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={statStyles.cell}>
      <Feather name={icon as any} size={18} color={color} />
      <ThemedText style={[statStyles.value, { color: theme.text }]}>{value}</ThemedText>
      <ThemedText style={[statStyles.label, { color: theme.textTertiary }]}>{label}</ThemedText>
    </View>
  );
}

const statStyles = StyleSheet.create({
  cell: { flex: 1, alignItems: "center", gap: 4 },
  value: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 11, textAlign: "center" },
});

function MilestoneItem({ milestone, isLast, theme }: { milestone: MilestoneRow; isLast: boolean; theme: any }) {
  const progressLabel =
    milestone.key === "10k_revenue"
      ? `${fmtRevenue(milestone.progress)} of ${fmtRevenue(milestone.target)}`
      : milestone.target === 1
      ? milestone.earned
        ? "Earned"
        : "Not yet"
      : `${milestone.progress} of ${milestone.target}`;

  return (
    <View
      style={[
        milestoneStyles.row,
        !isLast
          ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator }
          : null,
      ]}
    >
      <View style={milestoneStyles.iconWrap}>
        {milestone.earned ? (
          <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
        ) : (
          <Ionicons name="ellipse-outline" size={22} color={theme.textTertiary} />
        )}
      </View>
      <View style={milestoneStyles.content}>
        <View style={milestoneStyles.titleRow}>
          <ThemedText style={[milestoneStyles.label, { color: milestone.earned ? theme.textSecondary : theme.text }]}>
            {milestone.label}
          </ThemedText>
          <ThemedText
            style={[
              milestoneStyles.progressLabel,
              { color: milestone.earned ? Colors.accent : theme.textTertiary },
            ]}
          >
            {progressLabel}
          </ThemedText>
        </View>
        <ThemedText style={[milestoneStyles.desc, { color: theme.textSecondary }]}>
          {milestone.description}
        </ThemedText>
        <ThemedText style={[milestoneStyles.reward, { color: theme.textTertiary }]}>
          Reward: {milestone.rewardLabel}
        </ThemedText>
        {!milestone.earned && milestone.target > 1 && (
          <ProgressBar progress={milestone.progress} target={milestone.target} />
        )}
      </View>
    </View>
  );
}

const milestoneStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.cardPadding,
    gap: Spacing.md,
  },
  iconWrap: { paddingTop: 1 },
  content: { flex: 1, gap: 2 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  label: { fontSize: 14, fontWeight: "600", flex: 1 },
  progressLabel: { fontSize: 12, fontWeight: "600" },
  desc: { fontSize: 13 },
  reward: { fontSize: 12, fontStyle: "italic" },
});

export default function AchievementsScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const { horizontalPadding } = useLayout();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;

  const { data, isLoading } = useQuery<AchievementsResponse>({
    queryKey: ["/api/provider", providerId, "achievements"],
    enabled: !!providerId,
    queryFn: async () => {
      const url = new URL(`/api/provider/${providerId}/achievements`, getApiUrl());
      const res = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load achievements");
      return res.json();
    },
  });

  const badges = data?.badges ?? [];
  const stats = data?.stats;
  const milestones = data?.nextMilestones ?? [];
  const pendingMilestones = milestones.filter((m) => !m.earned);
  const earnedMilestones = milestones.filter((m) => m.earned);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: horizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(0).duration(220)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Your Stats
          </ThemedText>
          <GlassCard style={styles.statsCard}>
            <View style={styles.statsGrid}>
              <StatCell icon="briefcase" label="Jobs Done" value={String(stats?.completedJobs ?? 0)} color={Colors.accent} />
              <StatCell icon="dollar-sign" label="Revenue" value={fmtRevenue(stats?.totalRevenueCents ?? 0)} color={theme.badgeGold} />
              <StatCell icon="users" label="Referrals" value={String(stats?.referralCount ?? 0)} color={theme.badgePurple} />
              <StatCell icon="star" label="5-Star" value={stats?.hasFiveStar ? "Yes" : "No"} color={Colors.warning} />
            </View>
            {stats?.hasFeaturedPlacement ? (
              <View style={[styles.banner, { backgroundColor: `${Colors.accent}18` }]}>
                <Ionicons name="search" size={14} color={Colors.accent} />
                <ThemedText style={[styles.bannerText, { color: Colors.accent }]}>
                  Featured in homeowner search results
                </ThemedText>
              </View>
            ) : null}
            {(stats?.permanentDiscountPercent ?? 0) > 0 ? (
              <View style={[styles.banner, { backgroundColor: `${theme.badgePurple}26`, marginTop: Spacing.sm }]}>
                <Ionicons name="pricetag" size={14} color={theme.badgePurple} />
                <ThemedText style={[styles.bannerText, { color: theme.badgePurple }]}>
                  {stats!.permanentDiscountPercent}% permanent subscription discount
                </ThemedText>
              </View>
            ) : null}
          </GlassCard>
        </Animated.View>

        {/* Earned badges */}
        <Animated.View entering={FadeInDown.delay(40).duration(220)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Badges
          </ThemedText>
          {isLoading ? (
            <GlassCard style={styles.emptyCard}>
              <ThemedText style={[styles.emptyText, { color: theme.textTertiary }]}>Loading…</ThemedText>
            </GlassCard>
          ) : badges.length > 0 ? (
            <GlassCard>
              {badges.map((b, i) => (
                <View
                  key={b.badgeType}
                  style={[
                    styles.badgeRow,
                    i < badges.length - 1
                      ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator }
                      : null,
                  ]}
                >
                  <MilestoneBadge badgeType={b.badgeType} />
                  <ThemedText style={[styles.earnedDate, { color: theme.textTertiary }]}>
                    {new Date(b.earnedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </ThemedText>
                </View>
              ))}
            </GlassCard>
          ) : (
            <GlassCard style={styles.emptyCard}>
              <Ionicons name="ribbon-outline" size={32} color={theme.textTertiary} />
              <ThemedText style={[styles.emptyText, { color: theme.textTertiary }]}>
                Complete milestones to earn badges
              </ThemedText>
            </GlassCard>
          )}
        </Animated.View>

        {/* Milestones */}
        <Animated.View entering={FadeInDown.delay(80).duration(220)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Milestones
          </ThemedText>

          {pendingMilestones.length > 0 && (
            <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
              {pendingMilestones.map((m, i) => (
                <MilestoneItem
                  key={m.key}
                  milestone={m}
                  isLast={i === pendingMilestones.length - 1}
                  theme={theme}
                />
              ))}
            </View>
          )}

          {earnedMilestones.length > 0 && (
            <>
              <ThemedText style={[styles.subTitle, { color: theme.textTertiary }]}>
                Completed
              </ThemedText>
              <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                {earnedMilestones.map((m, i) => (
                  <MilestoneItem
                    key={m.key}
                    milestone={m}
                    isLast={i === earnedMilestones.length - 1}
                    theme={theme}
                  />
                ))}
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  subTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  statsCard: { padding: Spacing.cardPadding },
  statsGrid: { flexDirection: "row", justifyContent: "space-between" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.md,
  },
  bannerText: { fontSize: 12, fontWeight: "600" },
  section: { borderRadius: BorderRadius.card, overflow: "hidden" },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.cardPadding,
  },
  earnedDate: { fontSize: 12 },
  emptyCard: { alignItems: "center", padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: 14, textAlign: "center" },
});
