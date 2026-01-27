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
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  serviceCategories,
  featuredProviders,
  ServiceCategory,
} from "@/state/mockData";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface HomeTool {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  screen: keyof RootStackParamList;
}

interface RecentActivity {
  id: string;
  type: "booking" | "quote" | "message";
  title: string;
  provider: string;
  date: string;
  status: "completed" | "upcoming" | "pending";
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

const RECENT_ACTIVITY: RecentActivity[] = [
  {
    id: "1",
    type: "booking",
    title: "Plumbing Repair",
    provider: "Mike's Plumbing",
    date: "Jan 20, 2026",
    status: "completed",
  },
  {
    id: "2",
    type: "booking",
    title: "HVAC Maintenance",
    provider: "CoolAir Services",
    date: "Feb 5, 2026",
    status: "upcoming",
  },
  {
    id: "3",
    type: "quote",
    title: "Kitchen Remodel",
    provider: "HomeReno Pro",
    date: "Jan 25, 2026",
    status: "pending",
  },
];

export default function FindScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { isAuthenticated, user, login } = useAuthStore();

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

  const handleAIPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("AIChat");
  };

  const handleToolPress = (tool: HomeTool) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(tool.screen);
  };

  const handleMockSignIn = () => {
    login({
      id: "1",
      name: "Alex Johnson",
      email: "alex@example.com",
    });
    setShowAccountGate(false);
  };

  const getStatusVariant = (status: RecentActivity["status"]) => {
    switch (status) {
      case "completed":
        return "success";
      case "upcoming":
        return "info";
      case "pending":
        return "warning";
      default:
        return "neutral";
    }
  };

  const getActivityIcon = (type: RecentActivity["type"]): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "booking":
        return "calendar";
      case "quote":
        return "file-text";
      case "message":
        return "message-circle";
      default:
        return "circle";
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <Pressable onPress={handleAIPress}>
          <GlassCard style={styles.aiCard}>
            <View style={styles.aiCardContent}>
              <View style={[styles.aiIconContainer, { backgroundColor: Colors.accentLight }]}>
                <Feather name="message-circle" size={24} color={Colors.accent} />
              </View>
              <View style={styles.aiTextContainer}>
                <ThemedText style={styles.aiTitle}>Ask Homebase AI</ThemedText>
                <ThemedText style={[styles.aiSubtitle, { color: theme.textSecondary }]}>
                  Get instant answers about home services
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textTertiary} />
            </View>
          </GlassCard>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(400)}>
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
        <ThemedText style={styles.locationText}>
          San Francisco, CA
        </ThemedText>
        <Feather name="chevron-down" size={14} color={Colors.accent} />
      </Animated.View>

      {isAuthenticated ? (
        <>
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <SectionHeader title="Recent Activity" actionLabel="View All" onAction={() => {}} />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(300).duration(400)}
            style={styles.activityContainer}
          >
            {RECENT_ACTIVITY.map((activity, index) => (
              <Pressable
                key={activity.id}
                style={[
                  styles.activityCard,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.borderLight,
                  },
                ]}
              >
                <View style={[styles.activityIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name={getActivityIcon(activity.type)} size={16} color={Colors.accent} />
                </View>
                <View style={styles.activityContent}>
                  <ThemedText style={styles.activityTitle}>{activity.title}</ThemedText>
                  <ThemedText style={[styles.activityProvider, { color: theme.textSecondary }]}>
                    {activity.provider}
                  </ThemedText>
                </View>
                <View style={styles.activityRight}>
                  <StatusPill
                    label={activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                    variant={getStatusVariant(activity.status) as any}
                    size="small"
                  />
                  <ThemedText style={[styles.activityDate, { color: theme.textTertiary }]}>
                    {activity.date}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </Animated.View>
        </>
      ) : null}

      <Animated.View entering={FadeInDown.delay(isAuthenticated ? 350 : 250).duration(400)}>
        <SectionHeader title="Services" actionLabel="See All" onAction={() => {}} />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(isAuthenticated ? 400 : 300).duration(400)}
        style={styles.categoriesGrid}
      >
        {serviceCategories.slice(0, 6).map((category) => (
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

      <Animated.View entering={FadeInDown.delay(isAuthenticated ? 450 : 350).duration(400)}>
        <SectionHeader
          title="Featured Pros"
          actionLabel="See All"
          onAction={() => {}}
        />
      </Animated.View>
    </View>
  );

  const renderProvider = ({ item, index }: { item: typeof featuredProviders[0]; index: number }) => (
    <Animated.View entering={FadeInDown.delay((isAuthenticated ? 500 : 400) + index * 100).duration(400)}>
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

  const renderFooter = () => (
    <View style={styles.footerContent}>
      <Animated.View entering={FadeInDown.delay(700).duration(400)}>
        <SectionHeader title="Homeowner Tools" />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(750).duration(400)}
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
  aiCard: {
    marginBottom: Spacing.md,
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
  activityContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.sectionGap,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: 2,
  },
  activityProvider: {
    ...Typography.caption1,
  },
  activityRight: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  activityDate: {
    ...Typography.caption2,
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
