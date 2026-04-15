import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  Linking,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { Avatar } from "@/components/Avatar";
import { StatusPill } from "@/components/StatusPill";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";
import { mapApiProvider } from "@/lib/providerUtils";

type TabType = "about" | "services" | "reviews";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

interface BusinessHoursDay {
  enabled: boolean;
  open: string;
  close: string;
}

interface OwnerProviderResponse {
  id: string;
  businessName: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  serviceArea: string | null;
  avatarUrl: string | null;
  rating: string | null;
  averageRating: string | null;
  reviewCount: number | null;
  completedJobs: number | null;
  yearsExperience: number | null;
  hourlyRate: string | null;
  isVerified: boolean | null;
  responseTime: string | null;
  serviceZipCodes: string[] | null;
  serviceCities: string[] | null;
  businessHours: Record<DayKey, BusinessHoursDay> | null;
  distance?: number | null;
}

interface CustomService {
  id: string;
  name: string;
  description: string | null;
  basePrice: string | null;
  priceFrom: string | null;
  priceTo: string | null;
  pricingType: string | null;
  isPublished: boolean | null;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewerName: string;
}

interface BookingLink {
  id: string;
  slug: string;
  status: string;
}

function safeParsePrice(v?: string | null): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function formatServicePrice(svc: CustomService): string | null {
  if (svc.pricingType === "quote") return "Quote";
  const from = safeParsePrice(svc.priceFrom);
  const to = safeParsePrice(svc.priceTo);
  if (svc.pricingType === "range" && from != null && to != null) {
    return `$${from.toFixed(0)}–$${to.toFixed(0)}`;
  }
  const base = safeParsePrice(svc.basePrice) ?? from;
  if (base != null) return `$${base.toFixed(0)}`;
  return null;
}


export default function PublicProfileScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();

  const providerId = providerProfile?.id;

  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [copyFeedback, setCopyFeedback] = useState(false);

  const { data: providerData, isLoading: providerLoading } = useQuery<{ provider: OwnerProviderResponse }>({
    queryKey: ["/api/provider", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const url = new URL(`/api/provider/${providerId}`, getApiUrl());
      const res = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load provider");
      return res.json();
    },
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery<{ services: CustomService[] }>({
    queryKey: ["/api/provider", providerId, "custom-services"],
    enabled: !!providerId,
    queryFn: async () => {
      const url = new URL(`/api/provider/${providerId}/custom-services`, getApiUrl());
      const res = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) return { services: [] };
      return res.json();
    },
  });

  const { data: reviewsData } = useQuery<{ reviews: ReviewItem[] }>({
    queryKey: ["/api/provider", providerId, "reviews"],
    enabled: !!providerId,
    queryFn: async () => {
      const url = new URL(`/api/provider/${providerId}/reviews`, getApiUrl());
      const res = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) return { reviews: [] };
      return res.json();
    },
  });

  const { data: bookingLinksData } = useQuery<{ bookingLinks: BookingLink[] }>({
    queryKey: ["/api/providers", providerId, "booking-links"],
    enabled: !!providerId,
  });

  const rawProvider = providerData?.provider;
  const allServices = servicesData?.services ?? [];
  // Provider preview shows ALL services (published + drafts), not just published ones
  const displayServices = allServices;
  const providerReviews = reviewsData?.reviews ?? [];
  const activeLink = bookingLinksData?.bookingLinks?.find((l) => l.status === "active");
  const slug = activeLink?.slug;
  const profileUrl = slug ? `https://home-base-pro-app.replit.app/providers/${slug}` : null;

  const provider = useMemo(() => {
    if (!rawProvider) return null;
    return mapApiProvider(rawProvider, allServices);
  }, [rawProvider, allServices]);

  const safeRating = provider ? (isNaN(provider.rating) ? 0 : provider.rating) : 0;

  const handleEditHub = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("BusinessHub");
  };

  const handleCall = async () => {
    const phoneNumber = rawProvider?.phone;
    if (!phoneNumber) {
      Alert.alert("No phone number", "Add your phone number in Business Hub.");
      return;
    }
    const url = `tel:${phoneNumber}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch {}
  };

  const handleText = async () => {
    const phoneNumber = rawProvider?.phone;
    if (!phoneNumber) {
      Alert.alert("No phone number", "Add your phone number in Business Hub.");
      return;
    }
    const url = `sms:${phoneNumber}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch {}
  };

  const handleBookNow = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Preview Mode",
      "This is a preview of what clients see. Clients will be able to book you from this screen."
    );
  };

  const handleShare = async () => {
    if (!profileUrl) {
      Alert.alert("No booking link", "Create an active booking link in Business Hub.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `Book ${provider?.businessName ?? "us"} — ${profileUrl}`,
        url: profileUrl,
      });
    } catch {}
  };

  const handleCopyLink = async () => {
    if (!profileUrl) return;
    await Clipboard.setStringAsync(profileUrl);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2500);
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

  const renderAboutTab = () => {
    const hasHours =
      rawProvider?.businessHours != null &&
      Object.keys(rawProvider.businessHours).length > 0;

    return (
      <Animated.View entering={FadeInDown.duration(300)}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>About</ThemedText>
        {provider?.description ? (
          <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
            {provider.description}
          </ThemedText>
        ) : (
          <ThemedText style={[styles.description, { color: theme.textTertiary }]}>
            No description yet. Add one in Business Hub.
          </ThemedText>
        )}

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
            <Feather name="briefcase" size={20} color={Colors.accent} />
            <ThemedText style={styles.statValue}>{provider?.yearsExperience || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Years Exp.</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
            <Feather name="check-circle" size={20} color={Colors.accent} />
            <ThemedText style={styles.statValue}>{provider?.completedJobs || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Jobs Done</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
            <Feather name="map-pin" size={20} color={Colors.accent} />
            <ThemedText style={styles.statValue}>
              {provider?.distance != null ? `${provider.distance.toFixed(1)}` : "N/A"}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Miles Away</ThemedText>
          </View>
        </View>

        <View style={[styles.infoRow, { borderColor: theme.borderLight }]}>
          <Feather name="message-circle" size={18} color={theme.textSecondary} />
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            Usually responds in {provider?.responseTime || "< 1 hour"}
          </ThemedText>
        </View>

        {hasHours ? (
          <View style={styles.subSection}>
            <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>Business Hours</ThemedText>
            {DAY_ORDER.map((day, idx) => {
              const dayData = rawProvider!.businessHours![day];
              if (!dayData) return null;
              return (
                <View
                  key={day}
                  style={[
                    styles.hoursRow,
                    idx > 0
                      ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.borderLight }
                      : {},
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.hoursDay,
                      { color: dayData.enabled ? theme.text : theme.textTertiary },
                    ]}
                  >
                    {DAY_LABELS[day]}
                  </ThemedText>
                  {dayData.enabled ? (
                    <ThemedText style={[styles.hoursTime, { color: theme.textSecondary }]}>
                      {dayData.open} — {dayData.close}
                    </ThemedText>
                  ) : (
                    <ThemedText style={[styles.hoursClosed, { color: theme.textTertiary }]}>
                      Closed
                    </ThemedText>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.infoRow, { borderColor: theme.borderLight }]}>
            <Feather name="clock" size={18} color={theme.textTertiary} />
            <ThemedText style={[styles.infoText, { color: theme.textTertiary }]}>
              No hours set — add them in Business Hub
            </ThemedText>
          </View>
        )}

        {((rawProvider?.serviceCities && rawProvider.serviceCities.length > 0) ||
          (rawProvider?.serviceZipCodes && rawProvider.serviceZipCodes.length > 0)) ? (
          <View style={styles.subSection}>
            <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>Service Area</ThemedText>
            <View style={styles.chipWrap}>
              {(rawProvider.serviceCities ?? []).map((city) => (
                <View key={city} style={[styles.chip, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText style={[styles.chipText, { color: theme.textSecondary }]}>{city}</ThemedText>
                </View>
              ))}
              {(rawProvider.serviceZipCodes ?? []).map((zip) => (
                <View key={zip} style={[styles.chip, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText style={[styles.chipText, { color: theme.textTertiary }]}>{zip}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {rawProvider?.phone || rawProvider?.email ? (
          <View style={styles.subSection}>
            <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>Contact</ThemedText>
            {rawProvider.phone ? (
              <View style={[styles.contactRow, { borderColor: theme.borderLight }]}>
                <Feather name="phone" size={16} color={theme.textSecondary} />
                <ThemedText style={[styles.contactText, { color: theme.textSecondary }]}>
                  {rawProvider.phone}
                </ThemedText>
              </View>
            ) : null}
            {rawProvider.email ? (
              <View
                style={[
                  styles.contactRow,
                  {
                    borderColor: theme.borderLight,
                    borderTopWidth: rawProvider.phone ? StyleSheet.hairlineWidth : 0,
                  },
                ]}
              >
                <Feather name="mail" size={16} color={theme.textSecondary} />
                <ThemedText style={[styles.contactText, { color: theme.textSecondary }]}>
                  {rawProvider.email}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}

        {profileUrl ? (
          <View style={styles.subSection}>
            <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>Booking Link</ThemedText>
            <View style={[styles.linkPill, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="globe" size={12} color={theme.textTertiary} />
              <ThemedText style={[styles.linkText, { color: theme.textSecondary }]} numberOfLines={1}>
                {profileUrl}
              </ThemedText>
            </View>
            {copyFeedback ? (
              <Animated.View entering={FadeIn.duration(150)}>
                <View style={[styles.copyBanner, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="check" size={12} color={Colors.accent} />
                  <ThemedText style={[styles.copyBannerText, { color: Colors.accent }]}>
                    Copied to clipboard
                  </ThemedText>
                </View>
              </Animated.View>
            ) : null}
            <View style={styles.linkActions}>
              <Pressable
                style={[styles.linkActionBtn, { backgroundColor: Colors.accentLight }]}
                onPress={handleCopyLink}
              >
                <Feather name="copy" size={14} color={Colors.accent} />
                <ThemedText style={[styles.linkActionText, { color: Colors.accent }]}>Copy</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.linkActionBtn, { backgroundColor: theme.backgroundSecondary }]}
                onPress={handleShare}
              >
                <Feather name="share-2" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.linkActionText, { color: theme.textSecondary }]}>Share</ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Animated.View>
    );
  };

  const renderServicesTab = () => {
    if (servicesLoading) {
      return (
        <View style={styles.loadingInline}>
          <ActivityIndicator size="small" color={Colors.accent} />
        </View>
      );
    }

    if (displayServices.length > 0) {
      return (
        <Animated.View entering={FadeInDown.duration(300)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Services Offered</ThemedText>
          {displayServices.map((service) => {
            const priceLabel = formatServicePrice(service);
            return (
              <View key={service.id} style={[styles.serviceRow, { borderColor: theme.borderLight }]}>
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
                {priceLabel != null ? (
                  <ThemedText style={[styles.servicePrice, { color: Colors.accent }]}>
                    {priceLabel}
                  </ThemedText>
                ) : null}
              </View>
            );
          })}
          {safeParsePrice(rawProvider?.hourlyRate) != null ? (
            <View style={styles.pricingCard}>
              <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>Hourly Rate</ThemedText>
              <ThemedText style={[styles.priceValue, { color: Colors.accent }]}>
                ${safeParsePrice(rawProvider!.hourlyRate)!.toFixed(0)}/hr
              </ThemedText>
            </View>
          ) : null}
        </Animated.View>
      );
    }

    const serviceStrings = provider?.services ?? [];
    if (serviceStrings.length > 0) {
      return (
        <Animated.View entering={FadeInDown.duration(300)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Services Offered</ThemedText>
          {serviceStrings.map((service, index) => (
            <View key={`${service}-${index}`} style={[styles.serviceRow, { borderColor: theme.borderLight }]}>
              <View style={[styles.serviceIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="check" size={16} color={Colors.accent} />
              </View>
              <ThemedText style={styles.serviceName}>{service}</ThemedText>
            </View>
          ))}
          {provider != null && provider.hourlyRate > 0 ? (
            <View style={styles.pricingCard}>
              <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>Pricing</ThemedText>
              <ThemedText style={[styles.priceValue, { color: Colors.accent }]}>
                ${provider.hourlyRate}/hr
              </ThemedText>
            </View>
          ) : null}
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeInDown.duration(300)}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Services Offered</ThemedText>
        <View style={styles.emptyState}>
          <Feather name="tool" size={32} color={theme.textTertiary} />
          <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
            No services added yet
          </ThemedText>
          <ThemedText style={[styles.emptyBody, { color: theme.textTertiary }]}>
            Add services in Business Hub so clients know what you offer.
          </ThemedText>
          <Pressable
            style={[styles.emptyBtn, { backgroundColor: Colors.accentLight }]}
            onPress={handleEditHub}
          >
            <ThemedText style={[styles.emptyBtnText, { color: Colors.accent }]}>
              Go to Business Hub
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  const renderReviewsTab = () => (
    <Animated.View entering={FadeInDown.duration(300)}>
      <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
        Reviews ({providerReviews.length})
      </ThemedText>
      {providerReviews.length > 0 ? (
        providerReviews.map((review) => (
          <View
            key={review.id}
            style={[
              styles.reviewCard,
              { backgroundColor: theme.cardBackground, borderColor: theme.borderLight },
            ]}
          >
            <View style={styles.reviewHeader}>
              <ThemedText style={styles.reviewerName}>{review.reviewerName}</ThemedText>
              <View style={styles.reviewStars}>{renderStars(review.rating)}</View>
            </View>
            {review.comment ? (
              <ThemedText style={[styles.reviewComment, { color: theme.textSecondary }]}>
                {review.comment}
              </ThemedText>
            ) : null}
            <ThemedText style={[styles.reviewDate, { color: theme.textTertiary }]}>
              {new Date(review.createdAt).toLocaleDateString()}
            </ThemedText>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Feather name="star" size={32} color={theme.textTertiary} />
          <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
            No reviews yet
          </ThemedText>
          <ThemedText style={[styles.emptyBody, { color: theme.textTertiary }]}>
            Reviews appear here once clients rate your work.
          </ThemedText>
        </View>
      )}
    </Animated.View>
  );

  if (providerLoading) {
    return (
      <ThemedView style={[styles.container, styles.loadingFullScreen]}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading preview...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Pinned preview banner — sits below nav header, does NOT scroll */}
      <View
        style={[
          styles.pinnedBannerWrapper,
          { paddingTop: headerHeight + Spacing.sm, backgroundColor: theme.backgroundRoot },
        ]}
      >
        <View style={[styles.previewBanner, { backgroundColor: Colors.accentLight }]}>
          <Feather name="eye" size={14} color={Colors.accent} />
          <ThemedText style={[styles.previewBannerText, { color: Colors.accent }]}>
            Preview — this is what clients see
          </ThemedText>
          <Pressable onPress={handleEditHub} style={styles.editBannerBtn} hitSlop={8}>
            <ThemedText style={[styles.editBannerBtnText, { color: Colors.accent }]}>
              Edit
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card — same structure as homeowner ProviderProfileScreen */}
        <Animated.View entering={FadeInDown.delay(0).duration(350)}>
          <GlassCard style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <Avatar
                name={provider?.businessName ?? ""}
                size="large"
                uri={rawProvider?.avatarUrl}
              />
              <View style={styles.profileInfo}>
                <ThemedText style={styles.providerName}>
                  {provider?.name ?? provider?.businessName ?? "Your Business"}
                </ThemedText>
                {rawProvider?.serviceArea ? (
                  <ThemedText style={[styles.serviceAreaText, { color: theme.textSecondary }]}>
                    {rawProvider.serviceArea}
                  </ThemedText>
                ) : null}
                <View style={styles.ratingRow}>
                  {renderStars(safeRating)}
                  <ThemedText style={styles.ratingText}>
                    {safeRating.toFixed(1)} ({provider?.reviewCount ?? 0})
                  </ThemedText>
                </View>
              </View>
            </View>
            <View style={styles.profileActions}>
              {provider?.verified ? (
                <StatusPill label="Verified Pro" status="success" />
              ) : null}
            </View>
          </GlassCard>
        </Animated.View>

        {/* Tab Row */}
        <View style={styles.tabRow}>
          {(["about", "services", "reviews"] as TabType[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab);
              }}
              style={[
                styles.tab,
                activeTab === tab
                  ? { borderBottomColor: Colors.accent, borderBottomWidth: 2 }
                  : {},
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

      {/* Bottom action bar — mirrors homeowner view: Call / Text / Book Now */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.backgroundRoot,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}
      >
        <View style={styles.contactButtons}>
          <Pressable
            style={[
              styles.contactButton,
              { backgroundColor: theme.cardBackground, borderColor: theme.borderLight },
            ]}
            onPress={handleCall}
          >
            <Feather name="phone" size={20} color={Colors.accent} />
            <ThemedText style={[styles.contactButtonText, { color: theme.text }]}>Call</ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.contactButton,
              { backgroundColor: theme.cardBackground, borderColor: theme.borderLight },
            ]}
            onPress={handleText}
          >
            <Feather name="message-circle" size={20} color={Colors.accent} />
            <ThemedText style={[styles.contactButtonText, { color: theme.text }]}>Text</ThemedText>
          </Pressable>
        </View>
        <Pressable
          style={[styles.bookNowButton, { backgroundColor: Colors.accent }]}
          onPress={handleBookNow}
        >
          <ThemedText style={styles.bookNowText}>Book Now</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingFullScreen: {
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
  },
  loadingInline: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  pinnedBannerWrapper: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.sm,
  },
  previewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  previewBannerText: {
    ...Typography.footnote,
    fontWeight: "600",
    flex: 1,
  },
  editBannerBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  editBannerBtnText: {
    ...Typography.footnote,
    fontWeight: "700",
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
  providerName: {
    ...Typography.title2,
    fontWeight: "700",
  },
  serviceAreaText: {
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
  profileActions: {
    flexDirection: "row",
    alignItems: "center",
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
  subSectionTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: Spacing.sm,
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
    marginBottom: Spacing.sm,
  },
  infoText: {
    ...Typography.subhead,
  },
  subSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  hoursDay: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  hoursTime: {
    ...Typography.subhead,
  },
  hoursClosed: {
    ...Typography.subhead,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  chipText: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  contactText: {
    ...Typography.subhead,
  },
  linkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  linkText: {
    ...Typography.caption1,
    flex: 1,
  },
  copyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  copyBannerText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  linkActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  linkActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  linkActionText: {
    ...Typography.subhead,
    fontWeight: "600",
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
  pricingCard: {
    marginTop: Spacing.lg,
  },
  priceValue: {
    ...Typography.title3,
    fontWeight: "700",
  },
  emptyState: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  emptyBody: {
    ...Typography.footnote,
    textAlign: "center",
    maxWidth: 260,
  },
  emptyBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  emptyBtnText: {
    ...Typography.subhead,
    fontWeight: "600",
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
  bookNowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
  },
  bookNowText: {
    ...Typography.body,
    fontWeight: "700",
    color: "#FFF",
  },
});
