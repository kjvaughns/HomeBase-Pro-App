import React, { useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Share,
  Alert,
  ActivityIndicator,
  Pressable,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { apiRequest } from "@/lib/query-client";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";

interface ReferralEntry {
  id: string;
  referredProviderId: string;
  businessName: string;
  signedUpAt: string;
  firstJobCompletedAt: string | null;
  rewardGrantedAt: string | null;
  status: "signed_up" | "converted" | "rewarded";
}

interface ReferralData {
  referralCode: string;
  shareLink: string;
  referrals: ReferralEntry[];
}

export default function ReferAProScreen() {
  const { theme } = useTheme();
  const { horizontalPadding } = useLayout();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useFloatingTabBarHeight();

  const { data, isLoading, error } = useQuery<ReferralData>({
    queryKey: ["/api/providers/me/referral"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/providers/me/referral");
      if (!res.ok) throw new Error("Failed to load referral info");
      return res.json();
    },
  });

  const handleCopy = useCallback(async () => {
    if (!data?.referralCode) return;
    await Clipboard.setStringAsync(data.referralCode);
    Alert.alert("Copied!", `Your referral code ${data.referralCode} has been copied.`);
  }, [data?.referralCode]);

  const handleShare = useCallback(async () => {
    if (!data) return;
    try {
      await Share.share({
        message:
          `Join me on HomeBase — the app for managing your home services business. Sign up with my code ${data.referralCode} and we both benefit!\n\n${data.shareLink}`,
        url: data.shareLink,
        title: "Refer a Pro to HomeBase",
      });
    } catch {
      // user dismissed the share sheet — no-op
    }
  }, [data]);

  const rewarded = data?.referrals.filter((r) => r.status === "rewarded").length ?? 0;
  const converted = data?.referrals.filter((r) => r.status !== "signed_up").length ?? 0;
  const total = data?.referrals.length ?? 0;

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
      >
        {isLoading ? (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.accent} />
          </Animated.View>
        ) : error ? (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.errorContainer}>
            <Feather name="alert-circle" size={24} color={theme.textSecondary} />
            <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
              Could not load referral info. Pull to refresh.
            </ThemedText>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.delay(0).duration(220)}>
              <GlassCard style={styles.heroCard}>
                <View style={styles.heroIconRow}>
                  <View style={[styles.heroIcon, { backgroundColor: Colors.accent + "22" }]}>
                    <Feather name="gift" size={28} color={Colors.accent} />
                  </View>
                </View>
                <ThemedText style={styles.heroTitle}>Refer a Pro, Earn a Month Free</ThemedText>
                <ThemedText style={[styles.heroBody, { color: theme.textSecondary }]}>
                  Share your code with other service pros. When they sign up and complete their first job,
                  you automatically earn 30 days free on your HomeBase subscription.
                </ThemedText>
              </GlassCard>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(50).duration(220)}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                Your Referral Code
              </ThemedText>
              <View style={[styles.codeCard, { backgroundColor: theme.cardBackground }]}>
                <ThemedText style={[styles.codeText, { color: theme.text }]}>
                  {data?.referralCode ?? "—"}
                </ThemedText>
                <Pressable
                  onPress={handleCopy}
                  style={({ pressed }) => [
                    styles.copyBtn,
                    { backgroundColor: Colors.accent + (pressed ? "33" : "18") },
                  ]}
                  accessibilityLabel="Copy referral code"
                  accessibilityRole="button"
                  testID="btn-copy-code"
                >
                  <Feather name="copy" size={16} color={Colors.accent} />
                  <ThemedText style={[styles.copyLabel, { color: Colors.accent }]}>Copy</ThemedText>
                </Pressable>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).duration(220)}>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.shareBtn,
                  { backgroundColor: pressed ? Colors.accent + "DD" : Colors.accent },
                ]}
                accessibilityLabel="Share referral link"
                accessibilityRole="button"
                testID="btn-share-referral"
              >
                <Feather name="share-2" size={18} color="#fff" />
                <ThemedText style={styles.shareBtnText}>Share Invite Link</ThemedText>
              </Pressable>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(110).duration(220)}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                Your Impact
              </ThemedText>
              <View style={[styles.statsRow]}>
                <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
                  <ThemedText style={[styles.statNumber, { color: theme.text }]}>{total}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Referred</ThemedText>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
                  <ThemedText style={[styles.statNumber, { color: theme.text }]}>{converted}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>First Job</ThemedText>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
                  <ThemedText style={[styles.statNumber, { color: Colors.accent }]}>{rewarded}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Free Months</ThemedText>
                </View>
              </View>
            </Animated.View>

            {total > 0 ? (
              <Animated.View entering={FadeInDown.delay(140).duration(220)}>
                <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                  Referral History
                </ThemedText>
                <View style={[styles.listCard, { backgroundColor: theme.cardBackground }]}>
                  {data!.referrals.map((r, i) => (
                    <ReferralRow
                      key={r.id}
                      referral={r}
                      isLast={i === data!.referrals.length - 1}
                      theme={theme}
                    />
                  ))}
                </View>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.delay(140).duration(220)}>
                <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground }]}>
                  <Feather name="users" size={32} color={theme.textTertiary} />
                  <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
                    No referrals yet
                  </ThemedText>
                  <ThemedText style={[styles.emptyBody, { color: theme.textSecondary }]}>
                    Share your code with other pros and you'll see them appear here.
                  </ThemedText>
                </View>
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(160).duration(220)}>
              <View style={[styles.howCard, { backgroundColor: theme.cardBackground }]}>
                <ThemedText style={[styles.howTitle, { color: theme.text }]}>How it works</ThemedText>
                {HOW_STEPS.map((step, i) => (
                  <View key={i} style={styles.howRow}>
                    <View style={[styles.howStep, { backgroundColor: Colors.accent + "22" }]}>
                      <ThemedText style={[styles.howStepNum, { color: Colors.accent }]}>
                        {i + 1}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.howText, { color: theme.textSecondary }]}>
                      {step}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const HOW_STEPS = [
  "Share your referral code or link with another service professional.",
  "They sign up for HomeBase as a provider using your code.",
  "After they complete their first job, you earn 30 days free — automatically.",
];

function statusColor(status: ReferralEntry["status"], accent: string) {
  if (status === "rewarded") return accent;
  if (status === "converted") return Colors.warning;
  return "#8E8E93";
}

function statusLabel(status: ReferralEntry["status"]) {
  if (status === "rewarded") return "Reward earned";
  if (status === "converted") return "First job done";
  return "Signed up";
}

interface ReferralRowProps {
  referral: ReferralEntry;
  isLast: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
}

function ReferralRow({ referral, isLast, theme }: ReferralRowProps) {
  const { theme: t } = useTheme();
  const color = statusColor(referral.status, Colors.accent);
  const label = statusLabel(referral.status);
  const date = new Date(referral.signedUpAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View
      style={[
        styles.referralRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator },
      ]}
    >
      <View style={styles.referralLeft}>
        <ThemedText style={[styles.referralName, { color: theme.text }]} numberOfLines={1}>
          {referral.businessName}
        </ThemedText>
        <ThemedText style={[styles.referralDate, { color: theme.textTertiary }]}>
          Joined {date}
        </ThemedText>
      </View>
      <View style={[styles.statusPill, { backgroundColor: color + "22" }]}>
        <ThemedText style={[styles.statusLabel, { color }]}>{label}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: Spacing["2xl"],
  },
  errorContainer: {
    alignItems: "center",
    paddingTop: Spacing["2xl"],
    gap: Spacing.sm,
  },
  errorText: {
    ...Typography.subhead,
    textAlign: "center",
  },
  heroCard: {
    marginBottom: Spacing.xl,
    alignItems: "center",
  },
  heroIconRow: {
    marginBottom: Spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    ...Typography.title3,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  heroBody: {
    ...Typography.subhead,
    textAlign: "center",
    lineHeight: 20,
  },
  sectionTitle: {
    ...Typography.footnote,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  codeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: BorderRadius.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  codeText: {
    ...Typography.title2,
    fontWeight: "700",
    letterSpacing: 3,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
  },
  copyLabel: {
    ...Typography.callout,
    fontWeight: "600",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.button,
    paddingVertical: 14,
    marginBottom: Spacing.xl,
  },
  shareBtnText: {
    ...Typography.callout,
    fontWeight: "700",
    color: "#fff",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.card,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  statNumber: {
    ...Typography.title2,
    fontWeight: "700",
  },
  statLabel: {
    ...Typography.caption1,
    marginTop: 2,
  },
  listCard: {
    borderRadius: BorderRadius.card,
    overflow: "hidden",
    marginBottom: Spacing.xl,
  },
  referralRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  referralLeft: {
    flex: 1,
  },
  referralName: {
    ...Typography.callout,
    fontWeight: "600",
  },
  referralDate: {
    ...Typography.caption1,
    marginTop: 2,
  },
  statusPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  statusLabel: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  emptyCard: {
    borderRadius: BorderRadius.card,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.callout,
    fontWeight: "600",
  },
  emptyBody: {
    ...Typography.subhead,
    textAlign: "center",
  },
  howCard: {
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  howTitle: {
    ...Typography.callout,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  howRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  howStep: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  howStepNum: {
    ...Typography.subhead,
    fontWeight: "700",
  },
  howText: {
    ...Typography.subhead,
    flex: 1,
    lineHeight: 20,
  },
});
