import React from "react";
import { StyleSheet, ScrollView, View, Alert, ActivityIndicator } from "react-native";
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

interface Invoice {
  id: string;
  providerId: string;
  clientId: string;
  jobId?: string;
  amount: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  dueDate?: string;
  paidDate?: string;
  notes?: string;
  createdAt: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
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

  const invoice = invoiceData?.invoice;
  const clients = clientsData?.clients || [];

  const getClientName = (clientId: string): string => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      return `${client.firstName} ${client.lastName}`;
    }
    return "Unknown Client";
  };

  const getClient = (clientId: string): Client | undefined => {
    return clients.find((c) => c.id === clientId);
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/send`, {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "invoices"] });
      if (data.emailSent) {
        Alert.alert("Invoice Sent", "Invoice has been sent and emailed to the client.");
      } else if (data.emailError) {
        Alert.alert("Invoice Sent", `Invoice status updated but email failed: ${data.emailError}`);
      } else {
        Alert.alert("Invoice Sent", "Invoice has been marked as sent. No email address on file for client.");
      }
    },
    onError: () => {
      Alert.alert("Error", "Failed to send invoice.");
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/mark-paid`, {});
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
      "Are you sure you want to send this invoice to the client?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send", onPress: () => sendMutation.mutate() },
      ]
    );
  };

  const handleMarkPaid = () => {
    Alert.alert(
      "Mark as Paid",
      "Are you sure you want to mark this invoice as paid?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Mark Paid", onPress: () => markPaidMutation.mutate() },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel Invoice",
      "Are you sure you want to cancel this invoice? This action cannot be undone.",
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
      case "draft": return "neutral";
      case "cancelled": return "neutral";
      default: return "neutral";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { 
      month: "long", 
      day: "numeric", 
      year: "numeric" 
    });
  };

  if (isLoading || !invoice) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </ThemedView>
    );
  }

  const client = getClient(invoice.clientId);
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
        <GlassCard style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Invoice
              </ThemedText>
              <ThemedText type="h2">
                ${parseFloat(invoice.amount).toLocaleString()}
              </ThemedText>
            </View>
            <StatusPill
              status={getStatusType(invoice.status)}
              label={invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Client</ThemedText>
          
          <View style={styles.clientRow}>
            <View style={[styles.clientAvatar, { backgroundColor: Colors.accent + "20" }]}>
              <ThemedText style={{ color: Colors.accent, fontWeight: "600", fontSize: 18 }}>
                {client ? `${client.firstName[0]}${client.lastName[0]}` : "?"}
              </ThemedText>
            </View>
            <View style={styles.clientInfo}>
              <ThemedText style={{ fontWeight: "600", fontSize: 16 }}>
                {getClientName(invoice.clientId)}
              </ThemedText>
              {client?.email ? (
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {client.email}
                </ThemedText>
              ) : null}
              {client?.phone ? (
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {client.phone}
                </ThemedText>
              ) : null}
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Details</ThemedText>
          
          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="calendar" size={16} color={theme.textSecondary} />
            </View>
            <View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Created
              </ThemedText>
              <ThemedText style={{ fontWeight: "500" }}>
                {formatDate(invoice.createdAt)}
              </ThemedText>
            </View>
          </View>

          {invoice.dueDate ? (
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="clock" size={16} color={theme.textSecondary} />
              </View>
              <View>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Due Date
                </ThemedText>
                <ThemedText style={{ fontWeight: "500" }}>
                  {formatDate(invoice.dueDate)}
                </ThemedText>
              </View>
            </View>
          ) : null}

          {invoice.paidDate ? (
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: Colors.accent + "20" }]}>
                <Feather name="check-circle" size={16} color={Colors.accent} />
              </View>
              <View>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Paid On
                </ThemedText>
                <ThemedText style={{ fontWeight: "500", color: Colors.accent }}>
                  {formatDate(invoice.paidDate)}
                </ThemedText>
              </View>
            </View>
          ) : null}

          {invoice.notes ? (
            <View style={styles.notesSection}>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                Notes
              </ThemedText>
              <ThemedText>{invoice.notes}</ThemedText>
            </View>
          ) : null}
        </GlassCard>

        <View style={styles.buttons}>
          {invoice.status === "draft" ? (
            <PrimaryButton onPress={handleSend} disabled={isPending}>
              {sendMutation.isPending ? "Sending..." : "Send Invoice"}
            </PrimaryButton>
          ) : null}

          {(invoice.status === "sent" || invoice.status === "overdue") ? (
            <PrimaryButton onPress={handleMarkPaid} disabled={isPending}>
              {markPaidMutation.isPending ? "Updating..." : "Mark as Paid"}
            </PrimaryButton>
          ) : null}

          {invoice.status !== "paid" && invoice.status !== "cancelled" ? (
            <SecondaryButton onPress={handleCancel} disabled={isPending}>
              Cancel Invoice
            </SecondaryButton>
          ) : null}
        </View>
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
  headerCard: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  clientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  clientInfo: {
    flex: 1,
  },
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
  notesSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
  },
  buttons: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
});
