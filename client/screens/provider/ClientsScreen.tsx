import React, { useState, useMemo } from "react";
import { StyleSheet, FlatList, RefreshControl, View, TextInput, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { FilterChips, FilterOption } from "@/components/FilterChips";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill, StatusType } from "@/components/StatusPill";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useProviderStore, Client } from "@/state/providerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type ClientFilter = "all" | "active" | "lead" | "inactive" | "archived";

const filterOptions: FilterOption<ClientFilter>[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "lead", label: "Leads" },
  { key: "inactive", label: "Inactive" },
  { key: "archived", label: "Archived" },
];

function getStatusType(status: Client["status"]): StatusType {
  switch (status) {
    case "active":
      return "success";
    case "lead":
      return "info";
    case "inactive":
      return "warning";
    case "archived":
      return "neutral";
    default:
      return "neutral";
  }
}

function getStatusLabel(status: Client["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "lead":
      return "Lead";
    case "inactive":
      return "Inactive";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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
            {client.avatar ? (
              <Animated.Image source={{ uri: client.avatar }} style={styles.avatarImage} />
            ) : (
              <ThemedText type="body" style={{ color: Colors.accent, fontWeight: "600" }}>
                {getInitials(client.name)}
              </ThemedText>
            )}
          </View>
          <View style={styles.clientInfo}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{client.name}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Last seen: {client.lastSeen}
            </ThemedText>
            <StatusPill status={getStatusType(client.status)} label={getStatusLabel(client.status)} />
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
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const clients = useProviderStore((s) => s.clients);

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ClientFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClients = useMemo(() => {
    let result = clients;
    
    if (filter !== "all") {
      result = result.filter((c) => c.status === filter);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          c.phone.includes(query)
      );
    }
    
    return result;
  }, [clients, filter, searchQuery]);

  const totalCount = clients.length;

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleClientPress = (client: Client) => {
    navigation.navigate("ClientDetail", { clientId: client.id });
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
        <Pressable
          style={[styles.menuButton, { backgroundColor: theme.cardBackground }]}
          onPress={() => {}}
        >
          <Feather name="more-horizontal" size={20} color={theme.text} />
        </Pressable>
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

      <FilterChips
        options={filterOptions}
        selected={filter}
        onSelect={setFilter}
        style={styles.filterChips}
      />
    </View>
  );

  const renderClient = ({ item, index }: { item: Client; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <ClientCard client={item} onPress={() => handleClientPress(item)} />
    </Animated.View>
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../../assets/images/empty-leads.png")}
      title={filter === "all" ? "No clients yet" : `No ${filter} clients`}
      description={
        filter === "all"
          ? "Your clients will appear here once you start working with homeowners."
          : `You don't have any ${filter} clients at the moment.`
      }
    />
  );

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
  menuButton: {
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
  filterChips: {
    paddingHorizontal: 0,
    marginBottom: Spacing.sm,
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
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
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
});
