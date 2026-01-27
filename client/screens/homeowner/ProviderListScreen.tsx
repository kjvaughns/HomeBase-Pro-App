import React, { useState, useMemo } from "react";
import { StyleSheet, View, FlatList, Pressable, Modal, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { ProviderCard } from "@/components/ProviderCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Provider } from "@/state/types";

type ScreenRouteProp = RouteProp<RootStackParamList, "ProviderList">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type SortOption = "rating" | "price_low" | "price_high" | "distance";

interface Filters {
  minRating: number;
  maxPrice: number | null;
  maxDistance: number | null;
  verifiedOnly: boolean;
}

const DEFAULT_FILTERS: Filters = {
  minRating: 0,
  maxPrice: null,
  maxDistance: null,
  verifiedOnly: false,
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "rating", label: "Top Rated" },
  { value: "distance", label: "Nearest" },
  { value: "price_low", label: "Price: Low" },
  { value: "price_high", label: "Price: High" },
];

const RATING_OPTIONS = [0, 4, 4.5, 4.8];
const PRICE_OPTIONS = [null, 50, 75, 100];
const DISTANCE_OPTIONS = [null, 3, 5, 10];

export default function ProviderListScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const { categoryId } = route.params;

  const allProviders = useHomeownerStore((s) => s.providers);
  
  const categoryProviders = useMemo(() => {
    return allProviders.filter((p) => p.categoryIds.includes(categoryId));
  }, [allProviders, categoryId]);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("rating");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tempFilters, setTempFilters] = useState<Filters>(DEFAULT_FILTERS);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.minRating > 0) count++;
    if (filters.maxPrice !== null) count++;
    if (filters.maxDistance !== null) count++;
    if (filters.verifiedOnly) count++;
    return count;
  }, [filters]);

  const filteredProviders = useMemo(() => {
    let result = [...categoryProviders];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.businessName.toLowerCase().includes(query) ||
          p.services.some((s) => s.toLowerCase().includes(query))
      );
    }

    if (filters.minRating > 0) {
      result = result.filter((p) => p.rating >= filters.minRating);
    }

    if (filters.maxPrice !== null) {
      result = result.filter((p) => p.hourlyRate <= filters.maxPrice!);
    }

    if (filters.maxDistance !== null) {
      result = result.filter((p) => (p.distance || 0) <= filters.maxDistance!);
    }

    if (filters.verifiedOnly) {
      result = result.filter((p) => p.verified);
    }

    switch (sortBy) {
      case "rating":
        result.sort((a, b) => b.rating - a.rating);
        break;
      case "distance":
        result.sort((a, b) => (a.distance || 0) - (b.distance || 0));
        break;
      case "price_low":
        result.sort((a, b) => a.hourlyRate - b.hourlyRate);
        break;
      case "price_high":
        result.sort((a, b) => b.hourlyRate - a.hourlyRate);
        break;
    }

    return result;
  }, [categoryProviders, searchQuery, sortBy, filters]);

  const openFilterModal = () => {
    setTempFilters(filters);
    setShowFilterModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const applyFilters = () => {
    setFilters(tempFilters);
    setShowFilterModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const resetFilters = () => {
    setTempFilters(DEFAULT_FILTERS);
  };

  const clearFilter = (filterKey: keyof Filters) => {
    setFilters((prev) => ({
      ...prev,
      [filterKey]: DEFAULT_FILTERS[filterKey],
    }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleProviderPress = (provider: Provider) => {
    navigation.navigate("ProviderProfile", { providerId: provider.id });
  };

  const renderActiveFilters = () => {
    const chips: { key: keyof Filters; label: string }[] = [];
    
    if (filters.minRating > 0) {
      chips.push({ key: "minRating", label: `${filters.minRating}+ stars` });
    }
    if (filters.maxPrice !== null) {
      chips.push({ key: "maxPrice", label: `Under $${filters.maxPrice}/hr` });
    }
    if (filters.maxDistance !== null) {
      chips.push({ key: "maxDistance", label: `Within ${filters.maxDistance} mi` });
    }
    if (filters.verifiedOnly) {
      chips.push({ key: "verifiedOnly", label: "Verified only" });
    }

    if (chips.length === 0) return null;

    return (
      <View style={styles.activeFiltersRow}>
        {chips.map((chip) => (
          <Pressable
            key={chip.key}
            onPress={() => clearFilter(chip.key)}
            style={[styles.activeFilterChip, { backgroundColor: Colors.accentLight }]}
          >
            <ThemedText style={[styles.activeFilterText, { color: Colors.accent }]}>
              {chip.label}
            </ThemedText>
            <Feather name="x" size={14} color={Colors.accent} />
          </Pressable>
        ))}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <TextField
            placeholder="Search providers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon="search"
            rightIcon={searchQuery ? "x" : undefined}
            onRightIconPress={() => setSearchQuery("")}
          />
        </View>
        <Pressable
          onPress={openFilterModal}
          style={[
            styles.filterButton,
            {
              backgroundColor: activeFilterCount > 0 ? Colors.accent : theme.cardBackground,
              borderColor: activeFilterCount > 0 ? Colors.accent : theme.borderLight,
            },
          ]}
          testID="filter-button"
        >
          <Feather
            name="sliders"
            size={20}
            color={activeFilterCount > 0 ? "#fff" : theme.text}
          />
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <ThemedText style={styles.filterBadgeText}>{activeFilterCount}</ThemedText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              setSortBy(option.value);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.sortChip,
              {
                backgroundColor:
                  sortBy === option.value ? Colors.accent : theme.cardBackground,
                borderColor:
                  sortBy === option.value ? Colors.accent : theme.borderLight,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.sortChipText,
                { color: sortBy === option.value ? "#fff" : theme.text },
              ]}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {renderActiveFilters()}

      <ThemedText style={[styles.resultCount, { color: theme.textSecondary }]}>
        {filteredProviders.length} provider{filteredProviders.length !== 1 ? "s" : ""} found
      </ThemedText>
    </View>
  );

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalOverlay}>
        <BlurView
          intensity={isDark ? 40 : 60}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setShowFilterModal(false)}
        />
        <View
          style={[
            styles.modalContent,
            { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.md },
          ]}
        >
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Filters</ThemedText>
            <Pressable onPress={() => setShowFilterModal(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            <View style={styles.filterSection}>
              <ThemedText style={styles.filterLabel}>Minimum Rating</ThemedText>
              <View style={styles.optionsRow}>
                {RATING_OPTIONS.map((rating) => (
                  <Pressable
                    key={rating}
                    onPress={() => setTempFilters((prev) => ({ ...prev, minRating: rating }))}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor:
                          tempFilters.minRating === rating ? Colors.accent : theme.cardBackground,
                        borderColor:
                          tempFilters.minRating === rating ? Colors.accent : theme.borderLight,
                      },
                    ]}
                  >
                    {rating > 0 ? (
                      <View style={styles.ratingOption}>
                        <ThemedText
                          style={[
                            styles.optionText,
                            { color: tempFilters.minRating === rating ? "#fff" : theme.text },
                          ]}
                        >
                          {rating}+
                        </ThemedText>
                        <Feather
                          name="star"
                          size={12}
                          color={tempFilters.minRating === rating ? "#fff" : Colors.accent}
                        />
                      </View>
                    ) : (
                      <ThemedText
                        style={[
                          styles.optionText,
                          { color: tempFilters.minRating === rating ? "#fff" : theme.text },
                        ]}
                      >
                        Any
                      </ThemedText>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <ThemedText style={styles.filterLabel}>Maximum Price</ThemedText>
              <View style={styles.optionsRow}>
                {PRICE_OPTIONS.map((price) => (
                  <Pressable
                    key={price ?? "any"}
                    onPress={() => setTempFilters((prev) => ({ ...prev, maxPrice: price }))}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor:
                          tempFilters.maxPrice === price ? Colors.accent : theme.cardBackground,
                        borderColor:
                          tempFilters.maxPrice === price ? Colors.accent : theme.borderLight,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.optionText,
                        { color: tempFilters.maxPrice === price ? "#fff" : theme.text },
                      ]}
                    >
                      {price === null ? "Any" : `$${price}/hr`}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <ThemedText style={styles.filterLabel}>Maximum Distance</ThemedText>
              <View style={styles.optionsRow}>
                {DISTANCE_OPTIONS.map((distance) => (
                  <Pressable
                    key={distance ?? "any"}
                    onPress={() => setTempFilters((prev) => ({ ...prev, maxDistance: distance }))}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor:
                          tempFilters.maxDistance === distance ? Colors.accent : theme.cardBackground,
                        borderColor:
                          tempFilters.maxDistance === distance ? Colors.accent : theme.borderLight,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.optionText,
                        { color: tempFilters.maxDistance === distance ? "#fff" : theme.text },
                      ]}
                    >
                      {distance === null ? "Any" : `${distance} mi`}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <View style={styles.switchRow}>
                <View>
                  <ThemedText style={styles.filterLabel}>Verified Pros Only</ThemedText>
                  <ThemedText style={[styles.filterHint, { color: theme.textSecondary }]}>
                    Show only verified professionals
                  </ThemedText>
                </View>
                <Switch
                  value={tempFilters.verifiedOnly}
                  onValueChange={(value) =>
                    setTempFilters((prev) => ({ ...prev, verifiedOnly: value }))
                  }
                  trackColor={{ false: theme.borderLight, true: Colors.accentLight }}
                  thumbColor={tempFilters.verifiedOnly ? Colors.accent : theme.textTertiary}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable
              onPress={resetFilters}
              style={[styles.resetButton, { borderColor: theme.borderLight }]}
            >
              <ThemedText style={[styles.resetButtonText, { color: theme.text }]}>
                Reset
              </ThemedText>
            </Pressable>
            <View style={styles.applyButtonContainer}>
              <PrimaryButton onPress={applyFilters}>Apply Filters</PrimaryButton>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderProvider = ({ item, index }: { item: Provider; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <ProviderCard
        name={item.name}
        businessName={item.businessName}
        avatarUrl={item.avatarUrl}
        rating={item.rating}
        reviewCount={item.reviewCount}
        services={item.services}
        hourlyRate={item.hourlyRate}
        verified={item.verified}
        onPress={() => handleProviderPress(item)}
        testID={`provider-${item.id}`}
      />
    </Animated.View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="search" size={48} color={theme.textTertiary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
        No providers found
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textTertiary }]}>
        Try adjusting your search or filters
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredProviders}
        renderItem={renderProvider}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      />
      {renderFilterModal()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: Spacing.md,
  },
  searchRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  searchField: {
    flex: 1,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  filterBadgeText: {
    ...Typography.caption2,
    fontSize: 10,
    fontWeight: "700",
    color: Colors.accent,
  },
  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  sortChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  sortChipText: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  activeFiltersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  activeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  activeFilterText: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  resultCount: {
    ...Typography.caption1,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
  },
  emptyTitle: {
    ...Typography.headline,
    marginTop: Spacing.md,
  },
  emptyText: {
    ...Typography.subhead,
    marginTop: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.md,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.title2,
    fontWeight: "700",
  },
  modalScroll: {
    paddingHorizontal: Spacing.screenPadding,
  },
  filterSection: {
    marginBottom: Spacing.lg,
  },
  filterLabel: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  filterHint: {
    ...Typography.caption1,
    marginTop: 2,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  optionText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  ratingOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  resetButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  applyButtonContainer: {
    flex: 1,
  },
});
