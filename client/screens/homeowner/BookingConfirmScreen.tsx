import React, { useState, useMemo } from "react";
import { StyleSheet, View, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { Avatar } from "@/components/Avatar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type ScreenRouteProp = RouteProp<RootStackParamList, "BookingConfirm">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const URGENCY_LABELS: Record<string, string> = {
  flexible: "Flexible",
  soon: "Within 1-2 weeks",
  urgent: "Within 2-3 days",
  emergency: "Emergency",
};

const SIZE_LABELS: Record<string, string> = {
  small: "Small (under 2 hours)",
  medium: "Medium (half day)",
  large: "Large (full day+)",
};

export default function BookingConfirmScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const params = route.params;

  const providers = useHomeownerStore((s) => s.providers);
  const profile = useHomeownerStore((s) => s.profile);
  const createBooking = useHomeownerStore((s) => s.createBooking);
  
  const provider = useMemo(() => providers.find((p) => p.id === params.providerId), [providers, params.providerId]);

  const address = profile?.addresses.find((a) => a.id === params.addressId);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const estimatedPrice = provider ? provider.hourlyRate * 2 : 150;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const job = createBooking({
        categoryId: params.categoryId,
        providerId: params.providerId,
        service: params.service,
        description: params.description,
        urgency: params.urgency,
        size: params.size,
        photoUrls: params.photoUrls,
        scheduledDate: params.scheduledDate,
        scheduledTime: params.scheduledTime,
        addressId: params.addressId,
      });

      navigation.reset({
        index: 0,
        routes: [
          { name: "Main" },
          { name: "BookingSuccess", params: { jobId: job.id } },
        ],
      });
    } catch (error) {
      console.error("Booking failed:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!provider) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Provider not found</ThemedText>
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
        <ThemedText style={styles.stepIndicator}>Step 4 of 4</ThemedText>
        <ThemedText style={styles.title}>Review Your Booking</ThemedText>

        <GlassCard style={styles.providerCard}>
          <View style={styles.providerRow}>
            <Avatar name={provider.name} size={56} imageUrl={provider.avatarUrl} />
            <View style={styles.providerInfo}>
              <ThemedText style={styles.providerName}>{provider.name}</ThemedText>
              <ThemedText style={[styles.businessName, { color: theme.textSecondary }]}>
                {provider.businessName}
              </ThemedText>
            </View>
          </View>
        </GlassCard>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Service Details</ThemedText>
          
          <View style={[styles.detailRow, { borderColor: theme.borderLight }]}>
            <Feather name="tool" size={18} color={theme.textSecondary} />
            <View style={styles.detailContent}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Service
              </ThemedText>
              <ThemedText style={styles.detailValue}>{params.service}</ThemedText>
            </View>
          </View>

          <View style={[styles.detailRow, { borderColor: theme.borderLight }]}>
            <Feather name="file-text" size={18} color={theme.textSecondary} />
            <View style={styles.detailContent}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Description
              </ThemedText>
              <ThemedText style={styles.detailValue}>{params.description}</ThemedText>
            </View>
          </View>

          <View style={[styles.detailRow, { borderColor: theme.borderLight }]}>
            <Feather name="clock" size={18} color={theme.textSecondary} />
            <View style={styles.detailContent}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Urgency
              </ThemedText>
              <ThemedText style={styles.detailValue}>
                {URGENCY_LABELS[params.urgency]}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.detailRow, { borderColor: theme.borderLight }]}>
            <Feather name="layers" size={18} color={theme.textSecondary} />
            <View style={styles.detailContent}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Job Size
              </ThemedText>
              <ThemedText style={styles.detailValue}>{SIZE_LABELS[params.size]}</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Schedule</ThemedText>
          
          <View style={[styles.detailRow, { borderColor: theme.borderLight }]}>
            <Feather name="calendar" size={18} color={theme.textSecondary} />
            <View style={styles.detailContent}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Date & Time
              </ThemedText>
              <ThemedText style={styles.detailValue}>
                {params.scheduledDate} at {params.scheduledTime}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.detailRow, { borderColor: theme.borderLight }]}>
            <Feather name="map-pin" size={18} color={theme.textSecondary} />
            <View style={styles.detailContent}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Address
              </ThemedText>
              <ThemedText style={styles.detailValue}>
                {address?.street}, {address?.city}, {address?.state} {address?.zip}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.pricingCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
          <ThemedText style={styles.pricingTitle}>Estimated Price</ThemedText>
          <View style={styles.priceRow}>
            <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
              Based on hourly rate
            </ThemedText>
            <ThemedText style={styles.priceValue}>${estimatedPrice}</ThemedText>
          </View>
          <ThemedText style={[styles.priceNote, { color: theme.textTertiary }]}>
            Final price may vary based on actual work completed
          </ThemedText>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <PrimaryButton
          label={isSubmitting ? "" : "Confirm Booking"}
          onPress={handleConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting && <ActivityIndicator color="#fff" />}
        </PrimaryButton>
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
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.title1,
    fontWeight: "700",
    marginBottom: Spacing.lg,
  },
  providerCard: {
    marginBottom: Spacing.lg,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  providerInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  providerName: {
    ...Typography.headline,
    fontWeight: "600",
  },
  businessName: {
    ...Typography.subhead,
    marginTop: 2,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    ...Typography.caption1,
    marginBottom: 2,
  },
  detailValue: {
    ...Typography.body,
  },
  pricingCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  pricingTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  priceLabel: {
    ...Typography.body,
  },
  priceValue: {
    ...Typography.title1,
    fontWeight: "700",
    color: Colors.accent,
  },
  priceNote: {
    ...Typography.caption1,
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
