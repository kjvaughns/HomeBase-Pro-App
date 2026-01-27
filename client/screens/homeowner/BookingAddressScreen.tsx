import React, { useState } from "react";
import { StyleSheet, View, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Address } from "@/state/types";

type ScreenRouteProp = RouteProp<RootStackParamList, "BookingAddress">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BookingAddressScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const params = route.params;

  const profile = useHomeownerStore((s) => s.profile);
  const addresses = profile?.addresses || [];

  const defaultAddress = addresses.find((a) => a.isDefault);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    defaultAddress?.id || addresses[0]?.id || null
  );

  const handleNext = () => {
    if (!selectedAddressId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("BookingConfirm", {
      ...params,
      addressId: selectedAddressId,
    });
  };

  const renderAddressCard = (address: Address) => {
    const isSelected = selectedAddressId === address.id;
    return (
      <Pressable
        key={address.id}
        onPress={() => {
          Haptics.selectionAsync();
          setSelectedAddressId(address.id);
        }}
        style={[
          styles.addressCard,
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
        <View style={styles.addressContent}>
          <View style={styles.addressHeader}>
            <ThemedText style={styles.addressLabel}>{address.label}</ThemedText>
            {address.isDefault && (
              <View style={[styles.defaultBadge, { backgroundColor: Colors.accentLight }]}>
                <ThemedText style={styles.defaultBadgeText}>Default</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={[styles.addressStreet, { color: theme.textSecondary }]}>
            {address.street}
          </ThemedText>
          <ThemedText style={[styles.addressCity, { color: theme.textTertiary }]}>
            {address.city}, {address.state} {address.zip}
          </ThemedText>
        </View>
        <Feather
          name={isSelected ? "check-circle" : "circle"}
          size={22}
          color={isSelected ? Colors.accent : theme.borderLight}
        />
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
        <ThemedText style={styles.stepIndicator}>Step 3 of 4</ThemedText>

        <ThemedText style={styles.sectionTitle}>Where Should We Come?</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Select the address for this service
        </ThemedText>

        {addresses.length > 0 ? (
          <View style={styles.addressList}>
            {addresses.map(renderAddressCard)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="map-pin" size={48} color={theme.textTertiary} />
            <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
              No saved addresses
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: theme.textTertiary }]}>
              Add an address to continue with your booking
            </ThemedText>
          </View>
        )}

        <SecondaryButton
          label="Add New Address"
          onPress={() => navigation.navigate("Addresses")}
          style={styles.addButton}
        />
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <PrimaryButton
          label="Review Booking"
          onPress={handleNext}
          disabled={!selectedAddressId}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepIndicator: {
    ...Typography.caption1,
    color: Colors.accent,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.title2,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.subhead,
    marginBottom: Spacing.lg,
  },
  addressList: {
    gap: Spacing.md,
  },
  addressCard: {
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
  addressContent: {
    flex: 1,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  addressLabel: {
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
  addressStreet: {
    ...Typography.body,
  },
  addressCity: {
    ...Typography.caption1,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    ...Typography.headline,
    marginTop: Spacing.md,
  },
  emptyText: {
    ...Typography.subhead,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  addButton: {
    marginTop: Spacing.lg,
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
