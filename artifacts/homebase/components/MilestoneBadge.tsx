import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Colors, Spacing } from "@/constants/theme";

import { type BadgeType } from "@/state/types";
export type { BadgeType } from "@/state/types";

const BADGE_CONFIG: Record<
  BadgeType,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  verified_pro: {
    label: "Verified Pro",
    icon: "shield-checkmark",
    color: "#FFFFFF",
    bg: Colors.accent,
  },
  top_provider: {
    label: "Top Provider",
    icon: "trophy",
    color: "#FFFFFF",
    bg: "#C07A00",
  },
};

interface MilestoneBadgeProps {
  badgeType: BadgeType;
  size?: "small" | "default";
  testID?: string;
}

export function MilestoneBadge({ badgeType, size = "default", testID }: MilestoneBadgeProps) {
  const cfg = BADGE_CONFIG[badgeType];
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
