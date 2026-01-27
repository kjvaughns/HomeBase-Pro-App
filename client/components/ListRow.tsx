import React from "react";
import { StyleSheet, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Animation } from "@/constants/theme";

interface ListRowProps {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  rightText?: string;
  showChevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ListRow({
  title,
  subtitle,
  leftIcon,
  leftElement,
  rightElement,
  rightText,
  showChevron = true,
  onPress,
  destructive = false,
  isFirst = false,
  isLast = false,
  testID,
}: ListRowProps) {
  const { theme } = useTheme();
  const backgroundColor = useSharedValue("transparent");

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: backgroundColor.value,
  }));

  const handlePressIn = () => {
    if (onPress) {
      backgroundColor.value = withTiming(theme.backgroundSecondary, {
        duration: Animation.duration.fast,
      });
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      backgroundColor.value = withTiming("transparent", {
        duration: Animation.duration.default,
      });
    }
  };

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const textColor = destructive ? Colors.error : theme.text;
  const iconColor = destructive ? Colors.error : Colors.accent;

  return (
    <AnimatedPressable
      testID={testID}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      style={[
        styles.row,
        isFirst && styles.firstRow,
        isLast && styles.lastRow,
        animatedStyle,
      ]}
    >
      {leftElement ? (
        <View style={styles.leftElement}>{leftElement}</View>
      ) : leftIcon ? (
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: destructive ? `${Colors.error}12` : Colors.accentLight },
          ]}
        >
          <Feather name={leftIcon} size={Spacing.iconSizeSmall} color={iconColor} />
        </View>
      ) : null}

      <View style={[styles.content, !isLast && { borderBottomColor: theme.separator }]}>
        <View style={styles.textContainer}>
          <ThemedText type="body" style={{ color: textColor }}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.rightContainer}>
          {rightText ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {rightText}
            </ThemedText>
          ) : null}
          {rightElement ? (
            <View style={styles.rightElement}>{rightElement}</View>
          ) : showChevron && onPress ? (
            <Feather
              name="chevron-right"
              size={Spacing.iconSizeSmall}
              color={theme.textTertiary}
            />
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: Spacing.listRowHeight,
    paddingLeft: Spacing.screenPadding,
  },
  firstRow: {
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
  },
  lastRow: {
    borderBottomLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.iconContainer,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  leftElement: {
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: Spacing.listRowHeight,
    paddingRight: Spacing.screenPadding,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  rightElement: {
    marginLeft: Spacing.xs,
  },
});
