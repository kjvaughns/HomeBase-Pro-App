import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  Switch,
  TextInput,
  Alert,
  Pressable,
  ScrollView,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusPill } from "@/components/StatusPill";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";

interface BookingLink {
  id: string;
  providerId: string;
  slug: string;
  status: "active" | "paused" | "disabled";
  isActive: boolean;
  instantBooking: boolean;
  showPricing: boolean;
  customTitle: string | null;
  customDescription: string | null;
  welcomeMessage: string | null;
  confirmationMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

function getPublicUrl(slug: string): string {
  return `https://home-base-pro-app.replit.app/providers/${slug}`;
}

export default function BookingLinkScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ bookingLinks: BookingLink[] }>({
    queryKey: ["/api/providers", providerId, "booking-links"],
    enabled: !!providerId,
  });

  const bookingLink = data?.bookingLinks?.[0] ?? null;

  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [slug, setSlug] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [instantBooking, setInstantBooking] = useState(false);
  const [showPricing, setShowPricing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (bookingLink) {
      setSlug(bookingLink.slug);
      setCustomTitle(bookingLink.customTitle ?? "");
      setCustomDescription(bookingLink.customDescription ?? "");
      setWelcomeMessage(bookingLink.welcomeMessage ?? "");
      setConfirmationMessage(bookingLink.confirmationMessage ?? "");
      setInstantBooking(bookingLink.instantBooking ?? false);
      setShowPricing(bookingLink.showPricing ?? true);
      if (mode === "view" || mode === "create") setMode("view");
    } else if (!isLoading) {
      setMode("create");
    }
  }, [bookingLink, isLoading]);

  const resetFormFromLink = useCallback((link: BookingLink) => {
    setCustomTitle(link.customTitle ?? "");
    setCustomDescription(link.customDescription ?? "");
    setWelcomeMessage(link.welcomeMessage ?? "");
    setConfirmationMessage(link.confirmationMessage ?? "");
    setInstantBooking(link.instantBooking ?? false);
    setShowPricing(link.showPricing ?? true);
  }, []);

  const invalidateLinks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/providers", providerId, "booking-links"] });
    queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "booking-links"] });
  }, [queryClient, providerId]);

  const handleCreate = useCallback(async () => {
    if (!providerId) return;
    if (!slug.trim()) {
      Alert.alert("Required", "Please enter a URL slug for your booking link.");
      return;
    }
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    setIsSaving(true);
    try {
      await apiRequest("POST", `/api/providers/${providerId}/booking-links`, {
        slug: cleanSlug,
        customTitle: customTitle.trim() || null,
        customDescription: customDescription.trim() || null,
        welcomeMessage: welcomeMessage.trim() || null,
        confirmationMessage: confirmationMessage.trim() || null,
        instantBooking,
        showPricing,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateLinks();
    } catch (err: any) {
      const msg = err?.message ?? "";
      Alert.alert(
        "Error",
        msg.includes("409") || msg.includes("already taken")
          ? "That URL slug is already taken. Try a different one."
          : "Failed to create booking link. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }, [providerId, slug, customTitle, customDescription, welcomeMessage, confirmationMessage, instantBooking, showPricing, invalidateLinks]);

  const handleSaveEdit = useCallback(async () => {
    if (!bookingLink) return;
    setIsSaving(true);
    try {
      await apiRequest("PUT", `/api/booking-links/${bookingLink.id}`, {
        customTitle: customTitle.trim() || null,
        customDescription: customDescription.trim() || null,
        welcomeMessage: welcomeMessage.trim() || null,
        confirmationMessage: confirmationMessage.trim() || null,
        instantBooking,
        showPricing,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateLinks();
      setMode("view");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  }, [bookingLink, customTitle, customDescription, welcomeMessage, confirmationMessage, instantBooking, showPricing, invalidateLinks]);

  const handleToggleActive = useCallback(async (newValue: boolean) => {
    if (!bookingLink) return;
    setIsTogglingActive(true);
    try {
      await apiRequest("PUT", `/api/booking-links/${bookingLink.id}`, {
        isActive: newValue,
        status: newValue ? "active" : "paused",
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      invalidateLinks();
    } catch {
      Alert.alert("Error", "Failed to update link status.");
    } finally {
      setIsTogglingActive(false);
    }
  }, [bookingLink, invalidateLinks]);

  const handleCopy = useCallback(async () => {
    if (!bookingLink) return;
    const url = getPublicUrl(bookingLink.slug);
    await Clipboard.setStringAsync(url);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Copied", "Booking link copied to clipboard.");
  }, [bookingLink]);

  const handleShare = useCallback(async () => {
    if (!bookingLink) return;
    const url = getPublicUrl(bookingLink.slug);
    try {
      await Share.share({ message: url, url });
    } catch {
      await Clipboard.setStringAsync(url);
      Alert.alert("Copied", "Link copied to clipboard.");
    }
  }, [bookingLink]);

  const handleDelete = useCallback(async () => {
    if (!bookingLink) return;
    setIsDeleting(true);
    try {
      await apiRequest("DELETE", `/api/booking-links/${bookingLink.id}`, undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowDeleteConfirm(false);
      setSlug("");
      setCustomTitle("");
      setCustomDescription("");
      setWelcomeMessage("");
      setConfirmationMessage("");
      setInstantBooking(false);
      setShowPricing(true);
      invalidateLinks();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to delete booking link.");
    } finally {
      setIsDeleting(false);
    }
  }, [bookingLink, invalidateLinks]);

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.center, { paddingTop: headerHeight + Spacing.xl }]}>
          <ThemedText style={{ color: theme.textSecondary }}>Loading...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (mode === "view" && bookingLink) {
    const publicUrl = getPublicUrl(bookingLink.slug);
    const isActive = bookingLink.isActive && bookingLink.status === "active";

    return (
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <GlassCard style={styles.section}>
              <View style={styles.linkHeader}>
                <View style={styles.linkIconContainer}>
                  <Feather name="link" size={20} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.linkTitle} numberOfLines={1}>
                    {bookingLink.customTitle || "My Booking Page"}
                  </ThemedText>
                  <ThemedText style={[styles.linkSlug, { color: theme.textSecondary }]}>
                    /{bookingLink.slug}
                  </ThemedText>
                </View>
                <StatusPill
                  status={isActive ? "success" : "neutral"}
                  label={isActive ? "Active" : "Paused"}
                  size="small"
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

              <ThemedText
                style={[styles.urlText, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {publicUrl}
              </ThemedText>

              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: theme.backgroundElevated }]}
                  onPress={handleCopy}
                  testID="button-copy-link"
                >
                  <Feather name="copy" size={15} color={theme.text} />
                  <ThemedText style={styles.actionBtnLabel}>Copy</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: theme.backgroundElevated }]}
                  onPress={handleShare}
                  testID="button-share-link"
                >
                  <Feather name="share-2" size={15} color={theme.text} />
                  <ThemedText style={styles.actionBtnLabel}>Share</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: Colors.accent + "15" }]}
                  onPress={() => setMode("edit")}
                  testID="button-edit-link"
                >
                  <Feather name="edit-2" size={15} color={Colors.accent} />
                  <ThemedText style={[styles.actionBtnLabel, { color: Colors.accent }]}>Edit</ThemedText>
                </Pressable>
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <GlassCard style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { marginBottom: Spacing.sm }]}>Link Status</ThemedText>
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.settingLabel}>Active</ThemedText>
                  <ThemedText style={[styles.settingDesc, { color: theme.textSecondary }]}>
                    {isActive ? "Clients can book through this link" : "Link is paused"}
                  </ThemedText>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={handleToggleActive}
                  disabled={isTogglingActive}
                  trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                  thumbColor="#FFFFFF"
                  testID="switch-link-active"
                />
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <GlassCard style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { marginBottom: Spacing.sm }]}>Settings</ThemedText>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>Instant Booking</ThemedText>
                <StatusPill
                  status={bookingLink.instantBooking ? "success" : "neutral"}
                  label={bookingLink.instantBooking ? "On" : "Off"}
                  size="small"
                />
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>Show Pricing</ThemedText>
                <StatusPill
                  status={bookingLink.showPricing ? "success" : "neutral"}
                  label={bookingLink.showPricing ? "On" : "Off"}
                  size="small"
                />
              </View>
              {bookingLink.customDescription ? (
                <View style={[styles.descBox, { backgroundColor: theme.backgroundElevated }]}>
                  <ThemedText style={[styles.descText, { color: theme.textSecondary }]} numberOfLines={3}>
                    {bookingLink.customDescription}
                  </ThemedText>
                </View>
              ) : null}
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            {showDeleteConfirm ? (
              <GlassCard style={StyleSheet.flatten([styles.section, { borderColor: "#EF444440", borderWidth: 1 }])}>
                <ThemedText style={[styles.sectionTitle, { color: "#EF4444", marginBottom: Spacing.xs }]}>
                  Delete Booking Link?
                </ThemedText>
                <ThemedText style={[styles.settingDesc, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
                  This will permanently remove your booking page. Clients will no longer be able to book through this link.
                </ThemedText>
                <View style={styles.confirmRow}>
                  <Pressable
                    style={[styles.confirmBtn, { backgroundColor: theme.backgroundElevated, flex: 1 }]}
                    onPress={() => setShowDeleteConfirm(false)}
                    testID="button-cancel-delete"
                  >
                    <ThemedText style={styles.actionBtnLabel}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.confirmBtn, { backgroundColor: "#EF4444", flex: 1 }]}
                    onPress={handleDelete}
                    disabled={isDeleting}
                    testID="button-confirm-delete"
                  >
                    <ThemedText style={[styles.actionBtnLabel, { color: "#FFFFFF" }]}>
                      {isDeleting ? "Deleting..." : "Delete"}
                    </ThemedText>
                  </Pressable>
                </View>
              </GlassCard>
            ) : (
              <Pressable
                style={[styles.deleteBtn, { borderColor: "#EF444450" }]}
                onPress={() => setShowDeleteConfirm(true)}
                testID="button-delete-link"
              >
                <Feather name="trash-2" size={16} color="#EF4444" />
                <ThemedText style={[styles.deleteBtnLabel, { color: "#EF4444" }]}>Delete Booking Link</ThemedText>
              </Pressable>
            )}
          </Animated.View>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {mode === "create" ? (
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <GlassCard style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>Booking URL</ThemedText>
                <ThemedText style={[styles.sectionDesc, { color: theme.textSecondary }]}>
                  Choose a unique slug for your public booking page
                </ThemedText>
              </View>
              <View style={styles.slugContainer}>
                <ThemedText style={[styles.slugPrefix, { color: theme.textSecondary }]}>
                  /book/
                </ThemedText>
                <TextInput
                  style={[styles.slugInput, { color: theme.text, borderColor: theme.borderLight, backgroundColor: theme.cardBackground }]}
                  value={slug}
                  onChangeText={(t) => setSlug(t.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="your-business"
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="input-slug"
                />
              </View>
            </GlassCard>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Page Details</ThemedText>
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Custom Title</ThemedText>
              <TextInput
                style={[styles.textInput, { color: theme.text, borderColor: theme.borderLight, backgroundColor: theme.cardBackground }]}
                value={customTitle}
                onChangeText={setCustomTitle}
                placeholder="e.g. Book a Service with Us"
                placeholderTextColor={theme.textTertiary}
                testID="input-custom-title"
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Description</ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea, { color: theme.text, borderColor: theme.borderLight, backgroundColor: theme.cardBackground }]}
                value={customDescription}
                onChangeText={setCustomDescription}
                placeholder="Describe your services or what clients can expect..."
                placeholderTextColor={theme.textTertiary}
                multiline
                numberOfLines={3}
                testID="input-custom-description"
              />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Messages</ThemedText>
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Welcome Message</ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea, { color: theme.text, borderColor: theme.borderLight, backgroundColor: theme.cardBackground }]}
                value={welcomeMessage}
                onChangeText={setWelcomeMessage}
                placeholder="Welcome! We're glad you're here..."
                placeholderTextColor={theme.textTertiary}
                multiline
                numberOfLines={3}
                testID="input-welcome-message"
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Confirmation Message</ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea, { color: theme.text, borderColor: theme.borderLight, backgroundColor: theme.cardBackground }]}
                value={confirmationMessage}
                onChangeText={setConfirmationMessage}
                placeholder="Thanks for booking! We'll be in touch soon..."
                placeholderTextColor={theme.textTertiary}
                multiline
                numberOfLines={3}
                testID="input-confirmation-message"
              />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Booking Options</ThemedText>
            </View>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.settingLabel}>Instant Booking</ThemedText>
                <ThemedText style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  Confirm appointments automatically without review
                </ThemedText>
              </View>
              <Switch
                value={instantBooking}
                onValueChange={setInstantBooking}
                trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                thumbColor="#FFFFFF"
                testID="switch-instant-booking"
              />
            </View>
            <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.settingLabel}>Show Pricing</ThemedText>
                <ThemedText style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  Display your service prices on the booking page
                </ThemedText>
              </View>
              <Switch
                value={showPricing}
                onValueChange={setShowPricing}
                trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                thumbColor="#FFFFFF"
                testID="switch-show-pricing"
              />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          {mode === "edit" ? (
            <View style={styles.editActions}>
              <Pressable
                style={[styles.cancelBtn, { borderColor: theme.borderLight }]}
                onPress={() => {
                  if (bookingLink) resetFormFromLink(bookingLink);
                  setMode("view");
                }}
                testID="button-cancel-edit"
              >
                <ThemedText style={{ ...Typography.body, fontWeight: "500" }}>Cancel</ThemedText>
              </Pressable>
              <PrimaryButton
                onPress={handleSaveEdit}
                disabled={isSaving}
                style={{ flex: 1 }}
                testID="button-save-link"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </PrimaryButton>
            </View>
          ) : (
            <PrimaryButton
              onPress={handleCreate}
              disabled={isSaving}
              testID="button-create-link"
            >
              {isSaving ? "Creating..." : "Create Booking Link"}
            </PrimaryButton>
          )}
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.title3,
    fontWeight: "600",
  },
  sectionDesc: {
    ...Typography.subhead,
    marginTop: 4,
  },
  linkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  linkIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  linkTitle: {
    ...Typography.body,
    fontWeight: "600",
  },
  linkSlug: {
    ...Typography.caption1,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.sm,
  },
  urlText: {
    ...Typography.footnote,
    marginBottom: Spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  actionBtnLabel: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  settingLabel: {
    ...Typography.body,
    fontWeight: "500",
    marginBottom: 2,
  },
  settingDesc: {
    ...Typography.caption1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  infoLabel: {
    ...Typography.footnote,
  },
  descBox: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  descText: {
    ...Typography.footnote,
    lineHeight: 18,
  },
  slugContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  slugPrefix: {
    ...Typography.body,
  },
  slugInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...Typography.body,
  },
  fieldGroup: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    ...Typography.subhead,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  textInput: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...Typography.body,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  editActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  deleteBtnLabel: {
    ...Typography.body,
    fontWeight: "500",
  },
  confirmRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  confirmBtn: {
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
