import React, { useState } from "react";
import { StyleSheet, View, TextInput, TextInputProps } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

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
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? "#EF4444"
    : isFocused
    ? Colors.accent
    : theme.border;

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText type="label" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor,
          },
        ]}
      >
        {leftIcon ? (
          <Feather
            name={leftIcon}
            size={20}
            color={isFocused ? Colors.accent : theme.textTertiary}
            style={styles.leftIcon}
          />
        ) : null}

        <TextInput
          style={[
            styles.input,
            {
              color: theme.text,
            },
            style,
          ]}
          placeholderTextColor={theme.textTertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {rightIcon ? (
          <Feather
            name={rightIcon}
            size={20}
            color={theme.textTertiary}
            style={styles.rightIcon}
            onPress={onRightIconPress}
          />
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
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  rightIcon: {
    marginLeft: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  error: {
    color: "#EF4444",
    marginTop: Spacing.xs,
  },
});
