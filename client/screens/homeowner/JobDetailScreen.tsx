import React from "react";
import { StyleSheet, View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type ScreenRouteProp = RouteProp<RootStackParamList, "JobDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AppointmentRecord {
  id: string;
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

interface ProviderInfo {
  businessName: string;
  phone?: string | null;
  email?: string | null;
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
  totalAmount: string;
  dueDate: string | null;
  paidAt: string | null;
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

function formatDate(dateStr: string): string {
  if (!dateStr) return "TBD";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function JobDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { jobId } = route.params;

  const { data: aptData, isLoading } = useQuery<{ appointment: AppointmentRecord; provider: ProviderInfo | null }>({
    queryKey: ["/api/appointments", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const url = new URL(`/api/appointments/${jobId}`, getApiUrl());
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to load appointment");
      return res.json();
    },
  });

  const { data: jobData } = useQuery<{ job: JobRecord | null }>({
    queryKey: ["/api/appointments", jobId, "job"],
    enabled: !!jobId,
    queryFn: async () => {
      const url = new URL(`/api/appointments/${jobId}/job`, getApiUrl());
      const res = await fetch(url.toString());
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
      const res = await fetch(url.toString());
      if (!res.ok) return { invoice: null };
      return res.json();
    },
  });

  const invoice = invoiceData?.invoice;
  const appointment = aptData?.appointment;
  const provider = aptData?.provider;

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
        </View>
      </ThemedView>
    );
  }

  const statusKey = appointment.status || "pending";
  const statusConfig = STATUS_CONFIG[statusKey] || { label: statusKey, status: "neutral" as const };
  const price = appointment.finalPrice || appointment.estimatedPrice;

  const isInvoiceUnpaid = invoice && invoice.status !== "paid" && invoice.status !== "cancelled";

  const handlePayInvoice = () => {
    if (!invoice) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    navigation.navigate("Payment", { jobId, invoiceId: invoice.id });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
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
                  <ThemedText style={styles.detailValue}>{formatDate(appointment.scheduledDate)}</ThemedText>
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
                    {formatCurrency(parseFloat(price))}
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
                      color: invoice.status === "paid" ? Colors.accent : "#F59E0B"
                    }]}>
                      {invoice.status === "paid" ? "Paid" : invoice.status === "sent" ? "Payment Due" : invoice.status.toUpperCase()}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.invoiceAmount}>
                    {formatCurrency(parseFloat(invoice.totalAmount || "0"))}
                  </ThemedText>
                </View>
                {invoice.dueDate ? (
                  <ThemedText style={[styles.dueDateText, { color: theme.textSecondary }]}>
                    Due: {formatDate(invoice.dueDate)}
                  </ThemedText>
                ) : null}
                {isInvoiceUnpaid ? (
                  <View style={{ marginTop: Spacing.md }}>
                    <PrimaryButton onPress={handlePayInvoice} testID="button-pay-invoice">
                      Pay Invoice
                    </PrimaryButton>
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
                  {formatDate(appointment.completedAt)}
                </ThemedText>
              ) : null}
            </GlassCard>
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
