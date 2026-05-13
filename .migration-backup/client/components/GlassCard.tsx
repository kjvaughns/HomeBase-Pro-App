import React from "react";
import { StyleSheet, Pressable, ViewStyle, StyleProp, Platform, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Animation, GlassEffect } from "@/constants/theme";

interface GlassCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: "light" | "medium" | "heavy";
  noPadding?: boolean;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GlassCard({
  children,
  onPress,
  style,
  contentStyle,
  intensity = "light",
  noPadding = false,
  testID,
}: GlassCardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const blurIntensity = GlassEffect.intensity[intensity];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(Animation.pressScale, Animation.spring.fast);
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, Animation.spring.fast);
    }
  };

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const cardStyles = [
    styles.card,
    {
      backgroundColor: Platform.OS === "ios" ? "transparent" : theme.cardBackground,
      borderColor: theme.borderLight,
    },
    style,
  ];

  const content = (
    <>
      {Platform.OS === "ios" ? (
        <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
          <BlurView
            intensity={blurIntensity}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      <View style={[styles.content, noPadding && styles.noPadding, contentStyle]}>
        {children}
      </View>
    </>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        testID={testID}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[cardStyles, animatedStyle]}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return (
    <View style={cardStyles}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  content: {
    padding: Spacing.cardPadding,
  },
  noPadding: {
    padding: 0,
  },
});
