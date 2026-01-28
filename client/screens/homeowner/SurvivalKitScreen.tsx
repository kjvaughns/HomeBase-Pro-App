import React, { useState, useCallback, useMemo } from "react";
import { StyleSheet, View, ScrollView, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInRight, FadeOutLeft, SlideInRight, SlideOutLeft } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type WizardStep = 
  | "entry"
  | "property_type"
  | "year_built"
  | "square_footage"
  | "bedrooms"
  | "hvac_type"
  | "hvac_age"
  | "water_heater"
  | "roof_age"
  | "yard_size"
  | "exterior_features"
  | "neighborhood"
  | "climate"
  | "local_risks"
  | "diy_level"
  | "service_level"
  | "budget_goal"
  | "results";

interface WizardData {
  propertyType: string;
  yearBuilt: string;
  squareFootage: string;
  bedrooms: string;
  hvacType: string;
  hvacAge: string;
  waterHeaterType: string;
  roofAge: string;
  yardSize: string;
  exteriorFeatures: string[];
  neighborhood: string;
  climate: string;
  localRisks: string[];
  diyLevel: string;
  serviceLevel: string;
  budgetGoal: string;
}

interface MaintenanceTask {
  id: string;
  name: string;
  category: string;
  frequency: string;
  costRange: string;
  dueMonth: string;
  severity: "low" | "medium" | "high";
}

const WIZARD_STEPS: WizardStep[] = [
  "entry",
  "property_type",
  "year_built",
  "square_footage",
  "bedrooms",
  "hvac_type",
  "hvac_age",
  "water_heater",
  "roof_age",
  "yard_size",
  "exterior_features",
  "neighborhood",
  "climate",
  "local_risks",
  "diy_level",
  "service_level",
  "budget_goal",
  "results",
];

const PROPERTY_TYPES = [
  { id: "single_family", label: "Single Family", icon: "home" },
  { id: "townhome", label: "Townhome", icon: "grid" },
  { id: "condo", label: "Condo", icon: "box" },
  { id: "duplex", label: "Duplex", icon: "copy" },
];

const HVAC_TYPES = [
  { id: "central_ac", label: "Central AC" },
  { id: "heat_pump", label: "Heat Pump" },
  { id: "split_system", label: "Split System" },
  { id: "window_units", label: "Window Units" },
  { id: "none", label: "None" },
];

const WATER_HEATER_TYPES = [
  { id: "tank_gas", label: "Tank (Gas)" },
  { id: "tank_electric", label: "Tank (Electric)" },
  { id: "tankless", label: "Tankless" },
  { id: "hybrid", label: "Hybrid" },
];

const YARD_SIZES = [
  { id: "none", label: "No Yard" },
  { id: "small", label: "Small (< 1/8 acre)" },
  { id: "medium", label: "Medium (1/8 - 1/4 acre)" },
  { id: "large", label: "Large (> 1/4 acre)" },
];

const EXTERIOR_FEATURES = [
  { id: "trees_near_roof", label: "Trees Near Roof", icon: "wind" },
  { id: "basement", label: "Basement", icon: "layers" },
  { id: "pool", label: "Pool/Spa", icon: "droplet" },
  { id: "garage", label: "Garage", icon: "truck" },
  { id: "deck_patio", label: "Deck/Patio", icon: "sun" },
  { id: "sprinklers", label: "Sprinklers", icon: "cloud-rain" },
];

const NEIGHBORHOODS = [
  { id: "urban", label: "Urban", icon: "map" },
  { id: "suburban", label: "Suburban", icon: "home" },
  { id: "rural", label: "Rural", icon: "compass" },
];

const CLIMATES = [
  { id: "hot", label: "Hot", icon: "sun" },
  { id: "cold", label: "Cold", icon: "cloud-snow" },
  { id: "mixed", label: "Mixed", icon: "cloud" },
];

const LOCAL_RISKS = [
  { id: "hail", label: "Hail" },
  { id: "flooding", label: "Flooding" },
  { id: "humidity", label: "High Humidity" },
  { id: "freezing", label: "Freezing" },
  { id: "wildfire", label: "Wildfire" },
  { id: "earthquake", label: "Earthquake" },
];

const DIY_LEVELS = [
  { id: "low", label: "Low", description: "I prefer hiring professionals" },
  { id: "medium", label: "Medium", description: "I can handle basic tasks" },
  { id: "high", label: "High", description: "I enjoy DIY projects" },
];

const SERVICE_LEVELS = [
  { id: "lean", label: "Lean", description: "Essential maintenance only" },
  { id: "standard", label: "Standard", description: "Recommended maintenance" },
  { id: "proactive", label: "Proactive", description: "Comprehensive protection" },
];

const BUDGET_GOALS = [
  { id: "minimize", label: "Minimize Costs", description: "Keep spending low" },
  { id: "balanced", label: "Balanced", description: "Good value for money" },
  { id: "protect", label: "Protect Investment", description: "Maximize resale value" },
];

const MOCK_TASKS: MaintenanceTask[] = [
  { id: "1", name: "HVAC Filter Change", category: "HVAC", frequency: "Monthly", costRange: "$15-30", dueMonth: "Feb", severity: "low" },
  { id: "2", name: "Gutter Cleaning", category: "Exterior", frequency: "Twice yearly", costRange: "$100-200", dueMonth: "Mar", severity: "medium" },
  { id: "3", name: "HVAC Tune-up", category: "HVAC", frequency: "Annually", costRange: "$150-300", dueMonth: "Apr", severity: "high" },
  { id: "4", name: "Water Heater Flush", category: "Plumbing", frequency: "Annually", costRange: "$100-150", dueMonth: "May", severity: "medium" },
  { id: "5", name: "Roof Inspection", category: "Roofing", frequency: "Annually", costRange: "$200-400", dueMonth: "Jun", severity: "high" },
  { id: "6", name: "Pest Control", category: "Pest", frequency: "Quarterly", costRange: "$80-150", dueMonth: "Jul", severity: "medium" },
];

const MOCK_TIPS = [
  {
    id: "1",
    title: "Change HVAC filters monthly",
    description: "Dirty filters make your system work harder, increasing energy bills by up to 15%.",
    savings: "$180/year",
  },
  {
    id: "2",
    title: "Schedule off-peak maintenance",
    description: "Book HVAC tune-ups in spring/fall when contractors are less busy.",
    savings: "$50-100/service",
  },
  {
    id: "3",
    title: "Clean gutters before rainy season",
    description: "Prevents water damage to foundation and roof - one of the costliest repairs.",
    savings: "$500-5000 avoided",
  },
  {
    id: "4",
    title: "Inspect roof after major storms",
    description: "Early detection of damage prevents small issues from becoming major repairs.",
    savings: "$1000+ avoided",
  },
];

export default function SurvivalKitScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();

  const [currentStep, setCurrentStep] = useState<WizardStep>("entry");
  const [wizardData, setWizardData] = useState<WizardData>({
    propertyType: "",
    yearBuilt: "",
    squareFootage: "",
    bedrooms: "",
    hvacType: "",
    hvacAge: "",
    waterHeaterType: "",
    roofAge: "",
    yardSize: "",
    exteriorFeatures: [],
    neighborhood: "",
    climate: "",
    localRisks: [],
    diyLevel: "",
    serviceLevel: "",
    budgetGoal: "",
  });
  const [resultsTab, setResultsTab] = useState<"summary" | "plan" | "costs" | "tips" | "export">("summary");

  const currentStepIndex = WIZARD_STEPS.indexOf(currentStep);
  const totalSteps = WIZARD_STEPS.length - 2;
  const progressPercent = currentStep === "entry" || currentStep === "results" 
    ? 0 
    : Math.round(((currentStepIndex - 1) / (totalSteps - 1)) * 100);

  const goToNextStep = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < WIZARD_STEPS.length) {
      setCurrentStep(WIZARD_STEPS[nextIndex]);
    }
  }, [currentStepIndex]);

  const goToPrevStep = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(WIZARD_STEPS[prevIndex]);
    }
  }, [currentStepIndex]);

  const updateData = useCallback((key: keyof WizardData, value: any) => {
    setWizardData((prev) => ({ ...prev, [key]: value }));
    if (!Array.isArray(value)) {
      setTimeout(goToNextStep, 300);
    }
  }, [goToNextStep]);

  const toggleArrayItem = useCallback((key: "exteriorFeatures" | "localRisks", itemId: string) => {
    setWizardData((prev) => ({
      ...prev,
      [key]: prev[key].includes(itemId)
        ? prev[key].filter((id) => id !== itemId)
        : [...prev[key], itemId],
    }));
  }, []);

  const estimatedCost = useMemo(() => {
    let base = 2500;
    if (wizardData.squareFootage === "large") base += 800;
    if (wizardData.hvacAge && parseInt(wizardData.hvacAge) > 10) base += 500;
    if (wizardData.roofAge && parseInt(wizardData.roofAge) > 15) base += 600;
    if (wizardData.exteriorFeatures.includes("pool")) base += 1200;
    if (wizardData.serviceLevel === "proactive") base += 400;
    if (wizardData.serviceLevel === "lean") base -= 600;
    return { min: Math.round(base * 0.8), max: Math.round(base * 1.2) };
  }, [wizardData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const renderOptionButton = (
    id: string,
    label: string,
    selected: boolean,
    onPress: () => void,
    icon?: keyof typeof Feather.glyphMap,
    description?: string
  ) => (
    <Pressable
      key={id}
      onPress={onPress}
      style={[
        styles.optionButton,
        {
          backgroundColor: selected ? Colors.accentLight : theme.cardBackground,
          borderColor: selected ? Colors.accent : "transparent",
        },
      ]}
    >
      {icon ? (
        <View style={[styles.optionIcon, { backgroundColor: selected ? Colors.accent : theme.backgroundTertiary }]}>
          <Feather name={icon} size={20} color={selected ? "#FFFFFF" : theme.textSecondary} />
        </View>
      ) : null}
      <View style={styles.optionContent}>
        <ThemedText style={[styles.optionLabel, selected && { color: Colors.accent }]}>
          {label}
        </ThemedText>
        {description ? (
          <ThemedText style={[styles.optionDescription, { color: theme.textSecondary }]}>
            {description}
          </ThemedText>
        ) : null}
      </View>
      {selected ? (
        <Feather name="check-circle" size={20} color={Colors.accent} />
      ) : null}
    </Pressable>
  );

  const renderChipButton = (
    id: string,
    label: string,
    selected: boolean,
    onPress: () => void
  ) => (
    <Pressable
      key={id}
      onPress={onPress}
      style={[
        styles.chipButton,
        {
          backgroundColor: selected ? Colors.accentLight : theme.cardBackground,
          borderColor: selected ? Colors.accent : theme.separator,
        },
      ]}
    >
      <ThemedText style={[styles.chipLabel, selected && { color: Colors.accent }]}>
        {label}
      </ThemedText>
    </Pressable>
  );

  const renderEntryScreen = () => (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.entryContainer}>
      <GlassCard style={styles.entryCard}>
        <View style={[styles.entryIcon, { backgroundColor: Colors.accentLight }]}>
          <Feather name="shield" size={40} color={Colors.accent} />
        </View>
        <ThemedText style={styles.entryTitle}>Survival Kit</ThemedText>
        <ThemedText style={[styles.entrySubtitle, { color: theme.textSecondary }]}>
          Build your personalized maintenance plan and predict yearly upkeep costs.
        </ThemedText>

        <View style={styles.entryFeatures}>
          <View style={styles.entryFeature}>
            <Feather name="dollar-sign" size={18} color={Colors.accent} />
            <ThemedText style={styles.entryFeatureText}>Estimated yearly costs</ThemedText>
          </View>
          <View style={styles.entryFeature}>
            <Feather name="calendar" size={18} color={Colors.accent} />
            <ThemedText style={styles.entryFeatureText}>Personalized task schedule</ThemedText>
          </View>
          <View style={styles.entryFeature}>
            <Feather name="trending-down" size={18} color={Colors.accent} />
            <ThemedText style={styles.entryFeatureText}>Tips to reduce costs</ThemedText>
          </View>
        </View>

        <PrimaryButton onPress={goToNextStep} style={styles.startButton}>
          Start
        </PrimaryButton>
        <Pressable onPress={goToNextStep} style={styles.secondaryButton}>
          <ThemedText style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>
            Use my saved home details
          </ThemedText>
        </Pressable>
      </GlassCard>
    </Animated.View>
  );

  const renderWizardStep = () => {
    const stepContent = (() => {
      switch (currentStep) {
        case "property_type":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>What type of property is this?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                Different property types have different maintenance needs.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {PROPERTY_TYPES.map((type) =>
                  renderOptionButton(
                    type.id,
                    type.label,
                    wizardData.propertyType === type.id,
                    () => updateData("propertyType", type.id),
                    type.icon as keyof typeof Feather.glyphMap
                  )
                )}
              </View>
            </>
          );

        case "year_built":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>When was your home built?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                Older homes often need more maintenance attention.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {["Before 1970", "1970-1990", "1990-2010", "After 2010"].map((range) =>
                  renderOptionButton(
                    range,
                    range,
                    wizardData.yearBuilt === range,
                    () => updateData("yearBuilt", range)
                  )
                )}
              </View>
            </>
          );

        case "square_footage":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>How large is your home?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                Larger homes typically have higher maintenance costs.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {[
                  { id: "small", label: "Under 1,500 sq ft" },
                  { id: "medium", label: "1,500-2,500 sq ft" },
                  { id: "large", label: "2,500-4,000 sq ft" },
                  { id: "xlarge", label: "Over 4,000 sq ft" },
                ].map((size) =>
                  renderOptionButton(
                    size.id,
                    size.label,
                    wizardData.squareFootage === size.id,
                    () => updateData("squareFootage", size.id)
                  )
                )}
              </View>
            </>
          );

        case "bedrooms":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>How many bedrooms?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                Helps estimate plumbing and HVAC requirements.
              </ThemedText>
              <View style={styles.chipGrid}>
                {["1", "2", "3", "4", "5+"].map((num) =>
                  renderChipButton(
                    num,
                    num,
                    wizardData.bedrooms === num,
                    () => updateData("bedrooms", num)
                  )
                )}
              </View>
            </>
          );

        case "hvac_type":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>What type of HVAC system?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                HVAC is typically the largest maintenance expense.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {HVAC_TYPES.map((type) =>
                  renderOptionButton(
                    type.id,
                    type.label,
                    wizardData.hvacType === type.id,
                    () => updateData("hvacType", type.id)
                  )
                )}
              </View>
            </>
          );

        case "hvac_age":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>How old is your HVAC system?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                Systems over 10 years old need more frequent service.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {["0-5 years", "5-10 years", "10-15 years", "15+ years", "Unknown"].map((age) =>
                  renderOptionButton(
                    age,
                    age,
                    wizardData.hvacAge === age,
                    () => updateData("hvacAge", age)
                  )
                )}
              </View>
            </>
          );

        case "water_heater":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>What type of water heater?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                Different types have different maintenance needs and lifespans.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {WATER_HEATER_TYPES.map((type) =>
                  renderOptionButton(
                    type.id,
                    type.label,
                    wizardData.waterHeaterType === type.id,
                    () => updateData("waterHeaterType", type.id)
                  )
                )}
              </View>
            </>
          );

        case "roof_age":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>How old is your roof?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                Roof replacements are major expenses - plan ahead.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {["0-5 years", "5-10 years", "10-20 years", "20+ years", "Unknown"].map((age) =>
                  renderOptionButton(
                    age,
                    age,
                    wizardData.roofAge === age,
                    () => updateData("roofAge", age)
                  )
                )}
              </View>
            </>
          );

        case "yard_size":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>What is your yard size?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                Landscaping and lawn care add to maintenance costs.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {YARD_SIZES.map((size) =>
                  renderOptionButton(
                    size.id,
                    size.label,
                    wizardData.yardSize === size.id,
                    () => updateData("yardSize", size.id)
                  )
                )}
              </View>
            </>
          );

        case "exterior_features":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>Select exterior features</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                Select all that apply. Each adds to maintenance needs.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {EXTERIOR_FEATURES.map((feature) =>
                  renderOptionButton(
                    feature.id,
                    feature.label,
                    wizardData.exteriorFeatures.includes(feature.id),
                    () => toggleArrayItem("exteriorFeatures", feature.id),
                    feature.icon as keyof typeof Feather.glyphMap
                  )
                )}
              </View>
              <PrimaryButton onPress={goToNextStep} style={styles.continueButton}>
                Continue
              </PrimaryButton>
            </>
          );

        case "neighborhood":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>What type of neighborhood?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                Location affects service availability and pricing.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {NEIGHBORHOODS.map((type) =>
                  renderOptionButton(
                    type.id,
                    type.label,
                    wizardData.neighborhood === type.id,
                    () => updateData("neighborhood", type.id),
                    type.icon as keyof typeof Feather.glyphMap
                  )
                )}
              </View>
            </>
          );

        case "climate":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>What is your climate zone?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                Climate affects HVAC usage and exterior wear.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {CLIMATES.map((type) =>
                  renderOptionButton(
                    type.id,
                    type.label,
                    wizardData.climate === type.id,
                    () => updateData("climate", type.id),
                    type.icon as keyof typeof Feather.glyphMap
                  )
                )}
              </View>
            </>
          );

        case "local_risks":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>Any local weather risks?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                Select all that apply to your area.
              </ThemedText>
              <View style={styles.chipGrid}>
                {LOCAL_RISKS.map((risk) =>
                  renderChipButton(
                    risk.id,
                    risk.label,
                    wizardData.localRisks.includes(risk.id),
                    () => toggleArrayItem("localRisks", risk.id)
                  )
                )}
              </View>
              <PrimaryButton onPress={goToNextStep} style={styles.continueButton}>
                Continue
              </PrimaryButton>
            </>
          );

        case "diy_level":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>Your DIY comfort level?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                This helps us suggest which tasks you can handle yourself.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {DIY_LEVELS.map((level) =>
                  renderOptionButton(
                    level.id,
                    level.label,
                    wizardData.diyLevel === level.id,
                    () => updateData("diyLevel", level.id),
                    undefined,
                    level.description
                  )
                )}
              </View>
            </>
          );

        case "service_level":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>Preferred service level?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                Choose how comprehensive your maintenance plan should be.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {SERVICE_LEVELS.map((level) =>
                  renderOptionButton(
                    level.id,
                    level.label,
                    wizardData.serviceLevel === level.id,
                    () => updateData("serviceLevel", level.id),
                    undefined,
                    level.description
                  )
                )}
              </View>
            </>
          );

        case "budget_goal":
          return (
            <>
              <ThemedText style={styles.stepQuestion}>What is your budget goal?</ThemedText>
              <ThemedText style={[styles.stepHelper, { color: theme.textSecondary }]}>
                This helps prioritize tasks in your plan.
              </ThemedText>
              <View style={styles.optionsGrid}>
                {BUDGET_GOALS.map((goal) =>
                  renderOptionButton(
                    goal.id,
                    goal.label,
                    wizardData.budgetGoal === goal.id,
                    () => updateData("budgetGoal", goal.id),
                    undefined,
                    goal.description
                  )
                )}
              </View>
            </>
          );

        default:
          return null;
      }
    })();

    if (currentStep === "entry" || currentStep === "results") return null;

    return (
      <Animated.View
        key={currentStep}
        entering={SlideInRight.duration(300)}
        exiting={SlideOutLeft.duration(300)}
        style={styles.stepContainer}
      >
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.backgroundTertiary }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercent}%`, backgroundColor: Colors.accent },
              ]}
            />
          </View>
          <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
            {currentStepIndex} of {totalSteps}
          </ThemedText>
        </View>

        {stepContent}

        {currentStepIndex > 1 ? (
          <Pressable onPress={goToPrevStep} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color={theme.textSecondary} />
            <ThemedText style={[styles.backButtonText, { color: theme.textSecondary }]}>
              Back
            </ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>
    );
  };

  const renderResults = () => {
    if (currentStep !== "results") return null;

    return (
      <Animated.View entering={FadeInDown.duration(400)} style={styles.resultsContainer}>
        <View style={styles.resultsTabs}>
          {(["summary", "plan", "costs", "tips", "export"] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setResultsTab(tab)}
              style={[
                styles.resultsTab,
                resultsTab === tab && { borderBottomColor: Colors.accent, borderBottomWidth: 2 },
              ]}
            >
              <ThemedText
                style={[
                  styles.resultsTabText,
                  { color: resultsTab === tab ? Colors.accent : theme.textSecondary },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {resultsTab === "summary" ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <GlassCard style={styles.summaryCard}>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Estimated Yearly Maintenance
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {formatCurrency(estimatedCost.min)} - {formatCurrency(estimatedCost.max)}
              </ThemedText>
              
              <View style={styles.costDrivers}>
                <ThemedText style={styles.driversTitle}>Top Cost Drivers</ThemedText>
                <View style={styles.driverChips}>
                  <View style={[styles.driverChip, { backgroundColor: theme.backgroundTertiary }]}>
                    <ThemedText style={styles.driverChipText}>HVAC</ThemedText>
                  </View>
                  <View style={[styles.driverChip, { backgroundColor: theme.backgroundTertiary }]}>
                    <ThemedText style={styles.driverChipText}>Roof Age</ThemedText>
                  </View>
                  <View style={[styles.driverChip, { backgroundColor: theme.backgroundTertiary }]}>
                    <ThemedText style={styles.driverChipText}>Lawn Care</ThemedText>
                  </View>
                </View>
              </View>
            </GlassCard>

            <GlassCard style={styles.nextDueCard}>
              <View style={styles.nextDueHeader}>
                <View style={[styles.nextDueIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="alert-circle" size={20} color={Colors.accent} />
                </View>
                <View>
                  <ThemedText style={styles.nextDueTitle}>Next Due</ThemedText>
                  <ThemedText style={[styles.nextDueDate, { color: theme.textSecondary }]}>
                    February 2026
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={styles.nextDueTask}>HVAC Filter Change</ThemedText>
              <PrimaryButton
                onPress={() => navigation.navigate("SmartIntake", { prefillCategory: "HVAC" })}
                style={styles.bookButton}
              >
                Book Now
              </PrimaryButton>
            </GlassCard>

            <GlassCard style={styles.savingsCard}>
              <Feather name="trending-down" size={24} color={Colors.accent} />
              <ThemedText style={styles.savingsTitle}>Potential Savings</ThemedText>
              <ThemedText style={[styles.savingsValue, { color: Colors.accent }]}>
                {formatCurrency(Math.round(estimatedCost.max * 0.2))} - {formatCurrency(Math.round(estimatedCost.max * 0.35))}
              </ThemedText>
              <ThemedText style={[styles.savingsSubtext, { color: theme.textSecondary }]}>
                with proactive maintenance
              </ThemedText>
            </GlassCard>

            <GlassCard style={styles.motivationCard}>
              <Feather name="award" size={24} color={Colors.accent} />
              <ThemedText style={[styles.motivationText, { color: theme.textSecondary }]}>
                You are ahead of 82% of homeowners by creating a maintenance plan!
              </ThemedText>
            </GlassCard>
          </ScrollView>
        ) : null}

        {resultsTab === "plan" ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {MOCK_TASKS.map((task) => (
              <GlassCard key={task.id} style={styles.taskCard}>
                <View style={styles.taskHeader}>
                  <View style={styles.taskInfo}>
                    <ThemedText style={styles.taskName}>{task.name}</ThemedText>
                    <ThemedText style={[styles.taskCategory, { color: theme.textSecondary }]}>
                      {task.category} - {task.frequency}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.severityBadge,
                      {
                        backgroundColor:
                          task.severity === "high"
                            ? Colors.errorLight
                            : task.severity === "medium"
                            ? Colors.warningLight
                            : Colors.accentLight,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.severityText,
                        {
                          color:
                            task.severity === "high"
                              ? Colors.error
                              : task.severity === "medium"
                              ? Colors.warning
                              : Colors.accent,
                        },
                      ]}
                    >
                      {task.dueMonth}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.taskFooter}>
                  <ThemedText style={[styles.taskCost, { color: theme.textSecondary }]}>
                    {task.costRange}
                  </ThemedText>
                  <Pressable
                    onPress={() => navigation.navigate("SmartIntake", { prefillCategory: task.category })}
                    style={styles.taskAction}
                  >
                    <ThemedText style={[styles.taskActionText, { color: Colors.accent }]}>
                      Book Now
                    </ThemedText>
                  </Pressable>
                </View>
              </GlassCard>
            ))}
          </ScrollView>
        ) : null}

        {resultsTab === "costs" ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <GlassCard style={styles.costsCard}>
              <ThemedText style={styles.costsTitle}>Cost Breakdown by Category</ThemedText>
              {[
                { category: "HVAC", amount: 650, color: "#3B82F6" },
                { category: "Plumbing", amount: 350, color: "#8B5CF6" },
                { category: "Electrical", amount: 200, color: "#F59E0B" },
                { category: "Roof", amount: 400, color: Colors.accent },
                { category: "Lawn", amount: 480, color: "#EC4899" },
                { category: "Pest Control", amount: 320, color: "#6B7280" },
              ].map((item) => (
                <View key={item.category} style={styles.costRow}>
                  <View style={[styles.costDot, { backgroundColor: item.color }]} />
                  <ThemedText style={styles.costCategory}>{item.category}</ThemedText>
                  <ThemedText style={styles.costAmount}>{formatCurrency(item.amount)}</ThemedText>
                </View>
              ))}
            </GlassCard>

            <GlassCard style={styles.factorsCard}>
              <ThemedText style={styles.factorsTitle}>Factors Affecting Your Estimate</ThemedText>
              <View style={styles.factorsList}>
                <View style={styles.factorRow}>
                  <Feather name="home" size={16} color={theme.textSecondary} />
                  <ThemedText style={[styles.factorText, { color: theme.textSecondary }]}>
                    {wizardData.propertyType || "Single Family"} home
                  </ThemedText>
                </View>
                <View style={styles.factorRow}>
                  <Feather name="map-pin" size={16} color={theme.textSecondary} />
                  <ThemedText style={[styles.factorText, { color: theme.textSecondary }]}>
                    {wizardData.neighborhood || "Suburban"} neighborhood
                  </ThemedText>
                </View>
                <View style={styles.factorRow}>
                  <Feather name="thermometer" size={16} color={theme.textSecondary} />
                  <ThemedText style={[styles.factorText, { color: theme.textSecondary }]}>
                    {wizardData.climate || "Mixed"} climate zone
                  </ThemedText>
                </View>
              </View>
            </GlassCard>
          </ScrollView>
        ) : null}

        {resultsTab === "tips" ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {MOCK_TIPS.map((tip) => (
              <GlassCard key={tip.id} style={styles.tipCard}>
                <View style={styles.tipHeader}>
                  <View style={[styles.tipIcon, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="zap" size={18} color={Colors.accent} />
                  </View>
                  <ThemedText style={[styles.tipSavings, { color: Colors.accent }]}>
                    Save {tip.savings}
                  </ThemedText>
                </View>
                <ThemedText style={styles.tipTitle}>{tip.title}</ThemedText>
                <ThemedText style={[styles.tipDescription, { color: theme.textSecondary }]}>
                  {tip.description}
                </ThemedText>
              </GlassCard>
            ))}
          </ScrollView>
        ) : null}

        {resultsTab === "export" ? (
          <View style={styles.exportContainer}>
            <GlassCard style={styles.exportCard}>
              <ThemedText style={styles.exportTitle}>Export Your Plan</ThemedText>
              <ThemedText style={[styles.exportDescription, { color: theme.textSecondary }]}>
                Save your maintenance plan for reference or share with family members.
              </ThemedText>
              <View style={styles.exportButtons}>
                <Pressable style={[styles.exportButton, { backgroundColor: theme.cardBackground }]}>
                  <Feather name="file-text" size={24} color={Colors.accent} />
                  <ThemedText style={styles.exportButtonText}>PDF</ThemedText>
                </Pressable>
                <Pressable style={[styles.exportButton, { backgroundColor: theme.cardBackground }]}>
                  <Feather name="table" size={24} color={Colors.accent} />
                  <ThemedText style={styles.exportButtonText}>CSV</ThemedText>
                </Pressable>
                <Pressable style={[styles.exportButton, { backgroundColor: theme.cardBackground }]}>
                  <Feather name="share-2" size={24} color={Colors.accent} />
                  <ThemedText style={styles.exportButtonText}>Share</ThemedText>
                </Pressable>
              </View>
            </GlassCard>

            <PrimaryButton onPress={() => {}} style={styles.addToPlanButton}>
              Add Plan to HomeBase
            </PrimaryButton>
          </View>
        ) : null}
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl + 88,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {currentStep === "entry" ? renderEntryScreen() : null}
        {currentStep !== "entry" && currentStep !== "results" ? renderWizardStep() : null}
        {currentStep === "results" ? renderResults() : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.screenPadding,
  },
  entryContainer: {
    flex: 1,
    justifyContent: "center",
  },
  entryCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  entryIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  entryTitle: {
    ...Typography.largeTitle,
    marginBottom: Spacing.sm,
  },
  entrySubtitle: {
    ...Typography.subhead,
    textAlign: "center",
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  entryFeatures: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  entryFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  entryFeatureText: {
    ...Typography.body,
  },
  startButton: {
    minWidth: 200,
    marginBottom: Spacing.md,
  },
  secondaryButton: {
    padding: Spacing.sm,
  },
  secondaryButtonText: {
    ...Typography.subhead,
  },
  stepContainer: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    ...Typography.caption1,
  },
  stepQuestion: {
    ...Typography.title2,
    marginBottom: Spacing.sm,
  },
  stepHelper: {
    ...Typography.subhead,
    marginBottom: Spacing.xl,
  },
  optionsGrid: {
    gap: Spacing.sm,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.md,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    ...Typography.body,
    fontWeight: "600",
  },
  optionDescription: {
    ...Typography.caption1,
    marginTop: 2,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chipButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipLabel: {
    ...Typography.body,
  },
  continueButton: {
    marginTop: Spacing.xl,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xl,
    alignSelf: "flex-start",
  },
  backButtonText: {
    ...Typography.subhead,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsTabs: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  resultsTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  resultsTabText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  summaryCard: {
    marginBottom: Spacing.md,
  },
  summaryLabel: {
    ...Typography.caption1,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: Spacing.lg,
  },
  costDrivers: {
    marginTop: Spacing.md,
  },
  driversTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  driverChips: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  driverChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
  },
  driverChipText: {
    ...Typography.caption1,
  },
  nextDueCard: {
    marginBottom: Spacing.md,
  },
  nextDueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  nextDueIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  nextDueTitle: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  nextDueDate: {
    ...Typography.caption1,
  },
  nextDueTask: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  bookButton: {
    alignSelf: "flex-start",
  },
  savingsCard: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  savingsTitle: {
    ...Typography.subhead,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  savingsValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  savingsSubtext: {
    ...Typography.caption1,
    marginTop: 2,
  },
  motivationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  motivationText: {
    ...Typography.subhead,
    flex: 1,
  },
  taskCard: {
    marginBottom: Spacing.sm,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  taskInfo: {
    flex: 1,
  },
  taskName: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: 2,
  },
  taskCategory: {
    ...Typography.caption1,
  },
  severityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
  },
  severityText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  taskFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  taskCost: {
    ...Typography.subhead,
  },
  taskAction: {
    padding: Spacing.xs,
  },
  taskActionText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  costsCard: {
    marginBottom: Spacing.md,
  },
  costsTitle: {
    ...Typography.headline,
    marginBottom: Spacing.lg,
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  costDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  costCategory: {
    ...Typography.body,
    flex: 1,
  },
  costAmount: {
    ...Typography.body,
    fontWeight: "600",
  },
  factorsCard: {
    marginBottom: Spacing.md,
  },
  factorsTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  factorsList: {
    gap: Spacing.sm,
  },
  factorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  factorText: {
    ...Typography.subhead,
  },
  tipCard: {
    marginBottom: Spacing.sm,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tipSavings: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  tipTitle: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  tipDescription: {
    ...Typography.subhead,
    lineHeight: 20,
  },
  exportContainer: {
    flex: 1,
  },
  exportCard: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  exportTitle: {
    ...Typography.headline,
    marginBottom: Spacing.sm,
  },
  exportDescription: {
    ...Typography.subhead,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  exportButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  exportButton: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  exportButtonText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  addToPlanButton: {
    alignSelf: "center",
    minWidth: 200,
  },
});
