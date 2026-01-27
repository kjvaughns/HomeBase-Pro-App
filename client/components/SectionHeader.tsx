import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";

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
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="h3">{title}</ThemedText>

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ThemedText type="label" style={{ color: Colors.accent }}>
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
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
});
