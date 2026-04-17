import React, { useState, useMemo, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  TextInput,
  Platform,
  LayoutAnimation,
  UIManager,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { NativeDatePickerSheet } from "@/components/NativeDatePickerSheet";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import {
  Spacing,
  Typography,
  Colors,
  BorderRadius,
} from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest, getApiUrl, getAuthHeaders } from "@/lib/query-client";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const animateTransition = () => {
  if (Platform.OS !== "web") {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }
};

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

interface IntakeQuestion {
  id: string;
  question: string;
  required?: boolean;
  type?: string;
  options?: string[];
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
    if (svc.priceFrom && svc.priceTo)
      return `$${parseFloat(svc.priceFrom).toFixed(0)}–$${parseFloat(svc.priceTo).toFixed(0)}`;
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

function getPricingTypeLabel(t: string): string {
  switch (t) {
    case "fixed":
      return "Flat Rate";
    case "variable":
      return "Variable";
    case "service_call":
      return "Service Call";
    default:
      return "By Quote";
  }
}

export default function AddJobScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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

  const {
    data: servicesData,
    isLoading: servicesLoading,
    isError: servicesError,
  } = useQuery<{ services: CustomService[] }>({
    queryKey: ["/api/provider", providerId, "custom-services", "published"],
    queryFn: async () => {
      const url = new URL(
        `/api/provider/${providerId}/custom-services?publishedOnly=true`,
        getApiUrl(),
      );
      const res = await fetch(url.toString(), {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!providerId,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing; cleanup tracked in Task #107
  const providerServices = servicesData?.services || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing; cleanup tracked in Task #107
  const clients = clientsData?.clients || [];

  // Form state
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    preselectedClientId || null,
  );
  const [selectedService, setSelectedService] = useState<CustomService | null>(
    null,
  );
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [baseServicePriceNum, setBaseServicePriceNum] = useState(0);
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<ServiceAddOn[]>([]);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({});

  // Picker sheets
  const [showClientSheet, setShowClientSheet] = useState(false);
  const [showServiceSheet, setShowServiceSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Client sheet-local state
  const [clientSearch, setClientSearch] = useState("");
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

  // Service sheet-local state
  const [serviceSearch, setServiceSearch] = useState("");

  // Pricing AI
  const [pricingSuggestion, setPricingSuggestion] =
    useState<PricingSuggestion | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const serviceIntakeQuestions = useMemo<IntakeQuestion[]>(() => {
    if (!selectedService?.intakeQuestionsJson) return [];
    try {
      const parsed = JSON.parse(selectedService.intakeQuestionsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [selectedService]);

  const availableAddOns = useMemo<ServiceAddOn[]>(() => {
    if (!selectedService?.addOnsJson) return [];
    try {
      const parsed = JSON.parse(selectedService.addOnsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [selectedService]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const search = clientSearch.toLowerCase();
    return clients.filter(
      (c) =>
        c.firstName.toLowerCase().includes(search) ||
        c.lastName.toLowerCase().includes(search) ||
        c.email?.toLowerCase().includes(search) ||
        c.phone?.includes(search),
    );
  }, [clients, clientSearch]);

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return providerServices;
    const s = serviceSearch.toLowerCase();
    return providerServices.filter(
      (svc) =>
        svc.name.toLowerCase().includes(s) ||
        svc.category.toLowerCase().includes(s) ||
        svc.description?.toLowerCase().includes(s),
    );
  }, [providerServices, serviceSearch]);

  const totalPriceNum = useMemo(() => {
    const parsed = parseFloat(estimatedPrice);
    return isNaN(parsed) ? 0 : parsed;
  }, [estimatedPrice]);

  // ==== Handlers ====

  const openClientSheet = () => {
    setClientSearch("");
    setShowNewClientForm(false);
    setShowClientSheet(true);
  };

  const closeClientSheet = () => {
    setShowClientSheet(false);
    setShowNewClientForm(false);
  };

  const openServiceSheet = () => {
    setServiceSearch("");
    setShowServiceSheet(true);
  };

  const handleSelectClient = (id: string) => {
    setSelectedClientId(id);
    closeClientSheet();
  };

  const handleSelectService = (svc: CustomService) => {
    setSelectedService(svc);
    setSelectedAddOns([]);
    setIntakeAnswers({});

    let priceNum = 0;
    if (svc.pricingType === "fixed" || svc.pricingType === "service_call") {
      priceNum = parseFloat(svc.basePrice || "0") || 0;
    } else if (svc.pricingType === "variable") {
      priceNum = parseFloat(svc.priceFrom || "0") || 0;
    }
    setBaseServicePriceNum(priceNum);
    setEstimatedPrice(priceNum > 0 ? priceNum.toFixed(2) : "");
    setPriceManuallyEdited(false);
    setPricingSuggestion(null);
    setShowServiceSheet(false);
  };

  const handleToggleAddOn = (addon: ServiceAddOn) => {
    setSelectedAddOns((prev) => {
      const isSelected = prev.some((a) => a.name === addon.name);
      const next = isSelected
        ? prev.filter((a) => a.name !== addon.name)
        : [...prev, addon];
      if (!priceManuallyEdited) {
        const addonsTotal = next.reduce(
          (sum, a) => sum + (Number(a.price) || 0),
          0,
        );
        const total = baseServicePriceNum + addonsTotal;
        setEstimatedPrice(total > 0 ? total.toFixed(2) : "");
      }
      return next;
    });
  };

  const createJobMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/jobs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "jobs"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "stats"],
      });
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
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "clients"],
      });
      if (data.client?.id) {
        setSelectedClientId(data.client.id);
      }
      setShowNewClientForm(false);
      setNewClientFirstName("");
      setNewClientLastName("");
      setNewClientPhone("");
      setNewClientEmail("");
      closeClientSheet();
    },
    onError: (error) => {
      console.error("Create client error:", error);
    },
  });

  const handleSave = () => {
    if (!selectedClientId || !selectedService || !providerId) return;
    const trimmedAnswers: Record<string, string> = {};
    Object.entries(intakeAnswers).forEach(([k, v]) => {
      const t = (v ?? "").trim();
      if (t.length > 0) trimmedAnswers[k] = t;
    });
    const answersJson =
      Object.keys(trimmedAnswers).length > 0
        ? JSON.stringify(trimmedAnswers)
        : undefined;
    createJobMutation.mutate({
      providerId,
      clientId: selectedClientId,
      customServiceId: selectedService.id,
      title: selectedService.name,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      scheduledDate: scheduledDate.toISOString(),
      scheduledTime,
      estimatedDuration: selectedService.duration || undefined,
      estimatedPrice: estimatedPrice.trim() || undefined,
      pricingType: selectedService.pricingType,
      serviceDescription: selectedService.description || undefined,
      selectedAddOns: selectedAddOns.length > 0 ? selectedAddOns : undefined,
      answersJson,
      intakeAnswers: answersJson ? trimmedAnswers : undefined,
    });
  };

  const handleCreateClient = () => {
    if (
      !newClientFirstName.trim() ||
      !newClientLastName.trim() ||
      !providerId
    )
      return;
    createClientMutation.mutate({
      providerId,
      firstName: newClientFirstName.trim(),
      lastName: newClientLastName.trim(),
      phone: newClientPhone.trim() || undefined,
      email: newClientEmail.trim() || undefined,
    });
  };

  const handleGetPricingSuggestion = async () => {
    if (!selectedService) return;
    setPricingLoading(true);
    try {
      const response = await apiRequest("POST", "/api/ai/pricing-assistant", {
        providerId,
        serviceName: selectedService.name,
        description,
        clientId: selectedClientId,
      });
      const data = await response.json();
      if (data.suggestion) {
        animateTransition();
        setPricingSuggestion(data.suggestion);
      }
    } catch (error) {
      console.error("Pricing assistant error:", error);
    } finally {
      setPricingLoading(false);
    }
  };

  const applyPricingSuggestion = useCallback(() => {
    if (pricingSuggestion) {
      setEstimatedPrice(pricingSuggestion.suggestedPrice.toString());
      setPriceManuallyEdited(true);
      animateTransition();
      setPricingSuggestion(null);
    }
  }, [pricingSuggestion]);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const canSave =
    !!selectedClientId && !!selectedService && !createJobMutation.isPending;

  // ==== Reusable section (title + card) ====
  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.sectionWrap}>
      <ThemedText
        style={[styles.sectionTitle, { color: theme.textTertiary }]}
      >
        {title}
      </ThemedText>
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: theme.cardBackground },
        ]}
      >
        {children}
      </View>
    </View>
  );

  // ==== Tap row (used for Client & Service closed-state placeholders) ====
  const TapRow = ({
    placeholder,
    onPress,
    testID,
  }: {
    placeholder: string;
    onPress: () => void;
    testID?: string;
  }) => (
    <Pressable
      onPress={onPress}
      style={styles.tapRow}
      testID={testID}
    >
      <ThemedText
        style={[styles.tapRowPlaceholder, { color: theme.textTertiary }]}
      >
        {placeholder}
      </ThemedText>
      <Feather name="chevron-right" size={18} color={theme.textTertiary} />
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["3xl"],
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ============ 1. CLIENT ============ */}
        <Section title="Client">
          {selectedClient ? (
            <Pressable
              style={styles.identityRow}
              onPress={openClientSheet}
              testID="selected-client-card"
            >
              <View
                style={[styles.avatar, { backgroundColor: Colors.accent }]}
              >
                <ThemedText style={styles.avatarText}>
                  {selectedClient.firstName[0]}
                  {selectedClient.lastName[0]}
                </ThemedText>
              </View>
              <View style={styles.identityBody}>
                <ThemedText style={styles.identityName}>
                  {selectedClient.firstName} {selectedClient.lastName}
                </ThemedText>
                {selectedClient.phone || selectedClient.email ? (
                  <ThemedText
                    style={[
                      styles.identitySub,
                      { color: theme.textTertiary },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedClient.phone || selectedClient.email}
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText style={[styles.changeText, { color: Colors.accent }]}>
                Change
              </ThemedText>
            </Pressable>
          ) : (
            <TapRow
              placeholder="Select a client"
              onPress={openClientSheet}
              testID="button-open-client-sheet"
            />
          )}
        </Section>

        {/* ============ 2. SERVICE ============ */}
        <Section title="Service">
          {selectedService ? (
            <Pressable
              style={styles.serviceSummary}
              onPress={openServiceSheet}
              testID="selected-service-card"
            >
              <View style={styles.serviceSummaryHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.serviceSummaryName}>
                    {selectedService.name}
                  </ThemedText>
                  <View style={styles.serviceSummaryMeta}>
                    <View
                      style={[
                        styles.metaPill,
                        { backgroundColor: Colors.accentLight },
                      ]}
                    >
                      <ThemedText
                        style={[styles.metaPillText, { color: Colors.accent }]}
                      >
                        {selectedService.category}
                      </ThemedText>
                    </View>
                    <ThemedText
                      style={[styles.metaDot, { color: theme.textTertiary }]}
                    >
                      ·
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.serviceSummaryMetaText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {getPricingTypeLabel(selectedService.pricingType)}
                    </ThemedText>
                    {selectedService.duration ? (
                      <>
                        <ThemedText
                          style={[
                            styles.metaDot,
                            { color: theme.textTertiary },
                          ]}
                        >
                          ·
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.serviceSummaryMetaText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {getDurationLabel(selectedService.duration)}
                        </ThemedText>
                      </>
                    ) : null}
                  </View>
                </View>
                <View style={styles.serviceSummaryRight}>
                  <ThemedText
                    style={[styles.serviceSummaryPrice, { color: Colors.accent }]}
                  >
                    {getPriceDisplay(selectedService)}
                  </ThemedText>
                  <ThemedText
                    style={[styles.changeText, { color: Colors.accent }]}
                  >
                    Change
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          ) : servicesLoading ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator color={Colors.accent} />
              <ThemedText
                style={[styles.stateText, { color: theme.textSecondary }]}
              >
                Loading services
              </ThemedText>
            </View>
          ) : servicesError ? (
            <View style={styles.stateBlock}>
              <ThemedText style={styles.stateTitle}>
                Couldn't load services
              </ThemedText>
              <ThemedText
                style={[styles.stateText, { color: theme.textSecondary }]}
              >
                Check your connection and try again.
              </ThemedText>
            </View>
          ) : providerServices.length === 0 ? (
            <View style={styles.stateBlock}>
              <ThemedText style={styles.stateTitle}>No services yet</ThemedText>
              <ThemedText
                style={[styles.stateText, { color: theme.textSecondary }]}
              >
                Create your service catalog to book jobs faster.
              </ThemedText>
              <PrimaryButton
                onPress={() => navigation.navigate("NewService")}
                style={styles.stateAction}
                testID="button-create-service"
              >
                Create a Service
              </PrimaryButton>
            </View>
          ) : (
            <TapRow
              placeholder="Select a service"
              onPress={openServiceSheet}
              testID="button-open-service-sheet"
            />
          )}
        </Section>

        {/* ============ 3. JOB DETAILS ============ */}
        <Section title="Job Details">
          <View style={styles.detailsBlock}>
            <ThemedText
              style={[styles.fieldLabel, { color: theme.textSecondary }]}
            >
              What's going on?
            </ThemedText>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Brief issue summary or scope of work"
              placeholderTextColor={theme.textTertiary}
              multiline
              style={[
                styles.bareTextarea,
                { color: theme.text, minHeight: 84 },
              ]}
              testID="input-description"
            />
          </View>

          {serviceIntakeQuestions.length > 0 ? (
            <View
              style={[
                styles.detailsBlock,
                {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.separator,
                },
              ]}
            >
              <ThemedText
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                Service Intake
              </ThemedText>
              {serviceIntakeQuestions.map((q, i) => (
                <View
                  key={q.id}
                  style={[
                    styles.intakeQuestion,
                    i > 0 && { marginTop: Spacing.md },
                  ]}
                >
                  <ThemedText style={styles.intakeQuestionLabel}>
                    {q.question}
                    {q.required ? " *" : ""}
                  </ThemedText>
                  {q.options && q.options.length > 0 ? (
                    <View style={styles.intakeOptions}>
                      {q.options.map((opt) => {
                        const isSelected = intakeAnswers[q.id] === opt;
                        return (
                          <Pressable
                            key={opt}
                            onPress={() =>
                              setIntakeAnswers((prev) => ({
                                ...prev,
                                [q.id]: opt,
                              }))
                            }
                            style={[
                              styles.intakeOption,
                              {
                                backgroundColor: isSelected
                                  ? Colors.accentLight
                                  : theme.backgroundSecondary,
                                borderColor: isSelected
                                  ? Colors.accent
                                  : "transparent",
                              },
                            ]}
                            testID={`intake-option-${q.id}-${opt}`}
                          >
                            <ThemedText
                              style={[
                                styles.intakeOptionText,
                                {
                                  color: isSelected
                                    ? Colors.accent
                                    : theme.text,
                                },
                              ]}
                            >
                              {opt}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput
                      value={intakeAnswers[q.id] || ""}
                      onChangeText={(text) =>
                        setIntakeAnswers((prev) => ({
                          ...prev,
                          [q.id]: text,
                        }))
                      }
                      placeholder={
                        q.type === "number" ? "Enter a number" : "Answer"
                      }
                      placeholderTextColor={theme.textTertiary}
                      keyboardType={
                        q.type === "number" ? "numeric" : "default"
                      }
                      style={[
                        styles.intakeInput,
                        {
                          color: theme.text,
                          backgroundColor: theme.backgroundSecondary,
                        },
                      ]}
                      testID={`intake-input-${q.id}`}
                    />
                  )}
                </View>
              ))}
            </View>
          ) : null}

          <View
            style={[
              styles.detailsBlock,
              {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.separator,
              },
            ]}
          >
            <ThemedText
              style={[styles.fieldLabel, { color: theme.textSecondary }]}
            >
              Notes (optional)
            </ThemedText>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Internal notes for your records"
              placeholderTextColor={theme.textTertiary}
              multiline
              style={[
                styles.bareTextarea,
                { color: theme.text, minHeight: 56 },
              ]}
              testID="input-notes"
            />
          </View>
        </Section>

        {/* ============ 4. SCHEDULE ============ */}
        <View style={styles.sectionWrap}>
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textTertiary }]}
          >
            Schedule
          </ThemedText>
          <View style={styles.scheduleRow}>
            <Pressable
              style={[
                styles.schedulePill,
                { backgroundColor: theme.cardBackground },
              ]}
              onPress={() => setShowDatePicker(true)}
              testID="picker-date"
            >
              <ThemedText
                style={[
                  styles.schedulePillLabel,
                  { color: theme.textTertiary },
                ]}
              >
                Date
              </ThemedText>
              <ThemedText style={styles.schedulePillValue}>
                {formatDate(scheduledDate)}
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.schedulePill,
                { backgroundColor: theme.cardBackground },
              ]}
              onPress={() => setShowTimePicker(true)}
              testID="picker-time"
            >
              <ThemedText
                style={[
                  styles.schedulePillLabel,
                  { color: theme.textTertiary },
                ]}
              >
                Time
              </ThemedText>
              <ThemedText style={styles.schedulePillValue}>
                {formatTime(scheduledTime)}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* ============ 5. PRICE ============ */}
        <Section title="Price">
          <View style={styles.priceRow}>
            <ThemedText
              style={[styles.priceLabel, { color: theme.textSecondary }]}
            >
              Base
            </ThemedText>
            <ThemedText style={styles.priceValue}>
              ${baseServicePriceNum.toFixed(2)}
            </ThemedText>
          </View>

          {availableAddOns.length > 0 ? (
            <View
              style={[
                styles.priceGroup,
                {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.separator,
                },
              ]}
            >
              {availableAddOns.map((addon, idx) => {
                const isSelected = selectedAddOns.some(
                  (a) => a.name === addon.name,
                );
                return (
                  <Pressable
                    key={addon.name}
                    style={[
                      styles.addonRow,
                      idx > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: theme.separator,
                      },
                    ]}
                    onPress={() => handleToggleAddOn(addon)}
                    testID={`addon-${addon.name.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isSelected
                            ? Colors.accent
                            : theme.textTertiary,
                          backgroundColor: isSelected
                            ? Colors.accent
                            : "transparent",
                        },
                      ]}
                    >
                      {isSelected ? (
                        <Feather name="check" size={11} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText
                        style={[
                          styles.addonName,
                          isSelected && { color: Colors.accent },
                        ]}
                      >
                        {addon.name}
                      </ThemedText>
                      {addon.description ? (
                        <ThemedText
                          style={[
                            styles.addonDesc,
                            { color: theme.textTertiary },
                          ]}
                          numberOfLines={1}
                        >
                          {addon.description}
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText
                      style={[
                        styles.addonPrice,
                        {
                          color: isSelected
                            ? Colors.accent
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      +${(Number(addon.price) || 0).toFixed(0)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View
            style={[
              styles.totalRow,
              {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.separator,
              },
            ]}
          >
            <ThemedText style={styles.totalLabel}>Total</ThemedText>
            <View style={styles.totalRight}>
              <ThemedText style={[styles.totalCurrency, { color: Colors.accent }]}>
                $
              </ThemedText>
              <TextInput
                value={estimatedPrice ? estimatedPrice.replace(/^\$/, "") : ""}
                onChangeText={(val) => {
                  setEstimatedPrice(val);
                  setPriceManuallyEdited(true);
                }}
                placeholder="0.00"
                placeholderTextColor={theme.textTertiary}
                keyboardType="decimal-pad"
                style={[styles.totalInput, { color: Colors.accent }]}
                selectionColor={Colors.accent}
                testID="input-price"
              />
            </View>
          </View>

          <Pressable
            onPress={handleGetPricingSuggestion}
            disabled={pricingLoading || !selectedService}
            style={styles.aiTextLink}
            hitSlop={6}
            testID="button-ai-suggest"
          >
            {pricingLoading ? (
              <ActivityIndicator size="small" color={theme.textSecondary} />
            ) : (
              <Feather name="zap" size={11} color={theme.textSecondary} />
            )}
            <ThemedText
              style={[
                styles.aiTextLinkText,
                { color: theme.textSecondary },
                (pricingLoading || !selectedService) && { opacity: 0.4 },
              ]}
            >
              AI suggest a price
            </ThemedText>
          </Pressable>

          {pricingSuggestion ? (
            <View
              style={[
                styles.suggestionInline,
                {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.separator,
                },
              ]}
            >
              <View style={styles.suggestionHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    style={[
                      styles.suggestionEyebrow,
                      { color: theme.textTertiary },
                    ]}
                  >
                    Suggested
                  </ThemedText>
                  <ThemedText style={styles.suggestionPrice}>
                    ${pricingSuggestion.suggestedPrice.toFixed(0)}
                    <ThemedText
                      style={[
                        styles.suggestionRange,
                        { color: theme.textTertiary },
                      ]}
                    >
                      {"  "}${pricingSuggestion.minPrice.toFixed(0)}–$
                      {pricingSuggestion.maxPrice.toFixed(0)}
                    </ThemedText>
                  </ThemedText>
                </View>
                <View style={styles.suggestionActions}>
                  <Pressable
                    onPress={() => {
                      animateTransition();
                      setPricingSuggestion(null);
                    }}
                    style={styles.textButton}
                  >
                    <ThemedText
                      style={[
                        styles.textButtonText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Dismiss
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={applyPricingSuggestion}
                    style={[
                      styles.useSuggestionBtn,
                      { backgroundColor: Colors.accent },
                    ]}
                    testID="button-apply-price"
                  >
                    <ThemedText style={styles.useSuggestionText}>
                      Use
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
              {pricingSuggestion.reasoning ? (
                <ThemedText
                  style={[
                    styles.suggestionReason,
                    { color: theme.textSecondary },
                  ]}
                >
                  {pricingSuggestion.reasoning}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </Section>

        {/* ============ 6. JOB SUMMARY ============ */}
        <Section title="Job Summary">
          <SummaryRow
            label="Client"
            value={
              selectedClient
                ? `${selectedClient.firstName} ${selectedClient.lastName}`
                : "—"
            }
            theme={theme}
          />
          <SummaryRow
            label="Service"
            value={selectedService?.name || "—"}
            theme={theme}
            divider
          />
          <SummaryRow
            label="Date & Time"
            value={`${formatDate(scheduledDate)} · ${formatTime(scheduledTime)}`}
            theme={theme}
            divider
          />
          <SummaryRow
            label="Final Price"
            value={`$${totalPriceNum.toFixed(2)}`}
            valueColor={Colors.accent}
            valueBold
            theme={theme}
            divider
          />
          {description.trim() ? (
            <SummaryBlock
              label="Issue Summary"
              text={description.trim()}
              theme={theme}
              divider
            />
          ) : null}
          {notes.trim() ? (
            <SummaryBlock
              label="Notes"
              text={notes.trim()}
              theme={theme}
              divider
            />
          ) : null}
          {selectedService ? (
            <SummaryBlock
              label="Payment Terms"
              text={getPricingTypeLabel(selectedService.pricingType)}
              theme={theme}
              divider
            />
          ) : null}
        </Section>

        {createJobMutation.isError ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: Colors.errorLight },
            ]}
          >
            <Feather name="alert-circle" size={14} color={Colors.error} />
            <ThemedText style={[styles.errorText, { color: Colors.error }]}>
              Couldn't create the job. Please try again.
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.ctaWrap}>
          <PrimaryButton
            onPress={handleSave}
            disabled={!canSave}
            loading={createJobMutation.isPending}
            testID="button-schedule-job"
          >
            Schedule Job
          </PrimaryButton>
          <SecondaryButton
            onPress={() => navigation.goBack()}
            style={styles.ctaSecondary}
          >
            Cancel
          </SecondaryButton>
        </View>
      </KeyboardAwareScrollViewCompat>

      {/* ============ CLIENT PICKER SHEET ============ */}
      <Modal
        visible={showClientSheet}
        transparent
        animationType="slide"
        onRequestClose={closeClientSheet}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeClientSheet}
          />
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.backgroundRoot,
                paddingBottom: Math.max(insets.bottom, Spacing.lg),
              },
            ]}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: theme.separator }]}
            />
            <View style={styles.sheetHeader}>
              <Pressable
                onPress={closeClientSheet}
                hitSlop={12}
                style={styles.sheetHeaderBtn}
              >
                <ThemedText
                  style={[
                    styles.sheetCancelText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Cancel
                </ThemedText>
              </Pressable>
              <ThemedText style={styles.sheetTitle}>
                {showNewClientForm ? "Add Client" : "Select Client"}
              </ThemedText>
              <View style={styles.sheetHeaderBtn} />
            </View>

            {showNewClientForm ? (
              <ScrollView
                contentContainerStyle={styles.sheetFormContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      value={newClientFirstName}
                      onChangeText={setNewClientFirstName}
                      placeholder="First name"
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextField
                      value={newClientLastName}
                      onChangeText={setNewClientLastName}
                      placeholder="Last name"
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <TextField
                  value={newClientPhone}
                  onChangeText={setNewClientPhone}
                  placeholder="Phone"
                  keyboardType="phone-pad"
                />
                <TextField
                  value={newClientEmail}
                  onChangeText={setNewClientEmail}
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={styles.sheetFormActions}>
                  <Pressable
                    onPress={() => setShowNewClientForm(false)}
                    style={styles.textButton}
                  >
                    <ThemedText
                      style={[
                        styles.textButtonText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Back
                    </ThemedText>
                  </Pressable>
                  <PrimaryButton
                    onPress={handleCreateClient}
                    loading={createClientMutation.isPending}
                    disabled={
                      !newClientFirstName.trim() ||
                      !newClientLastName.trim() ||
                      createClientMutation.isPending
                    }
                    style={styles.smallPrimary}
                    testID="button-create-client"
                  >
                    Add Client
                  </PrimaryButton>
                </View>
              </ScrollView>
            ) : (
              <>
                <View
                  style={[
                    styles.sheetSearch,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Feather name="search" size={15} color={theme.textTertiary} />
                  <TextInput
                    style={[styles.sheetSearchInput, { color: theme.text }]}
                    placeholder="Search clients"
                    placeholderTextColor={theme.textTertiary}
                    value={clientSearch}
                    onChangeText={setClientSearch}
                    autoCorrect={false}
                    autoFocus={false}
                  />
                </View>

                <ScrollView
                  style={styles.sheetList}
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredClients.map((client) => {
                    const isActive = selectedClientId === client.id;
                    return (
                      <Pressable
                        key={client.id}
                        style={[
                          styles.sheetListRow,
                          isActive && { backgroundColor: Colors.accentLight },
                        ]}
                        onPress={() => handleSelectClient(client.id)}
                        testID={`client-row-${client.id}`}
                      >
                        <View
                          style={[
                            styles.avatarSmall,
                            { backgroundColor: Colors.accent },
                          ]}
                        >
                          <ThemedText style={styles.avatarTextSmall}>
                            {client.firstName[0]}
                            {client.lastName[0]}
                          </ThemedText>
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText
                            style={[
                              styles.sheetListRowTitle,
                              isActive && { color: Colors.accent },
                            ]}
                          >
                            {client.firstName} {client.lastName}
                          </ThemedText>
                          {client.phone || client.email ? (
                            <ThemedText
                              style={[
                                styles.sheetListRowSub,
                                { color: theme.textTertiary },
                              ]}
                              numberOfLines={1}
                            >
                              {client.phone || client.email}
                            </ThemedText>
                          ) : null}
                        </View>
                        {isActive ? (
                          <Feather
                            name="check"
                            size={16}
                            color={Colors.accent}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                  {filteredClients.length === 0 ? (
                    <ThemedText
                      style={[styles.emptyHint, { color: theme.textTertiary }]}
                    >
                      No matching clients
                    </ThemedText>
                  ) : null}
                </ScrollView>

                <Pressable
                  style={[
                    styles.sheetFooterAction,
                    { borderTopColor: theme.separator },
                  ]}
                  onPress={() => setShowNewClientForm(true)}
                  testID="button-add-new-client"
                >
                  <View
                    style={[
                      styles.plusBadge,
                      { backgroundColor: Colors.accentLight },
                    ]}
                  >
                    <Feather name="plus" size={13} color={Colors.accent} />
                  </View>
                  <ThemedText
                    style={[
                      styles.sheetFooterActionText,
                      { color: Colors.accent },
                    ]}
                  >
                    Add New Client
                  </ThemedText>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ============ SERVICE PICKER SHEET ============ */}
      <Modal
        visible={showServiceSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowServiceSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowServiceSheet(false)}
          />
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.backgroundRoot,
                paddingBottom: Math.max(insets.bottom, Spacing.lg),
              },
            ]}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: theme.separator }]}
            />
            <View style={styles.sheetHeader}>
              <Pressable
                onPress={() => setShowServiceSheet(false)}
                hitSlop={12}
                style={styles.sheetHeaderBtn}
              >
                <ThemedText
                  style={[
                    styles.sheetCancelText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Cancel
                </ThemedText>
              </Pressable>
              <ThemedText style={styles.sheetTitle}>Select Service</ThemedText>
              <View style={styles.sheetHeaderBtn} />
            </View>

            <View
              style={[
                styles.sheetSearch,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="search" size={15} color={theme.textTertiary} />
              <TextInput
                style={[styles.sheetSearchInput, { color: theme.text }]}
                placeholder="Search services"
                placeholderTextColor={theme.textTertiary}
                value={serviceSearch}
                onChangeText={setServiceSearch}
                autoCorrect={false}
              />
            </View>

            <ScrollView
              style={styles.sheetList}
              keyboardShouldPersistTaps="handled"
            >
              {filteredServices.map((svc) => {
                const isActive = selectedService?.id === svc.id;
                return (
                  <Pressable
                    key={svc.id}
                    style={[
                      styles.sheetListRow,
                      isActive && { backgroundColor: Colors.accentLight },
                    ]}
                    onPress={() => handleSelectService(svc)}
                    testID={`service-row-${svc.id}`}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText
                        style={[
                          styles.sheetListRowTitle,
                          isActive && { color: Colors.accent },
                        ]}
                      >
                        {svc.name}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.sheetListRowSub,
                          { color: theme.textTertiary },
                        ]}
                        numberOfLines={1}
                      >
                        {svc.category}
                        {svc.duration
                          ? `  ·  ${getDurationLabel(svc.duration)}`
                          : ""}
                      </ThemedText>
                    </View>
                    <ThemedText
                      style={[
                        styles.sheetListPrice,
                        { color: isActive ? Colors.accent : theme.text },
                      ]}
                    >
                      {getPriceDisplay(svc)}
                    </ThemedText>
                    {isActive ? (
                      <Feather name="check" size={16} color={Colors.accent} />
                    ) : null}
                  </Pressable>
                );
              })}
              {filteredServices.length === 0 ? (
                <ThemedText
                  style={[styles.emptyHint, { color: theme.textTertiary }]}
                >
                  No matching services
                </ThemedText>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    </ThemedView>
  );
}

// ==== Summary helpers ====

function SummaryRow({
  label,
  value,
  valueColor,
  valueBold,
  theme,
  divider,
}: {
  label: string;
  value: string;
  valueColor?: string;
  valueBold?: boolean;
  theme: any;
  divider?: boolean;
}) {
  return (
    <View
      style={[
        styles.summaryRow,
        divider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.separator,
        },
      ]}
    >
      <ThemedText
        style={[styles.summaryRowLabel, { color: theme.textTertiary }]}
      >
        {label}
      </ThemedText>
      <ThemedText
        style={[
          styles.summaryRowValue,
          valueBold && styles.summaryRowValueBold,
          valueColor && { color: valueColor },
        ]}
      >
        {value}
      </ThemedText>
    </View>
  );
}

function SummaryBlock({
  label,
  text,
  theme,
  divider,
}: {
  label: string;
  text: string;
  theme: any;
  divider?: boolean;
}) {
  return (
    <View
      style={[
        styles.summaryBlock,
        divider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.separator,
        },
      ]}
    >
      <ThemedText
        style={[styles.summaryRowLabel, { color: theme.textTertiary }]}
      >
        {label}
      </ThemedText>
      <ThemedText style={[styles.summaryBlockText, { color: theme.text }]}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Section (iOS grouped-list style)
  sectionWrap: { marginBottom: Spacing.lg },
  sectionTitle: {
    ...Typography.caption,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginLeft: Spacing.md,
    marginBottom: 6,
  },
  sectionCard: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },

  // Tap row (empty placeholder for client / service)
  tapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md + 2,
    minHeight: 52,
  },
  tapRowPlaceholder: {
    ...Typography.body,
  },

  // Identity (selected client)
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 52,
  },
  identityBody: { flex: 1 },
  identityName: { ...Typography.body, fontWeight: "600" },
  identitySub: { ...Typography.footnote, marginTop: 2 },
  changeText: { ...Typography.subhead, fontWeight: "600" },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarTextSmall: { color: "#FFFFFF", fontWeight: "700", fontSize: 11 },

  // Service summary (selected)
  serviceSummary: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  serviceSummaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  serviceSummaryName: { ...Typography.body, fontWeight: "600" },
  serviceSummaryMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: Spacing.xs + 2,
  },
  serviceSummaryMetaText: { ...Typography.footnote, fontWeight: "500" },
  metaDot: { fontSize: 12, fontWeight: "700" },
  metaPill: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  metaPillText: { fontSize: 11, fontWeight: "600" },
  serviceSummaryRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  serviceSummaryPrice: { ...Typography.body, fontWeight: "700" },

  // State blocks
  stateBlock: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  stateTitle: { ...Typography.body, fontWeight: "600" },
  stateText: {
    ...Typography.footnote,
    textAlign: "center",
    lineHeight: 18,
  },
  stateAction: { marginTop: Spacing.sm, alignSelf: "stretch" },

  // Job Details
  detailsBlock: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  fieldLabel: {
    ...Typography.footnote,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  bareTextarea: {
    ...Typography.body,
    paddingTop: 0,
    paddingHorizontal: 0,
    textAlignVertical: "top",
  },
  intakeQuestion: {},
  intakeQuestionLabel: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: Spacing.xs + 2,
  },
  intakeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  intakeOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  intakeOptionText: {
    ...Typography.footnote,
    fontWeight: "600",
  },
  intakeInput: {
    ...Typography.subhead,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 40,
  },

  // Schedule pills
  scheduleRow: { flexDirection: "row", gap: Spacing.sm },
  schedulePill: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  schedulePillLabel: {
    ...Typography.caption,
    fontWeight: "500",
    marginBottom: 2,
  },
  schedulePillValue: {
    ...Typography.body,
    fontWeight: "600",
  },

  // Price
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  priceLabel: { ...Typography.subhead, fontWeight: "500" },
  priceValue: { ...Typography.subhead, fontWeight: "600" },
  priceGroup: {},

  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  addonName: { ...Typography.subhead, fontWeight: "500" },
  addonDesc: { ...Typography.caption, marginTop: 1 },
  addonPrice: { ...Typography.subhead, fontWeight: "600" },

  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  totalLabel: { ...Typography.body, fontWeight: "700" },
  totalRight: { flexDirection: "row", alignItems: "center" },
  totalCurrency: {
    ...Typography.body,
    fontWeight: "700",
  },
  totalInput: {
    ...Typography.body,
    fontWeight: "700",
    minWidth: 70,
    textAlign: "right",
    paddingVertical: 0,
    marginVertical: 0,
  },

  // AI suggest link
  aiTextLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    paddingTop: 0,
  },
  aiTextLinkText: {
    ...Typography.footnote,
    fontWeight: "500",
  },

  // AI suggestion inline (under price card)
  suggestionInline: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  suggestionEyebrow: {
    ...Typography.caption,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  suggestionPrice: {
    ...Typography.title3,
    fontWeight: "700",
    marginTop: 2,
  },
  suggestionRange: {
    ...Typography.footnote,
    fontWeight: "500",
  },
  suggestionReason: {
    ...Typography.footnote,
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  suggestionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  textButton: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm },
  textButtonText: { ...Typography.subhead, fontWeight: "500" },
  useSuggestionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  useSuggestionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  // Job summary
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  summaryRowLabel: { ...Typography.subhead, fontWeight: "500" },
  summaryRowValue: { ...Typography.subhead, fontWeight: "600" },
  summaryRowValueBold: { ...Typography.body, fontWeight: "700" },
  summaryBlock: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  summaryBlockText: {
    ...Typography.subhead,
    lineHeight: 21,
    marginTop: 4,
  },

  // CTAs
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  errorText: { fontSize: 13, fontWeight: "500" },
  ctaWrap: {
    marginTop: Spacing.sm,
  },
  ctaSecondary: { marginTop: Spacing.sm },

  // Sheet (client / service picker)
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.screenPadding,
    maxHeight: "85%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sheetHeaderBtn: { minWidth: 60 },
  sheetCancelText: { fontSize: 16, fontWeight: "400" },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    flex: 1,
  },
  sheetSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 40,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  sheetList: {
    maxHeight: 420,
  },
  sheetListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  sheetListRowTitle: { ...Typography.body, fontWeight: "500" },
  sheetListRowSub: { ...Typography.footnote, marginTop: 1 },
  sheetListPrice: { ...Typography.subhead, fontWeight: "700" },
  emptyHint: {
    ...Typography.footnote,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
  sheetFooterAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetFooterActionText: { ...Typography.subhead, fontWeight: "600" },
  plusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  // Sheet: new-client form
  sheetFormContent: {
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  row2: { flexDirection: "row", gap: Spacing.sm },
  sheetFormActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  smallPrimary: {
    height: 40,
    paddingHorizontal: Spacing.lg,
    minWidth: 120,
  },
});
