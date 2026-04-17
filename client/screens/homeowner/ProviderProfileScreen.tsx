import React, { useState, useMemo, useLayoutEffect } from "react";
import { StyleSheet, View, ScrollView, Pressable, Linking, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight, HeaderButton } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { Avatar } from "@/components/Avatar";
import { StatusPill } from "@/components/StatusPill";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { AccountGateModal } from "@/components/AccountGateModal";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";
import { Provider } from "@/state/types";
import { mapApiProvider, ApiServiceItem } from "@/lib/providerUtils";

type ScreenRouteProp = RouteProp<RootStackParamList, "ProviderProfile">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = "about" | "services" | "reviews";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface BusinessHoursDay {
  enabled: boolean;
  open: string;
  close: string;
}

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];


interface ApiProviderResponse {
  provider: {
    id: string;
    businessName: string;
    description?: string | null;
    avatarUrl?: string | null;
    phone?: string | null;
    email?: string | null;
    rating?: string | null;
    reviewCount?: number | null;
    averageRating?: string | null;
    hourlyRate?: string | null;
    isVerified?: boolean | null;
    serviceArea?: string | null;
    yearsExperience?: number | null;
    completedJobs?: number | null;
    responseTime?: string | null;
    distance?: number | null;
    slug?: string | null;
    businessHours?: Record<DayKey, BusinessHoursDay> | null;
    serviceZipCodes?: string[] | null;
    serviceCities?: string[] | null;
    serviceRadius?: number | null;
  };
  services: ApiServiceItem[];
}

interface CustomService {
  id: string;
  name: string;
  description?: string | null;
  basePrice?: string | null;
  priceFrom?: string | null;
  priceTo?: string | null;
  pricingType?: string | null;
  isPublished?: boolean | null;
}

interface CustomServicesResponse {
  services: CustomService[];
}


export default function ProviderProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { providerId, intakeData, provider: passedProvider } = route.params;

  const allReviews = useHomeownerStore((s) => s.reviews);
  const toggleSavedProvider = useHomeownerStore((s) => s.toggleSavedProvider);
  const savedProviderIds = useHomeownerStore((s) => s.savedProviderIds);
  const { isAuthenticated } = useAuthStore();

  const isSaved = savedProviderIds.includes(providerId);

  const { data: apiData, isLoading: isApiLoading } = useQuery<ApiProviderResponse>({
    queryKey: ["/api/providers", providerId],
    queryFn: async () => {
      const response = await fetch(new URL(`/api/providers/${providerId}`, getApiUrl()).toString());
      if (!response.ok) throw new Error("Provider not found");
      return response.json();
    },
    enabled: !!providerId,
  });

  const provider: Provider | null = useMemo(() => {
    if (apiData?.provider) return mapApiProvider(apiData.provider, apiData.services ?? []);
    if (passedProvider) return passedProvider;
    return null;
  }, [passedProvider, apiData]);

  const { data: customServicesData } = useQuery<CustomServicesResponse>({
    queryKey: ["/api/provider", providerId, "custom-services", "published"],
    queryFn: async () => {
      const url = new URL(`/api/provider/${providerId}/custom-services`, getApiUrl());
      url.searchParams.set("publishedOnly", "true");
      const response = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!response.ok) return { services: [] };
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const customServices: CustomService[] = customServicesData?.services ?? [];

  const reviews = useMemo(() => {
    return allReviews.filter((r) => r.providerId === providerId);
  }, [allReviews, providerId]);

  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [showAccountGate, setShowAccountGate] = useState(false);

  const handleToggleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSavedProvider(providerId);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          onPress={handleToggleSave}
          accessibilityLabel={isSaved ? "Remove from saved" : "Save provider"}
        >
          <Feather
            name="heart"
            size={22}
            color={isSaved ? Colors.accent : undefined}
          />
        </HeaderButton>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, isSaved, providerId]);

  if (isApiLoading && !passedProvider && !apiData) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading provider...
        </ThemedText>
      </ThemedView>
    );
  }

  if (!provider) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer]}>
        <Feather name="alert-circle" size={48} color={theme.textTertiary} />
        <ThemedText style={styles.notFoundText}>Provider not found</ThemedText>
        <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
          <Feather name="arrow-left" size={16} color={Colors.accent} />
          <ThemedText style={[styles.backLinkText, { color: Colors.accent }]}>Go back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const safeRating = typeof provider.rating === "number" && !isNaN(provider.rating)
    ? provider.rating
    : 0;

  const handleBookPress = () => {
    if (!isAuthenticated) {
      setShowAccountGate(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (intakeData) {
      navigation.navigate("SimpleBooking", {
        providerId: provider.id,
        providerName: provider.businessName,
        intakeData,
      });
    } else {
      navigation.navigate("SmartIntake", {
        preselectedProviderId: provider.id,
        preselectedProviderName: provider.businessName,
      });
    }
  };

  const handleSignIn = () => {
    setShowAccountGate(false);
    navigation.navigate("Login");
  };

  const handleSignUp = () => {
    setShowAccountGate(false);
    navigation.navigate("SignUp");
  };

  const handleCall = async () => {
    const phoneNumber = provider.phone || "5551234567";
    const url = `tel:${phoneNumber}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Unable to Call", "Phone calls are not supported on this device.");
      }
    } catch {
      Alert.alert("Error", "Could not open phone dialer.");
    }
  };

  const handleText = async () => {
    const phoneNumber = provider.phone || "5551234567";
    const url = `sms:${phoneNumber}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Unable to Text", "SMS is not supported on this device.");
      }
    } catch {
      Alert.alert("Error", "Could not open messaging app.");
    }
  };

  const renderStars = (rating: number) => {
    const safe = isNaN(rating) ? 0 : rating;
    const stars = [];
    const fullStars = Math.floor(safe);
    const hasHalf = safe - fullStars >= 0.5;
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Feather key={i} name="star" size={16} color={Colors.accent} />);
      } else if (i === fullStars && hasHalf) {
        stars.push(<Feather key={i} name="star" size={16} color={Colors.accent} />);
      } else {
        stars.push(<Feather key={i} name="star" size={16} color={theme.borderLight} />);
      }
    }
    return stars;
  };

  const rawProvider = apiData?.provider;
  const businessHours = rawProvider?.businessHours;
  const serviceZipCodes = rawProvider?.serviceZipCodes ?? [];
  const serviceCities = rawProvider?.serviceCities ?? [];
  const providerEmail = rawProvider?.email ?? null;
  const providerSlug = rawProvider?.slug ?? null;
  const serviceAreaChips = [
    ...serviceCities,
    ...serviceZipCodes,
  ].filter(Boolean);
  const bookingUrl = providerSlug ? `https://homebaseproapp.com/providers/${providerSlug}` : null;

  const renderAboutTab = () => (
    <Animated.View entering={FadeInDown.duration(300)}>
      <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>About</ThemedText>
      {provider.description ? (
        <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
          {provider.description}
        </ThemedText>
      ) : (
        <ThemedText style={[styles.description, { color: theme.textTertiary }]}>
          No description provided.
        </ThemedText>
      )}

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
          <Feather name="briefcase" size={20} color={Colors.accent} />
          <ThemedText style={styles.statValue}>{provider.yearsExperience || 0}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Years Exp.</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
          <Feather name="check-circle" size={20} color={Colors.accent} />
          <ThemedText style={styles.statValue}>{provider.completedJobs || 0}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Jobs Done</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
          <Feather name="map-pin" size={20} color={Colors.accent} />
          <ThemedText style={styles.statValue}>
            {provider.distance != null ? provider.distance.toFixed(1) : "N/A"}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Miles Away</ThemedText>
        </View>
      </View>

      <View style={[styles.infoRow, { borderColor: theme.borderLight }]}>
        <Feather name="message-circle" size={18} color={theme.textSecondary} />
        <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
          Usually responds in {provider.responseTime || "< 1 hour"}
        </ThemedText>
      </View>

      {businessHours ? (
        <View style={styles.detailSection}>
          <ThemedText style={[styles.detailSectionTitle, { color: theme.text }]}>Business Hours</ThemedText>
          {DAYS.map(({ key, label }) => {
            const day = businessHours[key];
            const isEnabled = day?.enabled ?? false;
            return (
              <View key={key} style={styles.hoursRow}>
                <ThemedText
                  style={[
                    styles.hoursDay,
                    { color: isEnabled ? theme.text : theme.textTertiary, fontWeight: isEnabled ? "600" : "400" },
                  ]}
                >
                  {label}
                </ThemedText>
                <ThemedText style={[styles.hoursTime, { color: isEnabled ? theme.textSecondary : theme.textTertiary }]}>
                  {isEnabled ? `${day.open} — ${day.close}` : "Closed"}
                </ThemedText>
              </View>
            );
          })}
        </View>
      ) : null}

      {serviceAreaChips.length > 0 ? (
        <View style={styles.detailSection}>
          <ThemedText style={[styles.detailSectionTitle, { color: theme.text }]}>Service Area</ThemedText>
          <View style={styles.chipsWrap}>
            {serviceAreaChips.map((chip, i) => (
              <View key={`${chip}-${i}`} style={[styles.chip, { backgroundColor: theme.backgroundElevated, borderColor: theme.borderLight }]}>
                <ThemedText style={[styles.chipText, { color: theme.textSecondary }]}>{chip}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {(provider.phone || providerEmail) ? (
        <View style={styles.detailSection}>
          <ThemedText style={[styles.detailSectionTitle, { color: theme.text }]}>Contact</ThemedText>
          {provider.phone ? (
            <Pressable style={styles.contactRow} onPress={handleCall}>
              <Feather name="phone" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.contactRowText, { color: theme.textSecondary }]}>{provider.phone}</ThemedText>
            </Pressable>
          ) : null}
          {providerEmail ? (
            <Pressable
              style={styles.contactRow}
              onPress={() => Linking.openURL(`mailto:${providerEmail}`).catch(() => {})}
            >
              <Feather name="mail" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.contactRowText, { color: theme.textSecondary }]}>{providerEmail}</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {bookingUrl ? (
        <View style={styles.detailSection}>
          <ThemedText style={[styles.detailSectionTitle, { color: theme.text }]}>Booking Link</ThemedText>
          <Pressable
            style={[styles.bookingLinkRow, { backgroundColor: theme.backgroundElevated, borderColor: theme.borderLight }]}
            onPress={() => Linking.openURL(bookingUrl).catch(() => {})}
          >
            <Feather name="globe" size={14} color={theme.textTertiary} />
            <ThemedText style={[styles.bookingLinkText, { color: theme.textSecondary }]} numberOfLines={1}>
              {bookingUrl}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );

  const handleBookService = () => {
    if (!isAuthenticated) {
      setShowAccountGate(true);
      return;
    }
    navigation.navigate("SimpleBooking", {
      providerId: provider.id,
      providerName: provider.businessName,
    });
  };

  const renderServicesTab = () => {
    if (customServices.length > 0) {
      return (
        <Animated.View entering={FadeInDown.duration(300)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Services Offered</ThemedText>
          {customServices.map((service) => {
            const safeParsePrice = (v?: string | null): number | null => {
              if (!v) return null;
              const n = parseFloat(v);
              return isNaN(n) ? null : n;
            };
            const displayPrice = safeParsePrice(service.basePrice) ?? safeParsePrice(service.priceFrom);
            const priceFrom = safeParsePrice(service.priceFrom);
            const priceTo = safeParsePrice(service.priceTo);
            return (
              <Pressable
                key={service.id}
                style={[styles.serviceRow, { borderColor: theme.borderLight }]}
                onPress={handleBookService}
              >
                <View style={[styles.serviceIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="check" size={16} color={Colors.accent} />
                </View>
                <View style={styles.serviceInfo}>
                  <ThemedText style={styles.serviceName}>{service.name}</ThemedText>
                  {service.description ? (
                    <ThemedText
                      style={[styles.serviceDesc, { color: theme.textTertiary }]}
                      numberOfLines={1}
                    >
                      {service.description}
                    </ThemedText>
                  ) : null}
                </View>
                {displayPrice != null ? (
                  <ThemedText style={[styles.servicePrice, { color: Colors.accent }]}>
                    {service.pricingType === "range" && priceFrom != null && priceTo != null
                      ? `$${priceFrom.toFixed(0)}–$${priceTo.toFixed(0)}`
                      : `$${displayPrice.toFixed(0)}`}
                  </ThemedText>
                ) : null}
                <Feather name="chevron-right" size={18} color={theme.textTertiary} style={{ marginLeft: Spacing.xs }} />
              </Pressable>
            );
          })}
        </Animated.View>
      );
    }

    const serviceStrings = provider.services ?? [];
    return (
      <Animated.View entering={FadeInDown.duration(300)}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Services Offered</ThemedText>
        {serviceStrings.length > 0 ? (
          serviceStrings.map((service, index) => (
            <Pressable
              key={`${service}-${index}`}
              style={[styles.serviceRow, { borderColor: theme.borderLight }]}
              onPress={handleBookService}
            >
              <View style={[styles.serviceIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="check" size={16} color={Colors.accent} />
              </View>
              <ThemedText style={styles.serviceName}>{service}</ThemedText>
              <Feather name="chevron-right" size={18} color={theme.textTertiary} />
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyServices}>
            <ThemedText style={[styles.emptyText, { color: theme.textTertiary }]}>
              No services listed yet.
            </ThemedText>
          </View>
        )}

        {provider.hourlyRate > 0 ? (
          <View style={styles.pricingCard}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Pricing</ThemedText>
            <View style={styles.priceRow}>
              <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
                Hourly Rate
              </ThemedText>
              <ThemedText style={styles.priceValue}>${provider.hourlyRate}/hr</ThemedText>
            </View>
          </View>
        ) : null}
      </Animated.View>
    );
  };

  const renderReviewsTab = () => (
    <Animated.View entering={FadeInDown.duration(300)}>
      <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
        Reviews ({reviews.length})
      </ThemedText>

      {reviews.length > 0 ? (
        reviews.map((review) => (
          <View
            key={review.id}
            style={[styles.reviewCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}
          >
            <View style={styles.reviewHeader}>
              <ThemedText style={styles.reviewerName}>{review.homeownerName}</ThemedText>
              <View style={styles.reviewStars}>{renderStars(review.rating)}</View>
            </View>
            <ThemedText style={[styles.reviewComment, { color: theme.textSecondary }]}>
              {review.comment}
            </ThemedText>
            <ThemedText style={[styles.reviewDate, { color: theme.textTertiary }]}>
              {new Date(review.createdAt).toLocaleDateString()}
            </ThemedText>
          </View>
        ))
      ) : (
        <View style={styles.emptyReviews}>
          <ThemedText style={[styles.emptyText, { color: theme.textTertiary }]}>
            No reviews yet
          </ThemedText>
        </View>
      )}
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >

        <Animated.View entering={FadeInDown.duration(400)}>
          <GlassCard style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <Avatar name={provider.name || provider.businessName} size="large" uri={provider.avatarUrl} />
              <View style={styles.profileInfo}>
                <ThemedText style={styles.providerName}>
                  {provider.name || provider.businessName}
                </ThemedText>
                {rawProvider?.serviceArea ? (
                  <ThemedText style={[styles.serviceAreaText, { color: theme.textSecondary }]}>
                    {rawProvider.serviceArea}
                  </ThemedText>
                ) : null}
                <View style={styles.ratingRow}>
                  {renderStars(safeRating)}
                  <ThemedText style={styles.ratingText}>
                    {safeRating.toFixed(1)} ({provider.reviewCount ?? 0})
                  </ThemedText>
                </View>
              </View>
            </View>
            <View style={styles.profileActions}>
              {provider.verified ? (
                <StatusPill label="Verified Pro" status="success" />
              ) : null}
            </View>
          </GlassCard>
        </Animated.View>

        <View style={styles.tabRow}>
          {(["about", "services", "reviews"] as TabType[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tab,
                activeTab === tab && { borderBottomColor: Colors.accent, borderBottomWidth: 2 },
              ]}
            >
              <ThemedText
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? Colors.accent : theme.textSecondary },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {activeTab === "about" ? renderAboutTab() : null}
        {activeTab === "services" ? renderServicesTab() : null}
        {activeTab === "reviews" ? renderReviewsTab() : null}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.contactButtons}>
          <Pressable
            style={[styles.contactButton, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}
            onPress={handleCall}
          >
            <Feather name="phone" size={20} color={Colors.accent} />
            <ThemedText style={[styles.contactButtonText, { color: theme.text }]}>Call</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.contactButton, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}
            onPress={handleText}
          >
            <Feather name="message-circle" size={20} color={Colors.accent} />
            <ThemedText style={[styles.contactButtonText, { color: theme.text }]}>Text</ThemedText>
          </Pressable>
        </View>
        <PrimaryButton onPress={handleBookPress}>Book Now</PrimaryButton>
      </View>

      <AccountGateModal
        visible={showAccountGate}
        onClose={() => setShowAccountGate(false)}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
  },
  notFoundText: {
    ...Typography.title3,
    marginTop: Spacing.md,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.lg,
  },
  backLinkText: {
    ...Typography.body,
    fontWeight: "500",
  },
  profileCard: {
    marginBottom: Spacing.lg,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  profileActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  providerName: {
    ...Typography.title2,
    fontWeight: "700",
  },
  businessName: {
    ...Typography.subhead,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
    gap: 2,
  },
  ratingText: {
    ...Typography.caption1,
    marginLeft: Spacing.xs,
    color: Colors.accent,
    fontWeight: "600",
  },
  tabRow: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  tabText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  description: {
    ...Typography.body,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  statValue: {
    ...Typography.title2,
    fontWeight: "700",
    marginTop: Spacing.xs,
  },
  statLabel: {
    ...Typography.caption2,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoText: {
    ...Typography.subhead,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  serviceIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    ...Typography.body,
    flex: 1,
  },
  serviceDesc: {
    ...Typography.caption1,
    marginTop: 2,
  },
  servicePrice: {
    ...Typography.subhead,
    fontWeight: "600",
    marginLeft: Spacing.sm,
    flexShrink: 0,
  },
  emptyServices: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  pricingCard: {
    marginTop: Spacing.lg,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    ...Typography.body,
  },
  priceValue: {
    ...Typography.title3,
    fontWeight: "700",
    color: Colors.accent,
  },
  reviewCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  reviewerName: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  reviewStars: {
    flexDirection: "row",
    gap: 2,
  },
  reviewComment: {
    ...Typography.body,
    lineHeight: 20,
  },
  reviewDate: {
    ...Typography.caption2,
    marginTop: Spacing.xs,
  },
  emptyReviews: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    ...Typography.subhead,
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
  contactButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  contactButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  contactButtonText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  serviceAreaText: {
    ...Typography.subhead,
    marginTop: 2,
  },
  detailSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  detailSectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  hoursDay: {
    ...Typography.body,
  },
  hoursTime: {
    ...Typography.body,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    ...Typography.caption1,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  contactRowText: {
    ...Typography.body,
  },
  bookingLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bookingLinkText: {
    ...Typography.caption1,
    flex: 1,
  },
});
