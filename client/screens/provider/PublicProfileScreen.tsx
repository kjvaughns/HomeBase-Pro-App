import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  Pressable,
  Share,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user, providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;

  const businessName = providerProfile?.businessName || "Your Business Name";

  const { data: bookingLinksData } = useQuery<{ bookingLinks: BookingLink[] }>({
    queryKey: ["/api/providers", providerId, "booking-links"],
    enabled: !!providerId,
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery<{ services: ProviderService[] }>({
    queryKey: ["/api/provider", providerId, "custom-services"],
    enabled: !!providerId,
  });

  const activeLink = bookingLinksData?.bookingLinks?.find((l) => l.status === "active");
  const slug = activeLink?.slug;
  const domain = process.env.EXPO_PUBLIC_DOMAIN || "localhost:5000";
  const profileUrl = slug ? `${domain}/book/${slug}` : null;
  const services = servicesData?.services || [];

  const formatPrice = (svc: ProviderService): string => {
    if (svc.pricingType === "quote") return "Quote";
    if (svc.basePrice) return `$${svc.basePrice}`;
    return "Contact";
  };

  const handleShare = async () => {
    if (!profileUrl) {
      Alert.alert("No Booking Link", "Create a booking link first from the Business Profile screen.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `Book my services at https://${profileUrl}`,
        url: `https://${profileUrl}`,
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const handleCopyLink = async () => {
    if (!profileUrl) {
      Alert.alert("No Booking Link", "Create a booking link first from the Business Profile screen.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(`https://${profileUrl}`);
    Alert.alert("Copied!", "Your booking link has been copied to clipboard.");
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Feather
            key={star}
            name="star"
            size={14}
            color={star <= rating ? Colors.accent : theme.backgroundTertiary}
            style={{ marginRight: 2 }}
          />
        ))}
      </View>
    );
  };

  const providerRating = providerProfile?.rating ? Number(providerProfile.rating) : 0;
  const reviewCount = providerProfile?.reviewCount || 0;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.delay(50).duration(300)}>
          <View style={styles.header}>
            <Pressable
              style={[styles.backButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color={theme.text} />
            </Pressable>
            <ThemedText style={styles.headerTitle}>Public Profile</ThemedText>
            <View style={styles.headerActions}>
              <View style={{ width: 40 }} />
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <GlassCard style={styles.linkCard}>
            <View style={styles.linkHeader}>
              <Feather name="link" size={18} color={Colors.accent} />
              <ThemedText style={styles.linkLabel}>Your Booking Link</ThemedText>
            </View>
            <View style={[styles.linkDisplay, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText style={styles.linkText}>
                {profileUrl || "No booking link created yet"}
              </ThemedText>
            </View>
            {profileUrl ? (
              <View style={styles.linkActions}>
                <Pressable style={styles.linkButton} onPress={handleCopyLink}>
                  <Feather name="copy" size={16} color={Colors.accent} />
                  <ThemedText style={[styles.linkButtonText, { color: Colors.accent }]}>Copy</ThemedText>
                </Pressable>
                <Pressable style={styles.linkButton} onPress={handleShare}>
                  <Feather name="share" size={16} color={Colors.accent} />
                  <ThemedText style={[styles.linkButtonText, { color: Colors.accent }]}>Share</ThemedText>
                </Pressable>
              </View>
            ) : null}
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            PREVIEW
          </ThemedText>
          <View style={[styles.previewContainer, { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight }]}>
            <View style={styles.heroSection}>
              <Image
                source={{ uri: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80" }}
                style={styles.coverImage}
              />
              <View style={styles.coverOverlay} />

              <View style={styles.profileSection}>
                <View style={[styles.avatarWrapper, { borderColor: theme.backgroundDefault }]}>
                  <Avatar uri={user?.avatarUrl} name={businessName} size="large" />
                </View>
                <ThemedText style={styles.businessName}>{businessName}</ThemedText>
                {providerRating > 0 ? (
                  <View style={styles.ratingContainer}>
                    {renderStars(Math.round(providerRating))}
                    <ThemedText style={[styles.ratingText, { color: theme.textSecondary }]}>
                      {providerRating.toFixed(1)} ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                    </ThemedText>
                  </View>
                ) : null}
                <View style={styles.badgesRow}>
                  <View style={[styles.badge, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="check-circle" size={12} color={Colors.accent} />
                    <ThemedText style={[styles.badgeText, { color: Colors.accent }]}>Verified</ThemedText>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.contentSection}>
              <View style={styles.servicesSection}>
                <ThemedText style={styles.sectionTitle}>Services</ThemedText>
                {servicesLoading ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : services.length > 0 ? (
                  services.map((service) => (
                    <View
                      key={service.id}
                      style={[styles.serviceCard, { backgroundColor: theme.backgroundDefault }]}
                    >
                      <View style={styles.serviceInfo}>
                        <ThemedText style={styles.serviceName}>{service.name}</ThemedText>
                        {service.description ? (
                          <ThemedText style={[styles.serviceDesc, { color: theme.textSecondary }]}>
                            {service.description}
                          </ThemedText>
                        ) : null}
                      </View>
                      <View style={styles.servicePrice}>
                        <ThemedText style={[styles.priceText, { color: Colors.accent }]}>
                          {formatPrice(service)}
                        </ThemedText>
                      </View>
                    </View>
                  ))
                ) : (
                  <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No services added yet. Add services from the Services screen.
                  </ThemedText>
                )}
              </View>

              <View style={styles.contactSection}>
                <ThemedText style={styles.sectionTitle}>Contact</ThemedText>
                {user?.phone ? (
                  <View style={styles.contactRow}>
                    <Feather name="phone" size={16} color={theme.textSecondary} />
                    <ThemedText style={[styles.contactText, { color: theme.textSecondary }]}>
                      {user.phone}
                    </ThemedText>
                  </View>
                ) : null}
                {user?.email ? (
                  <View style={styles.contactRow}>
                    <Feather name="mail" size={16} color={theme.textSecondary} />
                    <ThemedText style={[styles.contactText, { color: theme.textSecondary }]}>
                      {user.email}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeIn.delay(300).duration(300)}
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Spacing.md,
            backgroundColor: theme.backgroundDefault,
            borderTopColor: theme.borderLight,
          },
        ]}
      >
        <PrimaryButton onPress={handleShare}>
          Share Your Profile
        </PrimaryButton>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.screenPadding,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...Typography.title3,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  linkCard: {
    marginBottom: Spacing.lg,
  },
  linkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  linkLabel: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  linkDisplay: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  linkText: {
    ...Typography.body,
    fontFamily: "monospace",
  },
  linkActions: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  linkButtonText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  sectionLabel: {
    ...Typography.footnote,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  previewContainer: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroSection: {
    height: 200,
    position: "relative",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  profileSection: {
    position: "absolute",
    bottom: -50,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  avatarWrapper: {
    borderWidth: 4,
    borderRadius: 50,
  },
  businessName: {
    ...Typography.title2,
    fontWeight: "700",
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  starsRow: {
    flexDirection: "row",
  },
  ratingText: {
    ...Typography.footnote,
  },
  badgesRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  contentSection: {
    paddingTop: 60,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headline,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  servicesSection: {
    marginBottom: Spacing.xl,
  },
  serviceCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: 2,
  },
  serviceDesc: {
    ...Typography.caption1,
  },
  servicePrice: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  priceText: {
    ...Typography.footnote,
    fontWeight: "600",
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
  contactSection: {},
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
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
});
