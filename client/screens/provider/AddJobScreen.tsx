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
  Shadows,
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

  const providerServices = servicesData?.services || [];
  const clients = clientsData?.clients || [];

  // Form state
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    preselectedClientId || null,
  );
  const [selectedService, setSelectedService] = useState<CustomService | null>(
    null,
  );
  const [serviceName, setServiceName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [baseServicePriceNum, setBaseServicePriceNum] = useState(0);
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<ServiceAddOn[]>([]);
  const [serviceDescription, setServiceDescription] = useState<string>("");
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({});

  // UI state — inline expansions (no modals)
  const [clientExpanded, setClientExpanded] = useState(false);
  const [serviceExpanded, setServiceExpanded] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  // Picker sheets (native)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Inline new-client fields
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

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

  const totalPriceNum = useMemo(() => {
    const parsed = parseFloat(estimatedPrice);
    return isNaN(parsed) ? 0 : parsed;
  }, [estimatedPrice]);

  // ==== Handlers ====

  const handleSelectClient = (id: string) => {
    setSelectedClientId(id);
    setShowNewClientForm(false);
    setClientSearch("");
    animateTransition();
    setClientExpanded(false);
  };

  const handleSelectService = (svc: CustomService) => {
    setSelectedService(svc);
    setServiceName(svc.name);
    setServiceDescription(svc.description || "");
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
    animateTransition();
    setServiceExpanded(false);
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
      animateTransition();
      setClientExpanded(false);
    },
    onError: (error) => {
      console.error("Create client error:", error);
    },
  });

  const handleSave = () => {
    if (!selectedClientId || !serviceName.trim() || !providerId) return;
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
      customServiceId: selectedService?.id || undefined,
      title: serviceName,
      description: description.trim() || undefined,
      scheduledDate: scheduledDate.toISOString(),
      scheduledTime,
      estimatedDuration: selectedService?.duration || undefined,
      estimatedPrice: estimatedPrice.trim() || undefined,
      pricingType: selectedService?.pricingType || undefined,
      serviceDescription: serviceDescription || undefined,
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
    !!selectedClientId &&
    !!serviceName.trim() &&
    !createJobMutation.isPending;

  // ==== Reusable section card ====
  const renderSection = (
    title: string,
    children: React.ReactNode,
    rightAccessory?: React.ReactNode,
  ) => (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.borderLight,
        },
        Shadows.sm,
      ]}
    >
      <View style={styles.sectionHeaderRow}>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        {rightAccessory}
      </View>
      {children}
    </View>
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
        {renderSection(
          "Client",
          <>
            {selectedClient && !clientExpanded ? (
              <Pressable
                style={[
                  styles.identityRow,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
                onPress={() => {
                  animateTransition();
                  setClientExpanded(true);
                }}
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
                <ThemedText
                  style={[styles.changeText, { color: Colors.accent }]}
                >
                  Change
                </ThemedText>
              </Pressable>
            ) : (
              <View>
                <View
                  style={[
                    styles.searchBar,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Feather
                    name="search"
                    size={15}
                    color={theme.textTertiary}
                  />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="Search clients"
                    placeholderTextColor={theme.textTertiary}
                    value={clientSearch}
                    onChangeText={setClientSearch}
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inlineList}>
                  {filteredClients.slice(0, 6).map((client) => {
                    const isActive = selectedClientId === client.id;
                    return (
                      <Pressable
                        key={client.id}
                        style={[
                          styles.listRow,
                          isActive && {
                            backgroundColor: Colors.accentLight,
                          },
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
                              styles.listRowTitle,
                              isActive && { color: Colors.accent },
                            ]}
                          >
                            {client.firstName} {client.lastName}
                          </ThemedText>
                          {client.phone ? (
                            <ThemedText
                              style={[
                                styles.listRowSub,
                                { color: theme.textTertiary },
                              ]}
                            >
                              {client.phone}
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

                  {filteredClients.length === 0 && !showNewClientForm ? (
                    <ThemedText
                      style={[
                        styles.emptyHint,
                        { color: theme.textTertiary },
                      ]}
                    >
                      No matching clients
                    </ThemedText>
                  ) : null}
                </View>

                {!showNewClientForm ? (
                  <Pressable
                    style={styles.inlineActionRow}
                    onPress={() => {
                      animateTransition();
                      setShowNewClientForm(true);
                    }}
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
                      style={[styles.inlineActionText, { color: Colors.accent }]}
                    >
                      Add new client
                    </ThemedText>
                  </Pressable>
                ) : (
                  <View style={styles.inlineForm}>
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
                      placeholder="Phone (required)"
                      keyboardType="phone-pad"
                    />
                    <TextField
                      value={newClientEmail}
                      onChangeText={setNewClientEmail}
                      placeholder="Email (recommended)"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <View style={styles.inlineFormButtons}>
                      <Pressable
                        onPress={() => {
                          animateTransition();
                          setShowNewClientForm(false);
                        }}
                        style={styles.textButton}
                      >
                        <ThemedText
                          style={[
                            styles.textButtonText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          Cancel
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
                  </View>
                )}
              </View>
            )}
          </>,
        )}

        {/* ============ 2. SERVICE ============ */}
        {renderSection(
          "Service",
          <>
            {selectedService && !serviceExpanded ? (
              <Pressable
                style={[
                  styles.servicePreview,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
                onPress={() => {
                  animateTransition();
                  setServiceExpanded(true);
                }}
                testID="selected-service-card"
              >
                <View style={styles.servicePreviewTop}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.servicePreviewName}>
                      {selectedService.name}
                    </ThemedText>
                    <View style={styles.servicePreviewMeta}>
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
                      <View
                        style={[
                          styles.metaPill,
                          {
                            backgroundColor: theme.backgroundTertiary,
                          },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.metaPillText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {getPricingTypeLabel(selectedService.pricingType)}
                        </ThemedText>
                      </View>
                      {selectedService.duration ? (
                        <View
                          style={[
                            styles.metaPill,
                            {
                              backgroundColor: theme.backgroundTertiary,
                            },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.metaPillText,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {getDurationLabel(selectedService.duration)}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <ThemedText
                    style={[styles.changeText, { color: Colors.accent }]}
                  >
                    Change
                  </ThemedText>
                </View>
                {selectedService.description ? (
                  <ThemedText
                    style={[
                      styles.servicePreviewDesc,
                      { color: theme.textSecondary },
                    ]}
                    numberOfLines={2}
                  >
                    {selectedService.description}
                  </ThemedText>
                ) : null}
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
                <ThemedText style={styles.stateTitle}>
                  No services yet
                </ThemedText>
                <ThemedText
                  style={[styles.stateText, { color: theme.textSecondary }]}
                >
                  Create your service catalog to book jobs faster and include
                  pricing in client emails.
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
              <View style={styles.inlineList}>
                {providerServices.map((svc) => {
                  const isActive = selectedService?.id === svc.id;
                  return (
                    <Pressable
                      key={svc.id}
                      style={[
                        styles.serviceCard,
                        {
                          backgroundColor: theme.backgroundSecondary,
                          borderColor: isActive
                            ? Colors.accent
                            : "transparent",
                        },
                      ]}
                      onPress={() => handleSelectService(svc)}
                      testID={`service-card-${svc.id}`}
                    >
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.serviceCardName}>
                          {svc.name}
                        </ThemedText>
                        <View style={styles.serviceCardMeta}>
                          <ThemedText
                            style={[
                              styles.serviceCardPrice,
                              { color: Colors.accent },
                            ]}
                          >
                            {getPriceDisplay(svc)}
                          </ThemedText>
                          {svc.duration ? (
                            <ThemedText
                              style={[
                                styles.serviceCardDuration,
                                { color: theme.textTertiary },
                              ]}
                            >
                              {"  ·  "}
                              {getDurationLabel(svc.duration)}
                            </ThemedText>
                          ) : null}
                        </View>
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
              </View>
            )}
          </>,
        )}

        {/* ============ 3. JOB DETAILS ============ */}
        {renderSection(
          "Job Details",
          <>
            <ThemedText
              style={[styles.fieldLabel, { color: theme.textSecondary }]}
            >
              What's going on?
            </ThemedText>
            <TextField
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue or scope of work"
              multiline
              numberOfLines={4}
              style={styles.bigTextarea}
            />

            {serviceIntakeQuestions.length > 0 ? (
              <View
                style={[
                  styles.intakeBlock,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.borderLight,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.intakeBlockTitle,
                    { color: theme.textSecondary },
                  ]}
                >
                  Service Intake Questions
                </ThemedText>
                {serviceIntakeQuestions.map((q, i) => (
                  <View
                    key={q.id}
                    style={[
                      styles.intakeQuestion,
                      i > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: theme.separator,
                      },
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
                                    : theme.backgroundElevated,
                                  borderColor: isSelected
                                    ? Colors.accent
                                    : theme.borderLight,
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
                            backgroundColor: theme.backgroundElevated,
                            borderColor: theme.borderLight,
                          },
                        ]}
                        testID={`intake-input-${q.id}`}
                      />
                    )}
                  </View>
                ))}
              </View>
            ) : null}

            {serviceDescription.length > 0 ? (
              <View style={{ marginTop: Spacing.lg }}>
                <View style={styles.fieldLabelRow}>
                  <ThemedText
                    style={[styles.fieldLabel, { color: theme.textSecondary }]}
                  >
                    Service Description
                  </ThemedText>
                  <View
                    style={[
                      styles.subtleBadge,
                      { backgroundColor: theme.backgroundTertiary },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.subtleBadgeText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      In client email
                    </ThemedText>
                  </View>
                </View>
                <TextField
                  value={serviceDescription}
                  onChangeText={setServiceDescription}
                  placeholder="Service description shown to client"
                  multiline
                  numberOfLines={2}
                />
              </View>
            ) : null}
          </>,
        )}

        {/* ============ 4. SCHEDULE & PRICING ============ */}
        {renderSection(
          "Schedule & Pricing",
          <>
            <View style={styles.scheduleRow}>
              <Pressable
                style={[
                  styles.schedulePill,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
                onPress={() => setShowDatePicker(true)}
                testID="picker-date"
              >
                <ThemedText
                  style={[styles.schedulePillLabel, { color: theme.textTertiary }]}
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
                  { backgroundColor: theme.backgroundSecondary },
                ]}
                onPress={() => setShowTimePicker(true)}
                testID="picker-time"
              >
                <ThemedText
                  style={[styles.schedulePillLabel, { color: theme.textTertiary }]}
                >
                  Time
                </ThemedText>
                <ThemedText style={styles.schedulePillValue}>
                  {formatTime(scheduledTime)}
                </ThemedText>
              </Pressable>
            </View>

            {/* Pricing card */}
            <View
              style={[
                styles.pricingCard,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <View style={styles.pricingRow}>
                <ThemedText
                  style={[styles.pricingLabel, { color: theme.textSecondary }]}
                >
                  Base
                </ThemedText>
                <ThemedText style={styles.pricingValue}>
                  ${baseServicePriceNum.toFixed(2)}
                </ThemedText>
              </View>

              {availableAddOns.length > 0 ? (
                <View
                  style={[
                    styles.addonsBlock,
                    { borderTopColor: theme.separator },
                  ]}
                >
                  {availableAddOns.map((addon) => {
                    const isSelected = selectedAddOns.some(
                      (a) => a.name === addon.name,
                    );
                    return (
                      <Pressable
                        key={addon.name}
                        style={styles.addonRow}
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
                  { borderTopColor: theme.separator },
                ]}
              >
                <ThemedText style={styles.totalLabel}>Total</ThemedText>
                <View style={styles.totalRight}>
                  <ThemedText style={styles.totalCurrency}>$</ThemedText>
                  <TextInput
                    value={
                      estimatedPrice ? estimatedPrice.replace(/^\$/, "") : ""
                    }
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
            </View>

            {/* AI suggest text-button */}
            <Pressable
              onPress={handleGetPricingSuggestion}
              disabled={pricingLoading || !serviceName.trim()}
              style={styles.aiTextButton}
              hitSlop={6}
              testID="button-ai-suggest"
            >
              {pricingLoading ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Feather name="zap" size={12} color={Colors.accent} />
              )}
              <ThemedText
                style={[
                  styles.aiTextButtonText,
                  { color: Colors.accent },
                  (pricingLoading || !serviceName.trim()) && { opacity: 0.4 },
                ]}
              >
                AI suggest a price
              </ThemedText>
            </Pressable>

            {pricingSuggestion ? (
              <View
                style={[
                  styles.suggestionCard,
                  {
                    backgroundColor: Colors.accentLight,
                    borderColor: Colors.accent + "33",
                  },
                ]}
              >
                <View style={styles.suggestionHeader}>
                  <ThemedText style={styles.suggestionLabel}>
                    Suggested
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.suggestionPrice,
                      { color: Colors.accent },
                    ]}
                  >
                    ${pricingSuggestion.suggestedPrice.toFixed(0)}
                  </ThemedText>
                </View>
                <ThemedText
                  style={[
                    styles.suggestionRange,
                    { color: theme.textSecondary },
                  ]}
                >
                  Range ${pricingSuggestion.minPrice.toFixed(0)} – $
                  {pricingSuggestion.maxPrice.toFixed(0)}
                </ThemedText>
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
                      Use this price
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </>,
        )}

        {/* ============ 5. REVIEW & CONFIRM ============ */}
        {renderSection(
          "Review",
          <>
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.borderLight,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.summaryEyebrow,
                  { color: theme.textTertiary },
                ]}
              >
                Email preview
              </ThemedText>

              <ThemedText style={styles.summaryHeadline}>
                {selectedService?.name || serviceName || "—"}
              </ThemedText>
              <ThemedText
                style={[styles.summaryDate, { color: theme.textSecondary }]}
              >
                {formatDate(scheduledDate)} · {formatTime(scheduledTime)}
              </ThemedText>

              <View
                style={[
                  styles.summaryDivider,
                  { backgroundColor: theme.separator },
                ]}
              />

              <View style={styles.summaryRow}>
                <ThemedText
                  style={[
                    styles.summaryRowLabel,
                    { color: theme.textTertiary },
                  ]}
                >
                  Client
                </ThemedText>
                <ThemedText style={styles.summaryRowValue}>
                  {selectedClient
                    ? `${selectedClient.firstName} ${selectedClient.lastName}`
                    : "—"}
                </ThemedText>
              </View>

              {selectedService ? (
                <View style={styles.summaryRow}>
                  <ThemedText
                    style={[
                      styles.summaryRowLabel,
                      { color: theme.textTertiary },
                    ]}
                  >
                    Pricing
                  </ThemedText>
                  <ThemedText style={styles.summaryRowValue}>
                    {getPricingTypeLabel(selectedService.pricingType)}
                  </ThemedText>
                </View>
              ) : null}

              {description.trim() ? (
                <View style={styles.summaryBlock}>
                  <ThemedText
                    style={[
                      styles.summaryBlockLabel,
                      { color: theme.textTertiary },
                    ]}
                  >
                    What's going on
                  </ThemedText>
                  <ThemedText style={styles.summaryBlockText}>
                    {description.trim()}
                  </ThemedText>
                </View>
              ) : null}

              {selectedAddOns.length > 0 ? (
                <View style={styles.summaryBlock}>
                  <ThemedText
                    style={[
                      styles.summaryBlockLabel,
                      { color: theme.textTertiary },
                    ]}
                  >
                    Add-ons
                  </ThemedText>
                  {selectedAddOns.map((a) => (
                    <View key={a.name} style={styles.summaryAddonRow}>
                      <ThemedText style={styles.summaryBlockText}>
                        {a.name}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.summaryBlockText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        +${(Number(a.price) || 0).toFixed(0)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}

              {serviceDescription.trim() ? (
                <View style={styles.summaryBlock}>
                  <ThemedText
                    style={[
                      styles.summaryBlockLabel,
                      { color: theme.textTertiary },
                    ]}
                  >
                    Service description
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.summaryBlockText,
                      { color: theme.textSecondary },
                    ]}
                    numberOfLines={3}
                  >
                    {serviceDescription.trim()}
                  </ThemedText>
                </View>
              ) : null}

              <View
                style={[
                  styles.summaryDivider,
                  { backgroundColor: theme.separator },
                ]}
              />

              <View style={styles.summaryTotalRow}>
                <ThemedText style={styles.summaryTotalLabel}>Total</ThemedText>
                <ThemedText
                  style={[
                    styles.summaryTotalValue,
                    { color: Colors.accent },
                  ]}
                >
                  ${totalPriceNum.toFixed(2)}
                </ThemedText>
              </View>
            </View>

            {createJobMutation.isError ? (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: Colors.errorLight },
                ]}
              >
                <Feather name="alert-circle" size={14} color={Colors.error} />
                <ThemedText
                  style={[styles.errorText, { color: Colors.error }]}
                >
                  Couldn't create the job. Please try again.
                </ThemedText>
              </View>
            ) : null}

            <PrimaryButton
              onPress={handleSave}
              disabled={!canSave}
              loading={createJobMutation.isPending}
              style={styles.ctaPrimary}
              testID="button-schedule-job"
            >
              Schedule Job & Notify Client
            </PrimaryButton>
            <SecondaryButton
              onPress={() => navigation.goBack()}
              style={styles.ctaSecondary}
            >
              Cancel
            </SecondaryButton>
          </>,
        )}
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  section: {
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.headline,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },

  // Identity (selected client/service)
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
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

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 40,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },

  // Inline list / rows
  inlineList: { gap: 4 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  listRowTitle: { ...Typography.body, fontWeight: "500" },
  listRowSub: { ...Typography.footnote, marginTop: 1 },

  emptyHint: {
    ...Typography.footnote,
    textAlign: "center",
    paddingVertical: Spacing.md,
  },

  // Inline action button (e.g. "Add new client")
  inlineActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
  },
  inlineActionText: { ...Typography.subhead, fontWeight: "600" },
  plusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  // Inline new-client form
  inlineForm: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  row2: { flexDirection: "row", gap: Spacing.sm },
  inlineFormButtons: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  textButton: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  textButtonText: { ...Typography.subhead, fontWeight: "500" },
  smallPrimary: {
    height: 40,
    paddingHorizontal: Spacing.lg,
    minWidth: 120,
  },

  // Service preview (selected)
  servicePreview: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  servicePreviewTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  servicePreviewName: { ...Typography.body, fontWeight: "600" },
  servicePreviewMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: Spacing.xs + 2,
  },
  metaPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaPillText: { fontSize: 11, fontWeight: "600" },
  servicePreviewDesc: {
    ...Typography.footnote,
    lineHeight: 18,
    marginTop: Spacing.sm,
  },

  // Service card (in picker)
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  serviceCardName: { ...Typography.body, fontWeight: "500" },
  serviceCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  serviceCardPrice: { ...Typography.footnote, fontWeight: "700" },
  serviceCardDuration: { ...Typography.footnote },

  // Loading / error / empty state blocks
  stateBlock: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
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
  fieldLabel: {
    ...Typography.footnote,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  bigTextarea: {
    minHeight: 96,
    paddingTop: Spacing.sm,
    textAlignVertical: "top",
  },
  subtleBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  subtleBadgeText: { fontSize: 10, fontWeight: "600" },

  intakeBlock: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  intakeBlockTitle: {
    ...Typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  intakeQuestion: {
    paddingVertical: Spacing.sm + 2,
  },
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
    paddingVertical: 6,
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
    borderWidth: StyleSheet.hairlineWidth,
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

  // Pricing card
  pricingCard: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  pricingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  pricingLabel: { ...Typography.subhead, fontWeight: "500" },
  pricingValue: { ...Typography.subhead, fontWeight: "600" },

  addonsBlock: { borderTopWidth: 1, paddingTop: Spacing.xs },
  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
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
    paddingTop: Spacing.sm + 2,
    paddingBottom: 2,
    borderTopWidth: 1,
    marginTop: Spacing.xs,
  },
  totalLabel: { ...Typography.body, fontWeight: "700" },
  totalRight: { flexDirection: "row", alignItems: "center" },
  totalCurrency: {
    ...Typography.body,
    fontWeight: "700",
    color: Colors.accent,
  },
  totalInput: {
    ...Typography.body,
    fontWeight: "700",
    minWidth: 70,
    textAlign: "right",
    paddingVertical: 0,
    marginVertical: 0,
  },

  // AI text-button
  aiTextButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    marginTop: Spacing.sm,
    paddingVertical: 4,
  },
  aiTextButtonText: { ...Typography.footnote, fontWeight: "600" },

  // AI suggestion card
  suggestionCard: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  suggestionLabel: { ...Typography.footnote, fontWeight: "700" },
  suggestionPrice: { fontSize: 22, fontWeight: "800" },
  suggestionRange: { ...Typography.caption, fontWeight: "500" },
  suggestionReason: { ...Typography.caption, lineHeight: 16 },
  suggestionActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
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

  // Summary card (review)
  summaryCard: {
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
  },
  summaryEyebrow: {
    ...Typography.caption,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  summaryHeadline: {
    ...Typography.title3,
    fontWeight: "700",
    fontSize: 19,
  },
  summaryDate: { ...Typography.subhead, marginTop: 2 },
  summaryDivider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryRowLabel: { ...Typography.footnote, fontWeight: "500" },
  summaryRowValue: { ...Typography.subhead, fontWeight: "600" },
  summaryBlock: { marginTop: Spacing.md },
  summaryBlockLabel: {
    ...Typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryBlockText: { ...Typography.subhead, lineHeight: 20 },
  summaryAddonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  summaryTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryTotalLabel: { ...Typography.body, fontWeight: "700" },
  summaryTotalValue: { fontSize: 22, fontWeight: "800" },

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
  ctaPrimary: { marginTop: Spacing.lg },
  ctaSecondary: { marginTop: Spacing.sm },
});
