import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, ScrollView, ActivityIndicator } from "react-native";
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
import { useAuthStore } from "@/state/authStore";
import { getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

interface Home {
  id: string;
  label: string;
  nickname?: string;
  street: string;
  address?: string;
  city: string;
  state: string;
  zip: string;
  zipCode?: string;
  isDefault: boolean;
}

type ScreenRouteProp = RouteProp<RootStackParamList, "BookingAddress">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BookingAddressScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const params = route.params;

  const user = useAuthStore((s) => s.user);
  const [homes, setHomes] = useState<Home[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHomes() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      try {
        const response = await fetch(new URL(`/api/homes/${user.id}`, getApiUrl()).href);
        const data = await response.json();
        const fetchedHomes = data.homes || [];
        setHomes(fetchedHomes);
        const defaultHome = fetchedHomes.find((h: Home) => h.isDefault) || fetchedHomes[0];
        if (defaultHome) {
          setSelectedAddressId(defaultHome.id);
        }
      } catch (error) {
        console.error("Failed to fetch homes:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchHomes();
  }, [user?.id]);

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

  const renderHomeCard = (home: Home) => {
    const isSelected = selectedAddressId === home.id;
    const displayLabel = home.nickname || home.label;
    const displayStreet = home.address || home.street;
    const displayZip = home.zipCode || home.zip;
    return (
      <Pressable
        key={home.id}
        onPress={() => {
          Haptics.selectionAsync();
          setSelectedAddressId(home.id);
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
          {isSelected ? <View style={styles.radioInner} /> : null}
        </View>
        <View style={styles.addressContent}>
          <View style={styles.addressHeader}>
            <ThemedText style={styles.addressLabel}>{displayLabel}</ThemedText>
            {home.isDefault ? (
              <View style={[styles.defaultBadge, { backgroundColor: Colors.accentLight }]}>
                <ThemedText style={styles.defaultBadgeText}>Default</ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText style={[styles.addressStreet, { color: theme.textSecondary }]}>
            {displayStreet}
          </ThemedText>
          <ThemedText style={[styles.addressCity, { color: theme.textTertiary }]}>
            {home.city}, {home.state} {displayZip}
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

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </ThemedView>
    );
  }

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

        {homes.length > 0 ? (
          <View style={styles.addressList}>
            {homes.map(renderHomeCard)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="map-pin" size={48} color={theme.textTertiary} />
            <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
              No saved homes
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: theme.textTertiary }]}>
              Add a home to continue with your booking
            </ThemedText>
          </View>
        )}

        <SecondaryButton
          onPress={() => navigation.navigate("Addresses")}
          style={styles.addButton}
        >
          <ThemedText style={{ color: Colors.accent, fontWeight: "600" }}>Add New Home</ThemedText>
        </SecondaryButton>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <PrimaryButton
          onPress={handleNext}
          disabled={!selectedAddressId}
        >
          <ThemedText style={{ color: "#fff", fontWeight: "600" }}>Review Booking</ThemedText>
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
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
    paddingVertical: Spacing["3xl"],
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
