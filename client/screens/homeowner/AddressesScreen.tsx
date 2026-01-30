import React, { useState, useCallback, useEffect } from "react";
import { StyleSheet, View, ScrollView, Pressable, RefreshControl, Modal, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { AddressAutocomplete, EnrichmentData } from "@/components/AddressAutocomplete";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { getApiUrl } from "@/lib/query-client";

interface Home {
  id: string;
  userId: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  estimatedValue?: string;
  propertyType?: string;
  formattedAddress?: string;
  neighborhoodName?: string;
  countyName?: string;
  latitude?: string;
  longitude?: string;
  placeId?: string;
  zillowUrl?: string;
  housefaxEnrichedAt?: string;
}

export default function AddressesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuthStore();

  const [homes, setHomes] = useState<Home[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHome, setEditingHome] = useState<Home | null>(null);
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentData | null>(null);
  const [nickname, setNickname] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchHomes = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(new URL(`/api/homes/${user.id}`, getApiUrl()).href);
      if (response.ok) {
        const data = await response.json();
        setHomes(data.homes || []);
      }
    } catch (error) {
      console.error("Failed to fetch homes:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchHomes();
  }, [fetchHomes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHomes();
    setRefreshing(false);
  };

  const handleAddressSelected = (data: EnrichmentData) => {
    setEnrichmentData(data);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const normalizePropertyType = (type?: string): string | undefined => {
    if (!type) return undefined;
    const normalized = type.toLowerCase().replace(/\s+/g, "_");
    const validTypes = ["single_family", "condo", "townhouse", "apartment", "multi_family"];
    if (validTypes.includes(normalized)) return normalized;
    if (normalized.includes("single") || normalized.includes("house")) return "single_family";
    if (normalized.includes("condo")) return "condo";
    if (normalized.includes("town")) return "townhouse";
    if (normalized.includes("apart")) return "apartment";
    if (normalized.includes("multi") || normalized.includes("duplex")) return "multi_family";
    return "single_family";
  };

  const handleSaveHome = async () => {
    if (!user?.id || !enrichmentData) return;

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const homeData = {
        userId: user.id,
        label: nickname || "My Home",
        street: enrichmentData.street,
        city: enrichmentData.city,
        state: enrichmentData.state,
        zip: enrichmentData.zipCode,
        formattedAddress: enrichmentData.formattedAddress,
        placeId: enrichmentData.placeId,
        latitude: enrichmentData.latitude?.toString(),
        longitude: enrichmentData.longitude?.toString(),
        neighborhoodName: enrichmentData.neighborhoodName,
        countyName: enrichmentData.countyName,
        bedrooms: enrichmentData.bedrooms,
        bathrooms: enrichmentData.bathrooms,
        squareFeet: enrichmentData.squareFeet,
        yearBuilt: enrichmentData.yearBuilt,
        propertyType: normalizePropertyType(enrichmentData.propertyType),
        estimatedValue: enrichmentData.estimatedValue?.toString(),
        lotSize: enrichmentData.lotSize?.toString(),
        zillowId: enrichmentData.zillowId,
        zillowUrl: enrichmentData.zillowUrl,
        taxAssessedValue: enrichmentData.taxAssessedValue?.toString(),
        lastSoldDate: enrichmentData.lastSoldDate,
        lastSoldPrice: enrichmentData.lastSoldPrice?.toString(),
        isDefault: homes.length === 0,
      };

      const response = await fetch(new URL("/api/homes", getApiUrl()).href, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(homeData),
      });

      if (response.ok) {
        setShowAddModal(false);
        setEnrichmentData(null);
        setNickname("");
        await fetchHomes();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Failed to save home:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateNickname = async () => {
    if (!editingHome) return;

    setIsSaving(true);
    try {
      const response = await fetch(new URL(`/api/homes/${editingHome.id}`, getApiUrl()).href, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: nickname }),
      });

      if (response.ok) {
        setEditingHome(null);
        setNickname("");
        await fetchHomes();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Failed to update home:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (homeId: string) => {
    Haptics.selectionAsync();
    try {
      const response = await fetch(new URL(`/api/homes/${homeId}`, getApiUrl()).href, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });

      if (response.ok) {
        setHomes((prev) =>
          prev.map((h) => ({
            ...h,
            isDefault: h.id === homeId,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to set default:", error);
    }
  };

  const handleDelete = (home: Home) => {
    Alert.alert(
      "Delete Home",
      `Are you sure you want to delete "${home.label}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              const response = await fetch(new URL(`/api/homes/${home.id}`, getApiUrl()).href, {
                method: "DELETE",
              });
              if (response.ok) {
                await fetchHomes();
              }
            } catch (error) {
              console.error("Failed to delete home:", error);
            }
          },
        },
      ]
    );
  };

  const formatValue = (value?: string | number) => {
    if (!value) return null;
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
  };

  const renderHomeCard = (home: Home, index: number) => (
    <Animated.View key={home.id} entering={FadeInDown.delay(index * 100).duration(400)}>
      <GlassCard style={styles.homeCard}>
        <View style={styles.homeHeader}>
          <View style={styles.homeLabel}>
            <View style={[styles.homeIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name="home" size={18} color={Colors.accent} />
            </View>
            <View style={styles.homeLabelText}>
              <ThemedText style={styles.homeNickname}>{home.label}</ThemedText>
              {home.isDefault ? (
                <View style={[styles.defaultBadge, { backgroundColor: Colors.accentLight }]}>
                  <ThemedText style={styles.defaultBadgeText}>Primary</ThemedText>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.homeActions}>
            <Pressable
              onPress={() => {
                setEditingHome(home);
                setNickname(home.label);
              }}
              style={styles.actionBtn}
            >
              <Feather name="edit-2" size={16} color={theme.textSecondary} />
            </Pressable>
            <Pressable onPress={() => handleDelete(home)} style={styles.actionBtn}>
              <Feather name="trash-2" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.addressSection}>
          <Feather name="map-pin" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.addressText, { color: theme.textSecondary }]}>
            {home.formattedAddress || `${home.street}, ${home.city}, ${home.state} ${home.zip}`}
          </ThemedText>
        </View>

        {(home.bedrooms || home.bathrooms || home.squareFeet || home.yearBuilt) ? (
          <View style={styles.propertyDetails}>
            {home.bedrooms ? (
              <View style={styles.detailItem}>
                <Feather name="moon" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  {home.bedrooms} bed
                </ThemedText>
              </View>
            ) : null}
            {home.bathrooms ? (
              <View style={styles.detailItem}>
                <Feather name="droplet" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  {home.bathrooms} bath
                </ThemedText>
              </View>
            ) : null}
            {home.squareFeet ? (
              <View style={styles.detailItem}>
                <Feather name="maximize" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  {home.squareFeet.toLocaleString()} sqft
                </ThemedText>
              </View>
            ) : null}
            {home.yearBuilt ? (
              <View style={styles.detailItem}>
                <Feather name="calendar" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  Built {home.yearBuilt}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}

        {home.estimatedValue ? (
          <View style={[styles.valueSection, { borderTopColor: theme.borderLight }]}>
            <ThemedText style={[styles.valueLabel, { color: theme.textSecondary }]}>Estimated Value</ThemedText>
            <ThemedText style={styles.valueAmount}>{formatValue(home.estimatedValue)}</ThemedText>
          </View>
        ) : null}

        {home.housefaxEnrichedAt ? (
          <View style={styles.enrichedBadge}>
            <Feather name="check-circle" size={12} color={Colors.accent} />
            <ThemedText style={[styles.enrichedText, { color: Colors.accent }]}>HouseFax Verified</ThemedText>
          </View>
        ) : null}

        {!home.isDefault ? (
          <Pressable onPress={() => handleSetDefault(home.id)} style={[styles.setDefaultBtn, { borderTopColor: theme.borderLight }]}>
            <ThemedText style={[styles.setDefaultText, { color: Colors.accent }]}>Set as Primary</ThemedText>
          </Pressable>
        ) : null}
      </GlassCard>
    </Animated.View>
  );

  const renderAddModal = () => (
    <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
      <ThemedView style={styles.modalContainer}>
        <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={() => { setShowAddModal(false); setEnrichmentData(null); setNickname(""); }}>
            <ThemedText style={[styles.modalCancel, { color: Colors.accent }]}>Cancel</ThemedText>
          </Pressable>
          <ThemedText style={styles.modalTitle}>Add Home</ThemedText>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.modalContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modalIcon}>
            <Feather name="home" size={48} color={Colors.accent} />
          </View>

          <ThemedText style={styles.modalSubtitle}>
            Search for your address to automatically find property details
          </ThemedText>

          <View style={styles.formSection}>
            <ThemedText style={[styles.formLabel, { color: theme.textSecondary }]}>Home Nickname</ThemedText>
            <TextField
              placeholder="e.g., Main House, Beach House"
              value={nickname}
              onChangeText={setNickname}
            />
          </View>

          <View style={styles.formSection}>
            <ThemedText style={[styles.formLabel, { color: theme.textSecondary }]}>Address</ThemedText>
            <AddressAutocomplete
              onAddressSelected={handleAddressSelected}
              placeholder="Start typing your address..."
              testID="input-add-address"
            />
          </View>

          {enrichmentData ? (
            <Animated.View entering={FadeInDown.duration(400)}>
              <GlassCard style={styles.enrichedCard}>
                <View style={styles.enrichedHeader}>
                  <Feather name="check-circle" size={20} color={Colors.accent} />
                  <ThemedText style={styles.enrichedTitle}>Property Found</ThemedText>
                </View>

                <View style={styles.enrichedDetails}>
                  {enrichmentData.bedrooms ? (
                    <View style={styles.enrichedItem}>
                      <ThemedText style={styles.enrichedValue}>{enrichmentData.bedrooms}</ThemedText>
                      <ThemedText style={[styles.enrichedLabel, { color: theme.textSecondary }]}>Beds</ThemedText>
                    </View>
                  ) : null}
                  {enrichmentData.bathrooms ? (
                    <View style={styles.enrichedItem}>
                      <ThemedText style={styles.enrichedValue}>{enrichmentData.bathrooms}</ThemedText>
                      <ThemedText style={[styles.enrichedLabel, { color: theme.textSecondary }]}>Baths</ThemedText>
                    </View>
                  ) : null}
                  {enrichmentData.squareFeet ? (
                    <View style={styles.enrichedItem}>
                      <ThemedText style={styles.enrichedValue}>{enrichmentData.squareFeet.toLocaleString()}</ThemedText>
                      <ThemedText style={[styles.enrichedLabel, { color: theme.textSecondary }]}>Sq Ft</ThemedText>
                    </View>
                  ) : null}
                  {enrichmentData.yearBuilt ? (
                    <View style={styles.enrichedItem}>
                      <ThemedText style={styles.enrichedValue}>{enrichmentData.yearBuilt}</ThemedText>
                      <ThemedText style={[styles.enrichedLabel, { color: theme.textSecondary }]}>Built</ThemedText>
                    </View>
                  ) : null}
                </View>

                {enrichmentData.estimatedValue ? (
                  <View style={[styles.enrichedValueSection, { borderTopColor: theme.borderLight }]}>
                    <ThemedText style={[styles.enrichedValueLabel, { color: theme.textSecondary }]}>
                      Estimated Value
                    </ThemedText>
                    <ThemedText style={styles.enrichedValueAmount}>
                      {formatValue(enrichmentData.estimatedValue)}
                    </ThemedText>
                  </View>
                ) : null}
              </GlassCard>
            </Animated.View>
          ) : null}

          <View style={[styles.modalActions, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <PrimaryButton
              onPress={handleSaveHome}
              disabled={!enrichmentData || isSaving}
            >
              {isSaving ? "Saving..." : "Save Home"}
            </PrimaryButton>
          </View>
        </ScrollView>
      </ThemedView>
    </Modal>
  );

  const renderEditModal = () => (
    <Modal visible={!!editingHome} animationType="slide" transparent>
      <View style={styles.editModalOverlay}>
        <View style={[styles.editModalContent, { backgroundColor: theme.cardBackground }]}>
          <ThemedText style={styles.editModalTitle}>Edit Nickname</ThemedText>
          <TextField
            placeholder="Home nickname"
            value={nickname}
            onChangeText={setNickname}
            autoFocus
          />
          <View style={styles.editModalActions}>
            <SecondaryButton onPress={() => { setEditingHome(null); setNickname(""); }} style={styles.editModalBtn}>Cancel</SecondaryButton>
            <PrimaryButton
              onPress={handleUpdateNickname}
              disabled={!nickname || isSaving}
              style={styles.editModalBtn}
            >
              {isSaving ? "Saving..." : "Save"}
            </PrimaryButton>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText style={{ color: theme.textSecondary }}>Loading homes...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {homes.length > 0 ? (
          homes.map((home, index) => renderHomeCard(home, index))
        ) : (
          <Animated.View entering={FadeInDown.duration(400)}>
            <GlassCard style={styles.emptyCard}>
              <Feather name="home" size={48} color={theme.textSecondary} />
              <ThemedText style={styles.emptyTitle}>No Homes Added</ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Add your first home to unlock personalized service recommendations
              </ThemedText>
            </GlassCard>
          </Animated.View>
        )}

        <Pressable
          onPress={() => setShowAddModal(true)}
          style={[styles.addButton, { borderColor: theme.borderLight }]}
        >
          <Feather name="plus" size={20} color={Colors.accent} />
          <ThemedText style={[styles.addButtonText, { color: Colors.accent }]}>Add New Home</ThemedText>
        </Pressable>
      </ScrollView>

      {renderAddModal()}
      {renderEditModal()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  homeCard: {
    marginBottom: Spacing.md,
  },
  homeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  homeLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  homeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  homeLabelText: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flex: 1,
  },
  homeNickname: {
    ...Typography.headline,
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
  homeActions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  actionBtn: {
    padding: Spacing.xs,
  },
  addressSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  addressText: {
    ...Typography.subhead,
    flex: 1,
  },
  propertyDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    ...Typography.caption1,
  },
  valueSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  valueLabel: {
    ...Typography.caption1,
  },
  valueAmount: {
    ...Typography.headline,
    color: Colors.accent,
  },
  enrichedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.sm,
  },
  enrichedText: {
    ...Typography.caption2,
    fontWeight: "600",
  },
  setDefaultBtn: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  setDefaultText: {
    ...Typography.caption1,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  emptyTitle: {
    ...Typography.headline,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    ...Typography.subhead,
    textAlign: "center",
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.lg,
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
    marginTop: Spacing.sm,
  },
  addButtonText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.md,
  },
  modalCancel: {
    ...Typography.body,
  },
  modalTitle: {
    ...Typography.headline,
  },
  modalContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
  },
  modalIcon: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalSubtitle: {
    ...Typography.subhead,
    textAlign: "center",
    marginBottom: Spacing.xl,
    opacity: 0.7,
  },
  formSection: {
    marginBottom: Spacing.lg,
  },
  formLabel: {
    ...Typography.caption1,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  enrichedCard: {
    marginTop: Spacing.md,
  },
  enrichedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  enrichedTitle: {
    ...Typography.headline,
    color: Colors.accent,
  },
  enrichedDetails: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  enrichedItem: {
    alignItems: "center",
  },
  enrichedValue: {
    ...Typography.title2,
  },
  enrichedLabel: {
    ...Typography.caption2,
  },
  enrichedValueSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  enrichedValueLabel: {
    ...Typography.caption1,
  },
  enrichedValueAmount: {
    ...Typography.title3,
    color: Colors.accent,
  },
  modalActions: {
    marginTop: Spacing.xl,
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  editModalContent: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  editModalTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  editModalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  editModalBtn: {
    flex: 1,
  },
});
