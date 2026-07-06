import React, { useMemo, useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  FlatList,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { formatMoney, formatDate } from "@/lib/format";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { useAuthStore } from "@/state/authStore";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

interface ManualPaymentRecord {
  id: string;
  invoiceId: string;
  amountCents: number;
  method: string;
  status: string;
  reference: string | null;
  notes: string | null;
  receivedAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  invoiceNumber: string | null;
  clientId: string | null;
}

interface ClientLite {
  id: string;
  firstName: string;
  lastName: string;
}


export default function ManualPaymentsListScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;
  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    isLoading,
    refetch,
  } = useQuery<{ payments: ManualPaymentRecord[] }>({
    queryKey: ["/api/providers", providerId, "manual-payments"],
    queryFn: async () => {
      const url = new URL(`/api/providers/${providerId}/manual-payments`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (res.status === 404) return { payments: [] };
      if (!res.ok) throw new Error("Failed to fetch manual payments");
      return res.json();
    },
    enabled: !!providerId,
    staleTime: 30_000,
  });

  const { data: clientsData } = useQuery<{ clients: ClientLite[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    (clientsData?.clients ?? []).forEach((c) => {
      map.set(c.id, `${c.firstName} ${c.lastName}`.trim());
    });
    return map;
  }, [clientsData]);

  const payments = data?.payments ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const renderItem = ({ item }: { item: ManualPaymentRecord }) => {
    const isVoided = !!item.voidedAt;
    const clientName = item.clientId ? clientMap.get(item.clientId) : null;
    const methodLabel =
      item.method === "bank_transfer"
        ? "Bank Transfer"
        : item.method.charAt(0).toUpperCase() + item.method.slice(1);
    const dt = item.receivedAt || item.createdAt;
    return (
      <Pressable
        onPress={() => navigation.navigate("InvoiceDetail", { invoiceId: item.invoiceId })}
        testID={`manual-payment-${item.id}`}
      >
        <GlassCard style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: Colors.accentLight }]}>
            <Feather name="dollar-sign" size={16} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText
              style={[
                styles.title,
                isVoided ? { textDecorationLine: "line-through", color: theme.textTertiary } : undefined,
              ]}
            >
              {clientName ?? `Invoice ${item.invoiceNumber ?? ""}`.trim()}
            </ThemedText>
            <ThemedText style={[styles.sub, { color: theme.textSecondary }]}>
              {formatDate(dt)}
              {item.reference ? ` \u00b7 Ref ${item.reference}` : ""}
            </ThemedText>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <ThemedText
              style={[
                styles.amount,
                isVoided ? { textDecorationLine: "line-through", color: theme.textTertiary } : undefined,
              ]}
            >
              {formatMoney(item.amountCents, { cents: true })}
            </ThemedText>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: BorderRadius.sm,
                backgroundColor: isVoided ? theme.backgroundSecondary : Colors.accentLight,
              }}
            >
              <ThemedText
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: isVoided ? theme.textSecondary : Colors.accent,
                }}
              >
                {isVoided ? "VOIDED" : methodLabel.toUpperCase()}
              </ThemedText>
            </View>
          </View>
        </GlassCard>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList<ManualPaymentRecord>
        data={payments}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: horizontalPadding,
          gap: Spacing.sm,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={{ paddingTop: Spacing.xl }}>
              <EmptyState
                image={require("../../assets/images/empty-bookings.png")}
                title="No payments recorded"
                description="Cash, check, and other manual payments you record will show up here."
              />
            </View>
          )
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontWeight: "600", fontSize: 15 },
  sub: { fontSize: 12, marginTop: 2 },
  amount: { fontWeight: "700", fontSize: 15 },
});
