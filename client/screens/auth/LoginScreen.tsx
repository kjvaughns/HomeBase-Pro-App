import React, { useState } from "react";
import { StyleSheet, View, Pressable } from "react-native";
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
import { apiRequest } from "@/lib/query-client";
import { Spacing, Colors, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { login } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }
    
    if (!password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      
      const data = await response.json();
      
      if (data.user) {
        const providerProfile = data.providerProfile ? {
          id: data.providerProfile.id,
          userId: data.providerProfile.userId,
          businessName: data.providerProfile.businessName,
          services: data.providerProfile.capabilityTags || [],
          status: data.providerProfile.isActive ? "approved" as const : "pending" as const,
          rating: parseFloat(data.providerProfile.rating) || 0,
          reviewCount: data.providerProfile.reviewCount || 0,
          completedJobs: 0,
        } : null;
        
        login({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          avatarUrl: data.user.avatarUrl,
          isProvider: data.user.isProvider || false,
        }, providerProfile, data.token ?? null);
      }
    } catch (error) {
      const isNetworkError =
        error instanceof TypeError ||
        (error instanceof Error && (
          error.message.includes("Network request failed") ||
          error.message.toLowerCase().includes("failed to fetch")
        ));
      const message = error instanceof Error ? error.message : "";
      if (message.includes("401") || message.includes("Invalid")) {
        setErrors({ password: "Invalid email or password" });
      } else if (isNetworkError) {
        setErrors({ email: "Can't connect to HomeBase. Check your internet connection." });
      } else {
        setErrors({ email: "Something went wrong on our end. Please try again." });
      }
    } finally {
      setLoading(false);
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
            Welcome back
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Sign in to continue managing your home
          </ThemedText>
        </View>

        <View style={styles.form}>
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
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            error={errors.email}
            testID="input-email"
          />

          <TextField
            label="Password"
            placeholder="Enter your password"
            leftIcon="lock"
            rightIcon={showPassword ? "eye-off" : "eye"}
            onRightIconPress={() => setShowPassword(!showPassword)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors({ ...errors, password: undefined });
            }}
            error={errors.password}
            testID="input-password"
          />

          <Pressable
            onPress={() => navigation.navigate("ForgotPassword")}
            style={styles.forgotButton}
          >
            <ThemedText style={[styles.forgotText, { color: Colors.accent }]}>
              Forgot password?
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            testID="button-submit"
          >
            Sign In
          </PrimaryButton>

          <View style={styles.signupRow}>
            <ThemedText style={[styles.signupLabel, { color: theme.textSecondary }]}>
              Don't have an account?
            </ThemedText>
            <Pressable onPress={() => navigation.navigate("SignUp")}>
              <ThemedText style={[styles.signupLink, { color: Colors.accent }]}>
                Sign Up
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
  forgotButton: {
    alignSelf: "flex-end",
  },
  forgotText: {
    ...Typography.callout,
    fontWeight: "500",
  },
  footer: {
    marginTop: "auto",
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  signupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  signupLabel: {
    ...Typography.callout,
  },
  signupLink: {
    ...Typography.callout,
    fontWeight: "600",
  },
});
