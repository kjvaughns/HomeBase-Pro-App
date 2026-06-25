import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { useOnboardingStore } from "@/state/onboardingStore";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

function currentMonthStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function prevMonthStr(): string {
  const now = new Date();
  const m = now.getMonth();
  const y = m === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const pm = m === 0 ? 12 : m;
  return `${y}-${String(pm).padStart(2, "0")}`;
}

function dayOfMonth(): number {
  return new Date().getDate();
}

function prevMonthLabel(): string {
  const now = new Date();
  const m = now.getMonth();
  const y = m === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const date = new Date(y, m === 0 ? 11 : m - 1, 1);
  return date.toLocaleString("en-US", { month: "long" });
}

export function RecapCard() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const recapDismissedMonths = useOnboardingStore((s) => s.recapDismissedMonths);
  const dismissRecap = useOnboardingStore((s) => s.dismissRecap);

  const day = dayOfMonth();
  const thisMonth = currentMonthStr();
  const targetMonth = prevMonthStr();

  if (day > 3) return null;
  if (recapDismissedMonths.includes(thisMonth)) return null;

  const handleOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("MonthlyRecap", { month: targetMonth });
  };

  const handleDismiss = () => {
    Haptics.selectionAsync();
    dismissRecap(thisMonth);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(60).duration(400)}
      exiting={FadeOutUp.duration(300)}
    >
      <Pressable onPress={handleOpen} testID="card-monthly-recap">
        <GlassCard
          style={[
            styles.card,
            { borderColor: Colors.accent + "33", borderWidth: 1 },
          ]}
        >
          <View style={styles.row}>
            <View style={[styles.iconBg, { backgroundColor: Colors.accentLight }]}>
              <Feather name="bar-chart-2" size={20} color={Colors.accent} />
            </View>
            <View style={styles.textBlock}>
              <ThemedText style={styles.title}>
                Your {prevMonthLabel()} recap is ready 🎉
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
                See your jobs, clients, and revenue
              </ThemedText>
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={(e) => { e.stopPropagation(); handleDismiss(); }}
                hitSlop={12}
                testID="button-dismiss-recap-card"
                style={styles.dismissBtn}
              >
                <Feather name="x" size={16} color={theme.textSecondary} />
              </Pressable>
              <Feather name="chevron-right" size={18} color={Colors.accent} />
            </View>
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  dismissBtn: {
    padding: 4,
  },
});
