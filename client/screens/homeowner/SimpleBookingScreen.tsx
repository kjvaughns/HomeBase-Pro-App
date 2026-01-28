import React, { useState, useMemo } from "react";
import { StyleSheet, View, ScrollView, Pressable, FlatList, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { TimeSlot, PaymentMethod } from "@/state/types";

type ScreenRouteProp = RouteProp<RootStackParamList, "SimpleBooking">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function SimpleBookingScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const params = route.params;

  const profile = useHomeownerStore((s) => s.profile);
  const addPaymentMethod = useHomeownerStore((s) => s.addPaymentMethod);
  const getProviderAvailability = useHomeownerStore((s) => s.getProviderAvailability);
  const addAppointment = useHomeownerStore((s) => s.addAppointment);

  const paymentMethods = profile?.paymentMethods || [];
  const defaultPayment = paymentMethods.find((p) => p.isDefault) || paymentMethods[0];

  const availability = useMemo(() => {
    return getProviderAvailability(params.providerId);
  }, [getProviderAvailability, params.providerId]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(defaultPayment || null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardForm, setCardForm] = useState({ cardNumber: "", expiry: "", cvv: "", name: "" });
  const [isBooking, setIsBooking] = useState(false);

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

  const handleAddCard = () => {
    if (!cardForm.cardNumber || !cardForm.expiry) {
      Alert.alert("Missing Info", "Please fill in card details");
      return;
    }

    const last4 = cardForm.cardNumber.slice(-4);
    const [month, year] = cardForm.expiry.split("/");

    const newMethod: PaymentMethod = {
      id: `pm-${Date.now()}`,
      type: "card",
      label: "Visa",
      last4,
      expiryMonth: parseInt(month, 10),
      expiryYear: 2000 + parseInt(year, 10),
      isDefault: paymentMethods.length === 0,
    };

    addPaymentMethod(newMethod);
    setSelectedPayment(newMethod);
    setShowAddCard(false);
    setCardForm({ cardNumber: "", expiry: "", cvv: "", name: "" });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleBook = async () => {
    if (!selectedSlot || !selectedPayment) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Missing Info", "Please select a date, time, and payment method");
      return;
    }

    setIsBooking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Create appointment
    const appointment = {
      id: `apt-${Date.now()}`,
      providerId: params.providerId,
      providerName: params.providerName,
      category: params.intakeData?.category || "general",
      service: params.intakeData?.recommendedService || "Service",
      description: params.intakeData?.problemDescription || "",
      scheduledDate: selectedSlot.date,
      scheduledTime: formatTime(selectedSlot.startTime),
      status: "pending" as const,
      estimatedPrice: params.intakeData?.priceRange || { min: 0, max: 0 },
      createdAt: new Date().toISOString(),
      conditionUpdates: [],
    };

    addAppointment(appointment);

    setTimeout(() => {
      setIsBooking(false);
      navigation.navigate("BookingSuccess", { jobId: appointment.id });
    }, 1500);
  };

  const canBook = selectedSlot && selectedPayment;

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
        <ThemedText style={[styles.dateDayName, isSelected && styles.selectedText]}>
          {item.dayName}
        </ThemedText>
        <ThemedText style={[styles.dateDayNum, isSelected && styles.selectedText]}>
          {item.dayNum}
        </ThemedText>
        <ThemedText style={[styles.dateMonth, isSelected && styles.selectedText]}>
          {item.month}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Card */}
        {params.intakeData ? (
          <Animated.View entering={FadeInDown.delay(100)}>
            <GlassCard style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Feather name="clipboard" size={20} color={Colors.accent} />
                <ThemedText style={styles.summaryTitle}>Service Summary</ThemedText>
              </View>
              <ThemedText style={[styles.summaryText, { color: theme.textSecondary }]}>
                {params.intakeData.issueSummary || params.intakeData.problemDescription}
              </ThemedText>
              <View style={styles.summaryMeta}>
                <View style={styles.metaItem}>
                  <Feather name="tag" size={14} color={Colors.accent} />
                  <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                    {params.intakeData.recommendedService}
                  </ThemedText>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="dollar-sign" size={14} color={Colors.accent} />
                  <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                    ${params.intakeData.priceRange.min} - ${params.intakeData.priceRange.max}
                  </ThemedText>
                </View>
              </View>
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Provider Info */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <GlassCard style={styles.providerCard}>
            <View style={styles.providerRow}>
              <View style={[styles.providerAvatar, { backgroundColor: Colors.accentLight }]}>
                <ThemedText style={styles.providerInitial}>
                  {params.providerName?.charAt(0) || "P"}
                </ThemedText>
              </View>
              <View style={styles.providerInfo}>
                <ThemedText style={styles.providerName}>{params.providerName}</ThemedText>
                <ThemedText style={[styles.providerCategory, { color: theme.textSecondary }]}>
                  {params.intakeData?.category || "Service Provider"}
                </ThemedText>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Date Selection */}
        <Animated.View entering={FadeInDown.delay(300)}>
          <ThemedText style={styles.sectionTitle}>Select Date</ThemedText>
          <FlatList
            horizontal
            data={dates}
            renderItem={renderDateItem}
            keyExtractor={(item) => item.dateStr}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateList}
          />
        </Animated.View>

        {/* Time Slots */}
        {selectedDate ? (
          <Animated.View entering={FadeInDown.delay(100)} style={styles.timeSlotsSection}>
            <ThemedText style={styles.sectionTitle}>Select Time</ThemedText>
            {slotsForDate.length > 0 ? (
              <View style={styles.slotsGrid}>
                {slotsForDate.map((slot) => {
                  const isSelected = selectedSlot?.startTime === slot.startTime;
                  return (
                    <Pressable
                      key={slot.startTime}
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
                      <ThemedText style={[styles.slotText, isSelected && styles.selectedText]}>
                        {formatTime(slot.startTime)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.noSlotsCard, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="clock" size={24} color={theme.textTertiary} />
                <ThemedText style={[styles.noSlotsText, { color: theme.textSecondary }]}>
                  No available times for this date
                </ThemedText>
              </View>
            )}
          </Animated.View>
        ) : null}

        {/* Payment Method */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.paymentSection}>
          <ThemedText style={styles.sectionTitle}>Payment Method</ThemedText>
          
          {paymentMethods.length > 0 ? (
            <View style={styles.paymentList}>
              {paymentMethods.map((method) => {
                const isSelected = selectedPayment?.id === method.id;
                return (
                  <Pressable
                    key={method.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedPayment(method);
                    }}
                    style={[
                      styles.paymentCard,
                      {
                        backgroundColor: isSelected ? Colors.accentLight : theme.cardBackground,
                        borderColor: isSelected ? Colors.accent : theme.borderLight,
                      },
                    ]}
                  >
                    <View style={styles.paymentRow}>
                      <View style={[styles.paymentIcon, { backgroundColor: isDark ? theme.backgroundTertiary : "#f0f0f0" }]}>
                        <Feather name="credit-card" size={18} color={Colors.accent} />
                      </View>
                      <View style={styles.paymentInfo}>
                        <ThemedText style={styles.paymentLabel}>{method.label}</ThemedText>
                        <ThemedText style={[styles.paymentDetails, { color: theme.textSecondary }]}>
                          ending in {method.last4}
                        </ThemedText>
                      </View>
                      {isSelected ? (
                        <View style={[styles.checkCircle, { backgroundColor: Colors.accent }]}>
                          <Feather name="check" size={14} color="#fff" />
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {!showAddCard ? (
            <Pressable
              onPress={() => setShowAddCard(true)}
              style={[styles.addCardBtn, { borderColor: theme.borderLight }]}
            >
              <Feather name="plus" size={18} color={Colors.accent} />
              <ThemedText style={[styles.addCardText, { color: Colors.accent }]}>
                Add Payment Method
              </ThemedText>
            </Pressable>
          ) : (
            <View style={[styles.cardForm, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
              <ThemedText style={styles.formTitle}>Add Card</ThemedText>
              <TextField
                placeholder="Card Number"
                value={cardForm.cardNumber}
                onChangeText={(v) => setCardForm((f) => ({ ...f, cardNumber: v }))}
                keyboardType="number-pad"
                maxLength={16}
              />
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <TextField
                    placeholder="MM/YY"
                    value={cardForm.expiry}
                    onChangeText={(v) => setCardForm((f) => ({ ...f, expiry: v }))}
                    maxLength={5}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    placeholder="CVV"
                    value={cardForm.cvv}
                    onChangeText={(v) => setCardForm((f) => ({ ...f, cvv: v }))}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              </View>
              <TextField
                placeholder="Name on Card"
                value={cardForm.name}
                onChangeText={(v) => setCardForm((f) => ({ ...f, name: v }))}
              />
              <View style={styles.formActions}>
                <Pressable onPress={() => setShowAddCard(false)} style={styles.cancelBtn}>
                  <ThemedText style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</ThemedText>
                </Pressable>
                <Pressable onPress={handleAddCard} style={[styles.saveBtn, { backgroundColor: Colors.accent }]}>
                  <ThemedText style={styles.saveText}>Add Card</ThemedText>
                </Pressable>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Bottom CTA */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: isDark ? theme.backgroundSecondary : theme.backgroundRoot,
            borderTopColor: theme.borderLight,
            paddingBottom: Math.max(insets.bottom, Spacing.md),
          },
        ]}
      >
        <View style={styles.priceRow}>
          {params.intakeData?.priceRange ? (
            <>
              <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>Estimated</ThemedText>
              <ThemedText style={styles.priceValue}>
                ${params.intakeData.priceRange.min} - ${params.intakeData.priceRange.max}
              </ThemedText>
            </>
          ) : (
            <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
              Price to be confirmed
            </ThemedText>
          )}
        </View>
        <PrimaryButton
          onPress={handleBook}
          disabled={!canBook || isBooking}
          style={{ flex: 1 }}
        >
          {isBooking ? "Booking..." : "Request Appointment"}
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  summaryCard: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  summaryTitle: {
    ...Typography.headline,
  },
  summaryText: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  summaryMeta: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.subhead,
  },
  providerCard: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  providerInitial: {
    ...Typography.title2,
    color: Colors.accent,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    ...Typography.headline,
    marginBottom: 2,
  },
  providerCategory: {
    ...Typography.subhead,
    textTransform: "capitalize",
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  dateList: {
    paddingVertical: Spacing.xs,
  },
  dateCard: {
    width: 64,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  dateDayName: {
    ...Typography.caption2,
    marginBottom: 2,
  },
  dateDayNum: {
    ...Typography.title3,
    marginBottom: 2,
  },
  dateMonth: {
    ...Typography.caption2,
  },
  selectedText: {
    color: "#fff",
  },
  timeSlotsSection: {
    marginTop: Spacing.lg,
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  slotCard: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minWidth: 80,
    alignItems: "center",
  },
  slotText: {
    ...Typography.subhead,
  },
  noSlotsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    gap: Spacing.sm,
  },
  noSlotsText: {
    ...Typography.subhead,
    textAlign: "center",
  },
  paymentSection: {
    marginTop: Spacing.xl,
  },
  paymentList: {
    gap: Spacing.sm,
  },
  paymentCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentInfo: {
    flex: 1,
  },
  paymentLabel: {
    ...Typography.headline,
  },
  paymentDetails: {
    ...Typography.caption1,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: Spacing.md,
  },
  addCardText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  cardForm: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  formTitle: {
    ...Typography.headline,
    marginBottom: Spacing.xs,
  },
  formRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  cancelBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  cancelText: {
    ...Typography.subhead,
  },
  saveBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  saveText: {
    ...Typography.subhead,
    fontWeight: "600",
    color: "#fff",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  priceRow: {
    alignItems: "flex-start",
  },
  priceLabel: {
    ...Typography.caption2,
  },
  priceValue: {
    ...Typography.headline,
    color: Colors.accent,
  },
});
