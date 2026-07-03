import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Colors, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

import { type BadgeType } from "@/state/types";
export type { BadgeType } from "@/state/types";

function getBadgeConfig(
  theme: ReturnType<typeof useTheme>["theme"]
): Record<BadgeType, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> {
  return {
    verified_pro: {
      label: "Verified Pro",
      icon: "shield-checkmark",
      color: theme.buttonText,
      bg: Colors.accent,
    },
    top_provider: {
      label: "Top Provider",
      icon: "trophy",
      color: theme.buttonText,
      bg: theme.badgeGold,
    },
    first_job: {
      label: "First Job",
      icon: "briefcase",
      color: theme.buttonText,
      bg: theme.badgeBlue,
    },
    first_thousand: {
      label: "First $1K",
      icon: "cash",
      color: theme.buttonText,
      bg: theme.badgeEmerald,
    },
    ten_clients: {
      label: "10 Clients",
      icon: "people",
      color: theme.buttonText,
      bg: theme.badgePurple,
    },
    twenty_five_jobs: {
      label: "25 Jobs",
      icon: "checkmark-done-circle",
      color: theme.buttonText,
      bg: theme.badgeTeal,
    },
    first_recurring: {
      label: "Recurring Pro",
      icon: "repeat",
      color: theme.buttonText,
      bg: theme.badgeOrange,
    },
    first_five_star: {
      label: "5-Star",
      icon: "star",
      color: theme.buttonText,
      bg: theme.badgeAmber,
    },
  };
}

interface MilestoneBadgeProps {
  badgeType: BadgeType;
  size?: "small" | "default";
  testID?: string;
}

export function MilestoneBadge({ badgeType, size = "default", testID }: MilestoneBadgeProps) {
  const { theme } = useTheme();
  const cfg = getBadgeConfig(theme)[badgeType];
  if (!cfg) return null;

  const isSmall = size === "small";
  const iconSize = isSmall ? 11 : 13;

  return (
    <View
      testID={testID ?? `badge-${badgeType}`}
      style={[
        styles.pill,
        {
          backgroundColor: cfg.bg,
          paddingVertical: isSmall ? Spacing.xxs : Spacing.xs,
          paddingHorizontal: isSmall ? Spacing.sm : Spacing.md,
        },
      ]}
    >
      <Ionicons name={cfg.icon} size={iconSize} color={cfg.color} />
      <ThemedText
        style={[
          styles.label,
          {
            fontSize: isSmall ? 11 : 12,
            color: cfg.color,
          },
        ]}
      >
        {cfg.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
  },
  label: {
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
