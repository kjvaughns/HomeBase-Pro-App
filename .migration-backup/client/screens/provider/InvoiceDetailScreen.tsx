import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  INVOICE_TERMINAL_STATUSES,
} from "@/constants/invoiceStatuses";
import {
  StyleSheet,
  ScrollView,
  View,
  Alert,
  ActivityIndicator,
  Pressable,
  Animated,
  Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, useFocusEffect, RouteProp } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { StatusPill } from "@/components/StatusPill";
import { Spacing, Typography, Colors, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { apiRequest } from "@/lib/query-client";
import { recordHappyMoment } from "@/state/appReviewStore";
import { RecordPaymentSheet, type ExistingPayment } from "@/components/RecordPaymentSheet";

type RouteParams = {
  InvoiceDetail: { invoiceId: string };
};

interface LineItemRecord {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  providerId: string;
  clientId: string;
  jobId?: string;
  invoiceNumber?: string;
  amount: string;
  total?: string;
  status: "draft" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled";
  totalAmount?: string;
  amountCents?: number;
  dueDate?: string;
  paidAt?: string;
  notes?: string;
  lineItems?: string | LineItemRecord[] | null;
  createdAt: string;
  hostedInvoiceUrl?: string | null;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

function parseLineItems(raw: Invoice["lineItems"]): LineItemRecord[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw as string); } catch { return []; }
}

type SuccessBannerMessage = string | null;
type ConfirmType = "mark-paid" | "cancel" | null;

function SuccessBanner({ message, topOffset }: { message: SuccessBannerMessage; topOffset: number }) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [message]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.banner, { paddingTop: topOffset + 10, transform: [{ translateY }], opacity }]}
    >
      <View style={styles.bannerInner}>
        <Feather name="check-circle" size={18} color="#fff" />
        <ThemedText style={styles.bannerText}>{message ?? ""}</ThemedText>
      </View>
    </Animated.View>
  );
}

export default function InvoiceDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "InvoiceDetail">>();
  const queryClient = useQueryClient();
  const { providerProfile } = useAuthStore();
  const { theme } = useTheme();

  // Task #289: deep-link safety — `route.params` is undefined when this
  // screen is opened via a bare `/invoice/` URL without an id, which threw
  // and tripped the global ErrorBoundary on web. Default to an empty
  // object so the `enabled: !!invoiceId` query path below short-circuits.
  const { invoiceId } = (route.params ?? {}) as { invoiceId?: string };
  const providerId = providerProfile?.id;

  const [bannerMessage, setBannerMessage] = useState<SuccessBannerMessage>(null);
  const [resendDone, setResendDone] = useState(false);
  const [remindDone, setRemindDone] = useState(false);
  const [confirmType, setConfirmType] = useState<ConfirmType>(null);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ExistingPayment | null>(null);
  const [confirmVoidId, setConfirmVoidId] = useState<string | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = (msg: string) => {
    setBannerMessage(msg);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBannerMessage(null), 3000);
  };

  useEffect(() => () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); }, []);

  const { data: invoiceData, isLoading, refetch: refetchInvoice } = useQuery<{ invoice: Invoice }>({
    queryKey: ["/api/invoices", invoiceId],
    enabled: !!invoiceId,
    // Task #235: poll while the invoice is still unpaid so the provider sees
    // the status flip the moment the homeowner finishes Stripe Checkout.
    refetchInterval: (query) => {
      const status = query.state.data?.invoice?.status as string | undefined;
      if (!status || INVOICE_TERMINAL_STATUSES.has(status)) {
        return false;
      }
      return 5000;
    },
  });

  // Task #256: When the detail poll detects a status transition to a terminal
  // state, immediately invalidate the provider invoices list cache so the list
  // screen reflects the updated status without requiring any user action.
  // NOTE: We only advance prevStatusRef when providerId is known to avoid a
  // startup race where invoice data arrives before the provider profile is
  // hydrated — without this guard, the terminal status would be recorded
  // before providerId exists, and the subsequent read (with providerId) would
  // see no change and skip the invalidation.
  const prevStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!providerId) return;
    const currentStatus = invoiceData?.invoice?.status;
    if (
      currentStatus &&
      prevStatusRef.current !== currentStatus &&
      INVOICE_TERMINAL_STATUSES.has(currentStatus)
    ) {
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "invoices"],
      });
    }
    prevStatusRef.current = currentStatus;
  }, [invoiceData?.invoice?.status, providerId, queryClient]);

  // Task #235: also refetch on focus so coming back from another screen (or
  // tapping a push notification) immediately reflects the latest status.
  useFocusEffect(
    useCallback(() => {
      if (invoiceId) refetchInvoice();
    }, [invoiceId, refetchInvoice]),
  );

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const { data: connectData } = useQuery<{ chargesEnabled: boolean; stripeAccountId?: string | null }>({
    queryKey: ["/api/stripe/connect/status", providerId],
    enabled: !!providerId,
  });

  // Task #295: load manual payments + Stripe payments recorded against this
  // invoice so the provider can review, edit and void out-of-band entries.
  interface PaymentRow {
    id: string;
    amountCents: number;
    method: string;
    status: string;
    reference?: string | null;
    notes?: string | null;
    receivedAt?: string | null;
    photoUrl?: string | null;
    voidedAt?: string | null;
    createdAt: string;
  }
  const { data: paymentsData } = useQuery<{ payments: PaymentRow[] }>({
    queryKey: ["/api/invoices", invoiceId, "payments"],
    enabled: !!invoiceId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/invoices/${invoiceId}/payments`);
      if (!res.ok) throw new Error("Failed to load payments");
      return res.json();
    },
  });
  const payments = paymentsData?.payments ?? [];

  const voidPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest("POST", `/api/payments/${paymentId}/void`, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to void payment");
      }
      return res.json();
    },
    onSuccess: () => {
      setConfirmVoidId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId, "payments"] });
      if (providerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "invoices"] });
        queryClient.invalidateQueries({ queryKey: ["/api/providers", providerId, "manual-payments"] });
      }
      showBanner("Payment voided");
    },
    onError: (err: Error) => {
      setConfirmVoidId(null);
      Alert.alert("Couldn't void payment", err.message);
    },
  });

  const stripeReady = !!(connectData?.chargesEnabled);

  const invoice = invoiceData?.invoice;
  const clients = clientsData?.clients || [];
  const lineItems = invoice ? parseLineItems(invoice.lineItems) : [];

  const getClientName = (clientId: string): string => {
    const client = clients.find((c) => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : "Unknown Client";
  };

  const getClient = (clientId: string): Client | undefined =>
    clients.find((c) => c.id === clientId);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/send`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "invoices"] });
      setResendDone(true);
      showBanner("Invoice resent to client");
      setTimeout(() => setResendDone(false), 3500);
    },
    onError: () => {
      Alert.alert("Error", "Failed to resend invoice.");
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/mark-paid`, { providerId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "stats"] });
      setConfirmType(null);
      showBanner("Invoice marked as paid");
      recordHappyMoment("provider_invoice_paid", {
        payload: { invoiceId },
      }).catch(() => {});
    },
    onError: () => {
      setConfirmType(null);
      Alert.alert("Error", "Failed to mark invoice as paid.");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/cancel`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "invoices"] });
      setConfirmType(null);
      navigation.goBack();
    },
    onError: () => {
      setConfirmType(null);
      Alert.alert("Error", "Failed to cancel invoice.");
    },
  });

  const remindMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/remind`, {});
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to send reminder");
      }
      return response.json();
    },
    onSuccess: () => {
      setRemindDone(true);
      showBanner("Reminder sent to client");
      setTimeout(() => setRemindDone(false), 3500);
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Failed to send reminder";
      Alert.alert("Error", msg);
    },
  });

  const paymentLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/payment-link`, {});
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to generate payment link");
      }
      return response.json() as Promise<{ url: string; method: string }>;
    },
    onSuccess: (data) => {
      setPaymentLinkUrl(data.url);
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Failed to generate payment link";
      Alert.alert("Error", msg);
    },
  });

  const handleCopyLink = async (url: string) => {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    showBanner("Payment link copied");
    setTimeout(() => setCopied(false), 2500);
  };

  const getStatusType = (status: Invoice["status"]): "success" | "warning" | "info" | "neutral" => {
    switch (status) {
      case "paid": return "success";
      case "partially_paid": return "warning";
      case "sent": return "info";
      case "overdue": return "warning";
      default: return "neutral";
    }
  };

  const formatStatusLabel = (status: Invoice["status"]) =>
    status === "partially_paid"
      ? "Partially Paid"
      : status.charAt(0).toUpperCase() + status.slice(1);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </ThemedView>
    );
  }

  if (!invoice) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <Feather name="alert-circle" size={40} color={theme.textTertiary} />
        <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
          We couldn't load this invoice.
        </ThemedText>
        <Pressable
          onPress={() => refetchInvoice()}
          style={{ marginTop: Spacing.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm }}
        >
          <ThemedText style={{ color: Colors.accent, fontWeight: "600" }}>Try again</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const client = getClient(invoice.clientId);
  const displayAmount = invoice.total || invoice.amount || "0";
  const invoiceTotalCents =
    typeof invoice.amountCents === "number" && invoice.amountCents > 0
      ? invoice.amountCents
      : Math.round(parseFloat(displayAmount || "0") * 100);
  const collectedCents = payments.reduce(
    (sum, p) => (p.voidedAt ? sum : sum + (p.amountCents ?? 0)),
    0,
  );
  const outstandingCents = Math.max(0, invoiceTotalCents - collectedCents);
  const activePaymentUrl = paymentLinkUrl || invoice.hostedInvoiceUrl || null;
  const anyPending = sendMutation.isPending || markPaidMutation.isPending || cancelMutation.isPending || remindMutation.isPending || paymentLinkMutation.isPending;

  return (
    <ThemedView style={styles.container}>
      <SuccessBanner message={bannerMessage} topOffset={headerHeight} />

      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: horizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stripe not-ready banner */}
        {!stripeReady && connectData !== undefined ? (
          <View style={[styles.stripeBanner, { backgroundColor: Colors.warningLight, borderColor: Colors.warning }]}>
            <Feather name="alert-triangle" size={16} color={Colors.warning} />
            <ThemedText style={styles.stripeBannerText}>
              Online payments are unavailable. Complete Stripe onboarding to accept payments.
            </ThemedText>
            <Pressable
              onPress={() => (navigation as any).navigate("StripeConnect")}
              hitSlop={8}
            >
              <ThemedText style={[styles.stripeBannerCta, { color: Colors.accent }]}>Set Up</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {/* Header card */}
        <GlassCard style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <ThemedText style={[styles.invoiceNumLabel, { color: theme.textTertiary }]}>
                {invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`}
              </ThemedText>
              <ThemedText style={styles.amountDisplay}>
                ${parseFloat(displayAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </ThemedText>
            </View>
            <StatusPill
              status={getStatusType(invoice.status)}
              label={formatStatusLabel(invoice.status)}
            />
          </View>
        </GlassCard>

        {/* Client */}
        <GlassCard style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Client</ThemedText>
          <View style={styles.clientRow}>
            <View style={[styles.clientAvatar, { backgroundColor: Colors.accent + "20" }]}>
              <ThemedText style={[styles.avatarText, { color: Colors.accent }]}>
                {client ? `${client.firstName[0]}${client.lastName[0]}` : "?"}
              </ThemedText>
            </View>
            <View style={styles.clientInfo}>
              <ThemedText style={styles.clientName}>
                {getClientName(invoice.clientId)}
              </ThemedText>
              {client?.email ? (
                <ThemedText style={[styles.clientDetail, { color: theme.textSecondary }]}>
                  {client.email}
                </ThemedText>
              ) : null}
              {client?.phone ? (
                <ThemedText style={[styles.clientDetail, { color: theme.textSecondary }]}>
                  {client.phone}
                </ThemedText>
              ) : null}
            </View>
          </View>
        </GlassCard>

        {/* Line items */}
        {lineItems.length > 0 ? (
          <GlassCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Line Items</ThemedText>
            {lineItems.map((item, idx) => (
              <View key={idx}>
                {idx > 0 ? (
                  <View style={[styles.itemDivider, { backgroundColor: theme.separator }]} />
                ) : null}
                <View style={styles.lineItemRow}>
                  <View style={styles.lineItemDesc}>
                    <ThemedText style={styles.lineItemName}>{item.description}</ThemedText>
                    {item.quantity !== 1 ? (
                      <ThemedText style={[styles.lineItemMeta, { color: theme.textTertiary }]}>
                        {item.quantity} x ${item.unitPrice.toFixed(2)}
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText style={[styles.lineItemTotal, { color: theme.text }]}>
                    ${item.total.toFixed(2)}
                  </ThemedText>
                </View>
              </View>
            ))}
            <View style={[styles.subtotalRow, { borderTopColor: theme.separator }]}>
              <ThemedText style={[styles.subtotalLabel, { color: theme.textSecondary }]}>Total</ThemedText>
              <ThemedText style={[styles.subtotalAmount, { color: Colors.accent }]}>
                ${parseFloat(displayAmount).toFixed(2)}
              </ThemedText>
            </View>
          </GlassCard>
        ) : null}

        {/* Details */}
        <GlassCard style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Details</ThemedText>

          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="calendar" size={16} color={theme.textSecondary} />
            </View>
            <View>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Created</ThemedText>
              <ThemedText style={styles.detailValue}>{formatDate(invoice.createdAt)}</ThemedText>
            </View>
          </View>

          {invoice.dueDate ? (
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="clock" size={16} color={theme.textSecondary} />
              </View>
              <View>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Due Date</ThemedText>
                <ThemedText style={styles.detailValue}>{formatDate(invoice.dueDate)}</ThemedText>
              </View>
            </View>
          ) : null}

          {invoice.paidAt ? (
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: Colors.accent + "20" }]}>
                <Feather name="check-circle" size={16} color={Colors.accent} />
              </View>
              <View>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Paid On</ThemedText>
                <ThemedText style={[styles.detailValue, { color: Colors.accent }]}>
                  {formatDate(invoice.paidAt)}
                </ThemedText>
              </View>
            </View>
          ) : null}

          {invoice.notes ? (
            <View style={styles.notesSection}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
                Notes
              </ThemedText>
              <ThemedText style={styles.detailValue}>{invoice.notes}</ThemedText>
            </View>
          ) : null}
        </GlassCard>

        {/* Payment Link Card — shown for sent/overdue invoices */}
        {(invoice.status === "sent" || invoice.status === "overdue") ? (
          <GlassCard style={styles.section}>
            <View style={styles.paymentLinkHeader}>
              <Feather name="link" size={16} color={activePaymentUrl ? "#16A34A" : theme.textSecondary} />
              <ThemedText style={styles.sectionTitle}>Payment Link</ThemedText>
            </View>
            {activePaymentUrl ? (
              <>
                <View style={[styles.linkBox, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText
                    style={[styles.linkText, { color: Colors.accent }]}
                    numberOfLines={2}
                    ellipsizeMode="middle"
                  >
                    {activePaymentUrl}
                  </ThemedText>
                </View>
                <View style={styles.linkActions}>
                  <Pressable
                    onPress={() => handleCopyLink(activePaymentUrl)}
                    style={[styles.linkActionBtn, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <Feather name={copied ? "check" : "copy"} size={15} color={copied ? "#16A34A" : theme.textSecondary} />
                    <ThemedText style={[styles.linkActionText, { color: copied ? "#16A34A" : theme.textSecondary }]}>
                      {copied ? "Copied" : "Copy"}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => Linking.openURL(activePaymentUrl)}
                    style={[styles.linkActionBtn, { backgroundColor: Colors.accent + "15" }]}
                  >
                    <Feather name="external-link" size={15} color={Colors.accent} />
                    <ThemedText style={[styles.linkActionText, { color: Colors.accent }]}>Open</ThemedText>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <ThemedText style={[styles.linkHint, { color: theme.textSecondary }]}>
                  Generate a Stripe-hosted payment link your client can use to pay this invoice.
                </ThemedText>
                <ActionButton
                  label="Get Payment Link"
                  doneLabel="Link Ready"
                  onPress={() => paymentLinkMutation.mutate()}
                  loading={paymentLinkMutation.isPending}
                  done={false}
                  disabled={anyPending && !paymentLinkMutation.isPending}
                  testID="button-get-payment-link"
                  theme={theme}
                />
              </>
            )}
          </GlassCard>
        ) : null}

        {/* Payments list (Task #295) */}
        {payments.length > 0 ? (
          <GlassCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Payments</ThemedText>
            {payments.map((p, idx) => {
              const isVoided = !!p.voidedAt;
              const dollars = (p.amountCents / 100).toFixed(2);
              const dt = p.receivedAt || p.createdAt;
              const methodLabel =
                p.method === "bank_transfer"
                  ? "Bank Transfer"
                  : p.method.charAt(0).toUpperCase() + p.method.slice(1);
              return (
                <View key={p.id}>
                  {idx > 0 ? (
                    <View
                      style={[styles.itemDivider, { backgroundColor: theme.separator }]}
                    />
                  ) : null}
                  <View style={styles.lineItemRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <ThemedText
                          style={[
                            styles.lineItemName,
                            isVoided ? { textDecorationLine: "line-through", color: theme.textTertiary } : undefined,
                          ]}
                        >
                          ${dollars} • {methodLabel}
                        </ThemedText>
                        {isVoided ? (
                          <View
                            style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 6,
                              backgroundColor: theme.backgroundSecondary,
                            }}
                          >
                            <ThemedText style={{ fontSize: 10, color: theme.textSecondary, fontWeight: "700" }}>
                              VOIDED
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                      <ThemedText style={[styles.lineItemMeta, { color: theme.textTertiary }]}>
                        {formatDate(dt)}
                        {p.reference ? ` • Ref ${p.reference}` : ""}
                      </ThemedText>
                      {p.notes ? (
                        <ThemedText
                          style={[styles.lineItemMeta, { color: theme.textSecondary, marginTop: 2 }]}
                        >
                          {p.notes}
                        </ThemedText>
                      ) : null}
                    </View>
                    {!isVoided && p.method !== "stripe" ? (
                      confirmVoidId === p.id ? (
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          <Pressable
                            onPress={() => setConfirmVoidId(null)}
                            hitSlop={6}
                            style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                          >
                            <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                              Cancel
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            onPress={() => voidPaymentMutation.mutate(p.id)}
                            hitSlop={6}
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              backgroundColor: "#EF4444",
                              borderRadius: 6,
                            }}
                            testID={`button-confirm-void-${p.id}`}
                          >
                            <ThemedText style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                              {voidPaymentMutation.isPending ? "..." : "Void"}
                            </ThemedText>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={{ flexDirection: "row", gap: 4 }}>
                          <Pressable
                            onPress={() => {
                              setEditingPayment({
                                id: p.id,
                                amountCents: p.amountCents,
                                method: p.method as any,
                                reference: p.reference ?? null,
                                notes: p.notes ?? null,
                                receivedAt: p.receivedAt ?? null,
                                photoUrl: p.photoUrl ?? null,
                              });
                              setPaymentSheetOpen(true);
                            }}
                            hitSlop={8}
                            style={{ padding: 6 }}
                            testID={`button-edit-payment-${p.id}`}
                          >
                            <Feather name="edit-2" size={16} color={Colors.accent} />
                          </Pressable>
                          <Pressable
                            onPress={() => setConfirmVoidId(p.id)}
                            hitSlop={8}
                            style={{ padding: 6 }}
                            testID={`button-void-payment-${p.id}`}
                          >
                            <Feather name="trash-2" size={16} color={theme.textSecondary} />
                          </Pressable>
                        </View>
                      )
                    ) : null}
                  </View>
                </View>
              );
            })}
          </GlassCard>
        ) : null}

        {/* Actions */}
        <View style={styles.buttons}>
          {/* Draft: Send Invoice */}
          {invoice.status === "draft" ? (
            <PrimaryButton
              onPress={() => sendMutation.mutate()}
              disabled={anyPending}
              loading={sendMutation.isPending}
              testID="button-send-invoice"
            >
              Send Invoice
            </PrimaryButton>
          ) : null}

          {/* Sent / Partially Paid / Overdue: Record a manual (cash, check,
              card, transfer) payment. Stripe-paid invoices update via webhook
              automatically — this flow records out-of-band collections and
              transitions the invoice to partially_paid or paid based on the
              cumulative non-voided amount. */}
          {(invoice.status === "sent" ||
            invoice.status === "overdue" ||
            invoice.status === "partially_paid") ? (
            <SecondaryButton
              onPress={() => {
                setEditingPayment(null);
                setPaymentSheetOpen(true);
              }}
              disabled={anyPending}
              testID="button-record-payment"
            >
              Record Payment
            </SecondaryButton>
          ) : null}

          {stripeReady && (invoice.status === "sent" || invoice.status === "overdue") ? (
            <ThemedText
              style={[styles.linkHint, { color: theme.textSecondary, marginTop: -Spacing.sm }]}
              testID="text-stripe-auto-paid-hint"
            >
              Stripe payments are recorded automatically — no need to mark them paid here.
            </ThemedText>
          ) : null}

          {/* Sent / Overdue: Resend Invoice */}
          {(invoice.status === "sent" || invoice.status === "overdue") ? (
            <ActionButton
              label="Resend Invoice"
              doneLabel="Resent"
              onPress={() => sendMutation.mutate()}
              loading={sendMutation.isPending}
              done={resendDone}
              disabled={anyPending && !sendMutation.isPending}
              testID="button-resend-invoice"
              theme={theme}
            />
          ) : null}

          {/* Sent / Overdue: Send Reminder */}
          {(invoice.status === "sent" || invoice.status === "overdue") ? (
            <ActionButton
              label="Send Reminder"
              doneLabel="Reminder Sent"
              onPress={() => remindMutation.mutate()}
              loading={remindMutation.isPending}
              done={remindDone}
              disabled={anyPending && !remindMutation.isPending}
              testID="button-send-reminder"
              theme={theme}
            />
          ) : null}

          {/* Cancel (with inline confirm) */}
          {invoice.status !== "paid" && invoice.status !== "cancelled" ? (
            confirmType === "cancel" ? (
              <InlineConfirm
                message="Cancel this invoice? This cannot be undone."
                confirmLabel="Yes, Cancel"
                onConfirm={() => cancelMutation.mutate()}
                onCancel={() => setConfirmType(null)}
                loading={cancelMutation.isPending}
                destructive
                theme={theme}
              />
            ) : (
              <SecondaryButton
                onPress={() => setConfirmType("cancel")}
                disabled={anyPending}
                testID="button-cancel-invoice"
              >
                Cancel Invoice
              </SecondaryButton>
            )
          ) : null}
        </View>
      </ScrollView>

      <RecordPaymentSheet
        visible={paymentSheetOpen}
        onClose={() => {
          setPaymentSheetOpen(false);
          setEditingPayment(null);
        }}
        invoiceId={invoiceId!}
        providerId={providerId}
        suggestedAmountCents={editingPayment ? undefined : outstandingCents}
        existing={editingPayment}
        onSuccess={() => {
          showBanner(editingPayment ? "Payment updated" : "Payment recorded");
        }}
      />
    </ThemedView>
  );
}

function ActionButton({
  label,
  doneLabel,
  onPress,
  loading,
  done,
  disabled,
  testID,
  theme,
}: {
  label: string;
  doneLabel: string;
  onPress: () => void;
  loading: boolean;
  done: boolean;
  disabled: boolean;
  testID: string;
  theme: any;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (done) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
      ]).start();
    }
  }, [done]);

  const bg = done ? "#16A34A" : theme.backgroundSecondary;
  const textColor = done ? "#fff" : theme.text;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={loading || done || disabled}
        style={[styles.actionBtn, { backgroundColor: bg, opacity: disabled && !loading ? 0.5 : 1 }]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : done ? (
          <View style={styles.actionBtnInner}>
            <Feather name="check" size={16} color="#fff" />
            <ThemedText style={[styles.actionBtnText, { color: "#fff" }]}>{doneLabel}</ThemedText>
          </View>
        ) : (
          <ThemedText style={[styles.actionBtnText, { color: textColor }]}>{label}</ThemedText>
        )}
      </Pressable>
    </Animated.View>
  );
}

function InlineConfirm({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
  destructive = false,
  theme,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  destructive?: boolean;
  theme: any;
}) {
  return (
    <View style={[styles.inlineConfirm, { backgroundColor: theme.backgroundSecondary }]}>
      <ThemedText style={[styles.inlineConfirmMsg, { color: theme.textSecondary }]}>{message}</ThemedText>
      <View style={styles.inlineConfirmButtons}>
        <Pressable onPress={onCancel} style={[styles.inlineBtn, { borderColor: theme.separator }]} disabled={loading}>
          <ThemedText style={[styles.inlineBtnText, { color: theme.textSecondary }]}>Cancel</ThemedText>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          style={[styles.inlineBtn, styles.inlineBtnConfirm, { backgroundColor: destructive ? "#DC2626" : Colors.accent }]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <ThemedText style={[styles.inlineBtnText, { color: "#fff", fontWeight: "600" }]}>{confirmLabel}</ThemedText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },

  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: "center",
    paddingBottom: 12,
    backgroundColor: "#16A34A",
  },
  bannerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },

  headerCard: { marginBottom: Spacing.lg },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: { flex: 1 },
  invoiceNumLabel: {
    ...Typography.caption1,
    marginBottom: 4,
  },
  amountDisplay: {
    ...Typography.title1,
    fontWeight: "700",
  },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.headline, marginBottom: Spacing.md },
  clientRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  clientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...Typography.title3, fontWeight: "700" },
  clientInfo: { flex: 1 },
  clientName: { ...Typography.subhead, fontWeight: "600" },
  clientDetail: { ...Typography.caption1, marginTop: 2 },
  itemDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.sm },
  lineItemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: Spacing.xs },
  lineItemDesc: { flex: 1 },
  lineItemName: { ...Typography.body, fontWeight: "500" },
  lineItemMeta: { ...Typography.caption1, marginTop: 2 },
  lineItemTotal: { ...Typography.body, fontWeight: "600" },
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  subtotalLabel: { ...Typography.headline, fontWeight: "600" },
  subtotalAmount: { ...Typography.headline, fontWeight: "700" },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: { ...Typography.caption1, marginBottom: 2 },
  detailValue: { ...Typography.body, fontWeight: "500" },
  notesSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  buttons: { gap: Spacing.md, marginTop: Spacing.md },

  actionBtn: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  actionBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  actionBtnText: {
    ...Typography.callout,
    fontWeight: "600",
  },

  inlineConfirm: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  inlineConfirmMsg: {
    ...Typography.subhead,
    textAlign: "center",
  },
  inlineConfirmButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  inlineBtn: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.button,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  inlineBtnConfirm: {
    borderWidth: 0,
  },
  inlineBtnText: {
    ...Typography.callout,
    fontWeight: "500",
  },

  paymentLinkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  linkBox: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  linkText: {
    ...Typography.caption1,
    fontFamily: "monospace",
  },
  linkActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  linkActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.button,
  },
  linkActionText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  linkHint: {
    ...Typography.caption1,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  stripeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  stripeBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 16,
  },
  stripeBannerCta: {
    fontSize: 12,
    fontWeight: "600",
  },
});
