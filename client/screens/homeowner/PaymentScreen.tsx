import React, { useState, useRef, useCallback, useEffect } from "react";
import { StyleSheet, View, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useStripe } from "@/lib/useStripePayment";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";
import { useAuthStore } from "@/state/authStore";

type ScreenRouteProp = RouteProp<RootStackParamList, "Payment">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  jobId?: string | null;
  status: string;
  amount: string;
  total: string;
  subtotalCents: number;
  totalCents: number;
  notes?: string | null;
  dueDate?: string | null;
  hostedInvoiceUrl?: string | null;
}

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
}

function brandLabel(brand: string) {
  const labels: Record<string, string> = {
    visa: "Visa", mastercard: "Mastercard", amex: "Amex",
    discover: "Discover", jcb: "JCB",
  };
  return labels[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { jobId, invoiceId } = route.params;
  const { sessionToken } = useAuthStore();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{ invoice: InvoiceRecord; payments: unknown[] }>({
    queryKey: ["/api/invoices", invoiceId],
    queryFn: async () => {
      const url = new URL(`/api/invoices/${invoiceId}`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch invoice");
      return res.json();
    },
    enabled: !!invoiceId,
  });

  const { data: pmData } = useQuery<{ paymentMethods: SavedCard[]; defaultPaymentMethodId: string | null }>({
    queryKey: ["/api/homeowner/payment-methods"],
    queryFn: async () => {
      const url = new URL("/api/homeowner/payment-methods", getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) return { paymentMethods: [], defaultPaymentMethodId: null };
      return res.json();
    },
  });

  const defaultCard = pmData?.paymentMethods?.find((c) => c.isDefault) ?? pmData?.paymentMethods?.[0] ?? null;

  useEffect(() => {
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((onPaid: () => void) => {
    const authHeaders: Record<string, string> = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const url = new URL(`/api/invoices/${invoiceId}`, getApiUrl());
        const res = await fetch(url.toString(), { headers: authHeaders, credentials: "include" });
        if (res.ok) {
          const d = await res.json();
          if (d?.invoice?.status === "paid") { stopPolling(); onPaid(); }
        }
      } catch {}
    }, 3000);
  }, [invoiceId, sessionToken, stopPolling]);

  const markSuccess = useCallback(() => {
    setPaymentSuccess(true);
    queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [queryClient, invoiceId]);

  const handlePayWithSavedCard = async () => {
    setIsProcessing(true);
    setPaymentError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const url = new URL("/api/homeowner/payment-sheet", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ invoiceId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Payment setup failed" }));
        if (res.status === 402 || body.error === "stripe_not_ready") {
          throw new Error("This provider has not yet completed payment setup. Please contact them directly.");
        }
        throw new Error(body.error || "Failed to start payment");
      }

      const { paymentIntentClientSecret, ephemeralKeySecret, customerId } = await res.json();

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "HomeBase Pro",
        customerId,
        customerEphemeralKeySecret: ephemeralKeySecret,
        paymentIntentClientSecret,
        defaultBillingDetails: {},
        allowsDelayedPaymentMethods: false,
        appearance: { colors: { primary: Colors.accent } },
      });

      if (initError) throw new Error(initError.message);

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === "Canceled") return;
        throw new Error(presentError.message);
      }

      markSuccess();
    } catch (err) {
      stopPolling();
      const message = err instanceof Error ? err.message : "Payment failed";
      setPaymentError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayWithHostedCheckout = async () => {
    setIsProcessing(true);
    setPaymentError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const url = new URL(`/api/invoices/${invoiceId}/checkout`, getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Payment setup failed" }));
        if (res.status === 402 || errBody.error === "stripe_not_ready") {
          throw new Error("This provider has not yet completed payment setup. Please contact them directly.");
        }
        throw new Error(errBody.error || "Failed to start payment");
      }
      const { url: checkoutUrl } = await res.json();
      if (!checkoutUrl) throw new Error("No checkout URL received");

      startPolling(() => {
        WebBrowser.dismissBrowser();
        markSuccess();
      });

      await WebBrowser.openBrowserAsync(checkoutUrl);
      stopPolling();

      const refreshed = await refetch();
      const status = (refreshed.data as any)?.invoice?.status;
      if (status === "paid") {
        markSuccess();
      } else {
        navigation.dispatch(CommonActions.reset({ index: 1, routes: [{ name: "Main" }, { name: "JobDetail", params: { jobId } }] }));
      }
    } catch (err) {
      stopPolling();
      const message = err instanceof Error ? err.message : "Payment failed";
      setPaymentError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </ThemedView>
    );
  }

  if (isError || !data?.invoice) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Feather name="alert-circle" size={40} color={theme.textTertiary} />
        <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>Invoice not found</ThemedText>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ThemedText style={{ color: Colors.accent }}>Go back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const invoice = data.invoice;
  const totalAmount = invoice.total || invoice.amount || "0.00";
  const isPaid = invoice.status === "paid" || paymentSuccess;

  if (paymentSuccess || isPaid) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <View style={[styles.successIconCircle, { backgroundColor: "#D1FAE5" }]}>
          <Feather name="check-circle" size={56} color="#065F46" />
        </View>
        <ThemedText style={styles.successTitle}>Payment Complete</ThemedText>
        <ThemedText style={[styles.successSubtitle, { color: theme.textSecondary }]}>
          Your invoice has been paid successfully.
        </ThemedText>
        <PrimaryButton
          onPress={() => navigation.dispatch(CommonActions.reset({ index: 1, routes: [{ name: "Main" }, { name: "JobDetail", params: { jobId } }] }))}
          style={styles.successBtn}
        >
          View Job
        </PrimaryButton>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + 140,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.invoiceCard}>
          <View style={styles.invoiceHeader}>
            <ThemedText style={styles.invoiceTitle}>Invoice Summary</ThemedText>
            <View style={[styles.statusBadge, { backgroundColor: Colors.accentLight }]}>
              <ThemedText style={[styles.statusText, { color: Colors.accent }]}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.invoiceNumber}>
            <ThemedText style={[styles.invoiceNumLabel, { color: theme.textSecondary }]}>Invoice</ThemedText>
            <ThemedText style={styles.invoiceNumValue}>{invoice.invoiceNumber}</ThemedText>
          </View>

          {invoice.dueDate ? (
            <View style={styles.dueDateRow}>
              <Feather name="calendar" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.dueDateText, { color: theme.textSecondary }]}>
                Due {new Date(invoice.dueDate).toLocaleDateString()}
              </ThemedText>
            </View>
          ) : null}

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          {invoice.notes ? (
            <View style={styles.notesRow}>
              <ThemedText style={[styles.notesLabel, { color: theme.textSecondary }]}>Notes</ThemedText>
              <ThemedText style={styles.notesText}>{invoice.notes}</ThemedText>
              <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
            </View>
          ) : null}

          <View style={styles.totalRow}>
            <ThemedText style={styles.totalLabel}>Total Due</ThemedText>
            <ThemedText style={styles.totalAmount}>${parseFloat(totalAmount).toFixed(2)}</ThemedText>
          </View>
        </GlassCard>

        {defaultCard ? (
          <View style={[styles.savedCardBanner, { backgroundColor: theme.cardBackground, borderColor: Colors.accent + "40" }]}>
            <View style={[styles.savedCardIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name="credit-card" size={18} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.savedCardLabel}>
                {brandLabel(defaultCard.brand)} ••••{defaultCard.last4}
              </ThemedText>
              <ThemedText style={[styles.savedCardSub, { color: theme.textSecondary }]}>
                Card on file — tap to pay instantly
              </ThemedText>
            </View>
            <Feather name="check-circle" size={18} color={Colors.accent} />
          </View>
        ) : (
          <View style={styles.infoBox}>
            <Feather name="lock" size={16} color={theme.textSecondary} />
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              Secure payment powered by Stripe.
            </ThemedText>
          </View>
        )}

        {paymentError ? (
          <View style={[styles.errorBox, { borderColor: "#EF4444" }]}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
            <ThemedText style={styles.errorBoxText}>{paymentError}</ThemedText>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.md }]}>
        {defaultCard ? (
          <>
            <PrimaryButton
              onPress={handlePayWithSavedCard}
              disabled={isProcessing}
              loading={isProcessing}
              testID="button-pay-saved-card"
            >
              {`Pay $${parseFloat(totalAmount).toFixed(2)} with ${brandLabel(defaultCard.brand)} ••••${defaultCard.last4}`}
            </PrimaryButton>
            <Pressable
              onPress={handlePayWithHostedCheckout}
              disabled={isProcessing}
              style={styles.altPayLink}
              testID="button-pay-other-method"
            >
              <ThemedText style={[styles.altPayText, { color: theme.textSecondary }]}>
                Use a different card
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <PrimaryButton
            onPress={handlePayWithSavedCard}
            disabled={isProcessing}
            loading={isProcessing}
            testID="button-pay-invoice"
          >
            {`Pay $${parseFloat(totalAmount).toFixed(2)}`}
          </PrimaryButton>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  errorText: { ...Typography.subhead, marginTop: Spacing.md, marginBottom: Spacing.sm },
  backBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  invoiceCard: { marginBottom: Spacing.lg },
  invoiceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  invoiceTitle: { ...Typography.headline },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.sm },
  statusText: { ...Typography.caption1, fontWeight: "600" },
  invoiceNumber: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.xs },
  invoiceNumLabel: { ...Typography.body },
  invoiceNumValue: { ...Typography.body, fontWeight: "600" },
  dueDateRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.md },
  dueDateText: { ...Typography.caption1 },
  divider: { height: 1, marginVertical: Spacing.md },
  notesRow: { marginBottom: 0 },
  notesLabel: { ...Typography.caption1, marginBottom: Spacing.xs },
  notesText: { ...Typography.body, marginBottom: Spacing.sm },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { ...Typography.headline },
  totalAmount: { ...Typography.title1, fontWeight: "700", color: Colors.accent },
  savedCardBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: BorderRadius.card,
    borderWidth: 1.5,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  savedCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  savedCardLabel: { ...Typography.subhead, fontWeight: "600" },
  savedCardSub: { ...Typography.caption1 },
  infoBox: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start", paddingHorizontal: Spacing.xs, marginBottom: Spacing.md },
  infoText: { ...Typography.body, flex: 1 },
  errorBox: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, backgroundColor: "#FEF2F2" },
  errorBoxText: { ...Typography.body, color: "#EF4444", flex: 1 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  altPayLink: { alignItems: "center", paddingTop: Spacing.sm },
  altPayText: { ...Typography.subhead },
  successIconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: Spacing.xl },
  successTitle: { ...Typography.title1, fontWeight: "700", marginBottom: Spacing.sm, textAlign: "center" },
  successSubtitle: { ...Typography.body, textAlign: "center", marginBottom: Spacing.xl, paddingHorizontal: Spacing.screenPadding },
  successBtn: { width: "80%" },
});
