import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

const CATEGORIES = [
  "Account & Login",
  "Payments & Billing",
  "Booking & Scheduling",
  "Technical Issue",
  "Provider Issue",
  "Feedback",
  "Other",
];

function SuccessState({ ticketId, onDone }: { ticketId: string; onDone: () => void }) {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.successContent,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={[styles.successIcon, { backgroundColor: Colors.accent + "15" }]}>
          <Feather name="check-circle" size={40} color={Colors.accent} />
        </View>
        <ThemedText style={styles.successTitle}>Message Sent</ThemedText>
        <ThemedText style={[styles.successSubtitle, { color: theme.textSecondary }]}>
          Your support request has been received. We'll reply to your email within 24 hours.
        </ThemedText>
        <View style={[styles.ticketBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <ThemedText style={[styles.ticketLabel, { color: theme.textSecondary }]}>Ticket reference</ThemedText>
          <ThemedText style={styles.ticketId}>#{ticketId.slice(0, 8).toUpperCase()}</ThemedText>
        </View>
        <ThemedText style={[styles.successNote, { color: theme.textSecondary }]}>
          Check your email for a copy of your request. If you need immediate help, email{" "}
          <ThemedText style={[styles.emailAccent, { color: Colors.accent }]}>
            support@homebaseproapp.com
          </ThemedText>
        </ThemedText>
        <Pressable
          testID="button-done"
          style={[styles.doneButton, { backgroundColor: Colors.accent }]}
          onPress={onDone}
        >
          <ThemedText style={styles.doneButtonText}>Done</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

export default function ContactUsScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError("Please fill in all fields before submitting.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/support/ticket", {
        name: name.trim(),
        email: email.trim(),
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      const data = await res.json();
      setTicketId(data.ticketId);
    } catch (err: any) {
      setError("Failed to send your message. Please try again or email support@homebaseproapp.com.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (ticketId) {
    return (
      <SuccessState
        ticketId={ticketId}
        onDone={() => navigation.goBack()}
      />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: Colors.accent + "15" }]}>
            <Feather name="message-square" size={32} color={Colors.accent} />
          </View>
          <ThemedText style={styles.headerTitle}>Contact Support</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Tell us what's going on and we'll get back to you within 24 hours.
          </ThemedText>
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: Colors.errorLight, borderColor: Colors.error + "30" }]}>
            <Feather name="alert-circle" size={16} color={Colors.error} />
            <ThemedText style={[styles.errorText, { color: Colors.error }]}>{error}</ThemedText>
          </View>
        ) : null}

        <View style={styles.formSection}>
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Your name</ThemedText>
            <TextInput
              testID="input-name"
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Email address</ThemedText>
            <TextInput
              testID="input-email"
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Category</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  testID={`category-${cat}`}
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: category === cat
                        ? Colors.accent
                        : isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)",
                      borderColor: category === cat ? Colors.accent : theme.border,
                    },
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <ThemedText
                    style={[
                      styles.categoryPillText,
                      { color: category === cat ? "#FFFFFF" : theme.text },
                    ]}
                  >
                    {cat}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Subject</ThemedText>
            <TextInput
              testID="input-subject"
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              value={subject}
              onChangeText={setSubject}
              placeholder="Brief description of your issue"
              placeholderTextColor={theme.textTertiary}
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Message</ThemedText>
            <TextInput
              testID="input-message"
              style={[styles.textarea, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              value={message}
              onChangeText={setMessage}
              placeholder="Please describe your issue in detail..."
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          <Pressable
            testID="button-submit"
            style={[styles.submitButton, { backgroundColor: Colors.accent, opacity: isSubmitting ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Feather name="send" size={18} color="#FFF" />
                <ThemedText style={styles.submitButtonText}>Send Message</ThemedText>
              </>
            )}
          </Pressable>

          <ThemedText style={[styles.footerNote, { color: theme.textTertiary }]}>
            You'll receive a confirmation email with your ticket reference.
          </ThemedText>
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
    paddingHorizontal: Spacing.screenPadding,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.title2,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  errorText: {
    ...Typography.subhead,
    flex: 1,
    lineHeight: 20,
  },
  formSection: {
    gap: Spacing.md,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.footnote,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    ...Typography.body,
    minHeight: 48,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
    minHeight: 130,
  },
  categoryRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  categoryPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryPillText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    minHeight: 52,
  },
  submitButtonText: {
    ...Typography.callout,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  footerNote: {
    ...Typography.footnote,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  successContent: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  successTitle: {
    ...Typography.title2,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  successSubtitle: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  ticketBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    marginBottom: Spacing.xl,
    width: "100%",
  },
  ticketLabel: {
    ...Typography.footnote,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  ticketId: {
    ...Typography.title3,
    fontWeight: "700",
    letterSpacing: 1,
  },
  successNote: {
    ...Typography.subhead,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  emailAccent: {
    fontWeight: "600",
  },
  doneButton: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 160,
    alignItems: "center",
  },
  doneButtonText: {
    ...Typography.callout,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
