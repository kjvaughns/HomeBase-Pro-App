import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Avatar } from "@/components/Avatar";
import { StatusPill } from "@/components/StatusPill";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useHomeownerStore } from "@/state/homeownerStore";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, "ServiceIntake">;

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
  summary: string;
  severity: string;
  questions: IntakeQuestion[];
}

interface IssueExplanation {
  explanation: string;
  recommendedService: string;
  whatToExpect: string[];
  estimatedDuration: string;
  priceRange: { min: number; max: number };
}

type IntakeStep = "describe" | "questions" | "summary";

export default function ServiceIntakeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { theme } = useTheme();

  const { providerId, service, categoryId } = route.params;
  const providers = useHomeownerStore((s) => s.providers);
  const provider = providers.find((p) => p.id === providerId);

  const [step, setStep] = useState<IntakeStep>("describe");
  const [problemText, setProblemText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ServiceAnalysis | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [issueExplanation, setIssueExplanation] = useState<IssueExplanation | null>(null);

  const analyzeProblem = useCallback(async () => {
    if (!problemText.trim()) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await fetch(new URL("/api/intake/analyze", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          problem: problemText,
          context: `Service: ${service}, Provider: ${provider?.businessName}` 
        }),
      });

      if (!response.ok) throw new Error("Failed to analyze");

      const data = await response.json();
      setAnalysis(data.analysis);
      setStep("questions");
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [problemText, service, provider]);

  const generateExplanation = useCallback(async () => {
    if (!analysis) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await fetch(new URL("/api/intake/explain-issue", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: problemText,
          category: analysis.category,
          answers,
          service,
          providerName: provider?.businessName,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate explanation");

      const data = await response.json();
      setIssueExplanation(data);
      setStep("summary");
    } catch (error) {
      console.error("Explanation error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [analysis, problemText, answers, service, provider]);

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleToggleMultiChoice = (questionId: string, option: string) => {
    const current = (answers[questionId] as string[]) || [];
    if (current.includes(option)) {
      handleAnswerChange(questionId, current.filter((o) => o !== option));
    } else {
      handleAnswerChange(questionId, [...current, option]);
    }
  };

  const allQuestionsAnswered = () => {
    if (!analysis) return false;
    return analysis.questions.every((q) => {
      if (!q.required) return true;
      const answer = answers[q.id];
      if (Array.isArray(answer)) return answer.length > 0;
      return answer && answer.trim().length > 0;
    });
  };

  const handleBookNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("BookingRequest", {
      providerId,
      categoryId,
      service: issueExplanation?.recommendedService || service,
    });
  };

  const renderDescribeStep = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      {provider ? (
        <GlassCard style={styles.providerCard}>
          <View style={styles.providerRow}>
            <Avatar name={provider.name} size="medium" uri={provider.avatarUrl} />
            <View style={styles.providerInfo}>
              <ThemedText style={styles.providerName}>{provider.businessName}</ThemedText>
              <ThemedText style={[styles.serviceName, { color: theme.textSecondary }]}>
                {service}
              </ThemedText>
            </View>
            {provider.verified ? <StatusPill label="Verified" status="success" /> : null}
          </View>
        </GlassCard>
      ) : null}

      <ThemedText style={styles.sectionTitle}>Describe Your Issue</ThemedText>
      <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
        Tell us what's happening so we can better understand your needs
      </ThemedText>

      <View
        style={[
          styles.inputContainer,
          { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight },
        ]}
      >
        <TextInput
          style={[styles.textInput, { color: theme.text }]}
          placeholder="Describe the issue you're experiencing..."
          placeholderTextColor={theme.textTertiary}
          value={problemText}
          onChangeText={setProblemText}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
      </View>

      <PrimaryButton
        onPress={analyzeProblem}
        disabled={!problemText.trim() || isLoading}
        loading={isLoading}
      >
        Continue
      </PrimaryButton>
    </Animated.View>
  );

  const renderQuestionInput = (question: IntakeQuestion) => {
    switch (question.type) {
      case "single_choice":
      case "yes_no":
        const options = question.type === "yes_no" ? ["Yes", "No"] : question.options || [];
        return (
          <View style={styles.optionsGrid}>
            {options.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor:
                      answers[question.id] === option ? Colors.accent : theme.backgroundSecondary,
                    borderColor:
                      answers[question.id] === option ? Colors.accent : theme.borderLight,
                  },
                ]}
                onPress={() => handleAnswerChange(question.id, option)}
              >
                <ThemedText
                  style={[
                    styles.optionText,
                    { color: answers[question.id] === option ? "#fff" : theme.text },
                  ]}
                >
                  {option}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        );

      case "multiple_choice":
        return (
          <View style={styles.checkboxList}>
            {(question.options || []).map((option) => {
              const selected = ((answers[question.id] as string[]) || []).includes(option);
              return (
                <Pressable
                  key={option}
                  style={[
                    styles.checkboxRow,
                    { borderColor: theme.borderLight },
                  ]}
                  onPress={() => handleToggleMultiChoice(question.id, option)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      selected
                        ? { backgroundColor: Colors.accent, borderColor: Colors.accent }
                        : { borderColor: theme.borderLight },
                    ]}
                  >
                    {selected ? <Feather name="check" size={14} color="#fff" /> : null}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>{option}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        );

      case "text":
      case "number":
        return (
          <View
            style={[
              styles.textInputSmall,
              { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight },
            ]}
          >
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder={question.placeholder || "Enter your answer..."}
              placeholderTextColor={theme.textTertiary}
              value={(answers[question.id] as string) || ""}
              onChangeText={(text) => handleAnswerChange(question.id, text)}
              keyboardType={question.type === "number" ? "numeric" : "default"}
            />
          </View>
        );

      default:
        return null;
    }
  };

  const renderQuestionsStep = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      <ThemedText style={styles.sectionTitle}>A Few Quick Questions</ThemedText>
      <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
        This helps us understand your needs better
      </ThemedText>

      {analysis?.questions.map((question, index) => (
        <Animated.View
          key={question.id}
          entering={FadeInDown.delay(index * 100).duration(300)}
          style={styles.questionCard}
        >
          <ThemedText style={styles.questionText}>{question.text}</ThemedText>
          {renderQuestionInput(question)}
        </Animated.View>
      ))}

      <PrimaryButton
        onPress={generateExplanation}
        disabled={!allQuestionsAnswered() || isLoading}
        loading={isLoading}
      >
        Continue
      </PrimaryButton>
    </Animated.View>
  );

  const renderSummaryStep = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      <GlassCard style={styles.explanationCard}>
        <View style={styles.explanationHeader}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.accentLight }]}>
            <Feather name="info" size={24} color={Colors.accent} />
          </View>
          <ThemedText style={styles.explanationTitle}>Understanding Your Issue</ThemedText>
        </View>

        <ThemedText style={[styles.explanationText, { color: theme.textSecondary }]}>
          {issueExplanation?.explanation || "Based on your description, here's what we understand about your situation."}
        </ThemedText>

        {issueExplanation?.recommendedService ? (
          <View style={styles.recommendedService}>
            <ThemedText style={[styles.recommendedLabel, { color: theme.textTertiary }]}>
              Recommended Service
            </ThemedText>
            <ThemedText style={styles.recommendedValue}>
              {issueExplanation.recommendedService}
            </ThemedText>
          </View>
        ) : null}

        {issueExplanation?.priceRange ? (
          <View style={styles.priceRow}>
            <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
              Estimated Cost
            </ThemedText>
            <ThemedText style={styles.priceValue}>
              ${issueExplanation.priceRange.min} - ${issueExplanation.priceRange.max}
            </ThemedText>
          </View>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.nextStepsCard}>
        <View style={styles.nextStepsHeader}>
          <Feather name="check-circle" size={20} color={Colors.accent} />
          <ThemedText style={styles.nextStepsTitle}>What Happens Next</ThemedText>
        </View>

        <View style={styles.stepsList}>
          {(issueExplanation?.whatToExpect || [
            "A professional will contact you to confirm the appointment",
            "They'll come to your location to assess the situation",
            "You'll receive a final quote before any work begins",
          ]).map((step, index) => (
            <View key={index} style={styles.stepItem}>
              <View style={[styles.stepNumber, { backgroundColor: Colors.accentLight }]}>
                <ThemedText style={styles.stepNumberText}>{index + 1}</ThemedText>
              </View>
              <ThemedText style={[styles.stepText, { color: theme.textSecondary }]}>
                {step}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.proVisitNote}>
          <Feather name="user" size={16} color={theme.textTertiary} />
          <ThemedText style={[styles.proVisitText, { color: theme.textTertiary }]}>
            {provider?.businessName || "Your chosen professional"} will come out to assess your specific situation before providing a final quote.
          </ThemedText>
        </View>
      </GlassCard>

      <PrimaryButton onPress={handleBookNow}>
        Request Appointment
      </PrimaryButton>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progressBar}>
          {(["describe", "questions", "summary"] as IntakeStep[]).map((s, index) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                {
                  backgroundColor:
                    step === s
                      ? Colors.accent
                      : (["describe", "questions", "summary"] as IntakeStep[]).indexOf(step) > index
                      ? Colors.accent
                      : theme.borderLight,
                },
              ]}
            />
          ))}
        </View>

        {isLoading && step === "describe" ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
              Analyzing your issue...
            </ThemedText>
          </View>
        ) : null}

        {step === "describe" && !isLoading ? renderDescribeStep() : null}
        {step === "questions" ? renderQuestionsStep() : null}
        {step === "summary" ? renderSummaryStep() : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepContent: {
    gap: Spacing.md,
  },
  providerCard: {
    marginBottom: Spacing.md,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  providerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  providerName: {
    ...Typography.headline,
    fontWeight: "600",
  },
  serviceName: {
    ...Typography.subhead,
    marginTop: 2,
  },
  sectionTitle: {
    ...Typography.title2,
    fontWeight: "700",
  },
  sectionSubtitle: {
    ...Typography.body,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    minHeight: 120,
  },
  textInput: {
    ...Typography.body,
    flex: 1,
  },
  questionCard: {
    marginBottom: Spacing.md,
  },
  questionText: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  optionText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  checkboxList: {
    gap: Spacing.sm,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
    ...Typography.body,
    flex: 1,
  },
  textInputSmall: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  input: {
    ...Typography.body,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
  },
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  explanationCard: {
    marginBottom: Spacing.md,
  },
  explanationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  explanationTitle: {
    ...Typography.headline,
    fontWeight: "700",
    flex: 1,
  },
  explanationText: {
    ...Typography.body,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  recommendedService: {
    marginBottom: Spacing.md,
  },
  recommendedLabel: {
    ...Typography.caption1,
    marginBottom: 4,
  },
  recommendedValue: {
    ...Typography.headline,
    fontWeight: "600",
    color: Colors.accent,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  priceLabel: {
    ...Typography.subhead,
  },
  priceValue: {
    ...Typography.title3,
    fontWeight: "700",
    color: Colors.accent,
  },
  nextStepsCard: {
    marginBottom: Spacing.lg,
  },
  nextStepsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  nextStepsTitle: {
    ...Typography.headline,
    fontWeight: "600",
  },
  stepsList: {
    gap: Spacing.md,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  stepNumberText: {
    ...Typography.caption1,
    fontWeight: "700",
    color: Colors.accent,
  },
  stepText: {
    ...Typography.body,
    flex: 1,
    lineHeight: 20,
  },
  proVisitNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  proVisitText: {
    ...Typography.caption1,
    flex: 1,
    lineHeight: 18,
  },
});
