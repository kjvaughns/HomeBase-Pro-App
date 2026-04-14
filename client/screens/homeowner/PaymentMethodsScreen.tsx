import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useStripe } from "@/lib/useStripePayment";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
}

function brandIcon(brand: string): keyof typeof Feather.glyphMap {
  return "credit-card";
}

function brandLabel(brand: string): string {
  const labels: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    discover: "Discover",
    jcb: "JCB",
    unionpay: "UnionPay",
    diners: "Diners Club",
  };
  return labels[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const queryClient = useQueryClient();
  const [addingCard, setAddingCard] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ paymentMethods: SavedCard[]; defaultPaymentMethodId: string | null }>({
    queryKey: ["/api/homeowner/payment-methods"],
    queryFn: async () => {
      const url = new URL("/api/homeowner/payment-methods", getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) throw new Error("Failed to load cards");
      return res.json();
    },
  });

  const cards = data?.paymentMethods ?? [];

  const deleteMutation = useMutation({
    mutationFn: async (pmId: string) => {
      const url = new URL(`/api/homeowner/payment-methods/${pmId}`, getApiUrl());
      const res = await fetch(url.toString(), { method: "DELETE", headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) throw new Error("Failed to remove card");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/homeowner/payment-methods"] }),
  });

  const defaultMutation = useMutation({
    mutationFn: async (pmId: string) => {
      const url = new URL("/api/homeowner/default-payment-method", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ paymentMethodId: pmId }),
      });
      if (!res.ok) throw new Error("Failed to set default");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/homeowner/payment-methods"] }),
  });

  const handleAddCard = useCallback(async () => {
    setAddingCard(true);
    try {
      const url = new URL("/api/homeowner/setup-payment-sheet", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to initialize card setup");
      const { setupIntentClientSecret, ephemeralKeySecret, customerId } = await res.json();

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "HomeBase Pro",
        customerId,
        customerEphemeralKeySecret: ephemeralKeySecret,
        setupIntentClientSecret,
        allowsDelayedPaymentMethods: false,
        appearance: { colors: { primary: Colors.accent } },
      });

      if (initError) throw new Error(initError.message);

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== "Canceled") {
          throw new Error(presentError.message);
        }
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/homeowner/payment-methods"] });
    } catch (err) {
      console.warn("Add card error:", err);
    } finally {
      setAddingCard(false);
    }
  }, [initPaymentSheet, presentPaymentSheet, queryClient]);

  const handleDelete = useCallback(async (pmId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeletingId(pmId);
    try {
      await deleteMutation.mutateAsync(pmId);
    } finally {
      setDeletingId(null);
    }
  }, [deleteMutation]);

  const handleSetDefault = useCallback(async (pmId: string) => {
    Haptics.selectionAsync();
    setSettingDefaultId(pmId);
    try {
      await defaultMutation.mutateAsync(pmId);
    } finally {
      setSettingDefaultId(null);
    }
  }, [defaultMutation]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.xl }} />
        ) : cards.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
            <Feather name="credit-card" size={32} color={theme.textTertiary} />
            <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>No saved cards</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
              Add a card to pay invoices and rebook services quickly.
            </ThemedText>
          </View>
        ) : (
          cards.map((card) => (
            <View
              key={card.id}
              testID={`card-${card.id}`}
              style={[
                styles.cardRow,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: card.isDefault ? Colors.accent + "60" : theme.borderLight,
                  borderWidth: card.isDefault ? 1.5 : 1,
                },
              ]}
            >
              <View style={[styles.cardIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name={brandIcon(card.brand)} size={20} color={Colors.accent} />
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.cardLabelRow}>
                  <ThemedText style={styles.cardLabel}>{brandLabel(card.brand)} ••••{card.last4}</ThemedText>
                  {card.isDefault ? (
                    <View style={[styles.defaultBadge, { backgroundColor: Colors.accentLight }]}>
                      <ThemedText style={[styles.defaultBadgeText, { color: Colors.accent }]}>Default</ThemedText>
                    </View>
                  ) : null}
                </View>
                {card.expMonth && card.expYear ? (
                  <ThemedText style={[styles.cardExpiry, { color: theme.textSecondary }]}>
                    Expires {card.expMonth}/{String(card.expYear).slice(-2)}
                  </ThemedText>
                ) : null}
                {!card.isDefault ? (
                  <Pressable
                    onPress={() => handleSetDefault(card.id)}
                    disabled={settingDefaultId === card.id}
                    testID={`button-set-default-${card.id}`}
                  >
                    {settingDefaultId === card.id ? (
                      <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: 4 }} />
                    ) : (
                      <ThemedText style={[styles.setDefaultText, { color: Colors.accent }]}>
                        Set as default
                      </ThemedText>
                    )}
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                onPress={() => handleDelete(card.id)}
                disabled={deletingId === card.id}
                style={styles.deleteBtn}
                testID={`button-delete-card-${card.id}`}
              >
                {deletingId === card.id ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <Feather name="trash-2" size={18} color={theme.textSecondary} />
                )}
              </Pressable>
            </View>
          ))
        )}

        <Pressable
          onPress={handleAddCard}
          disabled={addingCard}
          style={[styles.addButton, { borderColor: Colors.accent + "60", opacity: addingCard ? 0.6 : 1 }]}
          testID="button-add-card"
        >
          {addingCard ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <>
              <Feather name="plus" size={20} color={Colors.accent} />
              <ThemedText style={[styles.addButtonText, { color: Colors.accent }]}>Add Payment Method</ThemedText>
            </>
          )}
        </Pressable>

        <ThemedText style={[styles.securityNote, { color: theme.textTertiary }]}>
          Cards are stored securely by Stripe. HomeBase never sees your full card details.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.headline,
    fontWeight: "600",
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  cardLabel: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  defaultBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    ...Typography.caption2,
    fontWeight: "700",
  },
  cardExpiry: {
    ...Typography.caption1,
  },
  setDefaultText: {
    ...Typography.caption1,
    fontWeight: "600",
    marginTop: 2,
  },
  deleteBtn: {
    padding: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.card,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginBottom: Spacing.md,
  },
  addButtonText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  securityNote: {
    ...Typography.caption1,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: Spacing.md,
  },
});
