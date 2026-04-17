import React, { useState, useCallback } from "react";
import { StyleSheet, View, ScrollView, ActivityIndicator, Pressable, Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, useFocusEffect, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";

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
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { jobId, invoiceId } = route.params;

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [openedExternal, setOpenedExternal] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ invoice: InvoiceRecord; payments: unknown[] }>({
    queryKey: ["/api/invoices", invoiceId],
    queryFn: async () => {
      const url = new URL(`/api/invoices/${invoiceId}`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch invoice");
      return res.json();
    },
    enabled: !!invoiceId,
  });

  // Refresh invoice status whenever the screen regains focus (e.g., after the
  // homeowner returns from the external Stripe browser session).
  useFocusEffect(
    useCallback(() => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    }, [refetch, queryClient])
  );

  const handlePayInvoice = async () => {
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

      const canOpen = await Linking.canOpenURL(checkoutUrl);
      if (!canOpen) throw new Error("Unable to open payment page");

      // Use Linking.openURL to launch the device's default external browser
      // (Safari on iOS, Chrome on Android), NOT an in-app browser. App Store
      // guidelines require homeowner payments happen outside the app.
      await Linking.openURL(checkoutUrl);
      setOpenedExternal(true);
    } catch (err) {
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
  const isPaid = invoice.status === "paid";

  if (isPaid) {
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
          testID="button-view-job"
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

        {paymentError ? (
          <View style={[styles.errorBox, { borderColor: "#EF4444" }]}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
            <ThemedText style={styles.errorBoxText}>{paymentError}</ThemedText>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.md }]}>
        <PrimaryButton
          onPress={handlePayInvoice}
          disabled={isProcessing}
          loading={isProcessing}
          testID="button-pay-invoice"
        >
          {openedExternal
            ? `Reopen Stripe to Pay $${parseFloat(totalAmount).toFixed(2)}`
            : `Pay $${parseFloat(totalAmount).toFixed(2)} on Stripe`}
        </PrimaryButton>
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
