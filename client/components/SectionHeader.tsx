import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, Colors, Typography } from "@/constants/theme";

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>{title}</ThemedText>

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [
            styles.action,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ThemedText style={styles.actionText}>
            {actionLabel}
          </ThemedText>
          <Feather name="chevron-right" size={16} color={Colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.title3,
    fontWeight: "600",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xxs,
  },
  actionText: {
    ...Typography.subhead,
    color: Colors.accent,
    fontWeight: "500",
  },
});
