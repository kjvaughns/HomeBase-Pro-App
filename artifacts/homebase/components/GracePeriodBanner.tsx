import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Typography } from "@/constants/theme";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export function GracePeriodBanner() {
  const { isInGrace, daysRemainingInGrace } = useSubscriptionStatus();
  const { isDark } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (!isInGrace) return null;

  const days = daysRemainingInGrace ?? 7;
  const isUrgent = days <= 2;

  const bg = isUrgent
    ? isDark
      ? "#3a1f1f"
      : "#fef2f2"
    : isDark
      ? "#3a2f1a"
      : "#fffbeb";
  const border = isUrgent ? "#ef4444" : "#f59e0b";
  const accent = isUrgent ? "#dc2626" : "#b45309";

  const title =
    days === 1 ? "1 day left in your trial" : `${days} days left in your trial`;
  const subtitle = "Tap to subscribe and keep going.";

  const handlePress = () => {
    try {
      navigation.navigate("Subscription");
    } catch {}
  };

  return (
    <Pressable
      style={[styles.banner, { backgroundColor: bg, borderLeftColor: border }]}
      onPress={handlePress}
      testID="banner-grace-period"
    >
      <View style={[styles.iconCircle, { backgroundColor: border + "22" }]}>
        <Feather name="clock" size={18} color={accent} />
      </View>
      <View style={styles.textCol}>
        <ThemedText style={[styles.title, { color: accent }]}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: accent }]}>
          {subtitle}
        </ThemedText>
      </View>
      <Feather name="chevron-right" size={20} color={accent} />
    </Pressable>
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
