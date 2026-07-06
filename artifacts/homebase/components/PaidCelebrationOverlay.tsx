import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  withSequence,
  Easing,
  FadeOut,
  ZoomIn,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "./ThemedText";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useCelebrationStore } from "@/state/celebrationStore";

const { width: SCREEN_W } = Dimensions.get("window");
const VISIBLE_MS = 2200;

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
];

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * SCREEN_W,
    targetY: 120 + Math.random() * 160,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 5 + Math.random() * 6,
    delay: Math.random() * 250,
    rotation: Math.random() * 360,
  }));
}

function ConfettiParticle({ particle }: { particle: Particle }) {
  const translateY = useSharedValue(-30);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(particle.rotation);

  useEffect(() => {
    translateY.value = withDelay(
      particle.delay,
      withSpring(particle.targetY, { damping: 9, stiffness: 45 }),
    );
    opacity.value = withDelay(
      particle.delay,
      withSequence(
        withTiming(1, { duration: 150 }),
        withDelay(700, withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) })),
      ),
    );
    rotate.value = withDelay(
      particle.delay,
      withTiming(particle.rotation + 360 * 2, { duration: 1400, easing: Easing.out(Easing.ease) }),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate: `${rotate.value}deg` }],
    opacity: opacity.value,
  }));

  const isCircle = particle.size < 8;

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

// Task #490: brief in-place celebration shown whenever an invoice/payment
// flips to "paid" — regardless of which screen triggers it (mark-paid
// button, a manual payment that completes the balance, or a homeowner
// finishing Stripe Checkout while the provider is elsewhere in the app).
// Mounted once at the app root; auto-dismisses after VISIBLE_MS.
export function PaidCelebrationOverlay() {
  const { theme } = useTheme();
  const celebration = useCelebrationStore((s) => s.celebration);
  const clearCelebration = useCelebrationStore((s) => s.clearCelebration);
  const [particles, setParticles] = useState<Particle[]>([]);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!celebration) return;
    setParticles(generateParticles(24));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, 250);

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => clearCelebration(), VISIBLE_MS);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [celebration?.key]);

  if (!celebration) return null;

  const amountDisplay =
    celebration.amountCents > 0
      ? `$${(celebration.amountCents / 100).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="overlay-paid-celebration">
      {particles.map((p, i) => (
        <ConfettiParticle key={`${celebration.key}-${i}`} particle={p} />
      ))}
      <Animated.View
        entering={ZoomIn.duration(350)}
        exiting={FadeOut.duration(300)}
        style={styles.toastWrap}
      >
        <View style={[styles.toast, { backgroundColor: theme.cardBackground, shadowColor: "#000" }]}>
          <ThemedText style={styles.emoji}>🎉</ThemedText>
          <View>
            <ThemedText style={styles.title}>You got paid!</ThemedText>
            {amountDisplay ? (
              <ThemedText style={[styles.amount, { color: Colors.accent }]}>
                {amountDisplay}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: "absolute",
    top: 90,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg ?? 20,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  emoji: { fontSize: 30, lineHeight: 34 },
  title: { ...Typography.subhead, fontWeight: "700" },
  amount: { ...Typography.title3, fontWeight: "800", marginTop: 2 },
});
