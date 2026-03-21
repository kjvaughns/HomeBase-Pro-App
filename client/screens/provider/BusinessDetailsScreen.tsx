import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusPill } from "@/components/StatusPill";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface BusinessHoursDay {
  enabled: boolean;
  open: string;
  close: string;
}

interface BookingPoliciesData {
  depositRequired: boolean;
  depositPercent: string;
  cancellationHours: string;
  cancellationFee: string;
  rescheduleHours: string;
  lateFeePercent: string;
}

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

const DEFAULT_HOURS: Record<DayKey, BusinessHoursDay> = {
  mon: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
  tue: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
  wed: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
  thu: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
  fri: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
  sat: { enabled: true, open: "9:00 AM", close: "4:00 PM" },
  sun: { enabled: false, open: "Closed", close: "Closed" },
};

const DEFAULT_POLICIES: BookingPoliciesData = {
  depositRequired: true,
  depositPercent: "25",
  cancellationHours: "24",
  cancellationFee: "50",
  rescheduleHours: "12",
  lateFeePercent: "10",
};

export default function BusinessDetailsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();
  const queryClient = useQueryClient();

  const providerId = providerProfile?.id;

  const [saved, setSaved] = useState(false);

  // Load current provider data
  const { data: providerData } = useQuery<{ provider: any }>({
    queryKey: ["/api/provider", providerId],
    enabled: !!providerId,
  });

  const provider = providerData?.provider;

  // Booking policies
  const [policies, setPolicies] = useState<BookingPoliciesData>(DEFAULT_POLICIES);

  // Service area
  const [serviceRadius, setServiceRadius] = useState("25");
  const [zipCodes, setZipCodes] = useState("");
  const [cities, setCities] = useState("");

  // Business hours
  const [hours, setHours] = useState<Record<DayKey, BusinessHoursDay>>(DEFAULT_HOURS);

  // Public profile toggle
  const [isPublicProfile, setIsPublicProfile] = useState(false);

  // Populate from API data
  useEffect(() => {
    if (!provider) return;

    if (provider.bookingPolicies) {
      try {
        const parsed = JSON.parse(provider.bookingPolicies);
        setPolicies({ ...DEFAULT_POLICIES, ...parsed });
      } catch {}
    }

    if (provider.businessHours) {
      try {
        const parsed = JSON.parse(provider.businessHours);
        setHours({ ...DEFAULT_HOURS, ...parsed });
      } catch {}
    }

    if (provider.serviceRadius) {
      setServiceRadius(String(provider.serviceRadius));
    }
    if (provider.serviceZipCodes) {
      setZipCodes(provider.serviceZipCodes);
    }
    if (provider.serviceCities) {
      setCities(provider.serviceCities);
    }
    if (provider.isPublicProfile !== undefined) {
      setIsPublicProfile(provider.isPublicProfile);
    }
  }, [provider]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await apiRequest("PATCH", `/api/provider/${providerId}`, payload);
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      bookingPolicies: JSON.stringify(policies),
      businessHours: JSON.stringify(hours),
      serviceRadius: parseInt(serviceRadius) || null,
      serviceZipCodes: zipCodes.trim() || null,
      serviceCities: cities.trim() || null,
      isPublicProfile,
    });
  };

  const toggleDay = (day: DayKey) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const updateHour = (day: DayKey, field: "open" | "close", value: string) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Public Profile Toggle */}
        <Animated.View entering={FadeInDown.delay(0).duration(300)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="globe" size={18} color={Colors.accent} />
              <ThemedText style={styles.sectionTitle}>Public Profile</ThemedText>
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <ThemedText style={styles.switchLabel}>Visible to clients</ThemedText>
                <ThemedText style={[styles.switchSubtitle, { color: theme.textSecondary }]}>
                  {isPublicProfile
                    ? "Clients can discover your public booking page."
                    : "Your profile is hidden. Enable to accept bookings."}
                </ThemedText>
              </View>
              <Switch
                value={isPublicProfile}
                onValueChange={setIsPublicProfile}
                trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
            {isPublicProfile ? (
              <View style={[styles.activeBadge, { backgroundColor: Colors.accentLight }]}>
                <Feather name="check-circle" size={14} color={Colors.accent} />
                <ThemedText style={[styles.activeBadgeText, { color: Colors.accent }]}>
                  Profile is publicly discoverable
                </ThemedText>
              </View>
            ) : null}
          </GlassCard>
        </Animated.View>

        {/* Booking Policies */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="file-text" size={18} color={Colors.accent} />
              <ThemedText style={styles.sectionTitle}>Booking Policies</ThemedText>
            </View>

            <View style={styles.policyRow}>
              <View style={styles.policyLeft}>
                <ThemedText style={styles.policyLabel}>Require Deposit</ThemedText>
                <ThemedText style={[styles.policySubtitle, { color: theme.textSecondary }]}>
                  Collect upfront payment on booking
                </ThemedText>
              </View>
              <Switch
                value={policies.depositRequired}
                onValueChange={(v) => setPolicies((p) => ({ ...p, depositRequired: v }))}
                trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            {policies.depositRequired ? (
              <View style={styles.inputRow}>
                <View style={styles.inputWrapper}>
                  <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Deposit Amount
                  </ThemedText>
                  <View style={styles.inputGroup}>
                    <TextInput
                      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                      value={policies.depositPercent}
                      onChangeText={(v) => setPolicies((p) => ({ ...p, depositPercent: v }))}
                      keyboardType="number-pad"
                      maxLength={3}
                      placeholderTextColor={theme.textTertiary}
                    />
                    <ThemedText style={{ color: theme.textSecondary }}>%</ThemedText>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={[styles.divider, { backgroundColor: theme.separator }]} />

            <View style={styles.inputRow}>
              <View style={styles.inputWrapper}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Cancel Window
                </ThemedText>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                    value={policies.cancellationHours}
                    onChangeText={(v) => setPolicies((p) => ({ ...p, cancellationHours: v }))}
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholderTextColor={theme.textTertiary}
                  />
                  <ThemedText style={{ color: theme.textSecondary }}>hrs</ThemedText>
                </View>
              </View>
              <View style={styles.inputWrapper}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Cancellation Fee
                </ThemedText>
                <View style={styles.inputGroup}>
                  <ThemedText style={{ color: theme.textSecondary }}>$</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                    value={policies.cancellationFee}
                    onChangeText={(v) => setPolicies((p) => ({ ...p, cancellationFee: v }))}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholderTextColor={theme.textTertiary}
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputWrapper}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Reschedule Window
                </ThemedText>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                    value={policies.rescheduleHours}
                    onChangeText={(v) => setPolicies((p) => ({ ...p, rescheduleHours: v }))}
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholderTextColor={theme.textTertiary}
                  />
                  <ThemedText style={{ color: theme.textSecondary }}>hrs</ThemedText>
                </View>
              </View>
              <View style={styles.inputWrapper}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Late Fee
                </ThemedText>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                    value={policies.lateFeePercent}
                    onChangeText={(v) => setPolicies((p) => ({ ...p, lateFeePercent: v }))}
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholderTextColor={theme.textTertiary}
                  />
                  <ThemedText style={{ color: theme.textSecondary }}>%</ThemedText>
                </View>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Service Areas */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="map-pin" size={18} color={Colors.accent} />
              <ThemedText style={styles.sectionTitle}>Service Area</ThemedText>
            </View>

            <View style={styles.inputWrapper}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Service Radius
              </ThemedText>
              <View style={styles.inputGroup}>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                  value={serviceRadius}
                  onChangeText={setServiceRadius}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholderTextColor={theme.textTertiary}
                />
                <ThemedText style={{ color: theme.textSecondary }}>miles</ThemedText>
              </View>
            </View>

            <View style={[styles.inputWrapper, { marginTop: Spacing.md }]}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                ZIP Codes (comma separated)
              </ThemedText>
              <TextInput
                style={[styles.textArea, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                value={zipCodes}
                onChangeText={setZipCodes}
                multiline
                numberOfLines={2}
                placeholder="94102, 94103, 94104"
                placeholderTextColor={theme.textTertiary}
              />
            </View>

            <View style={[styles.inputWrapper, { marginTop: Spacing.md }]}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Cities Served
              </ThemedText>
              <TextInput
                style={[styles.textArea, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                value={cities}
                onChangeText={setCities}
                multiline
                numberOfLines={2}
                placeholder="San Francisco, Oakland, Daly City"
                placeholderTextColor={theme.textTertiary}
              />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Business Hours */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={18} color={Colors.accent} />
              <ThemedText style={styles.sectionTitle}>Business Hours</ThemedText>
            </View>

            {DAYS.map((day) => {
              const dayData = hours[day.key];
              return (
                <View key={day.key} style={styles.hoursRow}>
                  <Pressable
                    style={[
                      styles.dayToggle,
                      dayData.enabled && { backgroundColor: Colors.accentLight },
                    ]}
                    onPress={() => toggleDay(day.key)}
                  >
                    <ThemedText
                      style={[
                        styles.dayLabel,
                        dayData.enabled && { color: Colors.accent, fontWeight: "600" },
                        !dayData.enabled && { color: theme.textTertiary },
                      ]}
                    >
                      {day.short}
                    </ThemedText>
                  </Pressable>

                  {dayData.enabled ? (
                    <View style={styles.hoursInputs}>
                      <TextInput
                        style={[styles.timeInput, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                        value={dayData.open}
                        onChangeText={(v) => updateHour(day.key, "open", v)}
                        placeholder="8:00 AM"
                        placeholderTextColor={theme.textTertiary}
                      />
                      <ThemedText style={[styles.timeSep, { color: theme.textTertiary }]}>—</ThemedText>
                      <TextInput
                        style={[styles.timeInput, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                        value={dayData.close}
                        onChangeText={(v) => updateHour(day.key, "close", v)}
                        placeholder="6:00 PM"
                        placeholderTextColor={theme.textTertiary}
                      />
                    </View>
                  ) : (
                    <View style={styles.closedBadge}>
                      <ThemedText style={[styles.closedLabel, { color: theme.textTertiary }]}>
                        Closed
                      </ThemedText>
                    </View>
                  )}
                </View>
              );
            })}
          </GlassCard>
        </Animated.View>

        {saved ? (
          <Animated.View entering={FadeInDown.delay(0).duration(300)}>
            <View style={[styles.successBanner, { backgroundColor: Colors.accentLight }]}>
              <Feather name="check-circle" size={16} color={Colors.accent} />
              <ThemedText style={[styles.successText, { color: Colors.accent }]}>
                Business details saved
              </ThemedText>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <PrimaryButton onPress={handleSave} loading={saveMutation.isPending}>
            Save Changes
          </PrimaryButton>
        </Animated.View>
      </ScrollView>
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
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.headline,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  switchLeft: {
    flex: 1,
  },
  switchLabel: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: 2,
  },
  switchSubtitle: {
    ...Typography.footnote,
    lineHeight: 18,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.md,
    alignSelf: "flex-start",
  },
  activeBadgeText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  policyLeft: {
    flex: 1,
  },
  policyLabel: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  policySubtitle: {
    ...Typography.footnote,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.md,
  },
  inputRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    ...Typography.caption1,
    fontWeight: "500",
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  input: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    minWidth: 50,
  },
  textArea: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    minHeight: 72,
    textAlignVertical: "top",
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  dayToggle: {
    width: 44,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: {
    ...Typography.footnote,
    fontWeight: "500",
  },
  hoursInputs: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  timeInput: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    ...Typography.caption1,
    textAlign: "center",
  },
  timeSep: {
    ...Typography.body,
  },
  closedBadge: {
    flex: 1,
    alignItems: "flex-start",
    paddingLeft: Spacing.sm,
  },
  closedLabel: {
    ...Typography.footnote,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  successText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
});
