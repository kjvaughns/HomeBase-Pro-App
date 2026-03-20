import React, { useState, useMemo } from "react";
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
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";

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
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function getPricingLabel(type: PricingType): string {
  switch (type) {
    case "fixed": return "FIXED";
    case "variable": return "VARIABLE";
    case "service_call": return "SERVICE CALL";
    case "quote": return "QUOTE";
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
        ? `$${parseFloat(service.priceFrom).toFixed(0)} - $${parseFloat(service.priceTo).toFixed(0)}`
        : service.basePrice ? `From $${parseFloat(service.basePrice).toFixed(0)}` : "Tiered";
    }
    case "service_call": return service.basePrice ? `$${parseFloat(service.basePrice).toFixed(0)} + hourly` : "Call for price";
    case "quote": return "Ask for Price";
  }
}

interface ServiceCardProps {
  service: ProviderService;
  onPress: () => void;
  onTogglePublish: (published: boolean) => void;
}

function ServiceCard({ service, onPress, onTogglePublish }: ServiceCardProps) {
  const { theme } = useTheme();

  const handleToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTogglePublish(value);
  };

  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.serviceCard}>
        <View style={styles.serviceHeader}>
          <View style={styles.serviceIconContainer}>
            <Feather name="star" size={18} color={Colors.accent} />
          </View>
          <View style={styles.serviceInfo}>
            <ThemedText type="body" style={styles.serviceName}>
              {service.name}
            </ThemedText>
            <ThemedText type="caption" style={{ color: Colors.accent }}>
              {service.category}
            </ThemedText>
          </View>
          <Switch
            value={service.isPublished}
            onValueChange={handleToggle}
            trackColor={{ false: theme.borderLight, true: Colors.accent }}
            thumbColor="#fff"
            ios_backgroundColor={theme.borderLight}
          />
        </View>
        <View style={styles.serviceFooter}>
          <View style={[styles.pricingBadge, { backgroundColor: theme.backgroundElevated }]}>
            <ThemedText style={[styles.pricingLabel, { color: theme.textSecondary }]}>
              {getPricingLabel(service.pricingType)}
            </ThemedText>
          </View>
          <ThemedText type="body" style={styles.priceText}>
            {getPriceDisplay(service)}
          </ThemedText>
        </View>
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

  const { data, isLoading, isRefetching, refetch } = useQuery<{ services: ProviderService[] }>({
    queryKey: ["/api/provider", providerId, "custom-services"],
    enabled: !!providerId,
  });

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

  const handleServicePress = (service: ProviderService) => {
    navigation.navigate("EditService", { serviceId: service.id, service: service as unknown as Record<string, unknown> });
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
    return (
      <EmptyState
        image={require("../../../assets/images/empty-leads.png")}
        title="No services yet"
        description="Add your first service to start getting bookings."
      />
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
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent + "15",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  serviceInfo: { flex: 1 },
  serviceName: { fontWeight: "600", marginBottom: 2 },
  serviceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pricingBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  pricingLabel: {
    ...Typography.caption2,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  priceText: { fontWeight: "600" },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.screenPadding,
  },
  loadingContainer: {
    padding: Spacing["2xl"],
    alignItems: "center",
  },
});
