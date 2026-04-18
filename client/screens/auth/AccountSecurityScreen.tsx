import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { apiRequest, queryClient } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type ActiveSheet = "email" | "password" | null;

/**
 * Parse the error thrown by `apiRequest`. The helper rejects with
 * `${status}: ${responseText}` where responseText is typically a JSON body
 * like `{"error":"…"}`. We map well-known status codes to friendly copy.
 */
function parseApiError(err: unknown, fallback: string): { status: number | null; message: string } {
  if (!(err instanceof Error)) return { status: null, message: fallback };
  const match = err.message.match(/^(\d{3}):\s*(.*)$/s);
  if (!match) return { status: null, message: err.message || fallback };
  const status = Number(match[1]);
  let serverMsg: string | null = null;
  try {
    const parsed = JSON.parse(match[2]);
    if (parsed && typeof parsed.error === "string") serverMsg = parsed.error;
  } catch {
    // not JSON — fall through to raw text
    serverMsg = match[2] || null;
  }
  return { status, message: serverMsg || fallback };
}

export default function AccountSecurityScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user, activeRole, updateUser, setSessionToken, logout } = useAuthStore();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const isProvider = activeRole === "provider";
  const { isSubscribed, isInGrace, daysRemainingInGrace, status } = useSubscriptionStatus();
  const subscriptionSubtitle = isSubscribed
    ? "Active — manage your HomeBase Pro plan"
    : isInGrace
      ? `${daysRemainingInGrace ?? 7} days left in trial`
      : status === "expired"
        ? "Trial ended — subscribe to reactivate"
        : "Free until your first paid booking";

  const [active, setActive] = useState<ActiveSheet>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await apiRequest("DELETE", "/api/auth/account", undefined);
      setShowDeleteModal(false);
      logout();
    } catch (err: unknown) {
      console.error("Delete account error:", err);
      const { message } = parseApiError(
        err,
        "Couldn't delete your account. Please try again or contact support.",
      );
      setDeleteError(message);
    } finally {
      setDeleteLoading(false);
    }
  };

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

        {isProvider ? (
          <>
            <ThemedText
              style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.xl }]}
            >
              Subscription
            </ThemedText>
            <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
              <Row
                label="Subscription & Plan"
                value={subscriptionSubtitle}
                icon="credit-card"
                onPress={() => navigation.navigate("Subscription")}
                theme={theme}
                isFirst
                isLast
                testID="row-subscription"
              />
            </View>
          </>
        ) : null}

        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.xl }]}
        >
          Danger Zone
        </ThemedText>
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Pressable
            onPress={() => setShowDeleteModal(true)}
            style={({ pressed }) => [
              styles.row,
              {
                opacity: pressed ? 0.6 : 1,
                borderRadius: BorderRadius.lg,
              },
            ]}
            testID="button-delete-account"
          >
            <View style={[styles.rowIcon, { backgroundColor: "#FF3B3014" }]}>
              <Feather name="trash-2" size={18} color="#FF3B30" />
            </View>
            <View style={styles.rowText}>
              <ThemedText style={[styles.rowLabel, { color: "#FF3B30" }]}>
                Delete Account
              </ThemedText>
              <ThemedText style={[styles.rowValue, { color: theme.textSecondary }]}>
                Permanently remove your account and data
              </ThemedText>
            </View>
          </Pressable>
        </View>
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
            // Refresh any cached server data tied to this user account.
            queryClient.invalidateQueries();
          }}
        />
      </Modal>

      <Modal
        visible={active === "password"}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActive(null)}
      >
        <ChangePasswordSheet
          onClose={() => setActive(null)}
          onSuccess={(newToken) => {
            // Server bumped tokenVersion + reissued JWT. Persist the new bearer
            // token so subsequent requests don't 401 with the stale token.
            if (newToken) setSessionToken(newToken);
            queryClient.invalidateQueries();
          }}
        />
      </Modal>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: "#FF3B3014" }]}>
              <Feather name="trash-2" size={28} color="#FF3B30" />
            </View>
            <ThemedText style={styles.modalTitle}>Delete Account</ThemedText>
            <ThemedText style={[styles.modalBody, { color: theme.textSecondary }]}>
              {isProvider
                ? "This will permanently delete your provider account and all associated data including your clients, jobs, invoices, and business profile. This action cannot be undone."
                : "This will permanently delete your account and all associated data. This action cannot be undone."}
            </ThemedText>
            {deleteError ? (
              <ThemedText
                style={[styles.modalBody, { color: "#FF3B30", marginBottom: Spacing.md }]}
                testID="text-delete-error"
              >
                {deleteError}
              </ThemedText>
            ) : null}
            <Pressable
              style={[styles.modalDeleteBtn, deleteLoading && { opacity: 0.7 }]}
              onPress={handleDeleteAccount}
              disabled={deleteLoading}
              testID="button-confirm-delete"
            >
              {deleteLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.modalDeleteText}>Delete My Account</ThemedText>
              )}
            </Pressable>
            <Pressable
              style={[styles.modalCancelBtn, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => {
                setDeleteError(null);
                setShowDeleteModal(false);
              }}
              disabled={deleteLoading}
              testID="button-cancel-delete"
            >
              <ThemedText style={[styles.modalCancelText, { color: theme.text }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
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

function SheetHeader({
  title,
  onClose,
  theme,
}: {
  title: string;
  onClose: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
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

function SuccessBanner({ message }: { message: string }) {
  return (
    <View style={[styles.successBanner, { backgroundColor: Colors.accent + "1A", borderColor: Colors.accent }]}>
      <Feather name="check-circle" size={18} color={Colors.accent} />
      <ThemedText style={[styles.successText, { color: Colors.accent }]} testID="text-success">
        {message}
      </ThemedText>
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
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [passwordFieldError, setPasswordFieldError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit =
    currentPassword.length > 0 && newEmail.trim().length > 0 && !saving && !success;

  const handleSave = async () => {
    setEmailFieldError(null);
    setPasswordFieldError(null);
    setGeneralError(null);
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiRequest("POST", "/api/auth/change-email", {
        currentPassword,
        newEmail: newEmail.trim(),
      });
      const data = await res.json();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
      onSuccess(data.email || newEmail.trim().toLowerCase());
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      const { status, message } = parseApiError(err, "Couldn't update email. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (status === 401) {
        setPasswordFieldError("Current password is incorrect");
      } else if (status === 409) {
        setEmailFieldError("That email is already in use");
      } else if (status === 400) {
        // Server validation message is user-friendly enough to surface inline.
        if (/email/i.test(message)) {
          setEmailFieldError(message);
        } else if (/password/i.test(message)) {
          setPasswordFieldError(message);
        } else {
          setGeneralError(message);
        }
      } else {
        setGeneralError(message);
      }
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
        {success ? <SuccessBanner message="Email updated" /> : null}

        <View style={styles.field}>
          <ThemedText style={styles.label}>Current email</ThemedText>
          <ThemedText style={[styles.readonly, { color: theme.textSecondary }]}>
            {currentEmail}
          </ThemedText>
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>New email</ThemedText>
          <TextField
            placeholder="you@example.com"
            value={newEmail}
            onChangeText={(v) => {
              setNewEmail(v);
              if (emailFieldError) setEmailFieldError(null);
            }}
            leftIcon="mail"
            autoCapitalize="none"
            keyboardType="email-address"
            testID="input-new-email"
          />
          {emailFieldError ? (
            <ThemedText style={styles.fieldError} testID="text-email-field-error">
              {emailFieldError}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Current password</ThemedText>
          <TextField
            placeholder="Enter your password"
            value={currentPassword}
            onChangeText={(v) => {
              setCurrentPassword(v);
              if (passwordFieldError) setPasswordFieldError(null);
            }}
            leftIcon="lock"
            secureTextEntry
            testID="input-current-password-email"
          />
          {passwordFieldError ? (
            <ThemedText style={styles.fieldError} testID="text-password-field-error">
              {passwordFieldError}
            </ThemedText>
          ) : null}
        </View>

        {generalError ? (
          <ThemedText style={styles.errorText} testID="text-email-error">
            {generalError}
          </ThemedText>
        ) : null}
      </KeyboardAwareScrollViewCompat>

      <View
        style={[
          styles.sheetFooter,
          { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundDefault },
        ]}
      >
        <PrimaryButton
          onPress={handleSave}
          disabled={!canSubmit}
          loading={saving}
          testID="button-save-email"
        >
          Save Email
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

function ChangePasswordSheet({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (newToken: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentFieldError, setCurrentFieldError] = useState<string | null>(null);
  const [newFieldError, setNewFieldError] = useState<string | null>(null);
  const [confirmFieldError, setConfirmFieldError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword.length > 0 &&
    !saving &&
    !success;

  const handleSave = async () => {
    setCurrentFieldError(null);
    setNewFieldError(null);
    setConfirmFieldError(null);
    setGeneralError(null);

    if (newPassword !== confirmPassword) {
      setConfirmFieldError("New passwords don't match");
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
      onSuccess(typeof data?.token === "string" ? data.token : null);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      const { status, message } = parseApiError(
        err,
        "Couldn't update password. Please try again.",
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (status === 401) {
        setCurrentFieldError("Current password is incorrect");
      } else if (status === 400) {
        if (/at least/i.test(message) || /new password/i.test(message)) {
          setNewFieldError(message);
        } else if (/current/i.test(message)) {
          setCurrentFieldError(message);
        } else {
          setGeneralError(message);
        }
      } else {
        setGeneralError(message);
      }
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
        {success ? <SuccessBanner message="Password updated" /> : null}

        <View style={styles.field}>
          <ThemedText style={styles.label}>Current password</ThemedText>
          <TextField
            placeholder="Enter your current password"
            value={currentPassword}
            onChangeText={(v) => {
              setCurrentPassword(v);
              if (currentFieldError) setCurrentFieldError(null);
            }}
            leftIcon="lock"
            secureTextEntry
            testID="input-current-password"
          />
          {currentFieldError ? (
            <ThemedText style={styles.fieldError} testID="text-current-password-error">
              {currentFieldError}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>New password</ThemedText>
          <TextField
            placeholder="At least 8 characters"
            value={newPassword}
            onChangeText={(v) => {
              setNewPassword(v);
              if (newFieldError) setNewFieldError(null);
            }}
            leftIcon="lock"
            secureTextEntry
            testID="input-new-password"
          />
          {newFieldError ? (
            <ThemedText style={styles.fieldError} testID="text-new-password-error">
              {newFieldError}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Confirm new password</ThemedText>
          <TextField
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChangeText={(v) => {
              setConfirmPassword(v);
              if (confirmFieldError) setConfirmFieldError(null);
            }}
            leftIcon="lock"
            secureTextEntry
            testID="input-confirm-password"
          />
          {confirmFieldError ? (
            <ThemedText style={styles.fieldError} testID="text-confirm-password-error">
              {confirmFieldError}
            </ThemedText>
          ) : null}
        </View>

        {generalError ? (
          <ThemedText style={styles.errorText} testID="text-password-error">
            {generalError}
          </ThemedText>
        ) : null}

        <ThemedText style={[styles.helperText, { color: theme.textTertiary, marginTop: 0 }]}>
          You'll stay signed in on this device. Other devices will be signed out.
        </ThemedText>
      </KeyboardAwareScrollViewCompat>

      <View
        style={[
          styles.sheetFooter,
          { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundDefault },
        ]}
      >
        <PrimaryButton
          onPress={handleSave}
          disabled={!canSubmit}
          loading={saving}
          testID="button-save-password"
        >
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
  fieldError: {
    ...Typography.caption1,
    color: "#D43838",
    marginTop: Spacing.xs,
  },
  errorText: {
    ...Typography.subhead,
    color: "#D43838",
    textAlign: "center",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  successText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  modalCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: "100%",
    alignItems: "center",
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.title2,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  modalBody: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  modalDeleteBtn: {
    backgroundColor: "#FF3B30",
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    width: "100%",
    alignItems: "center",
    marginBottom: Spacing.sm,
    minHeight: 48,
    justifyContent: "center",
  },
  modalDeleteText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  modalCancelBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    width: "100%",
    alignItems: "center",
  },
  modalCancelText: {
    fontWeight: "600",
    fontSize: 16,
  },
});
