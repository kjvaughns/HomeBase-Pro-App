import React, { useState, useMemo, useEffect } from "react";
import { StyleSheet, View, ScrollView, Pressable, FlatList, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type ScreenRouteProp = RouteProp<RootStackParamList, "SimpleBooking">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TIME_SLOTS = [
  { startTime: "08:00", label: "8 AM" },
  { startTime: "09:00", label: "9 AM" },
  { startTime: "10:00", label: "10 AM" },
  { startTime: "11:00", label: "11 AM" },
  { startTime: "12:00", label: "12 PM" },
  { startTime: "13:00", label: "1 PM" },
  { startTime: "14:00", label: "2 PM" },
  { startTime: "15:00", label: "3 PM" },
  { startTime: "16:00", label: "4 PM" },
  { startTime: "17:00", label: "5 PM" },
];

interface DateItem {
  dateStr: string;
  dayName: string;
  dayNum: number;
  month: string;
}

interface HomeRecord {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean;
}

interface ProviderService {
  id: string;
  name: string;
  category: string;
  description: string | null;
  pricingType: string;
  basePrice: string | null;
  priceFrom: string | null;
  priceTo: string | null;
  priceTiersJson: string | null;
  duration: number | null;
}

export default function SimpleBookingScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const params = route.params;
  const { user } = useAuthStore();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedTimeLabel, setSelectedTimeLabel] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const { data: homesData, isLoading: homesLoading } = useQuery<{ homes: HomeRecord[] }>({
    queryKey: ["/api/homes", user?.id],
    enabled: !!user?.id,
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery<{ services: ProviderService[] }>({
    queryKey: ["/api/provider", params.providerId, "custom-services", "published"],
    queryFn: async () => {
      const url = new URL(`/api/provider/${params.providerId}/custom-services`, getApiUrl());
      url.searchParams.set("publishedOnly", "true");
      const res = await fetch(url.toString());
      return res.json();
    },
    enabled: !!params.providerId,
  });

  const { data: availabilityData, isLoading: availabilityLoading } = useQuery<{
    slots: { startTime: string; label: string }[];
    workingDays: number[];
  }>({
    queryKey: ["/api/provider", params.providerId, "availability", selectedDate],
    queryFn: async () => {
      const url = new URL(`/api/provider/${params.providerId}/availability`, getApiUrl());
      if (selectedDate) url.searchParams.set("date", selectedDate);
      const res = await fetch(url.toString());
      return res.json();
    },
    enabled: !!params.providerId && !!selectedDate,
  });

  const timeSlots = availabilityData?.slots || TIME_SLOTS;
  const workingDays = availabilityData?.workingDays ?? [1, 2, 3, 4, 5];

  const providerServices = servicesData?.services || [];

  // Pre-select service matching intakeData recommendation if available
  useEffect(() => {
    if (providerServices.length > 0 && !selectedServiceId) {
      const recommended = params.intakeData?.recommendedService;
      if (recommended) {
        const match = providerServices.find((s) =>
          s.name.toLowerCase().includes(recommended.toLowerCase()) ||
          recommended.toLowerCase().includes(s.name.toLowerCase())
        );
        if (match) setSelectedServiceId(match.id);
      } else {
        setSelectedServiceId(providerServices[0].id);
      }
    }
  }, [providerServices, params.intakeData?.recommendedService]);

  const selectedService = providerServices.find((s) => s.id === selectedServiceId);

  const homes = homesData?.homes || [];
  const defaultHome = homes.find((h) => h.isDefault) || homes[0];

  const dates = useMemo((): DateItem[] => {
    const result: DateItem[] = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      result.push({
        dateStr,
        dayName: WEEKDAYS[date.getDay()],
        dayNum: date.getDate(),
        month: MONTHS[date.getMonth()],
      });
    }
    return result;
  }, []);

  const canBook = selectedDate && selectedTime && defaultHome && selectedServiceId;

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !defaultHome || !selectedDate || !selectedTime || !selectedService) {
        throw new Error("Missing required booking data");
      }

      // Compute estimated price from the selected service
      let estimatedPrice: string | null = null;
      if (selectedService.basePrice) {
        estimatedPrice = selectedService.basePrice;
      } else if (selectedService.priceFrom && selectedService.priceTo) {
        estimatedPrice = ((parseFloat(selectedService.priceFrom) + parseFloat(selectedService.priceTo)) / 2).toString();
      } else if (params.intakeData?.priceRange) {
        estimatedPrice = ((params.intakeData.priceRange.min + params.intakeData.priceRange.max) / 2).toString();
      }

      const url = new URL("/api/appointments", getApiUrl());
      const res = await apiRequest("POST", url.toString(), {
        userId: user.id,
        homeId: defaultHome.id,
        providerId: params.providerId,
        serviceName: selectedService.name,
        description: params.intakeData?.problemDescription || params.intakeData?.issueSummary || selectedService.description || "",
        scheduledDate: new Date(selectedDate).toISOString(),
        scheduledTime: selectedTimeLabel || selectedTime,
        estimatedPrice,
        urgency: params.intakeData?.urgency || "flexible",
      });
      return res.json();
    },
    onSuccess: (data: { appointment?: { id: string } }) => {
      const appointmentId = data?.appointment?.id || "booking";
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("BookingSuccess", { jobId: appointmentId });
    },
    onError: (error: Error) => {
      Alert.alert("Booking Failed", error?.message || "Could not create your appointment. Please try again.");
    },
  });

  const handleBook = () => {
    if (!canBook) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Missing Info", "Please select a date and time");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    bookMutation.mutate();
  };

  const renderDateItem = ({ item }: { item: DateItem }) => {
    const isSelected = selectedDate === item.dateStr;
    const d = new Date(item.dateStr + "T12:00:00Z");
    const dayOfWeek = d.getUTCDay();
    const isUnavailable = !workingDays.includes(dayOfWeek);
    return (
      <Pressable
        onPress={() => {
          if (isUnavailable) return;
          Haptics.selectionAsync();
          setSelectedDate(item.dateStr);
          setSelectedTime(null);
        }}
        style={[
          styles.dateCard,
          {
            backgroundColor: isSelected ? Colors.accent : theme.cardBackground,
            borderColor: isSelected ? Colors.accent : theme.borderLight,
            opacity: isUnavailable ? 0.4 : 1,
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
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
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
                {params.intakeData.priceRange ? (
                  <View style={styles.metaItem}>
                    <Feather name="dollar-sign" size={14} color={Colors.accent} />
                    <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                      ${params.intakeData.priceRange.min} - ${params.intakeData.priceRange.max}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </GlassCard>
          </Animated.View>
        ) : null}

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

        {/* Service selector — loaded from provider's published services */}
        <Animated.View entering={FadeInDown.delay(250)}>
          <ThemedText style={styles.sectionTitle}>Select Service</ThemedText>
          {servicesLoading ? (
            <ActivityIndicator size="small" color={Colors.accent} style={{ marginBottom: Spacing.md }} />
          ) : providerServices.length > 0 ? (
            providerServices.map((svc) => {
              const isSelected = selectedServiceId === svc.id;
              let priceLabel = "Contact for pricing";
              if (svc.pricingType === "quote") {
                priceLabel = "Quote required";
              } else if (svc.priceTiersJson) {
                try {
                  const tiers: Array<{ label: string; price: string }> = JSON.parse(svc.priceTiersJson);
                  const prices = tiers.map((t) => parseFloat(t.price)).filter((p) => !isNaN(p));
                  if (prices.length > 1) {
                    priceLabel = `$${Math.min(...prices).toFixed(0)} – $${Math.max(...prices).toFixed(0)}`;
                  } else if (prices.length === 1) {
                    priceLabel = `From $${prices[0].toFixed(0)}`;
                  }
                } catch {}
              } else if (svc.basePrice) {
                priceLabel = `$${parseFloat(svc.basePrice).toFixed(0)}`;
              } else if (svc.priceFrom && svc.priceTo) {
                priceLabel = `$${parseFloat(svc.priceFrom).toFixed(0)} - $${parseFloat(svc.priceTo).toFixed(0)}`;
              }
              return (
                <Pressable
                  key={svc.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedServiceId(svc.id);
                  }}
                  style={[
                    styles.serviceCard,
                    {
                      backgroundColor: isSelected ? Colors.accent + "15" : theme.cardBackground,
                      borderColor: isSelected ? Colors.accent : theme.borderLight,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  <View style={styles.serviceCardRow}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.serviceName, isSelected && { color: Colors.accent }]}>
                        {svc.name}
                      </ThemedText>
                      {svc.description ? (
                        <ThemedText style={[styles.serviceDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                          {svc.description}
                        </ThemedText>
                      ) : null}
                    </View>
                    <View style={styles.servicePriceBox}>
                      <ThemedText style={[styles.servicePrice, isSelected && { color: Colors.accent }]}>
                        {priceLabel}
                      </ThemedText>
                      {svc.duration ? (
                        <ThemedText style={[styles.serviceDuration, { color: theme.textSecondary }]}>
                          {svc.duration} min
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <GlassCard style={styles.alertCardWarning}>
              <ThemedText style={{ color: theme.textSecondary }}>No services listed by this provider yet.</ThemedText>
            </GlassCard>
          )}
        </Animated.View>

        {!defaultHome && !homesLoading ? (
          <Animated.View entering={FadeInDown.delay(260)}>
            <GlassCard style={styles.alertCardWarning}>
              <View style={styles.alertRow}>
                <Feather name="alert-circle" size={18} color="#F59E0B" />
                <ThemedText style={{ marginLeft: Spacing.sm, flex: 1 }}>
                  Please add your home address in the app settings before booking.
                </ThemedText>
              </View>
            </GlassCard>
          </Animated.View>
        ) : null}

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

        {selectedDate ? (
          <Animated.View entering={FadeInDown.delay(100)} style={styles.timeSlotsSection}>
            <ThemedText style={styles.sectionTitle}>Select Time</ThemedText>
            {availabilityLoading ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : timeSlots.length === 0 ? (
              <GlassCard style={styles.alertCardWarning}>
                <ThemedText style={{ color: theme.textSecondary }}>
                  No available times on this date. Please select another day.
                </ThemedText>
              </GlassCard>
            ) : (
              <View style={styles.slotsGrid}>
                {timeSlots.map((slot) => {
                  const isSelected = selectedTime === slot.startTime;
                  return (
                    <Pressable
                      key={slot.startTime}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedTime(slot.startTime);
                        setSelectedTimeLabel(slot.label);
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
                        {slot.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Animated.View>
        ) : null}
      </ScrollView>

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
          {selectedService?.pricingType === "quote" ? (
            <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
              Quote will be provided
            </ThemedText>
          ) : selectedService?.priceTiersJson ? (
            (() => {
              try {
                const tiers: Array<{ label: string; price: string }> = JSON.parse(selectedService.priceTiersJson);
                const prices = tiers.map((t) => parseFloat(t.price)).filter((p) => !isNaN(p));
                if (prices.length > 1) {
                  return (
                    <>
                      <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>Range</ThemedText>
                      <ThemedText style={styles.priceValue}>
                        ${Math.min(...prices).toFixed(0)} – ${Math.max(...prices).toFixed(0)}
                      </ThemedText>
                    </>
                  );
                } else if (prices.length === 1) {
                  return (
                    <>
                      <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>From</ThemedText>
                      <ThemedText style={styles.priceValue}>${prices[0].toFixed(0)}</ThemedText>
                    </>
                  );
                }
              } catch {}
              return <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>Price to be confirmed</ThemedText>;
            })()
          ) : selectedService?.basePrice ? (
            <>
              <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>Price</ThemedText>
              <ThemedText style={styles.priceValue}>
                ${parseFloat(selectedService.basePrice).toFixed(0)}
              </ThemedText>
            </>
          ) : selectedService?.priceFrom && selectedService?.priceTo ? (
            <>
              <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>Estimated</ThemedText>
              <ThemedText style={styles.priceValue}>
                ${parseFloat(selectedService.priceFrom).toFixed(0)} - ${parseFloat(selectedService.priceTo).toFixed(0)}
              </ThemedText>
            </>
          ) : params.intakeData?.priceRange ? (
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
          disabled={!canBook || bookMutation.isPending}
          style={{ flex: 1 }}
        >
          {bookMutation.isPending ? "Booking..." : "Request Appointment"}
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
  alertCard: {
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  alertCardWarning: {
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
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
  serviceCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  serviceCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  serviceName: {
    ...Typography.headline,
    marginBottom: 2,
  },
  serviceDesc: {
    ...Typography.subhead,
    marginTop: 2,
  },
  servicePriceBox: {
    alignItems: "flex-end",
  },
  servicePrice: {
    ...Typography.headline,
  },
  serviceDuration: {
    ...Typography.caption2,
    marginTop: 2,
  },
});
