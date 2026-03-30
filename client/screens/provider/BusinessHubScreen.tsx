import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Switch,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useProviderStore } from "@/state/providerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type HubTab = "profile" | "services" | "booking" | "policies";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TABS: { key: HubTab; label: string; icon: string }[] = [
  { key: "profile", label: "Profile", icon: "user" },
  { key: "services", label: "Services", icon: "tool" },
  { key: "booking", label: "Booking", icon: "link" },
  { key: "policies", label: "Policies", icon: "file-text" },
];

interface ProviderService {
  id: string;
  name: string;
  category: string;
  pricingType: "fixed" | "variable" | "service_call" | "quote";
  basePrice: string | null;
  isPublished: boolean;
}

interface BookingLink {
  id: string;
  title: string;
  isActive: boolean;
  slug: string;
}

function getPricingLabel(type: string): string {
  switch (type) {
    case "fixed": return "Fixed";
    case "variable": return "Variable";
    case "service_call": return "Service Call";
    case "quote": return "Quote";
    default: return type;
  }
}

export default function BusinessHubScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user, providerProfile } = useAuthStore();
  const availableForWork = useProviderStore((s) => s.availableForWork);
  const setAvailableForWork = useProviderStore((s) => s.setAvailableForWork);
  const bookingPolicies = useProviderStore((s) => s.bookingPolicies);

  const [activeTab, setActiveTab] = useState<HubTab>("profile");

  const providerId = providerProfile?.id;

  const { data: servicesData, isLoading: servicesLoading } = useQuery<{ services: ProviderService[] }>({
    queryKey: ["/api/provider", providerId, "custom-services"],
    enabled: !!providerId && activeTab === "services",
  });

  const { data: bookingLinksData, isLoading: bookingLoading } = useQuery<{ bookingLinks: BookingLink[] }>({
    queryKey: ["/api/provider", providerId, "booking-links"],
    enabled: !!providerId && activeTab === "booking",
  });

  const services = servicesData?.services || [];
  const bookingLinks = bookingLinksData?.bookingLinks || [];

  const handleTabPress = (tab: HubTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const renderProfileTab = () => (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(300)}>
        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Business Info</ThemedText>
            <Pressable onPress={() => navigation.navigate("BusinessDetails")} style={styles.editBtn}>
              <Feather name="edit-2" size={14} color={Colors.accent} />
              <ThemedText style={[styles.editLabel, { color: Colors.accent }]}>Edit</ThemedText>
            </Pressable>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>Business Name</ThemedText>
            <ThemedText style={styles.infoValue}>
              {providerProfile?.businessName || user?.name || "Not set"}
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>License</ThemedText>
            <ThemedText style={styles.infoValue}>
              {providerProfile?.licenseNumber || "Not provided"}
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>Rating</ThemedText>
            <View style={styles.ratingRow}>
              <Feather name="star" size={14} color={Colors.warning} />
              <ThemedText style={styles.infoValue}>
                {providerProfile?.rating ? Number(providerProfile.rating).toFixed(1) : "New"}
              </ThemedText>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Availability</ThemedText>
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.infoValue}>Available for Work</ThemedText>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Accept new job requests
              </ThemedText>
            </View>
            <Switch
              value={availableForWork}
              onValueChange={setAvailableForWork}
              trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Business Hours</ThemedText>
            <Pressable onPress={() => navigation.navigate("BusinessDetails")} style={styles.editBtn}>
              <Feather name="edit-2" size={14} color={Colors.accent} />
              <ThemedText style={[styles.editLabel, { color: Colors.accent }]}>Edit</ThemedText>
            </Pressable>
          </View>
          <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
            Configure your business hours and service area in Business Details.
          </ThemedText>
        </GlassCard>

        <Pressable
          style={[styles.previewBtn, { borderColor: theme.borderLight }]}
          onPress={() => navigation.navigate("BusinessProfile")}
        >
          <Feather name="eye" size={16} color={theme.textSecondary} />
          <ThemedText style={[styles.previewBtnText, { color: theme.textSecondary }]}>
            Preview Public Profile
          </ThemedText>
          <Feather name="chevron-right" size={16} color={theme.textTertiary} />
        </Pressable>
      </Animated.View>
    </ScrollView>
  );

  const renderServicesTab = () => (
    servicesLoading ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    ) : (
      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.tabContent,
          services.length === 0 && styles.emptyContainer,
        ]}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(300)}>
            <Pressable
              style={[styles.addServiceBtn, { backgroundColor: Colors.accent }]}
              onPress={() => navigation.navigate("NewService")}
              testID="button-add-service"
            >
              <Feather name="plus" size={16} color="#FFFFFF" />
              <ThemedText style={styles.addServiceLabel}>Add Service</ThemedText>
            </Pressable>
          </Animated.View>
        }
        ListEmptyComponent={
          <EmptyState
            image={require("../../../assets/images/empty-bookings.png")}
            title="No services yet"
            description="Create your first service listing to attract clients."
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
            <GlassCard style={styles.serviceCard}>
              <View style={styles.serviceRow}>
                <View style={styles.serviceIcon}>
                  <Feather name="tool" size={16} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.serviceName}>{item.name}</ThemedText>
                  <ThemedText style={[styles.serviceCategory, { color: theme.textSecondary }]}>
                    {item.category} · {getPricingLabel(item.pricingType)}
                    {item.basePrice ? ` · $${parseFloat(item.basePrice).toFixed(0)}` : ""}
                  </ThemedText>
                </View>
                <View style={styles.serviceActions}>
                  <StatusPill
                    status={item.isPublished ? "success" : "neutral"}
                    label={item.isPublished ? "Live" : "Draft"}
                    size="small"
                  />
                  <Pressable
                    onPress={() => navigation.navigate("EditService", { serviceId: item.id, service: item as Record<string, unknown> })}
                    style={styles.editIconBtn}
                  >
                    <Feather name="chevron-right" size={18} color={theme.textTertiary} />
                  </Pressable>
                </View>
              </View>
            </GlassCard>
          </Animated.View>
        )}
        showsVerticalScrollIndicator={false}
      />
    )
  );

  const renderBookingTab = () => (
    bookingLoading ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    ) : (
      <ScrollView
        contentContainerStyle={[
          styles.tabContent,
          bookingLinks.length === 0 && styles.emptyContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <Pressable
            style={[styles.addServiceBtn, { backgroundColor: Colors.accent }]}
            onPress={() => navigation.navigate("BusinessProfile")}
          >
            <Feather name="plus" size={16} color="#FFFFFF" />
            <ThemedText style={styles.addServiceLabel}>Create Booking Link</ThemedText>
          </Pressable>

          {bookingLinks.length === 0 ? (
            <EmptyState
              image={require("../../../assets/images/empty-bookings.png")}
              title="No booking links yet"
              description="Create a public booking link to let clients book you directly."
            />
          ) : (
            bookingLinks.map((link, index) => (
              <Animated.View key={link.id} entering={FadeInDown.delay(index * 40).duration(300)}>
                <GlassCard style={styles.serviceCard}>
                  <View style={styles.serviceRow}>
                    <View style={styles.serviceIcon}>
                      <Feather name="link" size={16} color={Colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.serviceName}>{link.title}</ThemedText>
                      <ThemedText style={[styles.serviceCategory, { color: theme.textSecondary }]}>
                        /{link.slug}
                      </ThemedText>
                    </View>
                    <StatusPill
                      status={link.isActive ? "success" : "neutral"}
                      label={link.isActive ? "Active" : "Inactive"}
                      size="small"
                    />
                  </View>
                </GlassCard>
              </Animated.View>
            ))
          )}
        </Animated.View>
      </ScrollView>
    )
  );

  const renderPoliciesTab = () => (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(300)}>
        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Deposit</ThemedText>
            <Pressable onPress={() => navigation.navigate("BookingPolicies")} style={styles.editBtn}>
              <Feather name="edit-2" size={14} color={Colors.accent} />
              <ThemedText style={[styles.editLabel, { color: Colors.accent }]}>Edit</ThemedText>
            </Pressable>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>Require Deposit</ThemedText>
            <StatusPill
              status={bookingPolicies?.requireDeposit ? "success" : "neutral"}
              label={bookingPolicies?.requireDeposit ? "Yes" : "No"}
              size="small"
            />
          </View>
          {bookingPolicies?.requireDeposit ? (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>Deposit Amount</ThemedText>
              <ThemedText style={styles.infoValue}>{bookingPolicies.depositPercent ?? 25}%</ThemedText>
            </View>
          ) : null}
        </GlassCard>

        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Cancellation Policy</ThemedText>
            <Pressable onPress={() => navigation.navigate("BookingPolicies")} style={styles.editBtn}>
              <Feather name="edit-2" size={14} color={Colors.accent} />
              <ThemedText style={[styles.editLabel, { color: Colors.accent }]}>Edit</ThemedText>
            </Pressable>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>Cancellation Notice</ThemedText>
            <ThemedText style={styles.infoValue}>
              {bookingPolicies?.cancellationHours ?? 24}h required
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>Cancellation Fee</ThemedText>
            <ThemedText style={styles.infoValue}>
              {bookingPolicies?.cancellationFeePercent ? `${bookingPolicies.cancellationFeePercent}%` : "None"}
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>Reschedule Window</ThemedText>
            <ThemedText style={styles.infoValue}>
              {bookingPolicies?.rescheduleHours ?? 24}h notice
            </ThemedText>
          </View>
        </GlassCard>
      </Animated.View>
    </ScrollView>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.tabBar, { paddingTop: headerHeight + Spacing.sm }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[
                  styles.tab,
                  {
                    backgroundColor: isActive ? Colors.accent : theme.cardBackground,
                    borderColor: isActive ? Colors.accent : theme.borderLight,
                  },
                ]}
                onPress={() => handleTabPress(tab.key)}
                testID={`tab-hub-${tab.key}`}
              >
                <Feather
                  name={tab.icon as any}
                  size={14}
                  color={isActive ? "#FFFFFF" : theme.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.tabLabel,
                    { color: isActive ? "#FFFFFF" : theme.textSecondary },
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.content, { paddingBottom: tabBarHeight + Spacing.md }]}>
        {activeTab === "profile" ? renderProfileTab() : null}
        {activeTab === "services" ? renderServicesTab() : null}
        {activeTab === "booking" ? renderBookingTab() : null}
        {activeTab === "policies" ? renderPoliciesTab() : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBarContent: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.sm,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  tabLabel: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  content: { flex: 1 },
  tabContent: {
    padding: Spacing.screenPadding,
    gap: Spacing.md,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editLabel: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  infoLabel: {
    ...Typography.footnote,
  },
  infoValue: {
    ...Typography.footnote,
    fontWeight: "500",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  previewBtnText: {
    ...Typography.subhead,
    flex: 1,
  },
  addServiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  addServiceLabel: {
    ...Typography.subhead,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  serviceCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceName: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: 2,
  },
  serviceCategory: {
    ...Typography.caption1,
  },
  serviceActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  editIconBtn: {
    padding: 4,
  },
});
