import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  Modal,
  Pressable,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import type { ComponentProps } from "react";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { GlassCard } from "@/components/GlassCard";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, Typography, Colors, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

type FeatherName = ComponentProps<typeof Feather>["name"];

function SectionHeader({ icon, title, iconBg, children }: { icon: FeatherName; title: string; iconBg?: string; children?: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={sectionHeaderStyles.row}>
      <View style={[sectionHeaderStyles.iconTile, { backgroundColor: iconBg ?? Colors.accentLight }]}>
        <Feather name={icon} size={15} color={iconBg ? theme.textSecondary : Colors.accent} />
      </View>
      <ThemedText style={sectionHeaderStyles.title}>{title}</ThemedText>
      {children}
    </View>
  );
}

const sectionHeaderStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...Typography.headline,
    flex: 1,
  },
});

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface PricingSuggestion {
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
  reasoning: string;
}

const SERVICE_OPTIONS = [
  "General Repair",
  "Installation",
  "Maintenance",
  "Inspection",
  "Emergency Service",
  "Consultation",
  "Custom Service",
];

export default function AddJobScreen() {
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

  const clients = clientsData?.clients || [];

  const [selectedClientId, setSelectedClientId] = useState<string | null>(preselectedClientId || null);
  const [serviceName, setServiceName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showPricingAssistant, setShowPricingAssistant] = useState(false);
  const [pricingSuggestion, setPricingSuggestion] = useState<PricingSuggestion | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const search = clientSearch.toLowerCase();
    return clients.filter(
      (c) =>
        c.firstName.toLowerCase().includes(search) ||
        c.lastName.toLowerCase().includes(search) ||
        c.email?.toLowerCase().includes(search) ||
        c.phone?.includes(search)
    );
  }, [clients, clientSearch]);

  const createJobMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/jobs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "stats"] });
      navigation.goBack();
    },
    onError: (error) => {
      console.error("Create job error:", error);
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/clients", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "clients"] });
      if (data.client?.id) {
        setSelectedClientId(data.client.id);
      }
      setShowNewClientForm(false);
      setNewClientFirstName("");
      setNewClientLastName("");
      setNewClientPhone("");
      setNewClientEmail("");
    },
    onError: (error) => {
      console.error("Create client error:", error);
    },
  });

  const handleSave = () => {
    if (!selectedClientId || !serviceName.trim() || !providerId) return;
    createJobMutation.mutate({
      providerId,
      clientId: selectedClientId,
      title: serviceName,
      description: description.trim() || undefined,
      scheduledDate: scheduledDate.toISOString(),
      scheduledTime,
      estimatedPrice: estimatedPrice.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const handleCreateClient = () => {
    if (!newClientFirstName.trim() || !newClientLastName.trim() || !providerId) return;
    createClientMutation.mutate({
      providerId,
      firstName: newClientFirstName.trim(),
      lastName: newClientLastName.trim(),
      phone: newClientPhone.trim() || undefined,
      email: newClientEmail.trim() || undefined,
    });
  };

  const handleGetPricingSuggestion = async () => {
    if (!serviceName.trim()) return;
    setPricingLoading(true);
    try {
      const response = await apiRequest("POST", "/api/ai/pricing-assistant", {
        providerId,
        serviceName,
        description,
        clientId: selectedClientId,
      });
      const data = await response.json();
      if (data.suggestion) {
        setPricingSuggestion(data.suggestion);
        setShowPricingAssistant(true);
      }
    } catch (error) {
      console.error("Pricing assistant error:", error);
    } finally {
      setPricingLoading(false);
    }
  };

  const applyPricingSuggestion = () => {
    if (pricingSuggestion) {
      setEstimatedPrice(pricingSuggestion.suggestedPrice.toString());
      setShowPricingAssistant(false);
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const canSave = selectedClientId && serviceName.trim() && !createJobMutation.isPending;

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
          <SectionHeader icon="users" title="Client" />
          <Pressable
            style={[styles.selectorRow, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => setShowClientPicker(true)}
            testID="selector-client"
          >
            {selectedClient ? (
              <>
                <View style={[styles.clientAvatar, { backgroundColor: Colors.accent }]}>
                  <ThemedText style={styles.avatarText}>
                    {selectedClient.firstName[0]}{selectedClient.lastName[0]}
                  </ThemedText>
                </View>
                <View style={styles.selectorBody}>
                  <ThemedText style={styles.selectorValue}>
                    {selectedClient.firstName} {selectedClient.lastName}
                  </ThemedText>
                  {selectedClient.address ? (
                    <ThemedText style={[styles.selectorSub, { color: theme.textTertiary }]}>
                      {selectedClient.address}
                    </ThemedText>
                  ) : null}
                </View>
              </>
            ) : (
              <>
                <View style={[styles.clientAvatar, { backgroundColor: theme.backgroundTertiary }]}>
                  <Feather name="user" size={16} color={theme.textTertiary} />
                </View>
                <ThemedText style={[styles.selectorPlaceholder, { color: theme.textTertiary }]}>
                  Select a client
                </ThemedText>
              </>
            )}
            <Feather name="chevron-down" size={18} color={Colors.accent} />
          </Pressable>
        </GlassCard>

        {/* Service */}
        <GlassCard style={styles.section}>
          <SectionHeader icon="tool" title="Service" />
          <Pressable
            style={[styles.selectorRow, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => setShowServicePicker(true)}
            testID="selector-service"
          >
            <View style={[styles.serviceIconWrap, { backgroundColor: Colors.accentLight }]}>
              <Feather name="tool" size={14} color={Colors.accent} />
            </View>
            <ThemedText
              style={[
                styles.selectorBody,
                serviceName
                  ? styles.selectorValue
                  : [styles.selectorPlaceholder, { color: theme.textTertiary }],
              ]}
            >
              {serviceName || "Select a service"}
            </ThemedText>
            <Feather name="chevron-down" size={18} color={Colors.accent} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.separator }]} />

          <TextField
            value={description}
            onChangeText={setDescription}
            placeholder="Brief job description (optional)"
            multiline
            numberOfLines={3}
            leftIcon="align-left"
          />
        </GlassCard>

        {/* Schedule */}
        <GlassCard style={styles.section}>
          <SectionHeader icon="calendar" title="Schedule" />
          <View style={styles.pillRow}>
            <Pressable
              style={[styles.pill, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => setShowDatePicker(true)}
              testID="picker-date"
            >
              <Feather name="calendar" size={15} color={Colors.accent} />
              <ThemedText style={styles.pillText}>{formatDate(scheduledDate)}</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.pill, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => setShowTimePicker(true)}
              testID="picker-time"
            >
              <Feather name="clock" size={15} color={Colors.accent} />
              <ThemedText style={styles.pillText}>{formatTime(scheduledTime)}</ThemedText>
            </Pressable>
          </View>
        </GlassCard>

        {/* Pricing */}
        <GlassCard style={styles.section}>
          <SectionHeader icon="dollar-sign" title="Pricing">
            <Pressable
              style={[styles.aiChip, (pricingLoading || !serviceName.trim()) && styles.aiChipDisabled]}
              onPress={handleGetPricingSuggestion}
              disabled={pricingLoading || !serviceName.trim()}
              testID="button-ai-suggest"
            >
              {pricingLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="zap" size={12} color="#FFFFFF" />
                  <ThemedText style={styles.aiChipText}>AI Suggest</ThemedText>
                </>
              )}
            </Pressable>
          </SectionHeader>
          <TextField
            value={estimatedPrice}
            onChangeText={setEstimatedPrice}
            placeholder="0.00"
            keyboardType="decimal-pad"
            leftIcon="dollar-sign"
            testID="input-price"
          />
        </GlassCard>

        {/* Notes */}
        <GlassCard style={styles.section}>
          <SectionHeader icon="file-text" title="Notes" iconBg={undefined} />
          <TextField
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes"
            multiline
            numberOfLines={3}
          />
        </GlassCard>

        <View style={styles.buttonRow}>
          <SecondaryButton
            onPress={() => navigation.goBack()}
            style={styles.btnFlex}
          >
            Cancel
          </SecondaryButton>
          <PrimaryButton
            onPress={handleSave}
            disabled={!canSave}
            loading={createJobMutation.isPending}
            style={styles.btnFlex}
            testID="button-schedule-job"
          >
            Schedule Job
          </PrimaryButton>
        </View>
      </KeyboardAwareScrollViewCompat>

      {showDatePicker ? (
        <DateTimePicker
          value={scheduledDate}
          mode="date"
          display="spinner"
          minimumDate={new Date()}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(false);
            if (date) setScheduledDate(date);
          }}
        />
      ) : null}

      {showTimePicker ? (
        <DateTimePicker
          value={new Date(`2000-01-01T${scheduledTime}`)}
          mode="time"
          display="spinner"
          minuteInterval={15}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowTimePicker(false);
            if (date) {
              const hours = date.getHours().toString().padStart(2, "0");
              const mins = date.getMinutes().toString().padStart(2, "0");
              setScheduledTime(`${hours}:${mins}`);
            }
          }}
        />
      ) : null}

      {/* Service Picker Modal */}
      <Modal
        visible={showServicePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowServicePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowServicePicker(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Service</ThemedText>
              <Pressable onPress={() => setShowServicePicker(false)} hitSlop={8}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {SERVICE_OPTIONS.map((service) => (
                <Pressable
                  key={service}
                  style={[
                    styles.modalItem,
                    serviceName === service && { backgroundColor: Colors.accentLight },
                  ]}
                  onPress={() => { setServiceName(service); setShowServicePicker(false); }}
                >
                  <ThemedText style={serviceName === service ? { color: Colors.accent, fontWeight: "600" } : {}}>
                    {service}
                  </ThemedText>
                  {serviceName === service ? (
                    <Feather name="check" size={18} color={Colors.accent} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
            <View style={[styles.customRow, { borderTopColor: theme.separator }]}>
              <TextField
                placeholder="Or type a custom service"
                value={serviceName}
                onChangeText={setServiceName}
                style={{ flex: 1 }}
                leftIcon="edit-2"
              />
              <PrimaryButton onPress={() => setShowServicePicker(false)} style={{ marginLeft: Spacing.sm }}>
                Done
              </PrimaryButton>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Client Picker Modal */}
      <Modal
        visible={showClientPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowClientPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowClientPicker(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Client</ThemedText>
              <Pressable onPress={() => setShowClientPicker(false)} hitSlop={8}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            <View style={[styles.searchBar, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="search" size={16} color={theme.textTertiary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search clients..."
                placeholderTextColor={theme.textTertiary}
                value={clientSearch}
                onChangeText={setClientSearch}
              />
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              <Pressable
                style={[styles.modalItem, styles.addNewItem]}
                onPress={() => { setShowClientPicker(false); setShowNewClientForm(true); }}
              >
                <View style={[styles.addIcon, { backgroundColor: Colors.accent }]}>
                  <Feather name="plus" size={16} color="#FFFFFF" />
                </View>
                <ThemedText style={{ color: Colors.accent, fontWeight: "600" }}>Add New Client</ThemedText>
              </Pressable>

              {filteredClients.map((client) => (
                <Pressable
                  key={client.id}
                  style={[
                    styles.modalItem,
                    selectedClientId === client.id && { backgroundColor: Colors.accentLight },
                  ]}
                  onPress={() => { setSelectedClientId(client.id); setShowClientPicker(false); }}
                >
                  <View style={[styles.clientAvatar, { backgroundColor: Colors.accent }]}>
                    <ThemedText style={styles.avatarText}>
                      {client.firstName[0]}{client.lastName[0]}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={selectedClientId === client.id ? { color: Colors.accent, fontWeight: "600" } : {}}>
                      {client.firstName} {client.lastName}
                    </ThemedText>
                    {client.phone ? (
                      <ThemedText style={[styles.selectorSub, { color: theme.textTertiary }]}>
                        {client.phone}
                      </ThemedText>
                    ) : null}
                  </View>
                  {selectedClientId === client.id ? (
                    <Feather name="check" size={18} color={Colors.accent} />
                  ) : null}
                </Pressable>
              ))}

              {filteredClients.length === 0 ? (
                <View style={styles.emptyModal}>
                  <ThemedText style={{ color: theme.textSecondary }}>No clients found</ThemedText>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* New Client Quick-Form Modal */}
      <Modal
        visible={showNewClientForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewClientForm(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowNewClientForm(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>New Client</ThemedText>
              <Pressable onPress={() => setShowNewClientForm(false)} hitSlop={8}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.formFields}>
              <TextField label="First Name" value={newClientFirstName} onChangeText={setNewClientFirstName} placeholder="John" leftIcon="user" />
              <TextField label="Last Name" value={newClientLastName} onChangeText={setNewClientLastName} placeholder="Smith" leftIcon="user" style={{ marginTop: Spacing.md }} />
              <TextField label="Phone (optional)" value={newClientPhone} onChangeText={setNewClientPhone} placeholder="(555) 123-4567" keyboardType="phone-pad" leftIcon="phone" style={{ marginTop: Spacing.md }} />
              <TextField label="Email (optional)" value={newClientEmail} onChangeText={setNewClientEmail} placeholder="john@example.com" keyboardType="email-address" autoCapitalize="none" leftIcon="mail" style={{ marginTop: Spacing.md }} />
            </View>
            <View style={styles.buttonRow}>
              <SecondaryButton onPress={() => setShowNewClientForm(false)} style={styles.btnFlex}>Cancel</SecondaryButton>
              <PrimaryButton
                onPress={handleCreateClient}
                disabled={!newClientFirstName.trim() || !newClientLastName.trim()}
                loading={createClientMutation.isPending}
                style={styles.btnFlex}
              >
                Add Client
              </PrimaryButton>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* AI Pricing Modal */}
      <Modal
        visible={showPricingAssistant}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPricingAssistant(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPricingAssistant(false)}>
          <View style={[styles.pricingCard, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.aiHeader}>
              <View style={[styles.aiIconWrap, { backgroundColor: Colors.accentLight }]}>
                <Feather name="zap" size={18} color={Colors.accent} />
              </View>
              <ThemedText style={styles.modalTitle}>AI Price Suggestion</ThemedText>
            </View>

            {pricingSuggestion ? (
              <>
                <View style={[styles.priceHighlight, { backgroundColor: Colors.accentLight }]}>
                  <ThemedText style={[styles.priceAmount, { color: Colors.accent }]}>
                    ${pricingSuggestion.suggestedPrice}
                  </ThemedText>
                  <ThemedText style={[styles.priceRange, { color: Colors.accent }]}>
                    Range: ${pricingSuggestion.minPrice} – ${pricingSuggestion.maxPrice}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.priceReasoning, { color: theme.textSecondary }]}>
                  {pricingSuggestion.reasoning}
                </ThemedText>
                <View style={styles.buttonRow}>
                  <SecondaryButton onPress={() => setShowPricingAssistant(false)} style={styles.btnFlex}>Dismiss</SecondaryButton>
                  <PrimaryButton onPress={applyPricingSuggestion} style={styles.btnFlex}>Apply Price</PrimaryButton>
                </View>
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { marginBottom: Spacing.lg },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xs },
  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
    minHeight: 48,
  },
  selectorBody: { flex: 1 },
  selectorValue: { ...Typography.body, fontWeight: "500" },
  selectorPlaceholder: { ...Typography.body },
  selectorSub: { ...Typography.caption1, marginTop: 2 },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...Typography.caption1, fontWeight: "700", color: "#FFFFFF" },
  serviceIconWrap: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  pillRow: { flexDirection: "row", gap: Spacing.md },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pillText: { ...Typography.subhead, fontWeight: "500" },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  aiChipDisabled: { opacity: 0.5 },
  aiChipText: { ...Typography.caption1, fontWeight: "700", color: "#FFFFFF" },
  buttonRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md },
  btnFlex: { flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.xl,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignSelf: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  modalTitle: { ...Typography.title3, fontWeight: "600" },
  modalList: { maxHeight: 320 },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.sm,
    marginVertical: 2,
  },
  addNewItem: {},
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchInput: { flex: 1, ...Typography.body },
  emptyModal: { alignItems: "center", paddingVertical: Spacing.xl },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  formFields: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  pricingCard: {
    margin: Spacing.xl,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  aiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  priceHighlight: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  priceAmount: { ...Typography.largeTitle, fontWeight: "800" },
  priceRange: { ...Typography.subhead, marginTop: 4 },
  priceReasoning: { ...Typography.body, lineHeight: 22, marginBottom: Spacing.lg },
});
