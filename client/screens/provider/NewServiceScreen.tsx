import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/state/authStore";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useQueryClient } from "@tanstack/react-query";

type FeatherIconName = ComponentProps<typeof Feather>["name"];
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface PriceTier {
  id: string;
  label: string;
  price: string;
}

interface PriceSuggestion {
  minPrice: number;
  maxPrice: number;
  unit: string;
  hint: string;
}

interface CategoryOption {
  id: string;
  icon: FeatherIconName;
}

type PricingModel = "flat" | "variable" | "quote" | "service_call";

interface PricingOption {
  id: PricingModel;
  name: string;
  description: string;
  icon: FeatherIconName;
}

const CATEGORIES: CategoryOption[] = [
  { id: "Cleaning", icon: "home" },
  { id: "HVAC", icon: "thermometer" },
  { id: "Plumbing", icon: "droplet" },
  { id: "Electrical", icon: "zap" },
  { id: "Landscaping", icon: "sun" },
  { id: "Handyman", icon: "tool" },
  { id: "Painting", icon: "edit-3" },
  { id: "Roofing", icon: "triangle" },
];

const DURATION_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "1.5 hr", value: 90 },
  { label: "2 hr", value: 120 },
  { label: "3 hr", value: 180 },
  { label: "4 hr", value: 240 },
];

const PRICING_MODELS: PricingOption[] = [
  {
    id: "flat",
    name: "Flat Rate",
    description: "One price for the whole job",
    icon: "dollar-sign",
  },
  {
    id: "variable",
    name: "Size / Tier Based",
    description: "Different prices by size or scope",
    icon: "sliders",
  },
  {
    id: "service_call",
    name: "Service Call",
    description: "Diagnostic fee + additional labor",
    icon: "tool",
  },
  {
    id: "quote",
    name: "Custom Quote",
    description: "Customer requests a quote",
    icon: "file-text",
  },
];

const KEYWORD_CATEGORY_MAP: Record<string, string> = {
  clean: "Cleaning",
  maid: "Cleaning",
  vacuum: "Cleaning",
  sweep: "Cleaning",
  hvac: "HVAC",
  heat: "HVAC",
  cool: "HVAC",
  air: "HVAC",
  furnace: "HVAC",
  ac: "HVAC",
  plumb: "Plumbing",
  drain: "Plumbing",
  pipe: "Plumbing",
  leak: "Plumbing",
  faucet: "Plumbing",
  toilet: "Plumbing",
  electric: "Electrical",
  wire: "Electrical",
  outlet: "Electrical",
  panel: "Electrical",
  light: "Electrical",
  lawn: "Landscaping",
  garden: "Landscaping",
  mow: "Landscaping",
  trim: "Landscaping",
  landscape: "Landscaping",
  tree: "Landscaping",
  paint: "Painting",
  handyman: "Handyman",
  repair: "Handyman",
  fix: "Handyman",
  install: "Handyman",
  roof: "Roofing",
  gutter: "Roofing",
  shingle: "Roofing",
};

function suggestCategory(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [keyword, cat] of Object.entries(KEYWORD_CATEGORY_MAP)) {
    if (lower.includes(keyword)) return cat;
  }
  return null;
}

export default function NewServiceScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { providerProfile } = useAuthStore();
  const queryClient = useQueryClient();
  const providerId = providerProfile?.id;

  const routeParams = route.params as RootStackParamList["EditService"] | undefined;
  const editServiceId = routeParams?.serviceId;
  const editServiceData = routeParams?.service;
  const isEditMode = !!editServiceId;

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const [categorySuggestionDismissed, setCategorySuggestionDismissed] = useState(false);
  const [pricingModel, setPricingModel] = useState<PricingModel>("flat");
  const [flatPrice, setFlatPrice] = useState("");
  const [serviceCallFee, setServiceCallFee] = useState("");
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([
    { id: "1", label: "Small", price: "" },
    { id: "2", label: "Medium", price: "" },
    { id: "3", label: "Large", price: "" },
  ]);
  const [duration, setDuration] = useState(60);
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isImprovingDescription, setIsImprovingDescription] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState<PriceSuggestion | null>(null);
  const [priceSuggestionDismissed, setPriceSuggestionDismissed] = useState(false);
  const [showSavedTip, setShowSavedTip] = useState(false);
  const [saveError, setSaveError] = useState("");

  const priceFetchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isEditMode && editServiceData) {
      const svc = editServiceData;
      if (svc.name) setName(String(svc.name));
      if (svc.category) setCategory(String(svc.category));
      if (svc.description) setDescription(String(svc.description));
      if (svc.duration) setDuration(Number(svc.duration));
      if (svc.pricingType) {
        const pt = String(svc.pricingType);
        if (pt === "fixed") setPricingModel("flat");
        else if (pt === "variable") setPricingModel("variable");
        else if (pt === "quote") setPricingModel("quote");
        else if (pt === "service_call") setPricingModel("service_call");
        else setPricingModel("flat");
      }
      if (svc.basePrice) {
        const bp = String(svc.basePrice);
        const pt = String(svc.pricingType);
        if (pt === "service_call") setServiceCallFee(bp);
        else setFlatPrice(bp);
      }
      if (svc.priceTiersJson) {
        try {
          const parsed = JSON.parse(String(svc.priceTiersJson));
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPriceTiers(parsed);
          }
        } catch {}
      }
    }
    if (isEditMode) {
      navigation.setOptions({ headerTitle: "Edit Service" });
    }
  }, [isEditMode, editServiceData, navigation]);

  const handleNameChange = useCallback((text: string) => {
    setName(text);
    const suggestion = suggestCategory(text);
    if (suggestion && suggestion !== category) {
      setSuggestedCategory(suggestion);
      setCategorySuggestionDismissed(false);
    } else if (!suggestion) {
      setSuggestedCategory(null);
    }
  }, [category]);

  const applyCategorySuggestion = () => {
    if (suggestedCategory) {
      Haptics.selectionAsync();
      setCategory(suggestedCategory);
      setSuggestedCategory(null);
    }
  };

  const fetchPriceSuggestion = useCallback(async (svcName: string, cat: string, pricing: PricingModel) => {
    if (!svcName.trim() || !cat) return;
    try {
      const url = new URL("/api/ai/suggest-price", getApiUrl());
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: svcName,
          category: cat,
          pricingType: pricing,
          location: providerProfile?.serviceArea || undefined,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.suggestion) {
          setPriceSuggestion(data.suggestion);
          setPriceSuggestionDismissed(false);
        }
      }
    } catch {}
  }, [providerProfile?.serviceArea]);

  useEffect(() => {
    if (pricingModel === "quote") {
      setPriceSuggestion(null);
      return;
    }
    if (!name.trim() || !category) return;
    if (priceFetchTimeout.current) clearTimeout(priceFetchTimeout.current);
    priceFetchTimeout.current = setTimeout(() => {
      fetchPriceSuggestion(name, category, pricingModel);
    }, 800);
    return () => {
      if (priceFetchTimeout.current) clearTimeout(priceFetchTimeout.current);
    };
  }, [name, category, pricingModel, fetchPriceSuggestion]);

  const handleImproveDescription = async () => {
    if (!name.trim() || !category) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsImprovingDescription(true);
    try {
      const url = new URL("/api/ai/suggest-description", getApiUrl());
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceName: name.trim(), category }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.description) setDescription(data.description);
      }
    } catch {}
    setIsImprovingDescription(false);
  };

  const addTier = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPriceTiers((prev) => [...prev, { id: Date.now().toString(), label: "", price: "" }]);
  };

  const removeTier = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPriceTiers((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTier = (id: string, field: "label" | "price", value: string) => {
    setPriceTiers((prev) => prev.map((t) => t.id === id ? { ...t, [field]: value } : t));
  };

  const pricingTypeToDB = (model: PricingModel): string => {
    if (model === "flat") return "fixed";
    if (model === "variable") return "variable";
    if (model === "service_call") return "service_call";
    return "quote";
  };

  const isValid = name.trim().length > 0 && category.length > 0 && (
    pricingModel === "quote" ||
    (pricingModel === "flat" && flatPrice.trim().length > 0) ||
    (pricingModel === "variable" && priceTiers.some((t) => t.label.trim() && t.price.trim())) ||
    (pricingModel === "service_call" && serviceCallFee.trim().length > 0)
  );

  const handleSave = async () => {
    if (!isValid || !providerId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSaving(true);
    setSaveError("");

    const tiersJson = pricingModel === "variable"
      ? JSON.stringify(priceTiers.filter((t) => t.label.trim() && t.price.trim()))
      : null;

    const firstTierPrice = pricingModel === "variable"
      ? priceTiers.find((t) => t.price.trim())?.price || null
      : null;

    const basePrice = pricingModel === "flat"
      ? flatPrice
      : pricingModel === "service_call"
        ? serviceCallFee
        : firstTierPrice;

    const payload = {
      name: name.trim(),
      category,
      description: description.trim() || null,
      pricingType: pricingTypeToDB(pricingModel),
      basePrice,
      priceTiersJson: tiersJson,
      duration,
      isPublished: true,
    };

    try {
      const url = isEditMode
        ? new URL(`/api/provider/${providerId}/custom-services/${editServiceId}`, getApiUrl())
        : new URL(`/api/provider/${providerId}/custom-services`, getApiUrl());
      const method = isEditMode ? "PUT" : "POST";
      const response = await apiRequest(method, url.toString(), payload);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        setSaveError(err.error || "Failed to save service");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "custom-services"] });
      if (!isEditMode) {
        setShowSavedTip(true);
      } else {
        navigation.goBack();
      }
    } catch {
      setSaveError("Failed to save service. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const sectionStyle: ViewStyle = styles.section;
  const tipCardStyle: ViewStyle = StyleSheet.flatten([styles.tipCard, { borderColor: Colors.accent + "40" }]);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
          {showSavedTip ? (
            <Animated.View entering={FadeIn.duration(300)}>
              <GlassCard style={tipCardStyle}>
                <View style={styles.tipRow}>
                  <View style={[styles.tipIcon, { backgroundColor: Colors.accent + "20" }]}>
                    <Feather name="camera" size={18} color={Colors.accent} />
                  </View>
                  <View style={styles.tipContent}>
                    <ThemedText style={styles.tipTitle}>Service saved!</ThemedText>
                    <ThemedText style={[styles.tipBody, { color: theme.textSecondary }]}>
                      Add photos to your profile to help customers trust your work and book faster.
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => navigation.goBack()}
                    style={styles.tipClose}
                  >
                    <Feather name="x" size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>
                <Pressable
                  style={[styles.tipAction, { borderTopColor: theme.borderLight }]}
                  onPress={() => navigation.goBack()}
                >
                  <ThemedText style={[styles.tipActionText, { color: Colors.accent }]}>
                    Done
                  </ThemedText>
                </Pressable>
              </GlassCard>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(50).duration(300)}>
            <GlassCard style={sectionStyle}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                SERVICE NAME
              </ThemedText>
              <TextInput
                style={[
                  styles.nameInput,
                  { color: theme.text, borderColor: theme.borderLight, backgroundColor: theme.backgroundElevated },
                ]}
                placeholder="e.g., Deep Clean, AC Tune-Up, Drain Clearing..."
                placeholderTextColor={theme.textTertiary}
                value={name}
                onChangeText={handleNameChange}
                returnKeyType="next"
                testID="input-service-name"
              />
              {suggestedCategory && !categorySuggestionDismissed ? (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  style={[styles.categorySuggestion, { backgroundColor: Colors.accent + "10", borderColor: Colors.accent + "30" }]}
                >
                  <Feather name="tag" size={13} color={Colors.accent} />
                  <ThemedText style={[styles.categorySuggestionText, { color: Colors.accent }]}>
                    Suggested category:
                  </ThemedText>
                  <Pressable
                    onPress={applyCategorySuggestion}
                    style={[styles.categorySuggestionBtn, { backgroundColor: Colors.accent }]}
                  >
                    <ThemedText style={styles.categorySuggestionBtnText}>{suggestedCategory}</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setCategorySuggestionDismissed(true)}
                    style={styles.categorySuggestionDismiss}
                  >
                    <Feather name="x" size={14} color={Colors.accent} />
                  </Pressable>
                </Animated.View>
              ) : null}
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <GlassCard style={sectionStyle}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                CATEGORY
              </ThemedText>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => {
                  const selected = category === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setCategory(cat.id);
                        setSuggestedCategory(null);
                      }}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: selected ? Colors.accent : theme.backgroundElevated,
                          borderColor: selected ? Colors.accent : theme.borderLight,
                        },
                      ]}
                      testID={`chip-category-${cat.id}`}
                    >
                      <Feather
                        name={cat.icon}
                        size={14}
                        color={selected ? "#fff" : theme.textSecondary}
                        style={{ marginRight: 5 }}
                      />
                      <ThemedText
                        style={[styles.categoryChipText, { color: selected ? "#fff" : theme.text }]}
                      >
                        {cat.id}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(300)}>
            <GlassCard style={sectionStyle}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                PRICING MODEL
              </ThemedText>
              <View style={styles.pricingGrid}>
                {PRICING_MODELS.map((model) => {
                  const selected = pricingModel === model.id;
                  return (
                    <Pressable
                      key={model.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPricingModel(model.id);
                        setPriceSuggestionDismissed(false);
                      }}
                      style={[
                        styles.pricingCard,
                        {
                          backgroundColor: selected ? Colors.accent + "12" : theme.backgroundElevated,
                          borderColor: selected ? Colors.accent : "transparent",
                        },
                      ]}
                      testID={`option-pricing-${model.id}`}
                    >
                      <View
                        style={[
                          styles.pricingIconBox,
                          { backgroundColor: selected ? Colors.accent : theme.cardBackground },
                        ]}
                      >
                        <Feather
                          name={model.icon}
                          size={18}
                          color={selected ? "#fff" : theme.textSecondary}
                        />
                      </View>
                      <View style={styles.pricingInfo}>
                        <ThemedText style={styles.pricingName}>{model.name}</ThemedText>
                        <ThemedText style={[styles.pricingDesc, { color: theme.textSecondary }]}>
                          {model.description}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: selected ? Colors.accent : theme.borderLight },
                        ]}
                      >
                        {selected ? (
                          <View style={[styles.radioInner, { backgroundColor: Colors.accent }]} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {pricingModel === "flat" ? (
                <Animated.View entering={FadeInDown.duration(200)} style={styles.priceSection}>
                  <ThemedText style={[styles.subLabel, { color: theme.textSecondary }]}>
                    Price
                  </ThemedText>
                  <View style={styles.priceInputRow}>
                    <ThemedText style={[styles.dollarSign, { color: theme.textSecondary }]}>$</ThemedText>
                    <TextInput
                      style={[
                        styles.priceInput,
                        { color: theme.text, borderColor: theme.borderLight, backgroundColor: theme.backgroundElevated },
                      ]}
                      placeholder="0.00"
                      placeholderTextColor={theme.textTertiary}
                      value={flatPrice}
                      onChangeText={setFlatPrice}
                      keyboardType="decimal-pad"
                      testID="input-flat-price"
                    />
                  </View>
                  {priceSuggestion && !priceSuggestionDismissed ? (
                    <Animated.View entering={FadeIn.duration(250)} style={[styles.suggestionBanner, { backgroundColor: Colors.accent + "10", borderColor: Colors.accent + "30" }]}>
                      <Feather name="trending-up" size={13} color={Colors.accent} style={{ marginRight: 6 }} />
                      <ThemedText style={[styles.suggestionText, { color: Colors.accent, flex: 1 }]}>
                        Suggested: ${priceSuggestion.minPrice}–${priceSuggestion.maxPrice} {priceSuggestion.unit}
                      </ThemedText>
                      <Pressable onPress={() => setPriceSuggestionDismissed(true)}>
                        <Feather name="x" size={14} color={Colors.accent} />
                      </Pressable>
                    </Animated.View>
                  ) : null}
                </Animated.View>
              ) : pricingModel === "variable" ? (
                <Animated.View entering={FadeInDown.duration(200)} style={styles.priceSection}>
                  <View style={styles.tiersHeader}>
                    <ThemedText style={[styles.subLabel, { color: theme.textSecondary }]}>
                      Price Tiers
                    </ThemedText>
                    <Pressable onPress={addTier} style={[styles.addTierBtn, { backgroundColor: Colors.accent + "15" }]}>
                      <Feather name="plus" size={14} color={Colors.accent} />
                      <ThemedText style={[styles.addTierText, { color: Colors.accent }]}>Add tier</ThemedText>
                    </Pressable>
                  </View>
                  {priceTiers.map((tier, index) => (
                    <View key={tier.id} style={styles.tierRow}>
                      <TextInput
                        style={[
                          styles.tierLabelInput,
                          { color: theme.text, borderColor: theme.borderLight, backgroundColor: theme.backgroundElevated },
                        ]}
                        placeholder="e.g., Small"
                        placeholderTextColor={theme.textTertiary}
                        value={tier.label}
                        onChangeText={(v) => updateTier(tier.id, "label", v)}
                        testID={`input-tier-label-${index}`}
                      />
                      <View style={styles.tierPriceRow}>
                        <ThemedText style={[styles.dollarSign, { color: theme.textSecondary }]}>$</ThemedText>
                        <TextInput
                          style={[
                            styles.tierPriceInput,
                            { color: theme.text, borderColor: theme.borderLight, backgroundColor: theme.backgroundElevated },
                          ]}
                          placeholder="0"
                          placeholderTextColor={theme.textTertiary}
                          value={tier.price}
                          onChangeText={(v) => updateTier(tier.id, "price", v)}
                          keyboardType="decimal-pad"
                          testID={`input-tier-price-${index}`}
                        />
                      </View>
                      {priceTiers.length > 1 ? (
                        <Pressable onPress={() => removeTier(tier.id)} style={styles.removeTierBtn}>
                          <Feather name="x" size={16} color={theme.textSecondary} />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                  {priceSuggestion && !priceSuggestionDismissed ? (
                    <Animated.View entering={FadeIn.duration(250)} style={[styles.suggestionBanner, { backgroundColor: Colors.accent + "10", borderColor: Colors.accent + "30" }]}>
                      <Feather name="trending-up" size={13} color={Colors.accent} style={{ marginRight: 6 }} />
                      <ThemedText style={[styles.suggestionText, { color: Colors.accent, flex: 1 }]}>
                        Market range: ${priceSuggestion.minPrice}–${priceSuggestion.maxPrice} {priceSuggestion.unit}
                      </ThemedText>
                      <Pressable onPress={() => setPriceSuggestionDismissed(true)}>
                        <Feather name="x" size={14} color={Colors.accent} />
                      </Pressable>
                    </Animated.View>
                  ) : null}
                </Animated.View>
              ) : pricingModel === "service_call" ? (
                <Animated.View entering={FadeInDown.duration(200)} style={styles.priceSection}>
                  <ThemedText style={[styles.subLabel, { color: theme.textSecondary }]}>
                    Diagnostic / Service Call Fee
                  </ThemedText>
                  <View style={styles.priceInputRow}>
                    <ThemedText style={[styles.dollarSign, { color: theme.textSecondary }]}>$</ThemedText>
                    <TextInput
                      style={[
                        styles.priceInput,
                        { color: theme.text, borderColor: theme.borderLight, backgroundColor: theme.backgroundElevated },
                      ]}
                      placeholder="0.00"
                      placeholderTextColor={theme.textTertiary}
                      value={serviceCallFee}
                      onChangeText={setServiceCallFee}
                      keyboardType="decimal-pad"
                      testID="input-service-call-fee"
                    />
                  </View>
                  <ThemedText style={[styles.quoteNoticeText, { color: theme.textTertiary, marginTop: Spacing.sm }]}>
                    This fee covers the visit and diagnosis. Additional labor is billed separately.
                  </ThemedText>
                </Animated.View>
              ) : (
                <Animated.View entering={FadeInDown.duration(200)} style={[styles.quoteNotice, { backgroundColor: theme.backgroundElevated }]}>
                  <Feather name="info" size={16} color={theme.textSecondary} style={{ marginRight: Spacing.sm }} />
                  <ThemedText style={[styles.quoteNoticeText, { color: theme.textSecondary }]}>
                    No price is shown to customers. They will submit a request and you respond with a custom quote.
                  </ThemedText>
                </Animated.View>
              )}
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(300)}>
            <GlassCard style={sectionStyle}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                DURATION
              </ThemedText>
              <View style={styles.durationRow}>
                {DURATION_OPTIONS.map((opt) => {
                  const selected = duration === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setDuration(opt.value);
                      }}
                      style={[
                        styles.durationChip,
                        {
                          backgroundColor: selected ? Colors.accent : theme.backgroundElevated,
                          borderColor: selected ? Colors.accent : theme.borderLight,
                        },
                      ]}
                      testID={`chip-duration-${opt.value}`}
                    >
                      <ThemedText style={[styles.durationChipText, { color: selected ? "#fff" : theme.text }]}>
                        {opt.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).duration(300)}>
            <GlassCard style={sectionStyle}>
              <View style={styles.descHeader}>
                <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                  DESCRIPTION
                </ThemedText>
                <ThemedText style={[styles.optionalLabel, { color: theme.textTertiary }]}>
                  Optional
                </ThemedText>
              </View>
              <TextInput
                style={[
                  styles.descInput,
                  { color: theme.text, borderColor: theme.borderLight, backgroundColor: theme.backgroundElevated },
                ]}
                placeholder="Describe what's included, tools you use, what makes you stand out..."
                placeholderTextColor={theme.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                testID="input-description"
              />
              <Pressable
                onPress={handleImproveDescription}
                disabled={isImprovingDescription || !name.trim() || !category}
                style={[
                  styles.improveBtn,
                  {
                    backgroundColor: Colors.accent + "12",
                    borderColor: Colors.accent + "30",
                    opacity: (!name.trim() || !category) ? 0.5 : 1,
                  },
                ]}
                testID="button-improve-description"
              >
                {isImprovingDescription ? (
                  <ActivityIndicator size="small" color={Colors.accent} style={{ marginRight: 6 }} />
                ) : (
                  <Feather name="zap" size={14} color={Colors.accent} style={{ marginRight: 6 }} />
                )}
                <ThemedText style={[styles.improveBtnText, { color: Colors.accent }]}>
                  {isImprovingDescription ? "Improving..." : "Improve description with AI"}
                </ThemedText>
              </Pressable>
              {priceSuggestion?.hint && !priceSuggestionDismissed && name.trim().length > 0 && category.length > 0 ? (
                <Animated.View entering={FadeIn.duration(250)} style={[styles.hintRow, { backgroundColor: theme.backgroundElevated }]}>
                  <Feather name="info" size={13} color={theme.textTertiary} style={{ marginRight: 5 }} />
                  <ThemedText style={[styles.hintText, { color: theme.textTertiary }]}>
                    {priceSuggestion.hint}
                  </ThemedText>
                </Animated.View>
              ) : null}
            </GlassCard>
          </Animated.View>

      </KeyboardAwareScrollViewCompat>

      <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + Spacing.md }]}>
        {saveError ? (
          <View style={[styles.errorBanner, { backgroundColor: "#FF453A20", borderColor: "#FF453A40", marginBottom: Spacing.sm }]}>
            <Feather name="alert-circle" size={16} color="#FF453A" style={{ marginRight: 6 }} />
            <ThemedText style={[styles.errorText, { color: "#FF453A" }]}>{saveError}</ThemedText>
          </View>
        ) : null}
        <PrimaryButton
          onPress={handleSave}
          disabled={!isValid || isSaving}
          testID="button-save-service"
        >
          {isSaving ? "Saving..." : isEditMode ? "Save Changes" : "Save Service"}
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    padding: Spacing.screenPadding,
    gap: Spacing.md,
  },
  stickyFooter: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  section: {
    padding: Spacing.md,
  },
  sectionTitle: {
    ...Typography.caption1,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  nameInput: {
    ...Typography.body,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  categorySuggestion: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  categorySuggestionText: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  categorySuggestionBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  categorySuggestionBtnText: {
    ...Typography.caption2,
    color: "#fff",
    fontWeight: "700",
  },
  categorySuggestionDismiss: {
    marginLeft: "auto",
    padding: 2,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs + 2,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  categoryChipText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  pricingGrid: {
    gap: Spacing.sm,
  },
  pricingCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  pricingIconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  pricingInfo: { flex: 1 },
  pricingName: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: 2,
  },
  pricingDesc: {
    ...Typography.caption1,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  priceSection: {
    marginTop: Spacing.md,
  },
  subLabel: {
    ...Typography.caption1,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  priceInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dollarSign: {
    ...Typography.title2,
    fontWeight: "600",
    marginRight: Spacing.xs,
  },
  priceInput: {
    ...Typography.title2,
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontWeight: "600",
  },
  tiersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  addTierBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  addTierText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tierLabelInput: {
    ...Typography.body,
    flex: 1,
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  tierPriceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tierPriceInput: {
    ...Typography.body,
    width: 80,
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    fontWeight: "600",
  },
  removeTierBtn: {
    padding: 6,
  },
  suggestionBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  suggestionText: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  quoteNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  quoteNoticeText: {
    ...Typography.caption1,
    flex: 1,
    lineHeight: 18,
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs + 2,
  },
  durationChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  durationChipText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  descHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  optionalLabel: {
    ...Typography.caption2,
    marginBottom: Spacing.md,
  },
  descInput: {
    ...Typography.body,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 100,
    paddingTop: Spacing.md,
  },
  improveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  improveBtnText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  hintText: {
    ...Typography.caption2,
    flex: 1,
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  errorText: {
    ...Typography.body,
    flex: 1,
  },
  tipCard: {
    padding: 0,
    overflow: "hidden",
    borderWidth: 1,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  tipContent: { flex: 1 },
  tipTitle: {
    ...Typography.body,
    fontWeight: "700",
    marginBottom: 3,
  },
  tipBody: {
    ...Typography.caption1,
    lineHeight: 18,
  },
  tipClose: {
    padding: 4,
  },
  tipAction: {
    borderTopWidth: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  tipActionText: {
    ...Typography.body,
    fontWeight: "600",
  },
});
