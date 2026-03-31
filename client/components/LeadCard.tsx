import React from "react";
import { StyleSheet, View, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Pressable } from "react-native";
import * as Haptics from "expo-haptics";

import { Avatar } from "@/components/Avatar";
import { ThemedText } from "@/components/ThemedText";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Colors, Animation, GlassEffect } from "@/constants/theme";
import { Lead } from "@/state/providerStore";

interface LeadCardProps {
  lead: Lead;
  onPress: () => void;
  onContact?: () => void;
  onDecline?: () => void;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const getStatusType = (status: Lead["status"]) => {
  switch (status) {
    case "new":
      return "info";
    case "contacted":
      return "pending";
    case "quoted":
      return "warning";
    case "won":
      return "success";
    case "lost":
      return "error";
    default:
      return "neutral";
  }
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function LeadCard({
  lead,
  onPress,
  onContact,
  onDecline,
  testID,
}: LeadCardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(Animation.pressScale, Animation.spring.fast);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, Animation.spring.fast);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <AnimatedPressable
      testID={testID}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        {
          backgroundColor: Platform.OS === "ios" ? "transparent" : theme.cardBackground,
          borderColor: theme.borderLight,
        },
        animatedStyle,
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
          <Avatar uri={undefined} name={lead.name} size="small" />
          <View style={styles.headerInfo}>
            <ThemedText type="h4" numberOfLines={1}>
              {lead.service ?? "General Inquiry"}
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary }}
              numberOfLines={1}
            >
              {lead.name}
            </ThemedText>
          </View>
          <StatusPill status={getStatusType(lead.status)} label={lead.status} size="small" />
        </View>

        {lead.message ? (
          <ThemedText
            type="body"
            style={[styles.description, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {lead.message}
          </ThemedText>
        ) : null}

        <View style={[styles.details, { borderTopColor: theme.separator }]}>
          {lead.phone ? (
            <View style={styles.detailRow}>
              <Feather name="phone" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                {lead.phone}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {formatRelativeTime(lead.createdAt)}
            </ThemedText>
          </View>
          {lead.source && lead.source !== "direct" ? (
            <View style={styles.detailRow}>
              <Feather name="link" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                via {lead.source === "booking_page" ? "Booking Page" : lead.source}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {lead.status === "new" && onContact && onDecline ? (
          <View style={[styles.footer, { borderTopColor: theme.separator }]}>
            <Button
              variant="secondary"
              size="small"
              onPress={onDecline}
              style={styles.actionBtn}
            >
              Pass
            </Button>
            <Button
              variant="primary"
              size="small"
              onPress={onContact}
              style={styles.actionBtn}
            >
              Contact
            </Button>
          </View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  content: {
    padding: Spacing.cardPadding,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  description: {
    marginTop: Spacing.md,
  },
  details: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: Spacing.lg,
  },
});
