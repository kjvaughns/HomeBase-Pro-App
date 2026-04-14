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
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();

  const profile = useHomeownerStore((s) => s.profile);
  const updateProfile = useHomeownerStore((s) => s.updateProfile);
  const { user, updateUser } = useAuthStore();

  const [name, setName] = useState(profile?.name || user?.name || "");
  const [phone, setPhone] = useState(profile?.phone || user?.phone || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    setSaveError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await apiRequest("PUT", `/api/user/${user.id}`, {
        name: name.trim(),
        phone: phone.trim() || undefined,
      });

      const data = await response.json();
      const updatedUser = data.user;

      updateUser({
        name: updatedUser.name || name.trim(),
        phone: updatedUser.phone || phone.trim() || undefined,
      });

      updateProfile({
        name: updatedUser.name || name.trim(),
        phone: updatedUser.phone || phone.trim() || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSaveError(message);
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
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <ThemedText style={styles.label}>Full Name</ThemedText>
            <TextField
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
              leftIcon="user"
              testID="input-name"
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
              testID="input-phone"
            />
          </View>

          {saveError ? (
            <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
              {saveError}
            </ThemedText>
          ) : null}
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
          disabled={!name.trim() || isSaving}
          loading={isSaving}
          testID="button-save-profile"
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
  errorText: {
    ...Typography.subhead,
    textAlign: "center",
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
