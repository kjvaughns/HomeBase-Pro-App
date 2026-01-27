import React from "react";
import { StyleSheet, View, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Colors, GlassEffect } from "@/constants/theme";

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
          backgroundColor: Platform.OS === "ios" ? "transparent" : theme.cardBackground,
          borderColor: theme.borderLight,
        },
      ]}
    >
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={GlassEffect.intensity.light}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: Colors.accentLight }]}>
            <Feather name={icon} size={Spacing.iconSizeSmall} color={Colors.accent} />
          </View>

          {trend ? (
            <View style={styles.trend}>
              <Feather
                name={trend.positive ? "trending-up" : "trending-down"}
                size={14}
                color={trend.positive ? Colors.accent : Colors.error}
              />
              <ThemedText
                type="caption"
                style={{
                  color: trend.positive ? Colors.accent : Colors.error,
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
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    flex: 1,
  },
  content: {
    padding: Spacing.cardPadding,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.iconContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  trend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  value: {
    marginBottom: Spacing.xxs,
  },
  subtitle: {
    marginTop: Spacing.xxs,
  },
});
