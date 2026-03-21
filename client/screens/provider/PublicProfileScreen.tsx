import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Share,
  ActivityIndicator,
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
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { Avatar } from "@/components/Avatar";
import { StatusPill } from "@/components/StatusPill";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";

interface ProviderService {
  id: string;
  name: string;
  basePrice: string | null;
  pricingType: string | null;
  description: string | null;
  category: string | null;
}

interface BookingLink {
  id: string;
  slug: string;
  welcomeMessage: string | null;
  status: string;
}

export default function PublicProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user, providerProfile } = useAuthStore();

  const providerId = providerProfile?.id;
  const businessName = providerProfile?.businessName || "Your Business Name";

  const [copyFeedback, setCopyFeedback] = useState(false);

  const { data: bookingLinksData } = useQuery<{ bookingLinks: BookingLink[] }>({
    queryKey: ["/api/providers", providerId, "booking-links"],
    enabled: !!providerId,
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery<{ services: ProviderService[] }>({
    queryKey: ["/api/provider", providerId, "custom-services"],
    enabled: !!providerId,
  });

  const { data: reviewsData } = useQuery<{ reviews: any[] }>({
    queryKey: ["/api/provider", providerId, "reviews"],
    enabled: !!providerId,
  });

  const activeLink = bookingLinksData?.bookingLinks?.find((l) => l.status === "active");
  const slug = activeLink?.slug;
  const domain = process.env.EXPO_PUBLIC_DOMAIN || "localhost:5000";
  const profileUrl = slug ? `https://${domain}/book/${slug}` : null;
  const services = servicesData?.services || [];
  const reviews = reviewsData?.reviews || [];

  const providerRating = providerProfile?.rating ? Number(providerProfile.rating) : 0;
  const reviewCount = providerProfile?.reviewCount || reviews.length;

  const formatPrice = (svc: ProviderService): string => {
    if (svc.pricingType === "quote") return "Get Quote";
    if (svc.basePrice) return `$${parseFloat(svc.basePrice).toLocaleString()}`;
    return "Contact";
  };

  const handleCopyLink = async () => {
    if (!profileUrl) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(profileUrl);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2500);
  };

  const handleShare = async () => {
    if (!profileUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `Book ${businessName} — ${profileUrl}`,
        url: profileUrl,
      });
    } catch {}
  };

  const renderStars = (rating: number, size = 14) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Feather
          key={star}
          name="star"
          size={size}
          color={star <= Math.round(rating) ? Colors.warning : theme.backgroundTertiary}
        />
      ))}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <GlassCard style={styles.heroCard}>
            <View style={styles.heroTop}>
              <Avatar uri={user?.avatarUrl} name={businessName} size="large" />
              <View style={styles.heroInfo}>
                <ThemedText style={styles.heroName}>{businessName}</ThemedText>
                {providerProfile?.serviceArea ? (
                  <ThemedText style={[styles.heroTagline, { color: theme.textSecondary }]} numberOfLines={2}>
                    Serving {providerProfile.serviceArea}
                  </ThemedText>
                ) : null}
              </View>
            </View>

            {/* Trust bar */}
            <View style={styles.trustBar}>
              {providerRating > 0 ? (
                <View style={styles.trustItem}>
                  {renderStars(providerRating)}
                  <ThemedText style={[styles.trustLabel, { color: theme.textSecondary }]}>
                    {providerRating.toFixed(1)} ({reviewCount})
                  </ThemedText>
                </View>
              ) : null}

              {providerProfile?.completedJobs > 0 ? (
                <View style={styles.trustItem}>
                  <Feather name="check-circle" size={14} color={Colors.accent} />
                  <ThemedText style={[styles.trustLabel, { color: theme.textSecondary }]}>
                    {providerProfile.completedJobs} jobs done
                  </ThemedText>
                </View>
              ) : null}

              <View style={[styles.verifiedBadge, { backgroundColor: Colors.accentLight }]}>
                <Feather name="shield" size={12} color={Colors.accent} />
                <ThemedText style={[styles.verifiedText, { color: Colors.accent }]}>
                  Verified
                </ThemedText>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Booking Link */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="link-2" size={16} color={Colors.accent} />
              <ThemedText style={styles.sectionTitle}>Your Booking Link</ThemedText>
            </View>

            {profileUrl ? (
              <>
                <View style={[styles.linkBox, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText style={[styles.linkText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {profileUrl}
                  </ThemedText>
                </View>

                {copyFeedback ? (
                  <Animated.View entering={FadeIn.duration(200)}>
                    <View style={[styles.copyBanner, { backgroundColor: Colors.accentLight }]}>
                      <Feather name="check" size={14} color={Colors.accent} />
                      <ThemedText style={[styles.copyBannerText, { color: Colors.accent }]}>
                        Link copied to clipboard
                      </ThemedText>
                    </View>
                  </Animated.View>
                ) : null}

                <View style={styles.linkActions}>
                  <Pressable
                    style={[styles.linkActionBtn, { backgroundColor: Colors.accentLight }]}
                    onPress={handleCopyLink}
                  >
                    <Feather name="copy" size={16} color={Colors.accent} />
                    <ThemedText style={[styles.linkActionText, { color: Colors.accent }]}>
                      Copy Link
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.linkActionBtn, { backgroundColor: theme.backgroundSecondary }]}
                    onPress={handleShare}
                  >
                    <Feather name="share" size={16} color={theme.text} />
                    <ThemedText style={styles.linkActionText}>Share</ThemedText>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.noLinkState}>
                <Feather name="link" size={28} color={theme.textTertiary} style={{ marginBottom: Spacing.sm }} />
                <ThemedText style={[styles.noLinkTitle, { color: theme.textSecondary }]}>
                  No booking link yet
                </ThemedText>
                <ThemedText style={[styles.noLinkSubtitle, { color: theme.textTertiary }]}>
                  Create a booking link from your Business Profile to allow clients to book directly.
                </ThemedText>
              </View>
            )}
          </GlassCard>
        </Animated.View>

        {/* Services Preview */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="tool" size={16} color={Colors.accent} />
              <ThemedText style={styles.sectionTitle}>Services You Offer</ThemedText>
            </View>

            {servicesLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={Colors.accent} />
              </View>
            ) : services.length > 0 ? (
              services.map((svc, idx) => (
                <View
                  key={svc.id}
                  style={[
                    styles.serviceRow,
                    idx < services.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
                  ]}
                >
                  <View style={styles.serviceLeft}>
                    <ThemedText style={styles.serviceName}>{svc.name}</ThemedText>
                    {svc.description ? (
                      <ThemedText style={[styles.serviceDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                        {svc.description}
                      </ThemedText>
                    ) : null}
                    {svc.category ? (
                      <View style={[styles.categoryTag, { backgroundColor: theme.backgroundSecondary }]}>
                        <ThemedText style={[styles.categoryTagText, { color: theme.textTertiary }]}>
                          {svc.category}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <ThemedText style={[styles.servicePrice, { color: Colors.accent }]}>
                    {formatPrice(svc)}
                  </ThemedText>
                </View>
              ))
            ) : (
              <View style={styles.emptyServices}>
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No services added yet. Add services from Service Builder.
                </ThemedText>
                <Pressable
                  style={[styles.addServiceBtn, { backgroundColor: Colors.accentLight }]}
                  onPress={() => navigation.navigate("NewService")}
                >
                  <Feather name="plus" size={14} color={Colors.accent} />
                  <ThemedText style={[styles.addServiceText, { color: Colors.accent }]}>
                    Add a Service
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </GlassCard>
        </Animated.View>

        {/* Recent Reviews */}
        {reviews.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <GlassCard style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="star" size={16} color={Colors.warning} />
                <ThemedText style={styles.sectionTitle}>Recent Reviews</ThemedText>
                <View style={styles.sectionBadge}>
                  <ThemedText style={[styles.sectionBadgeText, { color: Colors.accent }]}>
                    {providerRating.toFixed(1)}
                  </ThemedText>
                </View>
              </View>

              {reviews.slice(0, 3).map((review, idx) => (
                <View
                  key={review.id}
                  style={[
                    styles.reviewRow,
                    idx < Math.min(reviews.length, 3) - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.separator,
                    },
                  ]}
                >
                  <View style={styles.reviewHeader}>
                    <ThemedText style={styles.reviewerName}>{review.reviewerName}</ThemedText>
                    {renderStars(review.rating)}
                  </View>
                  {review.comment ? (
                    <ThemedText style={[styles.reviewComment, { color: theme.textSecondary }]} numberOfLines={2}>
                      {review.comment}
                    </ThemedText>
                  ) : null}
                </View>
              ))}

              {reviews.length > 3 ? (
                <Pressable
                  style={styles.seeAllReviews}
                  onPress={() => navigation.navigate("Reviews")}
                >
                  <ThemedText style={[styles.seeAllText, { color: Colors.accent }]}>
                    See all {reviews.length} reviews
                  </ThemedText>
                  <Feather name="arrow-right" size={14} color={Colors.accent} />
                </Pressable>
              ) : null}
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Contact */}
        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="user" size={16} color={Colors.accent} />
              <ThemedText style={styles.sectionTitle}>Contact Info</ThemedText>
            </View>

            {user?.email ? (
              <View style={styles.contactRow}>
                <View style={[styles.contactIcon, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="mail" size={16} color={theme.textSecondary} />
                </View>
                <ThemedText style={[styles.contactText, { color: theme.textSecondary }]}>
                  {user.email}
                </ThemedText>
              </View>
            ) : null}

            {user?.phone ? (
              <View style={styles.contactRow}>
                <View style={[styles.contactIcon, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="phone" size={16} color={theme.textSecondary} />
                </View>
                <ThemedText style={[styles.contactText, { color: theme.textSecondary }]}>
                  {user.phone}
                </ThemedText>
              </View>
            ) : null}

            {!user?.email && !user?.phone ? (
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No contact info on file. Update your profile to add contact details.
              </ThemedText>
            ) : null}
          </GlassCard>
        </Animated.View>
      </ScrollView>

      {/* Footer CTA */}
      <Animated.View
        entering={FadeIn.delay(400).duration(300)}
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Spacing.md,
            backgroundColor: theme.backgroundDefault,
            borderTopColor: theme.borderLight,
          },
        ]}
      >
        {profileUrl ? (
          <View style={styles.footerButtons}>
            <View style={styles.footerSecondary}>
              <SecondaryButton onPress={handleCopyLink}>
                Copy Link
              </SecondaryButton>
            </View>
            <View style={styles.footerPrimary}>
              <PrimaryButton onPress={handleShare}>
                Share Profile
              </PrimaryButton>
            </View>
          </View>
        ) : (
          <PrimaryButton onPress={() => navigation.navigate("BusinessProfile")}>
            Create Booking Link
          </PrimaryButton>
        )}
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    marginBottom: Spacing.lg,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    ...Typography.title2,
    fontWeight: "700",
    marginBottom: 4,
  },
  heroTagline: {
    ...Typography.subhead,
    lineHeight: 20,
  },
  trustBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  trustLabel: {
    ...Typography.caption1,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  verifiedText: {
    ...Typography.caption2,
    fontWeight: "600",
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.headline,
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  sectionBadgeText: {
    ...Typography.caption1,
    fontWeight: "700",
  },
  linkBox: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.md,
  },
  linkText: {
    ...Typography.footnote,
    fontFamily: "monospace",
  },
  copyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.md,
    alignSelf: "flex-start",
  },
  copyBannerText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  linkActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  linkActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
  },
  linkActionText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  noLinkState: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  noLinkTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  noLinkSubtitle: {
    ...Typography.footnote,
    textAlign: "center",
    lineHeight: 18,
  },
  loadingRow: {
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  serviceLeft: {
    flex: 1,
  },
  serviceName: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: 2,
  },
  serviceDesc: {
    ...Typography.caption1,
    marginBottom: Spacing.xs,
  },
  categoryTag: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: 2,
  },
  categoryTagText: {
    ...Typography.caption2,
    fontWeight: "500",
  },
  servicePrice: {
    ...Typography.subhead,
    fontWeight: "700",
  },
  emptyServices: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  addServiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  addServiceText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  reviewRow: {
    paddingVertical: Spacing.md,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  reviewerName: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  reviewComment: {
    ...Typography.body,
    lineHeight: 20,
  },
  seeAllReviews: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
    justifyContent: "center",
  },
  seeAllText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  contactText: {
    ...Typography.body,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  footerSecondary: {
    width: 120,
  },
  footerPrimary: {
    flex: 1,
  },
});
