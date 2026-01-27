import React from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

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
      return { bg: `${Colors.accent}14`, text: Colors.accent };
    case "warning":
    case "pending":
      return { bg: `${Colors.warning}14`, text: Colors.warning };
    case "error":
    case "cancelled":
      return { bg: `${Colors.error}14`, text: Colors.error };
    case "info":
    case "scheduled":
      return { bg: "rgba(59, 130, 246, 0.12)", text: "#3B82F6" };
    case "inProgress":
      return { bg: `${Colors.accent}14`, text: Colors.accent };
    case "neutral":
    default:
      return { bg: "rgba(128, 128, 128, 0.12)", text: "#808080" };
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
        style={[
          styles.label,
          {
            color: colors.text,
            fontSize: isSmall ? 11 : 12,
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
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
  },
  label: {
    fontWeight: "600",
    textTransform: "capitalize",
    letterSpacing: 0.2,
  },
});
