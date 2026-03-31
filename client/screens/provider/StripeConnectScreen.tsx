import React, { useState } from "react";
import { StyleSheet, ScrollView, View, ActivityIndicator, Pressable, Linking, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { StatusPill } from "@/components/StatusPill";
import { TextField } from "@/components/TextField";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface ConnectStatus {
  hasAccount: boolean;
  onboardingStatus: "not_started" | "pending" | "complete";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  totalCents: number;
  status: string;
  createdAt: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

export default function StripeConnectScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();
  const queryClient = useQueryClient();

  const providerId = providerProfile?.id;

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [invoiceDescription, setInvoiceDescription] = useState("Test Service");
  const [invoiceAmount, setInvoiceAmount] = useState("50.00");

  const { data: connectStatus, isLoading: loadingStatus, refetch: refetchStatus } = useQuery<ConnectStatus>({
    queryKey: ["/api/stripe/connect/status", providerId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/stripe/connect/status/${providerId}`);
      if (!response.ok) throw new Error("Failed to fetch status");
      return response.json();
    },
    enabled: !!providerId,
  });

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const { data: invoicesData, refetch: refetchInvoices } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["/api/stripe/invoices", providerId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/stripe/invoices?providerId=${providerId}`);
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
    enabled: !!providerId,
  });

  const { data: feePreview } = useQuery({
    queryKey: ["/api/stripe/fee-preview", providerId, invoiceAmount],
    queryFn: async () => {
      const amountCents = Math.round(parseFloat(invoiceAmount || "0") * 100);
      const response = await fetch(
        new URL(`/api/stripe/fee-preview?providerId=${providerId}&amountCents=${amountCents}`, getApiUrl()).toString()
      );
      if (!response.ok) throw new Error("Failed to fetch fee preview");
      return response.json();
    },
    enabled: !!providerId && !!invoiceAmount && parseFloat(invoiceAmount) > 0,
  });

  const clients = clientsData?.clients || [];
  const invoices = invoicesData?.invoices || [];

  const onboardMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/stripe/connect/onboard/${providerId}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.onboardingUrl) {
        Linking.openURL(data.onboardingUrl);
      }
      refetchStatus();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to start onboarding");
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId) throw new Error("Please select a client");
      const amountCents = Math.round(parseFloat(invoiceAmount) * 100);
      const response = await apiRequest("POST", "/api/stripe/invoices", {
        providerId,
        clientId: selectedClientId,
        lineItems: [
          {
            description: invoiceDescription,
            quantity: 1,
            unitPriceCents: amountCents,
          },
        ],
      });
      return response.json();
    },
    onSuccess: () => {
      Alert.alert("Success", "Invoice created!");
      refetchInvoices();
      setInvoiceDescription("Test Service");
      setInvoiceAmount("50.00");
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to create invoice");
    },
  });

  const sendInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("POST", `/api/stripe/invoices/${invoiceId}/send`);
      return response.json();
    },
    onSuccess: () => {
      Alert.alert("Success", "Invoice sent!");
      refetchInvoices();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to send invoice");
    },
  });

  const payInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("POST", `/api/stripe/invoices/${invoiceId}/checkout`);
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 402 || data.error === "stripe_not_ready") {
          throw new Error("Complete Stripe onboarding first to accept payments.");
        }
        throw new Error(data.error || "Failed to create checkout session");
      }
      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        Linking.openURL(data.url);
      }
    },
    onError: (error: any) => {
      Alert.alert("Payment Setup Required", error.message || "Failed to create checkout session");
    },
  });

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : "Unknown";
  };

  const getStatusPillType = (status: string): "success" | "info" | "warning" | "neutral" => {
    switch (status) {
      case "paid": return "success";
      case "sent": return "info";
      case "overdue": return "warning";
      default: return "neutral";
    }
  };

  if (loadingStatus) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </ThemedView>
    );
  }

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
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="credit-card" size={24} color={Colors.accent} />
              <ThemedText type="h3">Stripe Connect Status</ThemedText>
            </View>

            <View style={styles.statusRow}>
              <ThemedText style={{ color: theme.textSecondary }}>Account Status:</ThemedText>
              <StatusPill
                status={
                  connectStatus?.onboardingStatus === "complete"
                    ? "success"
                    : connectStatus?.onboardingStatus === "pending"
                    ? "warning"
                    : "neutral"
                }
                label={
                  connectStatus?.onboardingStatus === "complete"
                    ? "Active"
                    : connectStatus?.onboardingStatus === "pending"
                    ? "Pending"
                    : "Not Started"
                }
              />
            </View>

            {connectStatus?.hasAccount ? (
              <>
                <View style={styles.statusItem}>
                  <Feather
                    name={connectStatus.chargesEnabled ? "check-circle" : "x-circle"}
                    size={18}
                    color={connectStatus.chargesEnabled ? Colors.accent : theme.textSecondary}
                  />
                  <ThemedText style={{ color: connectStatus.chargesEnabled ? theme.text : theme.textSecondary }}>
                    Charges Enabled
                  </ThemedText>
                </View>
                <View style={styles.statusItem}>
                  <Feather
                    name={connectStatus.payoutsEnabled ? "check-circle" : "x-circle"}
                    size={18}
                    color={connectStatus.payoutsEnabled ? Colors.accent : theme.textSecondary}
                  />
                  <ThemedText style={{ color: connectStatus.payoutsEnabled ? theme.text : theme.textSecondary }}>
                    Payouts Enabled
                  </ThemedText>
                </View>
                <View style={styles.statusItem}>
                  <Feather
                    name={connectStatus.detailsSubmitted ? "check-circle" : "x-circle"}
                    size={18}
                    color={connectStatus.detailsSubmitted ? Colors.accent : theme.textSecondary}
                  />
                  <ThemedText style={{ color: connectStatus.detailsSubmitted ? theme.text : theme.textSecondary }}>
                    Details Submitted
                  </ThemedText>
                </View>
              </>
            ) : null}

            {!connectStatus?.hasAccount || connectStatus?.onboardingStatus !== "complete" ? (
              <PrimaryButton
                onPress={() => onboardMutation.mutate()}
                disabled={onboardMutation.isPending}
                style={styles.ctaButton}
              >
                {onboardMutation.isPending
                  ? "Starting..."
                  : connectStatus?.hasAccount
                  ? "Continue Onboarding"
                  : "Start Stripe Onboarding"}
              </PrimaryButton>
            ) : null}
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="file-plus" size={24} color={Colors.accent} />
              <ThemedText type="h3">Create Test Invoice</ThemedText>
            </View>

            <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Select a client and create an invoice with line items
            </ThemedText>

            {clients.length === 0 ? (
              <View style={styles.noClients}>
                <ThemedText style={{ color: theme.textSecondary }}>
                  No clients yet. Add a client first from the Clients tab.
                </ThemedText>
              </View>
            ) : (
              <>
                <ThemedText style={styles.label}>Client</ThemedText>
                <View style={styles.clientList}>
                  {clients.slice(0, 5).map((client) => (
                    <Pressable
                      key={client.id}
                      style={[
                        styles.clientOption,
                        { backgroundColor: theme.cardBackground },
                        selectedClientId === client.id && { borderColor: Colors.accent, borderWidth: 2 },
                      ]}
                      onPress={() => setSelectedClientId(client.id)}
                    >
                      <View style={[styles.clientAvatar, { backgroundColor: Colors.accent + "20" }]}>
                        <ThemedText style={{ color: Colors.accent, fontWeight: "600" }}>
                          {client.firstName[0]}{client.lastName[0]}
                        </ThemedText>
                      </View>
                      <ThemedText style={{ flex: 1, fontWeight: "500" }}>
                        {client.firstName} {client.lastName}
                      </ThemedText>
                      {selectedClientId === client.id ? (
                        <Feather name="check-circle" size={20} color={Colors.accent} />
                      ) : (
                        <View style={[styles.radioOuter, { borderColor: theme.textSecondary }]} />
                      )}
                    </Pressable>
                  ))}
                </View>

                <TextField
                  label="Service Description"
                  value={invoiceDescription}
                  onChangeText={setInvoiceDescription}
                  placeholder="e.g. Plumbing Repair"
                />

                <TextField
                  label="Amount ($)"
                  value={invoiceAmount}
                  onChangeText={setInvoiceAmount}
                  placeholder="50.00"
                  keyboardType="decimal-pad"
                />

                {feePreview ? (
                  <View style={[styles.feePreview, { backgroundColor: theme.cardBackground }]}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      Fee Breakdown (based on your plan)
                    </ThemedText>
                    <View style={styles.feeRow}>
                      <ThemedText>Platform Fee ({feePreview.feePercent}%)</ThemedText>
                      <ThemedText style={{ fontWeight: "600" }}>
                        ${(feePreview.platformFeeCents / 100).toFixed(2)}
                      </ThemedText>
                    </View>
                    <View style={styles.feeRow}>
                      <ThemedText style={{ color: Colors.accent }}>You Receive</ThemedText>
                      <ThemedText style={{ fontWeight: "600", color: Colors.accent }}>
                        ${(feePreview.providerReceivesCents / 100).toFixed(2)}
                      </ThemedText>
                    </View>
                  </View>
                ) : null}

                <PrimaryButton
                  onPress={() => createInvoiceMutation.mutate()}
                  disabled={createInvoiceMutation.isPending || !selectedClientId}
                  style={styles.ctaButton}
                >
                  {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
                </PrimaryButton>
              </>
            )}
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="file-text" size={24} color={Colors.accent} />
              <ThemedText type="h3">Recent Invoices</ThemedText>
            </View>

            {invoices.length === 0 ? (
              <View style={styles.noClients}>
                <ThemedText style={{ color: theme.textSecondary }}>
                  No invoices yet. Create one above to test.
                </ThemedText>
              </View>
            ) : (
              <View style={styles.invoiceList}>
                {invoices.slice(0, 5).map((invoice) => (
                  <View
                    key={invoice.id}
                    style={[styles.invoiceCard, { backgroundColor: theme.cardBackground }]}
                  >
                    <View style={styles.invoiceHeader}>
                      <View>
                        <ThemedText style={{ fontWeight: "600" }}>
                          #{invoice.invoiceNumber}
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                          {getClientName(invoice.clientId)}
                        </ThemedText>
                      </View>
                      <View style={styles.invoiceRight}>
                        <ThemedText style={{ fontWeight: "600" }}>
                          ${(invoice.totalCents / 100).toFixed(2)}
                        </ThemedText>
                        <StatusPill
                          status={getStatusPillType(invoice.status)}
                          label={invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        />
                      </View>
                    </View>

                    <View style={styles.invoiceActions}>
                      {invoice.status === "draft" ? (
                        <SecondaryButton
                          onPress={() => sendInvoiceMutation.mutate(invoice.id)}
                          disabled={sendInvoiceMutation.isPending}
                          style={styles.actionButton}
                        >
                          Send Invoice
                        </SecondaryButton>
                      ) : null}

                      {invoice.status === "sent" ? (
                        <SecondaryButton
                          onPress={() => payInvoiceMutation.mutate(invoice.id)}
                          disabled={payInvoiceMutation.isPending}
                          style={styles.actionButton}
                        >
                          Pay via Stripe
                        </SecondaryButton>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <View style={[styles.infoBox, { backgroundColor: theme.cardBackground }]}>
            <Feather name="info" size={18} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                How Stripe Connect Works:
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                1. Complete Stripe onboarding to enable payments{"\n"}
                2. Create invoices for your clients{"\n"}
                3. Send invoices - clients receive email notification{"\n"}
                4. Clients pay via Stripe Checkout{"\n"}
                5. Funds (minus platform fee) go to your Stripe account
              </ThemedText>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionSubtitle: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  ctaButton: {
    marginTop: Spacing.md,
  },
  label: {
    ...Typography.footnote,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  noClients: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  clientList: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  clientOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  feePreview: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  invoiceList: {
    gap: Spacing.sm,
  },
  invoiceCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  invoiceRight: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  invoiceActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  infoBox: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    alignItems: "flex-start",
  },
  infoContent: {
    flex: 1,
  },
});
