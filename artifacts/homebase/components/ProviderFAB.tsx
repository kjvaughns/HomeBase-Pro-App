import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  SharedValue,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FABAction {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
}

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

export default function ProviderFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { horizontalPadding, isTablet } = useLayout();
  
  const progress = useSharedValue(0);
  const rotation = useSharedValue(0);

  const actions: FABAction[] = [
    {
      id: "voice",
      label: "Voice Capture",
      icon: "mic",
      onPress: () => {
        handleClose();
        navigation.navigate("VoiceQuickCapture");
      },
    },
    {
      id: "ai",
      label: "Ask AI",
      icon: "message-circle",
      onPress: () => {
        handleClose();
        navigation.navigate("ProviderAIAssistant");
      },
    },
    {
      id: "quote",
      label: "Quick Quote",
      icon: "zap",
      onPress: () => {
        handleClose();
        navigation.navigate("QuickQuote");
      },
    },
    {
      id: "invoice",
      label: "Invoice",
      icon: "file-text",
      onPress: () => {
        handleClose();
        navigation.navigate("AddInvoice");
      },
    },
    {
      id: "job",
      label: "Job",
      icon: "calendar",
      onPress: () => {
        handleClose();
        navigation.navigate("AddJob");
      },
    },
    {
      id: "client",
      label: "Client",
      icon: "user-plus",
      onPress: () => {
        handleClose();
        navigation.navigate("AddClient");
      },
    },
  ];

  const handleOpen = () => {
    setIsOpen(true);
    progress.value = withSpring(1, SPRING_CONFIG);
    rotation.value = withSpring(45, SPRING_CONFIG);
  };

  const handleClose = () => {
    progress.value = withSpring(0, SPRING_CONFIG);
    rotation.value = withSpring(0, SPRING_CONFIG);
    setTimeout(() => setIsOpen(false), 200);
  };

  const toggleFAB = () => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  };

  const mainButtonStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const bottomOffset = Math.max(insets.bottom + 80, 100);
  const fabRight = isTablet ? horizontalPadding + Spacing.lg : Spacing.lg;

  return (
    <>
      {isOpen && (
        <Modal
          transparent
          visible={isOpen}
          animationType="none"
          presentationStyle="overFullScreen"
          statusBarTranslucent
          onRequestClose={handleClose}
        >
          <AnimatedPressable
            style={[styles.overlay, overlayStyle]}
            onPress={handleClose}
          >
            <View style={styles.overlayBackground} />
          </AnimatedPressable>
          
          <View
            style={[
              styles.actionsContainer,
              {
                bottom: bottomOffset + 70,
                right: fabRight,
              },
            ]}
          >
            {actions.map((action, index) => (
              <FABActionItem
                key={action.id}
                action={action}
                index={index}
                progress={progress}
                theme={theme}
                isDark={isDark}
              />
            ))}
          </View>
        </Modal>
      )}
      
      {/* Main FAB — Liquid Glass on iOS 18+ (systemThinMaterial + accent
          tinted overlay), solid accent fallback on Android.
          Audit: FAB converted to glass surface to match tab bar pill style. */}
      <View
        style={[
          styles.fabContainer,
          {
            bottom: bottomOffset,
            right: fabRight,
          },
        ]}
      >
        <Pressable
          onPress={toggleFAB}
          style={({ pressed }) => [
            styles.fab,
            Platform.OS !== "ios" && { backgroundColor: Colors.accent },
            pressed && styles.fabPressed,
          ]}
          testID="provider-fab"
        >
          {Platform.OS === "ios" ? (
            <>
              <BlurView
                intensity={60}
                tint="systemThinMaterial"
                style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
                pointerEvents="none"
              />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: 28,
                    backgroundColor: Colors.accent + "CC",
                  },
                ]}
              />
            </>
          ) : null}
          <Animated.View style={mainButtonStyle}>
            <Feather
              name={isOpen ? "x" : "plus"}
              size={28}
              color="#FFFFFF"
            />
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}

interface FABActionItemProps {
  action: FABAction;
  index: number;
  progress: SharedValue<number>;
  theme: any;
  isDark: boolean;
}

function FABActionItem({
  action,
  index,
  progress,
  theme,
  isDark,
}: FABActionItemProps) {
  const offset = (index + 1) * 64;

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      progress.value,
      [0, 1],
      [offset, 0],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      progress.value,
      [0, 0.5, 1],
      [0, 0, 1],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      progress.value,
      [0, 1],
      [0.5, 1],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateY }, { scale }],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.actionRow, animatedStyle]}>
      {/* Action label pill — glass on iOS, solid on Android */}
      <View style={[styles.actionLabel, Platform.OS !== "ios" && {
        backgroundColor: isDark ? "rgba(28, 28, 30, 0.95)" : "rgba(255, 255, 255, 0.95)",
      }]}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={60}
            tint="systemMaterial"
            style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.sm }]}
            pointerEvents="none"
          />
        ) : null}
        <ThemedText
          style={[styles.actionLabelText, { color: theme.text }]}
        >
          {action.label}
        </ThemedText>
      </View>
      {/* Action button circle — glass on iOS, solid accent on Android */}
      <Pressable
        onPress={action.onPress}
        style={({ pressed }) => [
          styles.actionButton,
          Platform.OS !== "ios" && { backgroundColor: Colors.accent },
          pressed && styles.actionButtonPressed,
        ]}
        testID={`fab-action-${action.id}`}
      >
        {Platform.OS === "ios" ? (
          <>
            <BlurView
              intensity={60}
              tint="systemThinMaterial"
              style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
              pointerEvents="none"
            />
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { borderRadius: 24, backgroundColor: Colors.accent + "CC" }]}
            />
          </>
        ) : null}
        <Feather name={action.icon} size={22} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: "absolute",
    zIndex: 1000,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.lg,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  actionsContainer: {
    position: "absolute",
    zIndex: 1001,
    alignItems: "flex-end",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  actionLabel: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
    overflow: "hidden",
    ...Shadows.sm,
  },
  actionLabelText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
  actionButtonPressed: {
    backgroundColor: Colors.accentPressed,
    transform: [{ scale: 0.95 }],
  },
});
