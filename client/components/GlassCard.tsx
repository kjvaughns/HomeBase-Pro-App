import React from "react";
import { StyleSheet, Pressable, ViewStyle, Platform, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface GlassCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  intensity?: number;
  testID?: string;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GlassCard({
  children,
  onPress,
  style,
  intensity = 40,
  testID,
}: GlassCardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.98, springConfig);
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, springConfig);
    }
  };

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const content = (
    <>
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={intensity}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.content}>{children}</View>
    </>
  );

  if (onPress) {
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
          style,
          animatedStyle,
        ]}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor:
            Platform.OS === "ios" ? "transparent" : theme.glassBackground,
          borderColor: theme.glassBorder,
        },
        style,
      ]}
    >
      {content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  content: {
    padding: Spacing.lg,
  },
});
