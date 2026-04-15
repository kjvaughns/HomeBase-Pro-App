import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
  Switch,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ComponentProps } from "react";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/state/authStore";
import { useOnboardingStore } from "@/state/onboardingStore";
import { apiRequest, getApiUrl, getAuthHeaders } from "@/lib/query-client";
import { useQueryClient } from "@tanstack/react-query";

type FeatherIconName = ComponentProps<typeof Feather>["name"];
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface IntakeQuestion {
  id: string;
  question: string;
  type: "text" | "select" | "number";
  options: string[] | null;
  required: boolean;
}

interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
}

interface AIBlueprint {
  pricingModel: {
    type: "flat" | "variable" | "service_call" | "quote";
    basePrice: number | null;
    priceTiers: Array<{ label: string; price: number }> | null;
    unit: string;
    description: string;
  };
  intakeQuestions: IntakeQuestion[];
  addOns: AddOn[];
  bookingMode: "instant" | "starts_at" | "quote_only";
  aiPricingInsight: string;
}

const CATEGORIES = [
  "Cleaning", "Plumbing", "Electrical", "Landscaping", "Painting",
  "HVAC", "Handyman", "Pest Control", "Moving", "Roofing", "Other",
];

const PRICING_TYPES = [
  {
    id: "flat" as const,
    label: "Flat Rate",
    hint: "One fixed price per job",
    icon: "tag" as FeatherIconName,
  },
  {
    id: "starts_at" as const,
    label: "Starts At",
    hint: "A base price that may vary",
    icon: "trending-up" as FeatherIconName,
  },
  {
    id: "quote" as const,
    label: "Custom Quote",
    hint: "Price each job individually",
    icon: "file-text" as FeatherIconName,
  },
];

const BOOKING_MODES = [
  {
    id: "instant" as const,
    label: "Instant Book",
    hint: "Customer books and pays immediately",
    icon: "zap" as FeatherIconName,
  },
  {
    id: "starts_at" as const,
    label: "Provider Confirms",
    hint: "You review and confirm each booking",
    icon: "check-circle" as FeatherIconName,
  },
  {
    id: "quote_only" as const,
    label: "Quote Only",
    hint: "You send a price before anything is booked",
    icon: "send" as FeatherIconName,
  },
];

const WIZARD_STEPS = ["Service", "Pricing", "Questions", "Add-ons", "Booking", "Review"];

function ProgressBar({ step, total }: { step: number; total: number }) {
  const { theme } = useTheme();
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            { backgroundColor: i <= step ? Colors.accent : theme.borderLight, flex: 1 },
          ]}
        />
      ))}
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <ThemedText style={[styles.sectionLabel, { color: theme.textTertiary }]}>{text}</ThemedText>
  );
}

export default function ServiceBlueprintWizardScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { providerProfile } = useAuthStore();
  const { setPendingOnboardingService } = useOnboardingStore();
  const queryClient = useQueryClient();
  const providerId = providerProfile?.id;

  // Edit mode - populated when navigated via EditService route
  const routeParams = route.params as (RootStackParamList["EditService"] & { onboardingMode?: boolean }) | undefined;
  const editServiceId = routeParams?.serviceId || "";
  const editServiceData = routeParams?.service;
  const isEditMode = !!editServiceId;
  // Quick-edit mode: opened from ServiceSummary at a specific step — save immediately on CTA
  const isQuickEdit = isEditMode && routeParams?.initialStep != null;
  // Onboarding mode: skip API save, write to store instead
  const isOnboardingMode = !!(routeParams as RootStackParamList["NewService"])?.onboardingMode;

  const [step, setStep] = useState(routeParams?.initialStep ?? 0);

  // Step 0: Service identity
  const [serviceName, setServiceName] = useState("");
  const [serviceCategory, setServiceCategory] = useState("Other");
  const [serviceDescription, setServiceDescription] = useState("");

  // Step 1: Pricing
  const [pricingType, setPricingType] = useState<"flat" | "starts_at" | "quote">("flat");
  const [basePrice, setBasePrice] = useState("");
  const [priceUnit, setPriceUnit] = useState("per job");
  const [showPricingSuggestion, setShowPricingSuggestion] = useState(false);

  // Step 2: Questions
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionRequired, setNewQuestionRequired] = useState(true);
  const [suggestedQuestions, setSuggestedQuestions] = useState<IntakeQuestion[]>([]);
  const [suggestionsQVisible, setSuggestionsQVisible] = useState(false);

  // Step 3: Add-ons
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [addingAddon, setAddingAddon] = useState(false);
  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("");
  const [suggestedAddons, setSuggestedAddons] = useState<AddOn[]>([]);
  const [suggestionsAVisible, setSuggestionsAVisible] = useState(false);

  // Step 4: Booking
  const [bookingMode, setBookingMode] = useState<"instant" | "starts_at" | "quote_only">("instant");

  // Step 0: AI description generation
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [descAiError, setDescAiError] = useState("");

  // Global
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // AI (loaded lazily, cached)
  const [aiBlueprint, setAiBlueprint] = useState<AIBlueprint | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState("");
  const aiLoadedRef = useRef(false);

  // Pre-populate state when in edit mode
  useEffect(() => {
    if (!isEditMode || !editServiceData) return;
    const svc = editServiceData;
    if (svc.name) setServiceName(String(svc.name));
    if (svc.category) setServiceCategory(String(svc.category));
    if (svc.description) setServiceDescription(String(svc.description));
    if (svc.pricingType) {
      const pt = String(svc.pricingType);
      if (pt === "fixed") setPricingType("flat");
      else if (pt === "variable") setPricingType("starts_at");
      else if (pt === "quote") setPricingType("quote");
      else setPricingType("flat");
    }
    if (svc.basePrice) setBasePrice(String(svc.basePrice));
    if (svc.intakeQuestionsJson) {
      try {
        const parsed = JSON.parse(String(svc.intakeQuestionsJson));
        if (Array.isArray(parsed)) setQuestions(parsed);
      } catch {}
    }
    if (svc.addOnsJson) {
      try {
        const parsed = JSON.parse(String(svc.addOnsJson));
        if (Array.isArray(parsed)) setAddOns(parsed);
      } catch {}
    }
    if (svc.bookingMode) {
      const bm = String(svc.bookingMode);
      if (bm === "instant" || bm === "starts_at" || bm === "quote_only") {
        setBookingMode(bm);
      }
    }
    const initialStep = routeParams?.initialStep;
    const title = (isEditMode && initialStep != null)
      ? `Edit ${WIZARD_STEPS[initialStep]}`
      : "Edit Service";
    navigation.setOptions({ headerTitle: title });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode]);

  // Set header title in onboarding mode
  useEffect(() => {
    if (isOnboardingMode) {
      navigation.setOptions({ headerTitle: "Build Your First Service" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnboardingMode]);

  const buildBusinessContext = () => {
    const parts: string[] = [];
    if (providerProfile?.businessName) parts.push(`Business: ${providerProfile.businessName}`);
    if (providerProfile?.description) parts.push(providerProfile.description);
    if (providerProfile?.specialty) parts.push(`Specialty: ${providerProfile.specialty}`);
    if (providerProfile?.serviceArea) parts.push(`Serving: ${providerProfile.serviceArea}`);
    return parts.join(". ") || "Home service provider";
  };

  const fetchAIBlueprint = async (): Promise<AIBlueprint | null> => {
    if (aiLoadedRef.current && aiBlueprint) return aiBlueprint;
    if (loadingAI) return null;
    setLoadingAI(true);
    setAiError("");
    try {
      const url = new URL("/api/ai/service-blueprint", getApiUrl());
      const resp = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          businessDescription: buildBusinessContext(),
          serviceType: serviceName,
          category: serviceCategory,
          providerLocation: providerProfile?.serviceArea || "",
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const bp = data.blueprint as AIBlueprint;
        setAiBlueprint(bp);
        aiLoadedRef.current = true;
        return bp;
      } else {
        setAiError("Could not load suggestions. Try again.");
      }
    } catch {
      setAiError("Network error. Try again.");
    } finally {
      setLoadingAI(false);
    }
    return null;
  };

  const handleGenerateDescription = async () => {
    if (!serviceName.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGeneratingDesc(true);
    setDescAiError("");
    try {
      const url = new URL("/api/ai/suggest-description", getApiUrl());
      const resp = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ serviceName: serviceName.trim(), category: serviceCategory }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.description) {
          setServiceDescription(data.description);
        } else {
          setDescAiError("Could not generate a description. Try again.");
        }
      } else {
        setDescAiError("Generation failed. Check your connection.");
      }
    } catch {
      setDescAiError("Network error. Try again.");
    }
    setGeneratingDesc(false);
  };

  const handleSuggestPricing = async () => {
    const bp = await fetchAIBlueprint();
    if (!bp) return;
    const pm = bp.pricingModel;
    const type = pm.type === "flat" ? "flat" : pm.type === "variable" ? "starts_at" : "quote";
    setPricingType(type);
    if (pm.basePrice != null) setBasePrice(String(pm.basePrice));
    if (pm.unit) setPriceUnit(pm.unit);
    setShowPricingSuggestion(true);
  };

  const handleSuggestQuestions = async () => {
    const bp = await fetchAIBlueprint();
    if (!bp) return;
    const alreadyAdded = new Set(questions.map((q) => q.question.toLowerCase()));
    const fresh = bp.intakeQuestions.filter((q) => !alreadyAdded.has(q.question.toLowerCase()));
    setSuggestedQuestions(fresh);
    setSuggestionsQVisible(true);
  };

  const handleSuggestAddons = async () => {
    const bp = await fetchAIBlueprint();
    if (!bp) return;
    const alreadyAdded = new Set(addOns.map((a) => a.name.toLowerCase()));
    const fresh = bp.addOns.filter((a) => !alreadyAdded.has(a.name.toLowerCase()));
    setSuggestedAddons(fresh);
    setSuggestionsAVisible(true);
  };

  const addQuestion = () => {
    if (!newQuestionText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuestions((prev) => [
      ...prev,
      {
        id: `q_${Date.now()}`,
        question: newQuestionText.trim(),
        type: "text",
        options: null,
        required: newQuestionRequired,
      },
    ]);
    setNewQuestionText("");
    setNewQuestionRequired(true);
    setAddingQuestion(false);
  };

  const addSuggestedQuestion = (q: IntakeQuestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuestions((prev) => [...prev, { ...q, id: `q_${Date.now()}` }]);
    setSuggestedQuestions((prev) => prev.filter((s) => s.id !== q.id));
  };

  const removeQuestion = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const addAddon = () => {
    const name = newAddonName.trim();
    const price = parseFloat(newAddonPrice);
    if (!name || isNaN(price)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddOns((prev) => [
      ...prev,
      { id: `a_${Date.now()}`, name, description: "", price },
    ]);
    setNewAddonName("");
    setNewAddonPrice("");
    setAddingAddon(false);
  };

  const addSuggestedAddon = (a: AddOn) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddOns((prev) => [...prev, { ...a, id: `a_${Date.now()}` }]);
    setSuggestedAddons((prev) => prev.filter((s) => s.id !== a.id));
  };

  const removeAddon = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddOns((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSave = async () => {
    if (!serviceName.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Onboarding mode: don't call the API — provider doesn't exist yet.
    // Write service data to the onboarding store and return to the onboarding flow.
    if (isOnboardingMode) {
      setPendingOnboardingService({
        name: serviceName.trim(),
        category: serviceCategory,
        description: serviceDescription.trim(),
        pricingType,
        basePrice: basePrice.trim(),
        priceUnit: priceUnit.trim() || "per job",
        duration: 60,
        bookingMode: pricingType === "quote" ? "quote_only" : bookingMode,
      });
      navigation.goBack();
      return;
    }

    if (!providerId) return;
    setSaving(true);
    setSaveError("");
    try {
      const apiPricingType =
        pricingType === "quote" ? "quote" :
        pricingType === "starts_at" ? "variable" :
        "fixed";
      const apiBookingMode = pricingType === "quote" ? "quote_only" : bookingMode;

      const payload = {
        name: serviceName.trim(),
        category: serviceCategory,
        description: serviceDescription.trim() || null,
        pricingType: apiPricingType,
        basePrice: basePrice.trim() || null,
        priceTiersJson: null,
        duration: 60,
        isPublished: true,
        isAddon: false,
        intakeQuestionsJson: JSON.stringify(questions),
        addOnsJson: JSON.stringify(addOns),
        bookingMode: apiBookingMode,
        aiPricingInsight: aiBlueprint?.aiPricingInsight || null,
      };

      if (isEditMode) {
        await apiRequest("PUT", `/api/provider/${providerId}/custom-services/${editServiceId}`, payload);
      } else {
        await apiRequest("POST", `/api/provider/${providerId}/custom-services`, payload);
      }
      await queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "custom-services"],
      });
      navigation.goBack();
    } catch {
      setSaveError("Could not save your service. Please try again.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!providerId || !editServiceId) return;
    setDeleting(true);
    setConfirmDelete(false);
    try {
      await apiRequest("DELETE", `/api/provider/${providerId}/custom-services/${editServiceId}`);
      await queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "custom-services"],
      });
      navigation.goBack();
    } catch {
      Alert.alert("Error", "Failed to delete service. Please try again.");
    }
    setDeleting(false);
  };

  const getPriceDisplay = () => {
    if (pricingType === "quote") return "Custom Quote";
    if (!basePrice.trim()) return "Price not set";
    const prefix = pricingType === "starts_at" ? "Starting at $" : "$";
    return `${prefix}${basePrice} ${priceUnit}`;
  };

  // ─── Step 0: Service ────────────────────────────────────────────────────────
  const renderStep0 = () => (
    <KeyboardAwareScrollViewCompat
      style={styles.flex}
      contentContainerStyle={[styles.stepContent, { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 120 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(300)} style={styles.stepInner}>
        <ThemedText type="h2" style={styles.stepHeading}>Name your service</ThemedText>
        <ThemedText style={[styles.stepSubheading, { color: theme.textSecondary }]}>
          Start with the basics. You can fine-tune everything next.
        </ThemedText>

        <View style={styles.fieldGroup}>
          <SectionLabel text="SERVICE NAME" />
          <View style={[styles.inputBox, { borderColor: theme.border, backgroundColor: theme.backgroundElevated }]}>
            <TextInput
              style={[styles.inputText, { color: theme.text }]}
              placeholder="e.g., House Cleaning, Lawn Mowing, Pipe Repair..."
              placeholderTextColor={theme.textTertiary}
              value={serviceName}
              onChangeText={setServiceName}
              returnKeyType="next"
              autoFocus
              testID="input-service-name"
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <SectionLabel text="CATEGORY" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
          >
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => { Haptics.selectionAsync(); setServiceCategory(cat); }}
                style={[
                  styles.pill,
                  {
                    backgroundColor: serviceCategory === cat ? Colors.accent : theme.backgroundElevated,
                    borderColor: serviceCategory === cat ? Colors.accent : theme.borderLight,
                  },
                ]}
                testID={`button-category-${cat}`}
              >
                <ThemedText style={[
                  styles.pillText,
                  { color: serviceCategory === cat ? "#fff" : theme.textSecondary },
                ]}>
                  {cat}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.descHeader}>
            <SectionLabel text="DESCRIPTION (OPTIONAL)" />
          </View>
          <View style={[styles.inputBox, styles.inputBoxMulti, { borderColor: theme.border, backgroundColor: theme.backgroundElevated }]}>
            <TextInput
              style={[styles.inputText, { color: theme.text }]}
              placeholder="Briefly describe what this service includes..."
              placeholderTextColor={theme.textTertiary}
              value={serviceDescription}
              onChangeText={setServiceDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              testID="input-service-description"
            />
          </View>
          <Pressable
            onPress={handleGenerateDescription}
            disabled={generatingDesc || !serviceName.trim()}
            style={[
              styles.aiDescBtn,
              {
                backgroundColor: Colors.accent + "10",
                borderColor: Colors.accent + "30",
                opacity: !serviceName.trim() ? 0.4 : 1,
              },
            ]}
            testID="button-generate-description"
          >
            {generatingDesc ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Feather name="cpu" size={13} color={Colors.accent} />
            )}
            <ThemedText style={[styles.aiDescBtnText, { color: Colors.accent }]}>
              {generatingDesc ? "Writing description..." : "Generate with AI"}
            </ThemedText>
          </Pressable>
          {descAiError.length > 0 ? (
            <ThemedText style={[styles.aiDescError, { color: theme.textSecondary }]}>
              {descAiError}
            </ThemedText>
          ) : null}
        </View>

      </Animated.View>
    </KeyboardAwareScrollViewCompat>
  );

  // ─── Step 1: Pricing ─────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <KeyboardAwareScrollViewCompat
      style={styles.flex}
      contentContainerStyle={[styles.stepContent, { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 120 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(300)} style={styles.stepInner}>
        <Pressable onPress={() => setStep(0)} style={styles.backRow}>
          <Feather name="arrow-left" size={16} color={Colors.accent} />
          <ThemedText style={[styles.backText, { color: Colors.accent }]}>Back</ThemedText>
        </Pressable>
        <ThemedText type="h2" style={styles.stepHeading}>Your pricing</ThemedText>
        <ThemedText style={[styles.stepSubheading, { color: theme.textSecondary }]}>
          Choose how you want to charge for this service.
        </ThemedText>

        <View style={styles.fieldGroup}>
          <SectionLabel text="HOW DO YOU CHARGE?" />
          <View style={styles.optionsList}>
            {PRICING_TYPES.map((pt) => (
              <Pressable
                key={pt.id}
                onPress={() => { Haptics.selectionAsync(); setPricingType(pt.id); setShowPricingSuggestion(false); }}
                style={[
                  styles.optionRow,
                  {
                    borderColor: pricingType === pt.id ? Colors.accent : theme.borderLight,
                    backgroundColor: pricingType === pt.id ? Colors.accent + "10" : theme.backgroundElevated,
                  },
                ]}
                testID={`button-pricing-type-${pt.id}`}
              >
                <View style={[styles.optionIcon, { backgroundColor: pricingType === pt.id ? Colors.accent + "20" : theme.border + "40" }]}>
                  <Feather name={pt.icon} size={16} color={pricingType === pt.id ? Colors.accent : theme.textSecondary} />
                </View>
                <View style={styles.optionInfo}>
                  <ThemedText style={[styles.optionLabel, { color: pricingType === pt.id ? Colors.accent : theme.text }]}>
                    {pt.label}
                  </ThemedText>
                  <ThemedText style={[styles.optionHint, { color: theme.textSecondary }]}>{pt.hint}</ThemedText>
                </View>
                {pricingType === pt.id ? (
                  <Feather name="check-circle" size={18} color={Colors.accent} />
                ) : (
                  <Feather name="circle" size={18} color={theme.borderLight} />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {pricingType !== "quote" ? (
          <View style={styles.fieldGroup}>
            <SectionLabel text="BASE PRICE" />
            <View style={styles.priceInputRow}>
              <View style={[styles.priceAmountBox, { borderColor: theme.border, backgroundColor: theme.backgroundElevated }]}>
                <ThemedText style={[styles.pricePrefixInline, { color: theme.textSecondary }]}>$</ThemedText>
                <TextInput
                  style={[styles.inputText, { color: theme.text, flex: 1 }]}
                  placeholder="0.00"
                  placeholderTextColor={theme.textTertiary}
                  value={basePrice}
                  onChangeText={setBasePrice}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  testID="input-base-price"
                />
              </View>
              <View style={[styles.priceUnitBox, { borderColor: theme.border, backgroundColor: theme.backgroundElevated }]}>
                <TextInput
                  style={[styles.inputText, { color: theme.text }]}
                  placeholder="per job"
                  placeholderTextColor={theme.textTertiary}
                  value={priceUnit}
                  onChangeText={setPriceUnit}
                  testID="input-price-unit"
                />
              </View>
            </View>
          </View>
        ) : (
          <GlassCard style={[styles.infoCard, { borderColor: theme.borderLight }]}>
            <Feather name="info" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.infoCardText, { color: theme.textSecondary }]}>
              You'll discuss and agree on a price with each customer before any booking is confirmed.
            </ThemedText>
          </GlassCard>
        )}

        {showPricingSuggestion && aiBlueprint ? (
          <Animated.View entering={FadeIn.duration(250)}>
            <GlassCard style={[styles.suggestionCard, { borderColor: Colors.accent + "40" }]}>
              <View style={styles.suggestionHeader}>
                <Feather name="cpu" size={13} color={Colors.accent} />
                <ThemedText style={[styles.suggestionTitle, { color: Colors.accent }]}>AI suggestion applied</ThemedText>
                <Pressable onPress={() => setShowPricingSuggestion(false)} hitSlop={8}>
                  <Feather name="x" size={13} color={theme.textTertiary} />
                </Pressable>
              </View>
              {aiBlueprint.aiPricingInsight ? (
                <ThemedText style={[styles.suggestionText, { color: theme.textSecondary }]}>
                  {aiBlueprint.aiPricingInsight}
                </ThemedText>
              ) : null}
            </GlassCard>
          </Animated.View>
        ) : null}

        {aiError.length > 0 ? (
          <ThemedText style={styles.aiErrorText}>{aiError}</ThemedText>
        ) : null}

        <Pressable
          onPress={handleSuggestPricing}
          disabled={loadingAI}
          style={styles.aiAssistRow}
          testID="button-suggest-pricing"
        >
          {loadingAI ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Feather name="cpu" size={13} color={Colors.accent} />
          )}
          <ThemedText style={[styles.aiAssistText, { color: Colors.accent }]}>
            {loadingAI ? "Getting suggestion..." : "Get AI pricing suggestion"}
          </ThemedText>
        </Pressable>
      </Animated.View>
    </KeyboardAwareScrollViewCompat>
  );

  // ─── Step 2: Questions ───────────────────────────────────────────────────────
  const renderStep2 = () => (
    <KeyboardAwareScrollViewCompat
      style={styles.flex}
      contentContainerStyle={[styles.stepContent, { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 120 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(300)} style={styles.stepInner}>
        <Pressable onPress={() => setStep(1)} style={styles.backRow}>
          <Feather name="arrow-left" size={16} color={Colors.accent} />
          <ThemedText style={[styles.backText, { color: Colors.accent }]}>Back</ThemedText>
        </Pressable>
        <ThemedText type="h2" style={styles.stepHeading}>What customers need to tell you</ThemedText>
        <ThemedText style={[styles.stepSubheading, { color: theme.textSecondary }]}>
          Add questions customers answer before booking. This helps you prepare.
        </ThemedText>

        {questions.length > 0 ? (
          <GlassCard style={styles.listCard}>
            {questions.map((q, i) => (
              <View
                key={q.id}
                style={[
                  styles.listRow,
                  { borderBottomColor: theme.borderLight },
                  i < questions.length - 1 && styles.listRowBorder,
                ]}
              >
                <View style={[styles.listNum, { backgroundColor: Colors.accent + "18" }]}>
                  <ThemedText style={[styles.listNumText, { color: Colors.accent }]}>{i + 1}</ThemedText>
                </View>
                <View style={styles.listInfo}>
                  <ThemedText style={[styles.listName, { color: theme.text }]}>{q.question}</ThemedText>
                  <ThemedText style={[styles.listMeta, { color: theme.textTertiary }]}>
                    {q.type}{q.required ? " · required" : " · optional"}
                  </ThemedText>
                </View>
                <Pressable onPress={() => removeQuestion(q.id)} hitSlop={8} testID={`button-remove-question-${i}`}>
                  <Feather name="trash-2" size={15} color={theme.textTertiary} />
                </Pressable>
              </View>
            ))}
          </GlassCard>
        ) : null}

        {addingQuestion ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <GlassCard style={styles.addFormCard}>
              <View style={[styles.inputBox, { borderColor: theme.border, backgroundColor: theme.backgroundElevated }]}>
                <TextInput
                  style={[styles.inputText, { color: theme.text }]}
                  placeholder="e.g., How many bedrooms?"
                  placeholderTextColor={theme.textTertiary}
                  value={newQuestionText}
                  onChangeText={setNewQuestionText}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={addQuestion}
                  testID="input-new-question"
                />
              </View>
              <View style={styles.addFormRow}>
                <View style={styles.addFormToggle}>
                  <ThemedText style={[styles.addFormToggleLabel, { color: theme.textSecondary }]}>Required</ThemedText>
                  <Switch
                    value={newQuestionRequired}
                    onValueChange={setNewQuestionRequired}
                    trackColor={{ false: theme.borderLight, true: Colors.accent }}
                    thumbColor="#fff"
                  />
                </View>
                <View style={styles.addFormBtns}>
                  <Pressable
                    onPress={() => { setAddingQuestion(false); setNewQuestionText(""); }}
                    style={[styles.addFormCancelBtn, { borderColor: theme.borderLight }]}
                  >
                    <ThemedText style={[styles.addFormCancelText, { color: theme.textSecondary }]}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={addQuestion}
                    disabled={!newQuestionText.trim()}
                    style={[styles.addFormConfirmBtn, { backgroundColor: newQuestionText.trim() ? Colors.accent : Colors.accent + "40" }]}
                    testID="button-confirm-add-question"
                  >
                    <ThemedText style={styles.addFormConfirmText}>Add</ThemedText>
                  </Pressable>
                </View>
              </View>
            </GlassCard>
          </Animated.View>
        ) : (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAddingQuestion(true); }}
            style={[styles.addBtn, { borderColor: theme.borderLight, backgroundColor: theme.backgroundElevated }]}
            testID="button-add-question"
          >
            <Feather name="plus" size={16} color={Colors.accent} />
            <ThemedText style={[styles.addBtnText, { color: Colors.accent }]}>Add a question</ThemedText>
          </Pressable>
        )}

        {suggestionsQVisible && suggestedQuestions.length > 0 ? (
          <Animated.View entering={FadeIn.duration(250)}>
            <View style={styles.suggestHeader}>
              <View style={styles.suggestHeaderLeft}>
                <Feather name="cpu" size={13} color={Colors.accent} />
                <ThemedText style={[styles.suggestHeaderText, { color: Colors.accent }]}>
                  Suggested for {serviceName}
                </ThemedText>
              </View>
              <Pressable onPress={() => setSuggestionsQVisible(false)} hitSlop={8}>
                <Feather name="x" size={14} color={theme.textTertiary} />
              </Pressable>
            </View>
            <GlassCard style={styles.listCard}>
              {suggestedQuestions.map((q, i) => (
                <View
                  key={q.id}
                  style={[
                    styles.listRow,
                    { borderBottomColor: theme.borderLight },
                    i < suggestedQuestions.length - 1 && styles.listRowBorder,
                  ]}
                >
                  <View style={styles.listInfo}>
                    <ThemedText style={[styles.listName, { color: theme.text }]}>{q.question}</ThemedText>
                    <ThemedText style={[styles.listMeta, { color: theme.textTertiary }]}>
                      {q.type}{q.required ? " · required" : ""}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => addSuggestedQuestion(q)}
                    style={[styles.addSuggestBtn, { backgroundColor: Colors.accent + "15", borderColor: Colors.accent + "40" }]}
                    testID={`button-add-suggested-question-${i}`}
                  >
                    <Feather name="plus" size={14} color={Colors.accent} />
                    <ThemedText style={[styles.addSuggestText, { color: Colors.accent }]}>Add</ThemedText>
                  </Pressable>
                </View>
              ))}
            </GlassCard>
          </Animated.View>
        ) : null}

        {aiError.length > 0 ? (
          <ThemedText style={styles.aiErrorText}>{aiError}</ThemedText>
        ) : null}

        {!suggestionsQVisible ? (
          <Pressable
            onPress={handleSuggestQuestions}
            disabled={loadingAI}
            style={styles.aiAssistRow}
            testID="button-suggest-questions"
          >
            {loadingAI ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Feather name="cpu" size={13} color={Colors.accent} />
            )}
            <ThemedText style={[styles.aiAssistText, { color: Colors.accent }]}>
              {loadingAI ? "Getting suggestions..." : `Suggest questions for ${serviceName || "this service"}`}
            </ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>
    </KeyboardAwareScrollViewCompat>
  );

  // ─── Step 3: Add-ons ─────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <KeyboardAwareScrollViewCompat
      style={styles.flex}
      contentContainerStyle={[styles.stepContent, { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 120 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(300)} style={styles.stepInner}>
        <Pressable onPress={() => setStep(2)} style={styles.backRow}>
          <Feather name="arrow-left" size={16} color={Colors.accent} />
          <ThemedText style={[styles.backText, { color: Colors.accent }]}>Back</ThemedText>
        </Pressable>
        <ThemedText type="h2" style={styles.stepHeading}>Optional upgrades</ThemedText>
        <ThemedText style={[styles.stepSubheading, { color: theme.textSecondary }]}>
          Offer add-ons to increase your average order value.
        </ThemedText>

        {addOns.length > 0 ? (
          <GlassCard style={styles.listCard}>
            {addOns.map((a, i) => (
              <View
                key={a.id}
                style={[
                  styles.listRow,
                  { borderBottomColor: theme.borderLight },
                  i < addOns.length - 1 && styles.listRowBorder,
                ]}
              >
                <View style={styles.listInfo}>
                  <ThemedText style={[styles.listName, { color: theme.text }]}>{a.name}</ThemedText>
                </View>
                <ThemedText style={[styles.addonPrice, { color: Colors.accent }]}>+${a.price}</ThemedText>
                <Pressable onPress={() => removeAddon(a.id)} hitSlop={8} testID={`button-remove-addon-${i}`}>
                  <Feather name="trash-2" size={15} color={theme.textTertiary} />
                </Pressable>
              </View>
            ))}
          </GlassCard>
        ) : null}

        {addingAddon ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <GlassCard style={styles.addFormCard}>
              <View style={[styles.inputBox, { borderColor: theme.border, backgroundColor: theme.backgroundElevated }]}>
                <TextInput
                  style={[styles.inputText, { color: theme.text }]}
                  placeholder="Upgrade name (e.g., Inside oven cleaning)"
                  placeholderTextColor={theme.textTertiary}
                  value={newAddonName}
                  onChangeText={setNewAddonName}
                  autoFocus
                  returnKeyType="next"
                  testID="input-addon-name"
                />
              </View>
              <View style={styles.priceInputRow}>
                <View style={[styles.priceAmountBox, { borderColor: theme.border, backgroundColor: theme.backgroundElevated, flex: 1 }]}>
                  <ThemedText style={[styles.pricePrefixInline, { color: theme.textSecondary }]}>+$</ThemedText>
                  <TextInput
                    style={[styles.inputText, { color: theme.text, flex: 1 }]}
                    placeholder="Price"
                    placeholderTextColor={theme.textTertiary}
                    value={newAddonPrice}
                    onChangeText={setNewAddonPrice}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={addAddon}
                    testID="input-addon-price"
                  />
                </View>
              </View>
              <View style={[styles.addFormBtns, { justifyContent: "flex-end" }]}>
                <Pressable
                  onPress={() => { setAddingAddon(false); setNewAddonName(""); setNewAddonPrice(""); }}
                  style={[styles.addFormCancelBtn, { borderColor: theme.borderLight }]}
                >
                  <ThemedText style={[styles.addFormCancelText, { color: theme.textSecondary }]}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  onPress={addAddon}
                  disabled={!newAddonName.trim() || !newAddonPrice.trim()}
                  style={[styles.addFormConfirmBtn, { backgroundColor: (newAddonName.trim() && newAddonPrice.trim()) ? Colors.accent : Colors.accent + "40" }]}
                  testID="button-confirm-add-addon"
                >
                  <ThemedText style={styles.addFormConfirmText}>Add</ThemedText>
                </Pressable>
              </View>
            </GlassCard>
          </Animated.View>
        ) : (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAddingAddon(true); }}
            style={[styles.addBtn, { borderColor: theme.borderLight, backgroundColor: theme.backgroundElevated }]}
            testID="button-add-addon"
          >
            <Feather name="plus" size={16} color={Colors.accent} />
            <ThemedText style={[styles.addBtnText, { color: Colors.accent }]}>Add an upgrade</ThemedText>
          </Pressable>
        )}

        {suggestionsAVisible && suggestedAddons.length > 0 ? (
          <Animated.View entering={FadeIn.duration(250)}>
            <View style={styles.suggestHeader}>
              <View style={styles.suggestHeaderLeft}>
                <Feather name="cpu" size={13} color={Colors.accent} />
                <ThemedText style={[styles.suggestHeaderText, { color: Colors.accent }]}>
                  Common upgrades for {serviceName}
                </ThemedText>
              </View>
              <Pressable onPress={() => setSuggestionsAVisible(false)} hitSlop={8}>
                <Feather name="x" size={14} color={theme.textTertiary} />
              </Pressable>
            </View>
            <GlassCard style={styles.listCard}>
              {suggestedAddons.map((a, i) => (
                <View
                  key={a.id}
                  style={[
                    styles.listRow,
                    { borderBottomColor: theme.borderLight },
                    i < suggestedAddons.length - 1 && styles.listRowBorder,
                  ]}
                >
                  <View style={styles.listInfo}>
                    <ThemedText style={[styles.listName, { color: theme.text }]}>{a.name}</ThemedText>
                    {a.description ? (
                      <ThemedText style={[styles.listMeta, { color: theme.textTertiary }]} numberOfLines={1}>
                        {a.description}
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText style={[styles.addonPrice, { color: theme.textSecondary }]}>+${a.price}</ThemedText>
                  <Pressable
                    onPress={() => addSuggestedAddon(a)}
                    style={[styles.addSuggestBtn, { backgroundColor: Colors.accent + "15", borderColor: Colors.accent + "40" }]}
                    testID={`button-add-suggested-addon-${i}`}
                  >
                    <Feather name="plus" size={14} color={Colors.accent} />
                    <ThemedText style={[styles.addSuggestText, { color: Colors.accent }]}>Add</ThemedText>
                  </Pressable>
                </View>
              ))}
            </GlassCard>
          </Animated.View>
        ) : null}

        {aiError.length > 0 ? (
          <ThemedText style={styles.aiErrorText}>{aiError}</ThemedText>
        ) : null}

        {!suggestionsAVisible ? (
          <Pressable
            onPress={handleSuggestAddons}
            disabled={loadingAI}
            style={styles.aiAssistRow}
            testID="button-suggest-addons"
          >
            {loadingAI ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Feather name="cpu" size={13} color={Colors.accent} />
            )}
            <ThemedText style={[styles.aiAssistText, { color: Colors.accent }]}>
              {loadingAI ? "Getting suggestions..." : `Suggest upgrades for ${serviceName || "this service"}`}
            </ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>
    </KeyboardAwareScrollViewCompat>
  );

  // ─── Step 4: Booking ─────────────────────────────────────────────────────────
  const renderStep4 = () => (
    <KeyboardAwareScrollViewCompat
      style={styles.flex}
      contentContainerStyle={[styles.stepContent, { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 120 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(300)} style={styles.stepInner}>
        <Pressable onPress={() => setStep(3)} style={styles.backRow}>
          <Feather name="arrow-left" size={16} color={Colors.accent} />
          <ThemedText style={[styles.backText, { color: Colors.accent }]}>Back</ThemedText>
        </Pressable>
        <ThemedText type="h2" style={styles.stepHeading}>How customers book</ThemedText>
        <ThemedText style={[styles.stepSubheading, { color: theme.textSecondary }]}>
          {pricingType === "quote"
            ? "Quote-only services always require your confirmation before anything is booked."
            : "Choose how customers engage with this service."}
        </ThemedText>

        <View style={styles.optionsList}>
          {BOOKING_MODES.map((mode) => {
            const locked = pricingType === "quote" && mode.id !== "quote_only";
            const selected = pricingType === "quote" ? mode.id === "quote_only" : bookingMode === mode.id;
            return (
              <Pressable
                key={mode.id}
                onPress={() => {
                  if (locked) return;
                  Haptics.selectionAsync();
                  setBookingMode(mode.id);
                }}
                style={[
                  styles.optionRow,
                  {
                    borderColor: selected ? Colors.accent : theme.borderLight,
                    backgroundColor: selected ? Colors.accent + "10" : theme.backgroundElevated,
                    opacity: locked ? 0.4 : 1,
                  },
                ]}
                testID={`button-booking-mode-${mode.id}`}
              >
                <View style={[styles.optionIcon, { backgroundColor: selected ? Colors.accent + "20" : theme.border + "40" }]}>
                  <Feather name={mode.icon} size={16} color={selected ? Colors.accent : theme.textSecondary} />
                </View>
                <View style={styles.optionInfo}>
                  <ThemedText style={[styles.optionLabel, { color: selected ? Colors.accent : theme.text }]}>
                    {mode.label}
                  </ThemedText>
                  <ThemedText style={[styles.optionHint, { color: theme.textSecondary }]}>{mode.hint}</ThemedText>
                </View>
                {selected ? (
                  <Feather name="check-circle" size={18} color={Colors.accent} />
                ) : (
                  <Feather name="circle" size={18} color={theme.borderLight} />
                )}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </KeyboardAwareScrollViewCompat>
  );

  // ─── Step 5: Review ──────────────────────────────────────────────────────────
  const renderStep5 = () => {
    const effectiveBookingMode = pricingType === "quote" ? "quote_only" : bookingMode;
    const bookingLabel = BOOKING_MODES.find((m) => m.id === effectiveBookingMode)?.label ?? "";
    const pricingLabel = PRICING_TYPES.find((p) => p.id === pricingType)?.label ?? "";

    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.stepContent, { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)} style={styles.stepInner}>
          <Pressable onPress={() => setStep(4)} style={styles.backRow}>
            <Feather name="arrow-left" size={16} color={Colors.accent} />
            <ThemedText style={[styles.backText, { color: Colors.accent }]}>Back</ThemedText>
          </Pressable>
          <View style={styles.reviewHeader}>
            <View style={{ flex: 1 }}>
              <ThemedText type="h2" style={styles.stepHeading}>Review your service</ThemedText>
              <ThemedText style={[styles.stepSubheading, { color: theme.textSecondary }]}>
                Looks good? Publish when ready.
              </ThemedText>
            </View>
            <Pressable
              onPress={() => setPreviewVisible(true)}
              style={[styles.previewBtn, { backgroundColor: Colors.accent + "15", borderColor: Colors.accent + "40" }]}
              testID="button-preview-service"
            >
              <Feather name="eye" size={14} color={Colors.accent} />
              <ThemedText style={[styles.previewBtnText, { color: Colors.accent }]}>Preview</ThemedText>
            </Pressable>
          </View>

          <GlassCard style={styles.reviewCard}>
            <View style={styles.reviewRow}>
              <View style={[styles.reviewIcon, { backgroundColor: Colors.accent + "15" }]}>
                <Feather name="briefcase" size={16} color={Colors.accent} />
              </View>
              <View style={styles.reviewInfo}>
                <ThemedText style={[styles.reviewLabel, { color: theme.textTertiary }]}>SERVICE</ThemedText>
                <ThemedText style={[styles.reviewValue, { color: theme.text }]}>{serviceName}</ThemedText>
                <ThemedText style={[styles.reviewMeta, { color: theme.textSecondary }]}>{serviceCategory}</ThemedText>
              </View>
              <Pressable onPress={() => setStep(0)} hitSlop={8}>
                <Feather name="edit-2" size={15} color={theme.textTertiary} />
              </Pressable>
            </View>

            <View style={[styles.reviewDivider, { backgroundColor: theme.borderLight }]} />

            <View style={styles.reviewRow}>
              <View style={[styles.reviewIcon, { backgroundColor: Colors.accent + "15" }]}>
                <Feather name="tag" size={16} color={Colors.accent} />
              </View>
              <View style={styles.reviewInfo}>
                <ThemedText style={[styles.reviewLabel, { color: theme.textTertiary }]}>PRICING</ThemedText>
                <ThemedText style={[styles.reviewValue, { color: theme.text }]}>{getPriceDisplay()}</ThemedText>
                <ThemedText style={[styles.reviewMeta, { color: theme.textSecondary }]}>{pricingLabel}</ThemedText>
              </View>
              <Pressable onPress={() => setStep(1)} hitSlop={8}>
                <Feather name="edit-2" size={15} color={theme.textTertiary} />
              </Pressable>
            </View>

            <View style={[styles.reviewDivider, { backgroundColor: theme.borderLight }]} />

            <View style={styles.reviewRow}>
              <View style={[styles.reviewIcon, { backgroundColor: Colors.accent + "15" }]}>
                <Feather name="help-circle" size={16} color={Colors.accent} />
              </View>
              <View style={styles.reviewInfo}>
                <ThemedText style={[styles.reviewLabel, { color: theme.textTertiary }]}>QUESTIONS</ThemedText>
                <ThemedText style={[styles.reviewValue, { color: theme.text }]}>
                  {questions.length > 0 ? `${questions.length} question${questions.length !== 1 ? "s" : ""}` : "None added"}
                </ThemedText>
              </View>
              <Pressable onPress={() => setStep(2)} hitSlop={8}>
                <Feather name="edit-2" size={15} color={theme.textTertiary} />
              </Pressable>
            </View>

            <View style={[styles.reviewDivider, { backgroundColor: theme.borderLight }]} />

            <View style={styles.reviewRow}>
              <View style={[styles.reviewIcon, { backgroundColor: Colors.accent + "15" }]}>
                <Feather name="plus-circle" size={16} color={Colors.accent} />
              </View>
              <View style={styles.reviewInfo}>
                <ThemedText style={[styles.reviewLabel, { color: theme.textTertiary }]}>ADD-ONS</ThemedText>
                <ThemedText style={[styles.reviewValue, { color: theme.text }]}>
                  {addOns.length > 0 ? `${addOns.length} upgrade${addOns.length !== 1 ? "s" : ""}` : "None added"}
                </ThemedText>
              </View>
              <Pressable onPress={() => setStep(3)} hitSlop={8}>
                <Feather name="edit-2" size={15} color={theme.textTertiary} />
              </Pressable>
            </View>

            <View style={[styles.reviewDivider, { backgroundColor: theme.borderLight }]} />

            <View style={styles.reviewRow}>
              <View style={[styles.reviewIcon, { backgroundColor: Colors.accent + "15" }]}>
                <Feather name="calendar" size={16} color={Colors.accent} />
              </View>
              <View style={styles.reviewInfo}>
                <ThemedText style={[styles.reviewLabel, { color: theme.textTertiary }]}>BOOKING</ThemedText>
                <ThemedText style={[styles.reviewValue, { color: theme.text }]}>{bookingLabel}</ThemedText>
              </View>
              <Pressable onPress={() => setStep(4)} hitSlop={8}>
                <Feather name="edit-2" size={15} color={theme.textTertiary} />
              </Pressable>
            </View>
          </GlassCard>

          {saveError.length > 0 ? (
            <ThemedText style={styles.saveErrorText}>{saveError}</ThemedText>
          ) : null}

          {isEditMode ? (
            confirmDelete ? (
              <Animated.View entering={FadeIn.duration(200)} style={[styles.deleteConfirmCard, { backgroundColor: "#FF3B3010", borderColor: "#FF3B3030" }]}>
                <View style={styles.deleteConfirmInner}>
                  <Feather name="alert-triangle" size={16} color="#FF3B30" />
                  <ThemedText style={[styles.deleteConfirmTitle, { color: "#FF3B30" }]}>
                    Delete this service permanently?
                  </ThemedText>
                </View>
                <ThemedText style={[styles.deleteConfirmSub, { color: theme.textSecondary }]}>
                  This cannot be undone. All bookings and data for this service will be removed.
                </ThemedText>
                <View style={styles.deleteConfirmBtns}>
                  <Pressable
                    onPress={() => setConfirmDelete(false)}
                    style={[styles.deleteConfirmCancelBtn, { borderColor: theme.borderLight }]}
                    testID="button-cancel-delete"
                  >
                    <ThemedText style={[styles.deleteConfirmCancelText, { color: theme.textSecondary }]}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={handleDelete}
                    style={styles.deleteConfirmDeleteBtn}
                    disabled={deleting}
                    testID="button-confirm-delete"
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <ThemedText style={styles.deleteConfirmDeleteText}>Delete Service</ThemedText>
                    )}
                  </Pressable>
                </View>
              </Animated.View>
            ) : (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setConfirmDelete(true); }}
                style={[styles.deleteServiceBtn, { borderColor: "#FF3B3040" }]}
                testID="button-delete-service"
              >
                <Feather name="trash-2" size={15} color="#FF3B30" />
                <ThemedText style={[styles.deleteServiceText, { color: "#FF3B30" }]}>
                  Delete This Service
                </ThemedText>
              </Pressable>
            )
          ) : null}
        </Animated.View>
      </ScrollView>
    );
  };

  // ─── Customer Preview Modal ──────────────────────────────────────────────────
  const renderPreview = () => {
    const effectiveBookingMode = pricingType === "quote" ? "quote_only" : bookingMode;
    const isQuote = effectiveBookingMode === "quote_only";

    return (
      <Modal visible={previewVisible} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={styles.flex}>
          <View style={[styles.previewHeader, { paddingTop: insets.top + Spacing.md, borderBottomColor: theme.borderLight }]}>
            <View style={[styles.previewBanner, { backgroundColor: Colors.accent + "15" }]}>
              <Feather name="eye" size={14} color={Colors.accent} />
              <ThemedText style={[styles.previewBannerText, { color: Colors.accent }]}>Customer View</ThemedText>
            </View>
            <Pressable onPress={() => setPreviewVisible(false)} style={styles.previewClose}>
              <Feather name="x" size={22} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.previewContent, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
          >
            <GlassCard style={styles.previewServiceCard}>
              <View style={styles.previewServiceHeader}>
                <View style={[styles.previewServiceIcon, { backgroundColor: Colors.accent + "18" }]}>
                  <Feather name="briefcase" size={24} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="h3" style={{ fontWeight: "700" }}>{serviceName || "Service name"}</ThemedText>
                  <ThemedText style={[styles.previewCategory, { color: Colors.accent }]}>{serviceCategory}</ThemedText>
                </View>
              </View>
              {serviceDescription ? (
                <ThemedText style={[styles.previewDesc, { color: theme.textSecondary }]}>{serviceDescription}</ThemedText>
              ) : null}
              <View style={[styles.previewPriceRow, { borderTopColor: theme.borderLight }]}>
                {isQuote ? (
                  <View style={[styles.quoteBadge, { backgroundColor: "#AF52DE18" }]}>
                    <Feather name="file-text" size={14} color="#AF52DE" />
                    <ThemedText style={[styles.quoteBadgeText, { color: "#AF52DE" }]}>Request a Quote</ThemedText>
                  </View>
                ) : (
                  <ThemedText type="h3" style={[styles.previewPrice, { color: Colors.accent }]}>
                    {getPriceDisplay()}
                  </ThemedText>
                )}
              </View>
            </GlassCard>

            {questions.length > 0 ? (
              <GlassCard style={styles.previewSectionCard}>
                <ThemedText style={[styles.previewSectionTitle, { color: theme.textTertiary }]}>
                  BOOKING QUESTIONS
                </ThemedText>
                {questions.map((q, i) => (
                  <View key={q.id} style={[styles.previewItem, { borderBottomColor: theme.borderLight }, i < questions.length - 1 && styles.listRowBorder]}>
                    <ThemedText style={[styles.listName, { color: theme.text }]}>
                      {i + 1}. {q.question}{q.required ? " *" : ""}
                    </ThemedText>
                  </View>
                ))}
              </GlassCard>
            ) : null}

            {addOns.length > 0 ? (
              <GlassCard style={styles.previewSectionCard}>
                <ThemedText style={[styles.previewSectionTitle, { color: theme.textTertiary }]}>
                  OPTIONAL UPGRADES
                </ThemedText>
                {addOns.map((a, i) => (
                  <View key={a.id} style={[styles.previewItem, { borderBottomColor: theme.borderLight }, i < addOns.length - 1 && styles.listRowBorder]}>
                    <ThemedText style={[styles.listName, { color: theme.text }]}>{a.name}</ThemedText>
                    <ThemedText style={[styles.addonPrice, { color: Colors.accent }]}>+${a.price}</ThemedText>
                  </View>
                ))}
              </GlassCard>
            ) : null}

            <Pressable
              style={[styles.previewCTA, { backgroundColor: isQuote ? "#AF52DE" : Colors.accent }]}
            >
              <ThemedText style={styles.previewCTAText}>
                {isQuote ? "Request a Quote" : "Book Now"}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </ThemedView>
      </Modal>
    );
  };

  // ─── Main render ─────────────────────────────────────────────────────────────
  const canProceed = [
    serviceName.trim().length > 0,
    true,
    true,
    true,
    true,
    serviceName.trim().length > 0,
  ];

  const quickEditLabel = saving ? "Saving..." : "Save Changes";

  const finalStepLabel = isOnboardingMode
    ? "Add to My Onboarding"
    : saving
      ? (isEditMode ? "Saving..." : "Publishing...")
      : (isEditMode ? "Save Changes" : "Publish Service");

  const CTALabels = isQuickEdit
    ? [
        quickEditLabel,
        quickEditLabel,
        quickEditLabel,
        quickEditLabel,
        quickEditLabel,
        quickEditLabel,
      ]
    : [
        "Continue to Pricing",
        "Continue to Questions",
        "Continue to Add-ons",
        "Continue to Booking",
        isEditMode ? "Review Changes" : "Review My Service",
        finalStepLabel,
      ];

  const handleCTA = () => {
    if (!isQuickEdit && step < 5) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep(step + 1);
    } else {
      handleSave();
    }
  };

  return (
    <ThemedView style={styles.container}>
      {isQuickEdit ? null : (
        <View style={[styles.progressRow, { paddingTop: headerHeight + Spacing.xs }]}>
          <View style={styles.progressLabelRow}>
            <ThemedText style={[styles.stepLabel, { color: theme.textTertiary }]}>
              {WIZARD_STEPS[step]}
            </ThemedText>
            <ThemedText style={[styles.stepLabel, { color: theme.textTertiary }]}>
              {step + 1} of {WIZARD_STEPS.length}
            </ThemedText>
          </View>
          <ProgressBar step={step} total={WIZARD_STEPS.length} />
        </View>
      )}

      {step === 0 ? renderStep0() : null}
      {step === 1 ? renderStep1() : null}
      {step === 2 ? renderStep2() : null}
      {step === 3 ? renderStep3() : null}
      {step === 4 ? renderStep4() : null}
      {step === 5 ? renderStep5() : null}

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.sm, borderTopColor: theme.borderLight, backgroundColor: theme.backgroundDefault }]}>
        <PrimaryButton
          onPress={handleCTA}
          disabled={!canProceed[step] || saving}
          loading={saving}
          testID="button-wizard-cta"
        >
          {CTALabels[step]}
        </PrimaryButton>
      </View>

      {renderPreview()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  progressRow: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressContainer: {
    flexDirection: "row",
    gap: 4,
    height: 4,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  progressSegment: { height: 4, borderRadius: BorderRadius.full },
  stepLabel: { ...Typography.caption, textTransform: "uppercase", letterSpacing: 0.5 },
  stepContent: { paddingHorizontal: Spacing.screenPadding, gap: Spacing.md },
  stepInner: { gap: Spacing.md },
  stepHeading: { fontWeight: "700", marginBottom: 2 },
  stepSubheading: { ...Typography.body, lineHeight: 22, marginBottom: Spacing.xs },
  backRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  backText: { ...Typography.subhead, fontWeight: "600" },
  sectionLabel: {
    ...Typography.caption,
    letterSpacing: 0.5,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  fieldGroup: { gap: 6 },
  inputBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inputBoxMulti: { minHeight: 80, paddingTop: Spacing.sm },
  inputText: { ...Typography.body, flex: 1 },
  pillsRow: { flexDirection: "row", gap: Spacing.xs, paddingBottom: 4 },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pillText: { ...Typography.caption, fontWeight: "600" },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  linkText: { ...Typography.caption, fontWeight: "500" },
  optionsList: { gap: Spacing.sm },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  optionInfo: { flex: 1 },
  optionLabel: { ...Typography.subhead, fontWeight: "600" },
  optionHint: { ...Typography.caption, marginTop: 2 },
  priceInputRow: { flexDirection: "row", gap: Spacing.sm },
  priceAmountBox: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pricePrefixInline: {
    ...Typography.body,
    fontWeight: "600",
    marginRight: Spacing.xs,
  },
  priceUnitBox: {
    flex: 1.5,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  infoCardText: { flex: 1, ...Typography.body, lineHeight: 22 },
  descHeader: { marginBottom: Spacing.xs },
  aiDescBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  aiDescBtnText: { ...Typography.caption, fontWeight: "600" },
  aiDescError: { ...Typography.caption, textAlign: "center", marginTop: Spacing.xs },
  aiAssistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  aiAssistText: { ...Typography.caption, fontWeight: "600" },
  aiErrorText: { ...Typography.caption, color: "#FF3B30", textAlign: "center" },
  suggestionCard: {
    padding: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
  },
  suggestionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  suggestionTitle: { ...Typography.caption, fontWeight: "700", flex: 1 },
  suggestionText: { ...Typography.body, lineHeight: 20 },
  listCard: { padding: 0, overflow: "hidden" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  listRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  listNum: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  listNumText: { ...Typography.caption, fontWeight: "700" },
  listInfo: { flex: 1, gap: 2 },
  listName: { ...Typography.subhead, fontWeight: "600" },
  listMeta: { ...Typography.caption },
  addonPrice: { ...Typography.subhead, fontWeight: "700" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addBtnText: { ...Typography.subhead, fontWeight: "600" },
  addFormCard: { padding: Spacing.md, gap: Spacing.md },
  addFormRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addFormToggle: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  addFormToggleLabel: { ...Typography.caption, fontWeight: "500" },
  addFormBtns: { flexDirection: "row", gap: Spacing.sm },
  addFormCancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  addFormCancelText: { ...Typography.caption, fontWeight: "600" },
  addFormConfirmBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  addFormConfirmText: { ...Typography.caption, fontWeight: "700", color: "#fff" },
  suggestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  suggestHeaderLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  suggestHeaderText: { ...Typography.caption, fontWeight: "600" },
  addSuggestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  addSuggestText: { ...Typography.caption, fontWeight: "600" },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
  },
  previewBtnText: { ...Typography.caption, fontWeight: "600" },
  reviewCard: { padding: 0, overflow: "hidden" },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  reviewIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  reviewInfo: { flex: 1, gap: 2 },
  reviewLabel: { ...Typography.caption, letterSpacing: 0.4, fontWeight: "600" },
  reviewValue: { ...Typography.subhead, fontWeight: "700" },
  reviewMeta: { ...Typography.caption },
  reviewDivider: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.md + 36 + Spacing.md },
  saveErrorText: { ...Typography.caption, color: "#FF3B30", textAlign: "center" },
  deleteServiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  deleteServiceText: { ...Typography.body, fontWeight: "600" },
  deleteConfirmCard: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  deleteConfirmInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  deleteConfirmTitle: { ...Typography.body, fontWeight: "700", flex: 1 },
  deleteConfirmSub: { ...Typography.caption, lineHeight: 18, marginBottom: Spacing.md },
  deleteConfirmBtns: { flexDirection: "row", gap: Spacing.sm },
  deleteConfirmCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  deleteConfirmCancelText: { ...Typography.body, fontWeight: "600" },
  deleteConfirmDeleteBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteConfirmDeleteText: { ...Typography.body, fontWeight: "700", color: "#fff" },
  bottomBar: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  previewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  previewBannerText: { ...Typography.caption, fontWeight: "600" },
  previewClose: { padding: Spacing.xs },
  previewContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  previewServiceCard: { padding: Spacing.md, gap: Spacing.md },
  previewServiceHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  previewServiceIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCategory: { ...Typography.subhead, fontWeight: "600" },
  previewDesc: { ...Typography.body, lineHeight: 22 },
  previewPriceRow: {
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewPrice: { fontWeight: "700" },
  quoteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  quoteBadgeText: { ...Typography.subhead, fontWeight: "700" },
  previewSectionCard: { padding: Spacing.md, gap: Spacing.sm },
  previewSectionTitle: {
    ...Typography.caption,
    letterSpacing: 0.5,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  previewItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  previewCTA: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  previewCTAText: { color: "#fff", fontWeight: "700", fontSize: 17 },
});
