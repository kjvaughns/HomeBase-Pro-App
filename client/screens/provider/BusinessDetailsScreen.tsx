import React, { useState } from "react";
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

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface BusinessHours {
  enabled: boolean;
  open: string;
  close: string;
}

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export default function BusinessDetailsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const [isSaving, setIsSaving] = useState(false);

  const [depositRequired, setDepositRequired] = useState(true);
  const [depositPercent, setDepositPercent] = useState("25");
  const [cancellationHours, setCancellationHours] = useState("24");
  const [cancellationFee, setCancellationFee] = useState("50");
  const [rescheduleHours, setRescheduleHours] = useState("12");
  const [lateFeePercent, setLateFeePercent] = useState("10");

  const [serviceRadius, setServiceRadius] = useState("25");
  const [zipCodes, setZipCodes] = useState("94102, 94103, 94104, 94105, 94107");
  const [cities, setCities] = useState("San Francisco, Daly City, South San Francisco");

  const [hours, setHours] = useState<Record<DayKey, BusinessHours>>({
    mon: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
    tue: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
    wed: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
    thu: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
    fri: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
    sat: { enabled: true, open: "9:00 AM", close: "4:00 PM" },
    sun: { enabled: false, open: "Closed", close: "Closed" },
  });

  const toggleDay = (day: DayKey) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
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
                  Collect upfront payment
                </ThemedText>
              </View>
              <Switch
                value={depositRequired}
                onValueChange={setDepositRequired}
                trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            {depositRequired ? (
              <View style={styles.inputRow}>
                <View style={styles.inputWrapper}>
                  <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Deposit Amount
                  </ThemedText>
                  <View style={styles.inputGroup}>
                    <TextInput
                      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                      value={depositPercent}
                      onChangeText={setDepositPercent}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <ThemedText style={{ color: theme.textSecondary }}>%</ThemedText>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.inputRow}>
              <View style={styles.inputWrapper}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Cancellation Window
                </ThemedText>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                    value={cancellationHours}
                    onChangeText={setCancellationHours}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <ThemedText style={{ color: theme.textSecondary }}>hours</ThemedText>
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
                    value={cancellationFee}
                    onChangeText={setCancellationFee}
                    keyboardType="number-pad"
                    maxLength={4}
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
                    value={rescheduleHours}
                    onChangeText={setRescheduleHours}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <ThemedText style={{ color: theme.textSecondary }}>hours</ThemedText>
                </View>
              </View>
              <View style={styles.inputWrapper}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Late Fee
                </ThemedText>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                    value={lateFeePercent}
                    onChangeText={setLateFeePercent}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <ThemedText style={{ color: theme.textSecondary }}>%</ThemedText>
                </View>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="map" size={18} color={Colors.accent} />
              <ThemedText style={styles.sectionTitle}>Service Areas</ThemedText>
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
              />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={18} color={Colors.accent} />
              <ThemedText style={styles.sectionTitle}>Business Hours</ThemedText>
            </View>

            {DAYS.map((day) => (
              <View key={day.key} style={styles.hoursRow}>
                <Pressable
                  style={[
                    styles.dayToggle,
                    hours[day.key].enabled && { backgroundColor: Colors.accent + "20" },
                  ]}
                  onPress={() => toggleDay(day.key)}
                >
                  <ThemedText
                    style={[
                      styles.dayLabel,
                      hours[day.key].enabled && { color: Colors.accent },
                    ]}
                  >
                    {day.label}
                  </ThemedText>
                </Pressable>
                <View style={styles.hoursTime}>
                  {hours[day.key].enabled ? (
                    <>
                      <ThemedText style={{ color: theme.text }}>
                        {hours[day.key].open}
                      </ThemedText>
                      <ThemedText style={{ color: theme.textSecondary }}> - </ThemedText>
                      <ThemedText style={{ color: theme.text }}>
                        {hours[day.key].close}
                      </ThemedText>
                    </>
                  ) : (
                    <ThemedText style={{ color: theme.textTertiary }}>Closed</ThemedText>
                  )}
                </View>
                <Switch
                  value={hours[day.key].enabled}
                  onValueChange={() => toggleDay(day.key)}
                  trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <PrimaryButton onPress={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
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
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headline,
    fontWeight: "600",
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  policyLeft: {
    flex: 1,
  },
  policyLabel: {
    ...Typography.body,
    fontWeight: "500",
  },
  policySubtitle: {
    ...Typography.caption1,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(128,128,128,0.2)",
    marginVertical: Spacing.md,
  },
  inputRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    ...Typography.caption1,
    marginBottom: Spacing.xs,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  input: {
    ...Typography.body,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    minWidth: 60,
    textAlign: "center",
  },
  textArea: {
    ...Typography.body,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    minHeight: 60,
    textAlignVertical: "top",
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.1)",
  },
  dayToggle: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    width: 100,
  },
  dayLabel: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  hoursTime: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
