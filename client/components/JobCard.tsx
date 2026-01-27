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
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Colors } from "@/constants/theme";
import { Job } from "@/state/mockData";

interface JobCardProps {
  job: Job;
  onPress: () => void;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const getStatusType = (status: Job["status"]) => {
  switch (status) {
    case "scheduled":
      return "info";
    case "in_progress":
      return "warning";
    case "completed":
      return "success";
    default:
      return "neutral";
  }
};

const formatStatus = (status: Job["status"]) => {
  return status.replace("_", " ");
};

export function JobCard({ job, onPress, testID }: JobCardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
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
          backgroundColor:
            Platform.OS === "ios" ? "transparent" : theme.glassBackground,
          borderColor: theme.glassBorder,
        },
        animatedStyle,
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
          <Avatar uri={job.customerAvatar} name={job.customerName} size="small" />
          <View style={styles.headerInfo}>
            <ThemedText type="h4" numberOfLines={1}>
              {job.service}
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary }}
              numberOfLines={1}
            >
              {job.customerName}
            </ThemedText>
          </View>
          <StatusPill
            status={getStatusType(job.status)}
            label={formatStatus(job.status)}
          />
        </View>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Feather name="calendar" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {formatDate(job.date)} at {job.time}
            </ThemedText>
          </View>
          <View style={styles.detailRow}>
            <Feather name="map-pin" size={14} color={theme.textSecondary} />
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary }}
              numberOfLines={1}
            >
              {job.address}
            </ThemedText>
          </View>
        </View>

        <View style={styles.footer}>
          <ThemedText type="h3" style={{ color: Colors.accent }}>
            ${job.price}
          </ThemedText>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  content: {
    padding: Spacing.lg,
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
  details: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    gap: Spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  footer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
});
