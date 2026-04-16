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
import { NativeDatePickerSheet } from "@/components/NativeDatePickerSheet";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { GlassCard } from "@/components/GlassCard";
import { FormSectionHeader } from "@/components/FormSectionHeader";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, Typography, Colors, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest, getApiUrl, getAuthHeaders } from "@/lib/query-client";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface ServiceAddOn {
  name: string;
  price: number;
  description?: string;
}

interface CustomService {
  id: string;
  name: string;
  description: string | null;
  pricingType: string;
  basePrice: string | null;
  priceFrom: string | null;
  priceTo: string | null;
  duration: number | null;
  addOnsJson: string | null;
  intakeQuestionsJson: string | null;
  category: string;
}

interface PricingSuggestion {
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
  reasoning: string;
}

function getPriceDisplay(svc: CustomService): string {
  const p = svc.pricingType;
  if ((p === "fixed" || p === "service_call") && svc.basePrice) {
    return `$${parseFloat(svc.basePrice).toFixed(0)}`;
  }
  if (p === "variable") {
    if (svc.priceFrom && svc.priceTo) return `$${parseFloat(svc.priceFrom).toFixed(0)}–$${parseFloat(svc.priceTo).toFixed(0)}`;
    if (svc.priceFrom) return `From $${parseFloat(svc.priceFrom).toFixed(0)}`;
  }
  return "Quote";
}

function getDurationLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

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

  const { data: servicesData, isLoading: servicesLoading } = useQuery<{ services: CustomService[] }>({
    queryKey: ["/api/provider", providerId, "custom-services", "published"],
    queryFn: async () => {
      const url = new URL(`/api/provider/${providerId}/custom-services?publishedOnly=true`, getApiUrl());
      const res = await fetch(url.toString(), {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!providerId,
  });

  const providerServices = servicesData?.services || [];
  const clients = clientsData?.clients || [];

  const [selectedClientId, setSelectedClientId] = useState<string | null>(preselectedClientId || null);
  const [selectedService, setSelectedService] = useState<CustomService | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [baseServicePriceNum, setBaseServicePriceNum] = useState(0);
  const [selectedAddOns, setSelectedAddOns] = useState<ServiceAddOn[]>([]);
  const [serviceDescription, setServiceDescription] = useState<string>("");
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

  const availableAddOns = useMemo<ServiceAddOn[]>(() => {
    if (!selectedService?.addOnsJson) return [];
    try { return JSON.parse(selectedService.addOnsJson); } catch { return []; }
  }, [selectedService]);

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

  const handleSelectService = (svc: CustomService) => {
    setSelectedService(svc);
    setServiceName(svc.name);
    setServiceDescription(svc.description || "");
    setSelectedAddOns([]);

    let priceNum = 0;
    if (svc.pricingType === "fixed" || svc.pricingType === "service_call") {
      priceNum = parseFloat(svc.basePrice || "0") || 0;
    } else if (svc.pricingType === "variable") {
      priceNum = parseFloat(svc.priceFrom || "0") || 0;
    }
    setBaseServicePriceNum(priceNum);
    setEstimatedPrice(priceNum > 0 ? priceNum.toFixed(2) : "");
    setShowServicePicker(false);
  };

  const handleToggleAddOn = (addon: ServiceAddOn) => {
    setSelectedAddOns((prev) => {
      const isSelected = prev.some((a) => a.name === addon.name);
      const next = isSelected
        ? prev.filter((a) => a.name !== addon.name)
        : [...prev, addon];
      const addonsTotal = next.reduce((sum, a) => sum + (a.price || 0), 0);
      const total = baseServicePriceNum + addonsTotal;
      setEstimatedPrice(total > 0 ? total.toFixed(2) : "");
      return next;
    });
  };

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
      customServiceId: selectedService?.id || undefined,
      title: serviceName,
      description: description.trim() || undefined,
      scheduledDate: scheduledDate.toISOString(),
      scheduledTime,
      estimatedDuration: selectedService?.duration || undefined,
      estimatedPrice: estimatedPrice.trim() || undefined,
      notes: notes.trim() || undefined,
      pricingType: selectedService?.pricingType || undefined,
      serviceDescription: serviceDescription || undefined,
      selectedAddOns: selectedAddOns.length > 0 ? selectedAddOns : undefined,
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

  const canSave = !!selectedClientId && !!serviceName.trim() && !createJobMutation.isPending;

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
          <FormSectionHeader icon="tool" title="Service" />

          {/* Service selector trigger */}
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

          {/* Selected service preview card */}
          {selectedService ? (
            <View style={[styles.servicePreview, { borderColor: Colors.accent, backgroundColor: Colors.accentLight }]}>
              <View style={styles.servicePreviewRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.servicePreviewName, { color: Colors.accent }]}>
                    {selectedService.name}
                  </ThemedText>
                  {selectedService.description ? (
                    <ThemedText
                      style={[styles.servicePreviewDesc, { color: theme.textSecondary }]}
                      numberOfLines={2}
                    >
                      {selectedService.description}
                    </ThemedText>
                  ) : null}
                  <View style={styles.serviceTagRow}>
                    <View style={[styles.serviceTag, { backgroundColor: Colors.accent + "22" }]}>
                      <ThemedText style={[styles.serviceTagText, { color: Colors.accent }]}>
                        {selectedService.category}
                      </ThemedText>
                    </View>
                    <View style={[styles.serviceTag, { backgroundColor: Colors.accent + "22" }]}>
                      <ThemedText style={[styles.serviceTagText, { color: Colors.accent }]}>
                        {selectedService.pricingType === "fixed" ? "Flat Rate"
                          : selectedService.pricingType === "variable" ? "Variable"
                          : selectedService.pricingType === "service_call" ? "Service Call"
                          : "By Quote"}
                      </ThemedText>
                    </View>
                  </View>
                </View>
                <View style={[styles.priceBadge, { backgroundColor: Colors.accent }]}>
                  <ThemedText style={styles.priceBadgeText}>
                    {getPriceDisplay(selectedService)}
                  </ThemedText>
                </View>
              </View>
              {selectedService.duration ? (
                <View style={styles.durationRow}>
                  <Feather name="clock" size={11} color={Colors.accent} />
                  <ThemedText style={[styles.durationText, { color: Colors.accent }]}>
                    {getDurationLabel(selectedService.duration)} est.
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Add-ons panel */}
          {availableAddOns.length > 0 ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.separator }]} />
              <ThemedText style={[styles.addOnsLabel, { color: theme.textSecondary }]}>Add-ons</ThemedText>
              {availableAddOns.map((addon) => {
                const isSelected = selectedAddOns.some((a) => a.name === addon.name);
                return (
                  <Pressable
                    key={addon.name}
                    style={[
                      styles.addonRow,
                      { borderColor: theme.separator },
                      isSelected && { backgroundColor: Colors.accentLight },
                    ]}
                    onPress={() => handleToggleAddOn(addon)}
                    testID={`addon-${addon.name.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <View style={[styles.addonCheck, { borderColor: isSelected ? Colors.accent : theme.textTertiary }, isSelected && { backgroundColor: Colors.accent }]}>
                      {isSelected ? <Feather name="check" size={11} color="#FFFFFF" /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.addonName, isSelected && { color: Colors.accent }]}>
                        {addon.name}
                      </ThemedText>
                      {addon.description ? (
                        <ThemedText style={[styles.addonDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                          {addon.description}
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText style={[styles.addonPrice, { color: Colors.accent }]}>
                      +${addon.price.toFixed(0)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </>
          ) : null}

          <View style={[styles.divider, { backgroundColor: theme.separator }]} />

          <View style={styles.fieldLabelRow}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Client's Issue
            </ThemedText>
            <View style={[styles.emailBadge, { backgroundColor: Colors.accentLight }]}>
              <Feather name="mail" size={10} color={Colors.accent} />
              <ThemedText style={[styles.emailBadgeText, { color: Colors.accent }]}>
                In client email
              </ThemedText>
            </View>
          </View>
          <TextField
            value={description}
            onChangeText={setDescription}
            placeholder="What did the client describe? (e.g. AC not cooling, leaking faucet)"
            multiline
            numberOfLines={3}
            leftIcon="align-left"
          />
        </GlassCard>

        {/* Schedule */}
        <GlassCard style={styles.section}>
          <FormSectionHeader icon="calendar" title="Schedule" />
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
          <FormSectionHeader icon="dollar-sign" title="Pricing">
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
          </FormSectionHeader>

          <TextField
            value={estimatedPrice}
            onChangeText={(val) => {
              setEstimatedPrice(val);
            }}
            placeholder="0.00"
            keyboardType="decimal-pad"
            leftIcon="dollar-sign"
            testID="input-price"
          />

          {selectedAddOns.length > 0 ? (
            <View style={[styles.addOnsTotal, { borderTopColor: theme.separator }]}>
              {selectedAddOns.map((a) => (
                <View key={a.name} style={styles.addOnsTotalRow}>
                  <ThemedText style={[styles.addOnsTotalLabel, { color: theme.textSecondary }]}>
                    + {a.name}
                  </ThemedText>
                  <ThemedText style={[styles.addOnsTotalPrice, { color: Colors.accent }]}>
                    ${a.price.toFixed(0)}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </GlassCard>

        {/* Notes */}
        <GlassCard style={styles.section}>
          <FormSectionHeader icon="file-text" title="Notes" iconBg={undefined} />
          <TextField
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes"
            multiline
            numberOfLines={3}
          />
        </GlassCard>

        {createJobMutation.isError ? (
          <View style={[styles.errorBanner, { backgroundColor: "#fef2f2" }]}>
            <Feather name="alert-circle" size={14} color="#ef4444" />
            <ThemedText style={styles.errorText}>Failed to create job. Please try again.</ThemedText>
          </View>
        ) : null}

        <View style={styles.buttonRow}>
          <SecondaryButton onPress={() => navigation.goBack()} style={styles.btnFlex}>
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

      <NativeDatePickerSheet
        visible={showDatePicker}
        value={scheduledDate}
        mode="date"
        minimumDate={new Date()}
        title="Select Date"
        onConfirm={(date) => {
          setScheduledDate(date);
          setShowDatePicker(false);
        }}
        onCancel={() => setShowDatePicker(false)}
      />

      <NativeDatePickerSheet
        visible={showTimePicker}
        value={new Date(`2000-01-01T${scheduledTime}`)}
        mode="time"
        minuteInterval={15}
        title="Select Time"
        onConfirm={(date) => {
          const hours = date.getHours().toString().padStart(2, "0");
          const mins = date.getMinutes().toString().padStart(2, "0");
          setScheduledTime(`${hours}:${mins}`);
          setShowTimePicker(false);
        }}
        onCancel={() => setShowTimePicker(false)}
      />

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
              {servicesLoading ? (
                <View style={styles.modalEmptyState}>
                  <ActivityIndicator color={Colors.accent} />
                  <ThemedText style={[styles.modalEmptyText, { color: theme.textSecondary }]}>
                    Loading services...
                  </ThemedText>
                </View>
              ) : providerServices.length > 0 ? (
                providerServices.map((svc) => {
                  const isActive = selectedService?.id === svc.id;
                  return (
                    <Pressable
                      key={svc.id}
                      style={[styles.modalItem, isActive && { backgroundColor: Colors.accentLight }]}
                      onPress={() => handleSelectService(svc)}
                    >
                      <View style={{ flex: 1 }}>
                        <ThemedText style={isActive ? { color: Colors.accent, fontWeight: "600" } : {}}>
                          {svc.name}
                        </ThemedText>
                        {svc.description ? (
                          <ThemedText
                            style={[styles.modalItemDesc, { color: theme.textTertiary }]}
                            numberOfLines={1}
                          >
                            {svc.description}
                          </ThemedText>
                        ) : null}
                        <View style={styles.modalItemMeta}>
                          <ThemedText style={[styles.modalItemPrice, { color: Colors.accent }]}>
                            {getPriceDisplay(svc)}
                          </ThemedText>
                          {svc.duration ? (
                            <ThemedText style={[styles.modalItemDuration, { color: theme.textTertiary }]}>
                              · {getDurationLabel(svc.duration)}
                            </ThemedText>
                          ) : null}
                        </View>
                      </View>
                      {isActive ? (
                        <Feather name="check" size={18} color={Colors.accent} />
                      ) : (
                        <Feather name="chevron-right" size={16} color={theme.textTertiary} />
                      )}
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.modalEmptyState}>
                  <View style={[styles.emptyIconWrap, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="briefcase" size={28} color={Colors.accent} />
                  </View>
                  <ThemedText style={[styles.modalEmptyTitle, { color: theme.text }]}>
                    No services yet
                  </ThemedText>
                  <ThemedText style={[styles.modalEmptyText, { color: theme.textSecondary }]}>
                    Create your service catalog to book jobs faster and include pricing details in client emails.
                  </ThemedText>
                  <Pressable
                    style={[styles.goToServicesBtn, { backgroundColor: Colors.accent }]}
                    onPress={() => {
                      setShowServicePicker(false);
                      (navigation as any).navigate("Services");
                    }}
                  >
                    <Feather name="plus" size={15} color="#FFFFFF" />
                    <ThemedText style={styles.goToServicesBtnText}>Create a Service</ThemedText>
                  </Pressable>
                </View>
              )}
            </ScrollView>
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

      {/* New Client Form Modal */}
      <Modal
        visible={showNewClientForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewClientForm(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowNewClientForm(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>New Client</ThemedText>
              <Pressable onPress={() => setShowNewClientForm(false)} hitSlop={8}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              <View style={styles.newClientForm}>
                <TextField
                  label="First Name"
                  value={newClientFirstName}
                  onChangeText={setNewClientFirstName}
                  placeholder="John"
                  leftIcon="user"
                />
                <TextField
                  label="Last Name"
                  value={newClientLastName}
                  onChangeText={setNewClientLastName}
                  placeholder="Smith"
                  leftIcon="user"
                />
                <TextField
                  label="Phone"
                  value={newClientPhone}
                  onChangeText={setNewClientPhone}
                  placeholder="(555) 000-0000"
                  keyboardType="phone-pad"
                  leftIcon="phone"
                />
                <TextField
                  label="Email"
                  value={newClientEmail}
                  onChangeText={setNewClientEmail}
                  placeholder="john@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon="mail"
                />
                <PrimaryButton
                  onPress={handleCreateClient}
                  loading={createClientMutation.isPending}
                  disabled={!newClientFirstName.trim() || !newClientLastName.trim() || createClientMutation.isPending}
                  testID="button-create-client"
                >
                  Add Client
                </PrimaryButton>
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Pricing Assistant Modal */}
      <Modal
        visible={showPricingAssistant}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPricingAssistant(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPricingAssistant(false)}>
          <View style={[styles.pricingModal, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>AI Price Suggestion</ThemedText>
              <Pressable onPress={() => setShowPricingAssistant(false)} hitSlop={8}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            {pricingSuggestion ? (
              <>
                <View style={[styles.pricingMainRow, { backgroundColor: Colors.accentLight }]}>
                  <ThemedText style={[styles.pricingMainLabel, { color: Colors.accent }]}>Suggested Price</ThemedText>
                  <ThemedText style={[styles.pricingMainValue, { color: Colors.accent }]}>
                    ${pricingSuggestion.suggestedPrice.toFixed(0)}
                  </ThemedText>
                </View>
                <View style={styles.pricingRangeRow}>
                  <ThemedText style={[styles.pricingRangeText, { color: theme.textSecondary }]}>
                    Range: ${pricingSuggestion.minPrice.toFixed(0)} – ${pricingSuggestion.maxPrice.toFixed(0)}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.pricingReasoning, { color: theme.textSecondary }]}>
                  {pricingSuggestion.reasoning}
                </ThemedText>
                <PrimaryButton onPress={applyPricingSuggestion} testID="button-apply-price">
                  Use This Price
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
  container: { flex: 1 },
  section: { marginBottom: Spacing.md },

  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 52,
    gap: Spacing.sm,
  },
  selectorBody: { flex: 1 },
  selectorValue: { ...Typography.body, fontWeight: "500" },
  selectorPlaceholder: { ...Typography.body },
  selectorSub: { ...Typography.caption, marginTop: 2 },

  clientAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },

  serviceIconWrap: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },

  servicePreview: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  servicePreviewRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  servicePreviewName: { ...Typography.bodyMedium, fontWeight: "600" },
  servicePreviewDesc: { ...Typography.caption, marginTop: 3, lineHeight: 17 },
  priceBadge: { borderRadius: BorderRadius.sm, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  priceBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  durationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  durationText: { fontSize: 11, fontWeight: "500" },

  serviceTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 5 },
  serviceTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  serviceTagText: { fontSize: 10, fontWeight: "600" },

  divider: { height: 1, marginVertical: Spacing.md },

  addOnsLabel: { ...Typography.caption, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: Spacing.sm },
  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: 4,
    borderWidth: 0,
  },
  addonCheck: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  addonName: { ...Typography.body, fontWeight: "500" },
  addonDesc: { ...Typography.caption, marginTop: 1 },
  addonPrice: { fontSize: 13, fontWeight: "600" },

  addOnsTotal: { borderTopWidth: 1, marginTop: Spacing.sm, paddingTop: Spacing.sm },
  addOnsTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  addOnsTotalLabel: { ...Typography.caption },
  addOnsTotalPrice: { ...Typography.caption, fontWeight: "600" },

  fieldLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs },
  fieldLabel: { ...Typography.caption, fontWeight: "600", flex: 1 },
  emailBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  emailBadgeText: { fontSize: 10, fontWeight: "600" },

  pillRow: { flexDirection: "row", gap: Spacing.sm },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  pillText: { ...Typography.body, fontWeight: "500" },

  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  aiChipDisabled: { opacity: 0.4 },
  aiChipText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorText: { color: "#ef4444", fontSize: 13 },

  buttonRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  btnFlex: { flex: 1 },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(150,150,150,0.4)",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  modalTitle: { ...Typography.h3, fontWeight: "700" },
  modalList: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: 2,
    gap: Spacing.sm,
  },
  modalItemDesc: { ...Typography.caption, marginTop: 2 },
  modalItemMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  modalItemPrice: { fontSize: 12, fontWeight: "600" },
  modalItemDuration: { fontSize: 12 },

  modalEmptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  modalEmptyTitle: { ...Typography.h3, fontWeight: "700", textAlign: "center" },
  modalEmptyText: { ...Typography.body, textAlign: "center", lineHeight: 22 },
  goToServicesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  goToServicesBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },

  addNewItem: { gap: Spacing.sm },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 15 },
  emptyModal: { paddingVertical: Spacing.xl, alignItems: "center" },

  newClientForm: { gap: Spacing.sm, padding: Spacing.sm },

  pricingModal: {
    margin: Spacing.lg,
    borderRadius: 20,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  pricingMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  pricingMainLabel: { ...Typography.body, fontWeight: "600" },
  pricingMainValue: { fontSize: 28, fontWeight: "800" },
  pricingRangeRow: { alignItems: "center" },
  pricingRangeText: { ...Typography.caption },
  pricingReasoning: { ...Typography.caption, lineHeight: 18 },
});
