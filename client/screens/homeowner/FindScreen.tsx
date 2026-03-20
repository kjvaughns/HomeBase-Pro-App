import React, { useState, useMemo } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable, Modal, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { CategoryCard } from "@/components/CategoryCard";
import { ProviderCard } from "@/components/ProviderCard";
import { SectionHeader } from "@/components/SectionHeader";
import { AccountGateModal } from "@/components/AccountGateModal";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useHomeownerStore } from "@/state/homeownerStore";
import { ServiceCategory } from "@/state/types";

type SortOption = "rating" | "price_low" | "price_high" | "reviews";

interface Filters {
  sortBy: SortOption;
  minRating: number;
  verifiedOnly: boolean;
}

const DEFAULT_FILTERS: Filters = {
  sortBy: "rating",
  minRating: 0,
  verifiedOnly: false,
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "rating", label: "Highest Rated" },
  { value: "reviews", label: "Most Reviews" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
];

const RATING_OPTIONS = [0, 3, 4, 4.5];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface HomeTool {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  screen: keyof RootStackParamList;
}

const HOME_TOOLS: HomeTool[] = [
  {
    id: "survival",
    name: "Survival Kit",
    description: "Emergency preparedness",
    icon: "shield",
    screen: "SurvivalKit",
  },
  {
    id: "health",
    name: "Health Score",
    description: "Home assessment",
    icon: "activity",
    screen: "HealthScore",
  },
  {
    id: "housefax",
    name: "HouseFax",
    description: "Property history",
    icon: "file-text",
    screen: "HouseFax",
  },
  {
    id: "budgeter",
    name: "Budgeter",
    description: "Maintenance budget",
    icon: "dollar-sign",
    screen: "Budgeter",
  },
];

export default function FindScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const { isAuthenticated } = useAuthStore();
  
  const categories = useHomeownerStore((s) => s.categories);
  const providers = useHomeownerStore((s) => s.providers);
  const getSavedProviders = useHomeownerStore((s) => s.getSavedProviders);
  
  const savedProviders = useMemo(() => {
    if (!isAuthenticated) return [];
    return getSavedProviders();
  }, [isAuthenticated, getSavedProviders]);

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showAccountGate, setShowAccountGate] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tempFilters, setTempFilters] = useState<Filters>(DEFAULT_FILTERS);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sortBy !== "rating") count++;
    if (filters.minRating > 0) count++;
    if (filters.verifiedOnly) count++;
    return count;
  }, [filters]);

  const featuredProviders = useMemo(() => {
    let result = [...providers];
    
    if (filters.minRating > 0) {
      result = result.filter((p) => p.rating >= filters.minRating);
    }

    if (filters.verifiedOnly) {
      result = result.filter((p) => p.verified);
    }

    switch (filters.sortBy) {
      case "rating":
        result.sort((a, b) => b.rating - a.rating);
        break;
      case "reviews":
        result.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      case "price_low":
        result.sort((a, b) => (a.hourlyRate || 0) - (b.hourlyRate || 0));
        break;
      case "price_high":
        result.sort((a, b) => (b.hourlyRate || 0) - (a.hourlyRate || 0));
        break;
    }

    return result.slice(0, 5);
  }, [providers, filters]);

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

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleCategoryPress = (category: ServiceCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("ProviderList", {
      categoryId: category.id,
      categoryName: category.name,
    });
  };

  const handleToolPress = (tool: HomeTool) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(tool.screen as any);
  };

  const handleSignIn = () => {
    setShowAccountGate(false);
    navigation.navigate("Login");
  };


  const handleSignUp = () => {
    setShowAccountGate(false);
    navigation.navigate("SignUp");
  };

  const handleProviderCardPress = (providerId: string) => {
    if (!isAuthenticated) {
      setShowAccountGate(true);
      return;
    }
    navigation.navigate("ProviderProfile", { providerId });
  };

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <Animated.View entering={FadeInDown.delay(50).duration(400)}>
        <TextField
          placeholder="Search services..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon="search"
          rightIcon={searchQuery ? "x" : undefined}
          onRightIconPress={() => setSearchQuery("")}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(150).duration(400)}
        style={styles.locationRow}
      >
        <Feather name="map-pin" size={16} color={Colors.accent} />
        <ThemedText style={styles.locationText}>
          San Francisco, CA
        </ThemedText>
        <Feather name="chevron-down" size={14} color={Colors.accent} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(175).duration(400)}>
        <Pressable
          style={[styles.aiCard, { backgroundColor: theme.cardBackground }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.navigate("AIChat");
          }}
          testID="ask-homebase-ai-card"
        >
          <View style={[styles.aiIconContainer, { backgroundColor: Colors.accentLight }]}>
            <Feather name="message-circle" size={24} color={Colors.accent} />
          </View>
          <View style={styles.aiCardContent}>
            <ThemedText style={styles.aiCardTitle}>Ask HomeBase AI</ThemedText>
            <ThemedText style={[styles.aiCardSubtitle, { color: theme.textSecondary }]}>
              Get instant answers or find the right pro
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>
      </Animated.View>

      {isAuthenticated && savedProviders.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(180).duration(400)}>
          <SectionHeader 
            title="Saved Providers" 
            actionLabel="See All" 
            onAction={() => navigation.navigate("SavedProviders")} 
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.savedProvidersRow}
          >
            {savedProviders.slice(0, 5).map((provider) => (
              <Pressable
                key={provider.id}
                style={[styles.savedProviderCard, { backgroundColor: theme.cardBackground }]}
                onPress={() => handleProviderCardPress(provider.id)}
              >
                <View style={[styles.savedProviderAvatar, { backgroundColor: Colors.accentLight }]}>
                  <ThemedText style={styles.savedProviderInitial}>
                    {provider.businessName.charAt(0)}
                  </ThemedText>
                </View>
                <ThemedText style={styles.savedProviderName} numberOfLines={1}>
                  {provider.businessName}
                </ThemedText>
                <View style={styles.savedProviderRating}>
                  <Feather name="star" size={12} color={Colors.warning} />
                  <ThemedText style={[styles.savedProviderRatingText, { color: theme.textSecondary }]}>
                    {provider.rating.toFixed(1)}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <SectionHeader title="Services" actionLabel="See All" onAction={() => {}} />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(250).duration(400)}
        style={styles.categoriesGrid}
      >
        {categories.slice(0, 6).map((category) => (
          <View key={category.id} style={styles.categoryItem}>
            <CategoryCard
              name={category.name}
              icon={category.icon as any}
              onPress={() => handleCategoryPress(category)}
              testID={`category-${category.id}`}
              compact
            />
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <View style={styles.featuredHeader}>
          <ThemedText style={styles.sectionTitle}>Featured Pros</ThemedText>
          <Pressable
            onPress={openFilterModal}
            style={[
              styles.filterButtonLarge,
              {
                backgroundColor: activeFilterCount > 0 ? Colors.accent : theme.cardBackground,
                borderColor: activeFilterCount > 0 ? Colors.accent : theme.borderLight,
              },
            ]}
            testID="filter-button"
          >
            <Feather
              name="sliders"
              size={18}
              color={activeFilterCount > 0 ? "#fff" : theme.text}
            />
            <ThemedText
              style={[
                styles.filterButtonText,
                { color: activeFilterCount > 0 ? "#fff" : theme.text },
              ]}
            >
              {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filter"}
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>

      {activeFilterCount > 0 ? (
        <Animated.View entering={FadeInDown.delay(320).duration(400)} style={styles.activeFiltersRow}>
          {filters.sortBy !== "rating" ? (
            <Pressable
              onPress={() => clearFilter("sortBy")}
              style={[styles.activeFilterChip, { backgroundColor: Colors.accentLight }]}
            >
              <ThemedText style={[styles.activeFilterText, { color: Colors.accent }]}>
                {SORT_OPTIONS.find((o) => o.value === filters.sortBy)?.label}
              </ThemedText>
              <Feather name="x" size={14} color={Colors.accent} />
            </Pressable>
          ) : null}
          {filters.minRating > 0 ? (
            <Pressable
              onPress={() => clearFilter("minRating")}
              style={[styles.activeFilterChip, { backgroundColor: Colors.accentLight }]}
            >
              <ThemedText style={[styles.activeFilterText, { color: Colors.accent }]}>
                {filters.minRating}+ Stars
              </ThemedText>
              <Feather name="x" size={14} color={Colors.accent} />
            </Pressable>
          ) : null}
          {filters.verifiedOnly ? (
            <Pressable
              onPress={() => clearFilter("verifiedOnly")}
              style={[styles.activeFilterChip, { backgroundColor: Colors.accentLight }]}
            >
              <ThemedText style={[styles.activeFilterText, { color: Colors.accent }]}>
                Verified Only
              </ThemedText>
              <Feather name="x" size={14} color={Colors.accent} />
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
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
            <ThemedText style={styles.modalTitle}>Filter Providers</ThemedText>
            <Pressable onPress={() => setShowFilterModal(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            <View style={styles.filterSection}>
              <ThemedText style={styles.filterLabel}>Sort By</ThemedText>
              <View style={styles.optionsRow}>
                {SORT_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setTempFilters((prev) => ({ ...prev, sortBy: option.value }))}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor:
                          tempFilters.sortBy === option.value ? Colors.accent : theme.cardBackground,
                        borderColor:
                          tempFilters.sortBy === option.value ? Colors.accent : theme.borderLight,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.optionText,
                        { color: tempFilters.sortBy === option.value ? "#fff" : theme.text },
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

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
                      <Feather
                        name="star"
                        size={14}
                        color={tempFilters.minRating === rating ? "#fff" : theme.text}
                        style={{ marginRight: 4 }}
                      />
                    ) : null}
                    <ThemedText
                      style={[
                        styles.optionText,
                        { color: tempFilters.minRating === rating ? "#fff" : theme.text },
                      ]}
                    >
                      {rating === 0 ? "Any" : `${rating}+`}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <ThemedText style={styles.filterLabel}>Verification</ThemedText>
              <View style={styles.optionsRow}>
                <Pressable
                  onPress={() => setTempFilters((prev) => ({ ...prev, verifiedOnly: !prev.verifiedOnly }))}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: tempFilters.verifiedOnly ? Colors.accent : theme.cardBackground,
                      borderColor: tempFilters.verifiedOnly ? Colors.accent : theme.borderLight,
                    },
                  ]}
                >
                  <Feather
                    name="check-circle"
                    size={14}
                    color={tempFilters.verifiedOnly ? "#fff" : theme.text}
                    style={{ marginRight: 4 }}
                  />
                  <ThemedText
                    style={[
                      styles.optionText,
                      { color: tempFilters.verifiedOnly ? "#fff" : theme.text },
                    ]}
                  >
                    Verified Pros Only
                  </ThemedText>
                </Pressable>
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

  const renderProvider = ({ item, index }: { item: typeof featuredProviders[0]; index: number }) => (
    <Animated.View entering={FadeInDown.delay(350 + index * 100).duration(400)}>
      <ProviderCard
        name={item.name}
        businessName={item.businessName}
        avatarUrl={item.avatarUrl}
        rating={item.rating}
        reviewCount={item.reviewCount}
        services={item.services}
        hourlyRate={item.hourlyRate}
        verified={item.verified}
        onPress={() => handleProviderCardPress(item.id)}
        testID={`provider-${item.id}`}
      />
    </Animated.View>
  );

  const renderFooter = () => (
    <View style={styles.footerContent}>
      {!isAuthenticated ? (
        <>
          <Animated.View entering={FadeInDown.delay(600).duration(400)}>
            <SectionHeader title="Homeowner Tools" />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(650).duration(400)}
            style={styles.toolsGrid}
          >
            {HOME_TOOLS.map((tool) => (
              <Pressable
                key={tool.id}
                onPress={() => handleToolPress(tool)}
                style={[styles.toolCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}
              >
                <View style={[styles.toolIconContainer, { backgroundColor: Colors.accentLight }]}>
                  <Feather name={tool.icon} size={20} color={Colors.accent} />
                </View>
                <ThemedText style={styles.toolName} numberOfLines={1}>{tool.name}</ThemedText>
                <ThemedText style={[styles.toolDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                  {tool.description}
                </ThemedText>
              </Pressable>
            ))}
          </Animated.View>
        </>
      ) : null}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={featuredProviders}
        renderItem={renderProvider}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      />

      <AccountGateModal
        visible={showAccountGate}
        onClose={() => setShowAccountGate(false)}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
      />
      {renderFilterModal()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContent: {
    marginBottom: Spacing.md,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  locationText: {
    ...Typography.subhead,
    color: Colors.accent,
    fontWeight: "500",
  },
  aiCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sectionGap,
    gap: Spacing.md,
  },
  aiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  aiCardContent: {
    flex: 1,
  },
  aiCardTitle: {
    ...Typography.headline,
    fontWeight: "600",
    marginBottom: Spacing.xxs,
  },
  aiCardSubtitle: {
    ...Typography.subhead,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.sectionGap,
  },
  categoryItem: {
    width: "48%",
  },
  footerContent: {
    marginTop: Spacing.lg,
  },
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  toolCard: {
    width: "48%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toolIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  toolName: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: 2,
  },
  toolDesc: {
    ...Typography.caption1,
  },
  featuredHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.title2,
    fontWeight: "700",
  },
  featuredActions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  filterButtonLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  filterButtonText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  activeFiltersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.md,
    maxHeight: "70%",
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
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  optionText: {
    ...Typography.subhead,
    fontWeight: "500",
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
  savedProvidersRow: {
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    paddingRight: Spacing.screenPadding,
  },
  savedProviderCard: {
    width: 100,
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  savedProviderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  savedProviderInitial: {
    ...Typography.title2,
    fontWeight: "700",
    color: Colors.accent,
  },
  savedProviderName: {
    ...Typography.caption1,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
  },
  savedProviderRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  savedProviderRatingText: {
    ...Typography.caption2,
  },
});
