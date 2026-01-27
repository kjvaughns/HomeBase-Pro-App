import React, { useState } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { CategoryCard } from "@/components/CategoryCard";
import { ProviderCard } from "@/components/ProviderCard";
import { SectionHeader } from "@/components/SectionHeader";
import { AccountGateModal } from "@/components/AccountGateModal";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useHomeownerStore } from "@/state/homeownerStore";
import { ServiceCategory } from "@/state/types";

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
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { isAuthenticated } = useAuthStore();
  
  const categories = useHomeownerStore((s) => s.categories);
  const providers = useHomeownerStore((s) => s.providers);

  const featuredProviders = React.useMemo(() => providers.slice(0, 5), [providers]);

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showAccountGate, setShowAccountGate] = useState(false);

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
        entering={FadeInDown.delay(150).duration(400)}
        style={styles.locationRow}
      >
        <Feather name="map-pin" size={16} color={Colors.accent} />
        <ThemedText style={styles.locationText}>
          San Francisco, CA
        </ThemedText>
        <Feather name="chevron-down" size={14} color={Colors.accent} />
      </Animated.View>

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
        <SectionHeader
          title="Featured Pros"
          actionLabel="See All"
          onAction={() => {}}
        />
      </Animated.View>
    </View>
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
    marginBottom: Spacing.sectionGap,
  },
  locationText: {
    ...Typography.subhead,
    color: Colors.accent,
    fontWeight: "500",
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
});
