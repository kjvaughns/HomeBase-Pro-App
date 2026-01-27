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

interface ProviderCardProps {
  name: string;
  businessName: string;
  avatarUrl?: string;
  rating: number;
  reviewCount: number;
  services: string[];
  hourlyRate: number;
  verified: boolean;
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
  onPress,
  testID,
}: ProviderCardProps) {
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
          <Avatar uri={avatarUrl} name={name} size="medium" />
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <ThemedText type="h4" numberOfLines={1} style={styles.name}>
                {businessName}
              </ThemedText>
              {verified ? (
                <View style={styles.verifiedBadge}>
                  <Feather name="check-circle" size={14} color={Colors.accent} />
                </View>
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

        <View style={styles.meta}>
          <View style={styles.ratingContainer}>
            <Feather name="star" size={14} color="#F59E0B" />
            <ThemedText type="label" style={styles.rating}>
              {rating.toFixed(1)}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              ({reviewCount})
            </ThemedText>
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
            <StatusPill key={index} status="neutral" label={service} />
          ))}
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
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    flex: 1,
  },
  verifiedBadge: {
    marginLeft: Spacing.xs,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
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
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
});
