import React from "react";
import { StyleSheet, ScrollView, View, Alert, ActivityIndicator, Pressable } from "react-native";
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "invoices"] });
      if (data.emailSent) {
        Alert.alert("Invoice Sent", "Invoice emailed to the client.");
      } else if (data.emailError) {
        Alert.alert("Invoice Sent", `Status updated but email failed: ${data.emailError}`);
      } else {
        Alert.alert("Invoice Sent", "Marked as sent. No email on file for this client.");
      }
    },
    onError: () => {
      Alert.alert("Error", "Failed to send invoice.");
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
      Alert.alert("Success", "Invoice marked as paid.");
    },
    onError: () => {
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
      navigation.goBack();
    },
    onError: () => {
      Alert.alert("Error", "Failed to cancel invoice.");
    },
  });

  const handleSend = () => {
    Alert.alert(
      "Send Invoice",
      "Send this invoice to the client via email?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send", onPress: () => sendMutation.mutate() },
      ]
    );
  };

  const handleMarkPaid = () => {
    Alert.alert(
      "Mark as Paid",
      "Mark this invoice as paid?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Mark Paid", onPress: () => markPaidMutation.mutate() },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel Invoice",
      "Cancel this invoice? This action cannot be undone.",
      [
        { text: "No", style: "cancel" },
        { text: "Yes, Cancel", style: "destructive", onPress: () => cancelMutation.mutate() },
      ]
    );
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
  const isPending = sendMutation.isPending || markPaidMutation.isPending || cancelMutation.isPending;

  return (
    <ThemedView style={styles.container}>
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

        {/* Actions */}
        <View style={styles.buttons}>
          {invoice.status === "draft" ? (
            <PrimaryButton onPress={handleSend} disabled={isPending} testID="button-send-invoice">
              {sendMutation.isPending ? "Sending..." : "Send Invoice"}
            </PrimaryButton>
          ) : null}

          {(invoice.status === "sent" || invoice.status === "overdue") ? (
            <PrimaryButton onPress={handleMarkPaid} disabled={isPending} testID="button-mark-paid">
              {markPaidMutation.isPending ? "Updating..." : "Mark as Paid"}
            </PrimaryButton>
          ) : null}

          {invoice.status !== "paid" && invoice.status !== "cancelled" ? (
            <SecondaryButton onPress={handleCancel} disabled={isPending} testID="button-cancel-invoice">
              Cancel Invoice
            </SecondaryButton>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  // Line items
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
  // Details
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
