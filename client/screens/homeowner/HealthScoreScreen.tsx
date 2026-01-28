import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Dimensions,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface HealthScoreRun {
  id: string;
  date: string;
  score: number;
  breakdown: {
    safety: number;
    water: number;
    energy: number;
    comfort: number;
    exterior: number;
  };
  confidence: "low" | "medium" | "high";
  topRisks: string[];
}

interface Home {
  id: string;
  name: string;
  address: string;
}

const MOCK_HOMES: Home[] = [
  { id: "home-1", name: "Main House", address: "123 Test Street, San Francisco" },
  { id: "home-2", name: "Beach Cottage", address: "456 Ocean Drive, Santa Cruz" },
];

const MOCK_SCORE_RUNS: HealthScoreRun[] = [
  {
    id: "run-1",
    date: "2026-01-15",
    score: 78,
    breakdown: { safety: 85, water: 72, energy: 80, comfort: 75, exterior: 68 },
    confidence: "high",
    topRisks: ["Roof inspection overdue", "Water heater aging", "Gutters need cleaning"],
  },
  {
    id: "run-2",
    date: "2025-10-20",
    score: 72,
    breakdown: { safety: 80, water: 68, energy: 75, comfort: 70, exterior: 65 },
    confidence: "medium",
    topRisks: ["HVAC filter replacement", "Exterior paint fading", "Smoke detector batteries"],
  },
];

interface WizardStep {
  id: string;
  section: string;
  question: string;
  type: "single" | "multi" | "slider" | "toggle" | "number";
  options?: string[];
  helperText?: string;
  prefilled?: string | number | boolean;
}

const WIZARD_STEPS: WizardStep[] = [
  { id: "home-age", section: "Home Context", question: "How old is your home?", type: "single", options: ["0-5 years", "5-15 years", "15-30 years", "30+ years"], helperText: "Older homes may need more frequent maintenance checks" },
  { id: "roof-age", section: "Home Context", question: "When was your roof last replaced or inspected?", type: "single", options: ["< 5 years", "5-10 years", "10-20 years", "20+ years", "Unknown"], helperText: "Roofs typically need replacement every 20-25 years" },
  { id: "hvac-age", section: "Home Context", question: "How old is your HVAC system?", type: "single", options: ["< 5 years", "5-10 years", "10-15 years", "15+ years", "Unknown"], helperText: "HVAC systems last 15-20 years on average" },
  { id: "water-heater", section: "Home Context", question: "How old is your water heater?", type: "single", options: ["< 5 years", "5-10 years", "10-15 years", "15+ years", "Unknown"], helperText: "Water heaters typically last 8-12 years" },
  { id: "symptoms", section: "Visible Symptoms", question: "Select any issues you've noticed:", type: "multi", options: ["Leaks or water stains", "Uneven temperatures", "High energy bills", "Slow drains", "Roof stains or damage", "Pest activity", "Gutter overflow", "Dryer takes too long", "Wall or foundation cracks", "Mold or musty smell"], helperText: "Check all that apply to get a more accurate assessment" },
  { id: "smoke-co", section: "Safety Checks", question: "Have you tested smoke and CO detectors in the last 6 months?", type: "toggle", helperText: "Detectors should be tested monthly and replaced every 10 years" },
  { id: "gfci", section: "Safety Checks", question: "Are GFCI outlets present in wet areas (kitchen, bathrooms)?", type: "single", options: ["Yes, all areas", "Some areas", "No", "Not sure"], helperText: "GFCI outlets prevent electrical shocks in wet areas" },
  { id: "water-shutoff", section: "Safety Checks", question: "Do you know where your main water shutoff is?", type: "toggle", helperText: "Knowing this can prevent major water damage in emergencies" },
  { id: "filter-cadence", section: "Maintenance Habits", question: "How often do you replace HVAC filters?", type: "single", options: ["Monthly", "Every 3 months", "Every 6 months", "Rarely/Never"], helperText: "Most filters should be changed every 1-3 months" },
  { id: "gutter-cleaning", section: "Maintenance Habits", question: "How often are your gutters cleaned?", type: "single", options: ["Twice a year", "Once a year", "Less than yearly", "Never"], helperText: "Gutters should be cleaned at least twice yearly" },
  { id: "hvac-service", section: "Maintenance Habits", question: "Do you get annual HVAC service?", type: "toggle", helperText: "Annual maintenance extends system life and improves efficiency" },
  { id: "pest-control", section: "Maintenance Habits", question: "Do you have regular pest control?", type: "single", options: ["Quarterly", "As needed", "Never"], helperText: "Preventive pest control is cheaper than addressing infestations" },
  { id: "risk-tolerance", section: "Preferences", question: "What's your maintenance approach?", type: "single", options: ["Conservative - Prevent all issues", "Balanced - Address risks promptly", "Aggressive - Fix only when broken"], helperText: "We'll tailor recommendations to your preference" },
  { id: "photos", section: "Optional", question: "Would you like to add photos of any issues?", type: "toggle", helperText: "Photos help us provide more accurate assessments" },
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ScoreRing({ score, size = 120, strokeWidth = 10, animating = false }: { score: number; size?: number; strokeWidth?: number; animating?: boolean }) {
  const { theme } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (animating) {
      progress.value = 0;
      progress.value = withTiming(score / 100, { duration: 1500, easing: Easing.out(Easing.cubic) });
    } else {
      progress.value = score / 100;
    }
  }, [score, animating]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const getScoreColor = (s: number) => {
    if (s >= 80) return Colors.accent;
    if (s >= 60) return Colors.warning;
    return Colors.error;
  };

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.separator} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={radius} stroke={getScoreColor(score)} strokeWidth={strokeWidth} fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeLinecap="round" animatedProps={animatedProps} />
      </Svg>
      <View style={{ alignItems: "center" }}>
        <ThemedText style={[styles.scoreValue, { color: getScoreColor(score) }]}>{score}</ThemedText>
        <ThemedText style={[styles.scoreLabel, { color: theme.textSecondary }]}>/ 100</ThemedText>
      </View>
    </View>
  );
}

export default function HealthScoreScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user } = useAuthStore();

  const [selectedHomeId, setSelectedHomeId] = useState(MOCK_HOMES[0].id);
  const [showHomeSelector, setShowHomeSelector] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentResult, setCurrentResult] = useState<HealthScoreRun | null>(null);
  const [showScoringDrawer, setShowScoringDrawer] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "risks" | "plan" | "history">("overview");

  const selectedHome = MOCK_HOMES.find((h) => h.id === selectedHomeId) || MOCK_HOMES[0];
  const lastRun = MOCK_SCORE_RUNS[0];
  const previousRun = MOCK_SCORE_RUNS[1];
  const trendDiff = lastRun && previousRun ? lastRun.score - previousRun.score : 0;

  const handleStartAssessment = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setWizardStep(0);
    setAnswers({});
    setShowWizard(true);
  };

  const handleViewPrevious = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentResult(lastRun);
    setShowResults(true);
  };

  const handleWizardNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (wizardStep < WIZARD_STEPS.length - 1) {
      setWizardStep(wizardStep + 1);
    } else {
      const newResult: HealthScoreRun = {
        id: `run-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        score: 82,
        breakdown: { safety: 88, water: 78, energy: 85, comfort: 80, exterior: 75 },
        confidence: Object.keys(answers).length > 10 ? "high" : Object.keys(answers).length > 6 ? "medium" : "low",
        topRisks: ["Water heater approaching end of life", "Gutter cleaning overdue"],
      };
      setCurrentResult(newResult);
      setShowWizard(false);
      setShowResults(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleWizardBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (wizardStep > 0) {
      setWizardStep(wizardStep - 1);
    } else {
      setShowWizard(false);
    }
  };

  const handleAnswerSelect = (stepId: string, value: any) => {
    Haptics.selectionAsync();
    setAnswers({ ...answers, [stepId]: value });
  };

  const handleMultiSelect = (stepId: string, option: string) => {
    const current = answers[stepId] || [];
    const updated = current.includes(option) ? current.filter((o: string) => o !== option) : [...current, option];
    setAnswers({ ...answers, [stepId]: updated });
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Good";
    if (score >= 70) return "Fair";
    if (score >= 60) return "Needs Attention";
    return "Action Required";
  };

  const getConfidenceColor = (conf: string) => {
    if (conf === "high") return Colors.accent;
    if (conf === "medium") return Colors.warning;
    return Colors.error;
  };

  const renderEntryScreen = () => (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl + 88 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <Pressable style={[styles.homeSelector, { backgroundColor: theme.cardBackground }]} onPress={() => setShowHomeSelector(true)}>
          <Feather name="home" size={18} color={Colors.accent} />
          <ThemedText style={styles.homeSelectorText}>{selectedHome.name}</ThemedText>
          <Feather name="chevron-down" size={18} color={theme.textSecondary} />
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <GlassCard style={styles.heroCard}>
          <ThemedText style={styles.heroTitle}>Home Health Score</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            Know what matters most right now and what it will cost later.
          </ThemedText>
          {lastRun ? (
            <View style={styles.lastScorePreview}>
              <View style={styles.lastScoreHeader}>
                <ThemedText style={[styles.lastScoreLabel, { color: theme.textSecondary }]}>Last Score</ThemedText>
                <View style={styles.trendBadge}>
                  <Feather name={trendDiff >= 0 ? "trending-up" : "trending-down"} size={14} color={trendDiff >= 0 ? Colors.accent : Colors.error} />
                  <ThemedText style={[styles.trendText, { color: trendDiff >= 0 ? Colors.accent : Colors.error }]}>
                    {trendDiff >= 0 ? "+" : ""}{trendDiff} pts
                  </ThemedText>
                </View>
              </View>
              <View style={styles.lastScoreRow}>
                <ScoreRing score={lastRun.score} size={80} strokeWidth={8} />
                <View style={styles.lastScoreInfo}>
                  <ThemedText style={styles.lastScoreValue}>{getScoreLabel(lastRun.score)}</ThemedText>
                  <ThemedText style={[styles.lastScoreDate, { color: theme.textSecondary }]}>
                    Ran on {new Date(lastRun.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </ThemedText>
                  <View style={styles.confidenceBadge}>
                    <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor(lastRun.confidence) }]} />
                    <ThemedText style={[styles.confidenceText, { color: theme.textSecondary }]}>
                      {lastRun.confidence.charAt(0).toUpperCase() + lastRun.confidence.slice(1)} confidence
                    </ThemedText>
                  </View>
                </View>
              </View>
            </View>
          ) : null}
          <PrimaryButton onPress={handleStartAssessment} style={styles.heroButton}>
            Run Assessment
          </PrimaryButton>
          {lastRun ? (
            <Pressable onPress={handleViewPrevious} style={styles.secondaryButton}>
              <ThemedText style={[styles.secondaryButtonText, { color: Colors.accent }]}>View Previous Scores</ThemedText>
            </Pressable>
          ) : null}
        </GlassCard>
      </Animated.View>

      {lastRun ? (
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <ThemedText style={styles.sectionTitle}>Top Risks</ThemedText>
          {lastRun.topRisks.map((risk, index) => (
            <GlassCard key={index} style={styles.riskCard}>
              <View style={[styles.riskIcon, { backgroundColor: Colors.warningLight }]}>
                <Feather name="alert-triangle" size={18} color={Colors.warning} />
              </View>
              <View style={styles.riskContent}>
                <ThemedText style={styles.riskTitle}>{risk}</ThemedText>
                <ThemedText style={[styles.riskAction, { color: Colors.accent }]}>Book Now</ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textTertiary} />
            </GlassCard>
          ))}
        </Animated.View>
      ) : null}

      {lastRun ? (
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <ThemedText style={styles.sectionTitle}>Score Breakdown</ThemedText>
          <GlassCard style={styles.breakdownCard}>
            {Object.entries(lastRun.breakdown).map(([key, value]) => (
              <View key={key} style={styles.breakdownRow}>
                <View style={styles.breakdownLabel}>
                  <Feather
                    name={key === "safety" ? "shield" : key === "water" ? "droplet" : key === "energy" ? "zap" : key === "comfort" ? "thermometer" : "home"}
                    size={16}
                    color={value >= 80 ? Colors.accent : value >= 60 ? Colors.warning : Colors.error}
                  />
                  <ThemedText style={styles.breakdownName}>{key.charAt(0).toUpperCase() + key.slice(1)}</ThemedText>
                </View>
                <View style={styles.breakdownBar}>
                  <View style={[styles.breakdownProgress, { width: `${value}%`, backgroundColor: value >= 80 ? Colors.accent : value >= 60 ? Colors.warning : Colors.error }]} />
                </View>
                <ThemedText style={[styles.breakdownValue, { color: value >= 80 ? Colors.accent : value >= 60 ? Colors.warning : Colors.error }]}>{value}</ThemedText>
              </View>
            ))}
            <Pressable onPress={() => setShowScoringDrawer(true)} style={styles.howScoredButton}>
              <Feather name="info" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.howScoredText, { color: theme.textSecondary }]}>How we scored this</ThemedText>
            </Pressable>
          </GlassCard>
        </Animated.View>
      ) : null}
    </ScrollView>
  );

  const renderWizard = () => {
    const step = WIZARD_STEPS[wizardStep];
    const currentSection = step.section;
    const sectionSteps = WIZARD_STEPS.filter((s) => s.section === currentSection);
    const sectionIndex = sectionSteps.findIndex((s) => s.id === step.id);

    return (
      <Modal visible={showWizard} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={styles.wizardContainer}>
          <View style={[styles.wizardHeader, { paddingTop: insets.top + Spacing.md }]}>
            <Pressable onPress={handleWizardBack} style={styles.wizardBackButton}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
            <View style={styles.wizardProgress}>
              <View style={[styles.wizardProgressBar, { backgroundColor: theme.separator }]}>
                <View style={[styles.wizardProgressFill, { width: `${((wizardStep + 1) / WIZARD_STEPS.length) * 100}%` }]} />
              </View>
              <ThemedText style={[styles.wizardProgressText, { color: theme.textSecondary }]}>
                {wizardStep + 1} of {WIZARD_STEPS.length}
              </ThemedText>
            </View>
            <Pressable onPress={() => setShowWizard(false)} style={styles.wizardCloseButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.wizardContent}>
            <ThemedText style={[styles.wizardSection, { color: Colors.accent }]}>{step.section}</ThemedText>
            <ThemedText style={styles.wizardQuestion}>{step.question}</ThemedText>
            {step.helperText ? (
              <ThemedText style={[styles.wizardHelper, { color: theme.textSecondary }]}>{step.helperText}</ThemedText>
            ) : null}

            <View style={styles.wizardOptions}>
              {step.type === "single" && step.options?.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.optionButton, { backgroundColor: theme.cardBackground, borderColor: answers[step.id] === option ? Colors.accent : theme.separator }]}
                  onPress={() => handleAnswerSelect(step.id, option)}
                >
                  <ThemedText style={[styles.optionText, answers[step.id] === option && { color: Colors.accent }]}>{option}</ThemedText>
                  {answers[step.id] === option ? <Feather name="check" size={20} color={Colors.accent} /> : null}
                </Pressable>
              ))}

              {step.type === "multi" && step.options?.map((option) => {
                const selected = (answers[step.id] || []).includes(option);
                return (
                  <Pressable
                    key={option}
                    style={[styles.optionButton, { backgroundColor: theme.cardBackground, borderColor: selected ? Colors.accent : theme.separator }]}
                    onPress={() => handleMultiSelect(step.id, option)}
                  >
                    <ThemedText style={[styles.optionText, selected && { color: Colors.accent }]}>{option}</ThemedText>
                    <View style={[styles.checkbox, selected && { backgroundColor: Colors.accent, borderColor: Colors.accent }]}>
                      {selected ? <Feather name="check" size={14} color="#FFF" /> : null}
                    </View>
                  </Pressable>
                );
              })}

              {step.type === "toggle" && (
                <View style={styles.toggleContainer}>
                  <Pressable
                    style={[styles.toggleOption, { backgroundColor: theme.cardBackground, borderColor: answers[step.id] === true ? Colors.accent : theme.separator }]}
                    onPress={() => handleAnswerSelect(step.id, true)}
                  >
                    <Feather name="check-circle" size={24} color={answers[step.id] === true ? Colors.accent : theme.textTertiary} />
                    <ThemedText style={[styles.toggleText, answers[step.id] === true && { color: Colors.accent }]}>Yes</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.toggleOption, { backgroundColor: theme.cardBackground, borderColor: answers[step.id] === false ? Colors.error : theme.separator }]}
                    onPress={() => handleAnswerSelect(step.id, false)}
                  >
                    <Feather name="x-circle" size={24} color={answers[step.id] === false ? Colors.error : theme.textTertiary} />
                    <ThemedText style={[styles.toggleText, answers[step.id] === false && { color: Colors.error }]}>No</ThemedText>
                  </Pressable>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.wizardFooter, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <PrimaryButton onPress={handleWizardNext} style={styles.wizardNextButton}>
              {wizardStep < WIZARD_STEPS.length - 1 ? "Continue" : "Get My Score"}
            </PrimaryButton>
            {step.type !== "toggle" && !answers[step.id] ? (
              <Pressable onPress={handleWizardNext} style={styles.skipButton}>
                <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>Skip this question</ThemedText>
              </Pressable>
            ) : null}
          </View>
        </ThemedView>
      </Modal>
    );
  };

  const renderResults = () => {
    if (!currentResult) return null;

    const tabs = [
      { id: "overview", label: "Overview", icon: "grid" },
      { id: "risks", label: "Risks", icon: "alert-triangle" },
      { id: "plan", label: "Action Plan", icon: "list" },
      { id: "history", label: "History", icon: "clock" },
    ] as const;

    return (
      <Modal visible={showResults} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={styles.resultsContainer}>
          <View style={[styles.resultsHeader, { paddingTop: insets.top + Spacing.md }]}>
            <Pressable onPress={() => setShowResults(false)} style={styles.resultsBackButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText style={styles.resultsTitle}>Health Score Results</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.resultsContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeIn.delay(200).duration(600)}>
              <View style={styles.scoreSection}>
                <ScoreRing score={currentResult.score} size={140} strokeWidth={12} animating />
                <ThemedText style={styles.scoreSummary}>{getScoreLabel(currentResult.score)}</ThemedText>
                <View style={styles.confidenceBadge}>
                  <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor(currentResult.confidence) }]} />
                  <ThemedText style={[styles.confidenceText, { color: theme.textSecondary }]}>
                    {currentResult.confidence.charAt(0).toUpperCase() + currentResult.confidence.slice(1)} confidence
                  </ThemedText>
                </View>
              </View>
            </Animated.View>

            <View style={styles.tabBar}>
              {tabs.map((tab) => (
                <Pressable key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => setActiveTab(tab.id)}>
                  <Feather name={tab.icon as any} size={18} color={activeTab === tab.id ? Colors.accent : theme.textSecondary} />
                  <ThemedText style={[styles.tabText, { color: activeTab === tab.id ? Colors.accent : theme.textSecondary }]}>{tab.label}</ThemedText>
                </Pressable>
              ))}
            </View>

            {activeTab === "overview" && (
              <Animated.View entering={FadeIn.duration(300)}>
                <ThemedText style={[styles.overviewSummary, { color: theme.textSecondary }]}>
                  Your home is doing okay, but you have {currentResult.topRisks.length} priority risks that need attention.
                </ThemedText>

                <View style={styles.highlightCards}>
                  <GlassCard style={styles.highlightCard}>
                    <Feather name="alert-triangle" size={24} color={Colors.warning} />
                    <ThemedText style={styles.highlightLabel}>Top Risk</ThemedText>
                    <ThemedText style={styles.highlightValue} numberOfLines={2}>{currentResult.topRisks[0]}</ThemedText>
                  </GlassCard>
                  <GlassCard style={styles.highlightCard}>
                    <Feather name="dollar-sign" size={24} color={Colors.error} />
                    <ThemedText style={styles.highlightLabel}>Cost if Ignored</ThemedText>
                    <ThemedText style={styles.highlightValue}>$2,500 - $5,000</ThemedText>
                  </GlassCard>
                  <GlassCard style={styles.highlightCard}>
                    <Feather name="trending-up" size={24} color={Colors.accent} />
                    <ThemedText style={styles.highlightLabel}>Quick Win Savings</ThemedText>
                    <ThemedText style={styles.highlightValue}>$300 - $600/yr</ThemedText>
                  </GlassCard>
                </View>

                <ThemedText style={styles.resultSectionTitle}>Score Breakdown</ThemedText>
                <GlassCard style={styles.breakdownCard}>
                  {Object.entries(currentResult.breakdown).map(([key, value]) => (
                    <View key={key} style={styles.breakdownRow}>
                      <View style={styles.breakdownLabel}>
                        <Feather
                          name={key === "safety" ? "shield" : key === "water" ? "droplet" : key === "energy" ? "zap" : key === "comfort" ? "thermometer" : "home"}
                          size={16}
                          color={value >= 80 ? Colors.accent : value >= 60 ? Colors.warning : Colors.error}
                        />
                        <ThemedText style={styles.breakdownName}>{key.charAt(0).toUpperCase() + key.slice(1)}</ThemedText>
                      </View>
                      <View style={styles.breakdownBar}>
                        <View style={[styles.breakdownProgress, { width: `${value}%`, backgroundColor: value >= 80 ? Colors.accent : value >= 60 ? Colors.warning : Colors.error }]} />
                      </View>
                      <ThemedText style={[styles.breakdownValue, { color: value >= 80 ? Colors.accent : value >= 60 ? Colors.warning : Colors.error }]}>{value}</ThemedText>
                    </View>
                  ))}
                </GlassCard>
              </Animated.View>
            )}

            {activeTab === "risks" && (
              <Animated.View entering={FadeIn.duration(300)}>
                <ThemedText style={styles.resultSectionTitle}>Priority Issues</ThemedText>
                {currentResult.topRisks.map((risk, index) => (
                  <GlassCard key={index} style={styles.riskDetailCard}>
                    <View style={styles.riskDetailHeader}>
                      <View style={[styles.severityBadge, { backgroundColor: index === 0 ? Colors.errorLight : Colors.warningLight }]}>
                        <ThemedText style={[styles.severityText, { color: index === 0 ? Colors.error : Colors.warning }]}>
                          {index === 0 ? "High" : "Medium"}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.riskDetailTitle}>{risk}</ThemedText>
                    </View>
                    <ThemedText style={[styles.riskDetailWhy, { color: theme.textSecondary }]}>
                      Why it matters: Ignoring this could lead to costly repairs or safety issues.
                    </ThemedText>
                    <View style={styles.riskDetailActions}>
                      <Pressable style={[styles.riskActionButton, { backgroundColor: Colors.accent }]}>
                        <ThemedText style={styles.riskActionText}>Book Now</ThemedText>
                      </Pressable>
                      <Pressable style={[styles.riskActionButton, { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.separator }]}>
                        <ThemedText style={[styles.riskActionText, { color: theme.text }]}>Get Quote</ThemedText>
                      </Pressable>
                    </View>
                  </GlassCard>
                ))}
              </Animated.View>
            )}

            {activeTab === "plan" && (
              <Animated.View entering={FadeIn.duration(300)}>
                <ThemedText style={styles.resultSectionTitle}>Recommended Actions</ThemedText>
                {[
                  { title: "Replace HVAC filters", due: "This week", cost: "$20-40", category: "HVAC" },
                  { title: "Schedule gutter cleaning", due: "This month", cost: "$150-250", category: "Exterior" },
                  { title: "Water heater inspection", due: "Next month", cost: "$100-150", category: "Plumbing" },
                  { title: "Roof inspection", due: "Spring 2026", cost: "$200-400", category: "Roof" },
                ].map((task, index) => (
                  <GlassCard key={index} style={styles.actionCard}>
                    <View style={styles.actionHeader}>
                      <ThemedText style={styles.actionTitle}>{task.title}</ThemedText>
                      <View style={[styles.categoryChip, { backgroundColor: Colors.accentLight }]}>
                        <ThemedText style={[styles.categoryChipText, { color: Colors.accent }]}>{task.category}</ThemedText>
                      </View>
                    </View>
                    <View style={styles.actionMeta}>
                      <View style={styles.actionMetaItem}>
                        <Feather name="calendar" size={14} color={theme.textSecondary} />
                        <ThemedText style={[styles.actionMetaText, { color: theme.textSecondary }]}>{task.due}</ThemedText>
                      </View>
                      <View style={styles.actionMetaItem}>
                        <Feather name="dollar-sign" size={14} color={theme.textSecondary} />
                        <ThemedText style={[styles.actionMetaText, { color: theme.textSecondary }]}>{task.cost}</ThemedText>
                      </View>
                    </View>
                    <View style={styles.actionButtons}>
                      <Pressable style={[styles.actionBtn, { backgroundColor: Colors.accent }]}>
                        <ThemedText style={styles.actionBtnText}>Book Now</ThemedText>
                      </Pressable>
                      <Pressable style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]}>
                        <ThemedText style={[styles.actionBtnText, { color: theme.text }]}>Add to Plan</ThemedText>
                      </Pressable>
                      <Pressable style={styles.actionIconBtn}>
                        <Feather name="clock" size={18} color={theme.textSecondary} />
                      </Pressable>
                    </View>
                  </GlassCard>
                ))}
              </Animated.View>
            )}

            {activeTab === "history" && (
              <Animated.View entering={FadeIn.duration(300)}>
                <ThemedText style={styles.resultSectionTitle}>Past Assessments</ThemedText>
                {MOCK_SCORE_RUNS.map((run, index) => (
                  <GlassCard key={run.id} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <ScoreRing score={run.score} size={60} strokeWidth={6} />
                      <View style={styles.historyInfo}>
                        <ThemedText style={styles.historyDate}>
                          {new Date(run.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        </ThemedText>
                        <ThemedText style={[styles.historyLabel, { color: run.score >= 80 ? Colors.accent : run.score >= 60 ? Colors.warning : Colors.error }]}>
                          {getScoreLabel(run.score)}
                        </ThemedText>
                        {index === 0 && previousRun ? (
                          <ThemedText style={[styles.historyImprovement, { color: trendDiff >= 0 ? Colors.accent : Colors.error }]}>
                            {trendDiff >= 0 ? "+" : ""}{trendDiff} from previous
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>
                  </GlassCard>
                ))}
                <Pressable style={styles.compareButton}>
                  <ThemedText style={[styles.compareButtonText, { color: Colors.accent }]}>Compare Runs</ThemedText>
                </Pressable>
              </Animated.View>
            )}
          </ScrollView>

          {activeTab === "risks" && currentResult.topRisks.length > 0 ? (
            <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + Spacing.lg }]}>
              <PrimaryButton onPress={() => navigation.navigate("SmartIntake")}>
                Fix Top Issue Now
              </PrimaryButton>
            </View>
          ) : null}
        </ThemedView>
      </Modal>
    );
  };

  const renderScoringDrawer = () => (
    <Modal visible={showScoringDrawer} animationType="slide" presentationStyle="pageSheet" transparent>
      <Pressable style={styles.drawerOverlay} onPress={() => setShowScoringDrawer(false)}>
        <View style={[styles.drawerContent, { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.drawerHandle} />
          <ThemedText style={styles.drawerTitle}>How We Score Your Home</ThemedText>
          <ThemedText style={[styles.drawerText, { color: theme.textSecondary }]}>
            Your Home Health Score is calculated based on several factors weighted by their impact on safety, cost, and comfort:
          </ThemedText>
          {[
            { name: "Safety Systems", weight: 25, desc: "Smoke detectors, CO monitors, electrical safety" },
            { name: "Water Risk", weight: 20, desc: "Leaks, water heater age, drainage" },
            { name: "Energy Efficiency", weight: 20, desc: "HVAC condition, insulation, filters" },
            { name: "Comfort", weight: 15, desc: "Temperature consistency, air quality" },
            { name: "Exterior", weight: 20, desc: "Roof, gutters, foundation, landscaping" },
          ].map((item, index) => (
            <View key={index} style={styles.weightRow}>
              <View style={styles.weightInfo}>
                <ThemedText style={styles.weightName}>{item.name}</ThemedText>
                <ThemedText style={[styles.weightDesc, { color: theme.textSecondary }]}>{item.desc}</ThemedText>
              </View>
              <View style={[styles.weightBadge, { backgroundColor: Colors.accentLight }]}>
                <ThemedText style={[styles.weightValue, { color: Colors.accent }]}>{item.weight}%</ThemedText>
              </View>
            </View>
          ))}
        </View>
      </Pressable>
    </Modal>
  );

  const renderHomeSelector = () => (
    <Modal visible={showHomeSelector} animationType="fade" transparent>
      <Pressable style={styles.modalOverlay} onPress={() => setShowHomeSelector(false)}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={styles.modalTitle}>Select Home</ThemedText>
          {MOCK_HOMES.map((home) => (
            <Pressable
              key={home.id}
              style={[styles.homeOption, selectedHomeId === home.id && { backgroundColor: Colors.accentLight }]}
              onPress={() => { setSelectedHomeId(home.id); setShowHomeSelector(false); }}
            >
              <View>
                <ThemedText style={styles.homeOptionName}>{home.name}</ThemedText>
                <ThemedText style={[styles.homeOptionAddress, { color: theme.textSecondary }]}>{home.address}</ThemedText>
              </View>
              {selectedHomeId === home.id ? <Feather name="check" size={20} color={Colors.accent} /> : null}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <ThemedView style={styles.container}>
      {renderEntryScreen()}
      {renderWizard()}
      {renderResults()}
      {renderScoringDrawer()}
      {renderHomeSelector()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.screenPadding },
  homeSelector: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, marginBottom: Spacing.lg, gap: Spacing.sm },
  homeSelectorText: { ...Typography.subhead, fontWeight: "500" },
  heroCard: { marginBottom: Spacing.sectionGap },
  heroTitle: { ...Typography.title1, marginBottom: Spacing.xs },
  heroSubtitle: { ...Typography.body, marginBottom: Spacing.lg },
  lastScorePreview: { marginBottom: Spacing.lg },
  lastScoreHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  lastScoreLabel: { ...Typography.caption1 },
  trendBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  trendText: { ...Typography.caption1, fontWeight: "600" },
  lastScoreRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  lastScoreInfo: { flex: 1 },
  lastScoreValue: { ...Typography.title3, marginBottom: 2 },
  lastScoreDate: { ...Typography.caption1, marginBottom: Spacing.xs },
  confidenceBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  confidenceDot: { width: 8, height: 8, borderRadius: 4 },
  confidenceText: { ...Typography.caption1 },
  heroButton: { marginBottom: Spacing.sm },
  secondaryButton: { alignItems: "center", paddingVertical: Spacing.sm },
  secondaryButtonText: { ...Typography.subhead, fontWeight: "500" },
  sectionTitle: { ...Typography.headline, marginBottom: Spacing.md },
  riskCard: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm, gap: Spacing.md },
  riskIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  riskContent: { flex: 1 },
  riskTitle: { ...Typography.subhead, marginBottom: 2 },
  riskAction: { ...Typography.caption1, fontWeight: "500" },
  breakdownCard: { marginBottom: Spacing.lg },
  breakdownRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  breakdownLabel: { flexDirection: "row", alignItems: "center", width: 100, gap: 8 },
  breakdownName: { ...Typography.caption1 },
  breakdownBar: { flex: 1, height: 8, backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 4, marginHorizontal: Spacing.sm, overflow: "hidden" },
  breakdownProgress: { height: "100%", borderRadius: 4 },
  breakdownValue: { width: 30, textAlign: "right", ...Typography.caption1, fontWeight: "600" },
  howScoredButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(0,0,0,0.1)", marginTop: Spacing.sm },
  howScoredText: { ...Typography.caption1 },
  scoreValue: { fontSize: 36, fontWeight: "700" },
  scoreLabel: { ...Typography.caption1, marginTop: -4 },

  wizardContainer: { flex: 1 },
  wizardHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  wizardBackButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  wizardProgress: { flex: 1, paddingHorizontal: Spacing.md },
  wizardProgressBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  wizardProgressFill: { height: "100%", backgroundColor: Colors.accent, borderRadius: 2 },
  wizardProgressText: { ...Typography.caption2, textAlign: "center", marginTop: 4 },
  wizardCloseButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  wizardContent: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing["2xl"] },
  wizardSection: { ...Typography.caption1, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: Spacing.sm },
  wizardQuestion: { ...Typography.title2, marginBottom: Spacing.sm },
  wizardHelper: { ...Typography.footnote, marginBottom: Spacing.xl },
  wizardOptions: { gap: Spacing.sm },
  optionButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 2 },
  optionText: { ...Typography.body },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "rgba(0,0,0,0.2)", alignItems: "center", justifyContent: "center" },
  toggleContainer: { flexDirection: "row", gap: Spacing.md },
  toggleOption: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: Spacing.xl, borderRadius: BorderRadius.lg, borderWidth: 2, gap: Spacing.sm },
  toggleText: { ...Typography.headline },
  wizardFooter: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  wizardNextButton: {},
  skipButton: { alignItems: "center", paddingVertical: Spacing.md },
  skipText: { ...Typography.footnote },

  resultsContainer: { flex: 1 },
  resultsHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  resultsBackButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  resultsTitle: { ...Typography.headline, flex: 1, textAlign: "center" },
  resultsContent: { paddingHorizontal: Spacing.screenPadding, paddingBottom: 120 },
  scoreSection: { alignItems: "center", paddingVertical: Spacing.xl },
  scoreSummary: { ...Typography.title2, marginTop: Spacing.md, marginBottom: Spacing.xs },
  tabBar: { flexDirection: "row", marginBottom: Spacing.lg },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, gap: 6 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.accent },
  tabText: { ...Typography.caption1, fontWeight: "500" },
  overviewSummary: { ...Typography.body, marginBottom: Spacing.lg, textAlign: "center" },
  highlightCards: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  highlightCard: { flex: 1, alignItems: "center", paddingVertical: Spacing.lg },
  highlightLabel: { ...Typography.caption2, marginTop: Spacing.sm, marginBottom: 4, textAlign: "center" },
  highlightValue: { ...Typography.caption1, fontWeight: "600", textAlign: "center" },
  resultSectionTitle: { ...Typography.headline, marginBottom: Spacing.md },
  riskDetailCard: { marginBottom: Spacing.md },
  riskDetailHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  severityBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.xs },
  severityText: { ...Typography.caption2, fontWeight: "600" },
  riskDetailTitle: { ...Typography.headline, flex: 1 },
  riskDetailWhy: { ...Typography.footnote, marginBottom: Spacing.md },
  riskDetailActions: { flexDirection: "row", gap: Spacing.sm },
  riskActionButton: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, alignItems: "center" },
  riskActionText: { ...Typography.subhead, fontWeight: "600", color: "#FFF" },
  actionCard: { marginBottom: Spacing.md },
  actionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  actionTitle: { ...Typography.headline, flex: 1 },
  categoryChip: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.xs },
  categoryChipText: { ...Typography.caption2, fontWeight: "500" },
  actionMeta: { flexDirection: "row", gap: Spacing.lg, marginBottom: Spacing.md },
  actionMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionMetaText: { ...Typography.caption1 },
  actionButtons: { flexDirection: "row", gap: Spacing.sm, alignItems: "center" },
  actionBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  actionBtnText: { ...Typography.caption1, fontWeight: "600", color: "#FFF" },
  actionIconBtn: { padding: Spacing.sm },
  historyCard: { marginBottom: Spacing.md },
  historyHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  historyInfo: { flex: 1 },
  historyDate: { ...Typography.headline, marginBottom: 2 },
  historyLabel: { ...Typography.subhead, fontWeight: "500", marginBottom: 2 },
  historyImprovement: { ...Typography.caption1 },
  compareButton: { alignItems: "center", paddingVertical: Spacing.md },
  compareButtonText: { ...Typography.subhead, fontWeight: "500" },
  stickyFooter: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.lg, backgroundColor: "rgba(255,255,255,0.95)" },

  drawerOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  drawerContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  drawerHandle: { width: 36, height: 4, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 2, alignSelf: "center", marginBottom: Spacing.lg },
  drawerTitle: { ...Typography.title3, marginBottom: Spacing.md },
  drawerText: { ...Typography.body, marginBottom: Spacing.lg },
  weightRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.1)" },
  weightInfo: { flex: 1 },
  weightName: { ...Typography.headline, marginBottom: 2 },
  weightDesc: { ...Typography.caption1 },
  weightBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
  weightValue: { ...Typography.subhead, fontWeight: "600" },

  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", padding: Spacing.xl },
  modalContent: { width: "100%", borderRadius: BorderRadius.lg, padding: Spacing.lg },
  modalTitle: { ...Typography.title3, marginBottom: Spacing.lg },
  homeOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.lg, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  homeOptionName: { ...Typography.headline, marginBottom: 2 },
  homeOptionAddress: { ...Typography.caption1 },
});
