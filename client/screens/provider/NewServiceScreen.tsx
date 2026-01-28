import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type PricingModel = "fixed" | "variable" | "service_call" | "quote";
type BillingFrequency = "once" | "weekly" | "biweekly" | "monthly";

interface IntakeQuestion {
  id: string;
  question: string;
}

const CATEGORIES = ["Cleaning", "HVAC", "Handyman", "Plumbing", "Electrical", "Landscaping"];

const PRICING_MODELS: { id: PricingModel; name: string; description: string; icon: string }[] = [
  {
    id: "fixed",
    name: "Fixed Price",
    description: "Simple flat rate for the service.",
    icon: "dollar-sign",
  },
  {
    id: "variable",
    name: "Variable Pricing",
    description: "Price adjusts based on size or units.",
    icon: "sliders",
  },
  {
    id: "service_call",
    name: "Service Call",
    description: "Fee for showing up + hourly rate.",
    icon: "phone",
  },
  {
    id: "quote",
    name: "Quote Only",
    description: "No price shown. Requires estimate.",
    icon: "file-text",
  },
];

const BILLING_OPTIONS: { id: BillingFrequency; label: string }[] = [
  { id: "once", label: "Once" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "2 Wks" },
  { id: "monthly", label: "Month" },
];

export default function NewServiceScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [pricingModel, setPricingModel] = useState<PricingModel>("fixed");
  const [price, setPrice] = useState("");
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>("once");
  const [duration, setDuration] = useState("60");
  const [instantBooking, setInstantBooking] = useState(true);
  const [requirePhotos, setRequirePhotos] = useState(false);
  const [intakeQuestions, setIntakeQuestions] = useState<IntakeQuestion[]>([
    { id: "1", question: "Do you have pets? (Yes/No)" },
  ]);
  const [newQuestion, setNewQuestion] = useState("");
  const [discountName, setDiscountName] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const handleSelectCategory = (cat: string) => {
    Haptics.selectionAsync();
    setCategory(cat);
  };

  const handleSelectPricing = (model: PricingModel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPricingModel(model);
  };

  const handleSelectBilling = (freq: BillingFrequency) => {
    Haptics.selectionAsync();
    setBillingFrequency(freq);
  };

  const handleGenerateDescription = async () => {
    if (!name.trim() || !category) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGeneratingDescription(true);
    
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const generated = `Professional ${category.toLowerCase()} service. Our ${name.toLowerCase()} includes thorough attention to detail, quality workmanship, and customer satisfaction guaranteed.`;
    setDescription(generated);
    setIsGeneratingDescription(false);
  };

  const handleAddQuestion = () => {
    if (!newQuestion.trim()) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIntakeQuestions((prev) => [
      ...prev,
      { id: Date.now().toString(), question: newQuestion.trim() },
    ]);
    setNewQuestion("");
  };

  const handleRemoveQuestion = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIntakeQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleSave = async () => {
    if (!name.trim() || !category) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSaving(true);
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    setIsSaving(false);
    navigation.goBack();
  };

  const handlePreview = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ServicePreview" as any, {
      service: {
        name,
        category,
        description,
        pricingModel,
        price,
        duration,
      },
    });
  };

  const isValid = name.trim() && category;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.delay(50).duration(300)}>
            <GlassCard style={styles.section}>
              <ThemedText style={styles.sectionTitle}>SERVICE BASICS</ThemedText>
              
              <View style={styles.inputGroup}>
                <ThemedText type="caption" style={[styles.label, { color: theme.textSecondary }]}>
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
                  placeholder="e.g., Deep Clean"
                  placeholderTextColor={theme.textSecondary}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText type="caption" style={[styles.label, { color: theme.textSecondary }]}>
                  Category
                </ThemedText>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => handleSelectCategory(cat)}
                      style={[
                        styles.categoryOption,
                        {
                          backgroundColor:
                            category === cat ? Colors.accent : theme.backgroundElevated,
                          borderColor:
                            category === cat ? Colors.accent : theme.borderLight,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.categoryOptionText,
                          { color: category === cat ? "#fff" : theme.text },
                        ]}
                      >
                        {cat}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <ThemedText type="caption" style={[styles.label, { color: theme.textSecondary }]}>
                    Description
                  </ThemedText>
                  <Pressable
                    onPress={handleGenerateDescription}
                    disabled={isGeneratingDescription || !name.trim() || !category}
                    style={[
                      styles.aiButton,
                      {
                        opacity: !name.trim() || !category ? 0.5 : 1,
                      },
                    ]}
                  >
                    {isGeneratingDescription ? (
                      <ActivityIndicator size="small" color={Colors.accent} />
                    ) : (
                      <>
                        <Feather name="zap" size={12} color={Colors.accent} />
                        <ThemedText style={[styles.aiButtonText, { color: Colors.accent }]}>
                          Generate with AI
                        </ThemedText>
                      </>
                    )}
                  </Pressable>
                </View>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.textArea,
                    {
                      backgroundColor: theme.backgroundElevated,
                      color: theme.text,
                      borderColor: theme.borderLight,
                    },
                  ]}
                  placeholder="Describe what's included in this service..."
                  placeholderTextColor={theme.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <GlassCard style={styles.section}>
              <ThemedText style={styles.sectionTitle}>PRICING MODEL</ThemedText>
              
              <View style={styles.pricingGrid}>
                {PRICING_MODELS.map((model) => (
                  <Pressable
                    key={model.id}
                    onPress={() => handleSelectPricing(model.id)}
                    style={[
                      styles.pricingCard,
                      {
                        backgroundColor:
                          pricingModel === model.id
                            ? Colors.accent + "15"
                            : theme.backgroundElevated,
                        borderColor:
                          pricingModel === model.id ? Colors.accent : "transparent",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.pricingIcon,
                        {
                          backgroundColor:
                            pricingModel === model.id
                              ? Colors.accent
                              : theme.cardBackground,
                        },
                      ]}
                    >
                      <Feather
                        name={model.icon as any}
                        size={18}
                        color={pricingModel === model.id ? "#fff" : theme.textSecondary}
                      />
                    </View>
                    <View style={styles.pricingInfo}>
                      <ThemedText type="body" style={styles.pricingName}>
                        {model.name}
                      </ThemedText>
                      <ThemedText
                        type="caption"
                        style={{ color: theme.textSecondary }}
                        numberOfLines={2}
                      >
                        {model.description}
                      </ThemedText>
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        {
                          borderColor:
                            pricingModel === model.id ? Colors.accent : theme.borderLight,
                        },
                      ]}
                    >
                      {pricingModel === model.id ? (
                        <View style={[styles.radioInner, { backgroundColor: Colors.accent }]} />
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>

              {pricingModel !== "quote" ? (
                <View style={styles.priceInputRow}>
                  <View style={styles.dollarIcon}>
                    <ThemedText style={{ color: theme.textSecondary, fontWeight: "600" }}>
                      $
                    </ThemedText>
                  </View>
                  <TextInput
                    style={[
                      styles.priceInput,
                      {
                        backgroundColor: theme.backgroundElevated,
                        color: theme.text,
                        borderColor: theme.borderLight,
                      },
                    ]}
                    placeholder="0.00"
                    placeholderTextColor={theme.textSecondary}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
              ) : null}
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(300)}>
            <GlassCard style={styles.section}>
              <ThemedText style={styles.sectionTitle}>BILLING FREQUENCY</ThemedText>
              
              <View style={styles.billingRow}>
                {BILLING_OPTIONS.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSelectBilling(option.id)}
                    style={[
                      styles.billingOption,
                      {
                        backgroundColor:
                          billingFrequency === option.id
                            ? Colors.accent
                            : theme.backgroundElevated,
                        borderColor:
                          billingFrequency === option.id
                            ? Colors.accent
                            : theme.borderLight,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.billingText,
                        { color: billingFrequency === option.id ? "#fff" : theme.text },
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.durationRow}>
                <View style={styles.durationLabel}>
                  <Feather name="clock" size={18} color={theme.textSecondary} />
                  <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                    Duration
                  </ThemedText>
                </View>
                <ThemedText type="body" style={{ color: Colors.accent, fontWeight: "600" }}>
                  {duration} mins
                </ThemedText>
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(300)}>
            <GlassCard style={styles.section}>
              <ThemedText style={styles.sectionTitle}>DISCOUNTS & OFFERS</ThemedText>
              
              <View style={styles.discountRow}>
                <View style={styles.discountIcon}>
                  <Feather name="tag" size={16} color={theme.textSecondary} />
                </View>
                <TextInput
                  style={[
                    styles.discountNameInput,
                    {
                      backgroundColor: theme.backgroundElevated,
                      color: theme.text,
                    },
                  ]}
                  placeholder="Name (e.g. Senior)"
                  placeholderTextColor={theme.textSecondary}
                  value={discountName}
                  onChangeText={setDiscountName}
                />
                <TextInput
                  style={[
                    styles.discountPercentInput,
                    {
                      backgroundColor: theme.backgroundElevated,
                      color: theme.text,
                    },
                  ]}
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                  value={discountPercent}
                  onChangeText={setDiscountPercent}
                  keyboardType="number-pad"
                />
                <ThemedText style={{ color: theme.textSecondary, marginRight: Spacing.sm }}>
                  %
                </ThemedText>
                <Pressable
                  style={[styles.addDiscountBtn, { backgroundColor: theme.backgroundElevated }]}
                >
                  <Feather name="plus" size={18} color={theme.textSecondary} />
                </Pressable>
              </View>
              
              <ThemedText
                type="caption"
                style={[styles.noDiscounts, { color: theme.textSecondary }]}
              >
                No discounts active for this service.
              </ThemedText>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).duration(300)}>
            <GlassCard style={styles.section}>
              <ThemedText style={styles.sectionTitle}>BOOKING RULES</ThemedText>
              
              <View style={styles.toggleRow}>
                <View>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    Instant Booking
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Allow clients to book without approval
                  </ThemedText>
                </View>
                <Switch
                  value={instantBooking}
                  onValueChange={setInstantBooking}
                  trackColor={{ false: theme.borderLight, true: Colors.accent }}
                  thumbColor="#fff"
                  ios_backgroundColor={theme.borderLight}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.intakeHeader}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  Intake Questions
                </ThemedText>
                <Pressable onPress={() => {}}>
                  <ThemedText style={{ color: Colors.accent, fontWeight: "500" }}>
                    + Add
                  </ThemedText>
                </Pressable>
              </View>

              {intakeQuestions.map((q) => (
                <View
                  key={q.id}
                  style={[styles.questionChip, { backgroundColor: theme.backgroundElevated }]}
                >
                  <ThemedText type="caption" style={{ flex: 1 }}>
                    {q.question}
                  </ThemedText>
                  <Pressable onPress={() => handleRemoveQuestion(q.id)}>
                    <Feather name="x" size={16} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ))}

              <View style={styles.divider} />

              <View style={styles.toggleRow}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  Require Photos
                </ThemedText>
                <Switch
                  value={requirePhotos}
                  onValueChange={setRequirePhotos}
                  trackColor={{ false: theme.borderLight, true: Colors.accent }}
                  thumbColor="#fff"
                  ios_backgroundColor={theme.borderLight}
                />
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(300)}>
            <View style={styles.actionsContainer}>
              <PrimaryButton onPress={handleSave} disabled={!isValid || isSaving}>
                {isSaving ? "Saving..." : "Save Service"}
              </PrimaryButton>
              
              <Pressable
                style={[styles.previewButton, { borderColor: theme.borderLight }]}
                onPress={handlePreview}
              >
                <Feather name="eye" size={18} color={theme.text} />
                <ThemedText style={{ marginLeft: Spacing.sm }}>
                  Preview as Homeowner
                </ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.screenPadding,
    gap: Spacing.md,
  },
  section: {
    padding: Spacing.md,
  },
  sectionTitle: {
    ...Typography.caption1,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    opacity: 0.7,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    marginBottom: Spacing.xs,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  textInput: {
    ...Typography.body,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 80,
    paddingTop: Spacing.md,
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  aiButtonText: {
    ...Typography.caption2,
    fontWeight: "500",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  categoryOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  categoryOptionText: {
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
    borderWidth: 1,
  },
  pricingIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  pricingInfo: {
    flex: 1,
  },
  pricingName: {
    fontWeight: "600",
    marginBottom: 2,
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
  priceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  dollarIcon: {
    marginRight: Spacing.sm,
  },
  priceInput: {
    ...Typography.title2,
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontWeight: "600",
  },
  billingRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  billingOption: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  billingText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  durationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
  },
  durationLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  discountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  discountIcon: {
    padding: Spacing.sm,
  },
  discountNameInput: {
    flex: 2,
    ...Typography.body,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  discountPercentInput: {
    width: 50,
    ...Typography.body,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    textAlign: "center",
  },
  addDiscountBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  noDiscounts: {
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: Spacing.sm,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(128,128,128,0.2)",
    marginVertical: Spacing.md,
  },
  intakeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  questionChip: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  actionsContainer: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});
