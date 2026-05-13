import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { CommonActions } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "CrewInviteAccept">;

export default function CrewInviteAcceptScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { horizontalPadding } = useLayout();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { login, setActiveCrewProvider } = useAuthStore();

  const initialToken = route.params?.token ?? "";
  const [token, setToken] = useState(initialToken);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!token.trim()) {
      setError("Paste the invite code from your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const response = await apiRequest(
        "POST",
        "/api/crew/invites/accept-public",
        {
          token: token.trim(),
          password,
          name: name.trim() || undefined,
        },
      );
      const data = await response.json();
      if (!data?.user || !data?.token) {
        throw new Error("Invalid response from server");
      }
      const memberships = Array.isArray(data.crewMemberships)
        ? data.crewMemberships
        : [];
      login(
        {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          avatarUrl: data.user.avatarUrl,
          isProvider: false,
          isAdmin: false,
        },
        null,
        data.token,
        memberships,
      );
      if (memberships.length > 0) {
        setActiveCrewProvider(memberships[0].providerId);
      }
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Main" }],
        }),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't accept the invite.";
      if (message.toLowerCase().includes("already exists")) {
        setError(
          "This email already has a HomeBase account. Sign in first, then your crew access will appear automatically.",
        );
      } else if (message.toLowerCase().includes("invalid or expired")) {
        setError(
          "This invite link is invalid or expired. Ask your provider to resend it.",
        );
      } else {
        setError(message);
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
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: horizontalPadding,
          },
        ]}
      >
        <View style={styles.header}>
          <ThemedText type="h1" style={styles.title}>
            Join your crew
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.subtitle, { color: theme.textSecondary }]}
          >
            Paste the invite code from your email, set a password, and
            you'll go straight to your assigned jobs.
          </ThemedText>
        </View>

        <View style={styles.form}>
          <TextField
            label="Invite code"
            placeholder="Paste from your email"
            value={token}
            onChangeText={(t) => {
              setToken(t);
              if (error) setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={3}
            testID="input-crew-invite-token"
          />
          <TextField
            label="Your name (optional)"
            placeholder="How your provider should see you"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            testID="input-crew-name"
          />
          <TextField
            label="Create password"
            placeholder="At least 8 characters"
            leftIcon="lock"
            rightIcon={showPassword ? "eye-off" : "eye"}
            onRightIconPress={() => setShowPassword(!showPassword)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (error) setError(null);
            }}
            testID="input-crew-password"
          />
          {error ? (
            <ThemedText
              style={[styles.errorText, { color: Colors.error }]}
              testID="text-crew-invite-error"
            >
              {error}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            testID="button-crew-invite-submit"
          >
            Accept Invite
          </PrimaryButton>
          <View style={styles.signinRow}>
            <ThemedText
              style={[styles.signinLabel, { color: theme.textSecondary }]}
            >
              Already have an account?
            </ThemedText>
            <Pressable onPress={() => navigation.navigate("Login")}>
              <ThemedText style={[styles.signinLink, { color: Colors.accent }]}>
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
  container: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: Spacing.screenPadding },
  header: { marginBottom: Spacing.xl },
  title: { marginBottom: Spacing.xs },
  subtitle: { fontSize: 16 },
  form: { gap: Spacing.lg },
  errorText: { ...Typography.footnote },
  footer: { marginTop: "auto", paddingTop: Spacing.xl, gap: Spacing.lg },
  signinRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  signinLabel: { ...Typography.callout },
  signinLink: { ...Typography.callout, fontWeight: "600" },
});
