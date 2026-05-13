import React, { useState } from "react";
import { StyleSheet, View, Pressable, Modal, FlatList, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";

export interface Home {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  lotSize?: number;
  estimatedValue?: string;
  isDefault?: boolean;
}

interface HomeSelectorProps {
  selectedHome: Home | null;
  onSelectHome: (home: Home) => void;
  onAddNew?: () => void;
  compact?: boolean;
}

export function HomeSelector({ selectedHome, onSelectHome, onAddNew, compact = false }: HomeSelectorProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuthStore();
  const [modalVisible, setModalVisible] = useState(false);

  const { data, isLoading } = useQuery<{ homes: Home[] }>({
    queryKey: ["/api/homes", user?.id],
    enabled: !!user?.id,
  });

  const homes = data?.homes || [];

  const formatAddress = (home: Home) => {
    return `${home.street}, ${home.city}, ${home.state}`;
  };

  const renderHomeItem = ({ item }: { item: Home }) => (
    <Pressable
      style={[
        styles.homeItem,
        {
          backgroundColor: selectedHome?.id === item.id ? Colors.accentLight : theme.cardBackground,
          borderColor: selectedHome?.id === item.id ? Colors.accent : theme.borderLight,
        },
      ]}
      onPress={() => {
        onSelectHome(item);
        setModalVisible(false);
      }}
    >
      <View style={styles.homeItemContent}>
        <View style={styles.homeItemHeader}>
          <ThemedText style={styles.homeItemLabel}>{item.label}</ThemedText>
          {item.isDefault ? (
            <View style={[styles.defaultBadge, { backgroundColor: Colors.accentLight }]}>
              <ThemedText style={[styles.defaultBadgeText, { color: Colors.accent }]}>Default</ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText style={[styles.homeItemAddress, { color: theme.textSecondary }]}>
          {formatAddress(item)}
        </ThemedText>
        {item.bedrooms || item.squareFeet ? (
          <View style={styles.homeItemDetails}>
            {item.bedrooms ? (
              <ThemedText style={[styles.homeItemDetail, { color: theme.textTertiary }]}>
                {item.bedrooms} bed
              </ThemedText>
            ) : null}
            {item.bathrooms ? (
              <ThemedText style={[styles.homeItemDetail, { color: theme.textTertiary }]}>
                {item.bathrooms} bath
              </ThemedText>
            ) : null}
            {item.squareFeet ? (
              <ThemedText style={[styles.homeItemDetail, { color: theme.textTertiary }]}>
                {item.squareFeet.toLocaleString()} sqft
              </ThemedText>
            ) : null}
            {item.yearBuilt ? (
              <ThemedText style={[styles.homeItemDetail, { color: theme.textTertiary }]}>
                Built {item.yearBuilt}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </View>
      <Feather 
        name={selectedHome?.id === item.id ? "check-circle" : "chevron-right"} 
        size={20} 
        color={selectedHome?.id === item.id ? Colors.accent : theme.textTertiary} 
      />
    </Pressable>
  );

  if (compact) {
    return (
      <>
        <Pressable
          style={[styles.compactSelector, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}
          onPress={() => setModalVisible(true)}
        >
          <View style={[styles.compactIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name="home" size={16} color={Colors.accent} />
          </View>
          <View style={styles.compactContent}>
            {selectedHome ? (
              <>
                <ThemedText style={styles.compactLabel}>{selectedHome.label}</ThemedText>
                <ThemedText style={[styles.compactAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                  {formatAddress(selectedHome)}
                </ThemedText>
                {selectedHome.bedrooms || selectedHome.squareFeet ? (
                  <View style={styles.compactDetails}>
                    {selectedHome.bedrooms ? (
                      <ThemedText style={[styles.compactDetail, { color: theme.textTertiary }]}>
                        {selectedHome.bedrooms} bed
                      </ThemedText>
                    ) : null}
                    {selectedHome.bathrooms ? (
                      <ThemedText style={[styles.compactDetail, { color: theme.textTertiary }]}>
                        {selectedHome.bathrooms} bath
                      </ThemedText>
                    ) : null}
                    {selectedHome.squareFeet ? (
                      <ThemedText style={[styles.compactDetail, { color: theme.textTertiary }]}>
                        {selectedHome.squareFeet.toLocaleString()} sqft
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : (
              <ThemedText style={[styles.compactPlaceholder, { color: theme.textSecondary }]}>
                Select a home
              </ThemedText>
            )}
          </View>
          <Feather name="chevron-down" size={20} color={theme.textSecondary} />
        </Pressable>

        <Modal
          visible={modalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.separator }]}>
              <ThemedText style={styles.modalTitle}>Select Home</ThemedText>
              <Pressable onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
            ) : homes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="home" size={48} color={theme.textTertiary} />
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No homes saved yet
                </ThemedText>
                {onAddNew ? (
                  <Pressable 
                    style={[styles.addButton, { backgroundColor: Colors.accent }]}
                    onPress={() => {
                      setModalVisible(false);
                      onAddNew();
                    }}
                  >
                    <Feather name="plus" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.addButtonText}>Add Home</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <FlatList
                data={homes}
                renderItem={renderHomeItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.homesList}
                ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
                ListFooterComponent={
                  onAddNew ? (
                    <Pressable 
                      style={[styles.addHomeRow, { borderColor: theme.borderLight }]}
                      onPress={() => {
                        setModalVisible(false);
                        onAddNew();
                      }}
                    >
                      <Feather name="plus" size={20} color={Colors.accent} />
                      <ThemedText style={[styles.addHomeText, { color: Colors.accent }]}>
                        Add New Home
                      </ThemedText>
                    </Pressable>
                  ) : null
                }
              />
            )}
          </View>
        </Modal>
      </>
    );
  }

  return (
    <GlassCard style={styles.selectorCard}>
      <View style={styles.selectorHeader}>
        <ThemedText style={styles.selectorTitle}>Select Home</ThemedText>
        {onAddNew ? (
          <Pressable onPress={onAddNew}>
            <Feather name="plus" size={20} color={Colors.accent} />
          </Pressable>
        ) : null}
      </View>
      {isLoading ? (
        <ActivityIndicator size="small" color={Colors.accent} style={{ paddingVertical: Spacing.lg }} />
      ) : homes.length === 0 ? (
        <View style={styles.emptyState}>
          <ThemedText style={[styles.emptyStateText, { color: theme.textSecondary }]}>
            No homes saved
          </ThemedText>
          {onAddNew ? (
            <Pressable 
              style={[styles.addButton, { backgroundColor: Colors.accent }]}
              onPress={onAddNew}
            >
              <Feather name="plus" size={18} color="#FFFFFF" />
              <ThemedText style={styles.addButtonText}>Add Home</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.homeCards}>
          {homes.map((home) => (
            <Pressable
              key={home.id}
              style={[
                styles.homeCard,
                {
                  backgroundColor: selectedHome?.id === home.id ? Colors.accentLight : theme.cardBackground,
                  borderColor: selectedHome?.id === home.id ? Colors.accent : theme.borderLight,
                },
              ]}
              onPress={() => onSelectHome(home)}
            >
              <View style={styles.homeCardContent}>
                <ThemedText style={styles.homeCardLabel}>{home.label}</ThemedText>
                <ThemedText style={[styles.homeCardAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                  {formatAddress(home)}
                </ThemedText>
                {home.bedrooms || home.squareFeet ? (
                  <View style={styles.homeCardDetails}>
                    {home.bedrooms ? (
                      <ThemedText style={[styles.homeCardDetail, { color: theme.textTertiary }]}>
                        {home.bedrooms} bed
                      </ThemedText>
                    ) : null}
                    {home.bathrooms ? (
                      <ThemedText style={[styles.homeCardDetail, { color: theme.textTertiary }]}>
                        {home.bathrooms} bath
                      </ThemedText>
                    ) : null}
                    {home.squareFeet ? (
                      <ThemedText style={[styles.homeCardDetail, { color: theme.textTertiary }]}>
                        {home.squareFeet.toLocaleString()} sqft
                      </ThemedText>
                    ) : null}
                    {home.yearBuilt ? (
                      <ThemedText style={[styles.homeCardDetail, { color: theme.textTertiary }]}>
                        Built {home.yearBuilt}
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}
              </View>
              {selectedHome?.id === home.id ? (
                <Feather name="check-circle" size={20} color={Colors.accent} />
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  selectorCard: {
    padding: Spacing.md,
  },
  selectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  selectorTitle: {
    ...Typography.title3,
  },
  homeCards: {
    gap: Spacing.sm,
  },
  homeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  homeCardContent: {
    flex: 1,
  },
  homeCardLabel: {
    ...Typography.headline,
    marginBottom: 2,
  },
  homeCardAddress: {
    ...Typography.caption,
  },
  homeCardDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  homeCardDetail: {
    ...Typography.caption,
    fontSize: 11,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  emptyStateText: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  addButtonText: {
    ...Typography.headline,
    color: "#FFFFFF",
  },
  compactSelector: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  compactIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  compactContent: {
    flex: 1,
  },
  compactLabel: {
    ...Typography.headline,
  },
  compactAddress: {
    ...Typography.caption,
  },
  compactPlaceholder: {
    ...Typography.body,
  },
  compactDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: 2,
  },
  compactDetail: {
    ...Typography.caption,
    fontSize: 11,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    ...Typography.title3,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
  },
  homesList: {
    padding: Spacing.md,
  },
  homeItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  homeItemContent: {
    flex: 1,
  },
  homeItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  homeItemLabel: {
    ...Typography.headline,
  },
  defaultBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  defaultBadgeText: {
    ...Typography.caption,
    fontSize: 10,
  },
  homeItemAddress: {
    ...Typography.caption,
    marginTop: 2,
  },
  homeItemDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  homeItemDetail: {
    ...Typography.caption,
    fontSize: 11,
  },
  addHomeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  addHomeText: {
    ...Typography.headline,
  },
});
