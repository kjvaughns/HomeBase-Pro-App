import React, { useState } from "react";
import { StyleSheet, View, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, Colors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const validate = () => {
    if (!email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });
      setSent(true);
    } catch (error) {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <ThemedView style={styles.container}>
        <View
          style={[
            styles.successContent,
            { paddingTop: headerHeight + Spacing["3xl"], paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <View style={[styles.successIcon, { backgroundColor: Colors.accent + "20" }]}>
            <Feather name="mail" size={48} color={Colors.accent} />
          </View>
          <ThemedText type="h1" style={styles.successTitle}>
            Check your email
          </ThemedText>
          <ThemedText type="body" style={[styles.successText, { color: theme.textSecondary }]}>
            If an account exists for {email}, we've sent password reset instructions.
          </ThemedText>
          <PrimaryButton
            onPress={() => navigation.navigate("Login")}
            style={styles.successButton}
            testID="button-back-to-login"
          >
            Back to Sign In
          </PrimaryButton>
        </View>
      </ThemedView>
    );
  }

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
            Reset password
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Enter your email address and we'll send you instructions to reset your password.
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
              if (error) setError("");
            }}
            error={error}
            testID="input-email"
          />
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            testID="button-submit"
          >
            Send Reset Link
          </PrimaryButton>
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
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    gap: Spacing.lg,
  },
  footer: {
    marginTop: "auto",
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  successContent: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  successTitle: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  successText: {
    textAlign: "center",
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  successButton: {
    width: "100%",
    marginTop: Spacing.lg,
  },
});
