import React, { useRef, useEffect, useState } from "react";
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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
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
import { apiRequest } from "@/lib/query-client";

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
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing; cleanup tracked in Task #107
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
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "InvoiceDetail">>();
  const queryClient = useQueryClient();
  const { providerProfile } = useAuthStore();
  const { theme } = useTheme();

  const { invoiceId } = route.params;
  const providerId = providerProfile?.id;

  const [bannerMessage, setBannerMessage] = useState<SuccessBannerMessage>(null);
  const [resendDone, setResendDone] = useState(false);
  const [remindDone, setRemindDone] = useState(false);
  const [confirmType, setConfirmType] = useState<ConfirmType>(null);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = (msg: string) => {
    setBannerMessage(msg);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBannerMessage(null), 3000);
  };

  useEffect(() => () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); }, []);

  const { data: invoiceData, isLoading } = useQuery<{ invoice: Invoice }>({
    queryKey: ["/api/invoices", invoiceId],
    enabled: !!invoiceId,
  });

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const { data: connectData } = useQuery<{ chargesEnabled: boolean; stripeAccountId?: string | null }>({
    queryKey: ["/api/stripe/connect/status", providerId],
    enabled: !!providerId,
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
      case "sent": return "info";
      case "overdue": return "warning";
      default: return "neutral";
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  if (isLoading || !invoice) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </ThemedView>
    );
  }

  const client = getClient(invoice.clientId);
  const displayAmount = invoice.total || invoice.amount || "0";
  const activePaymentUrl = paymentLinkUrl || invoice.hostedInvoiceUrl || null;
  const anyPending = sendMutation.isPending || markPaidMutation.isPending || cancelMutation.isPending || remindMutation.isPending || paymentLinkMutation.isPending;

  return (
    <ThemedView style={styles.container}>
      <SuccessBanner message={bannerMessage} topOffset={headerHeight} />

      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stripe not-ready banner */}
        {!stripeReady && connectData !== undefined ? (
          <View style={[styles.stripeBanner, { backgroundColor: "#FFF3CD", borderColor: "#FBBF24" }]}>
            <Feather name="alert-triangle" size={16} color="#B45309" />
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
              label={invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
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

          {/* Sent / Overdue: Mark as Paid (with inline confirm) */}
          {(invoice.status === "sent" || invoice.status === "overdue") ? (
            confirmType === "mark-paid" ? (
              <InlineConfirm
                message="Mark this invoice as paid?"
                confirmLabel="Yes, Mark Paid"
                onConfirm={() => markPaidMutation.mutate()}
                onCancel={() => setConfirmType(null)}
                loading={markPaidMutation.isPending}
                theme={theme}
              />
            ) : (
              <PrimaryButton
                onPress={() => setConfirmType("mark-paid")}
                disabled={anyPending}
                testID="button-mark-paid"
              >
                Mark as Paid
              </PrimaryButton>
            )
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing; cleanup tracked in Task #107
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
