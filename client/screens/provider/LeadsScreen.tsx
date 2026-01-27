import React, { useState } from "react";
import { StyleSheet, FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedView } from "@/components/ThemedView";
import { LeadCard } from "@/components/LeadCard";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import { mockLeads, Lead } from "@/state/mockData";

export default function LeadsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState(mockLeads);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleLeadPress = (lead: Lead) => {
    // Navigate to lead details
  };

  const handleContact = (lead: Lead) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLeads((prev) =>
      prev.map((l) =>
        l.id === lead.id ? { ...l, status: "contacted" as const } : l
      )
    );
  };

  const handleDecline = (lead: Lead) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
  };

  const renderLead = ({ item, index }: { item: Lead; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(400)}>
      <LeadCard
        lead={item}
        onPress={() => handleLeadPress(item)}
        onContact={() => handleContact(item)}
        onDecline={() => handleDecline(item)}
        testID={`lead-${item.id}`}
      />
    </Animated.View>
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../../assets/images/empty-leads.png")}
      title="No leads yet"
      description="New job requests from homeowners will appear here. Keep your profile up to date to attract more leads!"
    />
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <SkeletonCard />}
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.lg,
          }}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={leads}
        renderItem={renderLead}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.lg,
          },
          leads.length === 0 && styles.emptyContainer,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
  },
});
