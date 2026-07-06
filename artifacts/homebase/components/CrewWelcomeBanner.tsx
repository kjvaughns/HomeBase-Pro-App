import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Colors, Spacing, Typography } from "@/constants/theme";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useAuthStore } from "@/state/authStore";

function getSeenKey(providerId: string) {
  return `crew_welcome_seen_${providerId}`;
}

export function CrewWelcomeBanner() {
  const { data, isFree, isInGrace, isSubscribed } = useSubscriptionStatus();
  const { isDark } = useTheme();
  const providerId = useAuthStore((s) => s.providerProfile?.id ?? null);
  const [dismissed, setDismissed] = useState(true);

  const isCrewGraduate = !!data?.isCrewGraduate;

  useEffect(() => {
    if (!providerId || !isCrewGraduate) return;
    AsyncStorage.getItem(getSeenKey(providerId)).then((val) => {
      if (val !== "1") setDismissed(false);
    });
  }, [providerId, isCrewGraduate]);

  const handleDismiss = async () => {
    setDismissed(true);
    if (providerId) {
      await AsyncStorage.setItem(getSeenKey(providerId), "1");
    }
  };

  if (!isCrewGraduate) return null;
  if (isSubscribed) return null;
  if (!isFree && !isInGrace) return null;
  if (dismissed) return null;

  const bg = isDark ? "#1a2f1a" : "#f0fdf4";
  const border = Colors.success;
  const accent = Colors.success;

  return (
    <View
      style={[styles.banner, { backgroundColor: bg, borderLeftColor: border }]}
      testID="banner-crew-welcome"
    >
      <View style={[styles.iconCircle, { backgroundColor: border + "33" }]}>
        <Feather name="users" size={18} color={accent} />
      </View>
      <View style={styles.textCol}>
        <ThemedText style={[styles.title, { color: accent }]}>
          Crew Member Welcome — 3 months free
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: accent }]}>
          As a thank-you for being part of a HomeBase team, your first 90 days are on us.
        </ThemedText>
      </View>
      <Pressable
        onPress={handleDismiss}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        testID="banner-crew-welcome-dismiss"
      >
        <Feather name="x" size={18} color={accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    borderLeftWidth: 4,
    marginHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1 },
  title: { ...Typography.subhead, fontWeight: "700" },
  subtitle: { ...Typography.caption1, marginTop: 2, opacity: 0.85 },
});
