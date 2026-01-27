import React from "react";
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  Image,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Colors } from "@/constants/theme";

interface AccountGateModalProps {
  visible: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
}

export function AccountGateModal({
  visible,
  onClose,
  onSignIn,
  onSignUp,
}: AccountGateModalProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
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
            >
              <Feather name="x" size={20} color={theme.text} />
            </Pressable>

            <View style={styles.handle} />

            <Image
              source={require("../../assets/images/account-gate.png")}
              style={styles.image}
              resizeMode="contain"
            />

            <ThemedText type="h1" style={styles.title}>
              Sign in to continue
            </ThemedText>

            <ThemedText
              type="body"
              style={[styles.description, { color: theme.textSecondary }]}
            >
              Create an account or sign in to book services, message providers,
              and manage your home projects.
            </ThemedText>

            <View style={styles.actions}>
              <PrimaryButton
                onPress={onSignUp}
                icon={<Feather name="user-plus" size={20} color="#FFFFFF" />}
                style={styles.button}
              >
                Get Started
              </PrimaryButton>

              <SecondaryButton onPress={onSignIn} style={styles.button}>
                Sign In
              </SecondaryButton>
            </View>

            <ThemedText
              type="caption"
              style={[styles.terms, { color: theme.textTertiary }]}
            >
              By continuing, you agree to our Terms of Service and Privacy
              Policy.
            </ThemedText>
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
  image: {
    width: 160,
    height: 160,
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    maxWidth: 300,
  },
  actions: {
    width: "100%",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  button: {
    width: "100%",
  },
  terms: {
    textAlign: "center",
    maxWidth: 280,
  },
});
