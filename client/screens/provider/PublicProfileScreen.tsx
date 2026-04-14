import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Share,
  ActivityIndicator,
} from "react-native";
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
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";

type FeatherName = ComponentProps<typeof Feather>["name"];

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAY_LABELS: Record<DayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

interface BusinessHoursDay {
  enabled: boolean;
  open: string;
  close: string;
}

interface ProviderData {
  id: string;
  businessName: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  serviceArea: string | null;
  avatarUrl: string | null;
  rating: string | null;
  reviewCount: number | null;
  completedJobs: number | null;
  serviceZipCodes: string[] | null;
  serviceCities: string[] | null;
  businessHours: Record<DayKey, BusinessHoursDay> | null;
}

interface CustomService {
  id: string;
  name: string;
  description: string | null;
  basePrice: string | null;
  pricingType: string | null;
  isPublished: boolean;
}

interface BookingLink {
  id: string;
  slug: string;
  status: string;
}

export default function PublicProfileScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();

  const providerId = providerProfile?.id;

  const [copyFeedback, setCopyFeedback] = useState(false);

  const { data: providerData, isLoading: providerLoading } = useQuery<{ provider: ProviderData }>({
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
      if (!res.ok) throw new Error("Failed to load services");
      return res.json();
    },
  });

  const { data: bookingLinksData } = useQuery<{ bookingLinks: BookingLink[] }>({
    queryKey: ["/api/providers", providerId, "booking-links"],
    enabled: !!providerId,
  });

  const provider = providerData?.provider;
  const allServices = servicesData?.services || [];
  const publishedServices = allServices.filter((s) => s.isPublished !== false);
  const activeLink = bookingLinksData?.bookingLinks?.find((l) => l.status === "active");
  const slug = activeLink?.slug;
  const profileUrl = slug ? `https://homebaseproapp.com/providers/${slug}` : null;

  const businessName = provider?.businessName || providerProfile?.businessName || "Your Business";
  const providerRating = provider?.rating ? Number(provider.rating) : 0;
  const reviewCount = provider?.reviewCount ?? 0;

  const formatPrice = (svc: CustomService): string => {
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

  const handleOpenWeb = async () => {
    if (!profileUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await WebBrowser.openBrowserAsync(profileUrl);
  };

  const handleEditHub = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("BusinessHub");
  };

  const renderStars = (rating: number) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Feather
          key={star}
          name="star"
          size={13}
          color={star <= Math.round(rating) ? Colors.warning : theme.borderLight}
        />
      ))}
    </View>
  );

  const ActionBtn = ({
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
      <Feather name={icon} size={15} color={accent ? Colors.accent : theme.textSecondary} />
      <ThemedText style={[styles.actionBtnText, { color: accent ? Colors.accent : theme.textSecondary }]}>
        {label}
      </ThemedText>
    </Pressable>
  );

  const InfoRow = ({
    icon,
    value,
    border,
  }: {
    icon: FeatherName;
    value: string;
    border?: boolean;
  }) => (
    <View
      style={[
        styles.infoRow,
        border ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator } : {},
      ]}
    >
      <View style={[styles.infoIcon, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name={icon} size={14} color={theme.textSecondary} />
      </View>
      <ThemedText style={[styles.infoText, { color: theme.textSecondary }]} numberOfLines={2}>
        {value}
      </ThemedText>
    </View>
  );

  if (providerLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.centered, { paddingTop: headerHeight + 40 }]}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* Preview Mode Banner */}
        <Animated.View entering={FadeInDown.delay(0).duration(300)}>
          <View style={[styles.previewBanner, { backgroundColor: Colors.accentLight }]}>
            <Feather name="eye" size={14} color={Colors.accent} />
            <ThemedText style={[styles.previewBannerText, { color: Colors.accent }]}>
              Preview — this is what clients see
            </ThemedText>
            <Pressable onPress={handleEditHub} style={styles.editBannerBtn}>
              <ThemedText style={[styles.editBannerBtnText, { color: Colors.accent }]}>
                Edit
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        {/* Hero */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)}>
          <GlassCard style={styles.heroCard}>
            <View style={styles.heroCentered}>
              <Avatar
                uri={provider?.avatarUrl}
                name={businessName}
                size="xl"
              />
              <View style={styles.verifiedRow}>
                <Feather name="shield" size={12} color={Colors.accent} />
                <ThemedText style={[styles.verifiedLabel, { color: Colors.accent }]}>
                  Verified Provider
                </ThemedText>
              </View>
              <ThemedText style={styles.heroName}>{businessName}</ThemedText>
              {provider?.serviceArea ? (
                <ThemedText style={[styles.heroArea, { color: theme.textSecondary }]}>
                  {provider.serviceArea}
                </ThemedText>
              ) : null}
              {provider?.description ? (
                <ThemedText style={[styles.heroDescription, { color: theme.textSecondary }]}>
                  {provider.description}
                </ThemedText>
              ) : null}
            </View>

            {(providerRating > 0 || (provider?.completedJobs ?? 0) > 0) ? (
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
                {(providerRating > 0) && ((provider?.completedJobs ?? 0) > 0) ? (
                  <View style={[styles.statDivider, { backgroundColor: theme.separator }]} />
                ) : null}
                {(provider?.completedJobs ?? 0) > 0 ? (
                  <View style={styles.statItem}>
                    <Feather name="check-circle" size={13} color={Colors.accent} />
                    <ThemedText style={[styles.statValue, { color: theme.text }]}>
                      {provider?.completedJobs}
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

        {/* Services */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: Colors.accentLight }]}>
                <Feather name="tool" size={15} color={Colors.accent} />
              </View>
              <ThemedText style={styles.sectionTitle}>Services</ThemedText>
              {publishedServices.length > 0 ? (
                <View style={[styles.countBadge, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText style={[styles.countText, { color: theme.textSecondary }]}>
                    {publishedServices.length}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {servicesLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={Colors.accent} />
              </View>
            ) : publishedServices.length > 0 ? (
              publishedServices.map((svc, idx) => (
                <View
                  key={svc.id}
                  style={[
                    styles.serviceRow,
                    idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
                  ]}
                >
                  <View style={[styles.serviceAccent, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="check" size={11} color={Colors.accent} />
                  </View>
                  <View style={styles.serviceBody}>
                    <ThemedText style={styles.serviceName}>{svc.name}</ThemedText>
                    {svc.description ? (
                      <ThemedText style={[styles.serviceDesc, { color: theme.textTertiary }]} numberOfLines={2}>
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
              <View style={styles.emptyInline}>
                <ThemedText style={[styles.emptyInlineText, { color: theme.textTertiary }]}>
                  No published services yet. Add services in Business Hub.
                </ThemedText>
              </View>
            )}
          </GlassCard>
        </Animated.View>

        {/* Business Hours */}
        {provider?.businessHours ? (
          <Animated.View entering={FadeInDown.delay(180).duration(350)}>
            <GlassCard style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="clock" size={15} color={Colors.accent} />
                </View>
                <ThemedText style={styles.sectionTitle}>Business Hours</ThemedText>
              </View>

              {DAY_ORDER.map((day, idx) => {
                const dayData = provider.businessHours![day];
                if (!dayData) return null;
                return (
                  <View
                    key={day}
                    style={[
                      styles.hoursRow,
                      idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
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
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Service Area */}
        {((provider?.serviceCities && provider.serviceCities.length > 0) ||
          (provider?.serviceZipCodes && provider.serviceZipCodes.length > 0)) ? (
          <Animated.View entering={FadeInDown.delay(220).duration(350)}>
            <GlassCard style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="map-pin" size={15} color={Colors.accent} />
                </View>
                <ThemedText style={styles.sectionTitle}>Service Area</ThemedText>
              </View>

              {provider.serviceCities && provider.serviceCities.length > 0 ? (
                <View style={styles.chipWrap}>
                  {provider.serviceCities.map((city) => (
                    <View key={city} style={[styles.chip, { backgroundColor: theme.backgroundSecondary }]}>
                      <ThemedText style={[styles.chipText, { color: theme.textSecondary }]}>
                        {city}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}

              {provider.serviceZipCodes && provider.serviceZipCodes.length > 0 ? (
                <View style={[styles.chipWrap, provider.serviceCities && provider.serviceCities.length > 0 ? { marginTop: Spacing.sm } : {}]}>
                  {provider.serviceZipCodes.map((zip) => (
                    <View key={zip} style={[styles.chip, { backgroundColor: theme.backgroundSecondary }]}>
                      <ThemedText style={[styles.chipText, { color: theme.textTertiary }]}>
                        {zip}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Contact */}
        {(provider?.phone || provider?.email) ? (
          <Animated.View entering={FadeInDown.delay(260).duration(350)}>
            <GlassCard style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="user" size={15} color={theme.textSecondary} />
                </View>
                <ThemedText style={styles.sectionTitle}>Contact</ThemedText>
              </View>

              {provider.phone ? (
                <InfoRow icon="phone" value={provider.phone} />
              ) : null}
              {provider.email ? (
                <InfoRow icon="mail" value={provider.email} border={!!provider.phone} />
              ) : null}
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Booking Link */}
        <Animated.View entering={FadeInDown.delay(300).duration(350)}>
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

                <View style={styles.actionRow}>
                  <ActionBtn icon="copy" label="Copy" onPress={handleCopyLink} accent />
                  <ActionBtn icon="external-link" label="Open" onPress={handleOpenWeb} />
                  <ActionBtn icon="share-2" label="Share" onPress={handleShare} />
                </View>
              </>
            ) : (
              <View style={styles.emptyInline}>
                <ThemedText style={[styles.emptyInlineText, { color: theme.textTertiary }]}>
                  No active booking link. Create one from Business Hub.
                </ThemedText>
                <Pressable
                  onPress={handleEditHub}
                  style={[styles.emptyInlineBtn, { backgroundColor: Colors.accentLight }]}
                >
                  <ThemedText style={[styles.emptyInlineBtnText, { color: Colors.accent }]}>
                    Go to Business Hub
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </GlassCard>
        </Animated.View>

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.md,
  },
  previewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
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
  heroCard: {
    overflow: "hidden",
  },
  heroCentered: {
    alignItems: "center",
    paddingBottom: Spacing.md,
    gap: 4,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.sm,
  },
  verifiedLabel: {
    ...Typography.caption2,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroName: {
    ...Typography.title2,
    fontWeight: "700",
    textAlign: "center",
  },
  heroArea: {
    ...Typography.subhead,
    textAlign: "center",
  },
  heroDescription: {
    ...Typography.footnote,
    textAlign: "center",
    lineHeight: 19,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
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
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  statValue: {
    ...Typography.subhead,
    fontWeight: "700",
  },
  statLabel: {
    ...Typography.caption1,
  },
  section: {},
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
    minWidth: 26,
    alignItems: "center",
  },
  countText: {
    ...Typography.caption1,
    fontWeight: "700",
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
    width: 22,
    height: 22,
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
    lineHeight: 16,
  },
  pricePill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  priceText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm + 2,
  },
  hoursDay: {
    ...Typography.subhead,
    fontWeight: "600",
    width: 44,
  },
  hoursTime: {
    ...Typography.subhead,
  },
  hoursClosed: {
    ...Typography.subhead,
    fontStyle: "italic",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  chip: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  chipText: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    ...Typography.subhead,
    flex: 1,
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
  emptyInline: {
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    alignItems: "flex-start",
  },
  emptyInlineText: {
    ...Typography.footnote,
    lineHeight: 18,
  },
  emptyInlineBtn: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  emptyInlineBtnText: {
    ...Typography.footnote,
    fontWeight: "600",
  },
});
