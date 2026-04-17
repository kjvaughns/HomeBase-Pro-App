import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius, Colors } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";

type ActiveSheet = "email" | "password" | null;

export default function AccountSecurityScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user, updateUser } = useAuthStore();

  const [active, setActive] = useState<ActiveSheet>(null);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
      >
        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Sign-in
        </ThemedText>
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Row
            label="Email"
            value={user?.email ?? "—"}
            icon="mail"
            onPress={() => setActive("email")}
            theme={theme}
            isFirst
            testID="row-change-email"
          />
          <Row
            label="Password"
            value="••••••••"
            icon="lock"
            onPress={() => setActive("password")}
            theme={theme}
            isLast
            testID="row-change-password"
          />
        </View>

        <ThemedText style={[styles.helperText, { color: theme.textTertiary }]}>
          Changing your password signs you out of all other devices.
        </ThemedText>
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={active === "email"}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActive(null)}
      >
        <ChangeEmailSheet
          currentEmail={user?.email ?? ""}
          onClose={() => setActive(null)}
          onSuccess={(newEmail) => {
            updateUser({ email: newEmail });
            setActive(null);
          }}
        />
      </Modal>

      <Modal
        visible={active === "password"}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActive(null)}
      >
        <ChangePasswordSheet onClose={() => setActive(null)} onSuccess={() => setActive(null)} />
      </Modal>
    </ThemedView>
  );
}

function Row({
  label,
  value,
  icon,
  onPress,
  theme,
  isFirst,
  isLast,
  testID,
}: {
  label: string;
  value: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
  isFirst?: boolean;
  isLast?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          opacity: pressed ? 0.6 : 1,
          borderTopLeftRadius: isFirst ? BorderRadius.lg : 0,
          borderTopRightRadius: isFirst ? BorderRadius.lg : 0,
          borderBottomLeftRadius: isLast ? BorderRadius.lg : 0,
          borderBottomRightRadius: isLast ? BorderRadius.lg : 0,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
      ]}
      testID={testID}
    >
      <View style={[styles.rowIcon, { backgroundColor: Colors.accent + "15" }]}>
        <Feather name={icon} size={18} color={Colors.accent} />
      </View>
      <View style={styles.rowText}>
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        <ThemedText style={[styles.rowValue, { color: theme.textSecondary }]} numberOfLines={1}>
          {value}
        </ThemedText>
      </View>
      <Feather name="chevron-right" size={20} color={theme.textTertiary} />
    </Pressable>
  );
}

function SheetHeader({ title, onClose, theme }: { title: string; onClose: () => void; theme: ReturnType<typeof useTheme>["theme"] }) {
  return (
    <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
      <Pressable onPress={onClose} hitSlop={12} testID="button-close-sheet">
        <ThemedText style={[styles.sheetCancel, { color: Colors.accent }]}>Cancel</ThemedText>
      </Pressable>
      <ThemedText style={styles.sheetTitle}>{title}</ThemedText>
      <View style={{ width: 60 }} />
    </View>
  );
}

function ChangeEmailSheet({
  currentEmail,
  onClose,
  onSuccess,
}: {
  currentEmail: string;
  onClose: () => void;
  onSuccess: (newEmail: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSubmit = currentPassword.length > 0 && newEmail.trim().length > 0 && !saving;

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiRequest("POST", "/api/auth/change-email", {
        currentPassword,
        newEmail: newEmail.trim(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to change email");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess(data.email || newEmail.trim().toLowerCase());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.sheetContainer}>
      <SheetHeader title="Change Email" onClose={onClose} theme={theme} />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          padding: Spacing.screenPadding,
          paddingBottom: insets.bottom + 120,
          gap: Spacing.lg,
        }}
      >
        <View style={styles.field}>
          <ThemedText style={styles.label}>Current email</ThemedText>
          <ThemedText style={[styles.readonly, { color: theme.textSecondary }]}>{currentEmail}</ThemedText>
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>New email</ThemedText>
          <TextField
            placeholder="you@example.com"
            value={newEmail}
            onChangeText={setNewEmail}
            leftIcon="mail"
            autoCapitalize="none"
            keyboardType="email-address"
            testID="input-new-email"
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Current password</ThemedText>
          <TextField
            placeholder="Enter your password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            leftIcon="lock"
            secureTextEntry
            testID="input-current-password-email"
          />
        </View>

        {error ? (
          <ThemedText style={[styles.errorText, { color: "#D43838" }]} testID="text-email-error">
            {error}
          </ThemedText>
        ) : null}
      </KeyboardAwareScrollViewCompat>

      <View style={[styles.sheetFooter, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundDefault }]}>
        <PrimaryButton onPress={handleSave} disabled={!canSubmit} loading={saving} testID="button-save-email">
          Save Email
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

function ChangePasswordSheet({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword.length > 0 &&
    !saving;

  const handleSave = async () => {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to change password");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.sheetContainer}>
      <SheetHeader title="Change Password" onClose={onClose} theme={theme} />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          padding: Spacing.screenPadding,
          paddingBottom: insets.bottom + 120,
          gap: Spacing.lg,
        }}
      >
        <View style={styles.field}>
          <ThemedText style={styles.label}>Current password</ThemedText>
          <TextField
            placeholder="Enter your current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            leftIcon="lock"
            secureTextEntry
            testID="input-current-password"
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>New password</ThemedText>
          <TextField
            placeholder="At least 8 characters"
            value={newPassword}
            onChangeText={setNewPassword}
            leftIcon="lock"
            secureTextEntry
            testID="input-new-password"
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Confirm new password</ThemedText>
          <TextField
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            leftIcon="lock"
            secureTextEntry
            testID="input-confirm-password"
          />
        </View>

        {error ? (
          <ThemedText style={[styles.errorText, { color: "#D43838" }]} testID="text-password-error">
            {error}
          </ThemedText>
        ) : null}

        <ThemedText style={[styles.helperText, { color: theme.textTertiary, marginTop: 0 }]}>
          You'll stay signed in on this device. Other devices will be signed out.
        </ThemedText>
      </KeyboardAwareScrollViewCompat>

      <View style={[styles.sheetFooter, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundDefault }]}>
        <PrimaryButton onPress={handleSave} disabled={!canSubmit} loading={saving} testID="button-save-password">
          Save Password
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionTitle: {
    ...Typography.footnote,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  section: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...Typography.body, fontWeight: "600" },
  rowValue: { ...Typography.subhead },
  helperText: {
    ...Typography.caption1,
    marginTop: Spacing.md,
    marginHorizontal: Spacing.sm,
  },
  sheetContainer: { flex: 1 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { ...Typography.body, fontWeight: "700" },
  sheetCancel: { ...Typography.body, width: 60 },
  field: { gap: Spacing.xs },
  label: { ...Typography.subhead, fontWeight: "600" },
  readonly: { ...Typography.body, paddingVertical: Spacing.sm },
  errorText: { ...Typography.subhead, textAlign: "center" },
  sheetFooter: {
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
