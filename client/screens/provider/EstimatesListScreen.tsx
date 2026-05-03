// Task #296 — Estimates list. Mirrors the invoice list pattern but uses
// the estimate-specific status pills.
import React from "react";
import { StyleSheet, View, Pressable, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useTheme } from "@/hooks/useTheme";
import { estimateStatusLabel, estimateStatusTone } from "@/constants/estimateStatuses";

interface EstimateRow {
  id: string;
  estimateNumber: string;
  status: string;
  totalCents: number;
  clientId: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

interface ClientLite { id: string; firstName: string; lastName: string }

function toneColor(tone: ReturnType<typeof estimateStatusTone>): string {
  switch (tone) {
    case "success": return "#10b981";
    case "danger": return "#ef4444";
    case "info": return "#3b82f6";
    case "warning": return "#f59e0b";
    default: return "#6b7280";
  }
}

function formatCents(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function EstimatesListScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { providerProfile } = useAuthStore();
  const { theme } = useTheme();
  const providerId = providerProfile?.id;

  const { data, isLoading, refetch, isRefetching } = useQuery<{ estimates: EstimateRow[] }>({
    queryKey: ["/api/provider", providerId, "estimates"],
    enabled: !!providerId,
  });

  const { data: clientsData } = useQuery<{ clients: ClientLite[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const clientMap = new Map((clientsData?.clients || []).map((c) => [c.id, `${c.firstName} ${c.lastName}`]));
  const estimates = data?.estimates ?? [];

  const renderItem = ({ item }: { item: EstimateRow }) => {
    const tone = estimateStatusTone(item.status);
    const color = toneColor(tone);
    const clientName = item.clientId ? clientMap.get(item.clientId) : null;
    return (
      <Pressable
        style={[styles.row, { backgroundColor: theme.cardBackground }]}
        onPress={() => navigation.navigate("EstimateDetail", { estimateId: item.id })}
        testID={`estimate-${item.id}`}
      >
        <View style={[styles.icon, { backgroundColor: Colors.accentLight }]}>
          <Feather name="file" size={16} color={Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={{ fontWeight: "600" }}>{clientName ?? `Estimate ${item.estimateNumber}`}</ThemedText>
          <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
            {item.estimateNumber}
          </ThemedText>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <ThemedText style={{ fontWeight: "700" }}>{formatCents(item.totalCents)}</ThemedText>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: color + "20",
            borderWidth: 1, borderColor: color + "40",
          }}>
            <ThemedText style={{ fontSize: 11, fontWeight: "700", color }}>
              {estimateStatusLabel(item.status).toUpperCase()}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList<EstimateRow>
        data={estimates}
        renderItem={renderItem}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.accent} />}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={{ paddingTop: Spacing.xl * 2 }}>
              <EmptyState
                title="No estimates yet"
                description="Send your first estimate to a client and track responses here."
                primaryAction={{
                  label: "New Estimate",
                  onPress: () => navigation.navigate("AddEstimate"),
                }}
              />
            </View>
          )
        }
        ListHeaderComponent={
          estimates.length > 0 ? (
            <Pressable
              style={[styles.newBtn, { backgroundColor: Colors.accent }]}
              onPress={() => navigation.navigate("AddEstimate")}
              testID="button-new-estimate"
            >
              <Feather name="plus" size={16} color="#fff" />
              <ThemedText style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>New Estimate</ThemedText>
            </Pressable>
          ) : null
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center",
    padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  icon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  newBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md, marginBottom: Spacing.md,
    alignSelf: "flex-end",
  },
});
