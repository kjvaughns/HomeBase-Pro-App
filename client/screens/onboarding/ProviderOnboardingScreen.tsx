import React, { useState, useRef } from "react";
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

type Props = NativeStackScreenProps<RootStackParamList, "ProviderOnboarding">;

const STEPS = [
  {
    id: "welcome",
    title: "Grow Your Business",
    subtitle: "HomeBase helps service providers get more clients and get paid faster",
    icon: "trending-up" as const,
  },
  {
    id: "services",
    title: "What services do you offer?",
    subtitle: "Select the categories that best describe your work",
    icon: "tool" as const,
  },
  {
    id: "features",
    title: "Powerful Tools Await",
    subtitle: "Everything you need to run your service business professionally",
    icon: "zap" as const,
  },
];

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

const FEATURES = [
  {
    icon: "link" as const,
    title: "Smart Booking Links",
    description: "Share custom booking pages to capture leads 24/7",
  },
  {
    icon: "users" as const,
    title: "Client CRM",
    description: "Manage all your clients, jobs, and history in one place",
  },
  {
    icon: "dollar-sign" as const,
    title: "Easy Invoicing",
    description: "Create and send professional invoices in seconds",
  },
  {
    icon: "credit-card" as const,
    title: "Get Paid Faster",
    description: "Accept payments directly through Stripe Connect",
  },
  {
    icon: "cpu" as const,
    title: "AI Business Assistant",
    description: "Get help with quotes, emails, and business decisions",
  },
  {
    icon: "bar-chart-2" as const,
    title: "Analytics Dashboard",
    description: "Track revenue, jobs, and growth metrics",
  },
];

export default function ProviderOnboardingScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { setHasCompletedFirstLaunch } = useOnboardingStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

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

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const step = STEPS[currentStep];

  const renderStepContent = () => {
    switch (step.id) {
      case "welcome":
        return (
          <View style={styles.welcomeContent}>
            <View style={[styles.welcomeIcon, { backgroundColor: Colors.accent }]}>
              <Feather name="briefcase" size={64} color="#FFFFFF" />
            </View>
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText type="h2" style={{ color: Colors.accent }}>
                  1000+
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Active Providers
                </ThemedText>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText type="h2" style={{ color: Colors.accent }}>
                  $2M+
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Paid to Pros
                </ThemedText>
              </View>
            </View>
            <View style={styles.benefitsList}>
              <BenefitItem icon="check-circle" text="No monthly fees to get started" />
              <BenefitItem icon="check-circle" text="Keep more of what you earn" />
              <BenefitItem icon="check-circle" text="Professional tools at your fingertips" />
            </View>
          </View>
        );

      case "services":
        return (
          <View style={styles.servicesContent}>
            <View style={styles.servicesGrid}>
              {SERVICE_CATEGORIES.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => toggleService(category.id)}
                  style={[
                    styles.serviceCard,
                    {
                      backgroundColor: selectedServices.includes(category.id)
                        ? Colors.accent + "15"
                        : theme.backgroundSecondary,
                      borderColor: selectedServices.includes(category.id)
                        ? Colors.accent
                        : "transparent",
                      borderWidth: selectedServices.includes(category.id) ? 2 : 0,
                    },
                  ]}
                >
                  <Feather
                    name={category.icon}
                    size={24}
                    color={
                      selectedServices.includes(category.id) ? Colors.accent : theme.textSecondary
                    }
                  />
                  <ThemedText
                    type="caption"
                    style={{
                      textAlign: "center",
                      color: selectedServices.includes(category.id)
                        ? Colors.accent
                        : theme.text,
                      fontWeight: selectedServices.includes(category.id) ? "600" : "400",
                    }}
                  >
                    {category.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            {selectedServices.length > 0 && (
              <ThemedText
                type="caption"
                style={{ textAlign: "center", color: Colors.accent, marginTop: Spacing.md }}
              >
                {selectedServices.length} service{selectedServices.length > 1 ? "s" : ""} selected
              </ThemedText>
            )}
          </View>
        );

      case "features":
        return (
          <View style={styles.featuresContent}>
            {FEATURES.map((feature, index) => (
              <View
                key={index}
                style={[styles.featureCard, { backgroundColor: theme.backgroundSecondary }]}
              >
                <View style={[styles.featureIcon, { backgroundColor: Colors.accent + "15" }]}>
                  <Feather name={feature.icon} size={20} color={Colors.accent} />
                </View>
                <View style={styles.featureText}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {feature.title}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {feature.description}
                  </ThemedText>
                </View>
              </View>
            ))}
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

function BenefitItem({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  return (
    <View style={styles.benefitItem}>
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
    paddingBottom: Spacing.xl,
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
  statsContainer: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  benefitsList: {
    width: "100%",
    gap: Spacing.md,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  servicesContent: {
    gap: Spacing.md,
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
  },
  serviceCard: {
    width: "30%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  featuresContent: {
    gap: Spacing.sm,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    gap: 2,
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
