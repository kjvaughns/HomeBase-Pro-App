import React, { useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Avatar } from "@/components/Avatar";
import { StatusPill } from "@/components/StatusPill";
import { AccountGateModal } from "@/components/AccountGateModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "question" | "answer" | "analysis";
}

interface ServiceAnalysis {
  category: string;
  confidence: number;
  summary: string;
  severity: "low" | "medium" | "high" | "emergency";
  questions: string[];
  estimatedPriceRange: { min: number; max: number };
}

interface RefinedAnalysis {
  refinedSummary: string;
  severity: string;
  priceRange: { min: number; max: number };
  confidence: number;
  scopeOfWork: string[];
  scopeExclusions: string[];
  recommendedUrgency: string;
}

interface MatchedProvider {
  id: string;
  businessName: string;
  rating: number;
  reviewCount: number;
  distance?: number;
  trustScore: number;
  verified?: boolean;
  hourlyRate?: number;
}

type IntakeStep = "describe" | "clarify" | "summary" | "providers";

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  plumbing: "droplet",
  electrical: "zap",
  hvac: "wind",
  cleaning: "home",
  landscaping: "sun",
  painting: "edit-3",
  roofing: "umbrella",
  handyman: "tool",
};

const CATEGORY_NAMES: Record<string, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "HVAC",
  cleaning: "Cleaning",
  landscaping: "Landscaping",
  painting: "Painting",
  roofing: "Roofing",
  handyman: "Handyman",
};

export default function SmartIntakeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { isAuthenticated } = useAuthStore();

  const [step, setStep] = useState<IntakeStep>("describe");
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ServiceAnalysis | null>(null);
  const [refinedAnalysis, setRefinedAnalysis] = useState<RefinedAnalysis | null>(null);
  const [providers, setProviders] = useState<MatchedProvider[]>([]);
  const [answers, setAnswers] = useState<{ question: string; answer: string }[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showAccountGate, setShowAccountGate] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const analyzeProble = useCallback(async (problem: string) => {
    if (!problem.trim()) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await fetch(new URL("/api/intake/analyze", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem }),
      });

      if (!response.ok) throw new Error("Failed to analyze");

      const data = await response.json();
      setAnalysis(data.analysis);
      setStep("clarify");
      setCurrentQuestionIndex(0);
      setAnswers([]);
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDescribeSubmit = () => {
    if (inputText.trim()) {
      analyzeProble(inputText);
    }
  };

  const handleAnswerSubmit = async () => {
    if (!inputText.trim() || !analysis) return;

    const currentQuestion = analysis.questions[currentQuestionIndex];
    const newAnswers = [...answers, { question: currentQuestion, answer: inputText }];
    setAnswers(newAnswers);
    setInputText("");

    if (currentQuestionIndex < analysis.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      setIsLoading(true);
      try {
        const response = await fetch(new URL("/api/intake/refine", getApiUrl()).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalAnalysis: {
              category: analysis.category,
              summary: analysis.summary,
              severity: analysis.severity,
            },
            answers: newAnswers,
          }),
        });

        if (!response.ok) throw new Error("Failed to refine");

        const data = await response.json();
        setRefinedAnalysis(data.refinedAnalysis);
        setStep("summary");
      } catch (error) {
        console.error("Refine error:", error);
        setStep("summary");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleFindProviders = async () => {
    if (!analysis) return;

    setIsLoading(true);
    try {
      const response = await fetch(new URL("/api/intake/match-providers", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: analysis.category }),
      });

      if (!response.ok) throw new Error("Failed to match providers");

      const data = await response.json();
      setProviders(data.providers || []);
      setStep("providers");
    } catch (error) {
      console.error("Match providers error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProvider = (providerId: string) => {
    if (!isAuthenticated) {
      setShowAccountGate(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ProviderProfile", { providerId });
  };

  const handleSignIn = () => {
    setShowAccountGate(false);
    navigation.navigate("Login");
  };

  const handleSignUp = () => {
    setShowAccountGate(false);
    navigation.navigate("SignUp");
  };

  const getSeverityStatus = (severity: string) => {
    switch (severity) {
      case "emergency": return "cancelled";
      case "high": return "warning";
      case "medium": return "info";
      default: return "success";
    }
  };

  const renderDescribeStep = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.stepContainer}>
      <View style={styles.headerSection}>
        <View style={[styles.iconContainer, { backgroundColor: Colors.accentLight }]}>
          <Feather name="message-circle" size={32} color={Colors.accent} />
        </View>
        <ThemedText style={styles.stepTitle}>Describe Your Problem</ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Tell us what's going on in your own words. Our AI will understand and find the right help.
        </ThemedText>
      </View>

      <View style={styles.examplesSection}>
        <ThemedText style={[styles.examplesLabel, { color: theme.textSecondary }]}>Try saying:</ThemedText>
        {["My sink is leaking under the cabinet", "AC is making a loud noise and not cooling", "Need lawn mowing and hedge trimming"].map((example, index) => (
          <Pressable
            key={index}
            style={[styles.exampleChip, { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight }]}
            onPress={() => setInputText(example)}
          >
            <ThemedText style={[styles.exampleText, { color: theme.textSecondary }]}>{example}</ThemedText>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );

  const renderClarifyStep = () => {
    if (!analysis) return null;
    const currentQuestion = analysis.questions[currentQuestionIndex];

    return (
      <Animated.View entering={FadeInDown.duration(400)} style={styles.stepContainer}>
        <GlassCard style={styles.analysisCard}>
          <View style={styles.analysisHeader}>
            <View style={[styles.categoryIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name={CATEGORY_ICONS[analysis.category] || "tool"} size={20} color={Colors.accent} />
            </View>
            <View style={styles.analysisInfo}>
              <ThemedText style={styles.categoryLabel}>{CATEGORY_NAMES[analysis.category] || "Service"}</ThemedText>
              <ThemedText style={[styles.analysisSummary, { color: theme.textSecondary }]} numberOfLines={2}>
                {analysis.summary}
              </ThemedText>
            </View>
          </View>
          <View style={styles.analysisStats}>
            <StatusPill label={analysis.severity} status={getSeverityStatus(analysis.severity)} />
            <ThemedText style={[styles.priceRange, { color: theme.textSecondary }]}>
              Est. ${analysis.estimatedPriceRange.min} - ${analysis.estimatedPriceRange.max}
            </ThemedText>
          </View>
        </GlassCard>

        <View style={styles.questionSection}>
          <ThemedText style={[styles.questionLabel, { color: theme.textSecondary }]}>
            Question {currentQuestionIndex + 1} of {analysis.questions.length}
          </ThemedText>
          <ThemedText style={styles.questionText}>{currentQuestion}</ThemedText>
        </View>

        {answers.length > 0 ? (
          <View style={styles.answersPreview}>
            {answers.map((a, i) => (
              <View key={i} style={[styles.answerRow, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={[styles.answerQ, { color: theme.textSecondary }]}>{a.question}</ThemedText>
                <ThemedText style={styles.answerA}>{a.answer}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </Animated.View>
    );
  };

  const renderSummaryStep = () => {
    if (!analysis) return null;
    const priceRange = refinedAnalysis?.priceRange || analysis.estimatedPriceRange;
    const summary = refinedAnalysis?.refinedSummary || analysis.summary;

    return (
      <Animated.View entering={FadeInDown.duration(400)} style={styles.stepContainer}>
        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={[styles.categoryIconLarge, { backgroundColor: Colors.accentLight }]}>
              <Feather name={CATEGORY_ICONS[analysis.category] || "tool"} size={28} color={Colors.accent} />
            </View>
            <ThemedText style={styles.summaryTitle}>Service Summary</ThemedText>
          </View>

          <View style={styles.summarySection}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Issue</ThemedText>
            <ThemedText style={styles.summaryValue}>{summary}</ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Category</ThemedText>
              <ThemedText style={styles.summaryValue}>{CATEGORY_NAMES[analysis.category]}</ThemedText>
            </View>
            <View style={styles.summaryCol}>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Severity</ThemedText>
              <StatusPill label={refinedAnalysis?.severity || analysis.severity} status={getSeverityStatus(refinedAnalysis?.severity || analysis.severity)} />
            </View>
          </View>

          <View style={styles.priceSection}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Estimated Cost</ThemedText>
            <ThemedText style={styles.priceText}>${priceRange.min} - ${priceRange.max}</ThemedText>
            {refinedAnalysis?.confidence ? (
              <ThemedText style={[styles.confidenceText, { color: theme.textSecondary }]}>
                {refinedAnalysis.confidence}% confidence
              </ThemedText>
            ) : null}
          </View>

          {refinedAnalysis?.scopeOfWork && refinedAnalysis.scopeOfWork.length > 0 ? (
            <View style={styles.scopeSection}>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>What's Included</ThemedText>
              {refinedAnalysis.scopeOfWork.map((item, i) => (
                <View key={i} style={styles.scopeRow}>
                  <Feather name="check" size={14} color={Colors.accent} />
                  <ThemedText style={styles.scopeText}>{item}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </GlassCard>

        <PrimaryButton onPress={handleFindProviders} disabled={isLoading}>
          {isLoading ? "Finding Providers..." : "Find Trusted Providers"}
        </PrimaryButton>
      </Animated.View>
    );
  };

  const renderProvidersStep = () => (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.stepContainer}>
      <ThemedText style={styles.providersTitle}>Top Matched Providers</ThemedText>
      <ThemedText style={[styles.providersSubtitle, { color: theme.textSecondary }]}>
        Based on your needs, here are the best available pros
      </ThemedText>

      {providers.map((provider, index) => (
        <Animated.View key={provider.id} entering={FadeInUp.delay(index * 100).duration(300)}>
          <Pressable
            style={[styles.providerCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}
            onPress={() => handleSelectProvider(provider.id)}
          >
            <Avatar name={provider.businessName} size="medium" />
            <View style={styles.providerInfo}>
              <View style={styles.providerNameRow}>
                <ThemedText style={styles.providerName}>{provider.businessName}</ThemedText>
                {provider.verified ? (
                  <Feather name="check-circle" size={14} color={Colors.accent} />
                ) : null}
              </View>
              <View style={styles.providerStats}>
                <View style={styles.ratingRow}>
                  <Feather name="star" size={12} color={Colors.accent} />
                  <ThemedText style={styles.ratingText}>
                    {typeof provider.rating === 'string' ? provider.rating : provider.rating?.toFixed(1)} ({provider.reviewCount})
                  </ThemedText>
                </View>
                <ThemedText style={[styles.trustScore, { color: Colors.accent }]}>
                  Trust: {provider.trustScore}
                </ThemedText>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>
      ))}

      {providers.length === 0 ? (
        <View style={styles.noProvidersContainer}>
          <Feather name="users" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.noProvidersText, { color: theme.textSecondary }]}>
            No providers available for this category in your area
          </ThemedText>
        </View>
      ) : null}
    </Animated.View>
  );

  const getInputPlaceholder = () => {
    switch (step) {
      case "describe":
        return "Describe your home issue...";
      case "clarify":
        return "Type your answer...";
      default:
        return "";
    }
  };

  const handleSubmit = () => {
    if (step === "describe") {
      handleDescribeSubmit();
    } else if (step === "clarify") {
      handleAnswerSubmit();
    }
  };

  const showInput = step === "describe" || step === "clarify";

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior="padding" keyboardVerticalOffset={0}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerHeight + Spacing.md, paddingBottom: Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {step === "describe" ? renderDescribeStep() : null}
          {step === "clarify" ? renderClarifyStep() : null}
          {step === "summary" ? renderSummaryStep() : null}
          {step === "providers" ? renderProvidersStep() : null}
        </ScrollView>

        {showInput ? (
          <View style={[styles.inputContainer, { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.sm }]}>
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight }]}>
              <TextInput
                ref={inputRef}
                style={[styles.textInput, { color: theme.text }]}
                value={inputText}
                onChangeText={setInputText}
                placeholder={getInputPlaceholder()}
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={500}
                onSubmitEditing={handleSubmit}
                blurOnSubmit={false}
              />
              <Pressable
                style={[
                  styles.sendButton,
                  { backgroundColor: inputText.trim() ? Colors.accent : theme.borderLight },
                ]}
                onPress={handleSubmit}
                disabled={!inputText.trim() || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="arrow-up" size={18} color="#fff" />
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <AccountGateModal
        visible={showAccountGate}
        onClose={() => setShowAccountGate(false)}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
  },
  stepContainer: {
    flex: 1,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  stepTitle: {
    ...Typography.title2,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    ...Typography.subhead,
    textAlign: "center",
  },
  examplesSection: {
    marginTop: Spacing.lg,
  },
  examplesLabel: {
    ...Typography.caption1,
    marginBottom: Spacing.sm,
  },
  exampleChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  exampleText: {
    ...Typography.subhead,
  },
  analysisCard: {
    marginBottom: Spacing.lg,
  },
  analysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  analysisInfo: {
    flex: 1,
  },
  categoryLabel: {
    ...Typography.headline,
  },
  analysisSummary: {
    ...Typography.subhead,
    marginTop: 2,
  },
  analysisStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  priceRange: {
    ...Typography.subhead,
  },
  questionSection: {
    marginBottom: Spacing.lg,
  },
  questionLabel: {
    ...Typography.caption1,
    marginBottom: Spacing.xs,
  },
  questionText: {
    ...Typography.title3,
  },
  answersPreview: {
    marginTop: Spacing.md,
  },
  answerRow: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  answerQ: {
    ...Typography.caption1,
    marginBottom: 2,
  },
  answerA: {
    ...Typography.subhead,
  },
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  categoryIconLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  summaryTitle: {
    ...Typography.title3,
  },
  summarySection: {
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  summaryCol: {
    flex: 1,
  },
  summaryLabel: {
    ...Typography.caption2,
    marginBottom: Spacing.xxs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    ...Typography.subhead,
  },
  priceSection: {
    backgroundColor: Colors.accentLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  priceText: {
    ...Typography.title1,
    color: Colors.accent,
  },
  confidenceText: {
    ...Typography.caption1,
    marginTop: Spacing.xxs,
  },
  scopeSection: {
    marginTop: Spacing.sm,
  },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  scopeText: {
    ...Typography.subhead,
    marginLeft: Spacing.xs,
  },
  providersTitle: {
    ...Typography.title2,
    marginBottom: Spacing.xs,
  },
  providersSubtitle: {
    ...Typography.subhead,
    marginBottom: Spacing.lg,
  },
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  providerInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  providerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  providerName: {
    ...Typography.headline,
  },
  providerStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xxs,
    gap: Spacing.md,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xxs,
  },
  ratingText: {
    ...Typography.subhead,
  },
  trustScore: {
    ...Typography.caption1,
  },
  noProvidersContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  noProvidersText: {
    ...Typography.subhead,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  inputContainer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  textInput: {
    flex: 1,
    ...Typography.body,
    maxHeight: 100,
    paddingVertical: Spacing.xs,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: Spacing.xs,
  },
});
