import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, Typography } from "@/constants/theme";

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-40);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });

    NetInfo.fetch().then((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    opacity.value = withTiming(isOffline ? 1 : 0, { duration: 200 });
    translateY.value = withTiming(isOffline ? 0 : -40, { duration: 250 });
  }, [isOffline, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!isOffline && opacity.value === 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { top: insets.top + Spacing.sm }, animatedStyle]}
      testID="banner-offline"
    >
      <View style={styles.pill}>
        <Feather name="wifi-off" size={14} color="#FFFFFF" />
        <ThemedText style={styles.text} lightColor="#FFFFFF" darkColor="#FFFFFF">
          You're offline
        </ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
  },
  text: {
    ...Typography.footnote,
    fontWeight: "600",
  },
});
