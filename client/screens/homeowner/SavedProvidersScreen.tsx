import React, { useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SavedProviderDisplay {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  serviceArea: string;
  startingPrice: number | null;
  avatarUrl?: string;
  tags: string[];
  savedAt: string;
}

const MOCK_SAVED_PROVIDERS: SavedProviderDisplay[] = [
  { id: "p-1", name: "Bay Area HVAC Pros", category: "HVAC", rating: 4.9, reviewCount: 127, serviceArea: "San Francisco Bay Area", startingPrice: 125, tags: ["Vetted", "Fast Response", "Top Rated"], savedAt: "2026-01-15" },
  { id: "p-2", name: "Quick Fix Plumbing", category: "Plumbing", rating: 4.7, reviewCount: 89, serviceArea: "San Francisco", startingPrice: 85, tags: ["Vetted", "24/7 Available"], savedAt: "2026-01-10" },
  { id: "p-3", name: "CleanPro Services", category: "Cleaning", rating: 4.8, reviewCount: 203, serviceArea: "SF Bay Area", startingPrice: 75, tags: ["Popular", "Eco-Friendly"], savedAt: "2025-12-20" },
  { id: "p-4", name: "Volt Electric", category: "Electrical", rating: 4.9, reviewCount: 156, serviceArea: "Bay Area", startingPrice: 150, tags: ["Licensed", "Insured", "Top Rated"], savedAt: "2025-12-15" },
];

type SortOption = "recent" | "rating" | "booked" | "closest";

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "recent", label: "Recently Saved" },
  { id: "rating", label: "Highest Rated" },
  { id: "booked", label: "Most Booked" },
  { id: "closest", label: "Closest" },
];

export default function SavedProvidersScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { toggleSavedProvider } = useHomeownerStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [providers, setProviders] = useState(MOCK_SAVED_PROVIDERS);

  const filteredProviders = providers
    .filter((p) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "recent") return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
      return 0;
    });

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
  };

  const handleRemoveProvider = (providerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProviders(providers.filter((p) => p.id !== providerId));
    toggleSavedProvider(providerId);
  };

  const handleBookProvider = (providerId: string, providerName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("SmartIntake", { preselectedProviderId: providerId, preselectedProviderName: providerName });
  };

  const handleMessageProvider = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleViewProfile = (providerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("ProviderProfile", { providerId });
  };

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderProviderCard = ({ item, index }: { item: SavedProviderDisplay; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <GlassCard style={styles.providerCard}>
        <Pressable style={styles.providerContent} onPress={() => handleViewProfile(item.id)}>
          <Avatar size="large" name={item.name} uri={item.avatarUrl} />
          <View style={styles.providerInfo}>
            <ThemedText style={styles.providerName}>{item.name}</ThemedText>
            <ThemedText style={[styles.providerCategory, { color: theme.textSecondary }]}>{item.category}</ThemedText>
            <View style={styles.ratingRow}>
              <Feather name="star" size={14} color={Colors.warning} />
              <ThemedText style={styles.ratingText}>{item.rating}</ThemedText>
              <ThemedText style={[styles.reviewCount, { color: theme.textSecondary }]}>
                ({item.reviewCount} reviews)
              </ThemedText>
            </View>
            <ThemedText style={[styles.serviceArea, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.serviceArea}
            </ThemedText>
          </View>
          <View style={styles.priceColumn}>
            {item.startingPrice ? (
              <>
                <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>From</ThemedText>
                <ThemedText style={styles.priceValue}>${item.startingPrice}</ThemedText>
              </>
            ) : (
              <View style={[styles.quoteBadge, { backgroundColor: Colors.accentLight }]}>
                <ThemedText style={[styles.quoteBadgeText, { color: Colors.accent }]}>Quote</ThemedText>
              </View>
            )}
          </View>
        </Pressable>

        <View style={styles.tagsRow}>
          {item.tags.map((tag) => (
            <View key={tag} style={[styles.tagChip, { backgroundColor: Colors.accentLight }]}>
              <ThemedText style={[styles.tagText, { color: Colors.accent }]}>{tag}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={[styles.actionBtn, { backgroundColor: Colors.accent }]} onPress={() => handleBookProvider(item.id, item.name)}>
            <Feather name="calendar" size={16} color="#FFF" />
            <ThemedText style={styles.actionBtnText}>Book</ThemedText>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]} onPress={handleMessageProvider}>
            <Feather name="message-circle" size={16} color={theme.text} />
            <ThemedText style={[styles.actionBtnText, { color: theme.text }]}>Message</ThemedText>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]} onPress={() => handleRemoveProvider(item.id)}>
            <Feather name="x" size={16} color={Colors.error} />
            <ThemedText style={[styles.actionBtnText, { color: Colors.error }]}>Remove</ThemedText>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={handleShare}>
            <Feather name="share" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundElevated }]}>
        <Feather name="heart" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText style={styles.emptyTitle}>No saved providers yet</ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        Save your favorite pros for one-tap booking
      </ThemedText>
      <Pressable
        style={[styles.browseButton, { backgroundColor: Colors.accent }]}
        onPress={() => navigation.goBack()}
      >
        <ThemedText style={styles.browseButtonText}>Browse Providers</ThemedText>
      </Pressable>
    </View>
  );

  const ListHeader = () => (
    <View style={styles.listHeader}>
      <View style={[styles.searchContainer, { backgroundColor: theme.cardBackground }]}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search saved providers..."
          placeholderTextColor={theme.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.sortRow}>
        <ThemedText style={[styles.resultsCount, { color: theme.textSecondary }]}>
          {filteredProviders.length} provider{filteredProviders.length !== 1 ? "s" : ""}
        </ThemedText>
        <Pressable style={styles.sortButton} onPress={() => setShowSortMenu(!showSortMenu)}>
          <Feather name="sliders" size={16} color={theme.textSecondary} />
          <ThemedText style={[styles.sortButtonText, { color: theme.textSecondary }]}>
            {SORT_OPTIONS.find((o) => o.id === sortBy)?.label}
          </ThemedText>
          <Feather name="chevron-down" size={16} color={theme.textSecondary} />
        </Pressable>
      </View>

      {showSortMenu ? (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.sortMenu, { backgroundColor: theme.cardBackground }]}>
          {SORT_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              style={[styles.sortOption, sortBy === option.id && { backgroundColor: Colors.accentLight }]}
              onPress={() => { setSortBy(option.id); setShowSortMenu(false); Haptics.selectionAsync(); }}
            >
              <ThemedText style={[styles.sortOptionText, sortBy === option.id && { color: Colors.accent }]}>{option.label}</ThemedText>
              {sortBy === option.id ? <Feather name="check" size={16} color={Colors.accent} /> : null}
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredProviders}
        keyExtractor={(item) => item.id}
        renderItem={renderProviderCard}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.list,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: Spacing.screenPadding, flexGrow: 1 },
  listHeader: { marginBottom: Spacing.lg },
  searchContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, gap: Spacing.sm, marginBottom: Spacing.md },
  searchInput: { flex: 1, ...Typography.body, paddingVertical: Spacing.xs },
  sortRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultsCount: { ...Typography.caption1 },
  sortButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  sortButtonText: { ...Typography.caption1 },
  sortMenu: { position: "absolute", top: 90, right: 0, zIndex: 10, borderRadius: BorderRadius.md, padding: Spacing.xs, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  sortOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, minWidth: 160 },
  sortOptionText: { ...Typography.subhead },
  providerCard: { marginBottom: Spacing.md },
  providerContent: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md, marginBottom: Spacing.md },
  providerInfo: { flex: 1 },
  providerName: { ...Typography.headline, marginBottom: 2 },
  providerCategory: { ...Typography.caption1, marginBottom: 4 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  ratingText: { ...Typography.caption1, fontWeight: "600" },
  reviewCount: { ...Typography.caption2 },
  serviceArea: { ...Typography.caption2 },
  priceColumn: { alignItems: "flex-end" },
  priceLabel: { ...Typography.caption2 },
  priceValue: { ...Typography.title3, fontWeight: "700" },
  quoteBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.xs },
  quoteBadgeText: { ...Typography.caption1, fontWeight: "500" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.md },
  tagChip: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.xs },
  tagText: { ...Typography.caption2, fontWeight: "500" },
  actionsRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "center" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, gap: 6 },
  actionBtnText: { ...Typography.caption1, fontWeight: "600", color: "#FFF" },
  iconBtn: { padding: Spacing.sm },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl, paddingTop: Spacing["2xl"] * 2 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg },
  emptyTitle: { ...Typography.title2, marginBottom: Spacing.xs, textAlign: "center" },
  emptyText: { ...Typography.body, textAlign: "center", marginBottom: Spacing.xl, lineHeight: 22 },
  browseButton: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  browseButtonText: { ...Typography.subhead, fontWeight: "600", color: "#FFF" },
});
