import React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors } from "@/constants/theme";

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: "small" | "medium" | "large" | "xl";
  showBadge?: boolean;
}

const sizes = {
  small: 40,
  medium: 56,
  large: 80,
  xl: 104,
};

export function Avatar({
  uri,
  name,
  size = "medium",
  showBadge = false,
}: AvatarProps) {
  const { theme } = useTheme();
  const dimension = sizes[size];

  const getInitials = () => {
    if (!name) return "";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name[0]?.toUpperCase() || "";
  };

  return (
    <View style={[styles.container, { width: dimension, height: dimension }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[
            styles.image,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
            },
          ]}
          contentFit="cover"
        />
      ) : name ? (
        <View
          style={[
            styles.placeholder,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
              backgroundColor: Colors.accent,
            },
          ]}
        >
          <ThemedText
            style={[
              styles.initials,
              {
                fontSize: dimension * 0.35,
                color: "#FFFFFF",
              },
            ]}
          >
            {getInitials()}
          </ThemedText>
        </View>
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
              backgroundColor: theme.backgroundSecondary,
            },
          ]}
        >
          <Feather
            name="user"
            size={dimension * 0.4}
            color={theme.textTertiary}
          />
        </View>
      )}

      {showBadge ? (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: Colors.accent,
              borderColor: theme.backgroundRoot,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  image: {
    backgroundColor: "#E5E7EB",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontWeight: "600",
  },
  badge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
});
