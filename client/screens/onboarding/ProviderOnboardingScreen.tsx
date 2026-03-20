import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Animated,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useOnboardingStore } from "@/state/onboardingStore";

type Props = NativeStackScreenProps<RootStackParamList, "ProviderOnboarding">;

const STEPS = [
  {
    id: "welcome",
    title: "Grow your business\nwith HomeBase",
    subtitle: "Join pros who use HomeBase to find clients, get paid, and stay organized.",
  },
  {
    id: "services",
    title: "What services do\nyou offer?",
    subtitle: "Select all that apply — you can update this later.",
  },
  {
    id: "location",
    title: "Where do you\nwork?",
    subtitle: "Enter your city or service area so homeowners nearby can find you.",
  },
  {
    id: "business",
    title: "Tell us about\nyour business",
    subtitle: "A few quick details to help build your profile.",
  },
  {
    id: "bio",
    title: "What makes you\nstand out?",
    subtitle: "A short intro that appears on your public profile.",
  },
  {
    id: "features",
    title: "Everything you\nneed to succeed",
    subtitle: "Built-in tools that save time and help you win more jobs.",
  },
  {
    id: "ready",
    title: "You're ready\nto get started",
    subtitle: "Create your account to claim your profile and start getting clients.",
  },
];

const SERVICE_CATEGORIES = [
  { id: "plumbing", label: "Plumbing", icon: "droplet" as const },
  { id: "electrical", label: "Electrical", icon: "zap" as const },
  { id: "hvac", label: "HVAC", icon: "wind" as const },
  { id: "cleaning", label: "Cleaning", icon: "home" as const },
  { id: "landscaping", label: "Landscaping", icon: "sun" as const },
  { id: "handyman", label: "Handyman", icon: "tool" as const },
  { id: "roofing", label: "Roofing", icon: "umbrella" as const },
  { id: "painting", label: "Painting", icon: "edit-2" as const },
  { id: "pest", label: "Pest Control", icon: "shield" as const },
  { id: "moving", label: "Moving", icon: "truck" as const },
  { id: "appliance", label: "Appliances", icon: "settings" as const },
  { id: "other", label: "Other", icon: "more-horizontal" as const },
];

const EXPERIENCE_OPTIONS = [
  { id: "1-2", label: "1–2 years" },
  { id: "3-5", label: "3–5 years" },
  { id: "6-10", label: "6–10 years" },
  { id: "10+", label: "10+ years" },
];

const FEATURES = [
  { icon: "link" as const, title: "Smart Booking Links", description: "Capture leads 24/7 with a custom booking page" },
  { icon: "users" as const, title: "Client CRM", description: "All your clients, jobs, and history in one place" },
  { icon: "file-text" as const, title: "Professional Invoicing", description: "Send polished invoices in seconds" },
  { icon: "credit-card" as const, title: "Get Paid Faster", description: "Accept payments via Stripe Connect" },
  { icon: "cpu" as const, title: "AI Business Assistant", description: "Quotes, emails, and decisions — on demand" },
  { icon: "bar-chart-2" as const, title: "Analytics Dashboard", description: "Track revenue, jobs, and growth at a glance" },
];

export default function ProviderOnboardingScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { setHasCompletedFirstLaunch } = useOnboardingStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [experience, setExperience] = useState("");
  const [bio, setBio] = useState("");

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTransition = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: -24, duration: 140, useNativeDriver: false }),
    ]).start(() => {
      callback();
      slideAnim.setValue(24);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.spring(slideAnim, { toValue: 0, tension: 52, friction: 8, useNativeDriver: false }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      animateTransition(() => setCurrentStep((s) => s + 1));
    } else {
      setHasCompletedFirstLaunch(true);
      navigation.reset({ index: 0, routes: [{ name: "SignUp" }] });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      animateTransition(() => setCurrentStep((s) => s - 1));
    }
  };

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  const renderStepContent = () => {
    switch (step.id) {
      case "welcome":
        return (
          <View style={styles.welcomeContent}>
            <View style={[styles.welcomeIconRing, { borderColor: Colors.accent + "30" }]}>
              <View style={[styles.welcomeIconCircle, { backgroundColor: Colors.accent }]}>
                <Feather name="briefcase" size={36} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.statsRow}>
              <StatCard value="10k+" label="Homeowners" />
              <StatCard value="4.9" label="Avg rating" />
              <StatCard value="Free" label="To join" />
            </View>
            <View style={styles.welcomePoints}>
              <WelcomePoint icon="check-circle" text="Build a profile that wins trust" />
              <WelcomePoint icon="check-circle" text="Get booked directly through the app" />
              <WelcomePoint icon="check-circle" text="Manage clients and payments in one place" />
            </View>
          </View>
        );

      case "services":
        return (
          <View style={styles.servicesContent}>
            <View style={styles.servicesGrid}>
              {SERVICE_CATEGORIES.map((cat) => {
                const selected = selectedServices.includes(cat.id);
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => toggleService(cat.id)}
                    style={[
                      styles.serviceCard,
                      {
                        backgroundColor: selected ? Colors.accent + "14" : theme.backgroundSecondary,
                        borderColor: selected ? Colors.accent : "transparent",
                        borderWidth: selected ? 2 : 0,
                      },
                    ]}
                  >
                    <Feather
                      name={cat.icon}
                      size={22}
                      color={selected ? Colors.accent : theme.textSecondary}
                    />
                    <ThemedText
                      style={[
                        styles.serviceLabel,
                        { color: selected ? Colors.accent : theme.text, fontWeight: selected ? "600" : "400" },
                      ]}
                    >
                      {cat.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {selectedServices.length > 0 && (
              <ThemedText style={[styles.selectionNote, { color: Colors.accent }]}>
                {selectedServices.length} service{selectedServices.length !== 1 ? "s" : ""} selected
              </ThemedText>
            )}
          </View>
        );

      case "location":
        return (
          <View style={styles.inputContent}>
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: location ? Colors.accent : theme.border }]}>
              <Feather name="map-pin" size={18} color={location ? Colors.accent : theme.textSecondary} />
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder="City, State  (e.g. Austin, TX)"
                placeholderTextColor={theme.textTertiary}
                value={location}
                onChangeText={setLocation}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
            <ThemedText style={[styles.inputHint, { color: theme.textTertiary }]}>
              You can expand or change your service area anytime.
            </ThemedText>
          </View>
        );

      case "business":
        return (
          <View style={styles.inputContent}>
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: businessName ? Colors.accent : theme.border }]}>
              <Feather name="briefcase" size={18} color={businessName ? Colors.accent : theme.textSecondary} />
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder="Business name (or your name)"
                placeholderTextColor={theme.textTertiary}
                value={businessName}
                onChangeText={setBusinessName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Years of experience
            </ThemedText>
            <View style={styles.experienceRow}>
              {EXPERIENCE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => setExperience(opt.id)}
                  style={[
                    styles.experienceChip,
                    {
                      backgroundColor: experience === opt.id ? Colors.accent + "14" : theme.backgroundSecondary,
                      borderColor: experience === opt.id ? Colors.accent : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.experienceLabel,
                      { color: experience === opt.id ? Colors.accent : theme.textSecondary, fontWeight: experience === opt.id ? "600" : "400" },
                    ]}
                  >
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        );

      case "bio":
        return (
          <View style={styles.inputContent}>
            <View
              style={[
                styles.bioWrapper,
                { backgroundColor: theme.backgroundSecondary, borderColor: bio ? Colors.accent : theme.border },
              ]}
            >
              <TextInput
                style={[styles.bioInput, { color: theme.text }]}
                placeholder="Ex: Licensed plumber with 8 years of experience. Known for same-day service and honest pricing."
                placeholderTextColor={theme.textTertiary}
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, 200))}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                returnKeyType="done"
              />
            </View>
            <ThemedText style={[styles.inputHint, { color: theme.textTertiary }]}>
              {bio.length}/200 characters
            </ThemedText>
          </View>
        );

      case "features":
        return (
          <View style={styles.featuresContent}>
            {FEATURES.map((feat, i) => (
              <View key={i} style={[styles.featureRow, { backgroundColor: theme.backgroundSecondary }]}>
                <View style={[styles.featureIcon, { backgroundColor: Colors.accent + "15" }]}>
                  <Feather name={feat.icon} size={18} color={Colors.accent} />
                </View>
                <View style={styles.featureText}>
                  <ThemedText style={styles.featureTitle}>{feat.title}</ThemedText>
                  <ThemedText style={[styles.featureDesc, { color: theme.textSecondary }]}>
                    {feat.description}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        );

      case "ready":
        return (
          <View style={styles.readyContent}>
            <View style={[styles.readyIconRing, { borderColor: Colors.accent + "30" }]}>
              <View style={[styles.readyIconCircle, { backgroundColor: Colors.accent }]}>
                <Feather name="check" size={40} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.readySummary}>
              {selectedServices.length > 0 && (
                <SummaryRow icon="tool" label={`${selectedServices.length} service${selectedServices.length !== 1 ? "s" : ""} selected`} />
              )}
              {location.trim() ? (
                <SummaryRow icon="map-pin" label={location.trim()} />
              ) : null}
              {businessName.trim() ? (
                <SummaryRow icon="briefcase" label={businessName.trim()} />
              ) : null}
              {experience ? (
                <SummaryRow icon="award" label={`${experience} years experience`} />
              ) : null}
              <SummaryRow icon="star" label="Public profile ready to go live" />
              <SummaryRow icon="credit-card" label="Free to create — no card required" />
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable onPress={handleBack} style={styles.backButton} hitSlop={12}>
            {currentStep > 0 ? (
              <Feather name="arrow-left" size={20} color={theme.textSecondary} />
            ) : (
              <View style={{ width: 20 }} />
            )}
          </Pressable>

          <View style={styles.progressRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: i <= currentStep ? Colors.accent : theme.border,
                    width: i === currentStep ? 20 : 6,
                  },
                ]}
              />
            ))}
          </View>

          <Pressable
            onPress={() => navigation.navigate("Login")}
            style={styles.skipButton}
            hitSlop={12}
          >
            <ThemedText style={[styles.skipText, { color: theme.textTertiary }]}>
              Sign in
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
            <View style={styles.stepHeader}>
              <ThemedText style={styles.stepTitle}>{step.title}</ThemedText>
              <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
                {step.subtitle}
              </ThemedText>
            </View>
            {renderStepContent()}
          </Animated.View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <PrimaryButton onPress={handleNext} testID="button-next">
            {isLast ? "Create Account" : "Continue"}
          </PrimaryButton>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }]}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
    </View>
  );
}

function WelcomePoint({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.welcomePoint}>
      <Feather name={icon} size={18} color={Colors.accent} />
      <ThemedText style={[styles.welcomePointText, { color: theme.textSecondary }]}>{text}</ThemedText>
    </View>
  );
}

function SummaryRow({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.summaryRow}>
      <View style={[styles.summaryIcon, { backgroundColor: Colors.accent + "14" }]}>
        <Feather name={icon} size={16} color={Colors.accent} />
      </View>
      <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.sm,
  },
  backButton: {
    width: 32,
    alignItems: "flex-start",
  },
  progressRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  progressDot: {
    height: 6,
    borderRadius: 3,
  },
  skipButton: {
    width: 48,
    alignItems: "flex-end",
  },
  skipText: {
    fontSize: 13,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["2xl"],
  },
  stepHeader: {
    marginBottom: Spacing.xl,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },

  welcomeContent: {
    alignItems: "center",
    gap: Spacing.xl,
  },
  welcomeIconRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.accent,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  welcomePoints: {
    width: "100%",
    gap: Spacing.md,
  },
  welcomePoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  welcomePointText: {
    fontSize: 15,
    flex: 1,
  },

  servicesContent: { gap: Spacing.md },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  serviceCard: {
    width: "30.5%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  serviceLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  selectionNote: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
  },

  inputContent: { gap: Spacing.md },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  inputHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: Spacing.sm,
  },
  experienceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  experienceChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  experienceLabel: {
    fontSize: 14,
  },
  bioWrapper: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    padding: Spacing.md,
    minHeight: 130,
  },
  bioInput: {
    fontSize: 15,
    lineHeight: 22,
    padding: 0,
    flex: 1,
  },

  featuresContent: { gap: Spacing.sm },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { flex: 1, gap: 1 },
  featureTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  featureDesc: {
    fontSize: 12,
    lineHeight: 17,
  },

  readyContent: {
    alignItems: "center",
    gap: Spacing.xl,
  },
  readyIconRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  readyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  readySummary: {
    width: "100%",
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    fontSize: 14,
    flex: 1,
  },

  footer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
  },
});
