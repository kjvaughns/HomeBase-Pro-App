// Task #296 — Estimate detail screen. Provides Send / Resend, copy public
// viewer link, delete (drafts only), and Convert-to-Invoice when accepted.
import React, { useState } from "react";
import {
  StyleSheet, View, ScrollView, ActivityIndicator,
  Pressable, Linking, Modal,
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
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { useAuthStore } from "@/state/authStore";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { estimateStatusLabel, estimateStatusTone } from "@/constants/estimateStatuses";

type RouteParams = { EstimateDetail: { estimateId: string } };

interface EstimateLineItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
}

interface Estimate {
  id: string;
  estimateNumber: string;
  status: string;
  totalCents: number;
  notes: string | null;
  publicToken: string;
  clientId: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  decidedAt: string | null;
  convertedAt: string | null;
  convertedInvoiceId: string | null;
}

interface ClientLite {
  id: string; firstName: string; lastName: string; email?: string | null;
}

function toneColor(tone: ReturnType<typeof estimateStatusTone>): string {
  switch (tone) {
    case "success": return Colors.success;
    case "danger": return Colors.error;
    case "info": return Colors.info;
    default: return "#6b7280";
  }
}

function formatCents(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function EstimateDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "EstimateDetail">>();
  const queryClient = useQueryClient();
  const { providerProfile } = useAuthStore();
  const { theme } = useTheme();

  const { estimateId } = (route.params ?? {}) as { estimateId?: string };
  const providerId = providerProfile?.id;

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmConvert, setConfirmConvert] = useState(false);

  const { data, isLoading, refetch } = useQuery<{
    estimate: Estimate;
    lineItems: EstimateLineItem[];
  }>({
    queryKey: ["/api/estimates", estimateId],
    enabled: !!estimateId,
    refetchInterval: (q) => {
      const s = q.state.data?.estimate?.status;
      return s === "sent" || s === "viewed" ? 5000 : false;
    },
  });

  const { data: clientsData } = useQuery<{ clients: ClientLite[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const estimate = data?.estimate;
  const lineItems = data?.lineItems ?? [];
  const client = estimate?.clientId
    ? (clientsData?.clients ?? []).find((c) => c.id === estimate.clientId) ?? null
    : null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/estimates", estimateId] });
    queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "estimates"] });
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/estimates/${estimateId}/send`, {});
      return r.json();
    },
    onSuccess: (resp) => {
      invalidate();
      if (resp?.emailSent) setActionMessage("Estimate emailed to client");
      else setActionMessage("Marked as sent (email could not be delivered)");
    },
    onError: () => setActionMessage("Could not send estimate"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/estimates/${estimateId}`);
    },
    onSuccess: () => {
      invalidate();
      navigation.goBack();
    },
    onError: () => setActionMessage("Could not delete estimate"),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/estimates/${estimateId}/convert`, {});
      return r.json();
    },
    onSuccess: (resp) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "invoices"] });
      if (resp?.invoice?.id) {
        navigation.replace("InvoiceDetail", { invoiceId: resp.invoice.id });
      }
    },
    onError: () => setActionMessage("Could not convert estimate"),
  });

  const viewerUrl = estimate
    ? `${getApiUrl().replace(/\/$/, "")}/estimates/${estimate.publicToken}`
    : "";

  const copyLink = async () => {
    if (!viewerUrl) return;
    await Clipboard.setStringAsync(viewerUrl);
    setActionMessage("Link copied to clipboard");
  };

  const openViewer = () => {
    if (viewerUrl) Linking.openURL(viewerUrl);
  };

  if (!estimateId) {
    return (
      <ThemedView style={[styles.center, { paddingTop: headerHeight }]}>
        <ThemedText>No estimate selected.</ThemedText>
      </ThemedView>
    );
  }

  if (isLoading || !estimate) {
    return (
      <ThemedView style={[styles.center, { paddingTop: headerHeight }]}>
        <ActivityIndicator color={Colors.accent} />
      </ThemedView>
    );
  }

  const tone = estimateStatusTone(estimate.status);
  const color = toneColor(tone);

  const canEdit = estimate.status === "draft" || estimate.status === "sent" || estimate.status === "viewed";
  const canDelete = estimate.status === "draft";
  const canSend = canEdit;
  const canConvert = estimate.status === "accepted";
  const alreadyConverted = !!estimate.convertedInvoiceId;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: horizontalPadding,
        }}
        refreshControl={undefined}
      >
        <GlassCard style={styles.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.h1}>Estimate {estimate.estimateNumber}</ThemedText>
              {client ? (
                <ThemedText style={{ color: theme.textSecondary, marginTop: 2 }}>
                  For {client.firstName} {client.lastName}{client.email ? ` · ${client.email}` : ""}
                </ThemedText>
              ) : null}
            </View>
            <View style={{
              paddingHorizontal: 10, paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: color + "20",
              borderWidth: 1, borderColor: color + "40",
            }}>
              <ThemedText style={{ color, fontWeight: "700", fontSize: 12 }}>
                {estimateStatusLabel(estimate.status).toUpperCase()}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.timeline, { borderTopColor: theme.separator }]}>
            {estimate.sentAt ? (
              <ThemedText style={[styles.timelineRow, { color: theme.textSecondary }]}>
                Sent {formatDateTime(estimate.sentAt)}
              </ThemedText>
            ) : null}
            {estimate.viewedAt ? (
              <ThemedText style={[styles.timelineRow, { color: theme.textSecondary }]}>
                Viewed {formatDateTime(estimate.viewedAt)}
              </ThemedText>
            ) : null}
            {estimate.decidedAt ? (
              <ThemedText style={[styles.timelineRow, { color: theme.textSecondary }]}>
                {estimate.status === "accepted" ? "Accepted " : estimate.status === "declined" ? "Declined " : "Decided "}
                {formatDateTime(estimate.decidedAt)}
              </ThemedText>
            ) : null}
            {estimate.expiresAt ? (
              <ThemedText style={[styles.timelineRow, { color: theme.textSecondary }]}>
                Expires {formatDateTime(estimate.expiresAt)}
              </ThemedText>
            ) : null}
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <ThemedText style={styles.sectionLabel}>LINE ITEMS</ThemedText>
          {lineItems.map((li, idx) => (
            <View key={li.id} style={[
              styles.lineItem,
              idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
            ]}>
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontWeight: "600" }}>{li.name}</ThemedText>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
                  {Number(li.quantity)} × {formatCents(li.unitPriceCents)}
                </ThemedText>
              </View>
              <ThemedText style={{ fontWeight: "600" }}>{formatCents(li.amountCents)}</ThemedText>
            </View>
          ))}
          <View style={[styles.totalRow, { borderTopColor: theme.separator }]}>
            <ThemedText style={{ color: theme.textSecondary }}>Total</ThemedText>
            <ThemedText style={{ fontSize: 20, fontWeight: "700" }}>{formatCents(estimate.totalCents)}</ThemedText>
          </View>
          {estimate.notes ? (
            <View style={{ marginTop: Spacing.md }}>
              <ThemedText style={styles.sectionLabel}>NOTES</ThemedText>
              <ThemedText style={{ color: theme.textSecondary }}>{estimate.notes}</ThemedText>
            </View>
          ) : null}
        </GlassCard>

        <GlassCard style={styles.card}>
          <ThemedText style={styles.sectionLabel}>PUBLIC LINK</ThemedText>
          <ThemedText
            numberOfLines={1}
            style={{ color: theme.textSecondary, fontSize: 13, marginBottom: Spacing.sm }}
          >
            {viewerUrl}
          </ThemedText>
          <View style={{ flexDirection: "row", gap: Spacing.sm }}>
            <SecondaryButton onPress={copyLink} testID="button-copy-link" style={{ flex: 1 }}>
              Copy Link
            </SecondaryButton>
            <SecondaryButton onPress={openViewer} testID="button-open-viewer" style={{ flex: 1 }}>
              Open Viewer
            </SecondaryButton>
          </View>
        </GlassCard>

        {actionMessage ? (
          <View style={[styles.banner, { borderColor: Colors.accent + "40", backgroundColor: Colors.accentLight }]}>
            <Feather name="check-circle" size={16} color={Colors.accent} />
            <ThemedText style={{ color: Colors.accent, marginLeft: 8 }}>{actionMessage}</ThemedText>
            <Pressable onPress={() => setActionMessage(null)} hitSlop={8} style={{ marginLeft: "auto" }}>
              <Feather name="x" size={14} color={Colors.accent} />
            </Pressable>
          </View>
        ) : null}

        <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
          {canConvert && !alreadyConverted ? (
            <PrimaryButton
              onPress={() => setConfirmConvert(true)}
              loading={convertMutation.isPending}
              testID="button-convert-to-invoice"
            >
              Convert to Invoice
            </PrimaryButton>
          ) : null}
          {alreadyConverted && estimate.convertedInvoiceId ? (
            <SecondaryButton
              onPress={() => navigation.navigate("InvoiceDetail", { invoiceId: estimate.convertedInvoiceId })}
              testID="button-view-converted-invoice"
            >
              View Converted Invoice
            </SecondaryButton>
          ) : null}
          {canSend ? (
            <PrimaryButton
              onPress={() => sendMutation.mutate()}
              loading={sendMutation.isPending}
              testID="button-send-estimate"
            >
              {estimate.status === "draft" ? "Send Estimate" : "Resend Estimate"}
            </PrimaryButton>
          ) : null}
          {canDelete ? (
            <Pressable
              onPress={() => setConfirmDelete(true)}
              style={{ alignItems: "center", paddingVertical: Spacing.md }}
              testID="button-delete-estimate"
            >
              <ThemedText style={{ color: Colors.error, fontWeight: "600" }}>Delete Draft</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <ConfirmModal
        visible={confirmDelete}
        title="Delete Estimate?"
        message="This estimate draft will be permanently removed."
        confirmLabel="Delete"
        confirmDestructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); deleteMutation.mutate(); }}
      />
      <ConfirmModal
        visible={confirmConvert}
        title="Convert to Invoice?"
        message="A new draft invoice will be created with the estimate's line items. You can review it before sending."
        confirmLabel="Convert"
        onCancel={() => setConfirmConvert(false)}
        onConfirm={() => { setConfirmConvert(false); convertMutation.mutate(); }}
      />
    </ThemedView>
  );
}

function ConfirmModal({
  visible, title, message, confirmLabel, confirmDestructive, onConfirm, onCancel,
}: {
  visible: boolean; title: string; message: string;
  confirmLabel: string; confirmDestructive?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardBackground }]}>
          <ThemedText style={{ fontSize: 17, fontWeight: "700", marginBottom: 8 }}>{title}</ThemedText>
          <ThemedText style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>{message}</ThemedText>
          <View style={{ flexDirection: "row", gap: Spacing.sm }}>
            <SecondaryButton onPress={onCancel} style={{ flex: 1 }}>Cancel</SecondaryButton>
            <Pressable
              onPress={onConfirm}
              style={[
                styles.confirmBtn,
                { backgroundColor: confirmDestructive ? Colors.error : Colors.accent },
              ]}
            >
              <ThemedText style={{ color: "#fff", fontWeight: "700" }}>{confirmLabel}</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { padding: Spacing.lg, marginBottom: Spacing.md },
  h1: { fontSize: 20, fontWeight: "700" },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: Spacing.sm, opacity: 0.7 },
  timeline: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, gap: 4 },
  timelineRow: { fontSize: 13 },
  lineItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: Spacing.md, marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  banner: {
    flexDirection: "row", alignItems: "center",
    padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, marginTop: Spacing.md,
  },
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center", padding: Spacing.lg,
  },
  modalCard: { width: "100%", maxWidth: 360, padding: Spacing.lg, borderRadius: BorderRadius.lg },
  confirmBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
    alignItems: "center", justifyContent: "center",
  },
});
