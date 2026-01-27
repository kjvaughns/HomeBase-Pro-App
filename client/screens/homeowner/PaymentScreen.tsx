import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PaymentMethod } from "@/state/types";

type ScreenRouteProp = RouteProp<RootStackParamList, "Payment">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { jobId, invoiceId } = route.params;

  const invoice = useHomeownerStore((s) => s.getInvoiceById(invoiceId));
  const profile = useHomeownerStore((s) => s.profile);
  const payInvoice = useHomeownerStore((s) => s.payInvoice);

  const paymentMethods = profile?.paymentMethods || [];
  const defaultMethod = paymentMethods.find((m) => m.isDefault);

  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(
    defaultMethod?.id || paymentMethods[0]?.id || null
  );
  const [isProcessing, setIsProcessing] = useState(false);

  if (!invoice) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Invoice not found</ThemedText>
      </ThemedView>
    );
  }

  const handlePayment = async () => {
    if (!selectedMethodId) return;

    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      payInvoice(invoiceId, selectedMethodId);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "Main" },
            { name: "JobDetail", params: { jobId } },
          ],
        })
      );
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getMethodIcon = (type: PaymentMethod["type"]): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "card":
        return "credit-card";
      case "bank":
        return "briefcase";
      case "apple_pay":
        return "smartphone";
      default:
        return "credit-card";
    }
  };

  const renderPaymentMethod = (method: PaymentMethod) => {
    const isSelected = selectedMethodId === method.id;
    return (
      <Pressable
        key={method.id}
        onPress={() => {
          Haptics.selectionAsync();
          setSelectedMethodId(method.id);
        }}
        style={[
          styles.methodCard,
          {
            backgroundColor: isSelected ? Colors.accentLight : theme.cardBackground,
            borderColor: isSelected ? Colors.accent : theme.borderLight,
          },
        ]}
      >
        <View
          style={[
            styles.radioOuter,
            { borderColor: isSelected ? Colors.accent : theme.borderLight },
          ]}
        >
          {isSelected && <View style={styles.radioInner} />}
        </View>
        <View style={[styles.methodIcon, { backgroundColor: isSelected ? "#fff" : theme.borderLight }]}>
          <Feather name={getMethodIcon(method.type)} size={20} color={isSelected ? Colors.accent : theme.textSecondary} />
        </View>
        <View style={styles.methodInfo}>
          <ThemedText style={styles.methodLabel}>{method.label}</ThemedText>
          <ThemedText style={[styles.methodLast4, { color: theme.textSecondary }]}>
            {method.type === "apple_pay" ? "Apple Pay" : `ending in ${method.last4}`}
          </ThemedText>
        </View>
        {method.isDefault && (
          <View style={[styles.defaultBadge, { backgroundColor: Colors.accentLight }]}>
            <ThemedText style={styles.defaultBadgeText}>Default</ThemedText>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.invoiceCard}>
          <ThemedText style={styles.invoiceTitle}>Invoice Summary</ThemedText>

          {invoice.items.map((item, index) => (
            <View key={index} style={styles.lineItem}>
              <ThemedText style={[styles.lineItemDesc, { color: theme.textSecondary }]}>
                {item.description}
              </ThemedText>
              <ThemedText style={styles.lineItemAmount}>${item.total}</ThemedText>
            </View>
          ))}

          <View style={styles.lineItem}>
            <ThemedText style={[styles.lineItemDesc, { color: theme.textSecondary }]}>
              Labor ({invoice.laborHours} hrs @ ${invoice.laborRate}/hr)
            </ThemedText>
            <ThemedText style={styles.lineItemAmount}>${invoice.laborTotal}</ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.totalRow}>
            <ThemedText style={styles.totalLabel}>Total Due</ThemedText>
            <ThemedText style={styles.totalAmount}>${invoice.total}</ThemedText>
          </View>
        </GlassCard>

        <ThemedText style={styles.sectionTitle}>Payment Method</ThemedText>

        {paymentMethods.length > 0 ? (
          <View style={styles.methodsList}>
            {paymentMethods.map(renderPaymentMethod)}
          </View>
        ) : (
          <View style={styles.emptyMethods}>
            <Feather name="credit-card" size={32} color={theme.textTertiary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No payment methods saved
            </ThemedText>
          </View>
        )}

        <Pressable
          onPress={() => navigation.navigate("PaymentMethods")}
          style={[styles.addMethodBtn, { borderColor: theme.borderLight }]}
        >
          <Feather name="plus" size={20} color={Colors.accent} />
          <ThemedText style={[styles.addMethodText, { color: Colors.accent }]}>
            Add Payment Method
          </ThemedText>
        </Pressable>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <PrimaryButton
          label={isProcessing ? "" : `Pay $${invoice.total}`}
          onPress={handlePayment}
          disabled={!selectedMethodId || isProcessing}
        >
          {isProcessing && <ActivityIndicator color="#fff" />}
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  invoiceCard: {
    marginBottom: Spacing.lg,
  },
  invoiceTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  lineItemDesc: {
    ...Typography.body,
    flex: 1,
  },
  lineItemAmount: {
    ...Typography.body,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    ...Typography.headline,
  },
  totalAmount: {
    ...Typography.title1,
    fontWeight: "700",
    color: Colors.accent,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  methodsList: {
    gap: Spacing.sm,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  methodInfo: {
    flex: 1,
  },
  methodLabel: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  methodLast4: {
    ...Typography.caption1,
  },
  defaultBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    ...Typography.caption2,
    color: Colors.accent,
    fontWeight: "600",
  },
  emptyMethods: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    ...Typography.subhead,
    marginTop: Spacing.sm,
  },
  addMethodBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addMethodText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
});
