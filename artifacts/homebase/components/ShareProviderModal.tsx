import React from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Share,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";

interface Props {
  visible: boolean;
  providerName: string;
  providerBookingLink: string;
  onDismiss: () => void;
}

export function ShareProviderModal({
  visible,
  providerName,
  providerBookingLink,
  onDismiss,
}: Props) {
  const { theme } = useTheme();

  const shareMessage = `Hey! I just had a great experience with ${providerName} on HomeBase. You should check them out — book directly here: ${providerBookingLink}`;

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: shareMessage,
        url: Platform.OS === "ios" ? providerBookingLink : undefined,
      });
    } catch {
      // user dismissed share sheet — no-op
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.cardBackground }]}>
          <View style={[styles.iconWrap, { backgroundColor: Colors.accentLight }]}>
            <Feather name="share-2" size={28} color={Colors.accent} />
          </View>

          <ThemedText style={styles.title}>
            Share {providerName} with a neighbor?
          </ThemedText>
          <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
            One tap to send a recommendation with their booking link.
          </ThemedText>

          <PrimaryButton
            onPress={handleShare}
            style={styles.shareBtn}
            testID="button-share-provider"
          >
            Share {providerName}
          </PrimaryButton>

          <Pressable onPress={onDismiss} style={styles.skipBtn} testID="button-skip-share-provider">
            <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
              No thanks
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    paddingBottom: Spacing["2xl"],
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.title2,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  body: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  shareBtn: {
    width: "100%",
    marginBottom: Spacing.sm,
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  skipText: {
    ...Typography.subhead,
  },
});
