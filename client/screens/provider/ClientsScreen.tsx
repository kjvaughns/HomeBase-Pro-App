import React, { useState, useMemo } from "react";
import { StyleSheet, FlatList, RefreshControl, View, TextInput, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { FilterChips, FilterOption } from "@/components/FilterChips";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

export interface Client {
  id: string;
  providerId: string;
  firstName: string;
  lastName: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  avatar?: string;
  status: "lead" | "active" | "inactive" | "archived";
  ltv: number;
  outstandingBalance?: number;
  nextAppointment?: string;
  lastSeen?: string;
  clientSince?: string;
  createdAt: string;
}

type StatusFilter = "all" | "lead" | "active" | "inactive" | "has_upcoming" | "overdue";
type SortOption = "recent" | "ltv" | "overdue" | "newest";

const STATUS_FILTERS: FilterOption<StatusFilter>[] = [
  { key: "all", label: "All" },
  { key: "lead", label: "Leads" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "has_upcoming", label: "Has Upcoming" },
  { key: "overdue", label: "Overdue" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Recent Activity" },
  { value: "ltv", label: "Highest LTV" },
  { value: "overdue", label: "Most Overdue" },
  { value: "newest", label: "Newest" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface ClientCardProps {
  client: Client;
  onPress: () => void;
  onCall: () => void;
  onMessage: () => void;
}

function ClientCard({ client, onPress, onCall, onMessage }: ClientCardProps) {
  const { theme } = useTheme();

  const statusColor = useMemo(() => {
    switch (client.status) {
      case "active": return Colors.accent;
      case "lead": return "#3B82F6";
      case "inactive": return theme.textSecondary;
      default: return theme.textSecondary;
    }
  }, [client.status, theme]);

  const statusLabel = useMemo(() => {
    switch (client.status) {
      case "active": return "Active";
      case "lead": return "Lead";
      case "inactive": return "Inactive";
      case "archived": return "Archived";
      default: return client.status;
    }
  }, [client.status]);

  return (
    <Pressable onPress={onPress} testID={`client-card-${client.id}`}>
      <GlassCard style={styles.clientCard}>
        <View style={styles.clientHeader}>
          <View style={styles.clientHeaderLeft}>
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
              <View style={styles.nameRow}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {client.name}
                </ThemedText>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                  <ThemedText style={[styles.statusText, { color: statusColor }]}>
                    {statusLabel}
                  </ThemedText>
                </View>
              </View>
              {client.address ? (
                <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
                  {client.address}
                </ThemedText>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.statsRow, { borderTopColor: theme.separator }]}>
          {client.nextAppointment ? (
            <View style={styles.statItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Next Appt
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "500" }}>
                {formatDate(client.nextAppointment)}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.statItem}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Lifetime
            </ThemedText>
            <ThemedText type="body" style={{ fontWeight: "500", color: Colors.accent }}>
              {formatCurrency(client.ltv)}
            </ThemedText>
          </View>
          {(client.outstandingBalance ?? 0) > 0 ? (
            <View style={styles.statItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Outstanding
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "500", color: "#EF4444" }}>
                {formatCurrency(client.outstandingBalance ?? 0)}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.cardBackground }]}
            onPress={(e) => { e.stopPropagation(); onCall(); }}
            testID={`call-${client.id}`}
          >
            <Feather name="phone" size={16} color={theme.text} />
            <ThemedText type="caption" style={{ marginLeft: 4 }}>Call</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: Colors.accent }]}
            onPress={(e) => { e.stopPropagation(); onMessage(); }}
            testID={`message-${client.id}`}
          >
            <Feather name="message-circle" size={16} color="#FFFFFF" />
            <ThemedText type="caption" style={{ marginLeft: 4, color: "#FFFFFF" }}>Message</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.cardBackground }]}
            onPress={onPress}
            testID={`job-${client.id}`}
          >
            <Feather name="briefcase" size={16} color={theme.text} />
            <ThemedText type="caption" style={{ marginLeft: 4 }}>Create Job</ThemedText>
          </Pressable>
        </View>
      </GlassCard>
    </Pressable>
  );
}

interface ApiClient {
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
  status?: string;
  createdAt: string;
}

export default function ClientsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;

  const { data: clientsData, isLoading, refetch } = useQuery<{ clients: ApiClient[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const clients: Client[] = useMemo(() => {
    return (clientsData?.clients || []).map((c) => ({
      ...c,
      name: `${c.firstName} ${c.lastName}`,
      status: (c.status as Client["status"]) || "active",
      ltv: 0,
      outstandingBalance: 0,
      clientSince: c.createdAt,
    }));
  }, [clientsData]);

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const filteredClients = useMemo(() => {
    let result = [...clients];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          (c.email && c.email.toLowerCase().includes(query)) ||
          (c.phone && c.phone.includes(query)) ||
          (c.address && c.address.toLowerCase().includes(query))
      );
    }

    switch (statusFilter) {
      case "lead":
        result = result.filter((c) => c.status === "lead");
        break;
      case "active":
        result = result.filter((c) => c.status === "active");
        break;
      case "inactive":
        result = result.filter((c) => c.status === "inactive");
        break;
      case "has_upcoming":
        result = result.filter((c) => !!c.nextAppointment);
        break;
      case "overdue":
        result = result.filter((c) => (c.outstandingBalance ?? 0) > 0);
        break;
    }

    switch (sortBy) {
      case "recent":
        result.sort((a, b) => {
          const aDate = a.nextAppointment || a.lastSeen || "";
          const bDate = b.nextAppointment || b.lastSeen || "";
          return bDate.localeCompare(aDate);
        });
        break;
      case "ltv":
        result.sort((a, b) => b.ltv - a.ltv);
        break;
      case "overdue":
        result.sort((a, b) => (b.outstandingBalance ?? 0) - (a.outstandingBalance ?? 0));
        break;
      case "newest":
        result.sort((a, b) => (b.clientSince || "").localeCompare(a.clientSince || ""));
        break;
    }

    return result;
  }, [clients, searchQuery, statusFilter, sortBy]);

  const clientCounts = useMemo(() => {
    return {
      all: clients.length,
      lead: clients.filter((c) => c.status === "lead").length,
      active: clients.filter((c) => c.status === "active").length,
      inactive: clients.filter((c) => c.status === "inactive").length,
      has_upcoming: clients.filter((c) => !!c.nextAppointment).length,
      overdue: clients.filter((c) => (c.outstandingBalance ?? 0) > 0).length,
    };
  }, [clients]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleClientPress = (client: Client) => {
    navigation.navigate("ClientDetail", { clientId: client.id });
  };

  const handleCall = (client: Client) => {
    if (client.phone) {
      Linking.openURL(`tel:${client.phone}`);
    }
  };

  const handleMessage = (client: Client) => {
    if (client.phone) {
      Linking.openURL(`sms:${client.phone}`);
    }
  };

  const handleAddClient = () => {
    navigation.navigate("AddClient" as any);
  };

  const handleFilterChange = (id: string) => {
    setStatusFilter(id as StatusFilter);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.titleRow}>
        <View>
          <ThemedText type="h1">Clients</ThemedText>
          <ThemedText type="body" style={{ color: Colors.accent }}>
            {clients.length} Total
          </ThemedText>
        </View>
        <View style={styles.titleButtons}>
          <Pressable
            onPress={() => setShowSortMenu(!showSortMenu)}
            style={[styles.sortButton, { backgroundColor: theme.cardBackground }]}
            testID="sort-button"
          >
            <Feather name="sliders" size={18} color={theme.text} />
          </Pressable>
          <Pressable
            style={[styles.addButton, { backgroundColor: Colors.accent }]}
            onPress={handleAddClient}
            testID="add-client-button"
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
          testID="search-input"
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <FilterChips
        options={STATUS_FILTERS.map((f) => ({
          ...f,
          label: `${f.label} (${clientCounts[f.key]})`,
        }))}
        selected={statusFilter}
        onSelect={handleFilterChange}
      />

      {showSortMenu ? (
        <View style={[styles.sortMenu, { backgroundColor: theme.cardBackground }]}>
          {SORT_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && { backgroundColor: Colors.accent + "20" },
              ]}
              onPress={() => {
                setSortBy(option.value);
                setShowSortMenu(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <ThemedText
                type="body"
                style={{
                  color: sortBy === option.value ? Colors.accent : theme.text,
                  fontWeight: sortBy === option.value ? "600" : "400",
                }}
              >
                {option.label}
              </ThemedText>
              {sortBy === option.value ? (
                <Feather name="check" size={18} color={Colors.accent} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  const renderClient = ({ item, index }: { item: Client; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(300)}>
      <ClientCard
        client={item}
        onPress={() => handleClientPress(item)}
        onCall={() => handleCall(item)}
        onMessage={() => handleMessage(item)}
      />
    </Animated.View>
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../../assets/images/empty-leads.png")}
      title={statusFilter !== "all" ? "No clients match filters" : "No clients yet"}
      description={
        statusFilter !== "all"
          ? "Try adjusting your filters to see more clients."
          : "Add your first client to start managing your business."
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
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + 100,
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
  titleButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  sortButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
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
  sortMenu: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  clientCard: {
    marginHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.sm,
  },
  clientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  clientHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    ...Typography.caption2,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statItem: {
    gap: 2,
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.screenPadding,
  },
});
