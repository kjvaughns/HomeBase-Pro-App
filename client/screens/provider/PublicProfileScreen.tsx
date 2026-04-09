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
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";

type FeatherName = ComponentProps<typeof Feather>["name"];

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
  const businessName = providerProfile?.businessName || "Your Business";

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
  const profileUrl = slug ? `https://homebaseproapp.com/book/${slug}` : null;
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

  const handlePreview = async () => {
    if (!profileUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await WebBrowser.openBrowserAsync(profileUrl);
  };

  const renderStars = (rating: number) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Feather
          key={star}
          name="star"
          size={12}
          color={star <= Math.round(rating) ? Colors.warning : theme.backgroundTertiary}
        />
      ))}
    </View>
  );

  const ActionButton = ({
    icon,
    label,
    onPress,
    accent,
  }: {
    icon: FeatherName;
    label: string;
    onPress: () => void;
    accent?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.actionBtn,
        { backgroundColor: accent ? Colors.accentLight : theme.backgroundSecondary },
      ]}
    >
      <Feather name={icon} size={16} color={accent ? Colors.accent : theme.textSecondary} />
      <ThemedText style={[styles.actionBtnText, { color: accent ? Colors.accent : theme.textSecondary }]}>
        {label}
      </ThemedText>
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.delay(0).duration(350)}>
          <GlassCard style={styles.heroCard}>
            <View style={styles.heroCentered}>
              <Avatar uri={user?.avatarUrl} name={businessName} size="xl" />
              <View style={styles.verifiedRow}>
                <Feather name="shield" size={12} color={Colors.accent} />
                <ThemedText style={[styles.verifiedLabel, { color: Colors.accent }]}>
                  Verified Provider
                </ThemedText>
              </View>
              <ThemedText style={styles.heroName}>{businessName}</ThemedText>
              {providerProfile?.serviceArea ? (
                <ThemedText style={[styles.heroArea, { color: theme.textSecondary }]}>
                  {providerProfile.serviceArea}
                </ThemedText>
              ) : null}
            </View>

            {(providerRating > 0 || (providerProfile?.completedJobs ?? 0) > 0) ? (
              <View style={[styles.statRow, { borderTopColor: theme.separator }]}>
                {providerRating > 0 ? (
                  <View style={styles.statItem}>
                    {renderStars(providerRating)}
                    <ThemedText style={[styles.statValue, { color: theme.text }]}>
                      {providerRating.toFixed(1)}
                    </ThemedText>
                    <ThemedText style={[styles.statLabel, { color: theme.textTertiary }]}>
                      ({reviewCount} reviews)
                    </ThemedText>
                  </View>
                ) : null}
                {(providerProfile?.completedJobs ?? 0) > 0 ? (
                  <View style={[styles.statDivider, { backgroundColor: theme.separator }]} />
                ) : null}
                {(providerProfile?.completedJobs ?? 0) > 0 ? (
                  <View style={styles.statItem}>
                    <Feather name="check-circle" size={14} color={Colors.accent} />
                    <ThemedText style={[styles.statValue, { color: theme.text }]}>
                      {providerProfile?.completedJobs}
                    </ThemedText>
                    <ThemedText style={[styles.statLabel, { color: theme.textTertiary }]}>
                      jobs done
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ) : null}
          </GlassCard>
        </Animated.View>

        {/* Booking Link */}
        <Animated.View entering={FadeInDown.delay(80).duration(350)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: Colors.accentLight }]}>
                <Feather name="link-2" size={15} color={Colors.accent} />
              </View>
              <ThemedText style={styles.sectionTitle}>Booking Link</ThemedText>
            </View>

            {profileUrl ? (
              <>
                <View style={[styles.linkPill, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="globe" size={13} color={theme.textTertiary} />
                  <ThemedText style={[styles.linkText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {profileUrl}
                  </ThemedText>
                </View>

                {copyFeedback ? (
                  <Animated.View entering={FadeIn.duration(150)}>
                    <View style={[styles.copyBanner, { backgroundColor: Colors.accentLight }]}>
                      <Feather name="check" size={13} color={Colors.accent} />
                      <ThemedText style={[styles.copyBannerText, { color: Colors.accent }]}>
                        Copied to clipboard
                      </ThemedText>
                    </View>
                  </Animated.View>
                ) : null}

                <View style={styles.actionRow}>
                  <ActionButton icon="copy" label="Copy" onPress={handleCopyLink} accent />
                  <ActionButton icon="eye" label="Preview" onPress={handlePreview} />
                  <ActionButton icon="share-2" label="Share" onPress={handleShare} />
                </View>
              </>
            ) : (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="link" size={22} color={theme.textTertiary} />
                </View>
                <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
                  No booking link yet
                </ThemedText>
                <ThemedText style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
                  Create one from your Business Hub to let clients book directly.
                </ThemedText>
              </View>
            )}
          </GlassCard>
        </Animated.View>

        {/* Services */}
        <Animated.View entering={FadeInDown.delay(140).duration(350)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: Colors.accentLight }]}>
                <Feather name="tool" size={15} color={Colors.accent} />
              </View>
              <ThemedText style={styles.sectionTitle}>Services</ThemedText>
              {services.length > 0 ? (
                <View style={[styles.countBadge, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText style={[styles.countText, { color: theme.textSecondary }]}>
                    {services.length}
                  </ThemedText>
                </View>
              ) : null}
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
                    idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
                  ]}
                >
                  <View style={[styles.serviceAccent, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="check" size={12} color={Colors.accent} />
                  </View>
                  <View style={styles.serviceBody}>
                    <ThemedText style={styles.serviceName}>{svc.name}</ThemedText>
                    {svc.description ? (
                      <ThemedText style={[styles.serviceDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                        {svc.description}
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={[styles.pricePill, { backgroundColor: Colors.accentLight }]}>
                    <ThemedText style={[styles.priceText, { color: Colors.accent }]}>
                      {formatPrice(svc)}
                    </ThemedText>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="tool" size={22} color={theme.textTertiary} />
                </View>
                <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
                  No services yet
                </ThemedText>
                <ThemedText style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
                  Add services from your Business Hub.
                </ThemedText>
                <Pressable
                  style={[styles.inlineBtn, { backgroundColor: Colors.accentLight }]}
                  onPress={() => navigation.navigate("NewService")}
                >
                  <Feather name="plus" size={14} color={Colors.accent} />
                  <ThemedText style={[styles.inlineBtnText, { color: Colors.accent }]}>
                    Add a Service
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </GlassCard>
        </Animated.View>

        {/* Reviews */}
        {reviews.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(180).duration(350)}>
            <GlassCard style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: "#FFF7E6" }]}>
                  <Feather name="star" size={15} color={Colors.warning} />
                </View>
                <ThemedText style={styles.sectionTitle}>Reviews</ThemedText>
                <View style={[styles.countBadge, { backgroundColor: Colors.accentLight }]}>
                  <ThemedText style={[styles.countText, { color: Colors.accent }]}>
                    {providerRating.toFixed(1)}
                  </ThemedText>
                </View>
              </View>

              {reviews.slice(0, 3).map((review, idx) => (
                <View
                  key={review.id}
                  style={[
                    styles.reviewRow,
                    idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
                  ]}
                >
                  <View style={styles.reviewTop}>
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
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Contact */}
        <Animated.View entering={FadeInDown.delay(220).duration(350)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="user" size={15} color={theme.textSecondary} />
              </View>
              <ThemedText style={styles.sectionTitle}>Contact</ThemedText>
            </View>

            {user?.email ? (
              <View style={styles.contactRow}>
                <View style={[styles.contactIconWrap, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="mail" size={15} color={theme.textSecondary} />
                </View>
                <ThemedText style={[styles.contactText, { color: theme.textSecondary }]}>
                  {user.email}
                </ThemedText>
              </View>
            ) : null}

            {user?.phone ? (
              <View style={[styles.contactRow, user?.email ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator } : {}]}>
                <View style={[styles.contactIconWrap, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="phone" size={15} color={theme.textSecondary} />
                </View>
                <ThemedText style={[styles.contactText, { color: theme.textSecondary }]}>
                  {user.phone}
                </ThemedText>
              </View>
            ) : null}

            {!user?.email && !user?.phone ? (
              <ThemedText style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
                No contact info on file. Update your profile.
              </ThemedText>
            ) : null}
          </GlassCard>
        </Animated.View>
      </ScrollView>

      {/* Footer CTA */}
      <Animated.View
        entering={FadeIn.delay(350).duration(300)}
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
          <View style={styles.footerRow}>
            <Pressable
              style={[styles.footerSecondary, { backgroundColor: theme.backgroundSecondary }]}
              onPress={handleCopyLink}
            >
              <Feather name="copy" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.footerSecondaryText, { color: theme.textSecondary }]}>
                Copy Link
              </ThemedText>
            </Pressable>
            <View style={styles.footerPrimary}>
              <PrimaryButton onPress={handleShare}>
                Share Profile
              </PrimaryButton>
            </View>
          </View>
        ) : (
          <PrimaryButton onPress={() => navigation.navigate("BusinessHub")}>
            Set Up Booking Link
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
  scroll: {
    paddingHorizontal: Spacing.screenPadding,
  },
  heroCard: {
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  heroCentered: {
    alignItems: "center",
    paddingBottom: Spacing.md,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  verifiedLabel: {
    ...Typography.caption2,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroName: {
    ...Typography.title2,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  heroArea: {
    ...Typography.subhead,
    textAlign: "center",
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.lg,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 16,
  },
  statValue: {
    ...Typography.subhead,
    fontWeight: "700",
  },
  statLabel: {
    ...Typography.caption1,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
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
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    ...Typography.headline,
    flex: 1,
  },
  countBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: "center",
  },
  countText: {
    ...Typography.caption1,
    fontWeight: "700",
  },
  linkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  linkText: {
    ...Typography.footnote,
    flex: 1,
  },
  copyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-start",
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    marginBottom: Spacing.md,
  },
  copyBannerText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  actionBtnText: {
    ...Typography.footnote,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubtitle: {
    ...Typography.footnote,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  inlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inlineBtnText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  loadingRow: {
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  serviceAccent: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceBody: {
    flex: 1,
  },
  serviceName: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  serviceDesc: {
    ...Typography.caption1,
    marginTop: 2,
  },
  pricePill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  priceText: {
    ...Typography.caption1,
    fontWeight: "700",
  },
  reviewRow: {
    paddingVertical: Spacing.md,
  },
  reviewTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  reviewerName: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  reviewComment: {
    ...Typography.body,
    lineHeight: 20,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  contactIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  contactText: {
    ...Typography.body,
    flex: 1,
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
  footerRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "center",
  },
  footerSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  footerSecondaryText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  footerPrimary: {
    flex: 1,
  },
});
