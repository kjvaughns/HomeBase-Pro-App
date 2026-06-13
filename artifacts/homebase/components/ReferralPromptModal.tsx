import React, { useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Share,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";
import { useAuthStore } from "@/state/authStore";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

interface ReferralStats {
  referralCode: string | null;
  referralLink: string;
  referralsCount: number;
  creditsEarnedCents: number;
}

export function ReferralPromptModal({ visible, onDismiss }: Props) {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuthStore();
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
    enabled: visible && isAuthenticated,
    staleTime: 60_000,
  });

  const referralLink = data?.referralLink ?? "";
  const referralCode = data?.referralCode ?? "";

  const shareMessage = `Join me on HomeBase — the easiest way to find trusted home service pros near you. Use my link and get $10 off your first booking!\n\n${referralLink}`;

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({ message: shareMessage, url: Platform.OS === "ios" ? referralLink : undefined });
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.cardBackground }]}>
          <View style={[styles.iconWrap, { backgroundColor: Colors.accentLight }]}>
            <Feather name="gift" size={32} color={Colors.accent} />
          </View>

          <ThemedText style={styles.title}>Love how easy that was?</ThemedText>
          <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
            Give a friend{" "}
            <ThemedText style={{ fontWeight: "700", color: Colors.accent }}>$10 off</ThemedText>{" "}
            their first HomeBase booking — and get{" "}
            <ThemedText style={{ fontWeight: "700", color: Colors.accent }}>$10 credit</ThemedText>{" "}
            yourself when they book.
          </ThemedText>

          {isLoading ? (
            <ActivityIndicator color={Colors.accent} style={{ marginVertical: Spacing.lg }} />
          ) : referralCode ? (
            <>
              <View style={[styles.codeBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight }]}>
                <View>
                  <ThemedText style={[styles.codeLabel, { color: theme.textSecondary }]}>Your referral code</ThemedText>
                  <ThemedText style={styles.code}>{referralCode}</ThemedText>
                </View>
                <Pressable
                  onPress={handleCopy}
                  style={[styles.copyBtn, { backgroundColor: copied ? "#D1FAE5" : Colors.accentLight }]}
                  testID="button-copy-referral-link"
                >
                  <Feather
                    name={copied ? "check" : "copy"}
                    size={16}
                    color={copied ? "#065F46" : Colors.accent}
                  />
                  <ThemedText style={[styles.copyText, { color: copied ? "#065F46" : Colors.accent }]}>
                    {copied ? "Copied!" : "Copy link"}
                  </ThemedText>
                </Pressable>
              </View>

              <PrimaryButton
                onPress={handleShare}
                style={styles.shareBtn}
                testID="button-share-referral"
              >
                Share with friends
              </PrimaryButton>
            </>
          ) : null}

          <Pressable onPress={onDismiss} style={styles.skipBtn} testID="button-skip-referral">
            <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
              Maybe later
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    paddingBottom: Spacing["2xl"],
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.title2,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  body: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
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
  copyText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  shareBtn: {
    width: "100%",
    marginBottom: Spacing.sm,
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  skipText: {
    ...Typography.subhead,
  },
});
