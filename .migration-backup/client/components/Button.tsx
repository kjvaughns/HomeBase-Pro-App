import React, { ReactNode } from "react";
import { StyleSheet, Pressable, ViewStyle, StyleProp, ActivityIndicator } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Colors, Animation, Typography } from "@/constants/theme";

interface ButtonProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "default" | "small" | "large";
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  onPress,
  children,
  style,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "default",
  testID,
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(Animation.pressScale, Animation.spring.fast);
    }
  };

  const handlePressOut = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(1, Animation.spring.fast);
    }
  };

  const handlePress = () => {
    if (!disabled && !loading && onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  };

  const getBackgroundColor = () => {
    if (disabled) return theme.backgroundTertiary;
    switch (variant) {
      case "primary":
        return Colors.accent;
      case "secondary":
        return theme.backgroundSecondary;
      case "outline":
      case "ghost":
        return "transparent";
      default:
        return Colors.accent;
    }
  };

  const getTextColor = () => {
    if (disabled) return theme.textTertiary;
    switch (variant) {
      case "primary":
        return "#FFFFFF";
      case "secondary":
        return theme.text;
      case "outline":
      case "ghost":
        return Colors.accent;
      default:
        return "#FFFFFF";
    }
  };

  const getBorderColor = () => {
    if (variant === "outline") {
      return disabled ? theme.border : Colors.accent;
    }
    return "transparent";
  };

  const getHeight = () => {
    switch (size) {
      case "small":
        return Spacing.buttonHeightSmall;
      case "large":
        return Spacing.buttonHeight + 6;
      default:
        return Spacing.buttonHeight;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case "small":
        return Typography.subhead.fontSize;
      case "large":
        return Typography.body.fontSize;
      default:
        return Typography.callout.fontSize;
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
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === "outline" ? 1.5 : 0,
          height: getHeight(),
        },
        style,
        animatedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <ThemedText
          style={[
            styles.buttonText,
            {
              color: getTextColor(),
              fontSize: getFontSize(),
            },
          ]}
        >
          {children}
        </ThemedText>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  buttonText: {
    fontWeight: "600",
    textAlign: "center",
  },
});
