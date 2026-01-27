import React from "react";
import { StyleSheet, View, Image, ImageSourcePropType } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface EmptyStateProps {
  image: ImageSourcePropType;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onPress: () => void;
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({
  image,
  title,
  description,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Image source={image} style={styles.image} resizeMode="contain" />

      <ThemedText type="h2" style={styles.title}>
        {title}
      </ThemedText>

      <ThemedText
        type="body"
        style={[styles.description, { color: theme.textSecondary }]}
      >
        {description}
      </ThemedText>

      {primaryAction || secondaryAction ? (
        <View style={styles.actions}>
          {primaryAction ? (
            <PrimaryButton
              onPress={primaryAction.onPress}
              style={styles.button}
            >
              {primaryAction.label}
            </PrimaryButton>
          ) : null}

          {secondaryAction ? (
            <SecondaryButton
              onPress={secondaryAction.onPress}
              style={styles.button}
            >
              {secondaryAction.label}
            </SecondaryButton>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  actions: {
    gap: Spacing.md,
    width: "100%",
    maxWidth: 280,
  },
  button: {
    width: "100%",
  },
});
