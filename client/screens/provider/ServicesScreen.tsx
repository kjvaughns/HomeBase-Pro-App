import React, { useState, useMemo, type ComponentProps } from "react";
import {
  StyleSheet,
  FlatList,
  RefreshControl,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  Switch,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

type PricingType = "fixed" | "variable" | "service_call" | "quote";

interface ProviderService {
  id: string;
  providerId: string;
  name: string;
  category: string;
  description: string | null;
  pricingType: PricingType;
  basePrice: string | null;
  priceFrom: string | null;
  priceTo: string | null;
  priceTiersJson: string | null;
  duration: number | null;
  isPublished: boolean;
  intakeQuestionsJson: string | null;
  addOnsJson: string | null;
  bookingMode: string | null;
}

interface IntakeQuestion {
  id: string;
  question: string;
  type: "text" | "select" | "number";
  options: string[] | null;
  required: boolean;
}

interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CATEGORY_ICON_MAP: Record<string, FeatherIconName> = {
  cleaning: "home",
  hvac: "thermometer",
  plumbing: "droplet",
  electrical: "zap",
  landscaping: "sun",
  handyman: "tool",
  painting: "edit-3",
  roofing: "triangle",
  pest: "shield",
  "pest control": "shield",
  other: "more-horizontal",
};

function getCategoryIcon(category: string): FeatherIconName {
  const key = category.toLowerCase().trim();
  return CATEGORY_ICON_MAP[key] || "package";
}

function getPricingLabel(type: PricingType): string {
  switch (type) {
    case "fixed": return "FLAT";
    case "variable": return "VARIABLE";
    case "service_call": return "SERVICE CALL";
    case "quote": return "QUOTE";
  }
}

function getPricingColor(type: PricingType): string {
  switch (type) {
    case "fixed": return Colors.accent;
    case "variable": return "#FF9500";
    case "service_call": return "#5AC8FA";
    case "quote": return "#AF52DE";
  }
}

function getPriceDisplay(service: ProviderService): string {
  switch (service.pricingType) {
    case "fixed": return service.basePrice ? `$${parseFloat(service.basePrice).toFixed(0)}` : "TBD";
    case "variable": {
      if (service.priceTiersJson) {
        try {
          const tiers: Array<{ label: string; price: string }> = JSON.parse(service.priceTiersJson);
          if (tiers.length > 0) {
            const prices = tiers.map((t) => parseFloat(t.price)).filter((p) => !isNaN(p));
            if (prices.length > 1) {
              return `$${Math.min(...prices).toFixed(0)} – $${Math.max(...prices).toFixed(0)}`;
            } else if (prices.length === 1) {
              return `From $${prices[0].toFixed(0)}`;
            }
          }
        } catch {}
      }
      return (service.priceFrom && service.priceTo)
        ? `$${parseFloat(service.priceFrom).toFixed(0)} – $${parseFloat(service.priceTo).toFixed(0)}`
        : service.basePrice ? `From $${parseFloat(service.basePrice).toFixed(0)}` : "Tiered";
    }
    case "service_call": return service.basePrice ? `$${parseFloat(service.basePrice).toFixed(0)} + labor` : "Call for price";
    case "quote": return "Request Quote";
  }
}

function getDurationLabel(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return "1 hr";
  if (minutes % 60 === 0) return `${minutes / 60} hrs`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function ServicePreviewModal({
  service,
  visible,
  onClose,
}: {
  service: ProviderService | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  if (!service) return null;

  const intakeQuestions: IntakeQuestion[] = (() => {
    if (!service.intakeQuestionsJson) return [];
    try { const p = JSON.parse(service.intakeQuestionsJson); return Array.isArray(p) ? p : []; } catch { return []; }
  })();
  const addOns: AddOn[] = (() => {
    if (!service.addOnsJson) return [];
    try { const p = JSON.parse(service.addOnsJson); return Array.isArray(p) ? p : []; } catch { return []; }
  })();
  const isQuoteOnly = service.bookingMode === "quote_only";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[previewStyles.container, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[previewStyles.header, { paddingTop: insets.top + 12, borderBottomColor: theme.borderLight }]}>
          <View style={[previewStyles.bannerRow, { backgroundColor: Colors.accent + "15" }]}>
            <Feather name="eye" size={14} color={Colors.accent} />
            <ThemedText style={[previewStyles.bannerText, { color: Colors.accent }]}>Customer Preview</ThemedText>
          </View>
          <Pressable onPress={onClose} style={previewStyles.closeBtn}>
            <Feather name="x" size={22} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[previewStyles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          <GlassCard style={previewStyles.serviceCard}>
            <View style={previewStyles.serviceHeader}>
              <View style={[previewStyles.serviceIcon, { backgroundColor: Colors.accent + "18" }]}>
                <Feather name={CATEGORY_ICON_MAP[service.category.toLowerCase()] || "package"} size={24} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={previewStyles.serviceName}>{service.name}</ThemedText>
                <ThemedText style={[previewStyles.serviceCategory, { color: Colors.accent }]}>{service.category}</ThemedText>
              </View>
            </View>
            {service.description ? (
              <ThemedText style={[previewStyles.serviceDesc, { color: theme.textSecondary }]}>{service.description}</ThemedText>
            ) : null}
            <View style={[previewStyles.priceRow, { borderTopColor: theme.borderLight }]}>
              {isQuoteOnly ? (
                <View style={[previewStyles.quoteBadge, { backgroundColor: "#AF52DE18" }]}>
                  <Feather name="file-text" size={14} color="#AF52DE" />
                  <ThemedText style={[previewStyles.quoteBadgeText, { color: "#AF52DE" }]}>Request a Quote</ThemedText>
                </View>
              ) : (
                <ThemedText style={[previewStyles.priceValue, { color: Colors.accent }]}>{getPriceDisplay(service)}</ThemedText>
              )}
              {service.bookingMode ? (
                <View style={[previewStyles.modePill, { backgroundColor: Colors.accent + "15" }]}>
                  <ThemedText style={[previewStyles.modePillText, { color: Colors.accent }]}>
                    {service.bookingMode === "instant" ? "Instant Book" : service.bookingMode === "starts_at" ? "Starts At" : "Quote Only"}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </GlassCard>

          {intakeQuestions.length > 0 ? (
            <GlassCard style={previewStyles.sectionCard}>
              <ThemedText style={[previewStyles.sectionLabel, { color: theme.textSecondary }]}>BOOKING QUESTIONS</ThemedText>
              {intakeQuestions.map((q, i) => (
                <View key={q.id} style={[previewStyles.questionRow, { borderColor: theme.borderLight }]}>
                  <ThemedText style={[previewStyles.questionText, { color: theme.text }]}>
                    {i + 1}. {q.question}{q.required ? " *" : ""}
                  </ThemedText>
                  {q.options && q.options.length > 0 ? (
                    <View style={previewStyles.optionsRow}>
                      {q.options.map((opt) => (
                        <View key={opt} style={[previewStyles.optionChip, { backgroundColor: theme.backgroundElevated, borderColor: theme.borderLight }]}>
                          <ThemedText style={[previewStyles.optionText, { color: theme.textSecondary }]}>{opt}</ThemedText>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={[previewStyles.inputMock, { backgroundColor: theme.backgroundElevated, borderColor: theme.borderLight }]}>
                      <ThemedText style={{ color: theme.textTertiary, fontSize: 13 }}>Type your answer...</ThemedText>
                    </View>
                  )}
                </View>
              ))}
            </GlassCard>
          ) : null}

          {addOns.length > 0 ? (
            <GlassCard style={previewStyles.sectionCard}>
              <ThemedText style={[previewStyles.sectionLabel, { color: theme.textSecondary }]}>AVAILABLE ADD-ONS</ThemedText>
              {addOns.map((addon) => (
                <View key={addon.id} style={[previewStyles.addonRow, { borderColor: theme.borderLight }]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[previewStyles.addonName, { color: theme.text }]}>{addon.name}</ThemedText>
                    <ThemedText style={[previewStyles.addonDesc, { color: theme.textSecondary }]} numberOfLines={1}>{addon.description}</ThemedText>
                  </View>
                  <ThemedText style={[previewStyles.addonPrice, { color: Colors.accent }]}>+${addon.price}</ThemedText>
                </View>
              ))}
            </GlassCard>
          ) : null}

          <Pressable
            style={[previewStyles.ctaBtn, { backgroundColor: isQuoteOnly ? "#AF52DE" : Colors.accent }]}
            onPress={onClose}
          >
            <Feather name={isQuoteOnly ? "file-text" : "calendar"} size={18} color="#fff" />
            <ThemedText style={previewStyles.ctaBtnText}>
              {isQuoteOnly ? "Request a Quote" : "Book Now"}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const previewStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  bannerRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  bannerText: { fontSize: 12, fontWeight: "600" },
  closeBtn: { padding: 6 },
  content: { padding: 16, gap: 12 },
  serviceCard: { padding: 16, gap: 12 },
  serviceHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  serviceIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  serviceName: { fontSize: 18, fontWeight: "700" },
  serviceCategory: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  serviceDesc: { fontSize: 14, lineHeight: 20 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  priceValue: { fontSize: 22, fontWeight: "700" },
  quoteBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  quoteBadgeText: { fontSize: 13, fontWeight: "600" },
  modePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  modePillText: { fontSize: 11, fontWeight: "600" },
  sectionCard: { padding: 16, gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  questionRow: { gap: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  questionText: { fontSize: 14, fontWeight: "600" },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  optionChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  optionText: { fontSize: 12 },
  inputMock: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 2 },
  addonRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  addonName: { fontSize: 14, fontWeight: "600" },
  addonDesc: { fontSize: 12, marginTop: 2 },
  addonPrice: { fontSize: 14, fontWeight: "700" },
  ctaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14, marginTop: 4 },
  ctaBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});

interface ServiceCardProps {
  service: ProviderService;
  onPress: () => void;
  onTogglePublish: (published: boolean) => void;
  onPreview: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

function ServiceCard({ service, onPress, onTogglePublish, onPreview, onDelete, isDeleting }: ServiceCardProps) {
  const { theme } = useTheme();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const categoryIcon = getCategoryIcon(service.category);
  const pricingColor = getPricingColor(service.pricingType);
  const durationLabel = getDurationLabel(service.duration);

  const handleToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTogglePublish(value);
  };

  const handleDeleteTap = (e: any) => {
    e.stopPropagation?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirmingDelete(true);
  };

  const handleDeleteConfirm = (e: any) => {
    e.stopPropagation?.();
    setConfirmingDelete(false);
    onDelete();
  };

  const handleDeleteCancel = (e: any) => {
    e.stopPropagation?.();
    setConfirmingDelete(false);
  };

  return (
    <Pressable onPress={onPress} testID={`card-service-${service.id}`}>
      <GlassCard style={styles.serviceCard}>
        <View style={styles.serviceHeader}>
          <View style={[styles.serviceIconContainer, { backgroundColor: Colors.accent + "18" }]}>
            <Feather name={categoryIcon} size={20} color={Colors.accent} />
          </View>
          <View style={styles.serviceInfo}>
            <ThemedText type="body" style={styles.serviceName} numberOfLines={1}>
              {service.name}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 1 }}>
              {service.category}
            </ThemedText>
          </View>
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onPreview(); }}
            style={[styles.previewChip, { backgroundColor: Colors.accent + "12", borderColor: Colors.accent + "30" }]}
            testID={`button-preview-${service.id}`}
            hitSlop={8}
          >
            <Feather name="eye" size={12} color={Colors.accent} />
          </Pressable>
          <View style={[
            styles.statusPill,
            {
              backgroundColor: service.isPublished ? Colors.accent + "18" : theme.backgroundElevated,
              borderColor: service.isPublished ? Colors.accent + "50" : theme.borderLight,
            },
          ]}>
            <View style={[
              styles.statusDot,
              { backgroundColor: service.isPublished ? Colors.accent : theme.textTertiary },
            ]} />
            <ThemedText style={[
              styles.statusText,
              { color: service.isPublished ? Colors.accent : theme.textTertiary },
            ]}>
              {service.isPublished ? "Live" : "Draft"}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.serviceDivider, { backgroundColor: theme.borderLight }]} />

        {confirmingDelete ? (
          <View style={[styles.deleteConfirmRow, { backgroundColor: "#FF3B3010" }]}>
            <Feather name="alert-triangle" size={14} color="#FF3B30" />
            <ThemedText style={[styles.deleteConfirmText, { color: "#FF3B30" }]}>
              Remove this service?
            </ThemedText>
            <View style={styles.deleteConfirmBtns}>
              <Pressable
                onPress={handleDeleteCancel}
                style={[styles.deleteConfirmCancel, { borderColor: theme.borderLight }]}
                testID={`button-cancel-delete-${service.id}`}
              >
                <ThemedText style={[styles.deleteConfirmCancelText, { color: theme.textSecondary }]}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleDeleteConfirm}
                style={styles.deleteConfirmDelete}
                disabled={isDeleting}
                testID={`button-confirm-delete-${service.id}`}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.deleteConfirmDeleteText}>Delete</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.serviceFooter}>
            <View style={[styles.pricingBadge, { backgroundColor: pricingColor + "15", borderColor: pricingColor + "30" }]}>
              <ThemedText style={[styles.pricingLabel, { color: pricingColor }]}>
                {getPricingLabel(service.pricingType)}
              </ThemedText>
            </View>
            <ThemedText type="body" style={[styles.priceText, { color: theme.text }]}>
              {getPriceDisplay(service)}
            </ThemedText>
            <View style={styles.footerSpacer} />
            {durationLabel ? (
              <View style={[styles.durationChip, { backgroundColor: theme.backgroundElevated, borderColor: theme.borderLight }]}>
                <Feather name="clock" size={11} color={theme.textSecondary} />
                <ThemedText style={[styles.durationText, { color: theme.textSecondary }]}>
                  {durationLabel}
                </ThemedText>
              </View>
            ) : null}
            <Pressable
              onPress={handleDeleteTap}
              hitSlop={8}
              style={[styles.deleteIconBtn, { backgroundColor: theme.backgroundElevated }]}
              testID={`button-delete-${service.id}`}
            >
              <Feather name="trash-2" size={14} color={theme.textTertiary} />
            </Pressable>
            <Switch
              value={service.isPublished}
              onValueChange={handleToggle}
              trackColor={{ false: theme.borderLight, true: Colors.accent }}
              thumbColor="#fff"
              ios_backgroundColor={theme.borderLight}
            />
          </View>
        )}
      </GlassCard>
    </Pressable>
  );
}

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { providerProfile } = useAuthStore();
  const queryClient = useQueryClient();
  const providerId = providerProfile?.id;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [previewService, setPreviewService] = useState<ProviderService | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const { data, isLoading, isRefetching, refetch } = useQuery<{ services: ProviderService[] }>({
    queryKey: ["/api/provider", providerId, "custom-services"],
    enabled: !!providerId,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing; cleanup tracked in Task #107
  const services = data?.services || [];

  const categories = useMemo(() => {
    const cats = [...new Set(services.map((s) => s.category))];
    return ["All", ...cats];
  }, [services]);

  const filteredServices = useMemo(() => {
    let result = [...services];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.category.toLowerCase().includes(query) ||
          (s.description || "").toLowerCase().includes(query)
      );
    }
    if (selectedCategory !== "All") {
      result = result.filter((s) => s.category === selectedCategory);
    }
    return result;
  }, [services, searchQuery, selectedCategory]);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      const url = new URL(`/api/provider/${providerId}/custom-services/${id}`, getApiUrl());
      return apiRequest("PUT", url.toString(), { isPublished });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "custom-services"] });
    },
    onError: () => {
      Alert.alert("Error", "Failed to update service");
    },
  });

  const handleDeleteService = async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDeletingId(id);
    try {
      const url = new URL(`/api/provider/${providerId}/custom-services/${id}`, getApiUrl());
      await apiRequest("DELETE", url.toString());
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "custom-services"] });
    } catch {
      Alert.alert("Error", "Failed to delete service. Please try again.");
    }
    setDeletingId(null);
  };

  const handleServicePress = (service: ProviderService) => {
    navigation.navigate("ServiceSummary", { serviceId: service.id, service: service as unknown as Record<string, unknown> });
  };

  const handleAddService = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("NewService");
  };

  const handleTogglePublish = (serviceId: string, published: boolean) => {
    togglePublishMutation.mutate({ id: serviceId, isPublished: published });
  };

  const handleCategoryPress = (category: string) => {
    Haptics.selectionAsync();
    setSelectedCategory(category);
  };

  const handlePreviewService = (service: ProviderService) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPreviewService(service);
    setPreviewVisible(true);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.titleRow}>
        <ThemedText type="h1">Services</ThemedText>
        <Pressable
          style={[styles.addButton, { backgroundColor: Colors.accent }]}
          onPress={handleAddService}
          testID="button-add-service"
        >
          <Feather name="plus" size={22} color="white" />
        </Pressable>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: theme.cardBackground }]}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search services..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {categories.length > 1 ? (
        <View style={styles.categoriesRow}>
          {categories.map((category) => (
            <Pressable
              key={category}
              onPress={() => handleCategoryPress(category)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selectedCategory === category ? Colors.accent : theme.cardBackground,
                  borderColor: selectedCategory === category ? Colors.accent : theme.borderLight,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.categoryText,
                  { color: selectedCategory === category ? "#fff" : theme.text },
                ]}
              >
                {category}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  const renderService = ({ item, index }: { item: ProviderService; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <ServiceCard
        service={item}
        onPress={() => handleServicePress(item)}
        onTogglePublish={(published) => handleTogglePublish(item.id, published)}
        onPreview={() => handlePreviewService(item)}
        onDelete={() => handleDeleteService(item.id)}
        isDeleting={deletingId === item.id}
      />
    </Animated.View>
  );

  const renderEmpty = () => {
    if (isLoading || isRefetching) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      );
    }
    if (searchQuery.trim() || selectedCategory !== "All") {
      return (
        <View style={styles.noResultsContainer}>
          <View style={[styles.noResultsIcon, { backgroundColor: theme.backgroundElevated }]}>
            <Feather name="search" size={28} color={theme.textTertiary} />
          </View>
          <ThemedText type="h3" style={[styles.noResultsTitle, { color: theme.textSecondary }]}>
            No matching services
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textTertiary, textAlign: "center" }}>
            Try a different search or category filter.
          </ThemedText>
        </View>
      );
    }
    return (
      <GlassCard style={[styles.emptyCard, { borderStyle: "dashed", borderColor: Colors.accent + "40", borderWidth: 1.5 }]}>
        <View style={[styles.emptyIconCircle, { backgroundColor: Colors.accent + "15" }]}>
          <Feather name="package" size={32} color={Colors.accent} />
        </View>
        <ThemedText type="h3" style={{ fontWeight: "700", marginBottom: Spacing.xs, textAlign: "center" }}>
          No services yet
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", lineHeight: 22 }}>
          Add your first service to start receiving bookings. Each service you create will appear here.
        </ThemedText>
        <Pressable
          style={[styles.emptyAddBtn, { backgroundColor: Colors.accent }]}
          onPress={handleAddService}
          testID="button-empty-add-service"
        >
          <Feather name="plus" size={16} color="#fff" />
          <ThemedText style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
            Add Your First Service
          </ThemedText>
        </Pressable>
      </GlassCard>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredServices}
        renderItem={renderService}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + 100,
          },
          filteredServices.length === 0 && styles.emptyContainer,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.accent}
          />
        }
      />
      <ServicePreviewModal
        service={previewService}
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    paddingHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    padding: 0,
  },
  categoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  categoryText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  serviceCard: {
    marginHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  serviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  serviceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  serviceInfo: { flex: 1 },
  serviceName: { fontWeight: "700", marginBottom: 2 },
  previewChip: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...Typography.caption2,
    fontWeight: "600",
  },
  serviceDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
  },
  serviceFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  footerSpacer: { flex: 1 },
  pricingBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  pricingLabel: {
    ...Typography.caption2,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  priceText: { fontWeight: "600", fontSize: 15 },
  durationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  durationText: {
    ...Typography.caption2,
    fontWeight: "500",
  },
  deleteIconBtn: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteConfirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: 2,
  },
  deleteConfirmText: {
    flex: 1,
    ...Typography.caption,
    fontWeight: "600",
  },
  deleteConfirmBtns: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  deleteConfirmCancel: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  deleteConfirmCancelText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  deleteConfirmDelete: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: "#FF3B30",
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteConfirmDeleteText: {
    ...Typography.caption,
    fontWeight: "700",
    color: "#fff",
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.screenPadding,
  },
  loadingContainer: {
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  emptyCard: {
    marginHorizontal: Spacing.screenPadding,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.md,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  noResultsContainer: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  noResultsIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  noResultsTitle: {
    fontWeight: "600",
  },
});
