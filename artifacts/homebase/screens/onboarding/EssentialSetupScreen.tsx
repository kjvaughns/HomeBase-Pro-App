import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  ScrollView,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useOnboardingStore } from "@/state/onboardingStore";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";
import { trackEvent, AnalyticsEvents } from "@/lib/analytics";

type Props = NativeStackScreenProps<RootStackParamList, "EssentialSetup">;

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

export default function EssentialSetupScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useLayout();
  const {
    setHasCompletedFirstLaunch,
    setHasCompletedProviderSetup,
    signupStartedAt,
    startSignupTimer,
    clearSignupTimer,
  } = useOnboardingStore();
  const { login, activateProviderMode, setNeedsRoleSelection } = useAuthStore();

  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [zip, setZip] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [accountName, setAccountName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // If a user lands here directly (e.g. via deep link) without having
  // tapped a role card we still want a meaningful elapsed time, so start
  // the timer on mount as a fallback. startSignupTimer is a no-op if
  // the timer has already been started.
  React.useEffect(() => {
    startSignupTimer();
  }, [startSignupTimer]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!businessName.trim()) e.businessName = "Business name is required";
    if (!category) e.category = "Pick your primary service";
    if (!/^\d{5}(-\d{4})?$/.test(zip.trim())) e.zip = "Enter a valid ZIP";
    const priceNum = parseFloat(startingPrice);
    if (!startingPrice.trim() || Number.isNaN(priceNum) || priceNum <= 0)
      e.startingPrice = "Enter a starting price (e.g. 125)";
    if (!accountName.trim()) e.accountName = "Your name is required";
    if (!/\S+@\S+\.\S+/.test(email.trim())) e.email = "Enter a valid email";
    if (password.length < 8) e.password = "At least 8 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const clearError = (k: string) => {
    if (errors[k]) {
      const next = { ...errors };
      delete next[k];
      setErrors(next);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const categoryLabel =
        SERVICE_CATEGORIES.find((c) => c.id === category)?.label || "Service";
      const priceNum = parseFloat(startingPrice);

      const response = await apiRequest(
        "POST",
        "/api/provider/onboard-complete",
        {
          name: accountName.trim(),
          email: email.trim().toLowerCase(),
          password,
          businessName: businessName.trim(),
          serviceZipCodes: [zip.trim()],
          capabilityTags: [category],
          initialService: {
            name: categoryLabel,
            category: categoryLabel,
            quoteRequired: false,
            price: priceNum,
            duration: 60,
          },
        },
      );
      const data = await response.json();

      if (!data.user || !data.provider) {
        if (response.status === 409) {
          setErrors({ email: "An account with this email already exists" });
          return;
        }
        throw new Error(data.error || "Account creation failed");
      }

      const token = data.token ?? null;
      const providerProfile = {
        id: data.provider.id,
        userId: data.user.id,
        businessName: businessName.trim(),
        services: [categoryLabel],
        status: "approved" as const,
        rating: 0,
        reviewCount: 0,
        completedJobs: 0,
        serviceArea: zip.trim(),
        isActive: true,
        isPublic: true,
      };

      login(
        {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          avatarUrl: data.user.avatarUrl,
          isProvider: true,
        },
        providerProfile,
        token,
      );
      activateProviderMode();
      setHasCompletedFirstLaunch(true);
      setHasCompletedProviderSetup(true);
      setNeedsRoleSelection(false);

      // Measure end-to-end time from the original `signup_started` tap
      // (persisted in onboardingStore) — falls back to `now` if the
      // timer was never started so we still emit a finite value.
      const startedAt = signupStartedAt ?? Date.now();
      const elapsedMs = Math.max(0, Date.now() - startedAt);
      trackEvent(AnalyticsEvents.SignupCompleted, { role: "provider" });
      trackEvent(AnalyticsEvents.ProviderFirstBookingLinkReady, {
        providerId: data.provider.id,
        elapsedMs,
        elapsedSeconds: Math.round(elapsedMs / 1000),
        timerStarted: signupStartedAt !== null,
      });
      clearSignupTimer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("409") || message.includes("exists")) {
        setErrors({ email: "An account with this email already exists" });
      } else {
        Alert.alert("Error", "Unable to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.navButton}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={20} color={theme.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={styles.navButton}
          hitSlop={12}
          testID="link-sign-in"
        >
          <ThemedText
            style={[styles.signInText, { color: Colors.accent, fontWeight: "600" }]}
          >
            Sign in
          </ThemedText>
        </Pressable>
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: insets.bottom + Spacing["3xl"] + 80,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText style={styles.headline}>
            Get a booking link in under 3 minutes
          </ThemedText>
          <ThemedText
            style={[styles.subheadline, { color: theme.textSecondary }]}
          >
            Just the essentials — you can polish your bio, hours, and policies
            from your dashboard.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.label}>Business name</ThemedText>
          <TextField
            value={businessName}
            onChangeText={(v) => {
              setBusinessName(v);
              clearError("businessName");
            }}
            placeholder="e.g. Bright Spark Electric"
            error={errors.businessName}
            autoCapitalize="words"
            testID="input-business-name"
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.label}>Primary service</ThemedText>
          <View style={styles.chipGrid}>
            {SERVICE_CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    setCategory(c.id);
                    clearError("category");
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? Colors.accentLight
                        : theme.cardBackground,
                      borderColor: active ? Colors.accent : theme.separator,
                    },
                  ]}
                  testID={`chip-category-${c.id}`}
                >
                  <Feather
                    name={c.icon}
                    size={14}
                    color={active ? Colors.accent : theme.textSecondary}
                  />
                  <ThemedText
                    style={[
                      styles.chipText,
                      { color: active ? Colors.accent : theme.text },
                    ]}
                  >
                    {c.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          {errors.category ? (
            <ThemedText style={styles.errorText}>{errors.category}</ThemedText>
          ) : null}
        </View>

        <View style={styles.row}>
          <View style={[styles.section, styles.flex1]}>
            <ThemedText style={styles.label}>Service ZIP</ThemedText>
            <TextField
              value={zip}
              onChangeText={(v) => {
                setZip(v);
                clearError("zip");
              }}
              placeholder="94110"
              keyboardType="number-pad"
              maxLength={10}
              error={errors.zip}
              testID="input-zip"
            />
          </View>
          <View style={[styles.section, styles.flex1]}>
            <ThemedText style={styles.label}>Starting price</ThemedText>
            <TextField
              value={startingPrice}
              onChangeText={(v) => {
                setStartingPrice(v);
                clearError("startingPrice");
              }}
              placeholder="125"
              keyboardType="decimal-pad"
              error={errors.startingPrice}
              testID="input-starting-price"
            />
            <ThemedText
              style={[styles.helperText, { color: theme.textTertiary }]}
            >
              Shown on your booking link
            </ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.separator }]} />

        <View style={styles.section}>
          <ThemedText style={styles.label}>Your name</ThemedText>
          <TextField
            value={accountName}
            onChangeText={(v) => {
              setAccountName(v);
              clearError("accountName");
            }}
            placeholder="Jane Doe"
            autoCapitalize="words"
            error={errors.accountName}
            testID="input-account-name"
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.label}>Email</ThemedText>
          <TextField
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              clearError("email");
            }}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
            testID="input-email"
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.label}>Password</ThemedText>
          <TextField
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              clearError("password");
            }}
            placeholder="At least 8 characters"
            secureTextEntry={!showPassword}
            rightIcon={showPassword ? "eye-off" : "eye"}
            onRightIconPress={() => setShowPassword((p) => !p)}
            error={errors.password}
            testID="input-password"
          />
        </View>
      </KeyboardAwareScrollViewCompat>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Spacing.lg,
            paddingHorizontal: horizontalPadding,
            backgroundColor: theme.backgroundRoot,
            borderTopColor: theme.separator,
          },
        ]}
      >
        <ThemedText
          style={[styles.legalText, { color: theme.textSecondary }]}
        >
          By continuing you agree to our{" "}
          <ThemedText
            style={{ color: Colors.accent }}
            onPress={() => Linking.openURL("https://homebaseproapp.com/terms")}
          >
            Terms
          </ThemedText>{" "}
          and{" "}
          <ThemedText
            style={{ color: Colors.accent }}
            onPress={() =>
              Linking.openURL("https://homebaseproapp.com/privacy")
            }
          >
            Privacy
          </ThemedText>
          .
        </ThemedText>
        <PrimaryButton
          onPress={handleSubmit}
          disabled={loading}
          loading={loading}
          testID="button-create-account"
        >
          Create account & get my booking link
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  navButton: { padding: Spacing.xs },
  signInText: { fontSize: 14 },
  header: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  headline: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: 32,
    marginBottom: Spacing.sm,
  },
  subheadline: { fontSize: 15, lineHeight: 22 },
  section: { marginBottom: Spacing.lg },
  row: { flexDirection: "row", gap: Spacing.md },
  flex1: { flex: 1 },
  label: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 13, fontWeight: "500" },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  helperText: { fontSize: 11, marginTop: Spacing.xs },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.lg,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  legalText: { fontSize: 11, textAlign: "center", lineHeight: 16 },
});
