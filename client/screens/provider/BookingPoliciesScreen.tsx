import React, { useState, useCallback, useEffect } from "react";
import { StyleSheet, View, Switch, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useProviderStore } from "@/state/providerStore";
import { useAuthStore } from "@/state/authStore";
import { apiRequest, getApiUrl } from "@/lib/query-client";

export default function BookingPoliciesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();

  const bookingPolicies = useProviderStore((s) => s.bookingPolicies);
  const setBookingPolicies = useProviderStore((s) => s.setBookingPolicies);
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;

  const [requireDeposit, setRequireDeposit] = useState(bookingPolicies?.requireDeposit ?? false);
  const [depositPercent, setDepositPercent] = useState(
    bookingPolicies?.depositPercent?.toString() ?? "25"
  );
  const [cancellationHours, setCancellationHours] = useState(
    bookingPolicies?.cancellationHours?.toString() ?? "24"
  );
  const [cancellationFeePercent, setCancellationFeePercent] = useState(
    bookingPolicies?.cancellationFeePercent?.toString() ?? "50"
  );
  const [rescheduleHours, setRescheduleHours] = useState(
    bookingPolicies?.rescheduleHours?.toString() ?? "12"
  );
  const [maxReschedules, setMaxReschedules] = useState(
    bookingPolicies?.maxReschedules?.toString() ?? "2"
  );
  const [isSaving, setIsSaving] = useState(false);

  // On mount: fetch latest from server and sync local state
  useEffect(() => {
    if (!providerId) return;
    const userId = providerProfile?.userId;
    if (!userId) return;
    (async () => {
      try {
        const url = new URL(`/api/provider/user/${userId}`, getApiUrl());
        const res = await fetch(url.toString(), { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const serverPolicies = data?.provider?.bookingPolicies;
        if (serverPolicies && typeof serverPolicies === "object") {
          setBookingPolicies(serverPolicies);
          setRequireDeposit(serverPolicies.requireDeposit ?? false);
          setDepositPercent(serverPolicies.depositPercent?.toString() ?? "25");
          setCancellationHours(serverPolicies.cancellationHours?.toString() ?? "24");
          setCancellationFeePercent(serverPolicies.cancellationFeePercent?.toString() ?? "50");
          setRescheduleHours(serverPolicies.rescheduleHours?.toString() ?? "12");
          setMaxReschedules(serverPolicies.maxReschedules?.toString() ?? "2");
        }
      } catch {}
    })();
  }, [providerId]);

  const handleSave = useCallback(async () => {
    if (!providerId) {
      Alert.alert("Error", "Provider profile not found. Please re-login.");
      return;
    }
    setIsSaving(true);
    try {
      const policies = {
        requireDeposit,
        depositPercent: parseInt(depositPercent) || 25,
        cancellationHours: parseInt(cancellationHours) || 24,
        cancellationFeePercent: parseInt(cancellationFeePercent) || 50,
        rescheduleHours: parseInt(rescheduleHours) || 12,
        maxReschedules: parseInt(maxReschedules) || 2,
      };

      // Save to local store (AsyncStorage cache via Zustand persist)
      setBookingPolicies(policies);

      // Save to database via API
      await apiRequest(`/api/provider/${providerId}`, {
        method: "PATCH",
        body: JSON.stringify({ bookingPolicies: policies }),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Your booking policies have been updated.");
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save policies. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    providerId,
    requireDeposit,
    depositPercent,
    cancellationHours,
    cancellationFeePercent,
    rescheduleHours,
    maxReschedules,
    setBookingPolicies,
    navigation,
  ]);

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
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Deposit Settings</ThemedText>
              <ThemedText style={[styles.sectionDesc, { color: theme.textSecondary }]}>
                Require upfront deposits to secure bookings
              </ThemedText>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <ThemedText style={styles.settingLabel}>Require Deposit</ThemedText>
                <ThemedText style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  Clients pay a portion upfront
                </ThemedText>
              </View>
              <Switch
                value={requireDeposit}
                onValueChange={setRequireDeposit}
                trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            {requireDeposit ? (
              <View style={styles.inputRow}>
                <ThemedText style={styles.inputLabel}>Deposit Amount</ThemedText>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.borderLight,
                        color: theme.text,
                      },
                    ]}
                    value={depositPercent}
                    onChangeText={setDepositPercent}
                    keyboardType="number-pad"
                    placeholder="25"
                    placeholderTextColor={theme.textTertiary}
                  />
                  <ThemedText style={[styles.inputSuffix, { color: theme.textSecondary }]}>
                    % of total
                  </ThemedText>
                </View>
              </View>
            ) : null}
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Cancellation Policy</ThemedText>
              <ThemedText style={[styles.sectionDesc, { color: theme.textSecondary }]}>
                Set rules for when clients cancel appointments
              </ThemedText>
            </View>

            <View style={styles.inputRow}>
              <ThemedText style={styles.inputLabel}>Free Cancellation Window</ThemedText>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.borderLight,
                      color: theme.text,
                    },
                  ]}
                  value={cancellationHours}
                  onChangeText={setCancellationHours}
                  keyboardType="number-pad"
                  placeholder="24"
                  placeholderTextColor={theme.textTertiary}
                />
                <ThemedText style={[styles.inputSuffix, { color: theme.textSecondary }]}>
                  hours before
                </ThemedText>
              </View>
            </View>

            <View style={styles.inputRow}>
              <ThemedText style={styles.inputLabel}>Late Cancellation Fee</ThemedText>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.borderLight,
                      color: theme.text,
                    },
                  ]}
                  value={cancellationFeePercent}
                  onChangeText={setCancellationFeePercent}
                  keyboardType="number-pad"
                  placeholder="50"
                  placeholderTextColor={theme.textTertiary}
                />
                <ThemedText style={[styles.inputSuffix, { color: theme.textSecondary }]}>
                  % of total
                </ThemedText>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Reschedule Policy</ThemedText>
              <ThemedText style={[styles.sectionDesc, { color: theme.textSecondary }]}>
                Control how clients can change appointment times
              </ThemedText>
            </View>

            <View style={styles.inputRow}>
              <ThemedText style={styles.inputLabel}>Reschedule Window</ThemedText>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.borderLight,
                      color: theme.text,
                    },
                  ]}
                  value={rescheduleHours}
                  onChangeText={setRescheduleHours}
                  keyboardType="number-pad"
                  placeholder="12"
                  placeholderTextColor={theme.textTertiary}
                />
                <ThemedText style={[styles.inputSuffix, { color: theme.textSecondary }]}>
                  hours before
                </ThemedText>
              </View>
            </View>

            <View style={styles.inputRow}>
              <ThemedText style={styles.inputLabel}>Max Reschedules</ThemedText>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.borderLight,
                      color: theme.text,
                    },
                  ]}
                  value={maxReschedules}
                  onChangeText={setMaxReschedules}
                  keyboardType="number-pad"
                  placeholder="2"
                  placeholderTextColor={theme.textTertiary}
                />
                <ThemedText style={[styles.inputSuffix, { color: theme.textSecondary }]}>
                  per booking
                </ThemedText>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <View style={styles.policyPreview}>
            <ThemedText style={[styles.previewTitle, { color: theme.textSecondary }]}>
              Your Policy Summary
            </ThemedText>
            <ThemedText style={[styles.previewText, { color: theme.textSecondary }]}>
              {requireDeposit
                ? `Clients pay ${depositPercent}% deposit to book. `
                : "No deposit required. "}
              Free cancellation up to {cancellationHours} hours before appointment. Late
              cancellations incur a {cancellationFeePercent}% fee. Reschedules allowed up to{" "}
              {rescheduleHours} hours before, with a maximum of {maxReschedules} reschedules per
              booking.
            </ThemedText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <PrimaryButton onPress={handleSave} disabled={isSaving} style={styles.saveBtn}>
            {isSaving ? "Saving..." : "Save Policies"}
          </PrimaryButton>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.title3,
    fontWeight: "600",
  },
  sectionDesc: {
    ...Typography.subhead,
    marginTop: 4,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingLabel: {
    ...Typography.body,
    fontWeight: "500",
  },
  settingDesc: {
    ...Typography.caption1,
    marginTop: 2,
  },
  inputRow: {
    marginTop: Spacing.md,
  },
  inputLabel: {
    ...Typography.subhead,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  input: {
    width: 80,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...Typography.body,
    textAlign: "center",
  },
  inputSuffix: {
    ...Typography.body,
  },
  policyPreview: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: "rgba(56, 174, 95, 0.08)",
    borderRadius: BorderRadius.md,
  },
  previewTitle: {
    ...Typography.caption1,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  previewText: {
    ...Typography.footnote,
    lineHeight: 20,
  },
  saveBtn: {
    marginTop: Spacing.md,
  },
});
