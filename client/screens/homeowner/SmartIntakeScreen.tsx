import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
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
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, "SmartIntake">;

interface IntakeQuestion {
  id: string;
  text: string;
  type: "single_choice" | "multiple_choice" | "text" | "number" | "yes_no";
  options?: string[];
  placeholder?: string;
  required: boolean;
}

interface ServiceAnalysis {
  category: string;
  confidence: number;
  summary: string;
  severity: "low" | "medium" | "high" | "emergency";
  questions: IntakeQuestion[];
  estimatedPriceRange: { min: number; max: number };
}

interface ServiceOption {
  name: string;
  description: string;
  priceRange: { min: number; max: number };
  includes: string[];
  recommended?: boolean;
}

interface RefinedAnalysis {
  refinedSummary: string;
  severity: string;
  recommendedUrgency: string;
  scopeOfWork: string[];
  scopeExclusions: string[];
  serviceOptions: ServiceOption[];
  materialEstimate?: { materials: string; labor: string };
  timeEstimate?: string;
  confidence: number;
}

interface MatchedProvider {
  id: string;
  businessName: string;
  rating: number;
  reviewCount: number;
  trustScore: number;
  isVerified?: boolean;
  yearsExperience?: number;
  capabilityTags?: string[];
}

type IntakeStep = "describe" | "questions" | "options" | "providers";

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
  const route = useRoute<ScreenRouteProp>();
  const { theme } = useTheme();
  const { isAuthenticated } = useAuthStore();
  
  const prefillCategory = route.params?.prefillCategory;
  const prefillProblem = route.params?.prefillProblem;
  const preselectedProviderId = route.params?.preselectedProviderId;
  const preselectedProviderName = route.params?.preselectedProviderName;

  const [step, setStep] = useState<IntakeStep>("describe");
  const [problemText, setProblemText] = useState(prefillProblem || "");
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ServiceAnalysis | null>(null);
  const [refinedAnalysis, setRefinedAnalysis] = useState<RefinedAnalysis | null>(null);
  const [providers, setProviders] = useState<MatchedProvider[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [selectedOption, setSelectedOption] = useState<ServiceOption | null>(null);
  const [showAccountGate, setShowAccountGate] = useState(false);
  const [hasAutoAnalyzed, setHasAutoAnalyzed] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const analyzeProblem = useCallback(async (problem: string) => {
    if (!problem.trim()) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await apiRequest("POST", "/api/intake/analyze", { problem });
      const data = await response.json();
      setAnalysis(data.analysis);
      setStep("questions");
      setAnswers({});
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if (prefillProblem && !hasAutoAnalyzed) {
      setHasAutoAnalyzed(true);
      analyzeProblem(prefillProblem);
    }
  }, [prefillProblem, hasAutoAnalyzed, analyzeProblem]);

  const handleDescribeSubmit = () => {
    if (problemText.trim()) {
      analyzeProblem(problemText);
    }
  };

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleToggleMultiChoice = (questionId: string, option: string) => {
    const current = (answers[questionId] as string[]) || [];
    if (current.includes(option)) {
      handleAnswerChange(questionId, current.filter(o => o !== option));
    } else {
      handleAnswerChange(questionId, [...current, option]);
    }
  };

  const allQuestionsAnswered = () => {
    if (!analysis) return false;
    return analysis.questions.every(q => {
      if (!q.required) return true;
      const answer = answers[q.id];
      if (Array.isArray(answer)) return answer.length > 0;
      return answer && answer.trim().length > 0;
    });
  };

  const handleSubmitAnswers = async () => {
    if (!analysis || !allQuestionsAnswered()) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formattedAnswers = analysis.questions.map(q => ({
        question: q.text,
        answer: Array.isArray(answers[q.id]) 
          ? (answers[q.id] as string[]).join(", ") 
          : (answers[q.id] as string) || "",
      }));

      const response = await apiRequest("POST", "/api/intake/refine", {
        originalAnalysis: {
          category: analysis.category,
          summary: analysis.summary,
          severity: analysis.severity,
        },
        answers: formattedAnswers,
      });
      const data = await response.json();
      setRefinedAnalysis(data.refinedAnalysis);
      setStep("options");
    } catch (error) {
      console.error("Refine error:", error);
      setStep("options");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOption = (option: ServiceOption) => {
    setSelectedOption(option);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleFindProviders = async () => {
    if (!analysis) return;

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/intake/match-providers", { category: analysis.category });
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
    
    const urgencyMap: Record<string, "flexible" | "soon" | "urgent" | "emergency"> = {
      low: "flexible",
      medium: "soon",
      high: "urgent",
      emergency: "emergency",
    };
    
    const intakeData = {
      problemDescription: problemText,
      issueSummary: refinedAnalysis?.refinedSummary || analysis?.summary || problemText,
      recommendedService: selectedOption?.name || refinedAnalysis?.serviceOptions?.[0]?.name || "General Service",
      priceRange: selectedOption?.priceRange || analysis?.estimatedPriceRange || { min: 100, max: 300 },
      urgency: urgencyMap[refinedAnalysis?.severity || analysis?.severity || "medium"] || "flexible" as const,
      category: analysis?.category || prefillCategory || "general",
    };
    
    navigation.navigate("ProviderProfile", { providerId, intakeData });
  };

  const handleSignIn = () => {
    setShowAccountGate(false);
    navigation.navigate("Login");
  };

  const handleSignUp = () => {
    setShowAccountGate(false);
    navigation.navigate("SignUp");
  };

  // Handle booking with preselected provider
  const handleBookWithPreselectedProvider = () => {
    if (!isAuthenticated) {
      setShowAccountGate(true);
      return;
    }
    if (!preselectedProviderId || !preselectedProviderName) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const urgencyMap: Record<string, "flexible" | "soon" | "urgent" | "emergency"> = {
      low: "flexible",
      medium: "soon",
      high: "urgent",
      emergency: "emergency",
    };
    
    const intakeData = {
      problemDescription: problemText,
      issueSummary: refinedAnalysis?.refinedSummary || analysis?.summary || problemText,
      recommendedService: selectedOption?.name || refinedAnalysis?.serviceOptions?.[0]?.name || "General Service",
      priceRange: selectedOption?.priceRange || analysis?.estimatedPriceRange || { min: 100, max: 300 },
      urgency: urgencyMap[refinedAnalysis?.severity || analysis?.severity || "medium"] || "flexible" as const,
      category: analysis?.category || prefillCategory || "general",
    };
    
    navigation.navigate("SimpleBooking", {
      providerId: preselectedProviderId,
      providerName: preselectedProviderName,
      intakeData,
    });
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
        <ThemedText style={styles.stepTitle}>What's the issue?</ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Describe your problem and we'll ask a few quick questions to get you accurate quotes.
        </ThemedText>
      </View>

      <View style={[styles.inputBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight }]}>
        <TextInput
          ref={inputRef}
          style={[styles.problemInput, { color: theme.text }]}
          value={problemText}
          onChangeText={setProblemText}
          placeholder="e.g., My kitchen sink is leaking under the cabinet..."
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.examplesSection}>
        <ThemedText style={[styles.examplesLabel, { color: theme.textSecondary }]}>Try these:</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.examplesScroll}>
          {["Leaking faucet", "AC not cooling", "Outlet sparking", "Lawn needs mowing"].map((example, index) => (
            <Pressable
              key={index}
              style={[styles.exampleChip, { backgroundColor: Colors.accentLight }]}
              onPress={() => setProblemText(example)}
            >
              <ThemedText style={[styles.exampleText, { color: Colors.accent }]}>{example}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <PrimaryButton 
        onPress={handleDescribeSubmit} 
        disabled={!problemText.trim() || isLoading}
        style={styles.submitButton}
      >
        {isLoading ? "Analyzing..." : "Continue"}
      </PrimaryButton>
    </Animated.View>
  );

  const renderQuestionInput = (question: IntakeQuestion) => {
    const answer = answers[question.id];

    switch (question.type) {
      case "single_choice":
        return (
          <View style={styles.optionsGrid}>
            {question.options?.map((option, i) => (
              <Pressable
                key={i}
                style={[
                  styles.choiceOption,
                  { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight },
                  answer === option && { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
                ]}
                onPress={() => handleAnswerChange(question.id, option)}
              >
                <ThemedText style={[
                  styles.choiceText,
                  answer === option && { color: Colors.accent, fontWeight: "600" },
                ]}>
                  {option}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        );

      case "multiple_choice":
        const selected = (answer as string[]) || [];
        return (
          <View style={styles.optionsGrid}>
            {question.options?.map((option, i) => (
              <Pressable
                key={i}
                style={[
                  styles.choiceOption,
                  { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight },
                  selected.includes(option) && { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
                ]}
                onPress={() => handleToggleMultiChoice(question.id, option)}
              >
                <View style={styles.checkboxRow}>
                  <View style={[
                    styles.checkbox,
                    { borderColor: selected.includes(option) ? Colors.accent : theme.borderLight },
                    selected.includes(option) && { backgroundColor: Colors.accent },
                  ]}>
                    {selected.includes(option) ? (
                      <Feather name="check" size={12} color="#fff" />
                    ) : null}
                  </View>
                  <ThemedText style={[
                    styles.choiceText,
                    selected.includes(option) && { color: Colors.accent },
                  ]}>
                    {option}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </View>
        );

      case "yes_no":
        return (
          <View style={styles.yesNoRow}>
            {["Yes", "No"].map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.yesNoButton,
                  { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight },
                  answer === option && { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
                ]}
                onPress={() => handleAnswerChange(question.id, option)}
              >
                <Feather 
                  name={option === "Yes" ? "check-circle" : "x-circle"} 
                  size={20} 
                  color={answer === option ? Colors.accent : theme.textSecondary} 
                />
                <ThemedText style={[
                  styles.yesNoText,
                  answer === option && { color: Colors.accent, fontWeight: "600" },
                ]}>
                  {option}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        );

      case "number":
        return (
          <TextInput
            style={[styles.textInputField, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.borderLight }]}
            value={(answer as string) || ""}
            onChangeText={(val) => handleAnswerChange(question.id, val)}
            placeholder={question.placeholder || "Enter a number"}
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
          />
        );

      case "text":
      default:
        return (
          <TextInput
            style={[styles.textInputField, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.borderLight }]}
            value={(answer as string) || ""}
            onChangeText={(val) => handleAnswerChange(question.id, val)}
            placeholder={question.placeholder || "Type your answer..."}
            placeholderTextColor={theme.textSecondary}
            multiline
          />
        );
    }
  };

  const renderQuestionsStep = () => {
    if (!analysis) return null;

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
        </GlassCard>

        <ThemedText style={styles.questionsTitle}>Help us understand better</ThemedText>
        <ThemedText style={[styles.questionsSubtitle, { color: theme.textSecondary }]}>
          Answer these questions to get accurate quotes
        </ThemedText>

        {analysis.questions.map((question, index) => (
          <Animated.View 
            key={question.id} 
            entering={FadeInDown.delay(index * 100).duration(300)}
            style={styles.questionCard}
          >
            <View style={styles.questionHeader}>
              <ThemedText style={[styles.questionNumber, { color: Colors.accent }]}>
                {index + 1}
              </ThemedText>
              <ThemedText style={styles.questionText}>{question.text}</ThemedText>
            </View>
            {renderQuestionInput(question)}
          </Animated.View>
        ))}

        <PrimaryButton 
          onPress={handleSubmitAnswers} 
          disabled={!allQuestionsAnswered() || isLoading}
          style={styles.submitButton}
        >
          {isLoading ? "Getting Your Quote..." : "Get My Quote"}
        </PrimaryButton>
      </Animated.View>
    );
  };

  const renderOptionsStep = () => {
    if (!analysis) return null;
    const options = refinedAnalysis?.serviceOptions || [];
    const summary = refinedAnalysis?.refinedSummary || analysis.summary;

    return (
      <Animated.View entering={FadeInDown.duration(400)} style={styles.stepContainer}>
        <ThemedText style={styles.optionsTitle}>Your Service Quote</ThemedText>
        
        <GlassCard style={styles.summaryCard}>
          <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Issue Summary</ThemedText>
          <ThemedText style={styles.summaryText}>{summary}</ThemedText>
          
          <View style={styles.summaryMeta}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                {refinedAnalysis?.timeEstimate || "2-4 hours"}
              </ThemedText>
            </View>
            <StatusPill 
              label={refinedAnalysis?.recommendedUrgency || analysis.severity} 
              status={getSeverityStatus(refinedAnalysis?.severity || analysis.severity)} 
            />
          </View>

          {refinedAnalysis?.scopeOfWork && refinedAnalysis.scopeOfWork.length > 0 ? (
            <View style={styles.scopeSection}>
              <ThemedText style={[styles.scopeLabel, { color: theme.textSecondary }]}>What's Included</ThemedText>
              {refinedAnalysis.scopeOfWork.slice(0, 4).map((item, i) => (
                <View key={i} style={styles.scopeRow}>
                  <Feather name="check" size={12} color={Colors.accent} />
                  <ThemedText style={styles.scopeText}>{item}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </GlassCard>

        {options.length > 0 ? (
          <>
            <ThemedText style={styles.packagesTitle}>Choose Your Service Level</ThemedText>
            {options.map((option, index) => (
              <Animated.View key={index} entering={FadeInUp.delay(index * 100).duration(300)}>
                <Pressable
                  style={[
                    styles.optionCard,
                    { backgroundColor: theme.cardBackground, borderColor: theme.borderLight },
                    selectedOption?.name === option.name && { borderColor: Colors.accent, borderWidth: 2 },
                    option.recommended && { borderColor: Colors.accent },
                  ]}
                  onPress={() => handleSelectOption(option)}
                >
                  {option.recommended ? (
                    <View style={[styles.recommendedBadge, { backgroundColor: Colors.accent }]}>
                      <ThemedText style={styles.recommendedText}>Recommended</ThemedText>
                    </View>
                  ) : null}
                  <View style={styles.optionHeader}>
                    <ThemedText style={styles.optionName}>{option.name}</ThemedText>
                    <ThemedText style={styles.optionPrice}>
                      ${option.priceRange.min} - ${option.priceRange.max}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.optionDescription, { color: theme.textSecondary }]}>
                    {option.description}
                  </ThemedText>
                  <View style={styles.optionIncludes}>
                    {option.includes.slice(0, 3).map((item, i) => (
                      <View key={i} style={styles.includeRow}>
                        <Feather name="check-circle" size={12} color={Colors.accent} />
                        <ThemedText style={styles.includeText}>{item}</ThemedText>
                      </View>
                    ))}
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </>
        ) : null}

        <PrimaryButton 
          onPress={handleFindProviders} 
          disabled={isLoading}
          style={styles.submitButton}
        >
          {isLoading ? "Finding Providers..." : "Find Available Pros"}
        </PrimaryButton>
      </Animated.View>
    );
  };

  const renderProvidersStep = () => {
    // If there's a preselected provider, show simplified booking UI
    if (preselectedProviderId && preselectedProviderName) {
      return (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.stepContainer}>
          <View style={[styles.iconContainer, { backgroundColor: Colors.accentLight, marginBottom: Spacing.lg }]}>
            <Feather name="check-circle" size={32} color={Colors.accent} />
          </View>
          
          <ThemedText style={styles.providersTitle}>Ready to Book</ThemedText>
          <ThemedText style={[styles.providersSubtitle, { color: theme.textSecondary }]}>
            Your service request details are ready
          </ThemedText>

          {selectedOption ? (
            <View style={[styles.selectedOptionBanner, { backgroundColor: Colors.accentLight, marginTop: Spacing.lg }]}>
              <Feather name="check-circle" size={16} color={Colors.accent} />
              <ThemedText style={[styles.selectedOptionText, { color: Colors.accent }]}>
                {selectedOption.name}: ${selectedOption.priceRange.min} - ${selectedOption.priceRange.max}
              </ThemedText>
            </View>
          ) : null}

          <GlassCard style={styles.preselectedProviderCard}>
            <ThemedText style={[styles.bookingWithLabel, { color: theme.textSecondary }]}>
              Booking with
            </ThemedText>
            <ThemedText style={styles.preselectedProviderName}>{preselectedProviderName}</ThemedText>
          </GlassCard>

          <PrimaryButton
            onPress={handleBookWithPreselectedProvider}
            style={{ marginTop: Spacing.xl }}
          >
            Continue to Booking
          </PrimaryButton>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeInDown.duration(400)} style={styles.stepContainer}>
        <ThemedText style={styles.providersTitle}>Top Matched Providers</ThemedText>
        <ThemedText style={[styles.providersSubtitle, { color: theme.textSecondary }]}>
          Ready to take on your job
        </ThemedText>

        {selectedOption ? (
          <View style={[styles.selectedOptionBanner, { backgroundColor: Colors.accentLight }]}>
            <Feather name="check-circle" size={16} color={Colors.accent} />
            <ThemedText style={[styles.selectedOptionText, { color: Colors.accent }]}>
              {selectedOption.name}: ${selectedOption.priceRange.min} - ${selectedOption.priceRange.max}
            </ThemedText>
          </View>
        ) : null}

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
                  {provider.isVerified ? (
                    <Feather name="check-circle" size={14} color={Colors.accent} />
                  ) : null}
                </View>
                <View style={styles.providerStats}>
                  <View style={styles.ratingRow}>
                    <Feather name="star" size={12} color={Colors.accent} />
                    <ThemedText style={styles.ratingText}>
                      {typeof provider.rating === "string" ? provider.rating : provider.rating?.toFixed(1)} ({provider.reviewCount})
                    </ThemedText>
                  </View>
                  {provider.yearsExperience ? (
                    <ThemedText style={[styles.experienceText, { color: theme.textSecondary }]}>
                      {provider.yearsExperience} yrs
                    </ThemedText>
                  ) : null}
                </View>
                {provider.capabilityTags && provider.capabilityTags.length > 0 ? (
                  <View style={styles.capabilityTags}>
                    {provider.capabilityTags.slice(0, 3).map((tag, i) => (
                      <View key={i} style={[styles.capabilityTag, { backgroundColor: Colors.accentLight }]}>
                        <ThemedText style={[styles.capabilityTagText, { color: Colors.accent }]}>{tag}</ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
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
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior="padding" keyboardVerticalOffset={0}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === "describe" ? renderDescribeStep() : null}
          {step === "questions" ? renderQuestionsStep() : null}
          {step === "options" ? renderOptionsStep() : null}
          {step === "providers" ? renderProvidersStep() : null}
        </ScrollView>
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
    marginBottom: Spacing.lg,
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
  inputBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    minHeight: 120,
    marginBottom: Spacing.md,
  },
  problemInput: {
    ...Typography.body,
    flex: 1,
    minHeight: 100,
  },
  examplesSection: {
    marginBottom: Spacing.lg,
  },
  examplesLabel: {
    ...Typography.caption1,
    marginBottom: Spacing.sm,
  },
  examplesScroll: {
    flexGrow: 0,
  },
  exampleChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  exampleText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  submitButton: {
    marginTop: Spacing.lg,
  },
  analysisCard: {
    marginBottom: Spacing.lg,
  },
  analysisHeader: {
    flexDirection: "row",
    alignItems: "center",
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
  questionsTitle: {
    ...Typography.title3,
    marginBottom: Spacing.xs,
  },
  questionsSubtitle: {
    ...Typography.subhead,
    marginBottom: Spacing.lg,
  },
  questionCard: {
    marginBottom: Spacing.lg,
  },
  questionHeader: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  questionNumber: {
    ...Typography.headline,
    width: 24,
    textAlign: "center",
  },
  questionText: {
    ...Typography.body,
    flex: 1,
    fontWeight: "500",
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginLeft: 32,
  },
  choiceOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  choiceText: {
    ...Typography.subhead,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  yesNoRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginLeft: 32,
  },
  yesNoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
  },
  yesNoText: {
    ...Typography.body,
  },
  textInputField: {
    marginLeft: 32,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    ...Typography.body,
    minHeight: 48,
  },
  optionsTitle: {
    ...Typography.title2,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryLabel: {
    ...Typography.caption1,
    marginBottom: Spacing.xs,
  },
  summaryText: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  summaryMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.caption1,
  },
  scopeSection: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  scopeLabel: {
    ...Typography.caption1,
    marginBottom: Spacing.sm,
  },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  scopeText: {
    ...Typography.subhead,
    flex: 1,
  },
  packagesTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  optionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    position: "relative",
    overflow: "hidden",
  },
  recommendedBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  recommendedText: {
    ...Typography.caption2,
    color: "#fff",
    fontWeight: "600",
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  optionName: {
    ...Typography.headline,
  },
  optionPrice: {
    ...Typography.headline,
    color: Colors.accent,
  },
  optionDescription: {
    ...Typography.subhead,
    marginBottom: Spacing.sm,
  },
  optionIncludes: {
    marginTop: Spacing.xs,
  },
  includeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 2,
  },
  includeText: {
    ...Typography.caption1,
  },
  providersTitle: {
    ...Typography.title2,
    marginBottom: Spacing.xs,
  },
  providersSubtitle: {
    ...Typography.subhead,
    marginBottom: Spacing.lg,
  },
  selectedOptionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  selectedOptionText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
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
    gap: Spacing.md,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    ...Typography.caption1,
  },
  experienceText: {
    ...Typography.caption1,
  },
  capabilityTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  capabilityTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  capabilityTagText: {
    ...Typography.caption2,
    fontWeight: "500",
  },
  noProvidersContainer: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  noProvidersText: {
    ...Typography.subhead,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  preselectedProviderCard: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    alignItems: "center",
  },
  bookingWithLabel: {
    ...Typography.caption,
    marginBottom: Spacing.xs,
  },
  preselectedProviderName: {
    ...Typography.title2,
    textAlign: "center",
  },
});
