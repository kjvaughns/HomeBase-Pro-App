import React, { useState, useMemo } from "react";
import { StyleSheet, View, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { TimeSlot } from "@/state/types";

type ScreenRouteProp = RouteProp<RootStackParamList, "BookingSchedule">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function BookingScheduleScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const params = route.params;

  const getProviderAvailability = useHomeownerStore((s) => s.getProviderAvailability);
  
  const availability = useMemo(() => {
    return getProviderAvailability(params.providerId);
  }, [getProviderAvailability, params.providerId]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const dates = useMemo(() => {
    const uniqueDates = [...new Set(availability.map((s) => s.date))];
    return uniqueDates.slice(0, 14).map((dateStr) => {
      const date = new Date(dateStr + "T00:00:00");
      return {
        dateStr,
        dayName: WEEKDAYS[date.getDay()],
        dayNum: date.getDate(),
        month: MONTHS[date.getMonth()],
      };
    });
  }, [availability]);

  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    return availability.filter((s) => s.date === selectedDate && s.available);
  }, [availability, selectedDate]);

  const formatTime = (time: string) => {
    const [hour] = time.split(":");
    const h = parseInt(hour, 10);
    if (h === 0) return "12 AM";
    if (h < 12) return `${h} AM`;
    if (h === 12) return "12 PM";
    return `${h - 12} PM`;
  };

  const handleNext = () => {
    if (!selectedSlot) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("BookingAddress", {
      ...params,
      scheduledDate: selectedSlot.date,
      scheduledTime: formatTime(selectedSlot.startTime),
    });
  };

  const renderDateItem = ({ item }: { item: typeof dates[0] }) => {
    const isSelected = selectedDate === item.dateStr;
    return (
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setSelectedDate(item.dateStr);
          setSelectedSlot(null);
        }}
        style={[
          styles.dateCard,
          {
            backgroundColor: isSelected ? Colors.accent : theme.cardBackground,
            borderColor: isSelected ? Colors.accent : theme.borderLight,
          },
        ]}
      >
        <ThemedText
          style={[styles.dateDayName, { color: isSelected ? "#fff" : theme.textSecondary }]}
        >
          {item.dayName}
        </ThemedText>
        <ThemedText style={[styles.dateDayNum, { color: isSelected ? "#fff" : theme.text }]}>
          {item.dayNum}
        </ThemedText>
        <ThemedText
          style={[styles.dateMonth, { color: isSelected ? "#fff" : theme.textSecondary }]}
        >
          {item.month}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View
        style={{
          paddingTop: headerHeight + Spacing.lg,
          paddingHorizontal: Spacing.screenPadding,
          flex: 1,
        }}
      >
        <ThemedText style={styles.stepIndicator}>Step 2 of 4</ThemedText>

        <ThemedText style={styles.sectionTitle}>Select a Date</ThemedText>
        <FlatList
          data={dates}
          renderItem={renderDateItem}
          keyExtractor={(item) => item.dateStr}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateList}
        />

        {selectedDate ? (
          <>
            <ThemedText style={[styles.sectionTitle, styles.sectionMargin]}>
              Available Times
            </ThemedText>
            {slotsForDate.length > 0 ? (
              <View style={styles.slotsGrid}>
                {slotsForDate.map((slot) => {
                  const isSelected = selectedSlot?.id === slot.id;
                  return (
                    <Pressable
                      key={slot.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedSlot(slot);
                      }}
                      style={[
                        styles.slotCard,
                        {
                          backgroundColor: isSelected ? Colors.accent : theme.cardBackground,
                          borderColor: isSelected ? Colors.accent : theme.borderLight,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[styles.slotTime, { color: isSelected ? "#fff" : theme.text }]}
                      >
                        {formatTime(slot.startTime)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.noSlots}>
                <Feather name="calendar" size={32} color={theme.textTertiary} />
                <ThemedText style={[styles.noSlotsText, { color: theme.textSecondary }]}>
                  No available slots for this date
                </ThemedText>
              </View>
            )}
          </>
        ) : (
          <View style={styles.placeholder}>
            <Feather name="calendar" size={48} color={theme.textTertiary} />
            <ThemedText style={[styles.placeholderText, { color: theme.textSecondary }]}>
              Select a date to see available times
            </ThemedText>
          </View>
        )}
      </View>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <PrimaryButton
          label="Continue to Address"
          onPress={handleNext}
          disabled={!selectedSlot}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepIndicator: {
    ...Typography.caption1,
    color: Colors.accent,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  sectionMargin: {
    marginTop: Spacing.xl,
  },
  dateList: {
    gap: Spacing.sm,
  },
  dateCard: {
    width: 64,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  dateDayName: {
    ...Typography.caption2,
    fontWeight: "500",
  },
  dateDayNum: {
    ...Typography.title2,
    fontWeight: "700",
    marginVertical: 2,
  },
  dateMonth: {
    ...Typography.caption2,
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  slotCard: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  slotTime: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  noSlots: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  noSlotsText: {
    ...Typography.subhead,
    marginTop: Spacing.md,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    ...Typography.subhead,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  bottomBar: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
});
