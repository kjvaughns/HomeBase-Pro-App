import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  Pressable,
  Share,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Service {
  id: string;
  name: string;
  price: string;
  description: string;
}

interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
}

const MOCK_SERVICES: Service[] = [
  { id: "1", name: "AC Repair & Tune-Up", price: "$89 service call", description: "Full diagnostic and repair for all AC units" },
  { id: "2", name: "Furnace Installation", price: "From $2,500", description: "Complete furnace replacement with warranty" },
  { id: "3", name: "Duct Cleaning", price: "$299", description: "Whole-home duct cleaning service" },
];

const MOCK_REVIEWS: Review[] = [
  { id: "1", author: "Sarah M.", rating: 5, text: "Prompt, professional, and fair pricing. Fixed our AC the same day!", date: "2 weeks ago" },
  { id: "2", author: "Michael R.", rating: 5, text: "Best HVAC service in the area. Highly recommend!", date: "1 month ago" },
  { id: "3", author: "Jennifer L.", rating: 4, text: "Great work on our furnace installation. Very knowledgeable team.", date: "2 months ago" },
];

export default function PublicProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const { user, providerProfile } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);

  const businessName = providerProfile?.businessName || "Your Business Name";
  const slug = businessName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const profileUrl = `homebase.app/p/${slug}`;

  const handleShare = async () => {
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(`https://${profileUrl}`);
    Alert.alert("Copied!", "Your profile link has been copied to clipboard.");
  };

  const handleEditProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsEditing(!isEditing);
  };

  const handleBookService = (service: Service) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
              <Pressable
                style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={handleEditProfile}
              >
                <Feather name={isEditing ? "check" : "edit-2"} size={18} color={theme.text} />
              </Pressable>
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
              <ThemedText style={styles.linkText}>{profileUrl}</ThemedText>
            </View>
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
                <View style={styles.ratingContainer}>
                  {renderStars(5)}
                  <ThemedText style={[styles.ratingText, { color: theme.textSecondary }]}>
                    4.9 (128 reviews)
                  </ThemedText>
                </View>
                <View style={styles.badgesRow}>
                  <View style={[styles.badge, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="check-circle" size={12} color={Colors.accent} />
                    <ThemedText style={[styles.badgeText, { color: Colors.accent }]}>Licensed</ThemedText>
                  </View>
                  <View style={[styles.badge, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="shield" size={12} color={Colors.accent} />
                    <ThemedText style={[styles.badgeText, { color: Colors.accent }]}>Insured</ThemedText>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.contentSection}>
              <View style={styles.aboutSection}>
                <ThemedText style={styles.sectionTitle}>About</ThemedText>
                <ThemedText style={[styles.aboutText, { color: theme.textSecondary }]}>
                  Professional HVAC services with over 15 years of experience. We specialize in residential heating and cooling solutions, offering fast response times and quality workmanship. Licensed, insured, and committed to your comfort.
                </ThemedText>
              </View>

              <View style={styles.servicesSection}>
                <ThemedText style={styles.sectionTitle}>Services</ThemedText>
                {MOCK_SERVICES.map((service) => (
                  <Pressable
                    key={service.id}
                    style={[styles.serviceCard, { backgroundColor: theme.backgroundDefault }]}
                    onPress={() => handleBookService(service)}
                  >
                    <View style={styles.serviceInfo}>
                      <ThemedText style={styles.serviceName}>{service.name}</ThemedText>
                      <ThemedText style={[styles.serviceDesc, { color: theme.textSecondary }]}>
                        {service.description}
                      </ThemedText>
                    </View>
                    <View style={styles.servicePrice}>
                      <ThemedText style={[styles.priceText, { color: Colors.accent }]}>
                        {service.price}
                      </ThemedText>
                      <View style={[styles.bookButton, { backgroundColor: Colors.accent }]}>
                        <ThemedText style={styles.bookButtonText}>Book</ThemedText>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>

              <View style={styles.reviewsSection}>
                <View style={styles.reviewsHeader}>
                  <ThemedText style={styles.sectionTitle}>Reviews</ThemedText>
                  <ThemedText style={[styles.seeAll, { color: Colors.accent }]}>See all</ThemedText>
                </View>
                {MOCK_REVIEWS.slice(0, 2).map((review) => (
                  <View key={review.id} style={[styles.reviewCard, { backgroundColor: theme.backgroundDefault }]}>
                    <View style={styles.reviewHeader}>
                      <ThemedText style={styles.reviewAuthor}>{review.author}</ThemedText>
                      {renderStars(review.rating)}
                    </View>
                    <ThemedText style={[styles.reviewText, { color: theme.textSecondary }]}>
                      {review.text}
                    </ThemedText>
                    <ThemedText style={[styles.reviewDate, { color: theme.textTertiary }]}>
                      {review.date}
                    </ThemedText>
                  </View>
                ))}
              </View>

              <View style={styles.contactSection}>
                <ThemedText style={styles.sectionTitle}>Contact</ThemedText>
                <View style={styles.contactRow}>
                  <Feather name="phone" size={16} color={theme.textSecondary} />
                  <ThemedText style={[styles.contactText, { color: theme.textSecondary }]}>
                    (555) 123-4567
                  </ThemedText>
                </View>
                <View style={styles.contactRow}>
                  <Feather name="mail" size={16} color={theme.textSecondary} />
                  <ThemedText style={[styles.contactText, { color: theme.textSecondary }]}>
                    contact@yourbusiness.com
                  </ThemedText>
                </View>
                <View style={styles.contactRow}>
                  <Feather name="map-pin" size={16} color={theme.textSecondary} />
                  <ThemedText style={[styles.contactText, { color: theme.textSecondary }]}>
                    San Francisco Bay Area
                  </ThemedText>
                </View>
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
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
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
  aboutSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.headline,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  aboutText: {
    ...Typography.body,
    lineHeight: 22,
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
  bookButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  bookButtonText: {
    ...Typography.caption1,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  reviewsSection: {
    marginBottom: Spacing.xl,
  },
  reviewsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  seeAll: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  reviewCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  reviewAuthor: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  reviewText: {
    ...Typography.body,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  reviewDate: {
    ...Typography.caption1,
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
