import React from "react";
import { StyleSheet, View, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Colors } from "@/constants/theme";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: keyof typeof Feather.glyphMap;
  trend?: {
    value: number;
    positive: boolean;
  };
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: StatCardProps) {
  const { theme, isDark } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor:
            Platform.OS === "ios" ? "transparent" : theme.glassBackground,
          borderColor: theme.glassBorder,
        },
      ]}
    >
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={40}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View style={styles.content}>
        <View style={styles.header}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${Colors.accent}15` },
            ]}
          >
            <Feather name={icon} size={20} color={Colors.accent} />
          </View>

          {trend ? (
            <View style={styles.trend}>
              <Feather
                name={trend.positive ? "trending-up" : "trending-down"}
                size={14}
                color={trend.positive ? Colors.accent : "#EF4444"}
              />
              <ThemedText
                type="caption"
                style={{
                  color: trend.positive ? Colors.accent : "#EF4444",
                  fontWeight: "600",
                }}
              >
                {trend.value}%
              </ThemedText>
            </View>
          ) : null}
        </View>

        <ThemedText type="h1" style={styles.value}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </ThemedText>

        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {title}
        </ThemedText>

        {subtitle ? (
          <ThemedText
            type="caption"
            style={[styles.subtitle, { color: theme.textTertiary }]}
          >
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  trend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  value: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
});
