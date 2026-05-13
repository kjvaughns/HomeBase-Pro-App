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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";

import { useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import {
  useSubscriptionStatus,
  type SubscriptionStatusInfo,
} from "@/hooks/useSubscriptionStatus";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import {
  isPurchasesAvailable,
  restorePurchases,
  getManageSubscriptionUrl,
  isProEntitled,
  waitForConfiguration,
  getRevenueCatDiagnostics,
  getRevenueCatLivePrice,
  type RevenueCatDiagnosticsResult,
} from "@/lib/revenuecat";

const PRIVACY_URL = "https://homebaseproapp.com/privacy";
const TERMS_URL = "https://homebaseproapp.com/terms";
const SUPPORT_URL = "mailto:support@homebaseproapp.com";

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
  const { horizontalPadding } = useLayout();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const providerId = useAuthStore((s) => s.providerProfile?.id ?? null);
  const {
    data,
    isLoading,
    refetch,
    isFetching,
    status,
    daysRemainingInGrace,
    isSubscribed,
    isPartner,
  } = useSubscriptionStatus();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Dev-mode diagnostics — fetched once on mount on iOS in __DEV__
  const [diagnostics, setDiagnostics] =
    useState<RevenueCatDiagnosticsResult | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  // In-screen paywall failure state — shown as a fallback card when the
  // native paywall cannot be presented, so users always have actionable info.
  const [paywallFailure, setPaywallFailure] = useState<{
    code: string | null;
    message: string;
  } | null>(null);

  // Live price string fetched from RevenueCat offerings (falls back to static copy)
  const [livePrice, setLivePrice] = useState<string | null>(null);

  const useIAP = isPurchasesAvailable();

  // Fetch live price + (dev only) full diagnostics on mount when on iOS.
  // getRevenueCatLivePrice() is safe for production — no raw JSON logging.
  // getRevenueCatDiagnostics() is heavy (full JSON logging) and only runs in dev.
  useEffect(() => {
    if (!useIAP) return;
    let cancelled = false;

    (async () => {
      try {
        if (__DEV__) {
          // Dev: run full diagnostics (includes price + heavy logging)
          setDiagnosticsLoading(true);
          const result = await getRevenueCatDiagnostics();
          if (cancelled) return;
          setDiagnostics(result);
          if (result.firstPackagePriceString) {
            setLivePrice(result.firstPackagePriceString);
          }
        } else {
          // Production: lightweight price fetch only — no raw JSON logging
          const price = await getRevenueCatLivePrice();
          if (cancelled) return;
          if (price) setLivePrice(price);
        }
      } catch {
        // Best-effort; never crash the screen
      } finally {
        if (!cancelled) setDiagnosticsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [useIAP]);

  const handleDeleteAccount = useCallback(() => {
    navigation.navigate("AccountSecurity");
  }, [navigation]);

  const handleContactSupport = useCallback(() => {
    Linking.openURL(SUPPORT_URL).catch(() => {
      Alert.alert(
        "Couldn't open mail",
        "Please email support@homebaseproapp.com.",
      );
    });
  }, []);

  // After a successful purchase or restore, the RevenueCat webhook will mark
  // the provider as subscribed server-side, but the webhook can lag a few
  // seconds. To unlock the gate immediately we optimistically write the
  // subscription-status cache to "subscribed" when StoreKit confirms the Pro
  // entitlement client-side, then reconcile with the server refetch.
  const refreshEntitlement = useCallback(
    async (entitled: boolean) => {
      if (!providerId) {
        await refetch();
        return;
      }
      const queryKey = [
        "/api/providers",
        providerId,
        "subscription-status",
      ] as const;
      if (entitled) {
        queryClient.setQueryData<SubscriptionStatusInfo | undefined>(
          queryKey,
          (prev) => ({
            status: "subscribed",
            daysRemainingInGrace: prev?.daysRemainingInGrace ?? null,
            firstPaidBookingAt: prev?.firstPaidBookingAt ?? null,
            gracePeriodEndsAt: prev?.gracePeriodEndsAt ?? null,
            isSubscribed: true,
            subscriptionSource:
              prev?.subscriptionSource ??
              (Platform.OS === "ios"
                ? "revenuecat_ios"
                : Platform.OS === "android"
                  ? "revenuecat_android"
                  : prev?.subscriptionSource ?? null),
            currentPeriodEnd: prev?.currentPeriodEnd ?? null,
          }),
        );
      }
      // Reconcile with server (picks up real currentPeriodEnd, source, etc.)
      await queryClient.invalidateQueries({ queryKey });
      await refetch();
    },
    [providerId, queryClient, refetch],
  );

  // ─── Native (iOS/Android) IAP actions ────────────────────────────────────────
  // Present RevenueCat's native paywall UI. The SDK reads offerings and handles
  // the purchase internally — no manual offering fetch or purchasePackage call needed.
  const handleNativeSubscribe = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    // Clear any previous failure state when the user retries.
    setPaywallFailure(null);
    try {
      // Ensure the SDK is configured before presenting the paywall.
      await waitForConfiguration();
      const { default: RevenueCatUI, PAYWALL_RESULT } = await import(
        "react-native-purchases-ui"
      );
      const result = await RevenueCatUI.presentPaywall();
      switch (result) {
        case PAYWALL_RESULT.PURCHASED:
        case PAYWALL_RESULT.RESTORED: {
          await refreshEntitlement(true);
          Alert.alert("Subscription active", "Welcome to HomeBase Pro!");
          break;
        }
        case PAYWALL_RESULT.CANCELLED:
          // User dismissed — no action needed.
          break;
        case PAYWALL_RESULT.ERROR: {
          // In dev, fetch fresh diagnostics so the panel reflects current SDK
          // state. In production, skip the heavy diagnostics call to avoid
          // raw JSON logging; use a static actionable message instead.
          let errCode: string | null = null;
          let errMsg =
            "The paywall could not be shown. Check that the product IDs in RevenueCat match App Store Connect exactly and that Agreements, Tax & Banking are Active.";
          if (__DEV__) {
            const fresh = await getRevenueCatDiagnostics();
            setDiagnostics(fresh);
            errCode = fresh.errorCode;
            if (fresh.error) {
              errMsg = `${fresh.error}${fresh.errorCode ? ` (code ${fresh.errorCode})` : ""}`;
            }
          }
          setPaywallFailure({ code: errCode, message: errMsg });
          break;
        }
        case PAYWALL_RESULT.NOT_PRESENTED:
        default: {
          // Use the synthetic code "NOT_PRESENTED" so support triage always
          // has a deterministic identifier, even when the SDK returns no code.
          let npMsg =
            "The paywall could not be displayed. Please check your connection and try again, or contact support.";
          if (__DEV__) {
            const fresh = await getRevenueCatDiagnostics();
            setDiagnostics(fresh);
            if (fresh.packageCount === 0) {
              npMsg =
                "No products were found in RevenueCat. Make sure the default Offering has at least one Package attached and the product ID matches App Store Connect exactly.";
            } else if (fresh.error) {
              npMsg = `${fresh.error}${fresh.errorCode ? ` (code ${fresh.errorCode})` : ""}`;
            }
          }
          setPaywallFailure({ code: "NOT_PRESENTED", message: npMsg });
          break;
        }
      }
    } catch (err: any) {
      console.error("[SubscriptionScreen] presentPaywall error:", err);
      const code: string | null = err?.code != null ? String(err.code) : null;
      const msg: string =
        code === "23"
          ? "Error 23: No products could be fetched from App Store Connect. Verify that the product IDs in RevenueCat match App Store Connect exactly, and that Agreements, Tax & Banking are all Active in App Store Connect."
          : err?.message ?? "Please try again or contact support.";
      setPaywallFailure({ code, message: msg });
    } finally {
      setBusy(false);
    }
  }, [busy, refreshEntitlement]);

  const handleRestore = useCallback(async () => {
    if (restoring) return;
    setRestoring(true);
    let entitled = false;
    try {
      const result = await restorePurchases();
      entitled = !!(result.success && isProEntitled(result.customerInfo));
      if (entitled) {
        await refreshEntitlement(true);
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
      if (!entitled) void refreshEntitlement(false);
    }
  }, [restoring, refreshEntitlement]);

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
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.";
        Alert.alert(
          action === "subscribe"
            ? "Subscription error"
            : "Billing portal error",
          message,
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
    if (isPartner) {
      return {
        iconName: "award",
        iconBg: isDark ? "#1C2E24" : "#F0FAF4",
        iconColor: Colors.accent,
        title: "HomeBase Partner",
        body: "You have complimentary access to every Pro feature as a HomeBase Partner. Standard transaction fees still apply on payouts.",
        caption: "Reach out to support if you have any questions about your Partner status.",
      };
    }
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

  // Partners bypass the paywall entirely — no subscribe/manage controls,
  // since their access is admin-granted and not billed.
  const showSubscribeButton = !isSubscribed && !isPartner;

  const sourceLabel = (() => {
    switch (data?.subscriptionSource) {
      case "revenuecat_ios":
        return "Apple App Store";
      case "revenuecat_android":
        return "Google Play";
      case "stripe_web":
        return useIAP ? null : "Web";
      default:
        return null;
    }
  })();
  const renewalDate = data?.currentPeriodEnd
    ? new Date(data.currentPeriodEnd).toLocaleDateString()
    : null;

  // The displayed price: use live price from RevenueCat when available,
  // fall back to static copy so the screen is never blank.
  const displayedPrice = livePrice ?? "$29.99 / month";

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl * 2,
          paddingHorizontal: horizontalPadding,
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
        ) : isPartner ? (
          <PartnerPerksCard isDark={isDark} theme={theme} />
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

            {/* Price-aware info row — shown on all non-subscribed states so
                Apple Review can see pricing before the purchase confirmation.
                Satisfies App Review rule 3.1.1 (price must be visible in app).
                Shown only on iOS (IAP path); web/Android use Stripe. */}
            {useIAP && showSubscribeButton ? (
              <View
                style={[
                  styles.priceRow,
                  {
                    backgroundColor: isDark
                      ? "rgba(56,174,95,0.12)"
                      : "rgba(56,174,95,0.08)",
                    borderColor: Colors.accent + "33",
                  },
                ]}
                testID="price-info-row"
              >
                <Feather name="tag" size={14} color={Colors.accent} />
                <ThemedText
                  style={[styles.priceText, { color: Colors.accent }]}
                  testID="text-live-price"
                >
                  HomeBase Pro — {displayedPrice}
                </ThemedText>
              </View>
            ) : null}

            {/* Apple 3.1.2(c): EULA + Privacy must be visible BEFORE the
                purchase confirmation, not just in a footer. We render the
                same legal row above the Subscribe/Manage button on every
                state (free / grace / expired / subscribed). */}
            {isPartner ? null : (
              <View style={styles.legalRowAbove}>
                <Pressable
                  onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
                  hitSlop={8}
                  testID="link-terms-above"
                >
                  <ThemedText style={[styles.legalLink, { color: Colors.accent }]}>
                    Terms of Use (EULA)
                  </ThemedText>
                </Pressable>
                <ThemedText style={[styles.legalSep, { color: theme.textTertiary }]}>
                  ·
                </ThemedText>
                <Pressable
                  onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
                  hitSlop={8}
                  testID="link-privacy-above"
                >
                  <ThemedText style={[styles.legalLink, { color: Colors.accent }]}>
                    Privacy Policy
                  </ThemedText>
                </Pressable>
                <ThemedText style={[styles.legalSep, { color: theme.textTertiary }]}>
                  ·
                </ThemedText>
                <Pressable
                  onPress={handleContactSupport}
                  hitSlop={8}
                  testID="link-contact-support-above"
                >
                  <ThemedText style={[styles.legalLink, { color: Colors.accent }]}>
                    Contact support
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {/* Primary action — partners get no billing controls at all
                (their access is admin-granted, not billed). */}
            {isPartner ? null : showSubscribeButton ? (
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: pressed
                      ? Colors.accentPressed
                      : Colors.accent,
                    opacity: busy ? 0.6 : 1,
                  },
                ]}
                onPress={
                  useIAP
                    ? handleNativeSubscribe
                    : () => openStripeFlow("subscribe")
                }
                disabled={busy}
                testID="button-subscribe"
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="credit-card" size={16} color="#fff" />
                    <ThemedText style={styles.buttonText}>Subscribe</ThemedText>
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

            {/* Restore purchases — required by App Store reviewers.
                Hidden for partners since they have no purchase to restore. */}
            {isPartner ? null : useIAP ? (
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

          </View>
        )}

        {/* In-screen paywall failure card — shown instead of a dismissible
            alert so the user always has the error details + management path
            visible on screen. Includes product name, price, trial terms, and
            an App Store manage link so users can check their subscriptions.
            Cleared when the user retries Subscribe. */}
        {useIAP && paywallFailure ? (
          <View
            style={[
              styles.failureCard,
              {
                backgroundColor: isDark ? "#2a1a1a" : "#fff5f5",
                borderColor: "#dc262640",
              },
            ]}
            testID="paywall-failure-card"
          >
            <View style={styles.failureHeader}>
              <Feather name="alert-circle" size={16} color="#dc2626" />
              <ThemedText style={[styles.failureTitle, { color: "#dc2626" }]}>
                {paywallFailure.code
                  ? `Couldn't open subscription (error ${paywallFailure.code})`
                  : "Couldn't open subscription"}
              </ThemedText>
            </View>

            {/* Product summary — gives users pricing context even when the
                native paywall can't open. Satisfies App Review 3.1.1. */}
            <View
              style={[
                styles.failureProductRow,
                {
                  backgroundColor: isDark
                    ? "rgba(56,174,95,0.10)"
                    : "rgba(56,174,95,0.07)",
                  borderColor: Colors.accent + "30",
                },
              ]}
              testID="failure-product-row"
            >
              <ThemedText
                style={[styles.failureProductName, { color: theme.text }]}
                testID="text-failure-product-name"
              >
                HomeBase Pro
              </ThemedText>
              <ThemedText
                style={[styles.failureProductPrice, { color: Colors.accent }]}
                testID="text-failure-product-price"
              >
                {displayedPrice}
              </ThemedText>
              <ThemedText
                style={[styles.failureProductTrial, { color: theme.textTertiary }]}
                testID="text-failure-trial-terms"
              >
                Free until your first paid booking, then 7-day trial — no
                charge until the trial ends.
              </ThemedText>
            </View>

            <ThemedText
              style={[styles.failureBody, { color: theme.textSecondary }]}
              testID="text-paywall-failure-message"
            >
              {paywallFailure.message}
            </ThemedText>
            <View style={styles.failureActions}>
              <Pressable
                onPress={handleNativeSubscribe}
                disabled={busy}
                style={({ pressed }) => [
                  styles.failureRetryButton,
                  {
                    backgroundColor: pressed
                      ? Colors.accentPressed
                      : Colors.accent,
                    opacity: busy ? 0.6 : 1,
                  },
                ]}
                testID="button-paywall-retry"
              >
                <ThemedText style={styles.failureRetryText}>
                  Try again
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() =>
                  Linking.openURL(getManageSubscriptionUrl()).catch(() => {})
                }
                hitSlop={8}
                testID="button-paywall-manage-appstore"
              >
                <ThemedText
                  style={[styles.failureSupportLink, { color: Colors.accent }]}
                >
                  Manage in App Store
                </ThemedText>
              </Pressable>
            </View>
            <Pressable
              onPress={handleContactSupport}
              hitSlop={8}
              style={styles.failureContactRow}
              testID="button-paywall-failure-support"
            >
              <ThemedText
                style={[styles.failureSupportLink, { color: theme.textTertiary }]}
              >
                Still having trouble? Contact support
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {/* Legal + support quick links — ALWAYS visible on the Subscription
            screen so reviewers and users can find them in every state. */}
        <View style={styles.legalRow}>
          <Pressable
            onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
            hitSlop={8}
            testID="link-terms"
          >
            <ThemedText style={[styles.legalLink, { color: Colors.accent }]}>
              Terms of Use (EULA)
            </ThemedText>
          </Pressable>
          <ThemedText style={[styles.legalSep, { color: theme.textTertiary }]}>
            ·
          </ThemedText>
          <Pressable
            onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
            hitSlop={8}
            testID="link-privacy"
          >
            <ThemedText style={[styles.legalLink, { color: Colors.accent }]}>
              Privacy Policy
            </ThemedText>
          </Pressable>
          <ThemedText style={[styles.legalSep, { color: theme.textTertiary }]}>
            ·
          </ThemedText>
          <Pressable
            onPress={handleContactSupport}
            hitSlop={8}
            testID="link-contact-support"
          >
            <ThemedText style={[styles.legalLink, { color: Colors.accent }]}>
              Contact support
            </ThemedText>
          </Pressable>
          <ThemedText style={[styles.legalSep, { color: theme.textTertiary }]}>
            ·
          </ThemedText>
          <Pressable
            onPress={handleDeleteAccount}
            hitSlop={8}
            testID="link-delete-account"
          >
            <ThemedText style={[styles.legalLink, { color: Colors.accent }]}>
              Delete account
            </ThemedText>
          </Pressable>
        </View>

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

        {data?.firstPaidBookingAt && !isPartner ? (
          <ThemedText style={[styles.meta, { color: theme.textTertiary }]}>
            First paid booking:{" "}
            {new Date(data.firstPaidBookingAt).toLocaleDateString()}
          </ThemedText>
        ) : null}

        {/* Dev-mode diagnostics panel — expands significantly with
            getRevenueCatDiagnostics() output so error 23 is pinpointable. */}
        {__DEV__ && useIAP ? (
          <View
            style={[
              styles.debugBlock,
              {
                backgroundColor: isDark ? "#1A1A1A" : "#F5F5F5",
                borderColor: isDark ? "#333" : "#E0E0E0",
              },
            ]}
            testID="revenuecat-debug-panel"
          >
            <ThemedText
              style={[styles.debugTitle, { color: theme.textSecondary }]}
            >
              RevenueCat debug (dev only)
            </ThemedText>
            {/* EXPO_PUBLIC_REVENUECAT_API_KEY is a publishable RevenueCat
                SDK key (appl_…), NOT a secret. Showing a short prefix is
                safe and helps confirm the device is pointed at the right
                project. Do not replace with a server/secret key. */}
            <ThemedText
              style={[styles.debugLine, { color: theme.textTertiary }]}
              testID="text-debug-api-key"
            >
              API key:{" "}
              {process.env.EXPO_PUBLIC_REVENUECAT_API_KEY
                ? `${process.env.EXPO_PUBLIC_REVENUECAT_API_KEY.slice(0, 8)}…`
                : "(not set)"}
            </ThemedText>
            <ThemedText
              style={[styles.debugLine, { color: theme.textTertiary }]}
              testID="text-debug-bundle-id"
            >
              Bundle ID: {Constants.expoConfig?.ios?.bundleIdentifier ?? "(unknown)"}
            </ThemedText>
            <ThemedText
              style={[styles.debugLine, { color: theme.textTertiary }]}
              testID="text-debug-entitlement"
            >
              Entitlement: pro
            </ThemedText>
            <ThemedText
              style={[styles.debugLine, { color: theme.textTertiary }]}
              testID="text-debug-paywall"
            >
              Paywall: RevenueCatUI.presentPaywall()
            </ThemedText>

            {/* Diagnostics results */}
            {diagnosticsLoading ? (
              <ActivityIndicator
                size="small"
                color={Colors.accent}
                style={{ marginTop: Spacing.sm }}
              />
            ) : diagnostics ? (
              <>
                <View
                  style={[
                    styles.debugDivider,
                    { borderColor: isDark ? "#333" : "#E0E0E0" },
                  ]}
                />
                <ThemedText
                  style={[styles.debugSubtitle, { color: theme.textSecondary }]}
                >
                  Offerings diagnostics
                </ThemedText>
                <ThemedText
                  style={[styles.debugLine, { color: diagnostics.offeringsAvailable ? Colors.accent : "#dc2626" }]}
                  testID="text-debug-offerings-available"
                >
                  Offerings available: {diagnostics.offeringsAvailable ? "YES" : "NO"}
                </ThemedText>
                <ThemedText
                  style={[styles.debugLine, { color: theme.textTertiary }]}
                  testID="text-debug-default-offering"
                >
                  Default offering ID: {diagnostics.defaultOfferingId ?? "(none)"}
                </ThemedText>
                <ThemedText
                  style={[styles.debugLine, { color: theme.textTertiary }]}
                  testID="text-debug-package-count"
                >
                  Package count: {diagnostics.packageCount}
                </ThemedText>
                <ThemedText
                  style={[styles.debugLine, { color: theme.textTertiary }]}
                  testID="text-debug-product-id"
                >
                  First product ID: {diagnostics.firstPackageProductId ?? "(none)"}
                </ThemedText>
                <ThemedText
                  style={[styles.debugLine, { color: theme.textTertiary }]}
                  testID="text-debug-price-string"
                >
                  First product price: {diagnostics.firstPackagePriceString ?? "(none)"}
                </ThemedText>
                <ThemedText
                  style={[styles.debugLine, { color: diagnostics.entitlementActive ? Colors.accent : theme.textTertiary }]}
                  testID="text-debug-entitlement-active"
                >
                  Entitlement active: {diagnostics.entitlementActive ? "YES" : "NO"}
                </ThemedText>
                {diagnostics.error ? (
                  <ThemedText
                    style={[styles.debugLine, { color: "#dc2626" }]}
                    testID="text-debug-error"
                  >
                    Error {diagnostics.errorCode ? `(code ${diagnostics.errorCode})` : ""}: {diagnostics.error}
                  </ThemedText>
                ) : null}
                {diagnostics.rawOfferingsJson && diagnostics.rawOfferingsJson !== "{}" ? (
                  <>
                    <ThemedText
                      style={[styles.debugSubtitle, { color: theme.textSecondary, marginTop: Spacing.xs }]}
                    >
                      Raw offerings JSON
                    </ThemedText>
                    <ScrollView
                      style={styles.debugJsonScroll}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    >
                      <ThemedText
                        style={[styles.debugJson, { color: theme.textTertiary }]}
                        testID="text-debug-raw-offerings-json"
                      >
                        {diagnostics.rawOfferingsJson}
                      </ThemedText>
                    </ScrollView>
                  </>
                ) : null}
                {diagnostics.rawCustomerInfoJson && diagnostics.rawCustomerInfoJson !== "{}" ? (
                  <>
                    <ThemedText
                      style={[styles.debugSubtitle, { color: theme.textSecondary, marginTop: Spacing.xs }]}
                    >
                      Raw customer info JSON
                    </ThemedText>
                    <ScrollView
                      style={styles.debugJsonScroll}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    >
                      <ThemedText
                        style={[styles.debugJson, { color: theme.textTertiary }]}
                        testID="text-debug-raw-customer-json"
                      >
                        {diagnostics.rawCustomerInfoJson}
                      </ThemedText>
                    </ScrollView>
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

// ─── Partner perks card ──────────────────────────────────────────────────────
// Replaces the entire billing surface for HomeBase Partners (Task #220).
// No subscribe / manage / restore / billing-history controls render — Partner
// access is admin-granted and not billed. Shows the concrete perks they
// receive plus the standard transaction-fee disclosure.
const PARTNER_PERKS: Array<{
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
}> = [
  {
    icon: "gift",
    title: "Complimentary Pro access",
    body: "No monthly subscription. All Pro-gated features unlocked.",
  },
  {
    icon: "briefcase",
    title: "Unlimited jobs and invoices",
    body: "Run your full pipeline with no caps on bookings or billing.",
  },
  {
    icon: "cpu",
    title: "Smart Intake, AI Smart Match, and Dynamic Quote Engine",
    body: "Every AI workflow is on so leads come in qualified and priced.",
  },
  {
    icon: "link",
    title: "Booking links and branded messaging",
    body: "Public booking pages and email/SMS to clients with your brand.",
  },
  {
    icon: "headphones",
    title: "Priority support",
    body: "Reach the HomeBase team first when you need a hand.",
  },
];

interface PartnerPerksCardProps {
  isDark: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
}

function PartnerPerksCard({ isDark, theme }: PartnerPerksCardProps) {
  return (
    <View
      testID="subscription-card-partner"
      style={[
        styles.card,
        styles.partnerCard,
        {
          backgroundColor: isDark ? "#1C2E24" : "#F0FAF4",
          borderColor: Colors.accent + "40",
        },
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: Colors.accent + "22" },
        ]}
      >
        <Feather name="award" size={28} color={Colors.accent} />
      </View>

      <ThemedText style={styles.title}>You are a HomeBase Partner</ThemedText>
      <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
        Complimentary access to every Pro feature, granted by the HomeBase team.
        Your perks are below.
      </ThemedText>

      <View style={styles.perkList}>
        {PARTNER_PERKS.map((perk) => (
          <View key={perk.title} style={styles.perkRow} testID={`perk-${perk.icon}`}>
            <View
              style={[
                styles.perkIcon,
                { backgroundColor: Colors.accent + "1F" },
              ]}
            >
              <Feather name={perk.icon} size={16} color={Colors.accent} />
            </View>
            <View style={styles.perkText}>
              <ThemedText style={styles.perkTitle}>{perk.title}</ThemedText>
              <ThemedText
                style={[styles.perkBody, { color: theme.textSecondary }]}
              >
                {perk.body}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>

      <ThemedText
        style={[styles.partnerFootnote, { color: theme.textTertiary }]}
        testID="text-partner-fee-disclosure"
      >
        Standard platform transaction fees still apply on payouts.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { paddingVertical: Spacing.xl * 2, alignItems: "center" },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    marginBottom: Spacing.md,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  priceText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  debugBlock: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
  },
  debugTitle: {
    ...Typography.caption1,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  debugSubtitle: {
    ...Typography.caption1,
    fontWeight: "600",
    marginTop: Spacing.xs,
    marginBottom: 2,
  },
  debugDivider: {
    borderTopWidth: 1,
    marginVertical: Spacing.sm,
  },
  debugLine: {
    ...Typography.caption2,
    marginTop: 2,
  },
  debugJsonScroll: {
    maxHeight: 160,
    marginTop: 4,
  },
  debugJson: {
    ...Typography.caption2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    lineHeight: 16,
  },
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
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    flexWrap: "wrap",
  },
  legalRowAbove: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
    flexWrap: "wrap",
  },
  legalLink: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  legalSep: {
    ...Typography.caption1,
  },
  metaBlock: {
    marginTop: Spacing.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },
  meta: {
    ...Typography.caption1,
    textAlign: "center",
  },
  failureCard: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  failureHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  failureTitle: {
    ...Typography.subhead,
    fontWeight: "700",
    flex: 1,
  },
  failureBody: {
    ...Typography.caption1,
    lineHeight: 18,
  },
  failureActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  failureRetryButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.button,
  },
  failureRetryText: {
    color: "#fff",
    ...Typography.caption1,
    fontWeight: "700",
  },
  failureSupportLink: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  failureContactRow: {
    marginTop: Spacing.xs,
    alignSelf: "flex-start",
  },
  failureProductRow: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.sm,
    gap: 2,
  },
  failureProductName: {
    ...Typography.subhead,
    fontWeight: "700",
  },
  failureProductPrice: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  failureProductTrial: {
    ...Typography.caption2,
    lineHeight: 16,
    marginTop: 2,
  },
  partnerCard: {},
  perkList: {
    alignSelf: "stretch",
    gap: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  perkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  perkText: {
    flex: 1,
    gap: 2,
  },
  perkTitle: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  perkBody: {
    ...Typography.caption1,
    lineHeight: 18,
  },
  partnerFootnote: {
    ...Typography.caption2,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
