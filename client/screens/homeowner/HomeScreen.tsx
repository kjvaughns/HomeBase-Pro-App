import React, { useMemo, useState } from "react";
import { StyleSheet, View, ScrollView, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import { Avatar } from "@/components/Avatar";
import { StatusPill } from "@/components/StatusPill";
import { CategoryCard } from "@/components/CategoryCard";
import { ProviderCard } from "@/components/ProviderCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Job, JobStatus, ServiceCategory } from "@/state/types";

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

const STATUS_MAP: Record<JobStatus, { label: string; status: "success" | "info" | "warning" | "neutral" | "pending" | "scheduled" | "inProgress" | "completed" }> = {
  requested: { label: "Requested", status: "info" },
  scheduled: { label: "Scheduled", status: "scheduled" },
  in_progress: { label: "In Progress", status: "inProgress" },
  awaiting_payment: { label: "Payment Due", status: "warning" },
  completed: { label: "Completed", status: "completed" },
  paid: { label: "Paid", status: "success" },
  closed: { label: "Closed", status: "neutral" },
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const { user } = useAuthStore();
  
  const jobs = useHomeownerStore((s) => s.jobs);
  const categories = useHomeownerStore((s) => s.categories);
  const providers = useHomeownerStore((s) => s.providers);

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

    return result.slice(0, 3);
  }, [providers, filters]);

  const upcomingJobs = useMemo(() => 
    jobs.filter((j) => j.status === "scheduled" || j.status === "requested"), 
    [jobs]
  );
  
  const activeJobs = useMemo(() => 
    jobs.filter((j) => j.status === "in_progress" || j.status === "awaiting_payment"), 
    [jobs]
  );
  
  const recentJobs = useMemo(() => jobs.slice(0, 3), [jobs]);

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

  const handleJobPress = (job: Job) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("JobDetail", { jobId: job.id });
  };

  const handleViewAllJobs = () => {
    navigation.getParent()?.navigate("ManageTab");
  };

  const handleAIPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("AIChat");
  };

  const handleCategoryPress = (category: ServiceCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("ProviderList", {
      categoryId: category.id,
      categoryName: category.name,
    });
  };

  const handleProviderPress = (providerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("ProviderProfile", { providerId });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.greeting}>
            <View>
              <ThemedText style={styles.welcomeText}>Welcome back,</ThemedText>
              <ThemedText style={styles.userName}>{user?.name?.split(" ")[0] || "Homeowner"}</ThemedText>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Pressable onPress={handleAIPress} testID="ask-homebase-ai-card">
            <GlassCard style={styles.aiCard}>
              <View style={styles.aiCardContent}>
                <View style={[styles.aiIconContainer, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="message-circle" size={24} color={Colors.accent} />
                </View>
                <View style={styles.aiTextContainer}>
                  <ThemedText style={styles.aiTitle}>Ask HomeBase AI</ThemedText>
                  <ThemedText style={[styles.aiSubtitle, { color: theme.textSecondary }]}>
                    Get instant answers or find the right pro for your project
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textTertiary} />
              </View>
            </GlassCard>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <View style={styles.statsRow}>
            <Pressable onPress={handleViewAllJobs} style={styles.statCard}>
              <StatCard
                title="Upcoming"
                value={upcomingJobs.length.toString()}
                icon="calendar"
              />
            </Pressable>
            <Pressable onPress={handleViewAllJobs} style={styles.statCard}>
              <StatCard
                title="Active"
                value={activeJobs.length.toString()}
                icon="clock"
              />
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
            <Pressable onPress={handleViewAllJobs}>
              <ThemedText style={[styles.viewAll, { color: Colors.accent }]}>View All</ThemedText>
            </Pressable>
          </View>

          {recentJobs.length > 0 ? (
            recentJobs.map((job) => {
              const statusInfo = STATUS_MAP[job.status];
              return (
                <GlassCard
                  key={job.id}
                  style={styles.jobCard}
                  onPress={() => handleJobPress(job)}
                >
                  <View style={styles.jobHeader}>
                    <Avatar name={job.providerName} size="small" uri={job.providerAvatar} />
                    <View style={styles.jobInfo}>
                      <ThemedText style={styles.jobService} numberOfLines={1}>
                        {job.service}
                      </ThemedText>
                      <ThemedText style={[styles.jobProvider, { color: theme.textSecondary }]} numberOfLines={1}>
                        {job.providerBusinessName || job.providerName}
                      </ThemedText>
                    </View>
                    <StatusPill label={statusInfo.label} status={statusInfo.status} />
                  </View>
                  <View style={styles.jobFooter}>
                    <View style={styles.jobMeta}>
                      <Feather name="calendar" size={14} color={theme.textTertiary} />
                      <ThemedText style={[styles.jobDate, { color: theme.textTertiary }]}>
                        {formatDate(job.scheduledDate)}
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={18} color={theme.textTertiary} />
                  </View>
                </GlassCard>
              );
            })
          ) : (
            <GlassCard style={styles.emptyCard}>
              <Feather name="clipboard" size={32} color={theme.textTertiary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No recent activity
              </ThemedText>
              <ThemedText style={[styles.emptySubtext, { color: theme.textTertiary }]}>
                Book a service to get started
              </ThemedText>
            </GlassCard>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Quick Search</ThemedText>
            <Pressable onPress={() => navigation.getParent()?.navigate("FindTab")}>
              <ThemedText style={[styles.viewAll, { color: Colors.accent }]}>See All</ThemedText>
            </Pressable>
          </View>

          <View style={styles.categoriesGrid}>
            {categories.slice(0, 6).map((category) => (
              <View key={category.id} style={styles.categoryItem}>
                <CategoryCard
                  name={category.name}
                  icon={category.icon as any}
                  onPress={() => handleCategoryPress(category)}
                  compact
                />
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(450).duration(400)}>
          <View style={styles.featuredHeader}>
            <ThemedText style={styles.sectionTitle}>Featured Pros</ThemedText>
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
                size={16}
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

          {activeFilterCount > 0 ? (
            <View style={styles.activeFiltersRow}>
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
            </View>
          ) : null}

          {featuredProviders.map((provider) => (
            <View key={provider.id} style={styles.providerCardWrapper}>
              <ProviderCard
                name={provider.name}
                businessName={provider.businessName}
                avatarUrl={provider.avatarUrl}
                rating={provider.rating}
                reviewCount={provider.reviewCount}
                services={provider.services}
                hourlyRate={provider.hourlyRate}
                verified={provider.verified}
                onPress={() => handleProviderPress(provider.id)}
                testID={`provider-${provider.id}`}
              />
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Home Tools</ThemedText>
          </View>

          <View style={styles.quickActions}>
            <Pressable
              style={[styles.quickAction, { backgroundColor: theme.cardBackground }]}
              onPress={() => navigation.navigate("SurvivalKit")}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="shield" size={20} color={Colors.accent} />
              </View>
              <ThemedText style={styles.quickActionText}>Survival Kit</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.quickAction, { backgroundColor: theme.cardBackground }]}
              onPress={() => navigation.navigate("HealthScore")}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="activity" size={20} color={Colors.accent} />
              </View>
              <ThemedText style={styles.quickActionText}>Health Score</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.quickAction, { backgroundColor: theme.cardBackground }]}
              onPress={() => navigation.navigate("ServiceHistory")}
              testID="quick-action-service-history"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="clock" size={20} color={Colors.accent} />
              </View>
              <ThemedText style={styles.quickActionText}>Service History</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.quickAction, { backgroundColor: theme.cardBackground }]}
              onPress={() => navigation.navigate("HouseFax")}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="file-text" size={20} color={Colors.accent} />
              </View>
              <ThemedText style={styles.quickActionText}>HouseFax</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  greeting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  welcomeText: {
    ...Typography.subhead,
    opacity: 0.7,
  },
  userName: {
    ...Typography.largeTitle,
  },
  aiCard: {
    marginBottom: Spacing.lg,
  },
  aiCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  aiTextContainer: {
    flex: 1,
  },
  aiTitle: {
    ...Typography.headline,
    marginBottom: 2,
  },
  aiSubtitle: {
    ...Typography.subhead,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.title3,
  },
  viewAll: {
    ...Typography.subhead,
  },
  jobCard: {
    marginBottom: Spacing.sm,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  jobInfo: {
    flex: 1,
  },
  jobService: {
    ...Typography.headline,
  },
  jobProvider: {
    ...Typography.subhead,
    marginTop: 2,
  },
  jobFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  jobMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  jobDate: {
    ...Typography.caption1,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    ...Typography.headline,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    ...Typography.subhead,
    marginTop: Spacing.xs,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  categoryItem: {
    width: "31%",
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  quickAction: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: {
    ...Typography.subhead,
    flex: 1,
  },
  featuredHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  filterButton: {
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
  providerCardWrapper: {
    marginBottom: Spacing.sm,
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
});
