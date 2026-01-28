import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";

interface Review {
  id: string;
  customerName: string;
  customerAvatar?: string;
  rating: number;
  date: string;
  service: string;
  comment: string;
  reply?: string;
}

const MOCK_REVIEWS: Review[] = [
  {
    id: "1",
    customerName: "Sarah Johnson",
    rating: 5,
    date: "2024-01-15",
    service: "Deep Cleaning",
    comment: "Absolutely amazing work! The team was professional, punctual, and did an incredible job. My house has never looked better. Will definitely book again!",
    reply: "Thank you so much, Sarah! We loved working on your beautiful home. See you next time!",
  },
  {
    id: "2",
    customerName: "Michael Chen",
    rating: 5,
    date: "2024-01-10",
    service: "Move-Out Cleaning",
    comment: "Best cleaning service I've ever used. They went above and beyond to make sure everything was spotless for the new tenants. Highly recommend!",
  },
  {
    id: "3",
    customerName: "Emma Williams",
    rating: 4,
    date: "2024-01-05",
    service: "Regular Cleaning",
    comment: "Great service overall. The team was friendly and thorough. Only minor issue was they arrived 15 minutes late, but they made up for it with excellent work.",
    reply: "Thank you for the feedback, Emma! We apologize for the delay and have noted this for future visits.",
  },
  {
    id: "4",
    customerName: "David Brown",
    rating: 5,
    date: "2023-12-28",
    service: "Deep Cleaning",
    comment: "Outstanding attention to detail. They cleaned areas I didn't even know needed cleaning. Worth every penny!",
  },
  {
    id: "5",
    customerName: "Lisa Martinez",
    rating: 5,
    date: "2023-12-20",
    service: "Post-Construction Cleaning",
    comment: "Hired them after our renovation and they did a phenomenal job. All the dust and debris was gone. Highly professional team.",
  },
];

type FilterKey = "all" | "5" | "4" | "3" | "2" | "1";

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);

  const rating = providerProfile?.rating || 4.9;
  const reviewCount = providerProfile?.reviewCount || 47;

  const filteredReviews = filter === "all"
    ? MOCK_REVIEWS
    : MOCK_REVIEWS.filter((r) => r.rating === parseInt(filter));

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderStars = (count: number) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Feather
            key={star}
            name="star"
            size={14}
            color={star <= count ? Colors.warning : theme.backgroundTertiary}
          />
        ))}
      </View>
    );
  };

  const renderReview = ({ item, index }: { item: Review; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <View style={[styles.reviewCard, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.reviewHeader}>
          <Avatar name={item.customerName} size="medium" />
          <View style={styles.reviewInfo}>
            <ThemedText style={styles.reviewerName}>{item.customerName}</ThemedText>
            <View style={styles.reviewMeta}>
              {renderStars(item.rating)}
              <ThemedText style={[styles.reviewDate, { color: theme.textTertiary }]}>
                {formatDate(item.date)}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.serviceBadge}>
          <ThemedText style={[styles.serviceText, { color: Colors.accent }]}>
            {item.service}
          </ThemedText>
        </View>

        <ThemedText style={[styles.reviewComment, { color: theme.textSecondary }]}>
          {item.comment}
        </ThemedText>

        {item.reply ? (
          <View style={[styles.replyBox, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.replyHeader}>
              <Feather name="corner-down-right" size={14} color={Colors.accent} />
              <ThemedText style={[styles.replyLabel, { color: Colors.accent }]}>
                Your Reply
              </ThemedText>
            </View>
            <ThemedText style={[styles.replyText, { color: theme.textSecondary }]}>
              {item.reply}
            </ThemedText>
          </View>
        ) : (
          <Pressable style={styles.replyButton}>
            <Feather name="message-circle" size={14} color={Colors.accent} />
            <ThemedText style={{ color: Colors.accent, marginLeft: Spacing.xs }}>
              Reply to Review
            </ThemedText>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredReviews}
        renderItem={renderReview}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        ListHeaderComponent={
          <>
            <Animated.View entering={FadeInDown.delay(0).duration(300)}>
              <GlassCard style={styles.summaryCard}>
                <View style={styles.summaryMain}>
                  <ThemedText style={styles.bigRating}>{rating.toFixed(1)}</ThemedText>
                  <View style={styles.summaryInfo}>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Feather
                          key={star}
                          name="star"
                          size={20}
                          color={star <= Math.round(rating) ? Colors.warning : theme.backgroundTertiary}
                        />
                      ))}
                    </View>
                    <ThemedText style={[styles.reviewCountText, { color: theme.textSecondary }]}>
                      Based on {reviewCount} reviews
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.ratingBars}>
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = MOCK_REVIEWS.filter((r) => r.rating === stars).length;
                    const percent = (count / MOCK_REVIEWS.length) * 100;
                    return (
                      <View key={stars} style={styles.ratingRow}>
                        <ThemedText style={[styles.ratingLabel, { color: theme.textSecondary }]}>
                          {stars}
                        </ThemedText>
                        <Feather name="star" size={12} color={theme.textTertiary} />
                        <View style={[styles.ratingBarBg, { backgroundColor: theme.backgroundTertiary }]}>
                          <View
                            style={[
                              styles.ratingBarFill,
                              { width: `${percent}%`, backgroundColor: Colors.warning },
                            ]}
                          />
                        </View>
                        <ThemedText style={[styles.ratingCount, { color: theme.textTertiary }]}>
                          {count}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              </GlassCard>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(50).duration(300)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterContainer}
              >
                {(["all", "5", "4", "3", "2", "1"] as FilterKey[]).map((key) => (
                  <Pressable
                    key={key}
                    style={[
                      styles.filterChip,
                      { borderColor: theme.borderLight },
                      filter === key && { backgroundColor: Colors.accent, borderColor: Colors.accent },
                    ]}
                    onPress={() => setFilter(key)}
                  >
                    {key !== "all" && (
                      <Feather
                        name="star"
                        size={12}
                        color={filter === key ? "#FFFFFF" : theme.textSecondary}
                      />
                    )}
                    <ThemedText
                      style={[
                        styles.filterText,
                        filter === key && { color: "#FFFFFF" },
                      ]}
                    >
                      {key === "all" ? "All" : key}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>

            <ThemedText style={[styles.resultsCount, { color: theme.textSecondary }]}>
              {filteredReviews.length} review{filteredReviews.length !== 1 ? "s" : ""}
            </ThemedText>
          </>
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  summaryMain: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  bigRating: {
    ...Typography.largeTitle,
    fontWeight: "700",
    marginRight: Spacing.lg,
  },
  summaryInfo: {
    flex: 1,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  reviewCountText: {
    ...Typography.caption1,
    marginTop: Spacing.xs,
  },
  ratingBars: {
    gap: Spacing.xs,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  ratingLabel: {
    ...Typography.caption1,
    width: 12,
    textAlign: "right",
  },
  ratingBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  ratingBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  ratingCount: {
    ...Typography.caption1,
    width: 20,
    textAlign: "right",
  },
  filterScroll: {
    marginBottom: Spacing.md,
  },
  filterContainer: {
    gap: Spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: {
    ...Typography.subhead,
  },
  resultsCount: {
    ...Typography.caption1,
    marginBottom: Spacing.md,
  },
  reviewCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    marginBottom: Spacing.md,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  reviewInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  reviewerName: {
    ...Typography.body,
    fontWeight: "600",
  },
  reviewMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
  },
  reviewDate: {
    ...Typography.caption1,
  },
  serviceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accent + "15",
    marginBottom: Spacing.sm,
  },
  serviceText: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  reviewComment: {
    ...Typography.body,
    lineHeight: 22,
  },
  replyBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  replyLabel: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  replyText: {
    ...Typography.body,
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
  },
});
