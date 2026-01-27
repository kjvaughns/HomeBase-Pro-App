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
import { BorderRadius, Spacing, Colors } from "@/constants/theme";

interface CategoryCardProps {
  name: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CategoryCard({ name, icon, onPress, testID }: CategoryCardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
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

      <View
        style={[
          styles.iconContainer,
          { backgroundColor: `${Colors.accent}15` },
        ]}
      >
        <Feather name={icon} size={24} color={Colors.accent} />
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
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    minHeight: 100,
    overflow: "hidden",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  name: {
    textAlign: "center",
  },
});
