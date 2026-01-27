import React, { useState, useMemo } from "react";
import { StyleSheet, FlatList, RefreshControl, View, TextInput, Pressable, ActivityIndicator, Modal, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type SortOption = "newest" | "oldest" | "alphabetical";

interface Filters {
  sortBy: SortOption;
  hasPhone: boolean;
  hasEmail: boolean;
}

const DEFAULT_FILTERS: Filters = {
  sortBy: "newest",
  hasPhone: false,
  hasEmail: false,
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "alphabetical", label: "A to Z" },
];

interface Client {
  id: string;
  providerId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface ClientCardProps {
  client: Client;
  onPress: () => void;
}

function ClientCard({ client, onPress }: ClientCardProps) {
  const { theme } = useTheme();

  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.clientCard}>
        <View style={styles.clientRow}>
          <View style={[styles.avatar, { backgroundColor: Colors.accent + "20" }]}>
            <ThemedText type="body" style={{ color: Colors.accent, fontWeight: "600" }}>
              {getInitials(client.firstName, client.lastName)}
            </ThemedText>
          </View>
          <View style={styles.clientInfo}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {client.firstName} {client.lastName}
            </ThemedText>
            {client.phone ? (
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {client.phone}
              </ThemedText>
            ) : client.email ? (
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {client.email}
              </ThemedText>
            ) : null}
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Added {formatDate(client.createdAt)}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

export default function ClientsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { providerProfile } = useAuthStore();

  const providerId = providerProfile?.id;

  const { data: clientsData, isLoading, refetch } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tempFilters, setTempFilters] = useState<Filters>(DEFAULT_FILTERS);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sortBy !== "newest") count++;
    if (filters.hasPhone) count++;
    if (filters.hasEmail) count++;
    return count;
  }, [filters]);

  const clients = clientsData?.clients || [];

  const filteredClients = useMemo(() => {
    let result = [...clients];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(query) ||
          (c.email && c.email.toLowerCase().includes(query)) ||
          (c.phone && c.phone.includes(query))
      );
    }

    if (filters.hasPhone) {
      result = result.filter((c) => !!c.phone);
    }

    if (filters.hasEmail) {
      result = result.filter((c) => !!c.email);
    }

    switch (filters.sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "alphabetical":
        result.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
        break;
    }

    return result;
  }, [clients, searchQuery, filters]);

  const totalCount = clients.length;

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

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleClientPress = (client: Client) => {
    navigation.navigate("ClientDetail", { clientId: client.id });
  };

  const handleAddClient = () => {
    navigation.navigate("AddClient" as any);
  };

  const renderActiveFilters = () => {
    const chips: { key: keyof Filters; label: string }[] = [];

    if (filters.sortBy !== "newest") {
      const label = filters.sortBy === "oldest" ? "Oldest First" : "A-Z";
      chips.push({ key: "sortBy", label });
    }
    if (filters.hasPhone) {
      chips.push({ key: "hasPhone", label: "Has Phone" });
    }
    if (filters.hasEmail) {
      chips.push({ key: "hasEmail", label: "Has Email" });
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
    <View style={styles.headerContainer}>
      <View style={styles.titleRow}>
        <View>
          <ThemedText type="h1">Clients</ThemedText>
          <ThemedText type="body" style={{ color: Colors.accent }}>
            {totalCount} Total
          </ThemedText>
        </View>
        <View style={styles.titleButtons}>
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
              size={18}
              color={activeFilterCount > 0 ? "#fff" : theme.text}
            />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <ThemedText style={styles.filterBadgeText}>{activeFilterCount}</ThemedText>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            style={[styles.addButton, { backgroundColor: Colors.accent }]}
            onPress={handleAddClient}
          >
            <Feather name="plus" size={20} color="white" />
          </Pressable>
        </View>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: theme.cardBackground }]}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search clients..."
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

      {renderActiveFilters()}
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
              <ThemedText style={styles.filterLabel}>Contact Info</ThemedText>
              <View style={styles.optionsRow}>
                <Pressable
                  onPress={() => setTempFilters((prev) => ({ ...prev, hasPhone: !prev.hasPhone }))}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: tempFilters.hasPhone ? Colors.accent : theme.cardBackground,
                      borderColor: tempFilters.hasPhone ? Colors.accent : theme.borderLight,
                    },
                  ]}
                >
                  <Feather
                    name="phone"
                    size={14}
                    color={tempFilters.hasPhone ? "#fff" : theme.text}
                    style={{ marginRight: 4 }}
                  />
                  <ThemedText
                    style={[
                      styles.optionText,
                      { color: tempFilters.hasPhone ? "#fff" : theme.text },
                    ]}
                  >
                    Has Phone
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setTempFilters((prev) => ({ ...prev, hasEmail: !prev.hasEmail }))}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: tempFilters.hasEmail ? Colors.accent : theme.cardBackground,
                      borderColor: tempFilters.hasEmail ? Colors.accent : theme.borderLight,
                    },
                  ]}
                >
                  <Feather
                    name="mail"
                    size={14}
                    color={tempFilters.hasEmail ? "#fff" : theme.text}
                    style={{ marginRight: 4 }}
                  />
                  <ThemedText
                    style={[
                      styles.optionText,
                      { color: tempFilters.hasEmail ? "#fff" : theme.text },
                    ]}
                  >
                    Has Email
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

  const renderClient = ({ item, index }: { item: Client; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <ClientCard client={item} onPress={() => handleClientPress(item)} />
    </Animated.View>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      );
    }
    
    return (
      <EmptyState
        image={require("../../../assets/images/empty-leads.png")}
        title="No clients yet"
        description="Add your first client to start managing your business."
      />
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredClients}
        renderItem={renderClient}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
          filteredClients.length === 0 && styles.emptyContainer,
        ]}
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
      {renderFilterModal()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  titleButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  filterButton: {
    width: 40,
    height: 40,
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    padding: 0,
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
  clientCard: {
    marginHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.sm,
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  clientInfo: {
    flex: 1,
    gap: 2,
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
