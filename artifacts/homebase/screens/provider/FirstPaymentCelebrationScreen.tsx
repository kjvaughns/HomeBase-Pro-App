import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Dimensions,
  Pressable,
  Modal,
  Share,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/state/authStore";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type ScreenRouteProp = RouteProp<RootStackParamList, "FirstPaymentCelebration">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Simple confetti particle data
interface Particle {
  x: number;
  targetY: number;
  color: string;
  size: number;
  delay: number;
  rotation: number;
}

const CONFETTI_COLORS = [
  Colors.accent,
  "#FFD700",
  "#FF6B6B",
  "#4ECDC4",
  "#A78BFA",
  "#34D399",
  "#F59E0B",
  "#60A5FA",
];

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * SCREEN_W,
    targetY: SCREEN_H * 0.15 + Math.random() * SCREEN_H * 0.6,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + Math.random() * 8,
    delay: Math.random() * 600,
    rotation: Math.random() * 360,
  }));
}

function ConfettiParticle({ particle }: { particle: Particle }) {
  const translateY = useSharedValue(-50);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(particle.rotation);

  useEffect(() => {
    translateY.value = withDelay(
      particle.delay,
      withSpring(particle.targetY, { damping: 8, stiffness: 40 }),
    );
    opacity.value = withDelay(
      particle.delay,
      withSequence(
        withTiming(1, { duration: 200 }),
        withDelay(800, withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) })),
      ),
    );
    rotate.value = withDelay(
      particle.delay,
      withTiming(particle.rotation + 360 * 3, {
        duration: 2000,
        easing: Easing.out(Easing.ease),
      }),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const isCircle = particle.size < 10;

  return (
    <Animated.View
      style={[
        animStyle,
        {
          position: "absolute",
          left: particle.x,
          top: 0,
          width: isCircle ? particle.size : particle.size * 1.6,
          height: particle.size,
          backgroundColor: particle.color,
          borderRadius: isCircle ? particle.size / 2 : 2,
        },
      ]}
    />
  );
}

export default function FirstPaymentCelebrationScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { providerProfile } = useAuthStore();

  const amountCents = route.params?.amountCents ?? 0;
  const providerId = providerProfile?.id;

  const [particles] = useState(() => generateParticles(40));
  const [isMarking, setIsMarking] = useState(false);
  const [showReferralPrompt, setShowReferralPrompt] = useState(false);
  const [referralLink, setReferralLink] = useState<string | null>(null);

  // Trigger haptics on mount
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 300);
  }, []);

  const amountDisplay =
    amountCents > 0
      ? `$${(amountCents / 100).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : null;

  const handleKeepGoing = async () => {
    if (isMarking) return;
    setIsMarking(true);

    // Mark celebration shown on the server
    try {
      await apiRequest("POST", "/api/provider/me/first-payment-celebrated");
      // Invalidate provider data so next fetch reflects firstPaymentCelebrated=true
      if (providerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId] });
        queryClient.invalidateQueries({ queryKey: ["/api/provider/user"] });
      }
    } catch {
      // Non-fatal — if the request fails, the flag just won't persist server-side
      // but the user won't see the screen again this session.
    }

    // Show referral prompt before navigating away — fetch link in background
    try {
      const res = await apiRequest("GET", "/api/providers/me/referral");
      if (res.ok) {
        const data = await res.json();
        setReferralLink(data.shareLink ?? null);
      }
    } catch {
      // Non-fatal — show prompt without pre-fetched link; screen will fetch it
    }
    setIsMarking(false);
    setShowReferralPrompt(true);
  };

  const handleShareReferral = async () => {
    const link = referralLink ?? "https://homebaseproapp.com/signup";
    try {
      await Share.share({
        message: `Join me on HomeBase — the app for managing your home services business. Sign up and we both get a month free!\n\n${link}`,
        url: link,
        title: "Refer a Pro to HomeBase",
      });
    } catch {
      // user dismissed share sheet
    }
  };

  const handleDismissReferral = () => {
    setShowReferralPrompt(false);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Confetti layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particles.map((p, i) => (
          <ConfettiParticle key={i} particle={p} />
        ))}
      </View>

      {/* Content */}
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + Spacing["2xl"], paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        {/* Trophy / star icon */}
        <Animated.View entering={ZoomIn.delay(200).duration(500)} style={styles.iconWrap}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.accentLight }]}>
            <ThemedText style={styles.iconEmoji}>🎉</ThemedText>
          </View>
        </Animated.View>

        {/* Amount */}
        {amountDisplay ? (
          <Animated.View entering={FadeInDown.delay(350).duration(500)}>
            <ThemedText style={styles.amountLabel}>You earned</ThemedText>
            <ThemedText style={styles.amountValue}>{amountDisplay}</ThemedText>
          </Animated.View>
        ) : null}

        {/* Headline */}
        <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.headlineWrap}>
          <ThemedText style={styles.headline}>Your first HomeBase payment</ThemedText>
          <ThemedText style={[styles.subline, { color: theme.textSecondary }]}>
            This is just the beginning. You've got a real business — keep the momentum going.
          </ThemedText>
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeIn.delay(750).duration(500)} style={styles.ctaWrap}>
          <PrimaryButton
            onPress={handleKeepGoing}
            disabled={isMarking}
            testID="button-first-payment-keep-going"
            style={styles.ctaButton}
          >
            Keep going
          </PrimaryButton>
        </Animated.View>
      </View>

      {/* Referral Prompt Bottom Sheet */}
      <Modal
        visible={showReferralPrompt}
        transparent
        animationType="slide"
        onRequestClose={handleDismissReferral}
      >
        <Pressable style={styles.referralOverlay} onPress={handleDismissReferral}>
          <Pressable
            style={[styles.referralSheet, { backgroundColor: theme.backgroundRoot }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.referralHandle} />

            <View style={[styles.referralIconCircle, { backgroundColor: Colors.accentLight }]}>
              <ThemedText style={styles.referralIconEmoji}>🎁</ThemedText>
            </View>

            <ThemedText style={styles.referralTitle}>
              Know another service pro?
            </ThemedText>
            <ThemedText style={[styles.referralBody, { color: theme.textSecondary }]}>
              Give them a month free — and earn one for yourself when they complete their first job.
            </ThemedText>

            <Pressable
              style={[styles.referralShareBtn, { backgroundColor: Colors.accent }]}
              onPress={handleShareReferral}
              testID="button-referral-prompt-share"
            >
              <Feather name="share-2" size={16} color="#fff" />
              <ThemedText style={styles.referralShareBtnText}>Share my link</ThemedText>
            </Pressable>

            <Pressable
              style={styles.referralDismissBtn}
              onPress={handleDismissReferral}
              testID="button-referral-prompt-dismiss"
            >
              <ThemedText style={[styles.referralDismissText, { color: theme.textSecondary }]}>
                Not now
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  iconWrap: {
    marginBottom: Spacing.sm,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: {
    fontSize: 52,
    lineHeight: 60,
  },
  amountLabel: {
    ...Typography.subhead,
    textAlign: "center",
    opacity: 0.7,
    marginBottom: Spacing.xs,
  },
  amountValue: {
    fontSize: 56,
    fontWeight: "800",
    textAlign: "center",
    color: Colors.accent,
    letterSpacing: -1,
  },
  headlineWrap: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  headline: {
    ...Typography.title2,
    fontWeight: "700",
    textAlign: "center",
  },
  subline: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  ctaWrap: {
    width: "100%",
    marginTop: Spacing.md,
  },
  ctaButton: {
    width: "100%",
  },
  referralOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  referralSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["2xl"],
    paddingTop: Spacing.md,
    alignItems: "center",
    gap: Spacing.md,
  },
  referralHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
    marginBottom: Spacing.sm,
  },
  referralIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  referralIconEmoji: {
    fontSize: 36,
    lineHeight: 42,
  },
  referralTitle: {
    ...Typography.title3,
    fontWeight: "700",
    textAlign: "center",
  },
  referralBody: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  referralShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.button,
    paddingVertical: 14,
    width: "100%",
    marginTop: Spacing.xs,
  },
  referralShareBtnText: {
    ...Typography.callout,
    fontWeight: "700",
    color: "#fff",
  },
  referralDismissBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  referralDismissText: {
    ...Typography.callout,
    textAlign: "center",
  },
});
