import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing } from "@/constants/theme";

export type RatingStarsSize = "small" | "medium" | "large";

const SIZE_MAP: Record<RatingStarsSize, number> = {
  small: 12,
  medium: 16,
  large: 28,
};

interface RatingStarsProps {
  /** Current rating value, 0-5. Supports halves when not interactive. */
  rating: number;
  /** Total number of stars to render. Defaults to 5. */
  maxStars?: number;
  size?: RatingStarsSize;
  /** Show the numeric rating value next to the stars, e.g. "4.8". */
  showValue?: boolean;
  /** Show a review count in parentheses, e.g. "(128)". Implies showValue. */
  reviewCount?: number;
  /** Render a single star + numeric value instead of a full star row. */
  compact?: boolean;
  /** Make the stars tappable to pick a rating (e.g. leaving a review). */
  interactive?: boolean;
  onChange?: (value: number) => void;
  testID?: string;
}

export function RatingStars({
  rating,
  maxStars = 5,
  size = "medium",
  showValue = false,
  reviewCount,
  compact = false,
  interactive = false,
  onChange,
  testID,
}: RatingStarsProps) {
  const { theme } = useTheme();
  const iconSize = SIZE_MAP[size];
  const safeRating = Number.isFinite(rating) ? Math.max(0, rating) : 0;

  if (compact) {
    return (
      <View style={styles.compactRow} testID={testID}>
        <Ionicons name="star" size={iconSize} color={Colors.rating} />
        <ThemedText type={size === "large" ? "h4" : "label"} style={styles.compactValue}>
          {safeRating.toFixed(1)}
        </ThemedText>
        {typeof reviewCount === "number" ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            ({reviewCount})
          </ThemedText>
        ) : null}
      </View>
    );
  }

  const stars = Array.from({ length: maxStars }, (_, index) => {
    const starNumber = index + 1;
    const fullStars = Math.floor(safeRating);
    const hasHalf = safeRating - fullStars >= 0.5;

    let iconName: keyof typeof Ionicons.glyphMap = "star-outline";
    if (interactive) {
      iconName = starNumber <= safeRating ? "star" : "star-outline";
    } else if (index < fullStars) {
      iconName = "star";
    } else if (index === fullStars && hasHalf) {
      iconName = "star-half";
    }

    const color = iconName === "star-outline" ? theme.borderLight : Colors.rating;

    const star = (
      <Ionicons key={starNumber} name={iconName} size={iconSize} color={color} />
    );

    if (!interactive) return star;

    return (
      <Pressable
        key={starNumber}
        onPress={() => onChange?.(starNumber)}
        hitSlop={6}
        style={styles.interactiveStar}
        testID={testID ? `${testID}-${starNumber}` : undefined}
      >
        {star}
      </Pressable>
    );
  });

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.starsRow}>{stars}</View>
      {showValue || typeof reviewCount === "number" ? (
        <>
          <ThemedText type="label" style={styles.value}>
            {safeRating.toFixed(1)}
          </ThemedText>
          {typeof reviewCount === "number" ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              ({reviewCount})
            </ThemedText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  compactValue: {
    marginLeft: 2,
  },
  value: {
    marginLeft: 2,
  },
  interactiveStar: {
    padding: 2,
  },
});
