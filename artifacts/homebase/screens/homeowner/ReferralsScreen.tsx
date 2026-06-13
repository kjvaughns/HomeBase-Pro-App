import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Share,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";

interface ReferralStats {
  referralCode: string | null;
  referralLink: string;
  referralsCount: number;
  creditsEarnedCents: number;
}

export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<ReferralStats>({
    queryKey: ["/api/users/me/referrals"],
    queryFn: async () => {
      const url = new URL("/api/users/me/referrals", getApiUrl());
      const res = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch referral stats");
      return res.json();
    },
    staleTime: 30_000,
  });

  const referralLink = data?.referralLink ?? "";
  const referralCode = data?.referralCode ?? "";
  const referralsCount = data?.referralsCount ?? 0;
  const creditsEarnedCents = data?.creditsEarnedCents ?? 0;
  const creditsEarned = (creditsEarnedCents / 100).toFixed(0);

  const shareMessage = `Join me on HomeBase — the easiest way to find trusted home service pros near you. Use my link and get $10 off your first booking!\n\n${referralLink}`;

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: shareMessage,
        url: Platform.OS === "ios" ? referralLink : undefined,
      });
    } catch {
      // user dismissed share sheet — no-op
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralLink);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: horizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(400)}>
              <GlassCard style={styles.heroCard}>
                <View style={[styles.iconWrap, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="gift" size={36} color={Colors.accent} />
                </View>
                <ThemedText style={styles.heroTitle}>Invite friends, earn credits</ThemedText>
                <ThemedText style={[styles.heroBody, { color: theme.textSecondary }]}>
                  Give a friend{" "}
                  <ThemedText style={{ fontWeight: "700", color: Colors.accent }}>$10 off</ThemedText>{" "}
                  their first HomeBase booking — and you get{" "}
                  <ThemedText style={{ fontWeight: "700", color: Colors.accent }}>$10 credit</ThemedText>{" "}
                  when they complete it.
                </ThemedText>
              </GlassCard>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
                  <ThemedText style={[styles.statNumber, { color: Colors.accent }]}>
                    {referralsCount}
                  </ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                    Friends referred
                  </ThemedText>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
                  <ThemedText style={[styles.statNumber, { color: Colors.accent }]}>
                    ${creditsEarned}
                  </ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                    Credits earned
                  </ThemedText>
                </View>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                Your referral link
              </ThemedText>

              {referralCode ? (
                <View style={[styles.linkCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
                  <View style={styles.linkRow}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.codeLabel, { color: theme.textSecondary }]}>Code</ThemedText>
                      <ThemedText style={styles.code}>{referralCode}</ThemedText>
                    </View>
                    <Pressable
                      onPress={handleCopy}
                      style={[
                        styles.copyBtn,
                        { backgroundColor: copied ? "#D1FAE5" : Colors.accentLight },
                      ]}
                      testID="button-copy-referral-link"
                    >
                      <Feather
                        name={copied ? "check" : "copy"}
                        size={16}
                        color={copied ? "#065F46" : Colors.accent}
                      />
                      <ThemedText style={[styles.copyBtnText, { color: copied ? "#065F46" : Colors.accent }]}>
                        {copied ? "Copied!" : "Copy link"}
                      </ThemedText>
                    </Pressable>
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

                  <ThemedText
                    style={[styles.linkText, { color: theme.textSecondary }]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {referralLink}
                  </ThemedText>
                </View>
              ) : (
                <View style={[styles.linkCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
                  <ThemedText style={[styles.linkText, { color: theme.textSecondary }]}>
                    Referral link not available yet. Try again shortly.
                  </ThemedText>
                </View>
              )}

              <PrimaryButton
                onPress={handleShare}
                style={{ marginTop: Spacing.md }}
                testID="button-share-referral"
              >
                Share your referral link
              </PrimaryButton>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                How it works
              </ThemedText>
              <View style={[styles.howItWorksCard, { backgroundColor: theme.cardBackground }]}>
                {[
                  { icon: "share-2", text: "Share your referral link with friends" },
                  { icon: "user-plus", text: "Friend signs up using your link" },
                  { icon: "check-circle", text: "Friend completes their first booking" },
                  { icon: "dollar-sign", text: "You both get $10 in HomeBase credits" },
                ].map((step, idx) => (
                  <View key={idx} style={styles.howItWorksRow}>
                    <View style={[styles.stepIcon, { backgroundColor: Colors.accentLight }]}>
                      <Feather name={step.icon as any} size={16} color={Colors.accent} />
                    </View>
                    <ThemedText style={[styles.stepText, { color: theme.textSecondary }]}>
                      {step.text}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  heroCard: {
    alignItems: "center",
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    ...Typography.title2,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  heroBody: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    alignItems: "center",
  },
  statNumber: {
    ...Typography.title1,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  statLabel: {
    ...Typography.caption1,
    textAlign: "center",
  },
  sectionTitle: {
    ...Typography.footnote,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  linkCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  codeLabel: {
    ...Typography.caption1,
    marginBottom: 2,
  },
  code: {
    ...Typography.headline,
    fontWeight: "700",
    letterSpacing: 2,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  copyBtnText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginBottom: Spacing.md,
  },
  linkText: {
    ...Typography.caption1,
    fontStyle: "italic",
  },
  howItWorksCard: {
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  howItWorksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepText: {
    ...Typography.body,
    flex: 1,
  },
});
