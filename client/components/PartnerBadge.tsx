import React from "react";
import { Image, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Colors, Spacing } from "@/constants/theme";

const iconImage = require("../../assets/images/icon.png");

interface PartnerBadgeProps {
  size?: "small" | "default";
  testID?: string;
}

export function PartnerBadge({ size = "default", testID }: PartnerBadgeProps) {
  const isSmall = size === "small";
  const iconSize = isSmall ? 12 : 14;

  return (
    <View
      testID={testID ?? "badge-homebase-partner"}
      style={[
        styles.pill,
        {
          backgroundColor: `${Colors.accent}14`,
          paddingVertical: isSmall ? Spacing.xxs : Spacing.xs,
          paddingHorizontal: isSmall ? Spacing.sm : Spacing.md,
        },
      ]}
    >
      <Image
        source={iconImage}
        style={{ width: iconSize, height: iconSize, resizeMode: "contain" }}
      />
      <ThemedText
        style={[
          styles.label,
          {
            color: Colors.accent,
            fontSize: isSmall ? 11 : 12,
          },
        ]}
      >
        Partner
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
  },
  label: {
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
