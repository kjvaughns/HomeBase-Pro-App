import React, { useState, useCallback, useEffect, useRef } from "react";
import { StyleSheet, View, ScrollView, ActivityIndicator, Pressable, Platform } from "react-native";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, useFocusEffect, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/state/authStore";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ReferralPromptModal } from "@/components/ReferralPromptModal";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";
import { trackEvent, AnalyticsEvents } from "@/lib/analytics";

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

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  // Task #289: deep-link safety — `route.params` is undefined when this
  // screen is opened via a bare `/payment-result` URL with no query
  // parameters. Destructuring directly threw and tripped the global
  // ErrorBoundary on web. Default to an empty object so we degrade
  // gracefully and the existing `!invoiceId` checks below show the
  // correct empty state.
  const { jobId, invoiceId, status } = (route.params ?? {}) as Partial<
    RootStackParamList["Payment"]
  >;

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [openedExternal, setOpenedExternal] = useState(false);
  // Task #478: gratuity for the provider. Percent presets are computed off
  // the job subtotal (not the processing fee) so "15%" always means 15% of
  // the work billed, matching homeowner expectations from restaurant tipping.
  const [tipPercent, setTipPercent] = useState<number | null>(null);
  const [customTipCents, setCustomTipCents] = useState<number | null>(null);
  const [showReferralPrompt, setShowReferralPrompt] = useState(false);
  const referralPromptShownRef = useRef(false);
  const [returnNotice, setReturnNotice] = useState<string | null>(
    status === "cancelled"
      ? "Payment cancelled — no charge was made. You can try again below."
      : status === "paid"
      ? "Payment received. Updating your invoice…"
      : null,
  );

  const { data: creditsData } = useQuery<{ balanceCents: number; balance: string }>({
    queryKey: ["/api/users/me/credits/history"],
    queryFn: async () => {
      const url = new URL("/api/users/me/credits/history", getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch credits");
      return res.json();
    },
    enabled: !!user?.id,
  });
  const creditBalanceCents = creditsData?.balanceCents ?? 0;

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ invoice: InvoiceRecord; payments: unknown[] }>({
    queryKey: ["/api/invoices", invoiceId],
    queryFn: async () => {
      const url = new URL(`/api/invoices/${invoiceId}`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch invoice");
      return res.json();
    },
    enabled: !!invoiceId,
    // Task #235: poll while the invoice is still unpaid so the screen flips
    // automatically once the Stripe webhook updates status server-side.
    refetchInterval: (query) => {
      const status = query.state.data?.invoice?.status;
      if (
        !status ||
        status === "paid" ||
        status === "void" ||
        status === "cancelled" ||
        status === "canceled"
      ) {
        return false;
      }
      return 5000;
    },
  });

  // Refresh invoice status whenever the screen regains focus (e.g., after the
  // homeowner returns from the external Stripe browser session via the
  // homebase://payment-result deep link).
  useFocusEffect(
    useCallback(() => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      }
    }, [refetch, queryClient, jobId])
  );

  // Auto-clear the "payment received" notice once the invoice flips to paid.
  useEffect(() => {
    if (data?.invoice?.status === "paid" && returnNotice) {
      setReturnNotice(null);
    }
  }, [data?.invoice?.status, returnNotice]);

  // Track invoice-paid event only on an actual unpaid → paid transition
  // observed during this mount. We snapshot the prior status and only fire
  // when it transitions, so opening an already-paid invoice does NOT
  // re-emit the analytics event. Also show referral prompt once per invoice.
  const lastInvoiceStatusRef = React.useRef<string | null>(null);
  useEffect(() => {
    const inv = data?.invoice;
    const status = inv?.status ?? null;
    const prev = lastInvoiceStatusRef.current;
    if (
      inv?.id &&
      status === "paid" &&
      prev !== null &&
      prev !== "paid"
    ) {
      trackEvent(AnalyticsEvents.InvoicePaid, {
        invoiceId: inv.id,
        amountCents: (inv as { totalCents?: number }).totalCents ?? null,
      });
      if (!referralPromptShownRef.current) {
        referralPromptShownRef.current = true;
        setTimeout(() => setShowReferralPrompt(true), 800);
      }
    }
    lastInvoiceStatusRef.current = status;
  }, [data?.invoice?.status, data?.invoice?.id]);

  // Sentinel thrown from inside the openExternalUrl callback when credits
  // fully cover the invoice. openExternalUrl propagates it as a normal
  // rejection (closing any blank web tab it pre-opened), and the outer
  // catch handles it as a success case rather than an error.
  const CREDITS_PAID = "__credits_paid__";

  const handlePayInvoice = async () => {
    setIsProcessing(true);
    setPaymentError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // On web, openExternalUrl opens a blank tab synchronously inside the
      // user-gesture call stack, then resolves the destination URL via this
      // callback (which can await network calls). This survives popup blockers.
      // On native it calls Linking.openURL once the URL is ready.
      await openExternalUrl(async () => {
        const url = new URL(`/api/invoices/${invoiceId}/checkout`, getApiUrl());
        const res = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify({ tipCents }),
        });
        if (!res.ok) {
          const errBody: { error?: string } = await res
            .json()
            .catch(() => ({ error: "Payment setup failed" }));
          if (res.status === 402 || errBody.error === "stripe_not_ready") {
            throw new Error(
              "This provider has not yet completed payment setup. Please contact them directly.",
            );
          }
          throw new Error(errBody.error || "Failed to start payment");
        }
        const body: { url?: string; status?: string } = await res.json();
        if (body.status === "paid") {
          // Credits fully covered the invoice — no Stripe redirect needed.
          // Throw a sentinel so openExternalUrl closes any blank web tab and
          // the outer catch can handle this as a success.
          throw new Error(CREDITS_PAID);
        }
        if (!body.url) throw new Error("No checkout URL received");
        return body.url;
      });
      setOpenedExternal(true);
    } catch (err) {
      if (err instanceof Error && err.message === CREDITS_PAID) {
        // Invoice fully paid by credits — show success and refresh data.
        await queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
        await queryClient.invalidateQueries({ queryKey: ["/api/users/me/credits/history"] });
        setReturnNotice("Your invoice was paid in full using your HomeBase credits! 🎉");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
      const message = err instanceof Error ? err.message : "Payment failed";
      setPaymentError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Guard against malformed deep links (e.g., homebase://payment-result with no
  // invoiceId). Without this, useQuery stays disabled and the user sees an
  // infinite spinner.
  if (!invoiceId) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Feather name="alert-circle" size={40} color={theme.textTertiary} />
        <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
          We couldn't read the payment link. Please return to your invoice and try again.
        </ThemedText>
        <Pressable
          onPress={() =>
            navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Main" }] }))
          }
          style={styles.backBtn}
          testID="button-payment-link-error-home"
        >
          <ThemedText style={{ color: Colors.accent }}>Go to Home</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

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
  const isPaid = invoice.status === "paid";

  const jobCents = invoice.totalCents || Math.round(parseFloat(totalAmount) * 100);
  // Task #478: tip is a percentage of the job subtotal, or a custom amount.
  // Recomputed from jobCents rather than stored directly so switching
  // presets always reflects the current invoice total.
  const tipCents =
    customTipCents !== null
      ? customTipCents
      : tipPercent
      ? Math.round((jobCents * tipPercent) / 100)
      : 0;
  const processingFeeCents = Math.round((jobCents + tipCents) * 0.029 + 30);
  const homeownerTotalCents = jobCents + tipCents + processingFeeCents;
  const homeownerTotal = (homeownerTotalCents / 100).toFixed(2);
  const processingFeeAmount = (processingFeeCents / 100).toFixed(2);
  const tipAmount = (tipCents / 100).toFixed(2);
  const effectiveJobId = jobId ?? invoice.jobId ?? null;

  if (isPaid) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <View style={[styles.successIconCircle, { backgroundColor: Colors.successLight }]}>
          <Feather name="check-circle" size={56} color={Colors.success} />
        </View>
        <ThemedText style={styles.successTitle}>Payment Complete</ThemedText>
        <ThemedText style={[styles.successSubtitle, { color: theme.textSecondary }]}>
          Your invoice has been paid successfully.
        </ThemedText>
        <PrimaryButton
          onPress={() => {
            if (effectiveJobId) {
              navigation.dispatch(
                CommonActions.reset({
                  index: 1,
                  routes: [
                    { name: "Main" },
                    { name: "JobDetail", params: { jobId: effectiveJobId } },
                  ],
                }),
              );
            } else {
              navigation.dispatch(
                CommonActions.reset({ index: 0, routes: [{ name: "Main" }] }),
              );
            }
          }}
          style={styles.successBtn}
          testID="button-view-job"
        >
          {effectiveJobId ? "View Job" : "Done"}
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
          paddingHorizontal: horizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {returnNotice ? (
          <View
            style={[
              styles.returnNotice,
              {
                backgroundColor: status === "cancelled" ? Colors.warningLight : Colors.successLight,
                borderColor: status === "cancelled" ? Colors.warning : Colors.success,
              },
            ]}
            testID="banner-payment-return"
          >
            <Feather
              name={status === "cancelled" ? "alert-circle" : "check-circle"}
              size={18}
              color={status === "cancelled" ? Colors.warning : Colors.success}
            />
            <ThemedText
              style={[
                styles.returnNoticeText,
                { color: status === "cancelled" ? Colors.warning : Colors.success },
              ]}
            >
              {returnNotice}
            </ThemedText>
          </View>
        ) : null}

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

          <View style={styles.feeBreakdownRow}>
            <ThemedText style={[styles.feeBreakdownLabel, { color: theme.textSecondary }]}>Job Total</ThemedText>
            <ThemedText style={[styles.feeBreakdownValue, { color: theme.textSecondary }]}>${parseFloat(totalAmount).toFixed(2)}</ThemedText>
          </View>
          {tipCents > 0 ? (
            <View style={styles.feeBreakdownRow}>
              <ThemedText style={[styles.feeBreakdownLabel, { color: theme.textSecondary }]}>Tip</ThemedText>
              <ThemedText style={[styles.feeBreakdownValue, { color: theme.textSecondary }]}>${tipAmount}</ThemedText>
            </View>
          ) : null}
          <View style={styles.feeBreakdownRow}>
            <View style={styles.feeBreakdownLabelRow}>
              <ThemedText style={[styles.feeBreakdownLabel, { color: theme.textSecondary }]}>Processing Fee</ThemedText>
              <ThemedText style={[styles.feeBreakdownNote, { color: theme.textTertiary }]}>  2.9% + $0.30</ThemedText>
            </View>
            <ThemedText style={[styles.feeBreakdownValue, { color: theme.textSecondary }]}>${processingFeeAmount}</ThemedText>
          </View>
          {creditBalanceCents > 0 ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
              <View style={[styles.creditRow, { backgroundColor: Colors.accentLight }]}>
                <Feather name="dollar-sign" size={14} color={Colors.accent} />
                <ThemedText style={[styles.creditRowText, { color: Colors.accent }]}>
                  ${(Math.min(creditBalanceCents, homeownerTotalCents) / 100).toFixed(2)} in credits will be applied automatically
                </ThemedText>
              </View>
            </>
          ) : null}
          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
          <View style={styles.totalRow}>
            <ThemedText style={styles.totalLabel}>Total Due</ThemedText>
            <ThemedText style={styles.totalAmount}>${homeownerTotal}</ThemedText>
          </View>
        </GlassCard>

        {!openedExternal ? (
          <GlassCard style={styles.invoiceCard}>
            <ThemedText style={styles.invoiceTitle}>Add a Tip</ThemedText>
            <ThemedText style={[styles.tipSubtitle, { color: theme.textSecondary }]}>
              100% of your tip goes to your provider.
            </ThemedText>
            <View style={styles.tipOptionsRow}>
              {[0, 10, 15, 20].map((pct) => {
                const selected = customTipCents === null && tipPercent === pct;
                return (
                  <Pressable
                    key={pct}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCustomTipCents(null);
                      setTipPercent(pct === 0 ? null : pct);
                    }}
                    style={[
                      styles.tipOption,
                      {
                        backgroundColor: selected ? Colors.accent : theme.backgroundSecondary,
                        borderColor: selected ? Colors.accent : theme.borderLight,
                      },
                    ]}
                    testID={`button-tip-${pct}`}
                  >
                    <ThemedText
                      style={[
                        styles.tipOptionText,
                        { color: selected ? "#FFFFFF" : theme.text },
                      ]}
                    >
                      {pct === 0 ? "No Tip" : `${pct}%`}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        ) : null}

        {openedExternal ? (
          <View style={[styles.waitingBox, { backgroundColor: theme.cardBackground, borderColor: Colors.accent + "40" }]}>
            <View style={[styles.waitingIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name="external-link" size={18} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.waitingTitle}>Finishing payment in your browser</ThemedText>
              <ThemedText style={[styles.waitingSub, { color: theme.textSecondary }]}>
                Complete payment on Stripe, then return to the app. We'll update this invoice as soon as Stripe confirms.
              </ThemedText>
              {isFetching ? (
                <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: Spacing.sm, alignSelf: "flex-start" }} />
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.infoBox}>
            <Feather name="external-link" size={16} color={theme.textSecondary} />
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              You'll be sent to Stripe in {Platform.OS === "android" ? "Chrome" : "Safari"} to complete payment securely. Return to the app when you're done.
            </ThemedText>
          </View>
        )}

      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.md, paddingHorizontal: horizontalPadding }]}>
        <PrimaryButton
          onPress={handlePayInvoice}
          disabled={isProcessing}
          loading={isProcessing}
          testID="button-pay-invoice"
        >
          {openedExternal
            ? `Reopen Stripe to Pay $${homeownerTotal}`
            : tipCents > 0
            ? `Pay $${homeownerTotal} (incl. $${tipAmount} tip)`
            : `Pay $${homeownerTotal} on Stripe`}
        </PrimaryButton>
        {paymentError ? (
          <View style={[styles.errorBox, { borderColor: Colors.error, marginTop: Spacing.sm }]} testID="text-payment-error">
            <Feather name="alert-circle" size={16} color={Colors.error} />
            <ThemedText style={styles.errorBoxText}>{paymentError}</ThemedText>
          </View>
        ) : null}
        <Pressable
          onPress={() => refetch()}
          disabled={isFetching}
          style={styles.altPayLink}
          testID="button-refresh-status"
        >
          <ThemedText style={[styles.altPayText, { color: theme.textSecondary }]}>
            {isFetching ? "Checking..." : "Check payment status"}
          </ThemedText>
        </Pressable>
      </View>

      <ReferralPromptModal
        visible={showReferralPrompt}
        onDismiss={() => setShowReferralPrompt(false)}
      />
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
  feeBreakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xs },
  feeBreakdownLabelRow: { flexDirection: "row", alignItems: "baseline", flex: 1 },
  feeBreakdownLabel: { ...Typography.body },
  feeBreakdownNote: { ...Typography.caption2, marginLeft: 4 },
  feeBreakdownValue: { ...Typography.body, fontWeight: "500" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { ...Typography.headline },
  totalAmount: { ...Typography.title1, fontWeight: "700", color: Colors.accent },
  waitingBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    borderRadius: BorderRadius.card,
    borderWidth: 1.5,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  waitingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  waitingTitle: { ...Typography.subhead, fontWeight: "600", marginBottom: 4 },
  waitingSub: { ...Typography.caption1, lineHeight: 18 },
  infoBox: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start", paddingHorizontal: Spacing.xs, marginBottom: Spacing.md },
  infoText: { ...Typography.body, flex: 1 },
  errorBox: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, backgroundColor: "#FEF2F2" },
  errorBoxText: { ...Typography.body, color: Colors.error, flex: 1 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  altPayLink: { alignItems: "center", paddingTop: Spacing.sm },
  altPayText: { ...Typography.subhead },
  successIconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: Spacing.xl },
  successTitle: { ...Typography.title1, fontWeight: "700", marginBottom: Spacing.sm, textAlign: "center" },
  successSubtitle: { ...Typography.body, textAlign: "center", marginBottom: Spacing.xl },
  successBtn: { width: "80%" },
  tipSubtitle: { ...Typography.caption1, marginTop: -Spacing.xs, marginBottom: Spacing.md },
  tipOptionsRow: { flexDirection: "row", gap: Spacing.sm },
  tipOption: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tipOptionText: { ...Typography.subhead, fontWeight: "600" },
  returnNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  returnNoticeText: { ...Typography.subhead, flex: 1, lineHeight: 20 },
  creditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  creditRowText: { ...Typography.caption1, fontWeight: "600", flex: 1 },
});
