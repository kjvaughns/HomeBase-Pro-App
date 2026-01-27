import React, { useState, useMemo } from "react";
import { StyleSheet, View, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { ProviderCard } from "@/components/ProviderCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Provider } from "@/state/types";

type ScreenRouteProp = RouteProp<RootStackParamList, "ProviderList">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type SortOption = "rating" | "price_low" | "price_high" | "distance";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "rating", label: "Top Rated" },
  { value: "distance", label: "Nearest" },
  { value: "price_low", label: "Price: Low" },
  { value: "price_high", label: "Price: High" },
];

export default function ProviderListScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { categoryId } = route.params;

  const allProviders = useHomeownerStore((s) => s.providers);
  
  const categoryProviders = useMemo(() => {
    return allProviders.filter((p) => p.categoryIds.includes(categoryId));
  }, [allProviders, categoryId]);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("rating");
  const [showFilters, setShowFilters] = useState(false);

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
  }, [categoryProviders, searchQuery, sortBy]);

  const handleProviderPress = (provider: Provider) => {
    navigation.navigate("ProviderProfile", { providerId: provider.id });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TextField
        placeholder="Search providers..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        leftIcon="search"
        rightIcon={searchQuery ? "x" : undefined}
        onRightIconPress={() => setSearchQuery("")}
      />

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setSortBy(option.value)}
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

      <ThemedText style={[styles.resultCount, { color: theme.textSecondary }]}>
        {filteredProviders.length} provider{filteredProviders.length !== 1 ? "s" : ""} found
      </ThemedText>
    </View>
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
  resultCount: {
    ...Typography.caption1,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    ...Typography.headline,
    marginTop: Spacing.md,
  },
  emptyText: {
    ...Typography.subhead,
    marginTop: Spacing.xs,
  },
});
