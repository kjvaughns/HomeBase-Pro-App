import React, { useState, useMemo, useCallback, useEffect } from "react";
import { StyleSheet, View, ScrollView, Modal, Pressable, Alert, ActivityIndicator, TextInput, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, useFocusEffect, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { Avatar } from "@/components/Avatar";
import { StatusPill } from "@/components/StatusPill";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest, getApiUrl, getAuthHeaders } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { recordHappyMoment } from "@/state/appReviewStore";

// Task #236: small helper to call POST endpoints that may legitimately
// return a non-2xx (e.g. 409) without throwing — `apiRequest`
// rejects on every non-OK response, which would short-circuit our
// policy-aware handlers below.
async function postRaw(path: string, body: unknown): Promise<Response> {
  const url = new URL(path, getApiUrl());
  return fetch(url, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "X-Client-Platform": Platform.OS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
    credentials: "include",
  });
}

type AppointmentDetailParams = { appointmentId: string };
type ScreenRouteProp = RouteProp<{ AppointmentDetail: AppointmentDetailParams }, "AppointmentDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "awaiting_payment"
  | "paid"
  | "closed"
  | "cancelled";

interface StatusUpdate {
  status: string;
  date: string;
  note: string;
}

interface Provider {
  id: string;
  businessName: string;
  rating?: string;
  reviewCount?: number;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string;
}

interface LinkedJob {
  id: string;
  status?: string | null;
  title?: string | null;
  description?: string | null;
  address?: string | null;
  estimatedDuration?: number | null;
  estimatedPrice?: string | null;
  finalPrice?: string | null;
  notes?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  completedAt?: string | null;
  checklistCount?: number;
}

interface LinkedInvoice {
  id: string;
  invoiceNumber?: string | null;
  status: string;
  total?: string | null;
  amount?: string | null;
  dueDate?: string | null;
  jobId?: string | null;
  hostedInvoiceUrl?: string | null;
}

interface Appointment {
  id: string;
  userId: string;
  homeId: string;
  providerId: string;
  serviceName: string;
  description?: string;
  scheduledDate: string;
  scheduledTime: string;
  estimatedPrice?: number | string | null;
  finalPrice?: number | string | null;
  providerDiagnosis?: string;
  statusHistory?: StatusUpdate[];
  status: AppointmentStatus;
  isRecurring?: boolean;
  recurringFrequency?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  provider?: Provider;
  job?: LinkedJob | null;
  invoice?: LinkedInvoice | null;
  review?: { id: string; rating: number; comment?: string | null } | null;
  depositAmountCents?: number | null;
  depositStatus?: string | null;
  depositPaymentIntentId?: string | null;
  cancellationFeeCents?: number | null;
  cancellationFeeStatus?: string | null;
  cancellationFeePaymentIntentId?: string | null;
}

const REVIEW_ELIGIBLE_STATUSES = new Set([
  "completed",
  "paid",
  "closed",
  "awaiting_payment",
]);

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; status: "success" | "info" | "warning" | "neutral" | "cancelled" }> = {
  pending: { label: "Pending", status: "info" },
  confirmed: { label: "Confirmed", status: "info" },
  in_progress: { label: "In Progress", status: "warning" },
  completed: { label: "Completed", status: "success" },
  awaiting_payment: { label: "Awaiting Payment", status: "warning" },
  paid: { label: "Paid", status: "success" },
  closed: { label: "Closed", status: "neutral" },
  cancelled: { label: "Cancelled", status: "cancelled" },
};

const FALLBACK_STATUS_CONFIG = { label: "Status", status: "neutral" as const };

const TIME_SLOTS = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM",
  "4:00 PM", "5:00 PM"
];

import { HomeProfileSection, type HomeProfile } from "@/components/HomeProfileSection";

function ProviderHomeProfileForAppointment({ homeId }: { homeId: string }) {
  const [home, setHome] = useState<HomeProfile | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiRequest("GET", `/api/homes/${homeId}/profile`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.home) setHome(data.home as HomeProfile);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [homeId]);
  if (!home) return null;
  return <HomeProfileSection home={home} editable highlightKnownIssues />;
}

export default function AppointmentDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { appointmentId } = route.params;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [conditionUpdate, setConditionUpdate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [isOpeningInvoice, setIsOpeningInvoice] = useState(false);

  const { data, isLoading, error } = useQuery<{ appointment: Appointment }>({
    queryKey: ["/api/appointment", appointmentId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/appointment/${appointmentId}`);
      if (!response.ok) throw new Error("Failed to fetch appointment");
      return response.json();
    },
  });

  const appointment = data?.appointment;
  const statusConfig = appointment
    ? STATUS_CONFIG[appointment.status] ?? FALLBACK_STATUS_CONFIG
    : null;

  // Fallback: if the appointment payload didn't include the linked invoice
  // (intermittent iOS data gap), fetch it directly by linked job ID so the
  // homeowner can still surface the invoice CTA.
  const fallbackJobId = appointment?.job?.id ?? null;
  const shouldFetchFallbackInvoice =
    !!appointment && !appointment.invoice && !!fallbackJobId;
  const { data: fallbackInvoiceData } = useQuery<{ invoice: LinkedInvoice | null }>({
    queryKey: ["/api/jobs", fallbackJobId, "invoice"],
    enabled: shouldFetchFallbackInvoice,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/jobs/${fallbackJobId}/invoice`);
      if (!response.ok) return { invoice: null };
      return response.json();
    },
  });
  const effectiveInvoice: LinkedInvoice | null =
    appointment?.invoice ?? fallbackInvoiceData?.invoice ?? null;

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointment", appointmentId] });
    }, [queryClient, appointmentId])
  );

  // Fire once when the homeowner views a confirmed/scheduled booking.
  // Deduped per appointment ID so it only counts the first time they see it.
  React.useEffect(() => {
    if (appointment && appointment.status === "confirmed") {
      recordHappyMoment("homeowner_booking_confirmed", {
        payload: { bookingId: appointment.id },
      }).catch(() => {});
    }
  }, [appointment?.id, appointment?.status]);

  const generateDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  const handleReschedule = useCallback(async () => {
    if (!selectedDate || !selectedTime || !appointment) return;

    setIsSubmitting(true);
    try {
      const formattedDate = selectedDate.toISOString().split("T")[0];
      const res = await postRaw(`/api/appointments/${appointmentId}/reschedule`, {
        scheduledDate: formattedDate,
        scheduledTime: selectedTime,
      });
      if (!res.ok) {
        // Task #236: server returns 409 with reason + message when the
        // homeowner is inside the reschedule window or has already
        // hit the maxReschedules cap.
        const body: { error?: string; message?: string } = await res
          .json()
          .catch(() => ({}));
        if (res.status === 409) {
          Alert.alert(
            "Reschedule Not Allowed",
            body.message || "This appointment can no longer be rescheduled.",
          );
          return;
        }
        throw new Error(body.message || body.error || "Reschedule failed");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setShowRescheduleModal(false);
      setSelectedDate(null);
      setSelectedTime(null);
    } catch (err) {
      Alert.alert("Error", "Failed to reschedule appointment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedDate, selectedTime, appointment, appointmentId, queryClient]);

  const performCancel = useCallback(
    async (acceptFee: boolean) => {
      setIsSubmitting(true);
      try {
        const res = await postRaw(
          `/api/appointments/${appointmentId}/cancel`,
          { acceptFee },
        );
        if (!res.ok) {
          const body: {
            error?: string;
            message?: string;
            feeCents?: number;
          } = await res.json().catch(() => ({}));
          // Task #236: server returns 409 when there's an unaccepted late
          // cancellation fee. Surface a confirmation prompt and re-call
          // with acceptFee = true if the homeowner agrees.
          if (res.status === 409 && body.error === "fee_acknowledgement_required") {
            const fee = ((body.feeCents ?? 0) / 100).toFixed(2);
            Alert.alert(
              "Late Cancellation Fee",
              `Cancelling now will charge a fee of $${fee}. Continue?`,
              [
                { text: "Keep Appointment", style: "cancel" },
                {
                  text: "Cancel & Pay Fee",
                  style: "destructive",
                  onPress: () => performCancel(true),
                },
              ],
            );
            return;
          }
          throw new Error(body.message || body.error || "Cancel failed");
        }
        const body: { cancellationFeeCheckoutUrl?: string | null } = await res
          .json()
          .catch(() => ({}));
        // If a fee was charged, open the Stripe Checkout page so the
        // homeowner can complete payment.
        if (body.cancellationFeeCheckoutUrl) {
          try {
            const { openExternalUrl } = await import("@/lib/openExternalUrl");
            await openExternalUrl(body.cancellationFeeCheckoutUrl);
          } catch {}
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
        setShowCancelModal(false);
        navigation.goBack();
      } catch (err) {
        Alert.alert("Error", "Failed to cancel appointment. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [appointmentId, queryClient, navigation],
  );

  const handleCancel = useCallback(async () => {
    if (!appointment) return;
    await performCancel(false);
  }, [appointment, performCancel]);

  const handleConditionUpdate = useCallback(async () => {
    if (!conditionUpdate.trim() || !appointment) return;

    setIsSubmitting(true);
    try {
      await apiRequest("POST", `/api/appointments/${appointmentId}/update-condition`, {
        description: conditionUpdate,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setShowConditionModal(false);
      setConditionUpdate("");
      Alert.alert("Update Sent", "The provider has been notified about the change in your situation.");
    } catch (err) {
      Alert.alert("Error", "Failed to submit update. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [conditionUpdate, appointment, appointmentId, queryClient]);

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading appointment...
        </ThemedText>
      </ThemedView>
    );
  }

  if (error || !appointment || !statusConfig) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <Feather name="alert-circle" size={48} color={theme.textTertiary} />
        <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
          Appointment not found
        </ThemedText>
        <SecondaryButton onPress={() => navigation.goBack()}>
          Go Back
        </SecondaryButton>
      </ThemedView>
    );
  }

  const canModify = appointment.status !== "completed" && appointment.status !== "cancelled";
  const isHomeowner = !!user && appointment.userId === user.id;
  const canReview =
    isHomeowner && REVIEW_ELIGIBLE_STATUSES.has(appointment.status);
  const hasReview = !!appointment.review;
  const hasInvoice = !!effectiveInvoice;
  const isInvoicePaidOrClosed =
    !!effectiveInvoice &&
    (effectiveInvoice.status === "paid" ||
      effectiveInvoice.status === "closed");
  const showInvoiceCta = hasInvoice;

  const handleViewInvoice = async () => {
    if (!effectiveInvoice) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setInvoiceError(null);
    setIsOpeningInvoice(true);
    try {
      let url = effectiveInvoice.hostedInvoiceUrl;
      // If we don't have a cached URL, ask the server to generate one
      // using the same Stripe helper the provider's "Get Payment Link"
      // route uses, so the homeowner gets the exact same Stripe page.
      if (!url) {
        const res = await apiRequest(
          "POST",
          `/api/invoices/${effectiveInvoice.id}/payment-link`,
          {},
        );
        if (!res.ok) {
          const errBody: { error?: string } = await res
            .json()
            .catch(() => ({}));
          throw new Error(
            errBody.error || "We couldn't load this invoice. Please try again.",
          );
        }
        const body: { url?: string } = await res.json();
        url = body.url;
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
              <Avatar name={appointment.provider?.businessName || "Provider"} size="medium" />
              <View style={styles.headerInfo}>
                <ThemedText style={styles.serviceName}>
                  {appointment.job?.title || appointment.serviceName}
                </ThemedText>
                <ThemedText style={[styles.providerName, { color: theme.textSecondary }]}>
                  {appointment.provider?.businessName || "Service Provider"}
                </ThemedText>
                {appointment.isRecurring && appointment.recurringFrequency ? (
                  <View style={[styles.recurringBadge, { backgroundColor: Colors.accent + "20" }]}>
                    <Feather name="repeat" size={11} color={Colors.accent} />
                    <ThemedText style={[styles.recurringBadgeText, { color: Colors.accent }]}>
                      {appointment.recurringFrequency.charAt(0).toUpperCase() + appointment.recurringFrequency.slice(1)}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <StatusPill label={statusConfig.label} status={statusConfig.status} />
            </View>
          </GlassCard>
        </Animated.View>

        {appointment.job?.description || appointment.description ? (
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Job Description</ThemedText>
              <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
                <ThemedText style={[styles.summaryText, { color: theme.text }]}>
                  {appointment.job?.description || appointment.description}
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Schedule</ThemedText>
            <View style={[styles.detailCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
              <View style={styles.detailRow}>
                <Feather name="calendar" size={18} color={theme.textSecondary} />
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Date</ThemedText>
                <ThemedText style={styles.detailValue}>{formatDate(appointment.scheduledDate)}</ThemedText>
              </View>
              <View style={styles.detailRow}>
                <Feather name="clock" size={18} color={theme.textSecondary} />
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Time</ThemedText>
                <ThemedText style={styles.detailValue}>{appointment.scheduledTime}</ThemedText>
              </View>
              {appointment.job?.estimatedDuration ? (
                <View style={styles.detailRow}>
                  <Feather name="watch" size={18} color={theme.textSecondary} />
                  <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Duration</ThemedText>
                  <ThemedText style={styles.detailValue}>~{appointment.job.estimatedDuration} min</ThemedText>
                </View>
              ) : null}
              {appointment.job?.address ? (
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <Feather name="map-pin" size={18} color={theme.textSecondary} />
                  <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Address</ThemedText>
                  <ThemedText style={styles.detailValue} numberOfLines={2}>{appointment.job.address}</ThemedText>
                </View>
              ) : (
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]} />
              )}
            </View>
          </View>
        </Animated.View>

        {(() => {
          const toNum = (v: string | number | null | undefined): number | null => {
            if (v === null || v === undefined || v === "") return null;
            const n = typeof v === "number" ? v : parseFloat(v);
            return isNaN(n) ? null : n;
          };
          const finalPrice = toNum(appointment.job?.finalPrice ?? appointment.finalPrice);
          const estPrice = toNum(appointment.job?.estimatedPrice ?? appointment.estimatedPrice);
          const showPrice = finalPrice ?? estPrice;
          if (showPrice === null) return null;
          return (
            <Animated.View entering={FadeInDown.delay(150).duration(400)}>
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Pricing</ThemedText>
                <View style={[styles.detailCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
                  <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                    <Feather name="dollar-sign" size={18} color={theme.textSecondary} />
                    <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                      {finalPrice ? "Final Price" : "Estimated"}
                    </ThemedText>
                    <ThemedText style={[styles.detailValue, { color: Colors.accent, fontWeight: "600" }]}>
                      ${(finalPrice || estPrice)?.toFixed(2)}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </Animated.View>
          );
        })()}

        {(() => {
          const depositCents = appointment.depositAmountCents ?? 0;
          const feeCents = appointment.cancellationFeeCents ?? 0;
          if (depositCents <= 0 && feeCents <= 0) return null;
          const fmtStatus = (s?: string | null): { label: string; color: string } => {
            switch (s) {
              case "paid":
                return { label: "Paid", color: Colors.accent };
              case "awaiting":
                return { label: "Awaiting Payment", color: "#D97706" };
              case "skipped_no_stripe":
                return { label: "Waived", color: theme.textSecondary };
              case "failed":
                return { label: "Failed", color: "#DC2626" };
              default:
                return { label: s ?? "—", color: theme.textSecondary };
            }
          };
          const depositInfo = fmtStatus(appointment.depositStatus);
          const feeInfo = fmtStatus(appointment.cancellationFeeStatus);
          return (
            <Animated.View entering={FadeInDown.delay(175).duration(400)}>
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Payment Details</ThemedText>
                <View style={[styles.detailCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
                  {depositCents > 0 ? (
                    <>
                      <View style={styles.detailRow}>
                        <Feather name="credit-card" size={18} color={theme.textSecondary} />
                        <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Deposit</ThemedText>
                        <ThemedText
                          testID={`text-deposit-amount-${appointment.id}`}
                          style={styles.detailValue}
                        >
                          ${(depositCents / 100).toFixed(2)}
                        </ThemedText>
                      </View>
                      <View style={[styles.detailRow, feeCents <= 0 ? { borderBottomWidth: 0 } : null]}>
                        <Feather name="info" size={18} color={theme.textSecondary} />
                        <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Deposit Status</ThemedText>
                        <ThemedText
                          testID={`status-deposit-${appointment.id}`}
                          style={[styles.detailValue, { color: depositInfo.color, fontWeight: "600" }]}
                        >
                          {depositInfo.label}
                        </ThemedText>
                      </View>
                    </>
                  ) : null}
                  {feeCents > 0 ? (
                    <>
                      <View style={styles.detailRow}>
                        <Feather name="alert-circle" size={18} color={theme.textSecondary} />
                        <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Cancellation Fee</ThemedText>
                        <ThemedText
                          testID={`text-cancellation-fee-${appointment.id}`}
                          style={styles.detailValue}
                        >
                          ${(feeCents / 100).toFixed(2)}
                        </ThemedText>
                      </View>
                      <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                        <Feather name="info" size={18} color={theme.textSecondary} />
                        <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Fee Status</ThemedText>
                        <ThemedText
                          testID={`status-cancellation-fee-${appointment.id}`}
                          style={[styles.detailValue, { color: feeInfo.color, fontWeight: "600" }]}
                        >
                          {feeInfo.label}
                        </ThemedText>
                      </View>
                    </>
                  ) : null}
                </View>
              </View>
            </Animated.View>
          );
        })()}

        {effectiveInvoice ? (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Invoice</ThemedText>
              <GlassCard style={styles.invoiceCard}>
                <View style={styles.invoiceRow}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.invoiceNumber}>
                      {effectiveInvoice.invoiceNumber || `Invoice #${effectiveInvoice.id.slice(-6)}`}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.invoiceStatus,
                        {
                          color:
                            isInvoicePaidOrClosed
                              ? Colors.accent
                              : effectiveInvoice.status === "cancelled"
                              ? theme.textTertiary
                              : Colors.warning,
                        },
                      ]}
                    >
                      {effectiveInvoice.status === "paid"
                        ? "Paid"
                        : effectiveInvoice.status === "closed"
                        ? "Closed"
                        : effectiveInvoice.status === "cancelled"
                        ? "Cancelled"
                        : effectiveInvoice.status === "sent"
                        ? "Payment Due"
                        : effectiveInvoice.status.toUpperCase()}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.invoiceAmount}>
                    ${parseFloat(effectiveInvoice.total || effectiveInvoice.amount || "0").toFixed(2)}
                  </ThemedText>
                </View>
                {effectiveInvoice.dueDate ? (
                  <ThemedText style={[styles.invoiceDueText, { color: theme.textSecondary }]}>
                    Due: {formatDate(effectiveInvoice.dueDate)}
                  </ThemedText>
                ) : null}
                {showInvoiceCta ? (
                  <View style={{ marginTop: Spacing.md }}>
                    <PrimaryButton
                      onPress={handleViewInvoice}
                      loading={isOpeningInvoice}
                      disabled={isOpeningInvoice}
                      testID="button-view-invoice"
                    >
                      {isInvoicePaidOrClosed
                        ? "View Receipt"
                        : `Pay $${parseFloat(effectiveInvoice.total || effectiveInvoice.amount || "0").toFixed(2)}`}
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

        {appointment.provider?.phone || appointment.provider?.email ? (
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Provider Contact</ThemedText>
              <View style={[styles.detailCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
                {appointment.provider.phone ? (
                  <View style={[styles.detailRow, { borderBottomWidth: appointment.provider.email ? StyleSheet.hairlineWidth : 0 }]}>
                    <Feather name="phone" size={18} color={theme.textSecondary} />
                    <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Phone</ThemedText>
                    <ThemedText style={styles.detailValue}>{appointment.provider.phone}</ThemedText>
                  </View>
                ) : null}
                {appointment.provider.email ? (
                  <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                    <Feather name="mail" size={18} color={theme.textSecondary} />
                    <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Email</ThemedText>
                    <ThemedText style={styles.detailValue} numberOfLines={1}>{appointment.provider.email}</ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </Animated.View>
        ) : null}

        {appointment.job?.notes || (appointment.job?.checklistCount && appointment.job.checklistCount > 0) ? (
          <Animated.View entering={FadeInDown.delay(275).duration(400)}>
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Job Notes</ThemedText>
              <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
                {appointment.job?.notes ? (
                  <ThemedText style={[styles.summaryText, { color: theme.text }]}>
                    {appointment.job.notes}
                  </ThemedText>
                ) : null}
                {appointment.job?.checklistCount && appointment.job.checklistCount > 0 ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: appointment.job.notes ? Spacing.sm : 0 }}>
                    <Feather name="check-square" size={14} color={Colors.accent} />
                    <ThemedText style={{ ...Typography.caption1, color: Colors.accent, fontWeight: "600" }}>
                      {appointment.job.checklistCount} checklist {appointment.job.checklistCount === 1 ? "item" : "items"}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </Animated.View>
        ) : null}

        {appointment.homeId ? (
          <Animated.View entering={FadeInDown.delay(280).duration(400)}>
            <View style={styles.section}>
              <ProviderHomeProfileForAppointment homeId={appointment.homeId} />
            </View>
          </Animated.View>
        ) : null}

        {appointment.status === "completed" && appointment.providerDiagnosis ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Work Completed</ThemedText>
              <View style={[styles.diagnosisCard, { backgroundColor: `${Colors.accent}08`, borderColor: Colors.accent + "30" }]}>
                <ThemedText style={[styles.diagnosisText, { color: theme.text }]}>
                  {appointment.providerDiagnosis}
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        ) : null}

        {appointment.statusHistory && appointment.statusHistory.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(350).duration(400)}>
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Status Timeline</ThemedText>
              <View style={[styles.timelineCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
                {appointment.statusHistory.map((update, index) => (
                  <View key={index} style={styles.timelineItem}>
                    <View style={styles.timelineDot}>
                      <View style={[styles.dot, { backgroundColor: index === appointment.statusHistory!.length - 1 ? Colors.accent : theme.textTertiary }]} />
                      {index < appointment.statusHistory!.length - 1 ? (
                        <View style={[styles.timelineLine, { backgroundColor: theme.borderLight }]} />
                      ) : null}
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeader}>
                        <ThemedText style={styles.timelineStatus}>
                          {update.status.charAt(0).toUpperCase() + update.status.slice(1).replace("_", " ")}
                        </ThemedText>
                        <ThemedText style={[styles.timelineDate, { color: theme.textTertiary }]}>
                          {new Date(update.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </ThemedText>
                      </View>
                      <ThemedText style={[styles.timelineNote, { color: theme.textSecondary }]}>
                        {update.note}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        ) : null}

        <View style={styles.actions}>
          {canReview ? (
            <PrimaryButton
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate("Review", { jobId: appointment.id });
              }}
              style={styles.actionBtn}
              testID={hasReview ? "button-view-review" : "button-leave-review"}
            >
              {hasReview ? "View Your Review" : "Leave a Review"}
            </PrimaryButton>
          ) : null}

          {appointment.status === "completed" && appointment.provider ? (
            <PrimaryButton
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate("SimpleBooking", {
                  providerId: appointment.providerId,
                  providerName: appointment.provider!.businessName,
                });
              }}
              style={styles.actionBtn}
            >
              Book Again
            </PrimaryButton>
          ) : null}

          {canModify ? (
            <>
              <SecondaryButton onPress={() => setShowConditionModal(true)} style={styles.actionBtn}>
                Update Condition
              </SecondaryButton>
              <SecondaryButton onPress={() => setShowRescheduleModal(true)} style={styles.actionBtn}>
                Reschedule
              </SecondaryButton>
              <Pressable
                style={[styles.cancelBtn, { borderColor: Colors.error }]}
                onPress={() => setShowCancelModal(true)}
              >
                <ThemedText style={[styles.cancelBtnText, { color: Colors.error }]}>
                  Cancel Appointment
                </ThemedText>
              </Pressable>
            </>
          ) : null}
        </View>

        <View style={styles.statusInfo}>
          <ThemedText style={[styles.statusInfoText, { color: theme.textTertiary }]}>
            Booked on {new Date(appointment.createdAt).toLocaleDateString()}
          </ThemedText>
        </View>
      </ScrollView>

      <Modal
        visible={showRescheduleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Reschedule Appointment</ThemedText>
            <Pressable onPress={() => setShowRescheduleModal(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <ThemedText style={styles.modalSectionTitle}>Select a New Date</ThemedText>
            <View style={styles.dateGrid}>
              {generateDates.map((date) => {
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                return (
                  <Pressable
                    key={date.toISOString()}
                    style={[
                      styles.dateItem,
                      { borderColor: isSelected ? Colors.accent : theme.borderLight },
                      isSelected && { backgroundColor: `${Colors.accent}14` },
                    ]}
                    onPress={() => setSelectedDate(date)}
                  >
                    <ThemedText style={[styles.dateDay, isSelected && { color: Colors.accent }]}>
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </ThemedText>
                    <ThemedText style={[styles.dateNum, isSelected && { color: Colors.accent }]}>
                      {date.getDate()}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText style={styles.modalSectionTitle}>Select a New Time</ThemedText>
            <View style={styles.timeGrid}>
              {TIME_SLOTS.map((time) => {
                const isSelected = selectedTime === time;
                return (
                  <Pressable
                    key={time}
                    style={[
                      styles.timeItem,
                      { borderColor: isSelected ? Colors.accent : theme.borderLight },
                      isSelected && { backgroundColor: `${Colors.accent}14` },
                    ]}
                    onPress={() => setSelectedTime(time)}
                  >
                    <ThemedText style={[styles.timeText, isSelected && { color: Colors.accent }]}>
                      {time}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: insets.bottom + Spacing.md }]}>
            <PrimaryButton
              onPress={handleReschedule}
              disabled={!selectedDate || !selectedTime || isSubmitting}
              loading={isSubmitting}
            >
              Confirm New Date & Time
            </PrimaryButton>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCancelModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.cancelModalOverlay}>
          <View style={[styles.cancelModalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.cancelModalIcon}>
              <Feather name="alert-triangle" size={40} color={Colors.error} />
            </View>
            <ThemedText style={styles.cancelModalTitle}>Cancel Appointment?</ThemedText>
            <ThemedText style={[styles.cancelModalDesc, { color: theme.textSecondary }]}>
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </ThemedText>
            <View style={styles.cancelModalActions}>
              <SecondaryButton onPress={() => setShowCancelModal(false)} style={styles.cancelModalBtn}>
                Keep Appointment
              </SecondaryButton>
              <Pressable
                style={[styles.confirmCancelBtn, { backgroundColor: Colors.error }]}
                onPress={handleCancel}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.confirmCancelBtnText}>Yes, Cancel</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showConditionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowConditionModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Update Condition</ThemedText>
            <Pressable onPress={() => setShowConditionModal(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <ThemedText style={[styles.conditionDesc, { color: theme.textSecondary }]}>
              Has your situation changed? Let the provider know if the job has gotten worse or if there are new issues.
            </ThemedText>
            
            <TextInput
              style={[
                styles.conditionInput,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.borderLight,
                  color: theme.text,
                },
              ]}
              placeholder="Describe what has changed..."
              placeholderTextColor={theme.textTertiary}
              value={conditionUpdate}
              onChangeText={setConditionUpdate}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <PrimaryButton
              onPress={handleConditionUpdate}
              disabled={!conditionUpdate.trim() || isSubmitting}
              style={styles.conditionSubmitBtn}
            >
              {isSubmitting ? "Sending..." : "Send Update"}
            </PrimaryButton>
          </ScrollView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  errorText: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  headerCard: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  serviceName: {
    ...Typography.headline,
    fontWeight: "600",
  },
  providerName: {
    ...Typography.subhead,
    marginTop: 2,
  },
  recurringBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  recurringBadgeText: {
    ...Typography.caption2,
    fontWeight: "600",
  },
  summaryCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  summaryText: {
    ...Typography.body,
    lineHeight: 22,
  },
  timelineCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  timelineDot: {
    width: 24,
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  timelineStatus: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  timelineDate: {
    ...Typography.caption2,
  },
  timelineNote: {
    ...Typography.caption1,
  },
  diagnosisCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  diagnosisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  diagnosisIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  diagnosisLabel: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  diagnosisText: {
    ...Typography.body,
    lineHeight: 22,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  detailCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
    gap: Spacing.sm,
  },
  detailLabel: {
    ...Typography.subhead,
    width: 80,
  },
  detailValue: {
    ...Typography.body,
    flex: 1,
    textAlign: "right",
  },
  actions: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionBtn: {
    marginTop: 0,
  },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  cancelBtnText: {
    ...Typography.body,
    fontWeight: "600",
  },
  statusInfo: {
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  statusInfoText: {
    ...Typography.caption1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    paddingTop: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalTitle: {
    ...Typography.title3,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    padding: Spacing.md,
  },
  modalSectionTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  dateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  dateItem: {
    width: 56,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  dateDay: {
    ...Typography.caption2,
  },
  dateNum: {
    ...Typography.headline,
    fontWeight: "600",
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  timeItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  timeText: {
    ...Typography.body,
  },
  modalFooter: {
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  cancelModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  cancelModalContent: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
  },
  cancelModalIcon: {
    marginBottom: Spacing.md,
  },
  cancelModalTitle: {
    ...Typography.title3,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  cancelModalDesc: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  cancelModalActions: {
    width: "100%",
    gap: Spacing.sm,
  },
  cancelModalBtn: {
    marginTop: 0,
  },
  confirmCancelBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  confirmCancelBtnText: {
    ...Typography.body,
    fontWeight: "600",
    color: "#fff",
  },
  conditionDesc: {
    ...Typography.body,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  conditionInput: {
    minHeight: 120,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  conditionSubmitBtn: {
    marginTop: Spacing.sm,
  },
  invoiceCard: {
    padding: Spacing.md,
  },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.md,
  },
  invoiceNumber: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  invoiceStatus: {
    ...Typography.caption1,
    fontWeight: "600",
    marginTop: 2,
  },
  invoiceAmount: {
    ...Typography.title3,
    fontWeight: "700",
    color: Colors.accent,
  },
  invoiceDueText: {
    ...Typography.caption1,
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
});
