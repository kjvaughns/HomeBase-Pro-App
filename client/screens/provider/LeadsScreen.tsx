import React, { useState, useMemo } from "react";
import { StyleSheet, FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedView } from "@/components/ThemedView";
import { LeadCard } from "@/components/LeadCard";
import { FilterChips, FilterOption } from "@/components/FilterChips";
import { EmptyState } from "@/components/EmptyState";
import { Spacing, Colors } from "@/constants/theme";
import { Lead } from "@/state/providerStore";
import { useAuthStore } from "@/state/authStore";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type LeadFilter = "all" | "new" | "contacted" | "quoted" | "won" | "lost";

const filterOptions: FilterOption<LeadFilter>[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "quoted", label: "Quoted" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export default function LeadsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const queryClient = useQueryClient();

  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;

  const [filter, setFilter] = useState<LeadFilter>("all");

  const { data, isLoading, refetch, isRefetching } = useQuery<{ leads: Lead[] }>({
    queryKey: ["/api/providers", providerId, "leads"],
    enabled: !!providerId,
    queryFn: async () => {
      const url = new URL(`/api/providers/${providerId}/leads`, getApiUrl());
      const res = await fetch(url.toString(), {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  const leads: Lead[] = data?.leads ?? [];

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Lead["status"] }) => {
      return apiRequest("PATCH", `/api/leads/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers", providerId, "leads"] });
    },
  });

  const filteredLeads = useMemo(() => {
    if (filter === "all") return leads;
    return leads.filter((l) => l.status === filter);
  }, [leads, filter]);

  const filterOptionsWithCounts = useMemo(() => {
    return filterOptions.map((opt) => ({
      ...opt,
      count: opt.key === "all" ? leads.length : leads.filter((l) => l.status === opt.key).length,
    }));
  }, [leads]);

  const handleContact = (lead: Lead) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateStatus.mutate({ id: lead.id, status: "contacted" });
  };

  const handleDecline = (lead: Lead) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    updateStatus.mutate({ id: lead.id, status: "lost" });
  };

  const renderHeader = () => (
    <View style={styles.filterWrapper}>
      <FilterChips
        options={filterOptionsWithCounts}
        selected={filter}
        onSelect={setFilter}
        showCounts
        style={styles.filterChips}
      />
    </View>
  );

  const renderLead = ({ item, index }: { item: Lead; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <LeadCard
        lead={item}
        onPress={() => {}}
        onContact={() => handleContact(item)}
        onDecline={() => handleDecline(item)}
        testID={`lead-${item.id}`}
      />
    </Animated.View>
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../../assets/images/empty-leads.png")}
      title={filter === "all" ? "No leads yet" : `No ${filter} leads`}
      description={
        filter === "all"
          ? "New job requests from homeowners will appear here. Keep your profile up to date to attract more leads!"
          : `You don't have any ${filter} leads at the moment.`
      }
    />
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredLeads}
        renderItem={renderLead}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
          filteredLeads.length === 0 && styles.emptyContainer,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
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
  filterWrapper: {
    marginBottom: Spacing.md,
  },
  filterChips: {
    paddingVertical: Spacing.sm,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.screenPadding,
  },
});
