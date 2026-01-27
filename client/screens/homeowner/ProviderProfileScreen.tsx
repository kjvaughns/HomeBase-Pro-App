import React, { useState, useMemo } from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

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

type ScreenRouteProp = RouteProp<RootStackParamList, "ProviderProfile">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = "about" | "services" | "reviews";

export default function ProviderProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { providerId } = route.params;

  const providers = useHomeownerStore((s) => s.providers);
  const allReviews = useHomeownerStore((s) => s.reviews);
  const categories = useHomeownerStore((s) => s.categories);
  const { isAuthenticated } = useAuthStore();
  
  const provider = useMemo(() => {
    return providers.find((p) => p.id === providerId);
  }, [providers, providerId]);
  
  const reviews = useMemo(() => {
    return allReviews.filter((r) => r.providerId === providerId);
  }, [allReviews, providerId]);

  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [showAccountGate, setShowAccountGate] = useState(false);

  if (!provider) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Provider not found</ThemedText>
      </ThemedView>
    );
  }

  const category = categories.find((c) => c.id === provider.categoryIds[0]);

  const handleBookPress = () => {
    if (!isAuthenticated) {
      setShowAccountGate(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("BookingRequest", {
      providerId: provider.id,
      categoryId: provider.categoryIds[0],
      service: provider.services[0],
    });
  };

  const handleSignIn = () => {
    setShowAccountGate(false);
    navigation.navigate("Login");
  };

  const handleSignUp = () => {
    setShowAccountGate(false);
    navigation.navigate("SignUp");
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;

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

  const renderAboutTab = () => (
    <Animated.View entering={FadeInDown.duration(300)}>
      <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>About</ThemedText>
      <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
        {provider.description}
      </ThemedText>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
          <Feather name="briefcase" size={20} color={Colors.accent} />
          <ThemedText style={styles.statValue}>{provider.yearsExperience}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Years Exp.</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
          <Feather name="check-circle" size={20} color={Colors.accent} />
          <ThemedText style={styles.statValue}>{provider.completedJobs}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Jobs Done</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
          <Feather name="clock" size={20} color={Colors.accent} />
          <ThemedText style={styles.statValue}>{provider.distance?.toFixed(1) || "N/A"}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Miles Away</ThemedText>
        </View>
      </View>

      <View style={[styles.infoRow, { borderColor: theme.borderLight }]}>
        <Feather name="message-circle" size={18} color={theme.textSecondary} />
        <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
          {provider.responseTime}
        </ThemedText>
      </View>
    </Animated.View>
  );

  const renderServicesTab = () => (
    <Animated.View entering={FadeInDown.duration(300)}>
      <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Services Offered</ThemedText>
      {provider.services.map((service, index) => (
        <Pressable
          key={service}
          style={[styles.serviceRow, { borderColor: theme.borderLight }]}
          onPress={() => {
            if (isAuthenticated) {
              navigation.navigate("BookingRequest", {
                providerId: provider.id,
                categoryId: provider.categoryIds[0],
                service,
              });
            } else {
              setShowAccountGate(true);
            }
          }}
        >
          <View style={[styles.serviceIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name="check" size={16} color={Colors.accent} />
          </View>
          <ThemedText style={styles.serviceName}>{service}</ThemedText>
          <Feather name="chevron-right" size={18} color={theme.textTertiary} />
        </Pressable>
      ))}

      <View style={styles.pricingCard}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Pricing</ThemedText>
        <View style={styles.priceRow}>
          <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
            Hourly Rate
          </ThemedText>
          <ThemedText style={styles.priceValue}>${provider.hourlyRate}/hr</ThemedText>
        </View>
      </View>
    </Animated.View>
  );

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
              <Avatar name={provider.name} size="large" uri={provider.avatarUrl} />
              <View style={styles.profileInfo}>
                <ThemedText style={styles.providerName}>{provider.name}</ThemedText>
                <ThemedText style={[styles.businessName, { color: theme.textSecondary }]}>
                  {provider.businessName}
                </ThemedText>
                <View style={styles.ratingRow}>
                  {renderStars(provider.rating)}
                  <ThemedText style={styles.ratingText}>
                    {provider.rating.toFixed(1)} ({provider.reviewCount})
                  </ThemedText>
                </View>
              </View>
            </View>
            {provider.verified && (
              <StatusPill label="Verified Pro" status="success" />
            )}
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

        {activeTab === "about" && renderAboutTab()}
        {activeTab === "services" && renderServicesTab()}
        {activeTab === "reviews" && renderReviewsTab()}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.md }]}>
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
  profileCard: {
    marginBottom: Spacing.lg,
  },
  profileHeader: {
    flexDirection: "row",
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
  },
  serviceName: {
    ...Typography.body,
    flex: 1,
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
});
