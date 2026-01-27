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
import { Address } from "@/state/types";

export default function AddressesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const profile = useHomeownerStore((s) => s.profile);
  const addAddress = useHomeownerStore((s) => s.addAddress);
  const updateAddress = useHomeownerStore((s) => s.updateAddress);
  const deleteAddress = useHomeownerStore((s) => s.deleteAddress);
  const setDefaultAddress = useHomeownerStore((s) => s.setDefaultAddress);

  const addresses = profile?.addresses || [];

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    street: "",
    city: "",
    state: "",
    zip: "",
  });

  const resetForm = () => {
    setFormData({ label: "", street: "", city: "", state: "", zip: "" });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({ label: "", street: "", city: "", state: "", zip: "" });
  };

  const handleEdit = (address: Address) => {
    setEditingId(address.id);
    setIsAdding(false);
    setFormData({
      label: address.label,
      street: address.street,
      city: address.city,
      state: address.state,
      zip: address.zip,
    });
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isAdding) {
      const newAddress: Address = {
        id: `addr-${Date.now()}`,
        ...formData,
        isDefault: addresses.length === 0,
      };
      addAddress(newAddress);
    } else if (editingId) {
      updateAddress(editingId, formData);
    }

    resetForm();
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Address",
      "Are you sure you want to delete this address?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            deleteAddress(id);
          },
        },
      ]
    );
  };

  const handleSetDefault = (id: string) => {
    Haptics.selectionAsync();
    setDefaultAddress(id);
  };

  const renderAddress = (address: Address) => (
    <View
      key={address.id}
      style={[styles.addressCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}
    >
      <View style={styles.addressHeader}>
        <View style={styles.addressLabel}>
          <Feather name="map-pin" size={16} color={Colors.accent} />
          <ThemedText style={styles.labelText}>{address.label}</ThemedText>
          {address.isDefault && (
            <View style={[styles.defaultBadge, { backgroundColor: Colors.accentLight }]}>
              <ThemedText style={styles.defaultBadgeText}>Default</ThemedText>
            </View>
          )}
        </View>
        <View style={styles.addressActions}>
          <Pressable onPress={() => handleEdit(address)} style={styles.actionBtn}>
            <Feather name="edit-2" size={16} color={theme.textSecondary} />
          </Pressable>
          <Pressable onPress={() => handleDelete(address.id)} style={styles.actionBtn}>
            <Feather name="trash-2" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      <ThemedText style={[styles.addressStreet, { color: theme.textSecondary }]}>
        {address.street}
      </ThemedText>
      <ThemedText style={[styles.addressCity, { color: theme.textTertiary }]}>
        {address.city}, {address.state} {address.zip}
      </ThemedText>

      {!address.isDefault && (
        <Pressable onPress={() => handleSetDefault(address.id)} style={styles.setDefaultBtn}>
          <ThemedText style={[styles.setDefaultText, { color: Colors.accent }]}>
            Set as default
          </ThemedText>
        </Pressable>
      )}
    </View>
  );

  const renderForm = () => (
    <View style={[styles.formCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
      <ThemedText style={styles.formTitle}>
        {isAdding ? "Add New Address" : "Edit Address"}
      </ThemedText>

      <View style={styles.formFields}>
        <TextField
          placeholder="Label (e.g., Home, Office)"
          value={formData.label}
          onChangeText={(label) => setFormData((f) => ({ ...f, label }))}
        />
        <TextField
          placeholder="Street Address"
          value={formData.street}
          onChangeText={(street) => setFormData((f) => ({ ...f, street }))}
        />
        <TextField
          placeholder="City"
          value={formData.city}
          onChangeText={(city) => setFormData((f) => ({ ...f, city }))}
        />
        <View style={styles.formRow}>
          <View style={styles.formHalf}>
            <TextField
              placeholder="State"
              value={formData.state}
              onChangeText={(state) => setFormData((f) => ({ ...f, state }))}
            />
          </View>
          <View style={styles.formHalf}>
            <TextField
              placeholder="ZIP"
              value={formData.zip}
              onChangeText={(zip) => setFormData((f) => ({ ...f, zip }))}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      <View style={styles.formActions}>
        <SecondaryButton label="Cancel" onPress={resetForm} style={styles.formBtn} />
        <PrimaryButton
          label="Save"
          onPress={handleSave}
          disabled={!formData.label || !formData.street || !formData.city}
          style={styles.formBtn}
        />
      </View>
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
        {addresses.map(renderAddress)}

        {(isAdding || editingId) && renderForm()}

        {!isAdding && !editingId && (
          <Pressable
            onPress={handleAdd}
            style={[styles.addButton, { borderColor: theme.borderLight }]}
          >
            <Feather name="plus" size={20} color={Colors.accent} />
            <ThemedText style={[styles.addButtonText, { color: Colors.accent }]}>
              Add New Address
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
  addressCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  addressLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  labelText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  defaultBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: Spacing.xs,
  },
  defaultBadgeText: {
    ...Typography.caption2,
    color: Colors.accent,
    fontWeight: "600",
  },
  addressActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionBtn: {
    padding: Spacing.xs,
  },
  addressStreet: {
    ...Typography.body,
  },
  addressCity: {
    ...Typography.caption1,
    marginTop: 2,
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
