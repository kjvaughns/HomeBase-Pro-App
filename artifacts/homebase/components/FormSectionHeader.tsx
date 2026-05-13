import React from "react";
import { StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, Typography, Colors, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

type FeatherName = ComponentProps<typeof Feather>["name"];

interface FormSectionHeaderProps {
  icon: FeatherName;
  title: string;
  iconBg?: string;
  children?: React.ReactNode;
}

export function FormSectionHeader({ icon, title, iconBg, children }: FormSectionHeaderProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.iconTile, { backgroundColor: iconBg ?? Colors.accentLight }]}>
        <Feather name={icon} size={15} color={iconBg ? theme.textSecondary : Colors.accent} />
      </View>
      <ThemedText style={styles.title}>{title}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...Typography.headline,
    flex: 1,
  },
});
