import React, { useState } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { Avatar } from "@/components/Avatar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Spacing, Colors, Typography } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const navigation = useNavigation();
  const { theme } = useTheme();

  const profile = useHomeownerStore((s) => s.profile);
  const updateProfile = useHomeownerStore((s) => s.updateProfile);
  const { user, updateUser } = useAuthStore();

  const [name, setName] = useState(profile?.name || user?.name || "");
  const [phone, setPhone] = useState(profile?.phone || user?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const handlePickAvatar = async () => {
    if (!user?.id || isUploadingAvatar) return;
    setAvatarError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setAvatarError("Photo access is required to update your avatar.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsUploadingAvatar(true);
      const asset = result.assets[0];
      const mime = asset.mimeType || "image/jpeg";
      const base64DataUrl = `data:${mime};base64,${asset.base64}`;

      const response = await apiRequest("POST", `/api/user/${user.id}/avatar`, {
        base64: base64DataUrl,
      });
      const data = await response.json();
      const newUrl: string | undefined = data?.avatarUrl;
      if (newUrl) {
        setAvatarUrl(newUrl);
        updateUser({ avatarUrl: newUrl });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.replace(/^\d{3}:\s*/, "") || "Couldn't update avatar. Please try again."
          : "Couldn't update avatar. Please try again.";
      setAvatarError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

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
          paddingHorizontal: horizontalPadding,
        }}
      >
        <View style={styles.avatarSection}>
          <Pressable
            onPress={handlePickAvatar}
            disabled={isUploadingAvatar}
            style={styles.avatarPress}
            testID="button-edit-avatar"
          >
            <Avatar name={name} uri={avatarUrl} size="large" />
            <View style={[styles.avatarBadge, { backgroundColor: Colors.accent }]}>
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="camera" size={14} color="#FFFFFF" />
              )}
            </View>
          </Pressable>
          <ThemedText style={[styles.avatarHint, { color: theme.textSecondary }]}>
            Tap to change photo
          </ThemedText>
          {avatarError ? (
            <ThemedText
              style={[styles.errorText, { color: theme.textSecondary, marginTop: Spacing.sm }]}
              testID="text-avatar-error"
            >
              {avatarError}
            </ThemedText>
          ) : null}
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
  avatarPress: {
    position: "relative",
  },
  avatarBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarHint: {
    ...Typography.caption1,
    marginTop: Spacing.md,
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
