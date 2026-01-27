import React from "react";
import { StyleSheet, Pressable, ViewStyle, StyleProp, ActivityIndicator } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing, Colors } from "@/constants/theme";

interface SecondaryButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  testID?: string;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SecondaryButton({
  onPress,
  children,
  style,
  disabled = false,
  loading = false,
  icon,
  testID,
}: SecondaryButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(0.97, springConfig);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  const handlePress = () => {
    if (!disabled && !loading && onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  return (
    <AnimatedPressable
      testID={testID}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          borderColor: Colors.accent,
          opacity: disabled ? 0.5 : 1,
        },
        style,
        animatedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.accent} size="small" />
      ) : (
        <>
          {icon}
          <ThemedText
            type="body"
            style={[styles.buttonText, { color: Colors.accent }]}
          >
            {children}
          </ThemedText>
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  buttonText: {
    fontWeight: "600",
  },
});
