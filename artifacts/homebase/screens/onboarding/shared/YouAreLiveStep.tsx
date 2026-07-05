import React, { useEffect, useState } from "react";
import { StyleSheet, View, ScrollView, Pressable, Share } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

// Shared "You're Live" finale used by both provider onboarding entry points:
// the pre-signup funnel (ProviderOnboardingScreen) and the post-signup flow
// for existing homeowners upgrading to provider (ProviderSetupFlow). Fetches
// the provider's real booking link when available, falling back to a slug
// derived from their business name.
export function YouAreLiveStep({
  businessName,
  providerId,
  onGoToDashboard,
}: {
  businessName: string;
  providerId?: string | null;
  onGoToDashboard: () => void;
}) {
  const { theme } = useTheme();
  const { horizontalPadding } = useLayout();
  const [copied, setCopied] = useState(false);
  const scale = useSharedValue(1);
  const [apiBookingLink, setApiBookingLink] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId) return;
    apiRequest("GET", `/api/providers/${providerId}/booking-links`)
      .then((res) => res.json())
      .then((json) => {
        const links = json.bookingLinks ?? [];
        if (links.length > 0 && links[0].slug) {
          setApiBookingLink(`homebase.app/${links[0].slug}`);
        }
      })
      .catch(() => {});
  }, [providerId]);

  const bookingSlug =
    businessName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") ||
    "your-business";
  const bookingLink = apiBookingLink ?? `homebase.app/${bookingSlug}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(`https://${bookingLink}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = withSequence(
      withSpring(1.08, { damping: 10 }),
      withSpring(1, { damping: 15 })
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `Book ${businessName || "my services"} on HomeBase: https://${bookingLink}`,
        url: `https://${bookingLink}`,
      });
    } catch {
      // ignore
    }
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.stepScrollContent, { paddingHorizontal: horizontalPadding }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.liveContainer}>
        <Animated.View style={[styles.successCircle, { backgroundColor: Colors.accent + "20" }, pulseStyle]}>
          <View style={[styles.successCircleInner, { backgroundColor: Colors.accent }]}>
            <Feather name="check" size={40} color="#fff" />
          </View>
        </Animated.View>

        <ThemedText type="h2" style={[styles.liveTitle, { fontWeight: "700" }]}>
          You're Live
        </ThemedText>
        <ThemedText type="body" style={[styles.liveSubtitle, { color: theme.textSecondary }]}>
          Your booking page is ready. Share your link and get your first booking.
        </ThemedText>
      </View>

      <GlassCard style={styles.card}>
        <ThemedText type="caption" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          Your Booking Link
        </ThemedText>
        <Animated.View
          style={[styles.linkBox, { backgroundColor: theme.backgroundElevated, borderColor: Colors.accent + "40" }, pulseStyle]}
        >
          <Feather name="link" size={16} color={Colors.accent} />
          <ThemedText
            style={{ color: Colors.accent, flex: 1, fontWeight: "500", fontSize: 14 }}
            numberOfLines={1}
          >
            {bookingLink}
          </ThemedText>
        </Animated.View>

        <View style={styles.linkActions}>
          <Pressable
            onPress={handleCopy}
            testID="button-copy-link"
            style={[
              styles.linkBtn,
              { backgroundColor: copied ? Colors.accent + "20" : theme.backgroundElevated, borderColor: copied ? Colors.accent : theme.borderLight },
            ]}
          >
            <Feather name={copied ? "check" : "copy"} size={16} color={copied ? Colors.accent : theme.textSecondary} />
            <ThemedText style={{ color: copied ? Colors.accent : theme.textSecondary, fontWeight: "500", fontSize: 14 }}>
              {copied ? "Copied!" : "Copy Link"}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={handleShare}
            testID="button-share-link"
            style={[styles.linkBtn, { backgroundColor: Colors.accent + "15", borderColor: Colors.accent }]}
          >
            <Feather name="share-2" size={16} color={Colors.accent} />
            <ThemedText style={{ color: Colors.accent, fontWeight: "600", fontSize: 14 }}>
              Share Link
            </ThemedText>
          </Pressable>
        </View>
      </GlassCard>

      <PrimaryButton
        onPress={onGoToDashboard}
        style={{ marginTop: Spacing.lg }}
        testID="button-go-to-dashboard"
      >
        Go to Dashboard
      </PrimaryButton>

      <ThemedText type="caption" style={[styles.dashboardNote, { color: theme.textTertiary }]}>
        Send your link to get your first booking
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  stepScrollContent: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["3xl"],
  },
  card: {
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  fieldLabel: { fontSize: 13, fontWeight: "500", marginBottom: Spacing.sm },
  liveContainer: { alignItems: "center", marginTop: Spacing.xl, marginBottom: Spacing.md },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  successCircleInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  liveTitle: { fontSize: 28, letterSpacing: -0.5, marginBottom: Spacing.sm, textAlign: "center" },
  liveSubtitle: { fontSize: 15, lineHeight: 22, textAlign: "center", paddingHorizontal: Spacing.md },
  linkBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  linkActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  linkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    paddingVertical: Spacing.md,
  },
  dashboardNote: {
    textAlign: "center",
    marginTop: Spacing.md,
  },
});
