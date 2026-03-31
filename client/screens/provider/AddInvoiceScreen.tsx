import React, { useState } from "react";
import { StyleSheet, View, Pressable, ScrollView, TextInput as RNTextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { GlassCard } from "@/components/GlassCard";
import { FormSectionHeader } from "@/components/FormSectionHeader";
import { Spacing, Typography, Colors, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import * as Haptics from "expo-haptics";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

interface Job {
  id: string;
  clientId: string;
  title: string;
  estimatedPrice?: string;
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
  return items.reduce((sum, item) => {
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
}

export default function AddInvoiceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { providerProfile } = useAuthStore();
  const { theme } = useTheme();

  const providerId = providerProfile?.id;
  const preselectedClientId = (route.params as any)?.clientId;

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const { data: jobsData } = useQuery<{ jobs: Job[] }>({
    queryKey: ["/api/provider", providerId, "jobs"],
    enabled: !!providerId,
  });

  const clients = clientsData?.clients || [];
  const jobs = jobsData?.jobs || [];

  const [selectedClientId, setSelectedClientId] = useState<string | null>(preselectedClientId || null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const clientJobs = jobs.filter((job) => job.clientId === selectedClientId);
  const total = calcTotal(lineItems);

  const updateItem = (key: string, field: keyof Omit<LineItem, "key">, value: string) => {
    setLineItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (key: string) => {
    setLineItems((prev) => (prev.length > 1 ? prev.filter((item) => item.key !== key) : prev));
  };

  const addItem = () => {
    setLineItems((prev) => [...prev, newLineItem()]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const buildPayload = (sendImmediately: boolean) => ({
    providerId: providerId!,
    clientId: selectedClientId!,
    jobId: selectedJobId || undefined,
    lineItems: lineItems.map((item) => ({
      description: item.description || "Service",
      quantity: parseFloat(item.qty) || 1,
      unitPrice: parseFloat(item.unitPrice) || 0,
      total: (parseFloat(item.qty) || 1) * (parseFloat(item.unitPrice) || 0),
    })),
    amount: total.toFixed(2),
    dueDate: dueDate ? dueDate.toISOString() : undefined,
    notes: notes.trim() || undefined,
    sendImmediately,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ReturnType<typeof buildPayload>) => {
      const response = await apiRequest("POST", "/api/invoices/create-and-send", data);
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "stats"] });
      navigation.goBack();
    },
    onError: () => {
      setFormError("Failed to create invoice. Please try again.");
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async (data: ReturnType<typeof buildPayload>) => {
      const response = await apiRequest("POST", "/api/invoices", data);
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "invoices"] });
      navigation.goBack();
    },
    onError: () => {
      setFormError("Failed to save invoice. Please try again.");
    },
  });

  const validateForm = () => {
    setFormError(null);
    if (!selectedClientId) { setFormError("Please select a client."); return false; }
    if (!providerId) { setFormError("Provider profile not found."); return false; }
    const hasValidItem = lineItems.some(
      (item) => (parseFloat(item.unitPrice) || 0) > 0
    );
    if (!hasValidItem) { setFormError("Please add at least one line item with a price."); return false; }
    return true;
  };

  const handleCreateAndSend = () => {
    if (!validateForm()) return;
    createMutation.mutate(buildPayload(true));
  };

  const handleSaveDraft = () => {
    if (!validateForm()) return;
    saveDraftMutation.mutate(buildPayload(false));
  };

  const handleJobSelect = (jobId: string) => {
    if (selectedJobId === jobId) {
      setSelectedJobId(null);
    } else {
      setSelectedJobId(jobId);
      const job = jobs.find((j) => j.id === jobId);
      if (job?.estimatedPrice) {
        setLineItems([{
          key: Math.random().toString(36).slice(2),
          description: job.title,
          qty: "1",
          unitPrice: job.estimatedPrice,
        }]);
      }
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const anyLoading = createMutation.isPending || saveDraftMutation.isPending;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Client */}
        <GlassCard style={styles.section}>
          <FormSectionHeader icon="users" title="Client" />

          {clients.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="users" size={20} color={theme.textTertiary} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
                No clients yet
              </ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
                Add a client first to create an invoice.
              </ThemedText>
            </View>
          ) : (
            <View>
              {clients.map((client, idx) => (
                <Pressable
                  key={client.id}
                  style={[
                    styles.clientRow,
                    idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
                  ]}
                  onPress={() => { setSelectedClientId(client.id); setSelectedJobId(null); }}
                  testID={`client-option-${client.id}`}
                >
                  <View style={[
                    styles.clientAvatar,
                    { backgroundColor: selectedClientId === client.id ? Colors.accent : Colors.accentLight },
                  ]}>
                    <ThemedText style={[
                      styles.avatarText,
                      { color: selectedClientId === client.id ? "#FFFFFF" : Colors.accent },
                    ]}>
                      {client.firstName[0]}{client.lastName[0]}
                    </ThemedText>
                  </View>
                  <View style={styles.clientInfo}>
                    <ThemedText style={[
                      styles.clientName,
                      selectedClientId === client.id && { color: Colors.accent },
                    ]}>
                      {client.firstName} {client.lastName}
                    </ThemedText>
                    {client.email ? (
                      <ThemedText style={[styles.clientEmail, { color: theme.textTertiary }]}>
                        {client.email}
                      </ThemedText>
                    ) : null}
                  </View>
                  {selectedClientId === client.id ? (
                    <Feather name="check-circle" size={20} color={Colors.accent} />
                  ) : (
                    <View style={[styles.radioOuter, { borderColor: theme.backgroundTertiary }]} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </GlassCard>

        {/* Link to Job (optional) */}
        {selectedClientId && clientJobs.length > 0 ? (
          <GlassCard style={styles.section}>
            <FormSectionHeader icon="briefcase" title="Link to Job" iconBg={theme.backgroundSecondary}>
              <View style={[styles.optionalBadge, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={[styles.optionalText, { color: theme.textTertiary }]}>Optional</ThemedText>
              </View>
            </FormSectionHeader>
            <View>
              {clientJobs.map((job, idx) => (
                <Pressable
                  key={job.id}
                  style={[
                    styles.jobRow,
                    idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
                  ]}
                  onPress={() => handleJobSelect(job.id)}
                  testID={`job-option-${job.id}`}
                >
                  <View style={[
                    styles.jobIconWrap,
                    { backgroundColor: selectedJobId === job.id ? Colors.accentLight : theme.backgroundSecondary },
                  ]}>
                    <Feather name="tool" size={14} color={selectedJobId === job.id ? Colors.accent : theme.textTertiary} />
                  </View>
                  <View style={styles.jobInfo}>
                    <ThemedText style={[
                      styles.jobTitle,
                      selectedJobId === job.id && { color: Colors.accent },
                    ]}>
                      {job.title}
                    </ThemedText>
                    {job.estimatedPrice ? (
                      <ThemedText style={[styles.jobPrice, { color: Colors.accent }]}>
                        ${job.estimatedPrice}
                      </ThemedText>
                    ) : null}
                  </View>
                  {selectedJobId === job.id ? (
                    <Feather name="check-circle" size={20} color={Colors.accent} />
                  ) : (
                    <View style={[styles.radioOuter, { borderColor: theme.backgroundTertiary }]} />
                  )}
                </Pressable>
              ))}
            </View>
          </GlassCard>
        ) : null}

        {/* Line Items */}
        <GlassCard style={styles.section}>
          <FormSectionHeader icon="list" title="Line Items" />

          {lineItems.map((item, idx) => (
            <View key={item.key}>
              {idx > 0 ? (
                <View style={[styles.itemDivider, { backgroundColor: theme.separator }]} />
              ) : null}
              <View style={styles.lineItemRow}>
                <View style={styles.lineItemMain}>
                  <RNTextInput
                    style={[styles.descriptionInput, { color: theme.text, borderBottomColor: theme.separator }]}
                    placeholder="Description"
                    placeholderTextColor={theme.textTertiary}
                    value={item.description}
                    onChangeText={(v) => updateItem(item.key, "description", v)}
                    testID={`input-desc-${idx}`}
                  />
                  <View style={styles.lineItemAmountRow}>
                    <View style={styles.qtyWrap}>
                      <ThemedText style={[styles.fieldMini, { color: theme.textTertiary }]}>QTY</ThemedText>
                      <RNTextInput
                        style={[styles.qtyInput, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                        placeholder="1"
                        placeholderTextColor={theme.textTertiary}
                        value={item.qty}
                        onChangeText={(v) => updateItem(item.key, "qty", v)}
                        keyboardType="decimal-pad"
                        testID={`input-qty-${idx}`}
                      />
                    </View>
                    <View style={styles.priceWrap}>
                      <ThemedText style={[styles.fieldMini, { color: theme.textTertiary }]}>UNIT PRICE</ThemedText>
                      <View style={[styles.priceInputRow, { backgroundColor: theme.backgroundSecondary }]}>
                        <ThemedText style={[styles.dollarSign, { color: theme.textSecondary }]}>$</ThemedText>
                        <RNTextInput
                          style={[styles.priceInput, { color: theme.text }]}
                          placeholder="0.00"
                          placeholderTextColor={theme.textTertiary}
                          value={item.unitPrice}
                          onChangeText={(v) => updateItem(item.key, "unitPrice", v)}
                          keyboardType="decimal-pad"
                          testID={`input-price-${idx}`}
                        />
                      </View>
                    </View>
                    <View style={styles.lineTotalWrap}>
                      <ThemedText style={[styles.fieldMini, { color: theme.textTertiary }]}>TOTAL</ThemedText>
                      <ThemedText style={[styles.lineTotalText, { color: Colors.accent }]}>
                        ${((parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
                      </ThemedText>
                    </View>
                  </View>
                </View>
                {lineItems.length > 1 ? (
                  <Pressable
                    style={[styles.removeBtn, { backgroundColor: theme.backgroundSecondary }]}
                    onPress={() => removeItem(item.key)}
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
            style={[styles.addItemBtn, { borderColor: Colors.accent + "40" }]}
            onPress={addItem}
            testID="button-add-line-item"
          >
            <Feather name="plus" size={14} color={Colors.accent} />
            <ThemedText style={[styles.addItemText, { color: Colors.accent }]}>Add Line Item</ThemedText>
          </Pressable>

          {/* Total */}
          <View style={[styles.totalRow, { borderTopColor: theme.separator }]}>
            <ThemedText style={[styles.totalLabel, { color: theme.textSecondary }]}>Total</ThemedText>
            <ThemedText style={[styles.totalAmount, { color: theme.text }]}>
              ${total.toFixed(2)}
            </ThemedText>
          </View>
        </GlassCard>

        {/* Schedule & Notes */}
        <GlassCard style={styles.section}>
          <FormSectionHeader icon="calendar" title="Schedule" />

          <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Due Date</ThemedText>
          <Pressable
            style={[styles.datePill, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => setShowDatePicker(true)}
            testID="picker-due-date"
          >
            <Feather name="calendar" size={15} color={dueDate ? Colors.accent : theme.textTertiary} />
            <ThemedText style={[styles.datePillText, { color: dueDate ? theme.text : theme.textTertiary }]}>
              {dueDate ? formatDate(dueDate) : "Select due date (optional)"}
            </ThemedText>
            {dueDate ? (
              <Pressable onPress={() => setDueDate(null)} hitSlop={8}>
                <Feather name="x" size={14} color={theme.textTertiary} />
              </Pressable>
            ) : null}
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.separator }]} />

          <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Notes (optional)</ThemedText>
          <TextField
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any notes or additional details..."
            multiline
            numberOfLines={3}
            testID="input-notes"
          />
        </GlassCard>

        {formError ? (
          <View style={[styles.errorBox, { backgroundColor: "#FEF2F2" }]}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
            <ThemedText style={[styles.errorText, { color: "#EF4444" }]}>{formError}</ThemedText>
          </View>
        ) : null}

        {/* Footer Actions */}
        <View style={styles.footer}>
          <PrimaryButton
            onPress={handleCreateAndSend}
            loading={createMutation.isPending}
            disabled={anyLoading || clients.length === 0}
            testID="button-create-send"
          >
            Send Invoice
          </PrimaryButton>
          <SecondaryButton
            onPress={handleSaveDraft}
            loading={saveDraftMutation.isPending}
            disabled={anyLoading || clients.length === 0}
            testID="button-save-draft"
          >
            Save as Draft
          </SecondaryButton>
          <Pressable
            onPress={() => navigation.goBack()}
            disabled={anyLoading}
            style={styles.cancelRow}
          >
            <ThemedText style={[styles.cancelText, { color: theme.textTertiary }]}>Cancel</ThemedText>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>

      {showDatePicker ? (
        <DateTimePicker
          value={dueDate ?? new Date()}
          mode="date"
          display="spinner"
          minimumDate={new Date()}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(false);
            if (date) setDueDate(date);
          }}
        />
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { marginBottom: Spacing.lg },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.md },
  fieldLabel: {
    ...Typography.footnote,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  fieldMini: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubtitle: {
    ...Typography.footnote,
    textAlign: "center",
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    ...Typography.subhead,
    fontWeight: "700",
  },
  clientInfo: { flex: 1 },
  clientName: { ...Typography.subhead, fontWeight: "600" },
  clientEmail: { ...Typography.caption1, marginTop: 2 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  optionalBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  optionalText: {
    ...Typography.caption2,
    fontWeight: "500",
  },
  jobRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  jobIconWrap: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  jobInfo: { flex: 1 },
  jobTitle: { ...Typography.subhead, fontWeight: "600" },
  jobPrice: { ...Typography.caption1, fontWeight: "600", marginTop: 2 },
  // Line items
  itemDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.md },
  lineItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  lineItemMain: { flex: 1 },
  descriptionInput: {
    ...Typography.body,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
  },
  lineItemAmountRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "flex-end",
  },
  qtyWrap: { width: 60 },
  qtyInput: {
    ...Typography.body,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    textAlign: "center",
  },
  priceWrap: { flex: 1 },
  priceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  dollarSign: { ...Typography.body, marginRight: 2 },
  priceInput: { ...Typography.body, flex: 1 },
  lineTotalWrap: { width: 64, alignItems: "flex-end" },
  lineTotalText: { ...Typography.subhead, fontWeight: "700" },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: BorderRadius.md,
    alignSelf: "flex-start",
  },
  addItemText: { ...Typography.footnote, fontWeight: "600" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: { ...Typography.headline, fontWeight: "600" },
  totalAmount: { ...Typography.title2, fontWeight: "700" },
  // Schedule
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  datePillText: { ...Typography.body, flex: 1 },
  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: { ...Typography.subhead, flex: 1 },
  // Footer
  footer: { gap: Spacing.sm },
  cancelRow: { alignItems: "center", paddingVertical: Spacing.md },
  cancelText: { ...Typography.body },
});
