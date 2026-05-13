import React from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Colors, Typography } from "@/constants/theme";

export type StatusType = "success" | "warning" | "error" | "info" | "neutral" | "pending" | "scheduled" | "inProgress" | "completed" | "cancelled";

interface StatusPillProps {
  status: StatusType;
  label: string;
  size?: "small" | "default";
}

const getStatusColors = (status: StatusType): { bg: string; text: string } => {
  switch (status) {
    case "success":
    case "completed":
      return { bg: Colors.successLight, text: Colors.success };
    case "warning":
    case "pending":
      return { bg: Colors.warningLight, text: Colors.warning };
    case "error":
    case "cancelled":
      return { bg: Colors.errorLight, text: Colors.error };
    case "info":
    case "scheduled":
      return { bg: Colors.infoLight, text: Colors.info };
    case "inProgress":
      return { bg: Colors.accentLight, text: Colors.accent };
    case "neutral":
    default:
      return { bg: Colors.neutralLight, text: Colors.neutral };
  }
};

export function StatusPill({ status, label, size = "default" }: StatusPillProps) {
  const colors = getStatusColors(status);
  const isSmall = size === "small";

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: colors.bg,
          paddingVertical: isSmall ? Spacing.xxs : Spacing.xs,
          paddingHorizontal: isSmall ? Spacing.sm : Spacing.md,
        },
      ]}
    >
      <ThemedText
        type={isSmall ? "caption2" : "caption1"}
        style={[
          styles.label,
          {
            color: colors.text,
          },
        ]}
      >
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
  },
  label: {
    fontWeight: "600",
    textTransform: "capitalize",
    letterSpacing: 0.2,
  },
});
