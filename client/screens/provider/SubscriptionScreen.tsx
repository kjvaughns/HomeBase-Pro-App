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
  fetchProOffering,
  purchasePackage,
  restorePurchases,
  getManageSubscriptionUrl,
  isProEntitled,
  type PurchasesOffering,
  type PurchasesPackage,
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

type OfferingState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; offering: PurchasesOffering }
  | { kind: "empty"; reason: string }
  | { kind: "error"; message: string; errorCode?: string };

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
  const [offeringState, setOfferingState] = useState<OfferingState>(
    isPurchasesAvailable() ? { kind: "loading" } : { kind: "idle" },
  );
  const fetchTokenRef = React.useRef(0);

  const useIAP = isPurchasesAvailable();

  const loadOffering = useCallback(() => {
    if (!useIAP) return;
    const token = ++fetchTokenRef.current;
    setOfferingState({ kind: "loading" });
    fetchProOffering()
      .then((result) => {
        // Drop stale results if a newer fetch was kicked off (e.g. Retry).
        if (token !== fetchTokenRef.current) return;
        if (result.status === "ok") {
          setOfferingState({ kind: "ok", offering: result.offering });
        } else if (result.status === "empty") {
          setOfferingState({ kind: "empty", reason: result.reason });
        } else {
          setOfferingState({
            kind: "error",
            message: result.errorMessage,
            errorCode: result.errorCode,
          });
        }
      })
      .catch((err) => {
        if (token !== fetchTokenRef.current) return;
        setOfferingState({
          kind: "error",
          message:
            err?.message ||
            "Couldn't reach the App Store. Check your connection and try again.",
        });
      });
  }, [useIAP]);

  // Load the current RevenueCat offering on mount (native only). Re-load when
  // the signed-in provider changes so receipts attach to the right account.
  useEffect(() => {
    loadOffering();
    return () => {
      // Invalidate any in-flight fetch on unmount.
      fetchTokenRef.current++;
    };
  }, [loadOffering, providerId]);

  const offering =
    offeringState.kind === "ok" ? offeringState.offering : null;
  const loadingOffering = offeringState.kind === "loading";

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

  const proPackage: PurchasesPackage | null =
    offering?.monthly ?? offering?.availablePackages?.[0] ?? null;
  const nativePriceLabel = proPackage?.product?.priceString ?? null;
  // Web fallback: we don't hardcode a marketing price — Stripe owns the
  // canonical price. The "Subscribe" button works without the price label;
  // the localized native price (StoreKit/Play Billing) is shown when available.
  const priceLabel = useIAP ? nativePriceLabel : null;

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
    let entitled = false;
    try {
      const result = await purchasePackage(proPackage);
      entitled = !!(result.success && isProEntitled(result.customerInfo));
      if (entitled) {
        await refreshEntitlement(true);
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
      // Reconcile with server even on cancel/failure to avoid stale state.
      if (!entitled) void refreshEntitlement(false);
    }
  }, [busy, proPackage, refreshEntitlement]);

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
  const subscribeLabel = priceLabel
    ? stateKey === "free"
      ? `Subscribe early — ${priceLabel}`
      : `Subscribe — ${priceLabel}`
    : "Subscribe";

  const showDisclosure = !!priceLabel;

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
              useIAP && offeringState.kind === "loading" ? (
                <View
                  style={[styles.button, styles.skeletonButton]}
                  testID="subscribe-loading-skeleton"
                >
                  <ActivityIndicator size="small" color={Colors.accent} />
                  <ThemedText
                    style={[
                      styles.skeletonText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Loading subscription…
                  </ThemedText>
                </View>
              ) : useIAP &&
                (offeringState.kind === "error" ||
                  offeringState.kind === "empty") ? (
                <View
                  style={styles.errorBlock}
                  testID="subscribe-error-block"
                >
                  <ThemedText
                    style={[
                      styles.errorTitle,
                      { color: theme.text },
                    ]}
                  >
                    {offeringState.kind === "empty"
                      ? "Subscriptions aren't available right now"
                      : "Couldn't load subscription"}
                  </ThemedText>
                  <ThemedText
                    style={[styles.caption, { color: theme.textSecondary }]}
                  >
                    {offeringState.kind === "empty"
                      ? "We can't show subscription pricing right now. Please try again shortly or contact support if this keeps happening."
                      : offeringState.message}
                  </ThemedText>
                  {offeringState.kind === "error" && offeringState.errorCode ? (
                    <ThemedText
                      style={[styles.caption, { color: theme.textTertiary }]}
                      testID="text-offering-error-code"
                    >
                      Error code: {offeringState.errorCode}
                    </ThemedText>
                  ) : null}
                  <View style={styles.errorActions}>
                    <Pressable
                      onPress={loadOffering}
                      disabled={loadingOffering}
                      style={({ pressed }) => [
                        styles.button,
                        styles.retryButton,
                        {
                          backgroundColor: pressed
                            ? Colors.accentPressed
                            : Colors.accent,
                          opacity: loadingOffering ? 0.6 : 1,
                        },
                      ]}
                      testID="button-retry-offering"
                    >
                      <Feather name="refresh-cw" size={16} color="#fff" />
                      <ThemedText style={styles.buttonText}>Retry</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={handleContactSupport}
                      style={styles.secondaryButton}
                      testID="button-contact-support-error"
                    >
                      <ThemedText
                        style={[
                          styles.secondaryButtonText,
                          { color: Colors.accent },
                        ]}
                      >
                        Contact support
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              ) : (
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
                  disabled={busy || (useIAP && !proPackage)}
                  testID="button-subscribe"
                >
                  {busy ? (
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
              )
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

        {/* Apple-required renewal disclosure — only when we have a real
            localized price (or the marketing price on web). */}
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
              testID="text-debug-entitlement"
            >
              Entitlement: pro
            </ThemedText>
            <ThemedText
              style={[styles.debugLine, { color: theme.textTertiary }]}
              testID="text-debug-offering-state"
            >
              Offering state: {offeringState.kind}
            </ThemedText>
            {offeringState.kind === "ok" ? (
              <>
                <ThemedText
                  style={[styles.debugLine, { color: theme.textTertiary }]}
                  testID="text-debug-current-offering"
                >
                  Current offering: {offeringState.offering.identifier}
                </ThemedText>
                <ThemedText
                  style={[styles.debugLine, { color: theme.textTertiary }]}
                >
                  Packages ({offeringState.offering.availablePackages.length}):
                </ThemedText>
                {offeringState.offering.availablePackages.map((pkg) => (
                  <ThemedText
                    key={pkg.identifier}
                    style={[styles.debugLine, { color: theme.textTertiary }]}
                    testID={`text-debug-package-${pkg.identifier}`}
                  >
                    {"  • "}
                    {pkg.identifier} → {pkg.product.identifier} (
                    {pkg.product.priceString})
                  </ThemedText>
                ))}
              </>
            ) : offeringState.kind === "empty" ? (
              <ThemedText
                style={[styles.debugLine, { color: theme.textTertiary }]}
              >
                Empty: {offeringState.reason}
              </ThemedText>
            ) : offeringState.kind === "error" ? (
              <ThemedText
                style={[styles.debugLine, { color: theme.textTertiary }]}
              >
                Error loading offering
                {offeringState.errorCode
                  ? ` (code ${offeringState.errorCode})`
                  : ""}
              </ThemedText>
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
  debugLine: {
    ...Typography.caption2,
    marginTop: 2,
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
  legalRowAbove: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    alignSelf: "stretch",
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
  partnerCard: {
    alignItems: "stretch",
  },
  perkList: {
    alignSelf: "stretch",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  perkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  perkText: {
    flex: 1,
  },
  perkTitle: {
    ...Typography.subhead,
    fontWeight: "700",
    marginBottom: 2,
  },
  perkBody: {
    ...Typography.footnote,
    lineHeight: 18,
  },
  partnerFootnote: {
    ...Typography.caption1,
    textAlign: "center",
    alignSelf: "stretch",
  },
  errorBlock: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  errorTitle: {
    ...Typography.subhead,
    fontWeight: "700",
    textAlign: "center",
  },
  errorActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  retryButton: {
    flexShrink: 1,
    alignSelf: "auto",
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
  },
  skeletonButton: {
    backgroundColor: "rgba(127, 127, 127, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(127, 127, 127, 0.18)",
  },
  skeletonText: {
    ...Typography.callout,
    fontWeight: "600",
  },
});
