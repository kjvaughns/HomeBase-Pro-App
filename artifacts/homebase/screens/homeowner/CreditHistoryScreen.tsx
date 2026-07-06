import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useLayout } from "@/hooks/useLayout";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";

interface LedgerEntry {
  id: string;
  amountCents: number;
  label: string;
  isCredit: boolean;
  createdAt: string;
  invoiceId?: string | null;
}

interface CreditsHistoryResponse {
  balanceCents: number;
  balance: string;
  history: LedgerEntry[];
}

const ACTIVITY_ICONS: Record<string, "star" | "award" | "gift" | "check-circle" | "minus-circle" | "trending-up" | "users"> = {
  "First booking completed": "check-circle",
  "Left a provider review": "star",
  "Booked 5 service types": "award",
  "Signed up with a referral": "gift",
  "Friend completed first booking": "users",
  "Credits applied to invoice": "minus-circle",
  "Credits purchased": "trending-up",
};

function getIcon(label: string, isCredit: boolean): "star" | "award" | "gift" | "check-circle" | "minus-circle" | "trending-up" | "users" | "dollar-sign" {
  if (!isCredit) return "minus-circle";
  return ACTIVITY_ICONS[label] ?? "dollar-sign";
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function CreditHistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const { horizontalPadding } = useLayout();
  const { theme } = useTheme();
  const { user } = useAuthStore();

  const { data, isLoading, isError, refetch } = useQuery<CreditsHistoryResponse>({
    queryKey: ["/api/users/me/credits/history"],
    queryFn: async () => {
      const url = new URL("/api/users/me/credits/history", getApiUrl());
      const res = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch credits history");
      return res.json();
    },
    enabled: !!user?.id,
  });

  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: horizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.balanceCard}>
          <View style={styles.balanceIconRow}>
            <View style={[styles.balanceIconCircle, { backgroundColor: Colors.accentLight }]}>
              <Feather name="dollar-sign" size={28} color={Colors.accent} />
            </View>
          </View>
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.accent} style={{ marginVertical: Spacing.md }} />
          ) : (
            <>
              <ThemedText style={styles.balanceAmount}>
                ${data?.balance ?? "0.00"}
              </ThemedText>
              <ThemedText style={[styles.balanceLabel, { color: theme.textSecondary }]}>
                Available Credits
              </ThemedText>
            </>
          )}
          <View style={[styles.noteBox, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="info" size={14} color={theme.textTertiary} />
            <ThemedText style={[styles.noteText, { color: theme.textSecondary }]}>
              Credits are applied automatically when you pay an invoice, reducing your balance before any card charge.
            </ThemedText>
          </View>
        </GlassCard>

        <View style={styles.howToEarnSection}>
          <ThemedText style={styles.sectionTitle}>How to earn credits</ThemedText>
          <GlassCard style={styles.earnCard}>
            {[
              { icon: "check-circle" as const, label: "Complete your first booking", amount: "$5" },
              { icon: "star" as const, label: "Leave a provider review", amount: "$3" },
              { icon: "award" as const, label: "Book 5 different service types", amount: "$15" },
              { icon: "users" as const, label: "Refer a friend who books", amount: "$10" },
            ].map((item, i, arr) => (
              <View
                key={item.label}
                style={[
                  styles.earnRow,
                  i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.borderLight },
                ]}
              >
                <View style={[styles.earnIconCircle, { backgroundColor: Colors.accentLight }]}>
                  <Feather name={item.icon} size={16} color={Colors.accent} />
                </View>
                <ThemedText style={[styles.earnLabel, { flex: 1 }]}>{item.label}</ThemedText>
                <ThemedText style={[styles.earnAmount, { color: Colors.accent }]}>{item.amount}</ThemedText>
              </View>
            ))}
          </GlassCard>
        </View>

        <View style={styles.historySection}>
          <ThemedText style={styles.sectionTitle}>Credit history</ThemedText>

          {isLoading ? (
            <GlassCard style={styles.emptyCard}>
              <ActivityIndicator size="small" color={Colors.accent} />
            </GlassCard>
          ) : isError ? (
            <GlassCard style={styles.emptyCard}>
              <Feather name="alert-circle" size={24} color={theme.textTertiary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                Could not load history
              </ThemedText>
              <Pressable onPress={() => refetch()} style={styles.retryBtn}>
                <ThemedText style={{ color: Colors.accent, ...Typography.subhead }}>Retry</ThemedText>
              </Pressable>
            </GlassCard>
          ) : !data?.history?.length ? (
            <GlassCard style={styles.emptyCard}>
              <Feather name="inbox" size={32} color={theme.textTertiary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No credit history yet
              </ThemedText>
              <ThemedText style={[styles.emptySubtext, { color: theme.textTertiary }]}>
                Complete your first booking to earn your first $5 in credits.
              </ThemedText>
            </GlassCard>
          ) : (
            <GlassCard style={styles.historyCard}>
              {data.history.map((entry, i) => (
                <View
                  key={entry.id}
                  style={[
                    styles.historyRow,
                    i < data.history.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.borderLight,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.historyIconCircle,
                      { backgroundColor: entry.isCredit ? Colors.accentLight : Colors.errorLight },
                    ]}
                  >
                    <Feather
                      name={getIcon(entry.label, entry.isCredit)}
                      size={16}
                      color={entry.isCredit ? Colors.accent : Colors.error}
                    />
                  </View>
                  <View style={styles.historyInfo}>
                    <ThemedText style={styles.historyLabel}>{entry.label}</ThemedText>
                    <ThemedText style={[styles.historyDate, { color: theme.textTertiary }]}>
                      {formatDate(entry.createdAt)}
                    </ThemedText>
                  </View>
                  <ThemedText
                    style={[
                      styles.historyAmount,
                      { color: entry.isCredit ? Colors.accent : Colors.error },
                    ]}
                  >
                    {entry.isCredit ? "+" : "-"}${(entry.amountCents / 100).toFixed(2)}
                  </ThemedText>
                </View>
              ))}
            </GlassCard>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  balanceCard: { alignItems: "center", paddingVertical: Spacing.xl, marginBottom: Spacing.lg },
  balanceIconRow: { marginBottom: Spacing.md },
  balanceIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceAmount: { ...Typography.largeTitle, fontWeight: "700", marginBottom: 4 },
  balanceLabel: { ...Typography.subhead, marginBottom: Spacing.md },
  noteBox: {
    flexDirection: "row",
    gap: Spacing.xs,
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    width: "100%",
  },
  noteText: { ...Typography.caption1, flex: 1, lineHeight: 18 },
  howToEarnSection: { marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.headline, marginBottom: Spacing.sm },
  earnCard: { padding: 0, overflow: "hidden" },
  earnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },
  earnIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  earnLabel: { ...Typography.body },
  earnAmount: { ...Typography.subhead, fontWeight: "700" },
  historySection: { marginBottom: Spacing.xl },
  historyCard: { padding: 0, overflow: "hidden" },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },
  historyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  historyInfo: { flex: 1 },
  historyLabel: { ...Typography.body, fontWeight: "500" },
  historyDate: { ...Typography.caption2, marginTop: 2 },
  historyAmount: { ...Typography.subhead, fontWeight: "700" },
  emptyCard: { alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.xl },
  emptyText: { ...Typography.subhead },
  emptySubtext: { ...Typography.caption1, textAlign: "center" },
  retryBtn: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md },
});
