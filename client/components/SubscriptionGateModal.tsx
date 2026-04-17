import React from "react";
import { StyleSheet, View, Modal, Pressable, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Colors } from "@/constants/theme";

interface SubscriptionGateModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function SubscriptionGateModal({
  visible,
  onClose,
  title = "Subscribe to continue",
  description = "Your 7-day trial has ended. Subscribe to keep creating jobs and sending invoices. Your existing data is safe.",
}: SubscriptionGateModalProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleSubscribe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    // Navigate to in-app Subscription screen — Apple/Google IAP on native,
    // Stripe Checkout on web (handled inside SubscriptionScreen).
    try {
      navigation.navigate("Subscription");
    } catch {}
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <View
          style={[
            styles.container,
            {
              backgroundColor:
                Platform.OS === "ios" ? "transparent" : theme.backgroundRoot,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null}

          <View style={styles.content}>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: theme.backgroundDefault,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              testID="button-close-subscription-gate"
            >
              <Feather name="x" size={20} color={theme.text} />
            </Pressable>

            <View style={styles.handle} />

            <View
              style={[
                styles.iconCircle,
                { backgroundColor: Colors.accentLight },
              ]}
            >
              <Feather name="lock" size={32} color={Colors.accent} />
            </View>

            <ThemedText type="h1" style={styles.title}>
              {title}
            </ThemedText>

            <ThemedText
              type="body"
              style={[styles.description, { color: theme.textSecondary }]}
            >
              {description}
            </ThemedText>

            <View style={styles.actions}>
              <PrimaryButton
                onPress={handleSubscribe}
                icon={<Feather name="arrow-right" size={20} color="#FFFFFF" />}
                style={styles.button}
                testID="button-open-subscribe-screen"
              >
                Subscribe
              </PrimaryButton>

              <SecondaryButton
                onPress={onClose}
                style={styles.button}
                testID="button-not-now-subscribe"
              >
                Not now
              </SecondaryButton>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  content: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128, 128, 128, 0.3)",
    marginBottom: Spacing.xl,
  },
  closeButton: {
    position: "absolute",
    top: Spacing.lg,
    right: Spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    maxWidth: 320,
    lineHeight: 22,
  },
  actions: {
    width: "100%",
    gap: Spacing.md,
  },
  button: {
    width: "100%",
  },
});
