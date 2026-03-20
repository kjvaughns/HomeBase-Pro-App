import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { Avatar } from "@/components/Avatar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();

  const profile = useHomeownerStore((s) => s.profile);
  const updateProfile = useHomeownerStore((s) => s.updateProfile);

  const [name, setName] = useState(profile?.name || "");
  const [email, setEmail] = useState(profile?.email || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateProfile({ name, email, phone });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.screenPadding,
        }}
      >
        <View style={styles.avatarSection}>
          <Avatar name={name} size="large" />
          <ThemedText style={[styles.avatarHint, { color: theme.textTertiary }]}>
            Tap to change photo
          </ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <ThemedText style={styles.label}>Full Name</ThemedText>
            <TextField
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
              leftIcon="user"
            />
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <TextField
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              leftIcon="mail"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>Phone</ThemedText>
            <TextField
              placeholder="Enter your phone number"
              value={phone}
              onChangeText={setPhone}
              leftIcon="phone"
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <PrimaryButton
          onPress={handleSave}
          disabled={!name.trim() || !email.trim() || isSaving}
          loading={isSaving}
        >
          Save Changes
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatarHint: {
    ...Typography.caption1,
    marginTop: Spacing.sm,
  },
  form: {
    gap: Spacing.lg,
  },
  field: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
});
