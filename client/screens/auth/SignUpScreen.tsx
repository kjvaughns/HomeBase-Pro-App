import React, { useState } from "react";
import { StyleSheet, View, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { useOnboardingStore } from "@/state/onboardingStore";
import { apiRequest } from "@/lib/query-client";
import { Spacing, Colors, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "SignUp">;

export default function SignUpScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { login } = useAuthStore();
  const { selectedAccountType, providerPreSignupData } = useOnboardingStore();

  const [name, setName] = useState(
    selectedAccountType === "provider" && providerPreSignupData?.businessName
      ? providerPreSignupData.businessName
      : ""
  );
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      newErrors.name = "Name is required";
    }
    
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (phone && !/^\+?[\d\s-]{10,}$/.test(phone.replace(/\s/g, ""))) {
      newErrors.phone = "Please enter a valid phone number";
    }
    
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/signup", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
      });
      
      const data = await response.json();
      
      if (data.user) {
        login({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          avatarUrl: data.user.avatarUrl,
        }, null, data.token ?? null);
        if (selectedAccountType === "provider") {
          navigation.reset({
            index: 0,
            routes: [{ name: "ProviderSetupFlow" }],
          });
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: "Onboarding" }],
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign up failed";
      if (message.includes("409") || message.includes("exists")) {
        setErrors({ email: "An account with this email already exists" });
      } else {
        Alert.alert("Error", "Unable to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field: string) => {
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.header}>
          <ThemedText type="h1" style={styles.title}>
            Create account
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Join HomeBase to manage your home services
          </ThemedText>
        </View>

        <View style={styles.form}>
          <TextField
            label="Full Name"
            placeholder="John Smith"
            leftIcon="user"
            autoCapitalize="words"
            autoComplete="name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              clearError("name");
            }}
            error={errors.name}
            testID="input-name"
          />

          <TextField
            label="Email"
            placeholder="your@email.com"
            leftIcon="mail"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              clearError("email");
            }}
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
            onChangeText={(text) => {
              setPhone(text);
              clearError("phone");
            }}
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
            onChangeText={(text) => {
              setPassword(text);
              clearError("password");
            }}
            error={errors.password}
            testID="input-password"
          />

          <TextField
            label="Confirm Password"
            placeholder="Re-enter your password"
            leftIcon="lock"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              clearError("confirmPassword");
            }}
            error={errors.confirmPassword}
            testID="input-confirm-password"
          />
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            onPress={handleSignUp}
            loading={loading}
            disabled={loading}
            testID="button-submit"
          >
            Create Account
          </PrimaryButton>

          <View style={styles.loginRow}>
            <ThemedText style={[styles.loginLabel, { color: theme.textSecondary }]}>
              Already have an account?
            </ThemedText>
            <Pressable onPress={() => navigation.navigate("Login")}>
              <ThemedText style={[styles.loginLink, { color: Colors.accent }]}>
                Sign In
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screenPadding,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    gap: Spacing.lg,
  },
  footer: {
    marginTop: "auto",
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  loginLabel: {
    ...Typography.callout,
  },
  loginLink: {
    ...Typography.callout,
    fontWeight: "600",
  },
});
