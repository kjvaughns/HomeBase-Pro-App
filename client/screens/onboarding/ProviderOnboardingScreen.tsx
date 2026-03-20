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
import { ZipCodeAreaInput } from "@/components/ZipCodeAreaInput";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useOnboardingStore } from "@/state/onboardingStore";
import type { ProviderPreSignupData } from "@/state/onboardingStore";

type Props = NativeStackScreenProps<RootStackParamList, "ProviderOnboarding">;

const TOTAL_STEPS = 2;

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

export default function ProviderOnboardingScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { setHasCompletedFirstLaunch, setProviderPreSignupData } = useOnboardingStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [serviceArea, setServiceArea] = useState("");

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

  const canContinue = () => {
    if (currentStep === 0) return true;
    return businessName.trim().length > 0 && category.length > 0;
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      animateTransition(() => setCurrentStep((s) => s + 1));
    } else {
      setProviderPreSignupData({
        businessName: businessName.trim(),
        category,
        serviceArea: serviceArea.trim(),
      });
      setHasCompletedFirstLaunch(true);
      navigation.reset({ index: 0, routes: [{ name: "SignUp" }] });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      animateTransition(() => setCurrentStep((s) => s - 1));
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
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
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

        <Animated.View
          style={[styles.flex, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}
        >
          {currentStep === 0 ? (
            <EmotionalHookStep theme={theme} />
          ) : (
            <BusinessBasicsStep
              theme={theme}
              businessName={businessName}
              setBusinessName={setBusinessName}
              category={category}
              setCategory={setCategory}
              serviceArea={serviceArea}
              setServiceArea={setServiceArea}
            />
          )}
        </Animated.View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <PrimaryButton
            onPress={handleNext}
            disabled={!canContinue()}
            testID="button-next"
          >
            {currentStep === TOTAL_STEPS - 1 ? "Create Account" : "Continue"}
          </PrimaryButton>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function EmotionalHookStep({ theme }: { theme: ReturnType<typeof useTheme>["theme"] }) {
  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.hookScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hookIconWrap}>
        <View style={[styles.hookIconRing, { borderColor: Colors.accent + "30" }]}>
          <View style={[styles.hookIconCircle, { backgroundColor: Colors.accent }]}>
            <Feather name="briefcase" size={32} color="#fff" />
          </View>
        </View>
      </View>

      <View style={styles.hookHeadlines}>
        <ThemedText style={styles.hookLine}>Get booked.</ThemedText>
        <ThemedText style={styles.hookLine}>Stay organized.</ThemedText>
        <ThemedText style={[styles.hookLine, { color: Colors.accent }]}>Get paid.</ThemedText>
      </View>

      <ThemedText style={[styles.hookSubtext, { color: theme.textSecondary }]}>
        HomeBase gives you the tools to run a professional service business — booking links, client management, invoicing, and more.
      </ThemedText>

      <View style={styles.hookStats}>
        <HookPill icon="check-circle" label="Free to join" theme={theme} />
        <HookPill icon="credit-card" label="No card needed" theme={theme} />
        <HookPill icon="clock" label="Setup in minutes" theme={theme} />
      </View>
    </ScrollView>
  );
}

function HookPill({
  icon,
  label,
  theme,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View style={[styles.hookPill, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
      <Feather name={icon} size={13} color={Colors.accent} />
      <ThemedText style={[styles.hookPillText, { color: theme.textSecondary }]}>{label}</ThemedText>
    </View>
  );
}

function BusinessBasicsStep({
  theme,
  businessName,
  setBusinessName,
  category,
  setCategory,
  serviceArea,
  setServiceArea,
}: {
  theme: ReturnType<typeof useTheme>["theme"];
  businessName: string;
  setBusinessName: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  serviceArea: string;
  setServiceArea: (v: string) => void;
}) {
  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.stepHeader}>
        <ThemedText style={styles.stepTitle}>Tell us about{"\n"}your business</ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          A few quick details to set up your profile.
        </ThemedText>
      </View>

      <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Business name</ThemedText>
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: businessName ? Colors.accent : theme.border,
          },
        ]}
      >
        <Feather name="briefcase" size={17} color={businessName ? Colors.accent : theme.textSecondary} />
        <TextInput
          style={[styles.textInput, { color: theme.text }]}
          placeholder="Business name or your name"
          placeholderTextColor={theme.textTertiary}
          value={businessName}
          onChangeText={setBusinessName}
          autoCapitalize="words"
          returnKeyType="next"
          testID="input-business-name"
        />
      </View>

      <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
        Primary service
      </ThemedText>
      <View style={styles.categoryGrid}>
        {SERVICE_CATEGORIES.map((cat) => {
          const selected = category === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => setCategory(cat.id)}
              testID={`category-${cat.id}`}
              style={[
                styles.categoryCard,
                {
                  backgroundColor: selected ? Colors.accent + "14" : theme.backgroundSecondary,
                  borderColor: selected ? Colors.accent : theme.border,
                  borderWidth: selected ? 2 : 1,
                },
              ]}
            >
              <Feather name={cat.icon} size={20} color={selected ? Colors.accent : theme.textSecondary} />
              <ThemedText
                style={[
                  styles.categoryLabel,
                  { color: selected ? Colors.accent : theme.text, fontWeight: selected ? "600" : "400" },
                ]}
              >
                {cat.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: Spacing.lg }}>
        <ZipCodeAreaInput
          label="Service area"
          optional
          value={serviceArea}
          onChange={setServiceArea}
          testID="input-service-area"
        />
      </View>
    </ScrollView>
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
  backButton: { width: 32, alignItems: "flex-start" },
  progressRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  progressDot: { height: 6, borderRadius: 3 },
  skipButton: { width: 48, alignItems: "flex-end" },
  skipText: { fontSize: 13 },
  scrollView: { flex: 1 },
  hookScrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing["2xl"],
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["2xl"],
  },
  hookIconWrap: { marginBottom: Spacing.xl },
  hookIconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  hookIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  hookHeadlines: { alignItems: "center", marginBottom: Spacing.lg },
  hookLine: {
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 42,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  hookSubtext: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  hookStats: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, justifyContent: "center" },
  hookPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  hookPillText: { fontSize: 12, fontWeight: "500" },
  stepHeader: { marginBottom: Spacing.xl },
  stepTitle: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, lineHeight: 36, marginBottom: Spacing.sm },
  stepSubtitle: { fontSize: 15, lineHeight: 22 },
  fieldLabel: { fontSize: 13, fontWeight: "500", marginBottom: Spacing.sm },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  textInput: { flex: 1, fontSize: 15 },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryCard: {
    width: "30%",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  categoryLabel: { fontSize: 11, textAlign: "center" },
  footer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
  },
});
