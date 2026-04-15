import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Animated,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import { GlassCard } from "@/components/GlassCard";
import { ZipCodeAreaInput } from "@/components/ZipCodeAreaInput";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import type { OnboardingServiceData } from "@/state/onboardingStore";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useOnboardingStore } from "@/state/onboardingStore";
import { useAuthStore } from "@/state/authStore";
import { useProviderStore } from "@/state/providerStore";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type Props = NativeStackScreenProps<RootStackParamList, "ProviderOnboarding">;

// Step 0 = emotional hook (no progress dot)
// Steps 1-6 = setup steps (6 progress dots)
const TOTAL_STEPS = 7; // 0..6
const SETUP_STEPS = 6; // 1..6 (shown in progress dots)

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


const DAYS_OF_WEEK = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

const START_TIMES = ["6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM"];
const END_TIMES = ["4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"];

export default function ProviderOnboardingScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const safeTop = insets.top || 50;

  const {
    setHasCompletedFirstLaunch,
    setHasCompletedProviderSetup,
    setProviderPreSignupData,
    pendingOnboardingService,
    setPendingOnboardingService,
  } = useOnboardingStore();
  const { login, activateProviderMode, setNeedsRoleSelection } = useAuthStore();
  const { addOnboardingService, setProviderAvailability, setProviderBusinessProfile } =
    useProviderStore();

  const [step, setStep] = useState(0);

  // Step 1: Business
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");

  // Step 2: Service is now built via ServiceBlueprintWizardScreen (onboarding mode)
  // Data lives in onboardingStore.pendingOnboardingService

  // Step 3: Service Area
  const [serviceArea, setServiceArea] = useState("");

  // Step 4: Schedule
  const [activeDays, setActiveDays] = useState(["mon", "tue", "wed", "thu", "fri"]);
  const [startTime, setStartTime] = useState("8:00 AM");
  const [endTime, setEndTime] = useState("6:00 PM");

  // Step 5: Bio
  const [bio, setBio] = useState("");

  // Step 6: Create Account
  const [accountName, setAccountName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTransition = (forward: boolean, callback: () => void) => {
    const outDir = forward ? -28 : 28;
    const inDir = forward ? 28 : -28;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: outDir, duration: 140, useNativeDriver: false }),
    ]).start(() => {
      callback();
      slideAnim.setValue(inDir);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.spring(slideAnim, { toValue: 0, tension: 52, friction: 8, useNativeDriver: false }),
      ]).start();
    });
  };

  const canContinue = () => {
    switch (step) {
      case 0: return true;
      case 1: return businessName.trim().length > 0 && category.length > 0;
      case 2: return true; // Service step is optional — user can skip or complete via wizard
      case 3: return true;
      case 4: return activeDays.length > 0;
      case 5: return true;
      case 6: {
        return (
          accountName.trim().length > 0 &&
          email.trim().length > 0 &&
          password.length >= 8 &&
          password === confirmPassword
        );
      }
      default: return true;
    }
  };

  const validateSignup = () => {
    const errs: Record<string, string> = {};
    if (!accountName.trim()) errs.accountName = "Name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Please enter a valid email";
    if (phone && !/^\+?[\d\s\-]{10,}$/.test(phone.replace(/\s/g, "")))
      errs.phone = "Please enter a valid phone number";
    if (!password) errs.password = "Password is required";
    else if (password.length < 8) errs.password = "Password must be at least 8 characters";
    if (password !== confirmPassword) errs.confirmPassword = "Passwords don't match";
    setSignupErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const clearError = (field: string) => {
    if (signupErrors[field]) {
      const e = { ...signupErrors };
      delete e[field];
      setSignupErrors(e);
    }
  };

  const handleSignUp = async () => {
    if (!validateSignup()) return;
    setLoading(true);
    try {
      // Single atomic call: creates user + provider profile + initial service in one transaction.
      // If any step fails the entire registration rolls back — no broken partial accounts.
      const trimmedServiceArea = serviceArea.trim();
      const serviceAreaTokens = trimmedServiceArea
        ? trimmedServiceArea.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const parsedServiceZipCodes = serviceAreaTokens.length
        ? serviceAreaTokens.filter((t) => /^\d{5}(-\d{4})?$/.test(t))
        : undefined;
      const parsedServiceCities = serviceAreaTokens.length
        ? serviceAreaTokens.filter((t) => !/^\d{5}(-\d{4})?$/.test(t))
        : undefined;
      const response = await apiRequest("POST", "/api/provider/onboard-complete", {
        name: accountName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        businessName: businessName.trim(),
        description: bio.trim() || undefined,
        serviceArea: trimmedServiceArea || undefined,
        serviceZipCodes: parsedServiceZipCodes?.length ? parsedServiceZipCodes : undefined,
        serviceCities: parsedServiceCities?.length ? parsedServiceCities : undefined,
        capabilityTags: category ? [category] : [],
        businessHours: Object.fromEntries(
          ["mon","tue","wed","thu","fri","sat","sun"].map((day) => [
            day,
            {
              enabled: activeDays.includes(day),
              open: activeDays.includes(day) ? startTime : "Closed",
              close: activeDays.includes(day) ? endTime : "Closed",
            },
          ])
        ),
        initialService: pendingOnboardingService ? {
          name: pendingOnboardingService.name,
          category: pendingOnboardingService.category || category || "General",
          description: pendingOnboardingService.description || undefined,
          quoteRequired: pendingOnboardingService.pricingType === "quote",
          price: pendingOnboardingService.pricingType !== "quote"
            ? (parseFloat(pendingOnboardingService.basePrice) || undefined)
            : undefined,
          duration: pendingOnboardingService.duration,
        } : undefined,
      });
      const data = await response.json();
      if (!data.user || !data.provider) {
        if (response.status === 409) {
          setSignupErrors({ email: "An account with this email already exists" });
          return;
        }
        throw new Error(data.error || "Account creation failed");
      }

      const token = data.token ?? null;
      const providerId = data.provider.id;

      // Store onboarding data locally
      if (pendingOnboardingService) {
        addOnboardingService({
          id: `svc-${Date.now()}`,
          name: pendingOnboardingService.name,
          price: pendingOnboardingService.pricingType !== "quote" ? (parseFloat(pendingOnboardingService.basePrice) || null) : null,
          quoteRequired: pendingOnboardingService.pricingType === "quote",
          durationMinutes: pendingOnboardingService.duration,
        });
        setPendingOnboardingService(null);
      }
      setProviderAvailability({ activeDays, startTime, endTime });
      setProviderBusinessProfile({
        businessName: businessName.trim(),
        category,
        serviceArea: serviceArea.trim(),
      });
      setProviderPreSignupData({ businessName: businessName.trim(), category, serviceArea: serviceArea.trim() });
      setHasCompletedFirstLaunch(true);

      // Step 5: Update auth state with real provider profile
      const providerProfile = {
        id: providerId,
        userId: data.user.id,
        businessName: businessName.trim(),
        services: pendingOnboardingService ? [pendingOnboardingService.name] : [],
        status: "approved" as const,
        rating: 0,
        reviewCount: 0,
        completedJobs: 0,
        serviceArea: serviceArea.trim() || undefined,
      };

      login(
        { id: data.user.id, name: data.user.name, email: data.user.email, phone: data.user.phone, avatarUrl: data.user.avatarUrl, isProvider: true },
        providerProfile,
        token,
      );
      activateProviderMode();
      setHasCompletedProviderSetup(true);
      setNeedsRoleSelection(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("409") || message.includes("exists")) {
        setSignupErrors({ email: "An account with this email already exists" });
      } else {
        Alert.alert("Error", "Unable to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === TOTAL_STEPS - 1) {
      handleSignUp();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(true, () => setStep((s) => s + 1));
  };

  const handleBack = () => {
    if (step === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(false, () => setStep((s) => s - 1));
  };

  // Progress dot index: steps 1–6 map to dots 0–5
  const progressIndex = step - 1; // -1 on step 0 (no dots shown)

  return (
    <ThemedView style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: safeTop + Spacing.sm }]}>
        <Pressable onPress={handleBack} style={styles.navButton} hitSlop={12}>
          {step > 0 ? (
            <Feather name="arrow-left" size={20} color={theme.textSecondary} />
          ) : (
            <View style={{ width: 20 }} />
          )}
        </Pressable>

        <View style={styles.progressRow}>
          {step > 0
            ? Array.from({ length: SETUP_STEPS }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor: i <= progressIndex ? Colors.accent : theme.border,
                      width: i === progressIndex ? 20 : 6,
                    },
                  ]}
                />
              ))
            : null}
        </View>

        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={styles.navButton}
          hitSlop={12}
        >
          <ThemedText style={[styles.signInText, { color: theme.textTertiary }]}>Sign in</ThemedText>
        </Pressable>
      </View>

      {/* Animated step content */}
      <Animated.View
        style={[styles.flex, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}
      >
        {step === 0 && <EmotionalHookStep theme={theme} />}
        {step === 1 && (
          <BusinessStep
            theme={theme}
            businessName={businessName}
            setBusinessName={setBusinessName}
            category={category}
            setCategory={setCategory}
          />
        )}
        {step === 2 && (
          <ServiceBuilderStep
            theme={theme}
            pendingService={pendingOnboardingService}
            onOpenBuilder={() => navigation.navigate("NewService", { onboardingMode: true })}
            onClearService={() => setPendingOnboardingService(null)}
          />
        )}
        {step === 3 && (
          <ServiceAreaStep
            theme={theme}
            serviceArea={serviceArea}
            setServiceArea={setServiceArea}
          />
        )}
        {step === 4 && (
          <ScheduleStep
            theme={theme}
            activeDays={activeDays}
            setActiveDays={setActiveDays}
            startTime={startTime}
            setStartTime={setStartTime}
            endTime={endTime}
            setEndTime={setEndTime}
          />
        )}
        {step === 5 && (
          <BioStep
            theme={theme}
            bio={bio}
            setBio={setBio}
            businessName={businessName}
            category={category}
            serviceName={pendingOnboardingService?.name ?? ""}
          />
        )}
        {step === 6 && (
          <CreateAccountStep
            theme={theme}
            accountName={accountName}
            setAccountName={(v) => { setAccountName(v); clearError("accountName"); }}
            email={email}
            setEmail={(v) => { setEmail(v); clearError("email"); }}
            phone={phone}
            setPhone={(v) => { setPhone(v); clearError("phone"); }}
            password={password}
            setPassword={(v) => { setPassword(v); clearError("password"); }}
            confirmPassword={confirmPassword}
            setConfirmPassword={(v) => { setConfirmPassword(v); clearError("confirmPassword"); }}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            errors={signupErrors}
          />
        )}
      </Animated.View>

      {/* Footer button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <PrimaryButton
          onPress={handleNext}
          disabled={!canContinue() || loading}
          loading={loading}
          testID="button-next"
        >
          {step === TOTAL_STEPS - 1 ? "Create Account" : "Continue"}
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

// ─── Step 0: Emotional Hook ──────────────────────────────────────────────────

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
        <HookPill icon="check-circle" label="Free until first booking" theme={theme} />
        <HookPill icon="clock" label="Setup in minutes" theme={theme} />
      </View>

      {/* Pricing card */}
      <View style={[styles.hookPricingCard, { backgroundColor: Colors.accentLight, borderColor: Colors.accent + "30" }]}>
        <View style={styles.hookPricingHeader}>
          <Feather name="tag" size={15} color={Colors.accent} />
          <ThemedText style={[styles.hookPricingTitle, { color: Colors.accent }]}>Simple, transparent pricing</ThemedText>
        </View>

        <View style={styles.hookPricingRow}>
          <View style={styles.hookPricingMain}>
            <ThemedText style={styles.hookPricingPrice}>$29.99<ThemedText style={[styles.hookPricingUnit, { color: theme.textSecondary }]}>/mo</ThemedText></ThemedText>
            <View style={[styles.hookFreeBadge, { backgroundColor: Colors.accent }]}>
              <ThemedText style={styles.hookFreeBadgeText}>FREE</ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.hookPricingFreeNote, { color: theme.textSecondary }]}>
            until your first paid booking
          </ThemedText>
        </View>

        <View style={[styles.hookPricingDivider, { backgroundColor: Colors.accent + "20" }]} />

        <View style={styles.hookFeeRow}>
          <Feather name="percent" size={12} color={theme.textSecondary} />
          <ThemedText style={[styles.hookFeeText, { color: theme.textSecondary }]}>
            3% HomeBase fee + 2.9% Stripe processing per payment
          </ThemedText>
        </View>

        <ThemedText style={[styles.hookPricingNote, { color: theme.textTertiary }]}>
          No contracts. Cancel anytime.
        </ThemedText>
      </View>
    </ScrollView>
  );
}

// ─── Step 1: Business ────────────────────────────────────────────────────────

function BusinessStep({
  theme,
  businessName,
  setBusinessName,
  category,
  setCategory,
}: {
  theme: ReturnType<typeof useTheme>["theme"];
  businessName: string;
  setBusinessName: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
}) {
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);

  useEffect(() => {
    if (!category) { setNameSuggestions([]); return; }
    setLoadingNames(true);
    setNameSuggestions([]);
    apiRequest("POST", "/api/ai/onboarding/suggest-business-names", { category })
      .then((r) => r.json())
      .then((json) => { if (Array.isArray(json.names)) setNameSuggestions(json.names.slice(0, 3)); })
      .catch(() => {})
      .finally(() => setLoadingNames(false));
  }, [category]);

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.stepHeader}>
        <ThemedText style={styles.stepTitle}>Your business</ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Tell us who you are and what you specialize in.
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
          returnKeyType="done"
          testID="input-business-name"
        />
      </View>

      {(loadingNames || nameSuggestions.length > 0) ? (
        <View style={styles.aiSuggestionRow}>
          <Feather name="zap" size={12} color={Colors.accent} />
          <ThemedText style={[styles.captionText, { color: theme.textTertiary, marginLeft: 4, marginRight: 6 }]}>
            Quick picks:
          </ThemedText>
          {loadingNames ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            nameSuggestions.map((name) => (
              <Pressable
                key={name}
                onPress={() => { Haptics.selectionAsync(); setBusinessName(name); }}
                style={[styles.suggestionChip, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
              >
                <ThemedText style={[styles.captionText, { color: theme.text }]}>{name}</ThemedText>
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
        Primary service
      </ThemedText>
      <View style={styles.categoryGrid}>
        {SERVICE_CATEGORIES.map((cat) => {
          const selected = category === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => {
                Haptics.selectionAsync();
                setCategory(cat.id);
              }}
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
    </ScrollView>
  );
}

// ─── Step 2: Service Builder ──────────────────────────────────────────────────

function ServiceBuilderStep({
  theme,
  pendingService,
  onOpenBuilder,
  onClearService,
}: {
  theme: ReturnType<typeof useTheme>["theme"];
  pendingService: OnboardingServiceData | null;
  onOpenBuilder: () => void;
  onClearService: () => void;
}) {
  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stepHeader}>
        <ThemedText style={styles.stepTitle}>Your first service</ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Use the Service Builder to create a fully configured offering — pricing, duration, add-ons, and more. You can skip this and add services later.
        </ThemedText>
      </View>

      {pendingService ? (
        <GlassCard style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm }}>
            <View style={[styles.serviceIconBadge, { backgroundColor: Colors.accent + "18" }]}>
              <Feather name="check-circle" size={20} color={Colors.accent} />
            </View>
            <ThemedText style={[styles.fieldLabel, { color: Colors.accent, marginLeft: Spacing.sm, marginTop: 0 }]}>
              Service configured
            </ThemedText>
          </View>
          <ThemedText style={[{ fontSize: 17, fontWeight: "600", color: theme.text, marginBottom: 4 }]}>
            {pendingService.name}
          </ThemedText>
          {pendingService.description ? (
            <ThemedText style={[styles.captionText, { color: theme.textSecondary, marginBottom: Spacing.sm }]} numberOfLines={2}>
              {pendingService.description}
            </ThemedText>
          ) : null}
          <View style={{ flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap" }}>
            {pendingService.pricingType === "quote" ? (
              <View style={[styles.serviceTag, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
                <Feather name="file-text" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.captionText, { color: theme.textSecondary }]}>Quote on request</ThemedText>
              </View>
            ) : (
              <View style={[styles.serviceTag, { backgroundColor: Colors.accent + "15", borderColor: Colors.accent + "30" }]}>
                <Feather name="dollar-sign" size={12} color={Colors.accent} />
                <ThemedText style={[styles.captionText, { color: Colors.accent }]}>
                  {pendingService.basePrice ? `$${pendingService.basePrice}` : "Free"}
                </ThemedText>
              </View>
            )}
            {pendingService.duration > 0 ? (
              <View style={[styles.serviceTag, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
                <Feather name="clock" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.captionText, { color: theme.textSecondary }]}>
                  {pendingService.duration} min
                </ThemedText>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg }}>
            <Pressable
              onPress={onOpenBuilder}
              style={[styles.serviceActionBtn, { backgroundColor: theme.backgroundElevated, borderColor: theme.border, flex: 1 }]}
            >
              <Feather name="edit-2" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.captionText, { color: theme.textSecondary }]}>Edit</ThemedText>
            </Pressable>
            <Pressable
              onPress={onClearService}
              style={[styles.serviceActionBtn, { backgroundColor: "#FF453A10", borderColor: "#FF453A25", flex: 1 }]}
            >
              <Feather name="trash-2" size={14} color="#FF453A" />
              <ThemedText style={[styles.captionText, { color: "#FF453A" }]}>Remove</ThemedText>
            </Pressable>
          </View>
        </GlassCard>
      ) : (
        <Pressable onPress={onOpenBuilder} testID="button-open-service-builder">
          <GlassCard style={[styles.card, styles.builderLaunchCard]}>
            <View style={[styles.serviceIconBadge, { backgroundColor: Colors.accent + "18", marginBottom: Spacing.md }]}>
              <Feather name="tool" size={24} color={Colors.accent} />
            </View>
            <ThemedText style={[{ fontSize: 16, fontWeight: "600", color: theme.text, marginBottom: 6 }]}>
              Open Service Builder
            </ThemedText>
            <ThemedText style={[styles.captionText, { color: theme.textSecondary, textAlign: "center" }]}>
              Build a complete service profile with AI assistance — pricing, duration, add-ons, and a custom booking form.
            </ThemedText>
            <View style={[styles.builderCTA, { backgroundColor: Colors.accent, marginTop: Spacing.lg }]}>
              <ThemedText style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Build My First Service</ThemedText>
              <Feather name="arrow-right" size={16} color="#fff" />
            </View>
          </GlassCard>
        </Pressable>
      )}

      <View style={[styles.skipHint, { borderColor: theme.border }]}>
        <Feather name="info" size={13} color={theme.textTertiary} />
        <ThemedText style={[styles.captionText, { color: theme.textTertiary, flex: 1 }]}>
          You can always add and manage services from your Provider Portal after signing up.
        </ThemedText>
      </View>
    </ScrollView>
  );
}

// ─── (ServiceStep legacy removed) ────────────────────────────────────────────


// ─── Step 3: Service Area ────────────────────────────────────────────────────

function ServiceAreaStep({
  theme,
  serviceArea,
  setServiceArea,
}: {
  theme: ReturnType<typeof useTheme>["theme"];
  serviceArea: string;
  setServiceArea: (v: string) => void;
}) {
  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.stepHeader}>
        <ThemedText style={styles.stepTitle}>Service area</ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Where do you travel to for work? You can always update this later.
        </ThemedText>
      </View>

      <ZipCodeAreaInput
        label="Areas served"
        optional
        value={serviceArea}
        onChange={setServiceArea}
        testID="input-service-area"
      />
    </ScrollView>
  );
}

// ─── Step 4: Schedule ────────────────────────────────────────────────────────

function ScheduleStep({
  theme,
  activeDays,
  setActiveDays,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
}: {
  theme: ReturnType<typeof useTheme>["theme"];
  activeDays: string[];
  setActiveDays: (v: string[]) => void;
  startTime: string;
  setStartTime: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
}) {
  const toggleDay = (dayId: string) => {
    Haptics.selectionAsync();
    const next = activeDays.includes(dayId)
      ? activeDays.filter((d) => d !== dayId)
      : [...activeDays, dayId];
    setActiveDays(next);
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stepHeader}>
        <ThemedText style={styles.stepTitle}>Your schedule</ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          When are you available to take bookings?
        </ThemedText>
      </View>

      <GlassCard style={styles.card}>
        <View style={[styles.fieldLabelRow, { marginBottom: Spacing.sm }]}>
          <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Working days</ThemedText>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setActiveDays(["mon","tue","wed","thu","fri"]); setStartTime("8:00 AM"); setEndTime("6:00 PM"); }}
          >
            <ThemedText style={[styles.captionText, { color: Colors.accent, fontWeight: "600" }]}>Mon-Fri</ThemedText>
          </Pressable>
        </View>
        <View style={styles.daysRow}>
          {DAYS_OF_WEEK.map((day) => {
            const active = activeDays.includes(day.id);
            return (
              <Pressable
                key={day.id}
                onPress={() => toggleDay(day.id)}
                testID={`day-${day.id}`}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: active ? Colors.accent : theme.backgroundElevated,
                    borderColor: active ? Colors.accent : theme.border,
                  },
                ]}
              >
                <ThemedText style={{ color: active ? "#fff" : theme.textSecondary, fontSize: 12, fontWeight: active ? "600" : "400" }}>
                  {day.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: Spacing.lg }]}>Start time</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Spacing.md }}>
          <View style={[styles.timeRow, { paddingHorizontal: Spacing.md }]}>
            {START_TIMES.map((t) => (
              <Pressable
                key={t}
                onPress={() => { Haptics.selectionAsync(); setStartTime(t); }}
                style={[
                  styles.timeChip,
                  { backgroundColor: startTime === t ? Colors.accent : theme.backgroundElevated, borderColor: startTime === t ? Colors.accent : theme.border },
                ]}
              >
                <ThemedText style={{ color: startTime === t ? "#fff" : theme.textSecondary, fontSize: 13, fontWeight: startTime === t ? "600" : "400" }}>{t}</ThemedText>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: Spacing.lg }]}>End time</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Spacing.md }}>
          <View style={[styles.timeRow, { paddingHorizontal: Spacing.md }]}>
            {END_TIMES.map((t) => (
              <Pressable
                key={t}
                onPress={() => { Haptics.selectionAsync(); setEndTime(t); }}
                style={[
                  styles.timeChip,
                  { backgroundColor: endTime === t ? Colors.accent : theme.backgroundElevated, borderColor: endTime === t ? Colors.accent : theme.border },
                ]}
              >
                <ThemedText style={{ color: endTime === t ? "#fff" : theme.textSecondary, fontSize: 13, fontWeight: endTime === t ? "600" : "400" }}>{t}</ThemedText>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </GlassCard>
    </ScrollView>
  );
}

// ─── Step 5: Bio ─────────────────────────────────────────────────────────────

function BioStep({
  theme,
  bio,
  setBio,
  businessName,
  category,
  serviceName,
}: {
  theme: ReturnType<typeof useTheme>["theme"];
  bio: string;
  setBio: (v: string) => void;
  businessName: string;
  category: string;
  serviceName: string;
}) {
  const MAX = 300;
  const [generatingBio, setGeneratingBio] = useState(false);
  const [polishingBio, setPolishingBio] = useState(false);
  const [bioError, setBioError] = useState("");
  const hasGenerated = bio.length > 0;

  const handleGenerateBio = async () => {
    if (!businessName && !category) return;
    setGeneratingBio(true);
    setBioError("");
    try {
      const res = await apiRequest("POST", "/api/ai/onboarding/generate-bio", {
        businessName: businessName || category,
        category,
        serviceName: serviceName || undefined,
      });
      const json = await res.json();
      if (json.bio) setBio(json.bio.slice(0, MAX));
    } catch {
      setBioError("Couldn't generate bio. Try again.");
    } finally {
      setGeneratingBio(false);
    }
  };

  const handlePolishBio = async () => {
    if (!bio.trim()) return;
    setPolishingBio(true);
    setBioError("");
    try {
      const res = await apiRequest("POST", "/api/ai/onboarding/polish-text", {
        text: bio.trim(),
        context: "home service provider business bio",
      });
      const json = await res.json();
      if (json.polished) setBio(json.polished.slice(0, MAX));
    } catch {
      setBioError("Couldn't polish text. Try again.");
    } finally {
      setPolishingBio(false);
    }
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.stepScrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.stepHeader}>
        <ThemedText style={styles.stepTitle}>About you</ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          A short bio helps customers trust and choose you. Optional — you can add this later.
        </ThemedText>
      </View>

      <View
        style={[
          styles.bioWrapper,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: bio ? Colors.accent : theme.border,
          },
        ]}
      >
        <TextInput
          style={[styles.bioInput, { color: theme.text }]}
          placeholder="Tell customers about your experience, specialties, and what makes you the best choice..."
          placeholderTextColor={theme.textTertiary}
          value={bio}
          onChangeText={(v) => { setBio(v.slice(0, MAX)); setBioError(""); }}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          testID="input-bio"
        />
        <ThemedText style={[styles.captionText, { color: theme.textTertiary, textAlign: "right", marginTop: Spacing.xs }]}>
          {bio.length}/{MAX}
        </ThemedText>
      </View>

      {bioError.length > 0 ? (
        <ThemedText style={[styles.captionText, { color: "#E05555", marginTop: Spacing.xs }]}>{bioError}</ThemedText>
      ) : null}

      <View style={styles.aiBioRow}>
        <Pressable
          onPress={handleGenerateBio}
          disabled={generatingBio || polishingBio}
          style={[
            styles.aiActionBtn,
            { borderColor: Colors.accent, backgroundColor: Colors.accent + "10" },
          ]}
          testID="button-generate-bio"
        >
          {generatingBio ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Feather name="zap" size={13} color={Colors.accent} />
          )}
          <ThemedText style={[styles.captionText, { color: Colors.accent, marginLeft: 5, fontWeight: "600" }]}>
            {hasGenerated ? "Rewrite bio" : "Write my bio"}
          </ThemedText>
        </Pressable>

        {bio.trim().length > 20 ? (
          <Pressable
            onPress={handlePolishBio}
            disabled={generatingBio || polishingBio}
            style={[
              styles.aiActionBtn,
              { borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
            ]}
            testID="button-polish-bio"
          >
            {polishingBio ? (
              <ActivityIndicator size="small" color={theme.textSecondary} />
            ) : (
              <Feather name="edit-3" size={13} color={theme.textSecondary} />
            )}
            <ThemedText style={[styles.captionText, { color: theme.textSecondary, marginLeft: 5 }]}>
              Polish my writing
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.aiInfoBadge, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
        <Feather name="info" size={12} color={theme.textTertiary} />
        <ThemedText style={[styles.captionText, { color: theme.textTertiary, marginLeft: 6, flex: 1 }]}>
          AI uses your business name and category to write a professional bio. You can edit it after.
        </ThemedText>
      </View>
    </ScrollView>
  );
}

// ─── Step 6: Create Account ───────────────────────────────────────────────────

function CreateAccountStep({
  theme,
  accountName,
  setAccountName,
  email,
  setEmail,
  phone,
  setPhone,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  errors,
}: {
  theme: ReturnType<typeof useTheme>["theme"];
  accountName: string;
  setAccountName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  errors: Record<string, string>;
}) {
  return (
    <KeyboardAwareScrollViewCompat
      contentContainerStyle={styles.stepScrollContent}
    >
      <View style={styles.stepHeader}>
        <ThemedText style={styles.stepTitle}>Create your account</ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Almost there. Set up your login details to finish joining HomeBase.
        </ThemedText>
      </View>

      <View style={styles.formGap}>
        <TextField
          label="Your name"
          placeholder="Jane Smith"
          leftIcon="user"
          autoCapitalize="words"
          autoComplete="name"
          value={accountName}
          onChangeText={setAccountName}
          error={errors.accountName}
          testID="input-account-name"
        />

        <TextField
          label="Email"
          placeholder="your@email.com"
          leftIcon="mail"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          testID="input-email"
        />

        <TextField
          label="Phone (optional)"
          placeholder="+1 (555) 123-4567"
          leftIcon="phone"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={phone}
          onChangeText={setPhone}
          error={errors.phone}
          testID="input-phone"
        />

        <TextField
          label="Password"
          placeholder="At least 8 characters"
          leftIcon="lock"
          rightIcon={showPassword ? "eye-off" : "eye"}
          onRightIconPress={() => setShowPassword(!showPassword)}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="password-new"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          testID="input-password"
        />

        <TextField
          label="Confirm password"
          placeholder="Re-enter your password"
          leftIcon="lock"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          testID="input-confirm-password"
        />
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.sm,
  },
  navButton: { width: 48, alignItems: "flex-start", justifyContent: "center" },
  signInText: { fontSize: 13 },
  progressRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  progressDot: { height: 6, borderRadius: 3 },

  scrollView: { flex: 1 },
  hookScrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing["2xl"],
    alignItems: "center",
  },
  stepScrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["3xl"],
  },

  // Hook
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
  hookPricingCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1.5,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  hookPricingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  hookPricingTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  hookPricingRow: {
    marginBottom: Spacing.md,
  },
  hookPricingMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: 4,
  },
  hookPricingPrice: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: undefined,
  },
  hookPricingUnit: {
    fontSize: 15,
    fontWeight: "400",
  },
  hookFreeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  hookFreeBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  hookPricingFreeNote: {
    fontSize: 13,
    fontWeight: "400",
  },
  hookPricingDivider: {
    height: 1,
    marginBottom: Spacing.md,
  },
  hookFeeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: Spacing.sm,
  },
  hookFeeText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  hookPricingNote: {
    fontSize: 12,
    fontWeight: "400",
  },

  // Steps
  stepHeader: { marginBottom: Spacing.xl },
  stepTitle: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, lineHeight: 36, marginBottom: Spacing.sm },
  stepSubtitle: { fontSize: 15, lineHeight: 22 },

  fieldLabel: { fontSize: 13, fontWeight: "500", marginBottom: Spacing.sm },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

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

  // Category grid
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  categoryCard: {
    width: "30%",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  categoryLabel: { fontSize: 11, textAlign: "center" },

  // GlassCard / service
  card: { padding: Spacing.lg, marginBottom: Spacing.md },

  suggestionRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.sm },
  suggestionChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  aiSuggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  aiBioRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  aiActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  aiInfoBadge: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  captionText: { fontSize: 12 },

  descriptionPreview: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.sm,
  },

  pricingSegmented: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
    marginBottom: Spacing.sm,
  },
  pricingSegmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
  },
  quoteInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  pricingRow: { flexDirection: "row", gap: Spacing.sm },
  priceInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  currencySymbol: { paddingLeft: Spacing.md, fontSize: 15, fontWeight: "500" },
  priceInput: { flex: 1, padding: Spacing.md, fontSize: 15 },
  priceHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },

  durationRow: { flexDirection: "row", gap: Spacing.sm },
  durationOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },

  // Schedule
  daysRow: { flexDirection: "row", gap: 6 },
  dayChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  timeRow: { flexDirection: "row", gap: Spacing.sm, paddingBottom: Spacing.xs },
  timeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },

  // Bio
  bioWrapper: {
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    padding: Spacing.md,
  },
  bioInput: { fontSize: 15, minHeight: 120, lineHeight: 22 },

  // Create Account
  formGap: { gap: Spacing.lg },

  footer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
  },

  // ServiceBuilderStep
  serviceIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  serviceActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  builderLaunchCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  builderCTA: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  skipHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
  },
});
