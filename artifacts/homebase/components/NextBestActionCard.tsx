import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export interface NextBestActionData {
  id: string;
  type: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaScreen: string;
  ctaParams?: Record<string, unknown>;
}

type IconStyle = { icon: React.ComponentProps<typeof Feather>["name"]; color: string; bg: string };

function getIconStyle(type: string, theme: ReturnType<typeof useTheme>["theme"]): IconStyle {
  switch (type) {
    case "unpaid_invoice":
      return { icon: "dollar-sign", color: theme.warning, bg: `${theme.warning}26` };
    case "follow_up":
      return { icon: "phone-call", color: Colors.accent, bg: Colors.accentLight };
    default:
      return { icon: "zap", color: Colors.accent, bg: Colors.accentLight };
  }
}

interface NextBestActionCardProps {
  action: NextBestActionData;
}

// Task #489: single AI-driven "next best action" suggestion shown on the
// Provider Home screen, alongside (not replacing) the existing feed/goal
// cards. Tapping it navigates to the relevant screen to complete the action.
export function NextBestActionCard({ action }: NextBestActionCardProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const cfg = getIconStyle(action.type, theme);

  const handlePress = () => {
    navigation.navigate(action.ctaScreen as never, action.ctaParams as never);
  };

  return (
    <GlassCard style={styles.card} testID="card-next-best-action">
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon} size={18} color={cfg.color} />
        </View>
        <View style={[styles.badge, { backgroundColor: Colors.accentLight }]}>
          <ThemedText style={[styles.badgeText, { color: Colors.accent }]}>
            Next best action
          </ThemedText>
        </View>
      </View>

      <ThemedText style={styles.headline}>{action.headline}</ThemedText>
      <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
        {action.body}
      </ThemedText>

      <Pressable
        onPress={handlePress}
        style={[styles.cta, { backgroundColor: cfg.bg }]}
        testID="cta-next-best-action"
      >
        <ThemedText style={[styles.ctaText, { color: cfg.color }]}>
          {action.ctaLabel}
        </ThemedText>
        <Feather name="arrow-right" size={14} color={cfg.color} />
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  headline: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
