import React from "react";
import { Image, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Colors, Spacing } from "@/constants/theme";

// HomeBase mark on a transparent background — the Android adaptive-icon
// foreground asset has no built-in padding, so it reads cleanly at 12–14px
// inside the badge pill (unlike the full app icon which is mostly margin).
const markImage = require("../assets/images/android-icon-foreground.png");

interface PartnerBadgeProps {
  size?: "small" | "default";
  testID?: string;
}

/**
 * HomeBase Partner badge (Task #220).
 *
 * Solid-accent treatment so the badge reads as a premium status and is
 * visually distinct from any neighboring tinted `StatusPill` (in particular
 * the green "Provider" success pill on the More tab profile card).
 */
export function PartnerBadge({ size = "default", testID }: PartnerBadgeProps) {
  const isSmall = size === "small";
  const iconSize = isSmall ? 12 : 14;

  return (
    <View
      testID={testID ?? "badge-homebase-partner"}
      style={[
        styles.pill,
        {
          backgroundColor: Colors.accent,
          paddingVertical: isSmall ? Spacing.xxs : Spacing.xs,
          paddingHorizontal: isSmall ? Spacing.sm : Spacing.md,
        },
      ]}
    >
      <Image
        source={markImage}
        style={{
          width: iconSize,
          height: iconSize,
          resizeMode: "contain",
          tintColor: "#FFFFFF",
        }}
      />
      <ThemedText
        style={[
          styles.label,
          {
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
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
