import React, { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { apiRequest } from "@/lib/query-client";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import {
  isPurchasesAvailable,
  getProOffering,
  purchasePackage,
  restorePurchases,
  getManageSubscriptionUrl,
  isProEntitled,
  type PurchasesOffering,
  type PurchasesPackage,
} from "@/lib/revenuecat";

const PRIVACY_URL = "https://homebaseproapp.com/privacy";
const TERMS_URL = "https://homebaseproapp.com/terms";

type StateKey = "free" | "grace_period" | "expired" | "subscribed";

interface CopyForState {
  iconName: keyof typeof Feather.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  body: string;
  caption?: string;
}

export default function SubscriptionScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const {
    data,
    isLoading,
    refetch,
    isFetching,
    status,
    daysRemainingInGrace,
    isSubscribed,
  } = useSubscriptionStatus();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [offeringError, setOfferingError] = useState<string | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(false);

  // Native (iOS/Android) builds always take the IAP path so they never show
  // any external/Stripe purchase copy in-app — required for App Store review.
  // Web keeps the existing Stripe Checkout flow.
  const useIAP = isPurchasesAvailable();
  void isPurchasesAvailable; // keep import alive for tree-shaking

  // Load the current RevenueCat offering on mount (native only).
  useEffect(() => {
    if (!useIAP) return;
    let cancelled = false;
    setLoadingOffering(true);
    getProOffering()
      .then((current) => {
        if (cancelled) return;
        setOffering(current);
        if (!current) {
          setOfferingError(
            "Subscriptions are temporarily unavailable. Please try again in a moment.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOffering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [useIAP]);

  const proPackage: PurchasesPackage | null =
    offering?.monthly ?? offering?.availablePackages?.[0] ?? null;
  // On native we MUST display the localized price from the App Store /
  // Play Store offering — never a hardcoded value (Apple compliance).
  // On web we use the Stripe marketing price.
  const nativePriceLabel = proPackage?.product?.priceString ?? null;
  const priceLabel = useIAP ? nativePriceLabel : "$29.99/mo";

  // ─── Native (iOS/Android) IAP actions ────────────────────────────────────────
  const handleNativeSubscribe = useCallback(async () => {
    if (busy) return;
    if (!proPackage) {
      Alert.alert(
        "Subscriptions unavailable",
        "We couldn't load the subscription. Please check your connection and try again.",
      );
      return;
    }
    setBusy(true);
    try {
      const result = await purchasePackage(proPackage);
      if (result.success && isProEntitled(result.customerInfo)) {
        Alert.alert("Subscription active", "Welcome to HomeBase Pro!");
      } else if (!result.success && !result.userCancelled) {
        Alert.alert(
          "Purchase failed",
          result.errorMessage ||
            "We couldn't complete the purchase. Please try again.",
        );
      }
    } finally {
      setBusy(false);
      refetch();
    }
  }, [busy, proPackage, refetch]);

  const handleRestore = useCallback(async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.success && isProEntitled(result.customerInfo)) {
        Alert.alert("Restored", "Your subscription has been restored.");
      } else if (result.success) {
        Alert.alert(
          "No purchases found",
          "We didn't find an active subscription on this account.",
        );
      } else {
        Alert.alert(
          "Restore failed",
          result.errorMessage ||
            "We couldn't restore your purchases. Please try again.",
        );
      }
    } finally {
      setRestoring(false);
      refetch();
    }
  }, [restoring, refetch]);

  const handleManageNative = useCallback(async () => {
    try {
      await Linking.openURL(getManageSubscriptionUrl());
    } catch {
      Alert.alert(
        "Couldn't open settings",
        Platform.OS === "ios"
          ? "Open the Settings app to manage your Apple subscription."
          : "Open the Play Store to manage your subscription.",
      );
    }
  }, []);

  // ─── Web (Stripe) actions ────────────────────────────────────────────────────
  const openStripeFlow = useCallback(
    async (action: "subscribe" | "manage") => {
      if (busy) return;
      setBusy(true);
      try {
        const route =
          action === "subscribe"
            ? "/api/subscriptions/create-checkout"
            : "/api/subscriptions/portal";
        await openExternalUrl(async () => {
          const res = await apiRequest("POST", route);
          const json = (await res.json()) as { url?: string };
          if (!json.url) throw new Error("Missing billing URL");
          return json.url;
        });
      } catch (err: any) {
        Alert.alert(
          action === "subscribe"
            ? "Subscription error"
            : "Billing portal error",
          err?.message || "Something went wrong. Please try again.",
        );
      } finally {
        setBusy(false);
        refetch();
      }
    },
    [busy, refetch],
  );

  const stateKey: StateKey = (status as StateKey) ?? "free";
  const copy: CopyForState = (() => {
    switch (stateKey) {
      case "subscribed":
        return {
          iconName: "check-circle",
          iconBg: isDark ? "#1C2E24" : "#F0FAF4",
          iconColor: Colors.accent,
          title: "Subscription active",
          body: "You're all set. Thanks for being a HomeBase Pro.",
          caption: useIAP
            ? Platform.OS === "ios"
              ? "Manage or cancel anytime in your Apple ID subscription settings."
              : "Manage or cancel anytime in the Google Play subscriptions screen."
            : "Manage your card or cancel anytime from the billing portal.",
        };
      case "grace_period": {
        const days = daysRemainingInGrace ?? 7;
        return {
          iconName: "clock",
          iconBg: isDark ? "#3a2f1a" : "#fffbeb",
          iconColor: "#b45309",
          title:
            days === 1
              ? "1 day left in your trial"
              : `${days} days left in your trial`,
          body: "Subscribe to keep creating jobs and sending invoices after your trial ends.",
          caption: "Your trial started with your first paid booking.",
        };
      }
      case "expired":
        return {
          iconName: "lock",
          iconBg: isDark ? "#3a1f1f" : "#fef2f2",
          iconColor: "#dc2626",
          title: "Trial ended",
          body: "Subscribe to reactivate job and invoice creation. Your existing data, clients, and bookings are safe.",
        };
      case "free":
      default:
        return {
          iconName: "gift",
          iconBg: isDark ? "#1C2E24" : "#F0FAF4",
          iconColor: Colors.accent,
          title: "HomeBase is free until your first paid booking",
          body: "Use every feature with no charge. Once you collect your first invoice, your 7-day trial begins. Subscribe early any time.",
        };
    }
  })();

  const showSubscribeButton = !isSubscribed;
  const subscribeLabel = priceLabel
    ? stateKey === "free"
      ? `Subscribe early — ${priceLabel}`
      : `Subscribe — ${priceLabel}`
    : "Subscribe";

  // Render the renewal disclosure only when we have a real localized price
  // (native) or the marketing price (web). No fabricated values.
  const showDisclosure = !!priceLabel;

  const sourceLabel = (() => {
    switch (data?.subscriptionSource) {
      case "revenuecat_ios":
        return "Apple App Store";
      case "revenuecat_android":
        return "Google Play";
      case "stripe_web":
        return "Web (Stripe)";
      default:
        return null;
    }
  })();
  const renewalDate = data?.currentPeriodEnd
    ? new Date(data.currentPeriodEnd).toLocaleDateString()
    : null;

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
                backgroundColor: copy.iconBg,
                borderColor: copy.iconColor + "40",
              },
            ]}
            testID={`subscription-card-${stateKey}`}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: copy.iconColor + "22" },
              ]}
            >
              <Feather name={copy.iconName} size={28} color={copy.iconColor} />
            </View>

            <ThemedText style={styles.title}>{copy.title}</ThemedText>

            <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
              {copy.body}
            </ThemedText>

            {/* Primary action */}
            {showSubscribeButton ? (
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: pressed
                      ? Colors.accentPressed
                      : Colors.accent,
                    opacity: busy || (useIAP && !proPackage) ? 0.6 : 1,
                  },
                ]}
                onPress={
                  useIAP
                    ? handleNativeSubscribe
                    : () => openStripeFlow("subscribe")
                }
                disabled={busy || loadingOffering || (useIAP && !proPackage)}
                testID="button-subscribe"
              >
                {busy || loadingOffering ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="credit-card" size={16} color="#fff" />
                    <ThemedText style={styles.buttonText}>
                      {subscribeLabel}
                    </ThemedText>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: pressed
                      ? Colors.accentPressed
                      : Colors.accent,
                  },
                ]}
                onPress={
                  useIAP ? handleManageNative : () => openStripeFlow("manage")
                }
                disabled={busy}
                testID="button-manage-subscription"
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="external-link" size={16} color="#fff" />
                    <ThemedText style={styles.buttonText}>
                      Manage subscription
                    </ThemedText>
                  </>
                )}
              </Pressable>
            )}

            {/* Restore purchases — required by App Store reviewers */}
            {useIAP ? (
              <Pressable
                onPress={handleRestore}
                disabled={restoring || busy}
                style={styles.secondaryButton}
                testID="button-restore-purchases"
              >
                {restoring ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <ThemedText
                    style={[
                      styles.secondaryButtonText,
                      { color: Colors.accent },
                    ]}
                  >
                    Restore purchases
                  </ThemedText>
                )}
              </Pressable>
            ) : showSubscribeButton ? null : (
              <Pressable
                onPress={() => openStripeFlow("manage")}
                disabled={busy}
                style={styles.secondaryButton}
                testID="button-open-portal"
              >
                <ThemedText
                  style={[styles.secondaryButtonText, { color: Colors.accent }]}
                >
                  View billing history
                </ThemedText>
              </Pressable>
            )}

            {copy.caption ? (
              <ThemedText
                style={[styles.caption, { color: theme.textTertiary }]}
              >
                {copy.caption}
              </ThemedText>
            ) : null}

            {offeringError && useIAP && showSubscribeButton ? (
              <ThemedText style={[styles.caption, { color: "#dc2626" }]}>
                {offeringError}
              </ThemedText>
            ) : null}
          </View>
        )}

        {/* Apple-required renewal disclosure + legal links. Only render when
            we have a real localized price (or the marketing price on web). */}
        {showSubscribeButton && showDisclosure ? (
          <View style={styles.disclosureBlock}>
            <ThemedText
              style={[styles.disclosure, { color: theme.textTertiary }]}
            >
              {useIAP
                ? Platform.OS === "ios"
                  ? `HomeBase Pro is an auto-renewing subscription billed at ${priceLabel}. Payment is charged to your Apple ID at confirmation. Your subscription renews automatically unless auto-renew is turned off at least 24 hours before the end of the current period. You can manage and cancel your subscription in your Apple ID account settings after purchase.`
                  : `HomeBase Pro is an auto-renewing subscription billed at ${priceLabel}. Payment is charged to your Google Play account at confirmation. Your subscription renews automatically unless cancelled at least 24 hours before the end of the current period. You can manage and cancel your subscription in your Google Play subscriptions settings after purchase.`
                : `HomeBase Pro is an auto-renewing subscription billed at ${priceLabel} via Stripe. Manage or cancel anytime from the billing portal.`}
            </ThemedText>
            <View style={styles.legalRow}>
              <Pressable
                onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
                hitSlop={8}
                testID="link-terms"
              >
                <ThemedText
                  style={[styles.legalLink, { color: Colors.accent }]}
                >
                  Terms of Use (EULA)
                </ThemedText>
              </Pressable>
              <ThemedText
                style={[styles.legalSep, { color: theme.textTertiary }]}
              >
                ·
              </ThemedText>
              <Pressable
                onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
                hitSlop={8}
                testID="link-privacy"
              >
                <ThemedText
                  style={[styles.legalLink, { color: Colors.accent }]}
                >
                  Privacy Policy
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Billing details surfaced for subscribed providers. */}
        {isSubscribed && (sourceLabel || renewalDate) ? (
          <View style={styles.metaBlock}>
            {sourceLabel ? (
              <ThemedText
                style={[styles.meta, { color: theme.textTertiary }]}
                testID="text-subscription-source"
              >
                Billed through: {sourceLabel}
              </ThemedText>
            ) : null}
            {renewalDate ? (
              <ThemedText
                style={[styles.meta, { color: theme.textTertiary }]}
                testID="text-subscription-renewal"
              >
                Renews on: {renewalDate}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {data?.firstPaidBookingAt ? (
          <ThemedText style={[styles.meta, { color: theme.textTertiary }]}>
            First paid booking:{" "}
            {new Date(data.firstPaidBookingAt).toLocaleDateString()}
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
  secondaryButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  caption: {
    ...Typography.caption1,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  disclosureBlock: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  disclosure: {
    ...Typography.caption2,
    lineHeight: 16,
    textAlign: "center",
  },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  legalLink: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  legalSep: {
    ...Typography.caption1,
  },
  meta: {
    ...Typography.caption2,
    textAlign: "center",
    marginTop: Spacing.lg,
  },
  metaBlock: {
    marginTop: Spacing.lg,
    gap: Spacing.xs,
    alignItems: "center",
  },
});
