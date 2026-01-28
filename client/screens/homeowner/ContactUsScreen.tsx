import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

interface ContactOption {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  action: () => void;
}

export default function ContactUsScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const handleEmail = () => {
    Linking.openURL("mailto:support@homebase.app?subject=HomeBase Support Request");
  };

  const handlePhone = () => {
    Linking.openURL("tel:+18005551234");
  };

  const handleChat = () => {
    Linking.openURL("https://homebase.app/chat");
  };

  const handleTwitter = () => {
    Linking.openURL("https://twitter.com/homebaseapp");
  };

  const contactOptions: ContactOption[] = [
    {
      id: "email",
      icon: "mail",
      title: "Email Support",
      subtitle: "support@homebase.app",
      action: handleEmail,
    },
    {
      id: "phone",
      icon: "phone",
      title: "Phone Support",
      subtitle: "1-800-555-1234",
      action: handlePhone,
    },
    {
      id: "chat",
      icon: "message-circle",
      title: "Live Chat",
      subtitle: "Chat with our team",
      action: handleChat,
    },
    {
      id: "twitter",
      icon: "twitter",
      title: "Twitter",
      subtitle: "@homebaseapp",
      action: handleTwitter,
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView
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
            <Feather name="headphones" size={32} color={Colors.accent} />
          </View>
          <ThemedText style={styles.headerTitle}>Get in Touch</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Our support team is here to help you with any questions or concerns.
          </ThemedText>
        </View>

        <View style={[styles.card, { overflow: "hidden", borderRadius: BorderRadius.lg }]}>
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={60}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" },
              ]}
            />
          )}
          {contactOptions.map((option, index) => (
            <Pressable
              key={option.id}
              style={[
                styles.optionRow,
                index < contactOptions.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}
              onPress={option.action}
            >
              <View style={[styles.optionIcon, { backgroundColor: Colors.accent + "15" }]}>
                <Feather name={option.icon} size={20} color={Colors.accent} />
              </View>
              <View style={styles.optionContent}>
                <ThemedText style={styles.optionTitle}>{option.title}</ThemedText>
                <ThemedText style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                  {option.subtitle}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>

        <View style={styles.hoursSection}>
          <ThemedText style={styles.hoursTitle}>Support Hours</ThemedText>
          <View style={[styles.hoursCard, { overflow: "hidden", borderRadius: BorderRadius.lg }]}>
            {Platform.OS === "ios" ? (
              <BlurView
                intensity={60}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" },
                ]}
              />
            )}
            <View style={styles.hoursContent}>
              <View style={styles.hoursRow}>
                <ThemedText style={styles.hoursLabel}>Monday - Friday</ThemedText>
                <ThemedText style={[styles.hoursValue, { color: theme.textSecondary }]}>
                  8:00 AM - 8:00 PM EST
                </ThemedText>
              </View>
              <View style={[styles.hoursRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                <ThemedText style={styles.hoursLabel}>Saturday - Sunday</ThemedText>
                <ThemedText style={[styles.hoursValue, { color: theme.textSecondary }]}>
                  9:00 AM - 5:00 PM EST
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.emergencySection}>
          <View style={[styles.emergencyCard, { backgroundColor: Colors.accent + "10" }]}>
            <Feather name="alert-circle" size={24} color={Colors.accent} />
            <View style={styles.emergencyContent}>
              <ThemedText style={styles.emergencyTitle}>Emergency Service?</ThemedText>
              <ThemedText style={[styles.emergencyText, { color: theme.textSecondary }]}>
                For urgent home emergencies, browse our providers and look for those with "24/7 Emergency" badges.
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
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
  card: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    ...Typography.callout,
    fontWeight: "600",
    marginBottom: 2,
  },
  optionSubtitle: {
    ...Typography.subhead,
  },
  hoursSection: {
    marginBottom: Spacing.xl,
  },
  hoursTitle: {
    ...Typography.headline,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  hoursCard: {
    borderRadius: BorderRadius.lg,
  },
  hoursContent: {
    padding: Spacing.md,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  hoursLabel: {
    ...Typography.callout,
    fontWeight: "500",
  },
  hoursValue: {
    ...Typography.subhead,
  },
  emergencySection: {
    marginTop: Spacing.md,
  },
  emergencyCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyTitle: {
    ...Typography.callout,
    fontWeight: "600",
    marginBottom: 4,
  },
  emergencyText: {
    ...Typography.subhead,
    lineHeight: 20,
  },
});
