import React from "react";
import { StyleSheet, View, Platform } from "react-native";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

type StatusType = "success" | "warning" | "error" | "info" | "neutral" | "pending";

interface StatusPillProps {
  status: StatusType;
  label: string;
}

const statusColors: Record<StatusType, { bg: string; text: string }> = {
  success: { bg: "rgba(56, 174, 95, 0.15)", text: Colors.accent },
  warning: { bg: "rgba(245, 158, 11, 0.15)", text: "#F59E0B" },
  error: { bg: "rgba(239, 68, 68, 0.15)", text: "#EF4444" },
  info: { bg: "rgba(59, 130, 246, 0.15)", text: "#3B82F6" },
  neutral: { bg: "rgba(107, 114, 128, 0.15)", text: "#6B7280" },
  pending: { bg: "rgba(245, 158, 11, 0.15)", text: "#F59E0B" },
};

export function StatusPill({ status, label }: StatusPillProps) {
  const { isDark } = useTheme();
  const colors = statusColors[status];

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: colors.bg,
        },
      ]}
    >
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={20}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <ThemedText
        type="caption"
        style={[styles.label, { color: colors.text }]}
      >
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
  },
  label: {
    fontWeight: "600",
    textTransform: "capitalize",
  },
});
