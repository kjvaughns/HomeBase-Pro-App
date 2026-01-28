import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Modal,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  SharedValue,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { Colors, Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

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
  
  const progress = useSharedValue(0);
  const rotation = useSharedValue(0);

  const actions: FABAction[] = [
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
  const { width: screenWidth } = Dimensions.get("window");

  return (
    <>
      {isOpen && (
        <Modal transparent visible={isOpen} animationType="none">
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
                bottom: bottomOffset,
                right: Spacing.lg,
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
      
      <View
        style={[
          styles.fabContainer,
          {
            bottom: bottomOffset,
            right: Spacing.lg,
          },
        ]}
      >
        <Pressable
          onPress={toggleFAB}
          style={({ pressed }) => [
            styles.fab,
            pressed && styles.fabPressed,
          ]}
          testID="provider-fab"
        >
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
      <View
        style={[
          styles.actionLabel,
          {
            backgroundColor: isDark
              ? "rgba(28, 28, 30, 0.95)"
              : "rgba(255, 255, 255, 0.95)",
          },
        ]}
      >
        <Text
          style={[
            styles.actionLabelText,
            { color: theme.text },
          ]}
        >
          {action.label}
        </Text>
      </View>
      <Pressable
        onPress={action.onPress}
        style={({ pressed }) => [
          styles.actionButton,
          pressed && styles.actionButtonPressed,
        ]}
        testID={`fab-action-${action.id}`}
      >
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
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.lg,
  },
  fabPressed: {
    backgroundColor: Colors.accentPressed,
    transform: [{ scale: 0.95 }],
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
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
  actionButtonPressed: {
    backgroundColor: Colors.accentPressed,
    transform: [{ scale: 0.95 }],
  },
});
