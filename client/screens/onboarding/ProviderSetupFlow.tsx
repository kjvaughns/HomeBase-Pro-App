import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeInRight,
  FadeOutLeft,
  FadeInLeft,
  FadeOutRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useOnboardingStore } from "@/state/onboardingStore";
import { useAuthStore } from "@/state/authStore";
import { useProviderStore } from "@/state/providerStore";
import { apiRequest } from "@/lib/query-client";

type Props = NativeStackScreenProps<RootStackParamList, "ProviderSetupFlow">;

const TOTAL_STEPS = 6;

const SERVICE_CATEGORIES = [
  { id: "plumbing", label: "Plumbing", icon: "droplet" as const },
  { id: "electrical", label: "Electrical", icon: "zap" as const },
  { id: "hvac", label: "HVAC", icon: "wind" as const },
  { id: "cleaning", label: "Cleaning", icon: "home" as const },
  { id: "landscaping", label: "Landscaping", icon: "sun" as const },
  { id: "handyman", label: "Handyman", icon: "tool" as const },
  { id: "roofing", label: "Roofing", icon: "home" as const },
  { id: "painting", label: "Painting", icon: "edit-2" as const },
  { id: "pest", label: "Pest Control", icon: "shield" as const },
  { id: "other", label: "Other", icon: "more-horizontal" as const },
];

const DURATION_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "2 hrs", value: 120 },
  { label: "3+ hrs", value: 180 },
];

const DAYS_OF_WEEK = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

const START_TIMES = ["6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM"];
const END_TIMES = ["4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"];

interface SetupData {
  businessName: string;
  category: string;
  serviceArea: string;
  serviceName: string;
  servicePrice: string;
  quoteRequired: boolean;
  serviceDuration: number;
  activeDays: string[];
  startTime: string;
  endTime: string;
}

function ProgressBar({ currentStep }: { currentStep: number }) {
  const { theme } = useTheme();
  return (
    <View style={styles.progressBar}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            {
              backgroundColor: i < currentStep ? Colors.accent : theme.border,
              flex: 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

function StepHeader({
  title,
  subtitle,
  stepNum,
}: {
  title: string;
  subtitle: string;
  stepNum: number;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.stepHeader}>
      <ThemedText type="caption" style={[styles.stepLabel, { color: Colors.accent }]}>
        Step {stepNum} of {TOTAL_STEPS}
      </ThemedText>
      <ThemedText type="h2" style={styles.stepTitle}>
        {title}
      </ThemedText>
      <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        {subtitle}
      </ThemedText>
    </View>
  );
}

function Step1BusinessBasics({
  data,
  onChange,
}: {
  data: SetupData;
  onChange: (updates: Partial<SetupData>) => void;
}) {
  const { theme } = useTheme();

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <StepHeader
        stepNum={1}
        title="Business Basics"
        subtitle="Tell customers who you are and what you do"
      />

      <GlassCard style={styles.card}>
        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          Business Name
        </ThemedText>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.backgroundElevated,
              color: theme.text,
              borderColor: theme.borderLight,
            },
          ]}
          placeholder="Your business name"
          placeholderTextColor={theme.textSecondary}
          value={data.businessName}
          onChangeText={(v) => onChange({ businessName: v })}
          testID="input-business-name"
        />

        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
          Service Category
        </ThemedText>
        <View style={styles.categoryGrid}>
          {SERVICE_CATEGORIES.map((cat) => {
            const selected = data.category === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  onChange({ category: cat.id });
                }}
                testID={`category-${cat.id}`}
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: selected ? Colors.accent + "15" : theme.backgroundElevated,
                    borderColor: selected ? Colors.accent : theme.borderLight,
                    borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <Feather
                  name={cat.icon}
                  size={20}
                  color={selected ? Colors.accent : theme.textSecondary}
                />
                <ThemedText
                  type="caption"
                  style={{
                    textAlign: "center",
                    color: selected ? Colors.accent : theme.text,
                    fontWeight: selected ? "600" : "400",
                    marginTop: Spacing.xs,
                  }}
                >
                  {cat.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
          Service Area{" "}
          <ThemedText type="caption" style={{ color: theme.textTertiary }}>
            (optional)
          </ThemedText>
        </ThemedText>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.backgroundElevated,
              color: theme.text,
              borderColor: theme.borderLight,
            },
          ]}
          placeholder="e.g. San Francisco, East Bay"
          placeholderTextColor={theme.textSecondary}
          value={data.serviceArea}
          onChangeText={(v) => onChange({ serviceArea: v })}
          testID="input-service-area"
        />
      </GlassCard>
    </ScrollView>
  );
}

function Step2CreateService({
  data,
  onChange,
  category,
}: {
  data: SetupData;
  onChange: (updates: Partial<SetupData>) => void;
  category: string;
}) {
  const { theme } = useTheme();
  const [suggesting, setSuggesting] = useState(false);

  const categoryLabel =
    SERVICE_CATEGORIES.find((c) => c.id === category)?.label || "your category";

  const handleAISuggest = async () => {
    if (!category) return;
    setSuggesting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((r) => setTimeout(r, 1200));
    const suggestions: Record<string, string> = {
      plumbing: "Emergency Drain Cleaning",
      electrical: "Electrical Safety Inspection",
      hvac: "AC Tune-Up & Filter Change",
      cleaning: "Deep Home Cleaning",
      landscaping: "Lawn Mowing & Edging",
      handyman: "General Handyman Service",
      roofing: "Roof Inspection & Repair",
      painting: "Interior Room Painting",
      pest: "Pest Inspection & Treatment",
      other: "Professional Consultation",
    };
    onChange({ serviceName: suggestions[category] || `${categoryLabel} Service` });
    setSuggesting(false);
  };

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <StepHeader
        stepNum={2}
        title="Create Your First Service"
        subtitle="Define what you offer so customers can book you"
      />

      <GlassCard style={styles.card}>
        <View style={styles.fieldLabelRow}>
          <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Service Name
          </ThemedText>
          <Pressable
            onPress={handleAISuggest}
            disabled={suggesting || !category}
            style={[styles.aiBtn, { opacity: category ? 1 : 0.5 }]}
          >
            {suggesting ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <>
                <Feather name="zap" size={12} color={Colors.accent} />
                <ThemedText style={[styles.aiBtnText, { color: Colors.accent }]}>
                  AI Suggest
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.backgroundElevated,
              color: theme.text,
              borderColor: theme.borderLight,
            },
          ]}
          placeholder={`e.g. ${categoryLabel} Service`}
          placeholderTextColor={theme.textSecondary}
          value={data.serviceName}
          onChangeText={(v) => onChange({ serviceName: v })}
          testID="input-service-name"
        />

        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
          Pricing
        </ThemedText>
        <View style={styles.pricingRow}>
          <View style={styles.priceInputWrapper}>
            <ThemedText style={[styles.currencySymbol, { color: data.quoteRequired ? theme.textTertiary : theme.textSecondary }]}>
              $
            </ThemedText>
            <TextInput
              style={[
                styles.priceInput,
                {
                  backgroundColor: theme.backgroundElevated,
                  color: data.quoteRequired ? theme.textTertiary : theme.text,
                  borderColor: theme.borderLight,
                },
              ]}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              value={data.servicePrice}
              onChangeText={(v) => onChange({ servicePrice: v })}
              keyboardType="decimal-pad"
              editable={!data.quoteRequired}
              testID="input-service-price"
            />
          </View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onChange({ quoteRequired: !data.quoteRequired, servicePrice: "" });
            }}
            style={[
              styles.quoteToggle,
              {
                backgroundColor: data.quoteRequired ? Colors.accent + "15" : theme.backgroundElevated,
                borderColor: data.quoteRequired ? Colors.accent : theme.borderLight,
              },
            ]}
            testID="toggle-quote-required"
          >
            <ThemedText
              style={{
                color: data.quoteRequired ? Colors.accent : theme.textSecondary,
                fontWeight: data.quoteRequired ? "600" : "400",
                fontSize: 13,
              }}
            >
              Quote Only
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
          Duration
        </ThemedText>
        <View style={styles.durationRow}>
          {DURATION_OPTIONS.map((opt) => {
            const selected = data.serviceDuration === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  onChange({ serviceDuration: opt.value });
                }}
                testID={`duration-${opt.value}`}
                style={[
                  styles.durationOption,
                  {
                    backgroundColor: selected ? Colors.accent : theme.backgroundElevated,
                    borderColor: selected ? Colors.accent : theme.borderLight,
                  },
                ]}
              >
                <ThemedText
                  style={{
                    color: selected ? "#fff" : theme.text,
                    fontWeight: selected ? "600" : "400",
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>
    </ScrollView>
  );
}

function Step3Availability({
  data,
  onChange,
}: {
  data: SetupData;
  onChange: (updates: Partial<SetupData>) => void;
}) {
  const { theme } = useTheme();

  const toggleDay = (dayId: string) => {
    Haptics.selectionAsync();
    const active = data.activeDays.includes(dayId)
      ? data.activeDays.filter((d) => d !== dayId)
      : [...data.activeDays, dayId];
    onChange({ activeDays: active });
  };

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        stepNum={3}
        title="Set Your Availability"
        subtitle="When are you available to take bookings?"
      />

      <GlassCard style={styles.card}>
        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          Working Days
        </ThemedText>
        <View style={styles.daysRow}>
          {DAYS_OF_WEEK.map((day) => {
            const active = data.activeDays.includes(day.id);
            return (
              <Pressable
                key={day.id}
                onPress={() => toggleDay(day.id)}
                testID={`day-${day.id}`}
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

        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: Spacing.xl }]}>
          Hours
        </ThemedText>
        <View style={styles.hoursRow}>
          <View style={styles.hoursBlock}>
            <ThemedText type="caption" style={{ color: theme.textTertiary, marginBottom: Spacing.xs }}>
              Start
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.timeScroll}
              contentContainerStyle={{ gap: Spacing.xs }}
            >
              {START_TIMES.map((t) => {
                const selected = data.startTime === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onChange({ startTime: t });
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
            <ThemedText type="caption" style={{ color: theme.textTertiary, marginBottom: Spacing.xs }}>
              End
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.timeScroll}
              contentContainerStyle={{ gap: Spacing.xs }}
            >
              {END_TIMES.map((t) => {
                const selected = data.endTime === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onChange({ endTime: t });
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
            {data.activeDays.length > 0
              ? `${data.activeDays.length} days/week · ${data.startTime} – ${data.endTime}`
              : "No days selected yet"}
          </ThemedText>
        </View>
      </GlassCard>
    </ScrollView>
  );
}

function Step4BookingPreview({
  data,
}: {
  data: SetupData;
}) {
  const { theme } = useTheme();
  const categoryLabel = SERVICE_CATEGORIES.find((c) => c.id === data.category)?.label || "";
  const categoryIcon = SERVICE_CATEGORIES.find((c) => c.id === data.category)?.icon || "tool";
  const durationLabel = DURATION_OPTIONS.find((d) => d.value === data.serviceDuration)?.label || "";

  const dayLabels = data.activeDays
    .map((d) => DAYS_OF_WEEK.find((day) => day.id === d)?.label)
    .filter(Boolean)
    .join(", ");

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        stepNum={4}
        title="Booking Preview"
        subtitle="This is what customers will see when they find you"
      />

      <GlassCard style={styles.card}>
        <View style={[styles.previewBadge, { backgroundColor: Colors.accent + "15" }]}>
          <Feather name="eye" size={14} color={Colors.accent} />
          <ThemedText type="caption" style={{ color: Colors.accent, fontWeight: "600" }}>
            Your Booking Page
          </ThemedText>
        </View>

        <View style={[styles.previewCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.borderLight }]}>
          <View style={styles.previewHeader}>
            <View style={[styles.previewIconCircle, { backgroundColor: Colors.accent + "20" }]}>
              <Feather name={categoryIcon} size={24} color={Colors.accent} />
            </View>
            <View style={styles.previewHeaderText}>
              <ThemedText type="h3" style={{ fontWeight: "700" }}>
                {data.businessName || "Your Business"}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                {categoryLabel}
                {data.serviceArea ? ` · ${data.serviceArea}` : ""}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.previewDivider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.previewServiceRow}>
            <Feather name="package" size={16} color={theme.textSecondary} />
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontWeight: "600" }}>
                {data.serviceName || "Your Service"}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                {data.quoteRequired
                  ? "Price: Quote Required"
                  : data.servicePrice
                  ? `Starting at $${data.servicePrice}`
                  : "Price: Contact for details"}
                {durationLabel ? ` · ${durationLabel}` : ""}
              </ThemedText>
            </View>
          </View>

          {data.activeDays.length > 0 ? (
            <View style={styles.previewServiceRow}>
              <Feather name="calendar" size={16} color={theme.textSecondary} />
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontWeight: "600" }}>Availability</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                  {dayLabels}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {data.startTime} – {data.endTime}
                </ThemedText>
              </View>
            </View>
          ) : null}

          <View style={[styles.previewBookBtn, { backgroundColor: Colors.accent }]}>
            <ThemedText style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
              Book Now
            </ThemedText>
          </View>
        </View>

        <View style={[styles.previewNote, { backgroundColor: theme.backgroundElevated }]}>
          <Feather name="info" size={14} color={theme.textSecondary} />
          <ThemedText type="caption" style={{ color: theme.textSecondary, flex: 1 }}>
            You can customize your booking page anytime from your dashboard
          </ThemedText>
        </View>
      </GlassCard>
    </ScrollView>
  );
}

function Step5Payments({ navigation }: { navigation: Props["navigation"] }) {
  const { theme } = useTheme();
  const [stripeAvailable] = useState(() => {
    const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    return typeof key === "string" && key.startsWith("pk_");
  });

  const benefits = [
    { icon: "zap" as const, title: "Instant transfers", desc: "Get paid fast — no waiting for checks" },
    { icon: "file-minus" as const, title: "No paper invoices", desc: "Send professional digital invoices automatically" },
    { icon: "check-circle" as const, title: "Automatic receipts", desc: "Customers get receipts instantly after payment" },
  ];

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        stepNum={5}
        title="Payments Setup"
        subtitle="Get paid directly through HomeBase via Stripe"
      />

      <GlassCard style={styles.card}>
        <View style={[styles.paymentsIcon, { backgroundColor: Colors.accent + "15" }]}>
          <Feather name="credit-card" size={32} color={Colors.accent} />
        </View>

        {stripeAvailable ? (
          <>
            <View style={styles.benefitsList}>
              {benefits.map((b, i) => (
                <View key={i} style={styles.benefitRow}>
                  <View style={[styles.benefitIcon, { backgroundColor: Colors.accent + "15" }]}>
                    <Feather name={b.icon} size={18} color={Colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: "600" }}>{b.title}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                      {b.desc}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>

            <PrimaryButton
              onPress={() => navigation.navigate("StripeConnect")}
              style={{ marginTop: Spacing.xl }}
              testID="button-connect-stripe"
            >
              Connect Stripe
            </PrimaryButton>
          </>
        ) : (
          <View style={styles.comingSoonContainer}>
            <View style={[styles.comingSoonBadge, { backgroundColor: Colors.accent + "15" }]}>
              <Feather name="clock" size={20} color={Colors.accent} />
              <ThemedText style={[styles.comingSoonBadgeText, { color: Colors.accent }]}>
                Coming Soon
              </ThemedText>
            </View>
            <ThemedText
              style={[styles.comingSoonText, { color: theme.textSecondary }]}
              testID="text-payments-coming-soon"
            >
              Stripe payments are coming soon. You can set up payments later from your dashboard.
            </ThemedText>
            <View style={styles.comingSoonBenefits}>
              {benefits.map((b, i) => (
                <View key={i} style={styles.benefitRow}>
                  <View style={[styles.benefitIcon, { backgroundColor: theme.border + "40" }]}>
                    <Feather name={b.icon} size={18} color={theme.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: "600", color: theme.textSecondary }}>{b.title}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                      {b.desc}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </GlassCard>
    </ScrollView>
  );
}

function Step6YouAreLive({
  data,
  onGoToDashboard,
}: {
  data: SetupData;
  onGoToDashboard: () => void;
}) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const scale = useSharedValue(1);

  const bookingLink = `homebase.app/${data.businessName.toLowerCase().replace(/\s+/g, "-") || "your-business"}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(`https://${bookingLink}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = withSequence(
      withSpring(1.08, { damping: 10 }),
      withSpring(1, { damping: 15 })
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `Book ${data.businessName || "my services"} on HomeBase: https://${bookingLink}`,
        url: `https://${bookingLink}`,
      });
    } catch (err) {
      console.warn("Share failed:", err);
    }
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.liveContainer}>
        <Animated.View style={[styles.successCircle, { backgroundColor: Colors.accent + "20" }, pulseStyle]}>
          <View style={[styles.successCircleInner, { backgroundColor: Colors.accent }]}>
            <Feather name="check" size={40} color="#fff" />
          </View>
        </Animated.View>

        <ThemedText type="h2" style={[styles.liveTitle, { fontWeight: "700" }]}>
          You're Live!
        </ThemedText>
        <ThemedText type="body" style={[styles.liveSubtitle, { color: theme.textSecondary }]}>
          Your business page is ready. Share your link and start getting bookings.
        </ThemedText>
      </View>

      <GlassCard style={styles.card}>
        <ThemedText type="caption" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          Your Booking Link
        </ThemedText>
        <View style={[styles.linkBox, { backgroundColor: theme.backgroundElevated, borderColor: theme.borderLight }]}>
          <Feather name="link" size={16} color={Colors.accent} />
          <ThemedText
            style={{ color: Colors.accent, flex: 1, fontWeight: "500", fontSize: 14 }}
            numberOfLines={1}
          >
            {bookingLink}
          </ThemedText>
        </View>

        <View style={styles.linkActions}>
          <Pressable
            onPress={handleCopy}
            testID="button-copy-link"
            style={[
              styles.linkBtn,
              { backgroundColor: copied ? Colors.accent + "20" : theme.backgroundElevated, borderColor: copied ? Colors.accent : theme.borderLight },
            ]}
          >
            <Feather name={copied ? "check" : "copy"} size={16} color={copied ? Colors.accent : theme.textSecondary} />
            <ThemedText style={{ color: copied ? Colors.accent : theme.textSecondary, fontWeight: "500", fontSize: 14 }}>
              {copied ? "Copied!" : "Copy Link"}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={handleShare}
            testID="button-share-link"
            style={[styles.linkBtn, { backgroundColor: Colors.accent + "15", borderColor: Colors.accent }]}
          >
            <Feather name="share-2" size={16} color={Colors.accent} />
            <ThemedText style={{ color: Colors.accent, fontWeight: "600", fontSize: 14 }}>
              Share Link
            </ThemedText>
          </Pressable>
        </View>
      </GlassCard>

      <PrimaryButton
        onPress={onGoToDashboard}
        style={{ marginTop: Spacing.lg }}
        testID="button-go-to-dashboard"
      >
        Go to Dashboard
      </PrimaryButton>
    </ScrollView>
  );
}

export default function ProviderSetupFlow({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { setHasCompletedProviderSetup } = useOnboardingStore();
  const { user, providerProfile } = useAuthStore();
  const { addOnboardingService, setProviderAvailability, setProviderBusinessProfile } = useProviderStore();

  const [step, setStep] = useState(1);
  const [goingBack, setGoingBack] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [data, setData] = useState<SetupData>({
    businessName: user?.name || "",
    category: "",
    serviceArea: "",
    serviceName: "",
    servicePrice: "",
    quoteRequired: false,
    serviceDuration: 60,
    activeDays: ["mon", "tue", "wed", "thu", "fri"],
    startTime: "8:00 AM",
    endTime: "6:00 PM",
  });

  const updateData = (updates: Partial<SetupData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const canContinue = () => {
    switch (step) {
      case 1:
        return data.businessName.trim().length > 0 && data.category.length > 0;
      case 2:
        return data.serviceName.trim().length > 0;
      case 3:
        return data.activeDays.length > 0;
      case 4:
      case 5:
        return true;
      default:
        return true;
    }
  };

  const handleContinue = async () => {
    if (step < TOTAL_STEPS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (step === 1) {
        setProviderBusinessProfile({
          businessName: data.businessName.trim(),
          category: data.category,
          serviceArea: data.serviceArea.trim(),
        });
      } else if (step === 2) {
        const service = {
          id: `svc-${Date.now()}`,
          name: data.serviceName.trim(),
          price: data.quoteRequired ? null : parseFloat(data.servicePrice) || null,
          quoteRequired: data.quoteRequired,
          durationMinutes: data.serviceDuration,
        };
        if (providerProfile?.id) {
          setSavingService(true);
          setServiceError(null);
          try {
            await apiRequest("POST", `/api/provider/${providerProfile.id}/custom-services`, {
              name: service.name,
              category: data.category || "General",
              description: "",
              pricingType: data.quoteRequired ? "quote" : "fixed",
              basePrice: service.price !== null ? String(service.price) : undefined,
              duration: service.durationMinutes,
            });
            addOnboardingService(service);
          } catch (err) {
            setSavingService(false);
            setServiceError("Could not save your service. Check your connection and try again.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
          }
          setSavingService(false);
        } else {
          addOnboardingService(service);
        }
      } else if (step === 3) {
        setProviderAvailability({
          activeDays: data.activeDays,
          startTime: data.startTime,
          endTime: data.endTime,
        });
      }
      setGoingBack(false);
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setGoingBack(true);
      setStep((s) => s - 1);
    }
  };

  const handleGoToDashboard = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setHasCompletedProviderSetup(true);
  };

  const enterAnim = goingBack ? FadeInLeft.duration(280) : FadeInRight.duration(280);
  const exitAnim = goingBack ? FadeOutRight.duration(200) : FadeOutLeft.duration(200);

  const renderStep = () => {
    switch (step) {
      case 1:
        return <Step1BusinessBasics key="s1" data={data} onChange={updateData} />;
      case 2:
        return <Step2CreateService key="s2" data={data} onChange={updateData} category={data.category} />;
      case 3:
        return <Step3Availability key="s3" data={data} onChange={updateData} />;
      case 4:
        return <Step4BookingPreview key="s4" data={data} />;
      case 5:
        return <Step5Payments key="s5" navigation={navigation} />;
      case 6:
        return <Step6YouAreLive key="s6" data={data} onGoToDashboard={handleGoToDashboard} />;
      default:
        return null;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.backArea}>
          {step > 1 && step < 6 ? (
            <Pressable onPress={handleBack} style={styles.backBtn} testID="button-back">
              <Feather name="chevron-left" size={24} color={theme.text} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.progressArea}>
          <ProgressBar currentStep={step} />
        </View>
        <View style={styles.backArea} />
      </View>

      <View style={styles.content}>
        <Animated.View
          key={`step-${step}`}
          entering={enterAnim}
          exiting={exitAnim}
          style={styles.stepContainer}
        >
          {renderStep()}
        </Animated.View>
      </View>

      {step < TOTAL_STEPS && step !== 5 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          {serviceError && step === 2 ? (
            <ThemedText
              style={[styles.serviceErrorText, { color: Colors.error }]}
              testID="text-service-error"
            >
              {serviceError}
            </ThemedText>
          ) : null}
          <PrimaryButton
            onPress={handleContinue}
            disabled={!canContinue() || savingService}
            testID="button-continue"
          >
            {savingService ? "Saving..." : "Continue"}
          </PrimaryButton>
        </View>
      ) : null}
      {step === 5 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <Pressable
            onPress={handleContinue}
            style={styles.skipBtn}
            testID="button-skip-payments"
          >
            <ThemedText style={{ color: theme.textSecondary, fontWeight: "500" }}>
              Skip for now
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  backArea: {
    width: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  progressArea: {
    flex: 1,
  },
  progressBar: {
    flexDirection: "row",
    gap: 4,
    height: 4,
    borderRadius: 2,
  },
  progressSegment: {
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
  },
  stepScroll: {
    flex: 1,
  },
  stepScrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  stepHeader: {
    marginBottom: Spacing.xl,
  },
  stepLabel: {
    fontWeight: "600",
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  stepTitle: {
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    lineHeight: 22,
  },
  card: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  fieldLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  textInput: {
    height: 48,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryCard: {
    width: "30%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  pricingRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  priceInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.input,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  currencySymbol: {
    paddingLeft: Spacing.md,
    fontSize: 16,
    fontWeight: "500",
  },
  priceInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: Spacing.sm,
    fontSize: 16,
  },
  quoteToggle: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  durationRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  durationOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.input,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  daysRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  dayPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 50,
    alignItems: "center",
  },
  hoursRow: {
    gap: Spacing.lg,
  },
  hoursBlock: {
    gap: Spacing.xs,
  },
  timeScroll: {
    flexGrow: 0,
  },
  timePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  availabilitySummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  previewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  previewCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  previewIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  previewHeaderText: {
    flex: 1,
  },
  previewDivider: {
    height: StyleSheet.hairlineWidth,
  },
  previewServiceRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  previewBookBtn: {
    height: 44,
    borderRadius: BorderRadius.button,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  previewNote: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  paymentsIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: Spacing.xl,
  },
  benefitsList: {
    gap: Spacing.lg,
  },
  benefitRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  comingSoonContainer: {
    gap: Spacing.lg,
  },
  comingSoonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    alignSelf: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  comingSoonBadgeText: {
    fontWeight: "700",
    fontSize: 15,
  },
  comingSoonText: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  comingSoonBenefits: {
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  liveContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  successCircleInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  liveTitle: {
    marginBottom: Spacing.sm,
    textAlign: "center",
    fontSize: 28,
  },
  liveSubtitle: {
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 280,
  },
  linkBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
  },
  linkActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  linkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  aiBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  serviceErrorText: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
});
