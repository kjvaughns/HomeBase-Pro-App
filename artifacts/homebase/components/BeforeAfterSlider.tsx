import React, { useState } from "react";
import { View, StyleSheet, Image, LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Colors, Spacing } from "@/constants/theme";

interface BeforeAfterSliderProps {
  beforeUri: string;
  afterUri: string;
  height?: number;
  borderRadius?: number;
  showLabels?: boolean;
  brandName?: string | null;
  brandLogoUri?: string | null;
}

// Drag-to-reveal comparison: the "after" image sits on top, clipped by the
// handle position, revealing progressively more of the "before" image
// underneath as the provider/homeowner drags left.
export function BeforeAfterSlider({
  beforeUri,
  afterUri,
  height = 260,
  borderRadius = BorderRadius.lg,
  showLabels = true,
  brandName,
  brandLogoUri,
}: BeforeAfterSliderProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const position = useSharedValue(0.5);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 1) setContainerWidth(w);
  };

  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));

  const triggerHaptic = () => {
    Haptics.selectionAsync();
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      runOnJS(triggerHaptic)();
    })
    .onUpdate((e) => {
      if (containerWidth <= 0) return;
      const next = clamp((e.x ?? 0) / containerWidth, 0, 1);
      position.value = next;
    })
    .onEnd(() => {
      position.value = withTiming(position.value, { duration: 80 });
    });

  const revealStyle = useAnimatedStyle(() => ({
    width: `${position.value * 100}%`,
  }));

  const handleStyle = useAnimatedStyle(() => ({
    left: `${position.value * 100}%`,
  }));

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.container,
        { height, borderRadius, overflow: "hidden" },
      ]}
    >
      {/* Base layer: "after" photo, full width */}
      <Image source={{ uri: afterUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {/* Clipped overlay: "before" photo, revealed by drag */}
      <Animated.View style={[styles.beforeClip, revealStyle]}>
        <Image
          source={{ uri: beforeUri }}
          style={{ width: containerWidth || "100%", height, resizeMode: "cover" }}
        />
      </Animated.View>

      {showLabels ? (
        <>
          <View style={[styles.badge, styles.badgeLeft]}>
            <ThemedText style={styles.badgeText}>BEFORE</ThemedText>
          </View>
          <View style={[styles.badge, styles.badgeRight]}>
            <ThemedText style={styles.badgeText}>AFTER</ThemedText>
          </View>
        </>
      ) : null}

      {(brandName || brandLogoUri) ? (
        <View style={styles.brandBadge}>
          {brandLogoUri ? (
            <Image source={{ uri: brandLogoUri }} style={styles.brandLogo} />
          ) : null}
          {brandName ? (
            <ThemedText style={styles.brandText} numberOfLines={1}>
              {brandName}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      <GestureDetector gesture={panGesture}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.handle, handleStyle]}>
            <View style={styles.handleLine} />
            <View style={styles.handleKnob}>
              <Feather name="chevrons-left" size={12} color="#FFFFFF" style={{ marginRight: -2 }} />
              <Feather name="chevrons-right" size={12} color="#FFFFFF" style={{ marginLeft: -2 }} />
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#000",
    position: "relative",
  },
  beforeClip: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    overflow: "hidden",
  },
  handle: {
    position: "absolute",
    top: 0,
    bottom: 0,
    marginLeft: -1,
    alignItems: "center",
  },
  handleLine: {
    position: "absolute",
    width: 2,
    top: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
  },
  handleKnob: {
    position: "absolute",
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -16,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badge: {
    position: "absolute",
    top: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeLeft: { left: Spacing.sm },
  badgeRight: { right: Spacing.sm },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  brandBadge: {
    position: "absolute",
    bottom: Spacing.sm,
    left: Spacing.sm,
    right: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  brandLogo: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  brandText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 180,
  },
});
