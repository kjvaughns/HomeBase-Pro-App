import React, { useCallback } from "react";
import { StyleSheet, View, ScrollView, Switch, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { ListRow } from "@/components/ListRow";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";

interface NotificationPreferences {
  emailBookingConfirmation: boolean;
  emailBookingReminder: boolean;
  emailBookingCancelled: boolean;
  emailInvoiceCreated: boolean;
  emailInvoiceReminder: boolean;
  emailInvoicePaid: boolean;
  emailPaymentFailed: boolean;
  emailReviewRequest: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
}

const PREF_CATEGORIES = [
  {
    section: "Push Notifications",
    icon: "bell" as const,
    items: [
      { key: "pushEnabled" as keyof NotificationPreferences, label: "Push Notifications", subtitle: "Receive push notifications on your device" },
    ],
  },
  {
    section: "Email Notifications",
    icon: "mail" as const,
    items: [
      { key: "emailBookingConfirmation" as keyof NotificationPreferences, label: "Booking Confirmations", subtitle: "Booking confirmations and updates" },
      { key: "emailBookingReminder" as keyof NotificationPreferences, label: "Booking Reminders", subtitle: "Upcoming appointment reminders" },
      { key: "emailBookingCancelled" as keyof NotificationPreferences, label: "Cancellations", subtitle: "Booking cancellation notices" },
      { key: "emailInvoiceCreated" as keyof NotificationPreferences, label: "New Invoices", subtitle: "When a new invoice is created" },
      { key: "emailInvoiceReminder" as keyof NotificationPreferences, label: "Invoice Reminders", subtitle: "Upcoming and overdue invoice reminders" },
      { key: "emailInvoicePaid" as keyof NotificationPreferences, label: "Payment Receipts", subtitle: "When a payment is received" },
      { key: "emailPaymentFailed" as keyof NotificationPreferences, label: "Payment Failures", subtitle: "When a payment fails to process" },
      { key: "emailReviewRequest" as keyof NotificationPreferences, label: "Review Requests", subtitle: "Requests to review a service" },
    ],
  },
];

export default function NotificationPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ preferences: NotificationPreferences }>({
    queryKey: ["/api/notification-preferences", user?.id],
    queryFn: async () => {
      if (!user?.id) return { preferences: {} as NotificationPreferences };
      const res = await apiRequest("GET", `/api/notification-preferences/${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const res = await apiRequest("POST", "/api/notification-preferences", updates);
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-preferences", user?.id] });
    },
  });

  const prefs = data?.preferences;

  const handleToggle = useCallback((key: keyof NotificationPreferences, value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mutation.mutate({ [key]: value });
  }, [mutation]);

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator color={Colors.accent} />
      </ThemedView>
    );
  }

  const defaults: NotificationPreferences = {
    emailBookingConfirmation: true, emailBookingReminder: true, emailBookingCancelled: true,
    emailInvoiceCreated: true, emailInvoiceReminder: true, emailInvoicePaid: true,
    emailPaymentFailed: true, emailReviewRequest: true,
    pushEnabled: true, inAppEnabled: true,
  };

  const currentPrefs = { ...defaults, ...prefs };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {PREF_CATEGORIES.map((category, catIndex) => (
          <Animated.View
            key={category.section}
            entering={FadeInDown.delay(catIndex * 100).duration(400)}
          >
            <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              {category.section}
            </ThemedText>
            <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
              {category.items.map((item, itemIndex) => (
                <View key={item.key} style={styles.switchRow}>
                  <ListRow
                    title={item.label}
                    subtitle={item.subtitle}
                    leftIcon={category.icon}
                    showChevron={false}
                    isFirst={itemIndex === 0}
                    isLast={itemIndex === category.items.length - 1}
                  />
                  <View style={styles.switchContainer}>
                    <Switch
                      value={!!currentPrefs[item.key]}
                      onValueChange={(value) => handleToggle(item.key, value)}
                      trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                      thumbColor="#FFFFFF"
                      testID={`switch-${item.key}`}
                    />
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    ...Typography.footnote,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  section: {
    borderRadius: BorderRadius.card,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  switchRow: {
    position: "relative",
  },
  switchContainer: {
    position: "absolute",
    right: Spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});
