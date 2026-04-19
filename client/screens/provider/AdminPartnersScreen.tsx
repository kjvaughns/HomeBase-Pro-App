import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PartnerBadge } from "@/components/PartnerBadge";
import { apiRequest } from "@/lib/query-client";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { BorderRadius, Colors, Spacing } from "@/constants/theme";

interface AdminProviderRow {
  id: string;
  businessName: string | null;
  email: string | null;
  isPartner: boolean | null;
  partnerSince: string | null;
}

interface AdminProvidersResponse {
  providers: AdminProviderRow[];
}

export default function AdminPartnersScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  // Task #220 review fix: when an admin grants/revokes Partner status on
  // their OWN provider record, mirror the change into the in-memory auth
  // store so the More-tab badge, SubscriptionScreen perks panel, and the
  // booking-page badge all reflect the new status without requiring a
  // logout/login or full app reload.
  const myProviderId = useAuthStore((s) => s.providerProfile?.id);
  const updateProviderProfile = useAuthStore((s) => s.updateProviderProfile);

  const queryKey = useMemo(
    () => ["/api/admin/providers", search] as const,
    [search],
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<AdminProvidersResponse>({
      queryKey,
      queryFn: async () => {
        const url = search
          ? `/api/admin/providers?q=${encodeURIComponent(search)}`
          : "/api/admin/providers";
        const res = await apiRequest("GET", url);
        return (await res.json()) as AdminProvidersResponse;
      },
    });

  const grant = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/providers/${providerId}/partner`,
      );
      return res.json();
    },
    onSuccess: (_data, providerId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
      // Also invalidate subscription status so the SubscriptionScreen
      // immediately switches to the Partner perks panel.
      queryClient.invalidateQueries({ queryKey: ["/api/provider/subscription/status"] });
      if (providerId === myProviderId) {
        updateProviderProfile({ isPartner: true });
      }
    },
    onError: (err: unknown) => {
      Alert.alert(
        "Couldn't grant Partner",
        err instanceof Error ? err.message : "Please try again.",
      );
    },
  });

  const revoke = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await apiRequest(
        "DELETE",
        `/api/admin/providers/${providerId}/partner`,
      );
      return res.json();
    },
    onSuccess: (_data, providerId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider/subscription/status"] });
      if (providerId === myProviderId) {
        updateProviderProfile({ isPartner: false });
      }
    },
    onError: (err: unknown) => {
      Alert.alert(
        "Couldn't revoke Partner",
        err instanceof Error ? err.message : "Please try again.",
      );
    },
  });

  const handleToggle = useCallback(
    (row: AdminProviderRow) => {
      if (row.isPartner) {
        Alert.alert(
          "Revoke Partner status?",
          `${row.businessName ?? "This provider"} will lose complimentary HomeBase Pro access.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Revoke",
              style: "destructive",
              onPress: () => revoke.mutate(row.id),
            },
          ],
        );
      } else {
        grant.mutate(row.id);
      }
    },
    [grant, revoke],
  );

  const renderItem = useCallback(
    ({ item }: { item: AdminProviderRow }) => {
      const busy =
        (grant.isPending && grant.variables === item.id) ||
        (revoke.isPending && revoke.variables === item.id);
      return (
        <GlassCard style={styles.row}>
          <View style={styles.rowInfo}>
            <View style={styles.rowHeader}>
              <ThemedText type="h4" numberOfLines={1} style={{ flex: 1 }}>
                {item.businessName || "Untitled provider"}
              </ThemedText>
              {item.isPartner ? <PartnerBadge size="small" /> : null}
            </View>
            {item.email ? (
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary }}
                numberOfLines={1}
              >
                {item.email}
              </ThemedText>
            ) : null}
          </View>
          <Pressable
            disabled={busy}
            onPress={() => handleToggle(item)}
            testID={`button-toggle-partner-${item.id}`}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: item.isPartner
                  ? "transparent"
                  : pressed
                    ? Colors.accentPressed
                    : Colors.accent,
                borderColor: item.isPartner ? Colors.error : Colors.accent,
                opacity: busy ? 0.5 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <ThemedText
                style={{
                  color: item.isPartner ? Colors.error : "#fff",
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {item.isPartner ? "Revoke" : "Grant"}
              </ThemedText>
            )}
          </Pressable>
        </GlassCard>
      );
    },
    [grant, revoke, handleToggle, theme.textSecondary],
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={data?.providers ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshing={isFetching && !isLoading}
        onRefresh={refetch}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl * 2,
          paddingHorizontal: Spacing.screenPadding,
        }}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              Search providers and grant complimentary HomeBase Pro access.
              Standard transaction fees still apply on payouts.
            </ThemedText>
            <TextInput
              testID="input-search-providers"
              value={search}
              onChangeText={setSearch}
              placeholder="Search by business name or email"
              placeholderTextColor={theme.textTertiary}
              style={[
                styles.search,
                {
                  borderColor: theme.borderLight,
                  color: theme.text,
                  backgroundColor: theme.cardBackground,
                },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : isError ? (
            <View style={styles.center}>
              <ThemedText style={{ color: Colors.error }}>
                {error instanceof Error
                  ? error.message
                  : "Couldn't load providers"}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.center}>
              <ThemedText style={{ color: theme.textSecondary }}>
                No providers match your search.
              </ThemedText>
            </View>
          )
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBlock: { marginBottom: Spacing.lg, gap: Spacing.md },
  subtitle: { fontSize: 14, lineHeight: 20 },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.cardPadding,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  actionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minWidth: 84,
    alignItems: "center",
  },
  center: {
    paddingVertical: Spacing.xl * 2,
    alignItems: "center",
  },
});
