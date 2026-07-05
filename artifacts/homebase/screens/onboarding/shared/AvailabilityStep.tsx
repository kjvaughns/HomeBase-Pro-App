import React from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { GlassCard } from "@/components/GlassCard";
import { useLayout } from "@/hooks/useLayout";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { DAYS_OF_WEEK, START_TIMES, END_TIMES } from "./onboardingConstants";

// Shared by both the pre-signup provider onboarding funnel
// (ProviderOnboardingScreen) and the post-signup setup wizard
// (ProviderSetupFlow) — this is the "when are you available?"
// days + start/end time picker, previously duplicated in both files.
export function AvailabilityStep({
  header,
  activeDays,
  setActiveDays,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
}: {
  header: React.ReactNode;
  activeDays: string[];
  setActiveDays: (v: string[]) => void;
  startTime: string;
  setStartTime: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
}) {
  const { theme } = useTheme();
  const { horizontalPadding } = useLayout();

  const toggleDay = (dayId: string) => {
    Haptics.selectionAsync();
    const next = activeDays.includes(dayId)
      ? activeDays.filter((d) => d !== dayId)
      : [...activeDays, dayId];
    setActiveDays(next);
  };

  const useStandardHours = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveDays(["mon", "tue", "wed", "thu", "fri"]);
    setStartTime("8:00 AM");
    setEndTime("6:00 PM");
  };

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={[
        styles.stepScrollContent,
        { paddingHorizontal: horizontalPadding },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {header}

      <GlassCard style={styles.card}>
        <View style={styles.fieldLabelRow}>
          <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Working days
          </ThemedText>
          <Pressable
            onPress={useStandardHours}
            style={[styles.standardHoursBtn, { borderColor: Colors.accent }]}
            testID="button-standard-hours"
          >
            <Feather name="clock" size={12} color={Colors.accent} />
            <ThemedText type="caption" style={{ color: Colors.accent, fontWeight: "500" }}>
              Mon–Fri 8am–6pm
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.daysRow}>
          {DAYS_OF_WEEK.map((day) => {
            const active = activeDays.includes(day.id);
            return (
              <Pressable
                key={day.id}
                onPress={() => toggleDay(day.id)}
                testID={`day-${day.id}`}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                style={[
                  styles.dayPill,
                  {
                    backgroundColor: active ? Colors.accent : theme.backgroundElevated,
                    borderColor: active ? Colors.accent : theme.borderLight,
                  },
                ]}
              >
                <ThemedText
                  style={{
                    color: active ? "#fff" : theme.text,
                    fontWeight: active ? "600" : "400",
                    fontSize: 13,
                  }}
                >
                  {day.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ThemedText
          style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: Spacing.xl }]}
        >
          Hours
        </ThemedText>
        <View style={styles.hoursRow}>
          <View style={styles.hoursBlock}>
            <ThemedText
              type="caption"
              style={{ color: theme.textTertiary, marginBottom: Spacing.xs }}
            >
              Start
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.timeScroll}
              contentContainerStyle={{ gap: Spacing.xs }}
            >
              {START_TIMES.map((t) => {
                const selected = startTime === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setStartTime(t);
                    }}
                    testID={`start-time-${t}`}
                    style={[
                      styles.timePill,
                      {
                        backgroundColor: selected ? Colors.accent : theme.backgroundElevated,
                        borderColor: selected ? Colors.accent : theme.borderLight,
                      },
                    ]}
                  >
                    <ThemedText style={{ color: selected ? "#fff" : theme.text, fontSize: 12 }}>
                      {t}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.hoursBlock}>
            <ThemedText
              type="caption"
              style={{ color: theme.textTertiary, marginBottom: Spacing.xs }}
            >
              End
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.timeScroll}
              contentContainerStyle={{ gap: Spacing.xs }}
            >
              {END_TIMES.map((t) => {
                const selected = endTime === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setEndTime(t);
                    }}
                    testID={`end-time-${t}`}
                    style={[
                      styles.timePill,
                      {
                        backgroundColor: selected ? Colors.accent : theme.backgroundElevated,
                        borderColor: selected ? Colors.accent : theme.borderLight,
                      },
                    ]}
                  >
                    <ThemedText style={{ color: selected ? "#fff" : theme.text, fontSize: 12 }}>
                      {t}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View style={[styles.availabilitySummary, { backgroundColor: Colors.accent + "12" }]}>
          <Feather name="clock" size={16} color={Colors.accent} />
          <ThemedText type="caption" style={{ color: Colors.accent, flex: 1 }}>
            {activeDays.length > 0
              ? `${activeDays.length} days/week · ${startTime} – ${endTime}`
              : "No days selected yet"}
          </ThemedText>
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stepScroll: { flex: 1 },
  stepScrollContent: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  card: { marginBottom: Spacing.lg },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  standardHoursBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  daysRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
    marginBottom: Spacing.sm,
  },
  dayPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  hoursRow: { gap: Spacing.md },
  hoursBlock: { gap: Spacing.xs },
  timeScroll: { maxHeight: 40 },
  timePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  availabilitySummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
});
