import React from "react";
import { StyleSheet, Pressable, View, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Colors, Animation, GlassEffect } from "@/constants/theme";

interface CategoryCardProps {
  name: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  testID?: string;
  compact?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CategoryCard({ name, icon, onPress, testID, compact = false }: CategoryCardProps) {
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

  if (compact) {
    return (
      <AnimatedPressable
        testID={testID}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.compactCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.borderLight,
          },
          animatedStyle,
        ]}
      >
        <View style={[styles.compactIconContainer, { backgroundColor: Colors.accentLight }]}>
          <Feather name={icon} size={18} color={Colors.accent} />
        </View>
        <ThemedText style={styles.compactName} numberOfLines={1}>
          {name}
        </ThemedText>
      </AnimatedPressable>
    );
  }

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

      <View style={[styles.iconContainer, { backgroundColor: Colors.accentLight }]}>
        <Feather name={icon} size={Spacing.iconSize} color={Colors.accent} />
      </View>

      <ThemedText type="label" style={styles.name} numberOfLines={1}>
        {name}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 96,
    overflow: "hidden",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  name: {
    textAlign: "center",
  },
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  compactIconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  compactName: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
});
