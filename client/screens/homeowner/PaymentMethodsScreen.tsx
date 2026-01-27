import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { PaymentMethod } from "@/state/types";

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const profile = useHomeownerStore((s) => s.profile);
  const addPaymentMethod = useHomeownerStore((s) => s.addPaymentMethod);
  const deletePaymentMethod = useHomeownerStore((s) => s.deletePaymentMethod);
  const setDefaultPaymentMethod = useHomeownerStore((s) => s.setDefaultPaymentMethod);

  const paymentMethods = profile?.paymentMethods || [];

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    cardNumber: "",
    expiry: "",
    cvv: "",
    name: "",
  });

  const resetForm = () => {
    setFormData({ cardNumber: "", expiry: "", cvv: "", name: "" });
    setIsAdding(false);
  };

  const handleAdd = () => {
    setIsAdding(true);
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const last4 = formData.cardNumber.slice(-4);
    const [month, year] = formData.expiry.split("/");

    const newMethod: PaymentMethod = {
      id: `pm-${Date.now()}`,
      type: "card",
      label: "Visa",
      last4,
      expiryMonth: parseInt(month, 10),
      expiryYear: 2000 + parseInt(year, 10),
      isDefault: paymentMethods.length === 0,
    };

    addPaymentMethod(newMethod);
    resetForm();
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Remove Payment Method",
      "Are you sure you want to remove this payment method?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            deletePaymentMethod(id);
          },
        },
      ]
    );
  };

  const handleSetDefault = (id: string) => {
    Haptics.selectionAsync();
    setDefaultPaymentMethod(id);
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

  const renderPaymentMethod = (method: PaymentMethod) => (
    <View
      key={method.id}
      style={[styles.methodCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}
    >
      <View style={styles.methodHeader}>
        <View style={[styles.methodIcon, { backgroundColor: Colors.accentLight }]}>
          <Feather name={getMethodIcon(method.type)} size={20} color={Colors.accent} />
        </View>
        <View style={styles.methodInfo}>
          <View style={styles.methodLabelRow}>
            <ThemedText style={styles.methodLabel}>{method.label}</ThemedText>
            {method.isDefault && (
              <View style={[styles.defaultBadge, { backgroundColor: Colors.accentLight }]}>
                <ThemedText style={styles.defaultBadgeText}>Default</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={[styles.methodDetails, { color: theme.textSecondary }]}>
            {method.type === "apple_pay"
              ? "Apple Pay"
              : `ending in ${method.last4}${method.expiryMonth ? ` - ${method.expiryMonth}/${method.expiryYear?.toString().slice(-2)}` : ""}`}
          </ThemedText>
        </View>
        <Pressable onPress={() => handleDelete(method.id)} style={styles.deleteBtn}>
          <Feather name="trash-2" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      {!method.isDefault && (
        <Pressable onPress={() => handleSetDefault(method.id)} style={styles.setDefaultBtn}>
          <ThemedText style={[styles.setDefaultText, { color: Colors.accent }]}>
            Set as default
          </ThemedText>
        </Pressable>
      )}
    </View>
  );

  const renderForm = () => (
    <View style={[styles.formCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
      <ThemedText style={styles.formTitle}>Add Payment Method</ThemedText>

      <View style={styles.formFields}>
        <TextField
          placeholder="Card Number"
          value={formData.cardNumber}
          onChangeText={(cardNumber) => setFormData((f) => ({ ...f, cardNumber }))}
          keyboardType="numeric"
          maxLength={16}
          leftIcon="credit-card"
        />
        <View style={styles.formRow}>
          <View style={styles.formHalf}>
            <TextField
              placeholder="MM/YY"
              value={formData.expiry}
              onChangeText={(expiry) => setFormData((f) => ({ ...f, expiry }))}
              maxLength={5}
            />
          </View>
          <View style={styles.formHalf}>
            <TextField
              placeholder="CVV"
              value={formData.cvv}
              onChangeText={(cvv) => setFormData((f) => ({ ...f, cvv }))}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
            />
          </View>
        </View>
        <TextField
          placeholder="Name on Card"
          value={formData.name}
          onChangeText={(name) => setFormData((f) => ({ ...f, name }))}
        />
      </View>

      <View style={styles.formActions}>
        <SecondaryButton label="Cancel" onPress={resetForm} style={styles.formBtn} />
        <PrimaryButton
          label="Add Card"
          onPress={handleSave}
          disabled={formData.cardNumber.length < 16 || formData.expiry.length < 5}
          style={styles.formBtn}
        />
      </View>

      <ThemedText style={[styles.securityNote, { color: theme.textTertiary }]}>
        Your payment information is stored securely
      </ThemedText>
    </View>
  );

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
        {paymentMethods.map(renderPaymentMethod)}

        {isAdding && renderForm()}

        {!isAdding && (
          <Pressable
            onPress={handleAdd}
            style={[styles.addButton, { borderColor: theme.borderLight }]}
          >
            <Feather name="plus" size={20} color={Colors.accent} />
            <ThemedText style={[styles.addButtonText, { color: Colors.accent }]}>
              Add Payment Method
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  methodCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  methodHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  methodInfo: {
    flex: 1,
  },
  methodLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  methodLabel: {
    ...Typography.subhead,
    fontWeight: "600",
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
  methodDetails: {
    ...Typography.caption1,
    marginTop: 2,
  },
  deleteBtn: {
    padding: Spacing.sm,
  },
  setDefaultBtn: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  setDefaultText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  formCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  formTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  formFields: {
    gap: Spacing.sm,
  },
  formRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  formHalf: {
    flex: 1,
  },
  formActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  formBtn: {
    flex: 1,
  },
  securityNote: {
    ...Typography.caption2,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addButtonText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
});
