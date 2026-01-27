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
import { Lead } from "@/state/mockData";

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
          <Avatar uri={lead.customerAvatar} name={lead.customerName} size="small" />
          <View style={styles.headerInfo}>
            <ThemedText type="h4" numberOfLines={1}>
              {lead.service}
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary }}
              numberOfLines={1}
            >
              {lead.customerName}
            </ThemedText>
          </View>
          <StatusPill status={getStatusType(lead.status)} label={lead.status} size="small" />
        </View>

        <ThemedText
          type="body"
          style={[styles.description, { color: theme.textSecondary }]}
          numberOfLines={2}
        >
          {lead.description}
        </ThemedText>

        <View style={[styles.details, { borderTopColor: theme.separator }]}>
          <View style={styles.detailRow}>
            <Feather name="map-pin" size={14} color={theme.textSecondary} />
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary }}
              numberOfLines={1}
            >
              {lead.address}
            </ThemedText>
          </View>
          <View style={styles.detailRow}>
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {lead.createdAt}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.footer, { borderTopColor: theme.separator }]}>
          <View>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Budget
            </ThemedText>
            <ThemedText type="h3" style={{ color: Colors.accent }}>
              ${lead.budget.toLocaleString()}
            </ThemedText>
          </View>

          {lead.status === "new" && onContact && onDecline ? (
            <View style={styles.actions}>
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
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: Spacing.lg,
  },
});
