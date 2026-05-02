import React, { useState, useMemo, useEffect } from "react";
import { StyleSheet, View, ScrollView, Pressable, Alert, ActivityIndicator, Switch, TextInput } from "react-native";
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
import { useProviderPublishedServices } from "@/hooks/useProviderPublishedServices";
import { IntakeQuestionFields } from "@/components/IntakeQuestionFields";
import {
  normalizeBookingPolicy,
  summarizePolicy,
  computeDepositCents,
  dollarsToCents,
} from "@shared/bookingPolicies";
import {
  parseIntakeQuestions,
  type IntakeQuestionDef,
} from "../../../shared/jobSummary";

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

const FREQUENCY_OPTIONS = [
  { value: "biweekly", label: "Every 2 Weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
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

// Local alias kept for back-compat with the existing UI types in this file.
// The shared hook returns the same shape via PublishedProviderService.
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
  isAddon: boolean;
  addOnsJson: string | null;
  intakeQuestionsJson: string | null;
  bookingMode: string | null;
}

interface JsonAddOn {
  id: string;
  name: string;
  description?: string | null;
  price: number;
}

const JSON_ADDON_PREFIX = "json:";

type ServiceIntakeQuestion = IntakeQuestionDef;

function getPriceLabel(svc: ProviderService): string {
  if (svc.pricingType === "quote") return "Quote required";
  if (svc.priceTiersJson) {
    try {
      const tiers: Array<{ label: string; price: string }> = JSON.parse(svc.priceTiersJson);
      const prices = tiers.map((t) => parseFloat(t.price)).filter((p) => !isNaN(p));
      if (prices.length > 1) return `$${Math.min(...prices).toFixed(0)} – $${Math.max(...prices).toFixed(0)}`;
      if (prices.length === 1) return `From $${prices[0].toFixed(0)}`;
    } catch {}
  }
  if (svc.basePrice) return `$${parseFloat(svc.basePrice).toFixed(0)}`;
  if (svc.priceFrom && svc.priceTo) return `$${parseFloat(svc.priceFrom).toFixed(0)} - $${parseFloat(svc.priceTo).toFixed(0)}`;
  return "Contact for pricing";
}

function getBasePrice(svc: ProviderService): number {
  if (svc.basePrice) return parseFloat(svc.basePrice);
  if (svc.priceFrom && svc.priceTo) return (parseFloat(svc.priceFrom) + parseFloat(svc.priceTo)) / 2;
  if (svc.priceTiersJson) {
    try {
      const tiers: Array<{ label: string; price: string }> = JSON.parse(svc.priceTiersJson);
      const prices = tiers.map((t) => parseFloat(t.price)).filter((p) => !isNaN(p));
      if (prices.length > 0) return prices[0];
    } catch {}
  }
  return 0;
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
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<string>("monthly");
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({});

  const { data: homesData, isLoading: homesLoading } = useQuery<{ homes: HomeRecord[] }>({
    queryKey: ["/api/homes", user?.id],
    enabled: !!user?.id,
  });

  const { services: publishedServices, isLoading: servicesLoading } =
    useProviderPublishedServices(params.providerId);

  // Task #236: fetch provider's booking policies so we can show the
  // homeowner the policy summary + deposit estimate before they book.
  const { data: providerData } = useQuery<{
    provider?: { bookingPolicies?: unknown };
  }>({
    queryKey: ["/api/providers", params.providerId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/providers/${params.providerId}`);
      return res.json();
    },
    enabled: !!params.providerId,
  });
  const bookingPolicy = useMemo(
    () => normalizeBookingPolicy(providerData?.provider?.bookingPolicies),
    [providerData?.provider?.bookingPolicies],
  );
  const policySummaryText = useMemo(
    () => summarizePolicy(bookingPolicy),
    [bookingPolicy],
  );

  const { data: availabilityData, isLoading: availabilityLoading } = useQuery<{
    slots: { startTime: string; label: string }[];
    workingDays: number[];
  }>({
    queryKey: ["/api/provider", params.providerId, "availability", selectedDate],
    queryFn: async () => {
      const path = selectedDate
        ? `/api/provider/${params.providerId}/availability?date=${encodeURIComponent(selectedDate)}`
        : `/api/provider/${params.providerId}/availability`;
      const res = await apiRequest("GET", path);
      return res.json();
    },
    enabled: !!params.providerId && !!selectedDate,
  });

  const timeSlots = availabilityData?.slots || TIME_SLOTS;
  const workingDays = availabilityData?.workingDays ?? [1, 2, 3, 4, 5];

  const allServices: ProviderService[] = publishedServices;
  const primaryServices = allServices.filter((s) => !s.isAddon);
  const addonServices = allServices.filter((s) => s.isAddon);

  // Pre-select service matching intakeData recommendation if available
  useEffect(() => {
    if (primaryServices.length > 0 && !selectedServiceId) {
      const recommended = params.intakeData?.recommendedService;
      if (recommended) {
        const match = primaryServices.find((s) =>
          s.name.toLowerCase().includes(recommended.toLowerCase()) ||
          recommended.toLowerCase().includes(s.name.toLowerCase())
        );
        if (match) setSelectedServiceId(match.id);
        else setSelectedServiceId(primaryServices[0].id);
      } else {
        setSelectedServiceId(primaryServices[0].id);
      }
    }
  }, [allServices.length, params.intakeData?.recommendedService]);

  const selectedService = primaryServices.find((s) => s.id === selectedServiceId);

  // Parse JSON-embedded upgrades attached to the selected service.
  // Providers using the AI Service Blueprint Wizard (and the Service Summary
  // editor) save their upgrades as a JSON array on the parent service rather
  // than as standalone isAddon=true rows, so we surface both shapes here.
  const jsonAddons = useMemo<JsonAddOn[]>(() => {
    if (!selectedService?.addOnsJson) return [];
    try {
      const parsed = JSON.parse(selectedService.addOnsJson);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((entry, idx): JsonAddOn | null => {
          if (!entry || typeof entry !== "object") return null;
          const name = typeof entry.name === "string" ? entry.name.trim() : "";
          if (!name) return null;
          const rawPrice = (entry as { price?: unknown }).price;
          const price =
            typeof rawPrice === "number"
              ? rawPrice
              : typeof rawPrice === "string"
                ? parseFloat(rawPrice)
                : 0;
          const description =
            typeof (entry as { description?: unknown }).description === "string"
              ? ((entry as { description: string }).description)
              : null;
          return {
            id: `${JSON_ADDON_PREFIX}${selectedService.id}:${idx}`,
            name,
            description,
            price: Number.isFinite(price) ? price : 0,
          };
        })
        .filter((x): x is JsonAddOn => x !== null);
    } catch {
      return [];
    }
  }, [selectedService]);

  // When the primary service changes, drop only stale JSON-upgrade selections
  // (those are scoped to a specific parent service). Standalone add-on
  // services are independent rows so their selections persist.
  useEffect(() => {
    setSelectedAddonIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      const validJsonIds = new Set(jsonAddons.map((a) => a.id));
      for (const id of prev) {
        if (id.startsWith(JSON_ADDON_PREFIX)) {
          if (validJsonIds.has(id)) next.add(id);
          else changed = true;
        } else {
          next.add(id);
        }
      }
      return changed ? next : prev;
    });
  }, [selectedServiceId, jsonAddons]);

  const serviceIntakeQuestions: ServiceIntakeQuestion[] = parseIntakeQuestions(
    selectedService?.intakeQuestionsJson,
  );

  const isQuoteOnly = selectedService?.bookingMode === "quote_only";

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

  const selectedAddons = addonServices.filter((s) => selectedAddonIds.has(s.id));
  const selectedJsonAddons = jsonAddons.filter((a) => selectedAddonIds.has(a.id));

  const totalEstimatedPrice = useMemo((): string | null => {
    if (!selectedService) return null;
    let total = getBasePrice(selectedService);
    selectedAddons.forEach((a) => { total += getBasePrice(a); });
    selectedJsonAddons.forEach((a) => { total += a.price; });
    if (total > 0) return total.toFixed(2);
    if (params.intakeData?.priceRange) {
      return ((params.intakeData.priceRange.min + params.intakeData.priceRange.max) / 2).toFixed(2);
    }
    return null;
  }, [selectedService, selectedAddons, selectedJsonAddons, params.intakeData?.priceRange]);

  const toggleAddon = (id: string) => {
    Haptics.selectionAsync();
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !defaultHome || !selectedDate || !selectedTime || !selectedService) {
        throw new Error("Missing required booking data");
      }

      const allAddonNames = [
        ...selectedAddons.map((a) => a.name),
        ...selectedJsonAddons.map((a) => a.name),
      ];
      const addonNames = allAddonNames.join(", ");
      const serviceNameFull = addonNames
        ? `${selectedService.name} + ${addonNames}`
        : selectedService.name;

      const url = new URL("/api/appointments", getApiUrl());
      const intakeAnswersJson = Object.keys(intakeAnswers).length > 0 ? JSON.stringify(intakeAnswers) : undefined;
      const baseDescription =
        params.intakeData?.problemDescription ||
        params.intakeData?.issueSummary ||
        selectedService.description ||
        "";
      // Send raw fields — server recomposes the canonical description via
      // the shared formatter so all three booking entry points produce the
      // same shape. Both standalone add-on services and JSON-embedded
      // upgrades flow through as { name, price } entries.
      const structuredAddOns = [
        ...selectedAddons.map((a) => ({
          name: a.name,
          price: getBasePrice(a),
        })),
        ...selectedJsonAddons.map((a) => ({
          name: a.name,
          price: a.price,
        })),
      ];
      const res = await apiRequest("POST", url.toString(), {
        userId: user.id,
        homeId: defaultHome.id,
        providerId: params.providerId,
        serviceName: serviceNameFull,
        addOns: structuredAddOns.length > 0 ? structuredAddOns : undefined,
        description: baseDescription,
        scheduledDate: new Date(selectedDate).toISOString(),
        scheduledTime: selectedTimeLabel || selectedTime,
        estimatedPrice: isQuoteOnly ? null : totalEstimatedPrice,
        urgency: params.intakeData?.urgency || "flexible",
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : null,
        answersJson: intakeAnswersJson,
        customServiceId: selectedServiceId || undefined,
      });
      return res.json();
    },
    onSuccess: async (data: {
      appointment?: { id: string };
      requiresDeposit?: boolean;
      depositCheckoutUrl?: string | null;
      depositAmountCents?: number;
    }) => {
      const appointmentId = data?.appointment?.id || "booking";
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Task #236: provider requires a deposit — open the Stripe Checkout
      // page externally so the homeowner can pay before the booking is
      // confirmed by the webhook. If we cannot launch the browser the
      // booking is effectively stuck pending payment, so surface a clear
      // error rather than silently routing to the success screen.
      if (data?.requiresDeposit && data?.depositCheckoutUrl) {
        try {
          const { openExternalUrl } = await import("@/lib/openExternalUrl");
          await openExternalUrl(data.depositCheckoutUrl);
        } catch {
          // Browser launch failed — still route to BookingSuccess so the
          // homeowner can retry the deposit payment from a stable screen
          // rather than being stuck on a half-submitted booking form.
        }
        navigation.navigate("BookingSuccess", {
          jobId: appointmentId,
          awaitingDeposit: true,
          depositCheckoutUrl: data.depositCheckoutUrl,
        });
        return;
      }
      navigation.navigate("BookingSuccess", { jobId: appointmentId });
    },
    onError: (error: Error) => {
      const raw = error?.message || "";
      let friendly = raw.replace(/^\d+:\s*/, "");
      try {
        const parsed = JSON.parse(friendly);
        const pickString = (v: unknown): string | null => {
          if (typeof v === "string" && v.trim()) return v;
          if (v && typeof v === "object") {
            const msg = (v as { message?: unknown }).message;
            if (typeof msg === "string" && msg.trim()) return msg;
          }
          return null;
        };
        const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
        const errors = Array.isArray(obj.errors) ? obj.errors : null;
        const details = Array.isArray(obj.details) ? obj.details : null;
        const candidate =
          pickString(obj.error) ||
          pickString(obj.message) ||
          pickString(obj.detail) ||
          (errors ? pickString(errors[0]) : null) ||
          (details ? pickString(details[0]) : null);
        if (candidate) friendly = candidate;
      } catch {}
      Alert.alert(
        "Booking Failed",
        friendly || "Could not create your appointment. Please try again."
      );
    },
  });

  const handleBook = () => {
    if (!defaultHome) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Add a Home Address",
        "We need a home address to send the provider. Add one now to continue.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add Address", onPress: () => navigation.navigate("Addresses" as never) },
        ]
      );
      return;
    }
    if (!selectedServiceId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Select a Service",
        primaryServices.length === 0
          ? "This provider hasn't published any services yet. Please choose another provider."
          : "Please choose a service to continue."
      );
      return;
    }
    if (!selectedDate) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Select a Date", "Please pick a date for your appointment.");
      return;
    }
    if (!selectedTime) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Select a Time", "Please pick a time slot for your appointment.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    bookMutation.mutate();
  };

  const renderDateItem = (item: DateItem) => {
    const isSelected = selectedDate === item.dateStr;
    const d = new Date(item.dateStr + "T12:00:00Z");
    const dayOfWeek = d.getUTCDay();
    const isUnavailable = !workingDays.includes(dayOfWeek);
    return (
      <Pressable
        key={item.dateStr}
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

        {/* Service selector — loaded from provider's published non-addon services */}
        <Animated.View entering={FadeInDown.delay(250)}>
          <ThemedText style={styles.sectionTitle}>Select Service</ThemedText>
          {servicesLoading ? (
            <ActivityIndicator size="small" color={Colors.accent} style={{ marginBottom: Spacing.md }} />
          ) : primaryServices.length > 0 ? (
            primaryServices.map((svc) => {
              const isSelected = selectedServiceId === svc.id;
              const priceLabel = getPriceLabel(svc);
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

        {/* Add-on suggestions */}
        {addonServices.length > 0 || jsonAddons.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(280)}>
            <ThemedText style={styles.sectionTitle}>Suggested Add-ons</ThemedText>
            {addonServices.map((addon) => {
              const isSelected = selectedAddonIds.has(addon.id);
              const priceLabel = getPriceLabel(addon);
              return (
                <Pressable
                  key={addon.id}
                  onPress={() => toggleAddon(addon.id)}
                  testID={`addon-service-${addon.id}`}
                  style={[
                    styles.addonCard,
                    {
                      backgroundColor: isSelected ? Colors.accent + "12" : theme.cardBackground,
                      borderColor: isSelected ? Colors.accent : theme.borderLight,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  <View style={styles.addonCheckbox}>
                    <View style={[
                      styles.checkbox,
                      { borderColor: isSelected ? Colors.accent : theme.borderLight, backgroundColor: isSelected ? Colors.accent : "transparent" },
                    ]}>
                      {isSelected ? <Feather name="check" size={12} color="#fff" /> : null}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.addonName, isSelected && { color: Colors.accent }]}>
                      {addon.name}
                    </ThemedText>
                    {addon.description ? (
                      <ThemedText style={[styles.addonDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                        {addon.description}
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText style={[styles.addonPrice, isSelected && { color: Colors.accent }]}>
                    {priceLabel}
                  </ThemedText>
                </Pressable>
              );
            })}
            {jsonAddons.map((addon) => {
              const isSelected = selectedAddonIds.has(addon.id);
              const priceLabel = addon.price > 0 ? `$${addon.price.toFixed(0)}` : "Included";
              return (
                <Pressable
                  key={addon.id}
                  onPress={() => toggleAddon(addon.id)}
                  testID={`addon-upgrade-${addon.id}`}
                  style={[
                    styles.addonCard,
                    {
                      backgroundColor: isSelected ? Colors.accent + "12" : theme.cardBackground,
                      borderColor: isSelected ? Colors.accent : theme.borderLight,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  <View style={styles.addonCheckbox}>
                    <View style={[
                      styles.checkbox,
                      { borderColor: isSelected ? Colors.accent : theme.borderLight, backgroundColor: isSelected ? Colors.accent : "transparent" },
                    ]}>
                      {isSelected ? <Feather name="check" size={12} color="#fff" /> : null}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.addonName, isSelected && { color: Colors.accent }]}>
                      {addon.name}
                    </ThemedText>
                    {addon.description ? (
                      <ThemedText style={[styles.addonDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                        {addon.description}
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText style={[styles.addonPrice, isSelected && { color: Colors.accent }]}>
                    {priceLabel}
                  </ThemedText>
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}

        {serviceIntakeQuestions.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(275)}>
            <ThemedText style={styles.sectionTitle}>Booking Questions</ThemedText>
            <GlassCard style={styles.intakeCard}>
              <View style={{ paddingHorizontal: Spacing.md }}>
                <IntakeQuestionFields
                  questions={serviceIntakeQuestions}
                  answers={intakeAnswers}
                  onChange={(next) => {
                    Haptics.selectionAsync();
                    setIntakeAnswers(next);
                  }}
                  testIDPrefix="booking-intake"
                />
              </View>
            </GlassCard>
          </Animated.View>
        ) : null}

        {!defaultHome && !homesLoading ? (
          <Animated.View entering={FadeInDown.delay(290)}>
            <GlassCard style={styles.alertCardWarning}>
              <View style={styles.alertRow}>
                <Feather name="alert-circle" size={18} color="#F59E0B" />
                <ThemedText style={{ marginLeft: Spacing.sm, flex: 1 }}>
                  Add a home address so the provider knows where to come.
                </ThemedText>
              </View>
              <Pressable
                onPress={() => navigation.navigate("Addresses" as never)}
                style={{ marginTop: Spacing.sm, alignSelf: "flex-start" }}
              >
                <ThemedText style={{ color: Colors.accent, fontWeight: "600" }}>
                  Add Address
                </ThemedText>
              </Pressable>
            </GlassCard>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(300)}>
          <ThemedText style={styles.sectionTitle}>Select Date</ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateList}
          >
            {dates.map(renderDateItem)}
          </ScrollView>
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

        {/* Repeat service toggle */}
        <Animated.View entering={FadeInDown.delay(320)}>
          <GlassCard style={styles.repeatCard}>
            <View style={styles.repeatRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.repeatLabel}>Repeat this service</ThemedText>
                <ThemedText style={[styles.repeatHint, { color: theme.textSecondary }]}>
                  Lock in regular visits on a schedule
                </ThemedText>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={(v) => {
                  Haptics.selectionAsync();
                  setIsRecurring(v);
                }}
                trackColor={{ false: theme.borderLight, true: Colors.accent + "80" }}
                thumbColor={isRecurring ? Colors.accent : theme.textTertiary}
              />
            </View>
            {isRecurring ? (
              <View style={styles.frequencyRow}>
                {FREQUENCY_OPTIONS.map((opt) => {
                  const isActive = recurringFrequency === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setRecurringFrequency(opt.value);
                      }}
                      style={[
                        styles.freqChip,
                        {
                          backgroundColor: isActive ? Colors.accent : theme.backgroundElevated,
                          borderColor: isActive ? Colors.accent : theme.borderLight,
                        },
                      ]}
                    >
                      <ThemedText style={[styles.freqLabel, isActive && { color: "#fff" }]}>
                        {opt.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </GlassCard>
        </Animated.View>

        {policySummaryText ? (
          <Animated.View entering={FadeInDown.duration(400)}>
            <GlassCard style={styles.summaryCard}>
              <View style={styles.policyHeader}>
                <Feather name="info" size={16} color={Colors.accent} />
                <ThemedText style={styles.policyTitle}>Booking Policy</ThemedText>
              </View>
              <ThemedText
                style={[styles.policyText, { color: theme.textSecondary }]}
                testID="text-booking-policy-summary"
              >
                {policySummaryText}
              </ThemedText>
              {bookingPolicy.requireDeposit &&
              bookingPolicy.depositPercent > 0 &&
              totalEstimatedPrice ? (
                <View
                  style={[
                    styles.depositBadge,
                    { backgroundColor: Colors.accent + "15" },
                  ]}
                >
                  <Feather name="credit-card" size={13} color={Colors.accent} />
                  <ThemedText
                    style={[styles.depositBadgeText, { color: Colors.accent }]}
                    testID="text-booking-deposit-estimate"
                  >
                    Deposit due now: $
                    {(
                      computeDepositCents(
                        bookingPolicy,
                        dollarsToCents(totalEstimatedPrice),
                      ) / 100
                    ).toFixed(2)}
                  </ThemedText>
                </View>
              ) : null}
            </GlassCard>
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
          {isQuoteOnly ? (
            <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
              Request a Quote
            </ThemedText>
          ) : selectedService?.pricingType === "quote" && selectedAddonIds.size === 0 ? (
            <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
              Quote will be provided
            </ThemedText>
          ) : totalEstimatedPrice ? (
            <>
              <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
                {selectedAddonIds.size > 0 ? "Total est." : "Est. price"}
              </ThemedText>
              <ThemedText style={styles.priceValue}>
                ${parseFloat(totalEstimatedPrice).toFixed(0)}
              </ThemedText>
            </>
          ) : (
            <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
              Price to be confirmed
            </ThemedText>
          )}
          {isRecurring ? (
            <View style={[styles.recurringBadge, { backgroundColor: Colors.accent + "20" }]}>
              <Feather name="repeat" size={11} color={Colors.accent} />
              <ThemedText style={[styles.recurringBadgeText, { color: Colors.accent }]}>
                {FREQUENCY_OPTIONS.find((f) => f.value === recurringFrequency)?.label || "Recurring"}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <PrimaryButton
          onPress={handleBook}
          disabled={!canBook || bookMutation.isPending}
          style={[styles.bookBtn, isQuoteOnly && { backgroundColor: "#AF52DE" }]}
        >
          {bookMutation.isPending ? "Submitting..." : isQuoteOnly ? "Request a Quote" : "Request Appointment"}
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
  alertCardWarning: {
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  serviceCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  serviceCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  serviceName: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: 2,
  },
  serviceDesc: {
    ...Typography.caption1,
    marginTop: 2,
  },
  servicePriceBox: {
    alignItems: "flex-end",
  },
  servicePrice: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  serviceDuration: {
    ...Typography.caption2,
    marginTop: 2,
  },
  addonCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  addonCheckbox: {
    width: 24,
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  addonName: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: 1,
  },
  addonDesc: {
    ...Typography.caption1,
  },
  addonPrice: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  dateList: {
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  dateCard: {
    width: 64,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    borderWidth: 1,
  },
  dateDayName: {
    ...Typography.caption2,
    marginBottom: 2,
  },
  dateDayNum: {
    ...Typography.title2,
    fontWeight: "700",
  },
  dateMonth: {
    ...Typography.caption2,
    marginTop: 2,
  },
  selectedText: {
    color: "#fff",
  },
  timeSlotsSection: {
    marginTop: Spacing.sm,
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
  },
  slotText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  repeatCard: {
    padding: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  repeatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  repeatLabel: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: 2,
  },
  repeatHint: {
    ...Typography.caption1,
  },
  frequencyRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    flexWrap: "wrap",
  },
  freqChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  freqLabel: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: 1,
  },
  priceRow: {
    flex: 1,
    gap: 4,
  },
  priceLabel: {
    ...Typography.caption1,
  },
  priceValue: {
    ...Typography.title3,
    fontWeight: "700",
    color: Colors.accent,
  },
  policyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  policyTitle: {
    ...Typography.headline,
    fontWeight: "600",
  },
  policyText: {
    ...Typography.footnote,
    lineHeight: 19,
  },
  depositBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  depositBadgeText: {
    ...Typography.footnote,
    fontWeight: "600",
  },
  recurringBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
  },
  recurringBadgeText: {
    ...Typography.caption2,
    fontWeight: "600",
  },
  bookBtn: {
    flex: 1,
  },
  intakeCard: {
    padding: 0,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  intakeQuestion: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  intakeLabel: {
    ...Typography.body,
    fontWeight: "600",
  },
  intakeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  intakeOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  intakeOptionText: {
    ...Typography.subhead,
  },
  intakeInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.body,
  },
});
