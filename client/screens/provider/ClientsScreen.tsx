import React, { useState, useMemo } from "react";
import { StyleSheet, FlatList, RefreshControl, View, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

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
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { providerProfile } = useAuthStore();

  const providerId = providerProfile?.id;

  const { data: clientsData, isLoading, refetch } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const clients = clientsData?.clients || [];

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    
    const query = searchQuery.toLowerCase().trim();
    return clients.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(query) ||
        (c.email && c.email.toLowerCase().includes(query)) ||
        (c.phone && c.phone.includes(query))
    );
  }, [clients, searchQuery]);

  const totalCount = clients.length;

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
          style={[styles.addButton, { backgroundColor: Colors.accent }]}
          onPress={handleAddClient}
        >
          <Feather name="plus" size={20} color="white" />
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
    </View>
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
});
