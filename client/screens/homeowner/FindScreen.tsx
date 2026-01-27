import React, { useState } from "react";
import { StyleSheet, View, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { CategoryCard } from "@/components/CategoryCard";
import { ProviderCard } from "@/components/ProviderCard";
import { SectionHeader } from "@/components/SectionHeader";
import { AccountGateModal } from "@/components/AccountGateModal";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import {
  serviceCategories,
  featuredProviders,
  ServiceCategory,
} from "@/state/mockData";

export default function FindScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { isAuthenticated, login } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showAccountGate, setShowAccountGate] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleProviderPress = () => {
    if (!isAuthenticated) {
      setShowAccountGate(true);
    }
  };

  const handleCategoryPress = (category: ServiceCategory) => {
    // Navigate to category details
  };

  const handleMockSignIn = () => {
    login({
      id: "1",
      name: "Alex Johnson",
      email: "alex@example.com",
    });
    setShowAccountGate(false);
  };

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
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
        entering={FadeInDown.delay(200).duration(400)}
        style={styles.locationRow}
      >
        <Feather name="map-pin" size={16} color={Colors.accent} />
        <ThemedText type="label" style={{ color: Colors.accent }}>
          San Francisco, CA
        </ThemedText>
        <Feather name="chevron-down" size={16} color={Colors.accent} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <SectionHeader title="Services" actionLabel="See All" onAction={() => {}} />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(400).duration(400)}
        style={styles.categoriesGrid}
      >
        {serviceCategories.slice(0, 8).map((category, index) => (
          <View key={category.id} style={styles.categoryItem}>
            <CategoryCard
              name={category.name}
              icon={category.icon as any}
              onPress={() => handleCategoryPress(category)}
              testID={`category-${category.id}`}
            />
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(500).duration(400)}>
        <SectionHeader
          title="Featured Pros"
          actionLabel="See All"
          onAction={() => {}}
        />
      </Animated.View>
    </View>
  );

  const renderProvider = ({ item, index }: { item: typeof featuredProviders[0]; index: number }) => (
    <Animated.View entering={FadeInDown.delay(600 + index * 100).duration(400)}>
      <ProviderCard
        name={item.name}
        businessName={item.businessName}
        avatarUrl={item.avatarUrl}
        rating={item.rating}
        reviewCount={item.reviewCount}
        services={item.services}
        hourlyRate={item.hourlyRate}
        verified={item.verified}
        onPress={handleProviderPress}
        testID={`provider-${item.id}`}
      />
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={featuredProviders}
        renderItem={renderProvider}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
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
        onSignIn={handleMockSignIn}
        onSignUp={handleMockSignIn}
      />
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
    marginBottom: Spacing.xl,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  categoryItem: {
    width: "47%",
  },
});
