// Task #296 — Estimates: minimal create screen, modeled after AddInvoiceScreen
// but stripped of Stripe-specific concerns (no due date / payment link).
import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  TextInput as RNTextInput,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { GlassCard } from "@/components/GlassCard";
import { FormSectionHeader } from "@/components/FormSectionHeader";
import { NativeDatePickerSheet } from "@/components/NativeDatePickerSheet";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { apiRequest } from "@/lib/query-client";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface LineItem {
  key: string;
  description: string;
  qty: string;
  unitPrice: string;
}

const newLineItem = (): LineItem => ({
  key: Math.random().toString(36).slice(2),
  description: "",
  qty: "1",
  unitPrice: "",
});

function calcTotal(items: LineItem[]): number {
  return items.reduce((s, it) => {
    return s + (parseFloat(it.qty) || 0) * (parseFloat(it.unitPrice) || 0);
  }, 0);
}

export default function AddEstimateScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { providerProfile } = useAuthStore();
  const { theme } = useTheme();

  const providerId = providerProfile?.id;
  const params = (route.params ?? {}) as {
    clientId?: string;
    prefillItems?: { description: string; qty: string; unitPrice: string }[];
    prefillNotes?: string;
  };
  const preselectedClientId = params.clientId;

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });
  const clients = clientsData?.clients || [];

  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    preselectedClientId || null,
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(
    params.prefillItems && params.prefillItems.length > 0
      ? params.prefillItems.map((it) => ({ key: Math.random().toString(36).slice(2), ...it }))
      : [newLineItem()],
  );
  const [notes, setNotes] = useState(params.prefillNotes ?? "");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;
  const total = calcTotal(lineItems);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)),
    );
  }, [clients, clientSearch]);

  const updateItem = (key: string, field: keyof Omit<LineItem, "key">, value: string) => {
    setLineItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)),
    );
  };

  const removeItem = (key: string) => {
    setLineItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  };

  const addItem = () => {
    setLineItems((prev) => [...prev, newLineItem()]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const buildPayload = () => ({
    providerId: providerId!,
    clientId: selectedClientId!,
    notes: notes.trim() || undefined,
    expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
    lineItems: lineItems.map((it) => ({
      description: it.description || "Service",
      quantity: parseFloat(it.qty) || 1,
      unitPrice: parseFloat(it.unitPrice) || 0,
    })),
  });

  const createMutation = useMutation({
    mutationFn: async (sendImmediately: boolean) => {
      const created = await apiRequest("POST", "/api/estimates", buildPayload()).then((r) => r.json());
      if (sendImmediately && created?.estimate?.id) {
        await apiRequest("POST", `/api/estimates/${created.estimate.id}/send`, {}).then((r) => r.json());
      }
      return created;
    },
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "estimates"] });
      if (data?.estimate?.id) {
        navigation.replace("EstimateDetail", { estimateId: data.estimate.id });
      } else {
        navigation.goBack();
      }
    },
    onError: () => setFormError("Could not save the estimate. Please try again."),
  });

  const validate = () => {
    setFormError(null);
    if (!providerId) { setFormError("Provider profile not loaded yet."); return false; }
    if (!selectedClientId) { setFormError("Please select a client."); return false; }
    const hasItem = lineItems.some((it) => (parseFloat(it.unitPrice) || 0) > 0);
    if (!hasItem) { setFormError("Add at least one line item with a price."); return false; }
    return true;
  };

  const handleSend = () => { if (validate()) createMutation.mutate(true); };
  const handleDraft = () => { if (validate()) createMutation.mutate(false); };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: horizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.section}>
          <FormSectionHeader icon="users" title="Client" />
          {clients.length === 0 ? (
            <ThemedText style={{ color: theme.textTertiary }}>
              Add a client first to create an estimate.
            </ThemedText>
          ) : (
            <Pressable
              style={[styles.selectRow, { borderColor: selectedClient ? Colors.accent + "40" : theme.separator }]}
              onPress={() => setClientPickerOpen(true)}
              testID="button-select-client"
            >
              {selectedClient ? (
                <>
                  <View style={[styles.avatar, { backgroundColor: Colors.accent }]}>
                    <ThemedText style={styles.avatarText}>
                      {selectedClient.firstName[0]}{selectedClient.lastName[0]}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: "600", color: Colors.accent }}>
                      {selectedClient.firstName} {selectedClient.lastName}
                    </ThemedText>
                    {selectedClient.email ? (
                      <ThemedText style={{ color: theme.textTertiary, fontSize: 13 }}>
                        {selectedClient.email}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Feather name="check-circle" size={20} color={Colors.accent} />
                </>
              ) : (
                <>
                  <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="user" size={18} color={theme.textTertiary} />
                  </View>
                  <ThemedText style={{ flex: 1, color: theme.textTertiary }}>
                    Select a client...
                  </ThemedText>
                  <Feather name="chevron-down" size={18} color={theme.textTertiary} />
                </>
              )}
            </Pressable>
          )}
        </GlassCard>

        <GlassCard style={styles.section}>
          <FormSectionHeader icon="list" title="Line Items" />
          {lineItems.map((it, idx) => (
            <View key={it.key} style={styles.itemBlock}>
              <RNTextInput
                style={[styles.descInput, { color: theme.text, borderBottomColor: theme.separator }]}
                placeholder="Description"
                placeholderTextColor={theme.textTertiary}
                value={it.description}
                onChangeText={(v) => updateItem(it.key, "description", v)}
                testID={`input-desc-${idx}`}
              />
              <View style={styles.amountRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.miniLabel, { color: theme.textTertiary }]}>QTY</ThemedText>
                  <RNTextInput
                    style={[styles.miniInput, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                    placeholder="1"
                    placeholderTextColor={theme.textTertiary}
                    value={it.qty}
                    onChangeText={(v) => updateItem(it.key, "qty", v)}
                    keyboardType="decimal-pad"
                    testID={`input-qty-${idx}`}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <ThemedText style={[styles.miniLabel, { color: theme.textTertiary }]}>UNIT PRICE</ThemedText>
                  <View style={[styles.priceRow, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText style={{ color: theme.textSecondary, marginRight: 4 }}>$</ThemedText>
                    <RNTextInput
                      style={[styles.priceInput, { color: theme.text }]}
                      placeholder="0.00"
                      placeholderTextColor={theme.textTertiary}
                      value={it.unitPrice}
                      onChangeText={(v) => updateItem(it.key, "unitPrice", v)}
                      keyboardType="decimal-pad"
                      testID={`input-price-${idx}`}
                    />
                  </View>
                </View>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <ThemedText style={[styles.miniLabel, { color: theme.textTertiary }]}>TOTAL</ThemedText>
                  <ThemedText style={{ fontWeight: "600", color: Colors.accent }}>
                    ${((parseFloat(it.qty) || 0) * (parseFloat(it.unitPrice) || 0)).toFixed(2)}
                  </ThemedText>
                </View>
                {lineItems.length > 1 ? (
                  <Pressable
                    onPress={() => removeItem(it.key)}
                    style={[styles.removeBtn, { backgroundColor: theme.backgroundSecondary }]}
                    hitSlop={8}
                    testID={`button-remove-item-${idx}`}
                  >
                    <Feather name="trash-2" size={14} color={theme.textTertiary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
          <Pressable
            style={[styles.addBtn, { borderColor: Colors.accent + "40", backgroundColor: Colors.accentLight }]}
            onPress={addItem}
            testID="button-add-line-item"
          >
            <Feather name="plus" size={14} color={Colors.accent} />
            <ThemedText style={{ color: Colors.accent, fontWeight: "600", marginLeft: 6 }}>Add Item</ThemedText>
          </Pressable>

          <View style={[styles.totalRow, { borderTopColor: theme.separator }]}>
            <ThemedText style={{ color: theme.textSecondary }}>Total</ThemedText>
            <ThemedText style={{ fontSize: 20, fontWeight: "700" }}>${total.toFixed(2)}</ThemedText>
          </View>
        </GlassCard>

        <GlassCard style={styles.section}>
          <FormSectionHeader icon="calendar" title="Expires" />
          <Pressable
            style={[styles.datePill, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => setShowDatePicker(true)}
            testID="picker-expires-at"
          >
            <Feather name="calendar" size={15} color={expiresAt ? Colors.accent : theme.textTertiary} />
            <ThemedText style={{ marginLeft: 8, color: expiresAt ? theme.text : theme.textTertiary, flex: 1 }}>
              {expiresAt ? formatDate(expiresAt) : "Optional expiration date"}
            </ThemedText>
            {expiresAt ? (
              <Pressable onPress={() => setExpiresAt(null)} hitSlop={8}>
                <Feather name="x" size={14} color={theme.textTertiary} />
              </Pressable>
            ) : null}
          </Pressable>

          <View style={{ height: Spacing.md }} />
          <FormSectionHeader icon="edit-3" title="Notes" />
          <TextField
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything the client should know..."
            multiline
            numberOfLines={3}
            testID="input-notes"
          />
        </GlassCard>

        {formError ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color={Colors.error} />
            <ThemedText style={{ color: Colors.error, marginLeft: 8 }}>{formError}</ThemedText>
          </View>
        ) : null}

        <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
          <PrimaryButton
            onPress={handleSend}
            loading={createMutation.isPending}
            disabled={createMutation.isPending || clients.length === 0}
            testID="button-send-estimate"
          >
            Send Estimate
          </PrimaryButton>
          <SecondaryButton
            onPress={handleDraft}
            loading={createMutation.isPending}
            disabled={createMutation.isPending || clients.length === 0}
            testID="button-save-draft"
          >
            Save as Draft
          </SecondaryButton>
        </View>
      </KeyboardAwareScrollViewCompat>

      <NativeDatePickerSheet
        visible={showDatePicker}
        value={expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
        mode="date"
        minimumDate={new Date()}
        title="Estimate Expires"
        onConfirm={(d) => { setExpiresAt(d); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />

      <Modal
        visible={clientPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setClientPickerOpen(false)}
      >
        <ThemedView style={{ flex: 1, padding: Spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md }}>
            <ThemedText style={{ fontSize: 18, fontWeight: "700" }}>Select client</ThemedText>
            <Pressable
              onPress={() => setClientPickerOpen(false)}
              hitSlop={11}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
          <TextField
            value={clientSearch}
            onChangeText={setClientSearch}
            placeholder="Search clients..."
          />
          <View style={{ marginTop: Spacing.md }}>
            {filteredClients.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  setSelectedClientId(c.id);
                  setClientPickerOpen(false);
                  setClientSearch("");
                }}
                style={{ paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator }}
                testID={`client-option-${c.id}`}
              >
                <ThemedText style={{ fontWeight: "600" }}>{c.firstName} {c.lastName}</ThemedText>
                {c.email ? (
                  <ThemedText style={{ color: theme.textTertiary, fontSize: 13 }}>{c.email}</ThemedText>
                ) : null}
              </Pressable>
            ))}
          </View>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { marginBottom: Spacing.md, padding: Spacing.lg },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "600" },
  itemBlock: { paddingVertical: Spacing.sm },
  descInput: {
    fontSize: 15,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
  },
  amountRow: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.sm },
  miniLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  miniInput: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    fontSize: 14,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  priceInput: { flex: 1, paddingVertical: 8, fontSize: 14 },
  removeBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: Spacing.sm, marginTop: Spacing.sm,
    borderWidth: 1, borderRadius: BorderRadius.md,
  },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: Spacing.md, marginTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  datePill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.md,
  },
});
