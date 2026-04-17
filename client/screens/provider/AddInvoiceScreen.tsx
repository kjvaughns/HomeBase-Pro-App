import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  TextInput as RNTextInput,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { NativeDatePickerSheet } from "@/components/NativeDatePickerSheet";

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

type AppTheme = typeof Colors["light"];

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

interface CustomService {
  id: string;
  name: string;
  basePrice?: string | null;
  priceFrom?: string | null;
  priceTo?: string | null;
  pricingType: string;
  description?: string | null;
}

interface LineItem {
  key: string;
  description: string;
  qty: string;
  unitPrice: string;
}

const newLineItem = (description = "", unitPrice = ""): LineItem => ({
  key: Math.random().toString(36).slice(2),
  description,
  qty: "1",
  unitPrice,
});

function calcTotal(items: LineItem[]): number {
  return items.reduce((sum, item) => {
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
}

function getServicePrice(service: CustomService): string {
  if (service.pricingType === "fixed" && service.basePrice) return service.basePrice;
  if (service.priceFrom) return service.priceFrom;
  return "";
}

function getServicePriceLabel(service: CustomService): string {
  if (service.pricingType === "variable" && service.priceFrom && service.priceTo) {
    const from = parseFloat(service.priceFrom);
    const to = parseFloat(service.priceTo);
    if (!isNaN(from) && !isNaN(to)) return `$${from.toFixed(0)}–$${to.toFixed(0)}`;
  }
  if (service.pricingType === "quote") return "Quote";
  if (service.pricingType === "service_call") return "Service Call";
  const price = getServicePrice(service);
  if (!price) return "Custom";
  const parsed = parseFloat(price);
  if (isNaN(parsed)) return "Custom";
  return `$${parsed.toFixed(2)}`;
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

  const { data: servicesData, isLoading: servicesLoading } = useQuery<{ services: CustomService[] }>({
    queryKey: ["/api/provider", providerId, "custom-services"],
    enabled: !!providerId,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing; cleanup tracked in Task #107
  const clients = clientsData?.clients || [];
  const jobs = jobsData?.jobs || [];
  const customServices = servicesData?.services || [];

  const [selectedClientId, setSelectedClientId] = useState<string | null>(preselectedClientId || null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Client picker modal state
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  // Service picker modal state
  const [servicePickerVisible, setServicePickerVisible] = useState(false);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;
  const clientJobs = jobs.filter((job) => job.clientId === selectedClientId);
  const total = calcTotal(lineItems);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [clients, clientSearch]);

  const updateItem = (key: string, field: keyof Omit<LineItem, "key">, value: string) => {
    setLineItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (key: string) => {
    setLineItems((prev) => (prev.length > 1 ? prev.filter((item) => item.key !== key) : prev));
  };

  const addBlankItem = () => {
    setLineItems((prev) => [...prev, newLineItem()]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const addServiceItem = (service: CustomService) => {
    const price = getServicePrice(service);
    setLineItems((prev) => [...prev, newLineItem(service.name, price)]);
    setServicePickerVisible(false);
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
    const hasValidItem = lineItems.some((item) => (parseFloat(item.unitPrice) || 0) > 0);
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

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedJobId(null);
    setClientPickerVisible(false);
    setClientSearch("");
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
            <Pressable
              style={[styles.clientSelectRow, { borderColor: selectedClient ? Colors.accent + "40" : theme.separator }]}
              onPress={() => setClientPickerVisible(true)}
              testID="button-select-client"
            >
              {selectedClient ? (
                <>
                  <View style={[styles.clientAvatar, { backgroundColor: Colors.accent }]}>
                    <ThemedText style={[styles.avatarText, { color: "#FFFFFF" }]}>
                      {selectedClient.firstName[0]}{selectedClient.lastName[0]}
                    </ThemedText>
                  </View>
                  <View style={styles.clientInfo}>
                    <ThemedText style={[styles.clientName, { color: Colors.accent }]}>
                      {selectedClient.firstName} {selectedClient.lastName}
                    </ThemedText>
                    {selectedClient.email ? (
                      <ThemedText style={[styles.clientEmail, { color: theme.textTertiary }]}>
                        {selectedClient.email}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Feather name="check-circle" size={20} color={Colors.accent} />
                </>
              ) : (
                <>
                  <View style={[styles.clientAvatar, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="user" size={18} color={theme.textTertiary} />
                  </View>
                  <ThemedText style={[styles.clientSelectPlaceholder, { color: theme.textTertiary }]}>
                    Select a client...
                  </ThemedText>
                  <Feather name="chevron-down" size={18} color={theme.textTertiary} />
                </>
              )}
            </Pressable>
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
            style={[styles.addItemBtn, { borderColor: Colors.accent + "40", backgroundColor: Colors.accentLight }]}
            onPress={() => setServicePickerVisible(true)}
            testID="button-add-service"
          >
            <Feather name="plus" size={14} color={Colors.accent} />
            <ThemedText style={[styles.addItemText, { color: Colors.accent }]}>Add Service</ThemedText>
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

      <NativeDatePickerSheet
        visible={showDatePicker}
        value={dueDate ?? new Date()}
        mode="date"
        minimumDate={new Date()}
        title="Select Due Date"
        onConfirm={(date) => {
          setDueDate(date);
          setShowDatePicker(false);
        }}
        onCancel={() => setShowDatePicker(false)}
      />

      {/* Client Picker Modal */}
      <Modal
        visible={clientPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setClientPickerVisible(false); setClientSearch(""); }}
      >
        <ClientPickerModal
          filteredClients={filteredClients}
          search={clientSearch}
          selectedClientId={selectedClientId}
          onSearch={setClientSearch}
          onSelect={handleSelectClient}
          onClose={() => { setClientPickerVisible(false); setClientSearch(""); }}
          theme={theme}
          insets={insets}
        />
      </Modal>

      {/* Service Picker Modal */}
      <Modal
        visible={servicePickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setServicePickerVisible(false)}
      >
        <ServicePickerModal
          services={customServices}
          isLoading={servicesLoading}
          onSelectService={addServiceItem}
          onCustomJob={() => { addBlankItem(); setServicePickerVisible(false); }}
          onClose={() => setServicePickerVisible(false)}
          theme={theme}
          insets={insets}
        />
      </Modal>
    </ThemedView>
  );
}

// ─── Client Picker Modal ──────────────────────────────────────────────────────

interface ClientPickerModalProps {
  filteredClients: Client[];
  search: string;
  selectedClientId: string | null;
  onSearch: (q: string) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
  theme: AppTheme;
  insets: EdgeInsets;
}

function ClientPickerModal({
  filteredClients,
  search,
  selectedClientId,
  onSearch,
  onSelect,
  onClose,
  theme,
  insets,
}: ClientPickerModalProps) {
  return (
    <View style={modalStyles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[modalStyles.sheet, { backgroundColor: theme.backgroundElevated, paddingBottom: insets.bottom + Spacing.md }]}>
        {/* Handle */}
        <View style={[modalStyles.handle, { backgroundColor: theme.separator }]} />

        <View style={modalStyles.sheetHeader}>
          <ThemedText style={modalStyles.sheetTitle}>Select Client</ThemedText>
          <Pressable onPress={onClose} hitSlop={12} testID="button-close-client-picker">
            <Feather name="x" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={[modalStyles.searchRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.separator }]}>
          <Feather name="search" size={16} color={theme.textTertiary} />
          <RNTextInput
            style={[modalStyles.searchInput, { color: theme.text }]}
            placeholder="Search clients..."
            placeholderTextColor={theme.textTertiary}
            value={search}
            onChangeText={onSearch}
            autoFocus
            testID="input-client-search"
          />
          {search.length > 0 ? (
            <Pressable onPress={() => onSearch("")} hitSlop={8}>
              <Feather name="x-circle" size={16} color={theme.textTertiary} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView style={modalStyles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {filteredClients.length === 0 ? (
            <View style={modalStyles.emptyState}>
              <Feather name="users" size={24} color={theme.textTertiary} />
              <ThemedText style={[modalStyles.emptyText, { color: theme.textTertiary }]}>No clients found</ThemedText>
            </View>
          ) : null}
          {filteredClients.map((client, idx) => {
            const isSelected = selectedClientId === client.id;
            return (
              <Pressable
                key={client.id}
                style={[
                  modalStyles.clientRow,
                  idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
                ]}
                onPress={() => onSelect(client.id)}
                testID={`client-option-${client.id}`}
              >
                <View style={[
                  modalStyles.clientAvatar,
                  { backgroundColor: isSelected ? Colors.accent : Colors.accentLight },
                ]}>
                  <ThemedText style={[
                    modalStyles.avatarText,
                    { color: isSelected ? "#FFFFFF" : Colors.accent },
                  ]}>
                    {client.firstName[0]}{client.lastName[0]}
                  </ThemedText>
                </View>
                <View style={modalStyles.clientInfo}>
                  <ThemedText style={[
                    modalStyles.clientName,
                    isSelected && { color: Colors.accent },
                  ]}>
                    {client.firstName} {client.lastName}
                  </ThemedText>
                  {client.email ? (
                    <ThemedText style={[modalStyles.clientEmail, { color: theme.textTertiary }]}>
                      {client.email}
                    </ThemedText>
                  ) : null}
                </View>
                {isSelected ? (
                  <Feather name="check-circle" size={20} color={Colors.accent} />
                ) : (
                  <View style={[modalStyles.radioOuter, { borderColor: theme.backgroundTertiary }]} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Service Picker Modal ─────────────────────────────────────────────────────

interface ServicePickerModalProps {
  services: CustomService[];
  isLoading: boolean;
  onSelectService: (service: CustomService) => void;
  onCustomJob: () => void;
  onClose: () => void;
  theme: AppTheme;
  insets: EdgeInsets;
}

function ServicePickerModal({
  services,
  isLoading,
  onSelectService,
  onCustomJob,
  onClose,
  theme,
  insets,
}: ServicePickerModalProps) {
  return (
    <View style={modalStyles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[modalStyles.sheet, { backgroundColor: theme.backgroundElevated, paddingBottom: insets.bottom + Spacing.md }]}>
        {/* Handle */}
        <View style={[modalStyles.handle, { backgroundColor: theme.separator }]} />

        <View style={modalStyles.sheetHeader}>
          <ThemedText style={modalStyles.sheetTitle}>Add Service</ThemedText>
          <Pressable onPress={onClose} hitSlop={12} testID="button-close-service-picker">
            <Feather name="x" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>

        <ScrollView style={modalStyles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Custom Job — always first */}
          <Pressable
            style={[modalStyles.serviceRow, { borderColor: theme.separator }]}
            onPress={onCustomJob}
            testID="button-custom-job"
          >
            <View style={[modalStyles.serviceIconWrap, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="edit-2" size={16} color={theme.textSecondary} />
            </View>
            <View style={modalStyles.serviceInfo}>
              <ThemedText style={[modalStyles.serviceName, { color: theme.text }]}>Custom Job</ThemedText>
              <ThemedText style={[modalStyles.serviceDesc, { color: theme.textTertiary }]}>
                Add a blank line item to fill in manually
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={16} color={theme.textTertiary} />
          </Pressable>

          {services.length > 0 ? (
            <View style={[modalStyles.sectionSep, { backgroundColor: theme.separator }]} />
          ) : null}

          {services.map((service, idx) => (
            <Pressable
              key={service.id}
              style={[
                modalStyles.serviceRow,
                { borderColor: theme.separator },
                idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
              ]}
              onPress={() => onSelectService(service)}
              testID={`service-option-${service.id}`}
            >
              <View style={[modalStyles.serviceIconWrap, { backgroundColor: Colors.accentLight }]}>
                <Feather name="tool" size={16} color={Colors.accent} />
              </View>
              <View style={modalStyles.serviceInfo}>
                <ThemedText style={modalStyles.serviceName}>{service.name}</ThemedText>
                {service.description ? (
                  <ThemedText style={[modalStyles.serviceDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                    {service.description}
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText style={[modalStyles.servicePrice, { color: Colors.accent }]}>
                {getServicePriceLabel(service)}
              </ThemedText>
            </Pressable>
          ))}

          {isLoading ? (
            <View style={modalStyles.emptyState}>
              <ThemedText style={[modalStyles.emptyText, { color: theme.textTertiary }]}>
                Loading services...
              </ThemedText>
            </View>
          ) : services.length === 0 ? (
            <View style={modalStyles.emptyState}>
              <Feather name="tool" size={24} color={theme.textTertiary} />
              <ThemedText style={[modalStyles.emptyText, { color: theme.textTertiary }]}>
                No saved services yet
              </ThemedText>
              <ThemedText style={[modalStyles.emptySubText, { color: theme.textTertiary }]}>
                Use Custom Job to add a line item manually
              </ThemedText>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  // Client select row (compact)
  clientSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    minHeight: 56,
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
  clientSelectPlaceholder: { ...Typography.body, flex: 1 },
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

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.sm,
    maxHeight: "80%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    ...Typography.title3,
    fontWeight: "700",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? Spacing.sm : 0,
    minHeight: 44,
  },
  searchInput: {
    ...Typography.body,
    flex: 1,
  },
  list: {
    paddingHorizontal: Spacing.screenPadding,
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
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  serviceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceInfo: { flex: 1 },
  serviceName: { ...Typography.subhead, fontWeight: "600" },
  serviceDesc: { ...Typography.caption1, marginTop: 2 },
  servicePrice: { ...Typography.subhead, fontWeight: "700" },
  sectionSep: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  emptySubText: {
    ...Typography.footnote,
    textAlign: "center",
  },
});
