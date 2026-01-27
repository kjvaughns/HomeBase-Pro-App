import React from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export interface FilterOption<T extends string> {
  key: T;
  label: string;
  count?: number;
}

interface FilterChipsProps<T extends string> {
  options: FilterOption<T>[];
  selected: T;
  onSelect: (key: T) => void;
  scrollable?: boolean;
  showCounts?: boolean;
  style?: object;
}

export function FilterChips<T extends string>({
  options,
  selected,
  onSelect,
  scrollable = true,
  showCounts = false,
  style,
}: FilterChipsProps<T>) {
  const { theme } = useTheme();

  const handleSelect = (key: T) => {
    if (key !== selected) {
      Haptics.selectionAsync();
      onSelect(key);
    }
  };

  const renderChip = (option: FilterOption<T>) => {
    const isActive = option.key === selected;
    
    return (
      <Pressable
        key={option.key}
        onPress={() => handleSelect(option.key)}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: isActive ? Colors.accent : theme.backgroundDefault,
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <ThemedText
          type="label"
          style={[
            styles.chipText,
            { color: isActive ? "#FFFFFF" : theme.textSecondary },
          ]}
        >
          {option.label}
          {showCounts && option.count !== undefined && ` (${option.count})`}
        </ThemedText>
      </Pressable>
    );
  };

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContainer, style]}
      >
        {options.map(renderChip)}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {options.map(renderChip)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  scrollContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screenPadding,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  chipText: {
    fontWeight: "500",
  },
});
