import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, View, Animated, ScrollView, Pressable, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useOnboardingStore } from "@/state/onboardingStore";

type Props = NativeStackScreenProps<RootStackParamList, "HomeownerOnboarding">;

const STEPS = [
  {
    id: "priorities",
    title: "What brings you here?",
    subtitle: "Select what matters most to you",
    icon: "target" as const,
  },
  {
    id: "ready",
    title: "You're all set!",
    subtitle: "Your HomeBase is ready. Let's find you some help.",
    icon: "check-circle" as const,
  },
];

const PRIORITY_OPTIONS = [
  { id: "find-pro", label: "Find a trusted pro", icon: "search" as const },
  { id: "manage-home", label: "Track home maintenance", icon: "clipboard" as const },
  { id: "save-money", label: "Save on home services", icon: "dollar-sign" as const },
  { id: "emergency", label: "Need help urgently", icon: "alert-circle" as const },
  { id: "explore", label: "Just exploring", icon: "compass" as const },
];

export default function HomeownerOnboardingScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { setHasCompletedFirstLaunch } = useOnboardingStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTransition = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -30,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      animateTransition(() => setCurrentStep(currentStep + 1));
    } else {
      setHasCompletedFirstLaunch(true);
      navigation.reset({
        index: 0,
        routes: [{ name: "SignUp" }],
      });
    }
  };

  const togglePriority = (id: string) => {
    setSelectedPriorities((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const step = STEPS[currentStep];

  const renderStepContent = () => {
    switch (step.id) {
      case "priorities":
        return (
          <View style={styles.prioritiesContent}>
            {PRIORITY_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => togglePriority(option.id)}
                style={[
                  styles.priorityOption,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: selectedPriorities.includes(option.id)
                      ? Colors.accent
                      : theme.border,
                    borderWidth: selectedPriorities.includes(option.id) ? 2 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.priorityIcon,
                    {
                      backgroundColor: selectedPriorities.includes(option.id)
                        ? Colors.accent + "20"
                        : theme.backgroundDefault,
                    },
                  ]}
                >
                  <Feather
                    name={option.icon}
                    size={20}
                    color={
                      selectedPriorities.includes(option.id) ? Colors.accent : theme.textSecondary
                    }
                  />
                </View>
                <ThemedText type="body" style={styles.priorityLabel}>
                  {option.label}
                </ThemedText>
                {selectedPriorities.includes(option.id) && (
                  <Feather name="check" size={20} color={Colors.accent} />
                )}
              </Pressable>
            ))}
          </View>
        );

      case "ready":
        return (
          <View style={styles.readyContent}>
            <View style={[styles.readyIcon, { backgroundColor: Colors.accent }]}>
              <Feather name="check" size={64} color="#FFFFFF" />
            </View>
            <View style={styles.readyFeatures}>
              <ReadyFeature icon="zap" text="AI-powered home assistant" />
              <ReadyFeature icon="tool" text="Survival Kit maintenance planner" />
              <ReadyFeature icon="heart" text="Home Health Score tracker" />
              <ReadyFeature icon="file-text" text="HouseFax property ledger" />
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.progressContainer}>
          {STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                {
                  backgroundColor: index <= currentStep ? Colors.accent : theme.border,
                  width: index === currentStep ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          }}
        >
          <View style={styles.stepHeader}>
            <ThemedText type="h2" style={styles.stepTitle}>
              {step.title}
            </ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              {step.subtitle}
            </ThemedText>
          </View>

          {renderStepContent()}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <PrimaryButton onPress={handleNext} testID="button-next">
          {currentStep === STEPS.length - 1 ? "Create Account" : "Continue"}
        </PrimaryButton>
        {currentStep === 0 && (
          <Pressable
            onPress={() => navigation.navigate("Login")}
            style={styles.loginLink}
          >
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Already have an account?{" "}
            </ThemedText>
            <ThemedText type="body" style={{ color: Colors.accent, fontWeight: "600" }}>
              Sign In
            </ThemedText>
          </Pressable>
        )}
      </View>
    </ThemedView>
  );
}

function WelcomeFeature({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.welcomeFeature}>
      <View style={[styles.welcomeFeatureIcon, { backgroundColor: Colors.accent + "15" }]}>
        <Feather name={icon} size={20} color={Colors.accent} />
      </View>
      <ThemedText type="body" style={styles.welcomeFeatureText}>
        {text}
      </ThemedText>
    </View>
  );
}

function ReadyFeature({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.readyFeature}>
      <Feather name={icon} size={20} color={Colors.accent} />
      <ThemedText type="body">{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.screenPadding,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.md,
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.xl,
  },
  stepHeader: {
    marginBottom: Spacing.xl,
  },
  stepTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    textAlign: "center",
    lineHeight: 22,
  },
  welcomeContent: {
    alignItems: "center",
    gap: Spacing.xl,
  },
  welcomeIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeFeatures: {
    width: "100%",
    gap: Spacing.md,
  },
  welcomeFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  welcomeFeatureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeFeatureText: {
    flex: 1,
  },
  prioritiesContent: {
    gap: Spacing.sm,
  },
  priorityOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  priorityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  priorityLabel: {
    flex: 1,
    fontWeight: "500",
  },
  readyContent: {
    alignItems: "center",
    gap: Spacing.xl,
  },
  readyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  readyFeatures: {
    width: "100%",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  readyFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  footer: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.md,
  },
  loginLink: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
});
