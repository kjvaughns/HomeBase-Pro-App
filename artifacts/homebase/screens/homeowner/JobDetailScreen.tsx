import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, useFocusEffect, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { formatMoney, formatDate } from "@/lib/format";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ShareProviderModal } from "@/components/ShareProviderModal";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";
import { useAuthStore } from "@/state/authStore";
import { recordHappyMoment } from "@/state/appReviewStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ScreenRouteProp = RouteProp<RootStackParamList, "JobDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AppointmentRecord {
  id: string;
  userId: string;
  providerId: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  estimatedPrice: string | null;
  finalPrice: string | null;
  description: string | null;
  notes: string | null;
  providerDiagnosis: string | null;
  completedAt: string | null;
}

interface ReviewRecord {
  id: string;
  rating: number;
  comment?: string | null;
}

const REVIEW_ELIGIBLE_STATUSES = new Set([
  "completed",
  "paid",
  "closed",
  "awaiting_payment",
]);

interface ProviderInfo {
  businessName: string;
  phone?: string | null;
  email?: string | null;
  slug?: string | null;
}

interface JobRecord {
  id: string;
  title: string;
  status: string;
  appointmentId: string | null;
}

interface InvoiceRecord {
  id: string;
  invoiceNumber: string | null;
  status: string;
  total?: string | null;
  amount?: string | null;
  totalAmount?: string | null;
  dueDate: string | null;
  paidAt: string | null;
  hostedInvoiceUrl?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; status: "success" | "info" | "warning" | "neutral" }> = {
  pending: { label: "Pending", status: "info" },
  confirmed: { label: "Confirmed", status: "info" },
  scheduled: { label: "Scheduled", status: "info" },
  in_progress: { label: "In Progress", status: "warning" },
  awaiting_payment: { label: "Awaiting Payment", status: "warning" },
  completed: { label: "Completed", status: "success" },
  paid: { label: "Paid", status: "success" },
  closed: { label: "Closed", status: "neutral" },
  cancelled: { label: "Cancelled", status: "neutral" },
};


export default function JobDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  // Task #289: deep-link safety — `route.params` is undefined when this
  // screen is opened via a bare `/job/` URL without an id, which threw
  // and tripped the global ErrorBoundary on web. Default to an empty
  // object so the `!jobId` paths below render their friendly empty state.
  const { jobId } = (route.params ?? {}) as Partial<RootStackParamList["JobDetail"]>;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Refresh appointment + invoice when screen regains focus (e.g., after
  // returning from the Stripe-hosted invoice in an external browser) so
  // payment status syncs without requiring a manual reload.
  useFocusEffect(
    React.useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    }, [queryClient, jobId])
  );

  const { data: aptData, isLoading } = useQuery<{ appointment: AppointmentRecord; provider: ProviderInfo | null; review?: ReviewRecord | null }>({
    queryKey: ["/api/appointments", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const url = new URL(`/api/appointments/${jobId}`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) throw new Error("Failed to load appointment");
      return res.json();
    },
  });

  const { data: jobData } = useQuery<{ job: JobRecord | null }>({
    queryKey: ["/api/appointments", jobId, "job"],
    enabled: !!jobId,
    queryFn: async () => {
      const url = new URL(`/api/appointments/${jobId}/job`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) return { job: null };
      return res.json();
    },
  });

  const linkedJob = jobData?.job;

  const { data: invoiceData } = useQuery<{ invoice: InvoiceRecord | null }>({
    queryKey: ["/api/jobs", linkedJob?.id, "invoice"],
    enabled: !!linkedJob?.id,
    queryFn: async () => {
      const url = new URL(`/api/jobs/${linkedJob!.id}/invoice`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) return { invoice: null };
      return res.json();
    },
  });

  const [invoiceError, setInvoiceError] = React.useState<string | null>(null);
  const [isOpeningInvoice, setIsOpeningInvoice] = React.useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  // Guard against double-trigger in the same React tree lifecycle
  const shareCheckInFlightRef = useRef(false);

  const invoice = invoiceData?.invoice;
  const appointment = aptData?.appointment;
  const provider = aptData?.provider;
  const review = aptData?.review ?? null;
  const isHomeowner = !!appointment && !!user && appointment.userId === user.id;

  // Fire once when the homeowner views a completed/paid appointment.
  // Deduped per appointment ID; counts from the 2nd completed job onward.
  // Also show share-provider prompt on first view of a just-completed job.
  // Persisted via AsyncStorage so remounting the screen never re-shows the modal.
  useEffect(() => {
    if (!appointment || appointment.status !== "completed" || !isHomeowner || !provider) return;

    recordHappyMoment("homeowner_job_completed", { payload: { jobId: appointment.id } }).catch(() => {});

    if (shareCheckInFlightRef.current) return;
    shareCheckInFlightRef.current = true;

    const storageKey = `share_provider_shown_${appointment.id}`;
    AsyncStorage.getItem(storageKey).then((val) => {
      if (val === "1") return; // already shown for this job
      AsyncStorage.setItem(storageKey, "1").catch(() => {});
      setTimeout(() => setShowShareModal(true), 1200);
    }).catch(() => {
      shareCheckInFlightRef.current = false;
    });
  }, [appointment?.id, appointment?.status, isHomeowner, !!provider]);
  const canReview =
    !!appointment &&
    isHomeowner &&
    REVIEW_ELIGIBLE_STATUSES.has(appointment.status || "");
  const hasReview = !!review;

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.centered, { paddingTop: headerHeight }]}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </ThemedView>
    );
  }

  if (!appointment) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.centered, { paddingTop: headerHeight }]}>
          <Feather name="inbox" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            Appointment not found
          </ThemedText>
          <Pressable
            onPress={() => queryClient.invalidateQueries({ queryKey: ["/api/appointments", jobId] })}
            style={{ marginTop: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm }}
          >
            <ThemedText style={{ color: Colors.accent, fontWeight: "600" }}>Try again</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const statusKey = appointment.status || "pending";
  const statusConfig = STATUS_CONFIG[statusKey] || { label: statusKey, status: "neutral" as const };
  const price = appointment.finalPrice || appointment.estimatedPrice;

  const isInvoicePaidOrClosed =
    invoice && (invoice.status === "paid" || invoice.status === "closed");
  const showInvoiceCta = !!invoice;

  const handlePayInvoice = async () => {
    if (!invoice) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setInvoiceError(null);
    setIsOpeningInvoice(true);
    try {
      let url = invoice.hostedInvoiceUrl;
      if (!url) {
        const requestUrl = new URL(
          `/api/invoices/${invoice.id}/payment-link`,
          getApiUrl(),
        );
        const res = await fetch(requestUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const errBody: { error?: string } = await res
            .json()
            .catch(() => ({}));
          throw new Error(
            errBody.error || "We couldn't load this invoice. Please try again.",
          );
        }
        const body: { url?: string } = await res.json();
        url = body.url ?? null;
      }
      if (!url) {
        throw new Error(
          "This invoice isn't ready for online payment yet. Please contact your provider.",
        );
      }
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "We couldn't open this invoice right now. Please try again in a moment.";
      setInvoiceError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsOpeningInvoice(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: horizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <GlassCard style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View style={[styles.iconCircle, { backgroundColor: Colors.accentLight }]}>
                <Feather name="tool" size={24} color={Colors.accent} />
              </View>
              <View style={styles.headerInfo}>
                <ThemedText style={styles.serviceName}>{appointment.serviceName || "Service"}</ThemedText>
                <ThemedText style={[styles.providerInfo, { color: theme.textSecondary }]}>
                  {provider?.businessName || "Service Provider"}
                </ThemedText>
              </View>
              <StatusPill
                label={statusConfig.label}
                status={statusConfig.status}
              />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Details</ThemedText>
            <View style={[styles.detailCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
              {appointment.scheduledDate ? (
                <View style={styles.detailRow}>
                  <Feather name="calendar" size={18} color={theme.textSecondary} />
                  <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Date</ThemedText>
                  <ThemedText style={styles.detailValue}>{formatDate(appointment.scheduledDate, { style: "weekday" })}</ThemedText>
                </View>
              ) : null}
              {appointment.scheduledTime ? (
                <View style={styles.detailRow}>
                  <Feather name="clock" size={18} color={theme.textSecondary} />
                  <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Time</ThemedText>
                  <ThemedText style={styles.detailValue}>{appointment.scheduledTime}</ThemedText>
                </View>
              ) : null}
              {provider?.phone ? (
                <View style={styles.detailRow}>
                  <Feather name="phone" size={18} color={theme.textSecondary} />
                  <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Phone</ThemedText>
                  <ThemedText style={styles.detailValue}>{provider.phone}</ThemedText>
                </View>
              ) : null}
              {provider?.email ? (
                <View style={[styles.detailRow, { borderBottomWidth: appointment.description ? 1 : 0 }]}>
                  <Feather name="mail" size={18} color={theme.textSecondary} />
                  <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Email</ThemedText>
                  <ThemedText style={styles.detailValue} numberOfLines={1}>{provider.email}</ThemedText>
                </View>
              ) : null}
              {appointment.description ? (
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <Feather name="file-text" size={18} color={theme.textSecondary} />
                  <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Notes</ThemedText>
                  <ThemedText style={styles.detailValue} numberOfLines={3}>{appointment.description}</ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>

        {price ? (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Pricing</ThemedText>
              <View style={[styles.detailCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <Feather name="dollar-sign" size={18} color={theme.textSecondary} />
                  <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                    {appointment.finalPrice ? "Final Price" : "Estimated"}
                  </ThemedText>
                  <ThemedText style={[styles.detailValue, { color: Colors.accent }]}>
                    {formatMoney(parseFloat(price))}
                  </ThemedText>
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}

        {invoice ? (
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Invoice</ThemedText>
              <GlassCard style={styles.invoiceCard}>
                <View style={styles.invoiceRow}>
                  <View>
                    <ThemedText style={styles.invoiceNumber}>
                      {invoice.invoiceNumber || `Invoice #${invoice.id.slice(-6)}`}
                    </ThemedText>
                    <ThemedText style={[styles.invoiceStatus, {
                      color: invoice.status === "paid" ? Colors.accent : Colors.warning
                    }]}>
                      {invoice.status === "paid" ? "Paid" : invoice.status === "sent" ? "Payment Due" : invoice.status.toUpperCase()}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.invoiceAmount}>
                    {formatMoney(parseFloat(invoice.total || invoice.amount || invoice.totalAmount || "0"))}
                  </ThemedText>
                </View>
                {invoice.dueDate ? (
                  <ThemedText style={[styles.dueDateText, { color: theme.textSecondary }]}>
                    Due: {formatDate(invoice.dueDate, { style: "short" })}
                  </ThemedText>
                ) : null}
                {showInvoiceCta ? (
                  <View style={{ marginTop: Spacing.md }}>
                    <PrimaryButton
                      onPress={handlePayInvoice}
                      loading={isOpeningInvoice}
                      disabled={isOpeningInvoice}
                      testID="button-view-invoice"
                    >
                      {isInvoicePaidOrClosed
                        ? "View Receipt"
                        : `Pay $${parseFloat(invoice.total || invoice.amount || invoice.totalAmount || "0").toFixed(2)}`}
                    </PrimaryButton>
                    {invoiceError ? (
                      <View
                        style={styles.invoiceErrorBox}
                        testID="text-invoice-error"
                      >
                        <Feather
                          name="alert-circle"
                          size={14}
                          color="#B91C1C"
                        />
                        <ThemedText style={styles.invoiceErrorText}>
                          {invoiceError}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </GlassCard>
            </View>
          </Animated.View>
        ) : null}

        {statusKey === "completed" || statusKey === "paid" ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <GlassCard style={styles.completedCard}>
              <View style={styles.completedRow}>
                <Feather name="check-circle" size={20} color={Colors.accent} />
                <ThemedText style={{ marginLeft: Spacing.sm, color: Colors.accent, fontWeight: "600" }}>
                  Service Completed
                </ThemedText>
              </View>
              {appointment.completedAt ? (
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                  {formatDate(appointment.completedAt, { style: "short" })}
                </ThemedText>
              ) : null}
              {canReview ? (
                <View style={{ marginTop: Spacing.md }}>
                  <PrimaryButton
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      navigation.navigate("Review", { jobId: appointment.id });
                    }}
                    testID={hasReview ? "button-view-review" : "button-leave-review"}
                  >
                    {hasReview ? "View Your Review" : "Leave a Review"}
                  </PrimaryButton>
                </View>
              ) : null}
              {appointment.providerId && provider ? (
                <View style={{ marginTop: Spacing.md }}>
                  <PrimaryButton
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      navigation.navigate("SimpleBooking", {
                        providerId: appointment.providerId,
                        providerName: provider.businessName,
                      });
                    }}
                    testID="button-book-again"
                  >
                    Book Again
                  </PrimaryButton>
                </View>
              ) : null}
            </GlassCard>
          </Animated.View>
        ) : canReview ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <View style={styles.section}>
              <PrimaryButton
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  navigation.navigate("Review", { jobId: appointment.id });
                }}
                testID={hasReview ? "button-view-review" : "button-leave-review"}
              >
                {hasReview ? "View Your Review" : "Leave a Review"}
              </PrimaryButton>
            </View>
          </Animated.View>
        ) : null}

        {appointment.providerDiagnosis ? (
          <Animated.View entering={FadeInDown.delay(350).duration(400)}>
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Provider Notes</ThemedText>
              <GlassCard style={styles.diagnosisCard}>
                <Feather name="message-square" size={16} color={theme.textSecondary} />
                <ThemedText style={[styles.diagnosisText, { color: theme.textSecondary }]}>
                  {appointment.providerDiagnosis}
                </ThemedText>
              </GlassCard>
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      {provider && (
        <ShareProviderModal
          visible={showShareModal}
          providerName={provider.businessName}
          providerBookingLink={
            provider.slug
              ? `https://homebaseproapp.com/providers/${provider.slug}`
              : "https://homebaseproapp.com"
          }
          onDismiss={() => setShowShareModal(false)}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  headerCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  serviceName: {
    ...Typography.headline,
    fontWeight: "600",
  },
  providerInfo: {
    ...Typography.subhead,
    marginTop: 2,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.sm,
  },
  detailCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.07)",
    gap: Spacing.sm,
  },
  detailLabel: {
    ...Typography.subhead,
    flex: 1,
  },
  detailValue: {
    ...Typography.subhead,
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },
  invoiceCard: {
    padding: Spacing.md,
  },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  invoiceNumber: {
    ...Typography.headline,
    fontWeight: "600",
    marginBottom: 2,
  },
  invoiceStatus: {
    ...Typography.caption2,
    fontWeight: "600",
  },
  invoiceAmount: {
    ...Typography.title3,
    color: Colors.accent,
    fontWeight: "700",
  },
  dueDateText: {
    ...Typography.caption2,
    marginTop: Spacing.xs,
  },
  invoiceErrorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  invoiceErrorText: {
    ...Typography.caption1,
    color: "#B91C1C",
    flex: 1,
  },
  completedCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  completedRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  diagnosisCard: {
    padding: Spacing.md,
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "flex-start",
  },
  diagnosisText: {
    ...Typography.body,
    flex: 1,
  },
});
