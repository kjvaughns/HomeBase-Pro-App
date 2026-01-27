import React, { useState } from "react";
import { StyleSheet, View, TextInput, TextInputProps, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors, Typography } from "@/constants/theme";

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
}

export function TextField({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  ...props
}: TextFieldProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? Colors.error
    : isFocused
    ? Colors.accent
    : "transparent";

  const backgroundColor = isFocused
    ? theme.backgroundSecondary
    : theme.backgroundSecondary;

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText type="label" style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </ThemedText>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor,
            borderColor,
            borderWidth: isFocused || error ? 1.5 : 0,
          },
        ]}
      >
        {leftIcon ? (
          <Feather
            name={leftIcon}
            size={Spacing.iconSizeSmall}
            color={isFocused ? Colors.accent : theme.textTertiary}
            style={styles.leftIcon}
          />
        ) : null}

        <TextInput
          style={[
            styles.input,
            { color: theme.text },
            style,
          ]}
          placeholderTextColor={theme.textTertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          selectionColor={Colors.accent}
          {...props}
        />

        {rightIcon ? (
          <Pressable onPress={onRightIconPress} hitSlop={8}>
            <Feather
              name={rightIcon}
              size={Spacing.iconSizeSmall}
              color={theme.textTertiary}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <ThemedText type="caption" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    marginBottom: Spacing.xxs,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.md,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.body,
    height: "100%",
  },
  error: {
    color: Colors.error,
    marginTop: Spacing.xxs,
  },
});
