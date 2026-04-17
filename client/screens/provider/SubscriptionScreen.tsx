import React, { useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

const MANAGE_URL = "https://homebaseproapp.com";
const SUBSCRIBE_URL = "https://homebaseproapp.com/subscribe";

interface StateContent {
  iconName: keyof typeof Feather.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  body: string;
  cta: string;
  caption?: string;
}

export default function SubscriptionScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isFetching, status, daysRemainingInGrace } = useSubscriptionStatus();

  const targetUrl = status === "subscribed" ? MANAGE_URL : SUBSCRIBE_URL;
  const handleOpen = useCallback(async () => {
    try {
      await Linking.openURL(targetUrl);
    } catch {}
  }, [targetUrl]);

  const content: StateContent = (() => {
    switch (status) {
      case "subscribed":
        return {
          iconName: "check-circle",
          iconBg: isDark ? "#1C2E24" : "#F0FAF4",
          iconColor: Colors.accent,
          title: "Subscription active",
          body: "You're all set. Manage your subscription details on the web at homebaseproapp.com.",
          cta: "Manage on homebaseproapp.com",
          caption: "Thanks for being a HomeBase Pro.",
        };
      case "grace_period": {
        const days = daysRemainingInGrace ?? 7;
        return {
          iconName: "clock",
          iconBg: isDark ? "#3a2f1a" : "#fffbeb",
          iconColor: "#b45309",
          title: days === 1 ? "1 day left in your trial" : `${days} days left in your trial`,
          body: "Subscribe at homebaseproapp.com to keep creating jobs and sending invoices after your trial ends.",
          cta: "Subscribe at homebaseproapp.com",
          caption: "Your trial started with your first paid booking.",
        };
      }
      case "expired":
        return {
          iconName: "lock",
          iconBg: isDark ? "#3a1f1f" : "#fef2f2",
          iconColor: "#dc2626",
          title: "Trial ended",
          body: "Subscribe at homebaseproapp.com to reactivate job and invoice creation. Your existing data, clients, and bookings are safe.",
          cta: "Subscribe at homebaseproapp.com",
        };
      case "free":
      default:
        return {
          iconName: "gift",
          iconBg: isDark ? "#1C2E24" : "#F0FAF4",
          iconColor: Colors.accent,
          title: "HomeBase is free until your first paid booking",
          body: "Use every feature with no charge. Once you collect your first invoice, your 7-day trial begins, then you can subscribe at homebaseproapp.com to keep going.",
          cta: "Learn more on homebaseproapp.com",
        };
    }
  })();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl * 2,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={Colors.accent}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : (
          <View
            style={[
              styles.card,
              {
                backgroundColor: content.iconBg,
                borderColor: content.iconColor + "40",
              },
            ]}
            testID={`subscription-card-${status ?? "unknown"}`}
          >
            <View style={[styles.iconCircle, { backgroundColor: content.iconColor + "22" }]}>
              <Feather name={content.iconName} size={28} color={content.iconColor} />
            </View>

            <ThemedText style={styles.title}>{content.title}</ThemedText>

            <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
              {content.body}
            </ThemedText>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: pressed ? Colors.accentPressed : Colors.accent },
              ]}
              onPress={handleOpen}
              testID="button-open-subscription-portal"
            >
              <Feather name="external-link" size={16} color="#fff" />
              <ThemedText style={styles.buttonText}>{content.cta}</ThemedText>
            </Pressable>

            {content.caption ? (
              <ThemedText style={[styles.caption, { color: theme.textTertiary }]}>
                {content.caption}
              </ThemedText>
            ) : null}
          </View>
        )}

        {data?.firstPaidBookingAt ? (
          <ThemedText style={[styles.meta, { color: theme.textTertiary }]}>
            First paid booking: {new Date(data.firstPaidBookingAt).toLocaleDateString()}
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { paddingVertical: Spacing.xl * 2, alignItems: "center" },
  card: {
    borderRadius: BorderRadius.card,
    borderWidth: 1.5,
    padding: Spacing.lg,
    alignItems: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.headline,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  body: {
    ...Typography.subhead,
    textAlign: "center",
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.button,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    alignSelf: "stretch",
  },
  buttonText: {
    color: "#fff",
    ...Typography.callout,
    fontWeight: "700",
  },
  caption: {
    ...Typography.caption1,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  meta: {
    ...Typography.caption2,
    textAlign: "center",
    marginTop: Spacing.lg,
  },
});
