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
import { apiRequest, getApiUrl } from "@/lib/query-client";

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
  const { theme, isDark } = useTheme();

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
    if (!selectedClientId || !serviceName.trim() || !providerId) {
      return;
    }

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
    if (!newClientFirstName.trim() || !newClientLastName.trim() || !providerId) {
      return;
    }

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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

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
        <GlassCard style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Client</ThemedText>
          
          <Pressable
            style={[styles.selector, { borderColor: theme.border }]}
            onPress={() => setShowClientPicker(true)}
          >
            {selectedClient ? (
              <View style={styles.selectedClient}>
                <View style={[styles.clientAvatar, { backgroundColor: Colors.accent }]}>
                  <ThemedText style={styles.avatarText}>
                    {selectedClient.firstName[0]}{selectedClient.lastName[0]}
                  </ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.clientName}>
                    {selectedClient.firstName} {selectedClient.lastName}
                  </ThemedText>
                  {selectedClient.address ? (
                    <ThemedText style={[styles.clientDetail, { color: theme.textSecondary }]}>
                      {selectedClient.address}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ) : (
              <ThemedText style={{ color: theme.textSecondary }}>
                Select a client
              </ThemedText>
            )}
            <Feather name="chevron-down" size={20} color={theme.textSecondary} />
          </Pressable>
        </GlassCard>

        <GlassCard style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Service</ThemedText>
          
          <Pressable
            style={[styles.selector, { borderColor: theme.border }]}
            onPress={() => setShowServicePicker(true)}
          >
            <ThemedText style={serviceName ? {} : { color: theme.textSecondary }}>
              {serviceName || "Select a service"}
            </ThemedText>
            <Feather name="chevron-down" size={20} color={theme.textSecondary} />
          </Pressable>

          <TextField
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Brief job description"
            multiline
            numberOfLines={3}
            style={{ marginTop: Spacing.md }}
          />
        </GlassCard>

        <GlassCard style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Schedule</ThemedText>
          
          <View style={styles.scheduleRow}>
            <Pressable
              style={[styles.scheduleButton, { borderColor: theme.border, flex: 1 }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Feather name="calendar" size={18} color={Colors.accent} />
              <ThemedText style={{ marginLeft: Spacing.sm }}>
                {formatDate(scheduledDate)}
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.scheduleButton, { borderColor: theme.border, flex: 1, marginLeft: Spacing.md }]}
              onPress={() => setShowTimePicker(true)}
            >
              <Feather name="clock" size={18} color={Colors.accent} />
              <ThemedText style={{ marginLeft: Spacing.sm }}>
                {formatTime(scheduledTime)}
              </ThemedText>
            </Pressable>
          </View>
        </GlassCard>

        <GlassCard style={styles.section}>
          <View style={styles.pricingHeader}>
            <ThemedText style={styles.sectionTitle}>Pricing</ThemedText>
            <Pressable
              style={[styles.aiButton, pricingLoading && { opacity: 0.6 }]}
              onPress={handleGetPricingSuggestion}
              disabled={pricingLoading || !serviceName.trim()}
            >
              {pricingLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="zap" size={14} color="#FFFFFF" />
                  <ThemedText style={styles.aiButtonText}>AI Suggest</ThemedText>
                </>
              )}
            </Pressable>
          </View>

          <TextField
            label="Estimated Price ($)"
            value={estimatedPrice}
            onChangeText={setEstimatedPrice}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
        </GlassCard>

        <GlassCard style={styles.section}>
          <TextField
            label="Notes (optional)"
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
            style={{ flex: 1 }}
          >
            Cancel
          </SecondaryButton>
          <PrimaryButton
            onPress={handleSave}
            disabled={!canSave}
            loading={createJobMutation.isPending}
            style={{ flex: 1, marginLeft: Spacing.md }}
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

      <Modal
        visible={showServicePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowServicePicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowServicePicker(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Service</ThemedText>
              <Pressable onPress={() => setShowServicePicker(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalList}>
              {SERVICE_OPTIONS.map((service) => (
                <Pressable
                  key={service}
                  style={[
                    styles.modalItem,
                    serviceName === service && { backgroundColor: Colors.accent + "20" },
                  ]}
                  onPress={() => {
                    setServiceName(service);
                    setShowServicePicker(false);
                  }}
                >
                  <ThemedText>{service}</ThemedText>
                  {serviceName === service ? (
                    <Feather name="check" size={20} color={Colors.accent} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.customServiceRow}>
              <TextField
                placeholder="Or enter custom service"
                value={serviceName}
                onChangeText={setServiceName}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                onPress={() => setShowServicePicker(false)}
                style={{ marginLeft: Spacing.sm }}
              >
                Done
              </PrimaryButton>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showClientPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowClientPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowClientPicker(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Client</ThemedText>
              <Pressable onPress={() => setShowClientPicker(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={[styles.searchBar, { backgroundColor: theme.backgroundRoot }]}>
              <Feather name="search" size={18} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search clients..."
                placeholderTextColor={theme.textSecondary}
                value={clientSearch}
                onChangeText={setClientSearch}
              />
            </View>

            <ScrollView style={styles.modalList}>
              <Pressable
                style={[styles.modalItem, styles.addNewItem]}
                onPress={() => {
                  setShowClientPicker(false);
                  setShowNewClientForm(true);
                }}
              >
                <View style={[styles.addIcon, { backgroundColor: Colors.accent }]}>
                  <Feather name="plus" size={16} color="#FFFFFF" />
                </View>
                <ThemedText style={{ color: Colors.accent }}>Add New Client</ThemedText>
              </Pressable>

              {filteredClients.map((client) => (
                <Pressable
                  key={client.id}
                  style={[
                    styles.modalItem,
                    selectedClientId === client.id && { backgroundColor: Colors.accent + "20" },
                  ]}
                  onPress={() => {
                    setSelectedClientId(client.id);
                    setShowClientPicker(false);
                  }}
                >
                  <View style={[styles.clientAvatar, { backgroundColor: Colors.accent }]}>
                    <ThemedText style={styles.avatarText}>
                      {client.firstName[0]}{client.lastName[0]}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText>{client.firstName} {client.lastName}</ThemedText>
                    {client.phone ? (
                      <ThemedText style={[styles.clientDetail, { color: theme.textSecondary }]}>
                        {client.phone}
                      </ThemedText>
                    ) : null}
                  </View>
                  {selectedClientId === client.id ? (
                    <Feather name="check" size={20} color={Colors.accent} />
                  ) : null}
                </Pressable>
              ))}

              {filteredClients.length === 0 ? (
                <View style={styles.emptyState}>
                  <ThemedText style={{ color: theme.textSecondary }}>
                    No clients found
                  </ThemedText>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showNewClientForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewClientForm(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowNewClientForm(false)}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>New Client</ThemedText>
              <Pressable onPress={() => setShowNewClientForm(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.formFields}>
              <TextField
                label="First Name"
                value={newClientFirstName}
                onChangeText={setNewClientFirstName}
                placeholder="John"
              />
              <TextField
                label="Last Name"
                value={newClientLastName}
                onChangeText={setNewClientLastName}
                placeholder="Smith"
                style={{ marginTop: Spacing.md }}
              />
              <TextField
                label="Phone (optional)"
                value={newClientPhone}
                onChangeText={setNewClientPhone}
                placeholder="(555) 123-4567"
                keyboardType="phone-pad"
                style={{ marginTop: Spacing.md }}
              />
              <TextField
                label="Email (optional)"
                value={newClientEmail}
                onChangeText={setNewClientEmail}
                placeholder="john@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ marginTop: Spacing.md }}
              />
            </View>

            <View style={styles.buttonRow}>
              <SecondaryButton
                onPress={() => setShowNewClientForm(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton
                onPress={handleCreateClient}
                disabled={!newClientFirstName.trim() || !newClientLastName.trim()}
                loading={createClientMutation.isPending}
                style={{ flex: 1, marginLeft: Spacing.md }}
              >
                Add Client
              </PrimaryButton>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showPricingAssistant}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPricingAssistant(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPricingAssistant(false)}
        >
          <View style={[styles.pricingModal, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHeader}>
              <View style={styles.aiHeader}>
                <Feather name="zap" size={20} color={Colors.accent} />
                <ThemedText style={[styles.modalTitle, { marginLeft: Spacing.sm }]}>
                  AI Pricing Suggestion
                </ThemedText>
              </View>
              <Pressable onPress={() => setShowPricingAssistant(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {pricingSuggestion ? (
              <>
                <View style={styles.priceDisplay}>
                  <ThemedText style={[styles.suggestedPrice, { color: Colors.accent }]}>
                    ${pricingSuggestion.suggestedPrice.toFixed(2)}
                  </ThemedText>
                  <ThemedText style={[styles.priceRange, { color: theme.textSecondary }]}>
                    Range: ${pricingSuggestion.minPrice} - ${pricingSuggestion.maxPrice}
                  </ThemedText>
                </View>

                <View style={[styles.reasoningBox, { backgroundColor: theme.backgroundRoot }]}>
                  <ThemedText style={{ color: theme.textSecondary, lineHeight: 20 }}>
                    {pricingSuggestion.reasoning}
                  </ThemedText>
                </View>

                <PrimaryButton onPress={applyPricingSuggestion} style={{ marginTop: Spacing.lg }}>
                  Apply This Price
                </PrimaryButton>
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  selectedClient: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  clientName: {
    ...Typography.body,
    fontWeight: "500",
  },
  clientDetail: {
    ...Typography.caption,
    marginTop: 2,
  },
  scheduleRow: {
    flexDirection: "row",
  },
  scheduleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  pricingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  aiButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: Spacing.xs,
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: Spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.title3,
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  addNewItem: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: "dashed",
    marginBottom: Spacing.md,
  },
  addIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  customServiceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  formFields: {
    marginBottom: Spacing.lg,
  },
  pricingModal: {
    margin: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceDisplay: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  suggestedPrice: {
    fontSize: 42,
    fontWeight: "700",
  },
  priceRange: {
    ...Typography.body,
    marginTop: Spacing.xs,
  },
  reasoningBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
