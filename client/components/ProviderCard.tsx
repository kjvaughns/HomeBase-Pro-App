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
import { BorderRadius, Spacing, Colors, Animation, GlassEffect } from "@/constants/theme";

interface ProviderCardProps {
  name: string;
  businessName: string;
  avatarUrl?: string;
  rating: number;
  reviewCount: number;
  services: string[];
  hourlyRate: number;
  verified: boolean;
  distance?: number | null;
  onPress: () => void;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ProviderCard({
  name,
  businessName,
  avatarUrl,
  rating,
  reviewCount,
  services,
  hourlyRate,
  verified,
  distance,
  onPress,
  testID,
}: ProviderCardProps) {
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
          <Avatar uri={avatarUrl} name={name} size="medium" />
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <ThemedText type="h4" numberOfLines={1} style={styles.businessName}>
                {businessName}
              </ThemedText>
              {verified ? (
                <Feather name="check-circle" size={16} color={Colors.accent} />
              ) : null}
            </View>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary }}
              numberOfLines={1}
            >
              {name}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.meta, { borderTopColor: theme.separator }]}>
          <View style={styles.ratingContainer}>
            <Feather name="star" size={14} color={Colors.warning} />
            <ThemedText type="label" style={styles.rating}>
              {rating.toFixed(1)}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              ({reviewCount})
            </ThemedText>
            {typeof distance === "number" ? (
              <>
                <ThemedText type="small" style={{ color: theme.textTertiary, marginLeft: Spacing.sm }}>
                  •
                </ThemedText>
                <Feather name="map-pin" size={12} color={theme.textSecondary} style={{ marginLeft: Spacing.xs }} />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 2 }}>
                  {distance.toFixed(1)} mi away
                </ThemedText>
              </>
            ) : null}
          </View>

          <View style={styles.priceContainer}>
            <ThemedText type="h4" style={{ color: Colors.accent }}>
              ${hourlyRate}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              /hr
            </ThemedText>
          </View>
        </View>

        <View style={styles.services}>
          {services.slice(0, 2).map((service, index) => (
            <StatusPill key={index} status="neutral" label={service} size="small" />
          ))}
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
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  businessName: {
    flex: 1,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  rating: {
    marginLeft: 2,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  services: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
