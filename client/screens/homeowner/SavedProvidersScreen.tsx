import React from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { ProviderCard } from "@/components/ProviderCard";
import { useTheme } from "@/hooks/useTheme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SavedProvidersScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  
  const savedProviders = useHomeownerStore((s) => s.getSavedProviders());

  const handleProviderPress = (providerId: string) => {
    navigation.navigate("ProviderProfile", { providerId });
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundElevated }]}>
        <Feather name="heart" size={40} color={theme.textSecondary} />
      </View>
      <ThemedText style={styles.emptyTitle}>No Saved Providers</ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        When you save providers, they'll appear here for quick access.
      </ThemedText>
      <Pressable
        style={[styles.browseButton, { backgroundColor: Colors.accent }]}
        onPress={() => navigation.goBack()}
      >
        <ThemedText style={styles.browseButtonText}>Browse Providers</ThemedText>
      </Pressable>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={savedProviders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProviderCard
            name={item.name}
            businessName={item.businessName}
            avatarUrl={item.avatarUrl}
            rating={item.rating}
            reviewCount={item.reviewCount}
            services={item.services}
            hourlyRate={item.hourlyRate}
            verified={item.verified}
            onPress={() => handleProviderPress(item.id)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.md,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"] * 2,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.title3,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  browseButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  browseButtonText: {
    ...Typography.callout,
    fontWeight: "600",
    color: "#FFF",
  },
});
