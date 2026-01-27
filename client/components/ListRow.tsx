import React from "react";
import { StyleSheet, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";

interface ListRowProps {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
}

export function ListRow({
  title,
  subtitle,
  leftIcon,
  leftElement,
  rightElement,
  showChevron = true,
  onPress,
  destructive = false,
  testID,
}: ListRowProps) {
  const { theme } = useTheme();

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const textColor = destructive ? "#EF4444" : theme.text;

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed && onPress ? theme.backgroundDefault : "transparent",
        },
      ]}
    >
      {leftElement ? (
        <View style={styles.leftElement}>{leftElement}</View>
      ) : leftIcon ? (
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <Feather
            name={leftIcon}
            size={20}
            color={destructive ? "#EF4444" : Colors.accent}
          />
        </View>
      ) : null}

      <View style={styles.content}>
        <ThemedText type="body" style={{ color: textColor }}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      {rightElement ? (
        <View style={styles.rightElement}>{rightElement}</View>
      ) : showChevron && onPress ? (
        <Feather name="chevron-right" size={20} color={theme.textTertiary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: Spacing.listRowHeight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  leftElement: {
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  rightElement: {
    marginLeft: Spacing.sm,
  },
});
