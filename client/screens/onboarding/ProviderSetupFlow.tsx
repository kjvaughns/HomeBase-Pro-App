import React, { useState, useEffect, useRef } from "react";
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
  FadeInDown,
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
import { useAuthStore, ProviderProfile } from "@/state/authStore";
import { useProviderStore } from "@/state/providerStore";
import { apiRequest } from "@/lib/query-client";

type Props = NativeStackScreenProps<RootStackParamList, "ProviderSetupFlow">;

const TOTAL_STEPS = 7;

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
  serviceDescription: string;
  servicePrice: string;
  quoteRequired: boolean;
  serviceDuration: number;
  activeDays: string[];
  startTime: string;
  endTime: string;
  bio: string;
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

function Step1CreateService({
  data,
  onChange,
  category,
}: {
  data: SetupData;
  onChange: (updates: Partial<SetupData>) => void;
  category: string;
}) {
  const { theme } = useTheme();
  const [priceSuggestion, setPriceSuggestion] = useState<{
    minPrice: number;
    maxPrice: number;
    unit: string;
    hint: string;
  } | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [loadingDescription, setLoadingDescription] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const priceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!category) return;
    setLoadingSuggestions(true);
    apiRequest("POST", "/api/ai/suggest-service-names", { category })
      .then((res) => res.json())
      .then((json) => { if (Array.isArray(json.names)) setAiSuggestions(json.names.slice(0, 3)); })
      .catch(() => {})
      .finally(() => setLoadingSuggestions(false));
  }, [category]);

  const fetchDescription = async (serviceName: string) => {
    if (!serviceName.trim() || !category) return;
    setLoadingDescription(true);
    try {
      const res = await apiRequest("POST", "/api/ai/suggest-description", {
        serviceName: serviceName.trim(),
        category,
      });
      const json = await res.json();
      if (json.description) onChange({ serviceDescription: json.description });
    } catch {
      // silently fail
    } finally {
      setLoadingDescription(false);
    }
  };

  useEffect(() => {
    if (descDebounceRef.current) clearTimeout(descDebounceRef.current);
    if (!data.serviceName.trim() || !category) {
      onChange({ serviceDescription: "" });
      return;
    }
    descDebounceRef.current = setTimeout(() => fetchDescription(data.serviceName), 1200);
    return () => {
      if (descDebounceRef.current) clearTimeout(descDebounceRef.current);
    };
  }, [data.serviceName, category]);

  useEffect(() => {
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    if (!data.serviceName.trim() || !category || data.quoteRequired) {
      setPriceSuggestion(null);
      return;
    }
    priceDebounceRef.current = setTimeout(async () => {
      setLoadingPrice(true);
      try {
        const res = await apiRequest("POST", "/api/ai/suggest-price", {
          serviceName: data.serviceName.trim(),
          category,
          pricingType: "flat",
        });
        const json = await res.json();
        if (json.suggestion) setPriceSuggestion(json.suggestion);
      } catch {
        // silently fail - not critical
      } finally {
        setLoadingPrice(false);
      }
    }, 900);
    return () => {
      if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    };
  }, [data.serviceName, category, data.quoteRequired]);

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <StepHeader
        stepNum={1}
        title="Create Your First Service"
        subtitle="Define what you offer so customers can book you"
      />

      <GlassCard style={styles.card}>
        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          Service Name
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
          placeholder="e.g. Drain Cleaning"
          placeholderTextColor={theme.textSecondary}
          value={data.serviceName}
          onChangeText={(v) => onChange({ serviceName: v })}
          testID="input-service-name"
        />

        {loadingSuggestions ? (
          <View style={[styles.suggestionRow, { alignItems: "center" }]}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <ThemedText type="caption" style={{ color: Colors.accent }}>
              Loading suggestions...
            </ThemedText>
          </View>
        ) : aiSuggestions.length > 0 ? (
          <View style={styles.suggestionRow}>
            <Feather name="zap" size={12} color={Colors.accent} />
            <ThemedText type="caption" style={{ color: Colors.accent, marginRight: Spacing.sm }}>
              Quick picks:
            </ThemedText>
            {aiSuggestions.map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  Haptics.selectionAsync();
                  onChange({ serviceName: s, serviceDescription: "" });
                }}
                style={[
                  styles.suggestionChip,
                  {
                    backgroundColor:
                      data.serviceName === s ? Colors.accent + "20" : theme.backgroundElevated,
                    borderColor: data.serviceName === s ? Colors.accent : theme.borderLight,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: data.serviceName === s ? Colors.accent : theme.textSecondary }}
                >
                  {s}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {data.serviceDescription || loadingDescription ? (
          <View style={[styles.descriptionPreview, { backgroundColor: Colors.accent + "08", borderColor: Colors.accent + "30" }]}>
            {loadingDescription ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <ThemedText type="caption" style={{ color: Colors.accent }}>
                  Writing description...
                </ThemedText>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: Spacing.xs }}>
                  <Feather name="zap" size={11} color={Colors.accent} />
                  <ThemedText type="caption" style={{ color: Colors.accent, fontWeight: "600" }}>
                    AI Description
                  </ThemedText>
                </View>
                <ThemedText type="caption" style={{ color: theme.textSecondary, lineHeight: 18 }}>
                  {data.serviceDescription}
                </ThemedText>
              </>
            )}
          </View>
        ) : null}

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

        {!data.quoteRequired && (loadingPrice || priceSuggestion) ? (
          <View style={[styles.priceHint, { backgroundColor: Colors.accent + "10" }]}>
            {loadingPrice ? (
              <ActivityIndicator size="small" color={Colors.accent} style={{ marginRight: Spacing.xs }} />
            ) : (
              <Feather name="trending-up" size={13} color={Colors.accent} />
            )}
            {priceSuggestion && !loadingPrice ? (
              <ThemedText type="caption" style={{ color: Colors.accent, flex: 1 }}>
                Typical range: ${priceSuggestion.minPrice}–${priceSuggestion.maxPrice} {priceSuggestion.unit}. {priceSuggestion.hint}
              </ThemedText>
            ) : loadingPrice ? (
              <ThemedText type="caption" style={{ color: Colors.accent }}>
                Getting price range...
              </ThemedText>
            ) : null}
          </View>
        ) : null}

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

function Step2Availability({
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

  const useStandardHours = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange({
      activeDays: ["mon", "tue", "wed", "thu", "fri"],
      startTime: "8:00 AM",
      endTime: "6:00 PM",
    });
  };

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        stepNum={2}
        title="Set Your Availability"
        subtitle="When are you available to take bookings?"
      />

      <GlassCard style={styles.card}>
        <View style={styles.fieldLabelRow}>
          <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Working Days
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

function Step3ProfilePolish({
  data,
  onChange,
}: {
  data: SetupData;
  onChange: (updates: Partial<SetupData>) => void;
}) {
  const { theme } = useTheme();
  const [improving, setImproving] = useState(false);
  const [originalBio, setOriginalBio] = useState<string | null>(null);

  const handleImproveWithAI = async () => {
    if (!data.bio.trim()) return;
    setImproving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOriginalBio(data.bio);
    try {
      const res = await apiRequest("POST", "/api/ai/improve-bio", {
        currentBio: data.bio.trim(),
        businessName: data.businessName,
        category: data.category,
      });
      const json = await res.json();
      if (json.improvedBio) {
        onChange({ bio: json.improvedBio });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setImproving(false);
    }
  };

  const handleRevert = () => {
    if (originalBio !== null) {
      onChange({ bio: originalBio });
      setOriginalBio(null);
      Haptics.selectionAsync();
    }
  };

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <StepHeader
        stepNum={3}
        title="Polish Your Profile"
        subtitle="A great bio earns trust before you say a word"
      />

      <GlassCard style={styles.card}>
        <View style={styles.fieldLabelRow}>
          <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            About You
          </ThemedText>
          {originalBio !== null ? (
            <Pressable onPress={handleRevert} hitSlop={8} testID="button-revert-bio">
              <ThemedText type="caption" style={{ color: theme.textSecondary, textDecorationLine: "underline" }}>
                Revert
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        <TextInput
          style={[
            styles.bioInput,
            {
              backgroundColor: theme.backgroundElevated,
              color: theme.text,
              borderColor: data.bio ? Colors.accent + "60" : theme.borderLight,
            },
          ]}
          placeholder="e.g. Licensed plumber with 8 years of experience. Known for same-day service and honest pricing."
          placeholderTextColor={theme.textSecondary}
          value={data.bio}
          onChangeText={(t) => {
            setOriginalBio(null);
            onChange({ bio: t.slice(0, 300) });
          }}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          returnKeyType="done"
          testID="input-bio"
        />
        <ThemedText type="caption" style={{ color: theme.textTertiary, marginTop: Spacing.xs, textAlign: "right" }}>
          {data.bio.length}/300
        </ThemedText>

        <Pressable
          onPress={handleImproveWithAI}
          disabled={improving || !data.bio.trim()}
          testID="button-improve-bio"
          style={[
            styles.aiImproveBtn,
            {
              backgroundColor: Colors.accent + "12",
              borderColor: Colors.accent + "40",
              opacity: data.bio.trim() ? 1 : 0.4,
            },
          ]}
        >
          {improving ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Feather name="zap" size={14} color={Colors.accent} />
          )}
          <ThemedText style={{ color: Colors.accent, fontWeight: "600", fontSize: 13 }}>
            {improving ? "Improving..." : "Improve with AI"}
          </ThemedText>
        </Pressable>

        <ThemedText type="caption" style={[styles.bioHint, { color: theme.textTertiary }]}>
          AI will keep your voice and specific details while making it sound more professional.
        </ThemedText>
      </GlassCard>

      <View style={[styles.skipNote, { borderColor: theme.border }]}>
        <Feather name="skip-forward" size={13} color={theme.textTertiary} />
        <ThemedText type="caption" style={{ color: theme.textTertiary }}>
          You can always add or update your bio from your profile settings.
        </ThemedText>
      </View>
    </ScrollView>
  );
}

function Step4BookingPreview({ data }: { data: SetupData }) {
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
                {data.serviceArea ? (() => {
                  const zips = data.serviceArea.split(",").map((z) => z.trim()).filter(Boolean);
                  return zips.length > 1
                    ? ` · ${zips[0]} +${zips.length - 1} ZIPs`
                    : zips.length === 1
                    ? ` · ${zips[0]}`
                    : "";
                })() : ""}
              </ThemedText>
            </View>
          </View>

          {data.bio ? (
            <View style={[styles.previewBio, { borderColor: theme.borderLight }]}>
              <ThemedText type="caption" style={{ color: theme.textSecondary, lineHeight: 18 }}>
                {data.bio}
              </ThemedText>
            </View>
          ) : null}

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

const VALUE_ROWS = [
  { icon: "clock" as const, title: "Save hours on admin", desc: "Automated invoicing, scheduling, and reminders free up your time." },
  { icon: "target" as const, title: "Stop chasing leads", desc: "Your booking link works 24/7 — clients book themselves." },
  { icon: "trending-up" as const, title: "Get booked automatically", desc: "AI-powered intake qualifies and routes leads while you focus on jobs." },
];

function Step6ValuePaywall({ onContinue }: { onContinue: () => void }) {
  const { theme } = useTheme();

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        stepNum={6}
        title="Start free, upgrade when you grow"
        subtitle="Everything you need to build a professional business"
      />

      <GlassCard style={[styles.card, { marginBottom: Spacing.lg }]}>
        {VALUE_ROWS.map((row, i) => (
          <Animated.View
            key={row.icon}
            entering={FadeInDown.delay(i * 120).duration(400)}
            style={[styles.valueRow, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.borderLight } : null]}
          >
            <View style={[styles.valueIcon, { backgroundColor: Colors.accent + "15" }]}>
              <Feather name={row.icon} size={18} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontWeight: "600", marginBottom: 2 }}>{row.title}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, lineHeight: 18 }}>
                {row.desc}
              </ThemedText>
            </View>
          </Animated.View>
        ))}
      </GlassCard>

      <Animated.View entering={FadeInDown.delay(400).duration(400)}>
        <GlassCard
          style={[styles.paywallCard, { borderColor: Colors.accent + "40" }]}
        >
          <View style={styles.paywallHeader}>
            <View style={[styles.paywallBadge, { backgroundColor: Colors.accent + "15" }]}>
              <ThemedText type="caption" style={{ color: Colors.accent, fontWeight: "700" }}>
                FREE FOR 14 DAYS
              </ThemedText>
            </View>
          </View>

          <ThemedText type="h3" style={styles.paywallTitle}>
            HomeBase Pro
          </ThemedText>
          <ThemedText type="caption" style={[styles.paywallPrice, { color: theme.textSecondary }]}>
            Then $29/month — cancel anytime
          </ThemedText>

          <PrimaryButton
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onContinue();
            }}
            style={{ marginTop: Spacing.lg }}
            testID="button-start-trial"
          >
            Start free trial
          </PrimaryButton>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onContinue();
            }}
            style={styles.maybeLaterBtn}
            testID="button-maybe-later"
          >
            <ThemedText type="caption" style={{ color: theme.textTertiary }}>
              Maybe later
            </ThemedText>
          </Pressable>
        </GlassCard>
      </Animated.View>
    </ScrollView>
  );
}

function Step7YouAreLive({
  data,
  providerProfile,
  onGoToDashboard,
}: {
  data: SetupData;
  providerProfile: ProviderProfile | null;
  onGoToDashboard: () => void;
}) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const scale = useSharedValue(1);
  const [apiBookingLink, setApiBookingLink] = useState<string | null>(null);

  useEffect(() => {
    if (!providerProfile?.id) return;
    apiRequest("GET", `/api/providers/${providerProfile.id}/booking-links`)
      .then((res) => res.json())
      .then((json) => {
        const links = json.bookingLinks ?? [];
        if (links.length > 0 && links[0].slug) {
          setApiBookingLink(`homebase.app/${links[0].slug}`);
        }
      })
      .catch(() => {});
  }, [providerProfile?.id]);

  const bookingSlug = data.businessName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "your-business";
  const bookingLink = apiBookingLink ?? `homebase.app/${bookingSlug}`;

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
    } catch {
      // ignore
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
          You're Live
        </ThemedText>
        <ThemedText type="body" style={[styles.liveSubtitle, { color: theme.textSecondary }]}>
          Your booking page is ready. Share your link and get your first booking.
        </ThemedText>
      </View>

      <GlassCard style={styles.card}>
        <ThemedText type="caption" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          Your Booking Link
        </ThemedText>
        <Animated.View
          style={[styles.linkBox, { backgroundColor: theme.backgroundElevated, borderColor: Colors.accent + "40" }, pulseStyle]}
        >
          <Feather name="link" size={16} color={Colors.accent} />
          <ThemedText
            style={{ color: Colors.accent, flex: 1, fontWeight: "500", fontSize: 14 }}
            numberOfLines={1}
          >
            {bookingLink}
          </ThemedText>
        </Animated.View>

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

      <ThemedText type="caption" style={[styles.dashboardNote, { color: theme.textTertiary }]}>
        Send your link to get your first booking
      </ThemedText>
    </ScrollView>
  );
}

export default function ProviderSetupFlow({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const safeTop = insets.top || 50;
  const { setHasCompletedProviderSetup, setNeedsProviderSetup, providerPreSignupData } = useOnboardingStore();
  const { user, providerProfile, activateProviderMode, setNeedsRoleSelection } = useAuthStore();
  const { addOnboardingService, setProviderAvailability, setProviderBusinessProfile } = useProviderStore();

  const [step, setStep] = useState(1);
  const [goingBack, setGoingBack] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [data, setData] = useState<SetupData>({
    businessName: providerPreSignupData?.businessName || user?.name || "",
    category: providerPreSignupData?.category || "",
    serviceArea: providerPreSignupData?.serviceArea || "",
    serviceName: "",
    serviceDescription: "",
    servicePrice: "",
    quoteRequired: false,
    serviceDuration: 60,
    activeDays: ["mon", "tue", "wed", "thu", "fri"],
    startTime: "8:00 AM",
    endTime: "6:00 PM",
    bio: "",
  });

  const updateData = (updates: Partial<SetupData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const canContinue = () => {
    switch (step) {
      case 1:
        return data.serviceName.trim().length > 0;
      case 2:
        return data.activeDays.length > 0;
      case 3:
      case 4:
        return true;
      default:
        return true;
    }
  };

  const advanceStep = () => {
    setGoingBack(false);
    setStep((s) => s + 1);
  };

  const handleContinue = async () => {
    if (step >= TOTAL_STEPS) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (step === 1) {
      setProviderBusinessProfile({
        businessName: data.businessName.trim(),
        category: data.category,
        serviceArea: data.serviceArea.trim(),
      });
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
            description: data.serviceDescription.trim() || "",
            pricingType: data.quoteRequired ? "quote" : "fixed",
            basePrice: service.price !== null ? String(service.price) : undefined,
            duration: service.durationMinutes,
          });
          addOnboardingService(service);
        } catch {
          setSavingService(false);
          setServiceError("Could not save your service. Check your connection and try again.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
        setSavingService(false);
      } else {
        addOnboardingService(service);
      }
    } else if (step === 2) {
      setProviderAvailability({
        activeDays: data.activeDays,
        startTime: data.startTime,
        endTime: data.endTime,
      });
    }

    advanceStep();
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
    activateProviderMode(); // sets activeRole="provider", bypasses canAccessProviderMode guard
    setNeedsRoleSelection(false); // clear role-selection state set by login()
    // Clearing needsProviderSetup last: RootStackNavigator reacts by swapping
    // initial route ProviderSetupFlow → Main (ProviderTabNavigator).
    // All four updates are batched in one React render, preventing any transient flash.
    setNeedsProviderSetup(false);
  };

  const enterAnim = goingBack ? FadeInLeft.duration(280) : FadeInRight.duration(280);
  const exitAnim = goingBack ? FadeOutRight.duration(200) : FadeOutLeft.duration(200);

  const renderStep = () => {
    switch (step) {
      case 1:
        return <Step1CreateService key="s1" data={data} onChange={updateData} category={data.category} />;
      case 2:
        return <Step2Availability key="s2" data={data} onChange={updateData} />;
      case 3:
        return <Step3ProfilePolish key="s3" data={data} onChange={updateData} />;
      case 4:
        return <Step4BookingPreview key="s4" data={data} />;
      case 5:
        return <Step5Payments key="s5" navigation={navigation} />;
      case 6:
        return <Step6ValuePaywall key="s6" onContinue={advanceStep} />;
      case 7:
        return <Step7YouAreLive key="s7" data={data} providerProfile={providerProfile} onGoToDashboard={handleGoToDashboard} />;
      default:
        return null;
    }
  };

  const showFooterContinue = step < TOTAL_STEPS && step !== 5 && step !== 6 && step !== 7;
  const showFooterSkip = step === 5;

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.topBar, { paddingTop: safeTop + Spacing.sm }]}>
        <View style={styles.backArea}>
          {step > 1 ? (
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

      {showFooterContinue ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          {serviceError && step === 2 ? (
            <ThemedText
              style={[styles.serviceErrorText, { color: "#E53E3E" }]}
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

      {showFooterSkip ? (
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
  container: { flex: 1 },
  topBar: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  backArea: { width: 40 },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  progressArea: { flex: 1 },
  progressBar: {
    flexDirection: "row",
    gap: 4,
    height: 4,
    borderRadius: 2,
  },
  progressSegment: { height: 4, borderRadius: 2 },
  content: { flex: 1 },
  stepContainer: { flex: 1 },
  stepScroll: { flex: 1 },
  stepScrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  stepHeader: { marginBottom: Spacing.xl },
  stepLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: Spacing.xs },
  stepTitle: { fontWeight: "700", marginBottom: Spacing.xs },
  stepSubtitle: {},
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
  textInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    marginBottom: Spacing.xs,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  categoryCard: {
    width: "30%",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  descriptionPreview: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  pricingRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  priceInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: Spacing.xs,
  },
  priceInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
  },
  quoteToggle: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  priceHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    marginBottom: Spacing.sm,
  },
  durationRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  durationOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
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
  bioInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 15,
    minHeight: 120,
    lineHeight: 22,
  },
  aiImproveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  bioHint: {
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  skipNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
  },
  previewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  previewCard: {
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  previewIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  previewHeaderText: { flex: 1 },
  previewBio: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
  },
  previewDivider: { height: StyleSheet.hairlineWidth },
  previewServiceRow: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  previewBookBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  previewNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  paymentsIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  benefitsList: { gap: Spacing.md },
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  comingSoonContainer: { alignItems: "center", gap: Spacing.md },
  comingSoonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  comingSoonBadgeText: { fontWeight: "600", fontSize: 15 },
  comingSoonText: { textAlign: "center", lineHeight: 22 },
  comingSoonBenefits: { width: "100%", gap: Spacing.md },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  valueIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  paywallCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    borderWidth: 1.5,
  },
  paywallHeader: { marginBottom: Spacing.md },
  paywallBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  paywallTitle: { fontWeight: "700", textAlign: "center" },
  paywallPrice: { textAlign: "center", marginTop: Spacing.xs },
  maybeLaterBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  liveContainer: { alignItems: "center", paddingVertical: Spacing.xl, gap: Spacing.md },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  successCircleInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  liveTitle: { textAlign: "center" },
  liveSubtitle: { textAlign: "center", lineHeight: 22, paddingHorizontal: Spacing.lg },
  linkBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  linkActions: { flexDirection: "row", gap: Spacing.sm },
  linkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  dashboardNote: {
    textAlign: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  footer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  serviceErrorText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
