import React, { useState } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";

interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  createdAt: string;
  comment?: string;
}

type FilterKey = "all" | "5" | "4" | "3" | "2" | "1";

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();

  const [filter, setFilter] = useState<FilterKey>("all");

  const providerId = providerProfile?.id;

  const { data, isLoading, refetch, isRefetching } = useQuery<{ reviews: Review[] }>({
    queryKey: ["/api/provider", providerId, "reviews"],
    enabled: !!providerId,
  });

  const allReviews = data?.reviews || [];

  const rating = providerProfile?.rating ? Number(providerProfile.rating) : 0;
  const reviewCount = providerProfile?.reviewCount || allReviews.length;

  const filteredReviews = filter === "all"
    ? allReviews
    : allReviews.filter((r) => r.rating === parseInt(filter));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderStars = (count: number, size = 14) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Feather
          key={star}
          name="star"
          size={size}
          color={star <= count ? Colors.warning : theme.backgroundTertiary}
        />
      ))}
    </View>
  );

  const getRatingCount = (stars: number) =>
    allReviews.filter((r) => r.rating === stars).length;

  const renderReview = ({ item, index }: { item: Review; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <View style={[styles.reviewCard, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.reviewHeader}>
          <Avatar name={item.reviewerName} size="medium" />
          <View style={styles.reviewInfo}>
            <ThemedText style={styles.reviewerName}>{item.reviewerName}</ThemedText>
            <View style={styles.reviewMeta}>
              {renderStars(item.rating)}
              <ThemedText style={[styles.reviewDate, { color: theme.textTertiary }]}>
                {formatDate(item.createdAt)}
              </ThemedText>
            </View>
          </View>
        </View>
        {item.comment ? (
          <ThemedText style={[styles.reviewComment, { color: theme.textSecondary }]}>
            {item.comment}
          </ThemedText>
        ) : (
          <ThemedText style={[styles.reviewComment, { color: theme.textTertiary }]}>
            No comment left.
          </ThemedText>
        )}
      </View>
    </Animated.View>
  );

  const renderEmptyState = () => {
    if (isLoading) return null;
    return (
      <Animated.View entering={FadeInDown.delay(100).duration(300)}>
        <View style={[styles.emptyState, { backgroundColor: theme.cardBackground }]}>
          <View style={[styles.emptyIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name="star" size={28} color={Colors.accent} />
          </View>
          <ThemedText style={styles.emptyTitle}>No reviews yet</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Reviews from completed bookings will appear here. Deliver great service and they'll come!
          </ThemedText>
        </View>
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <>
      <Animated.View entering={FadeInDown.delay(0).duration(300)}>
        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryMain}>
            <ThemedText style={styles.bigRating}>
              {rating > 0 ? rating.toFixed(1) : "—"}
            </ThemedText>
            <View style={styles.summaryInfo}>
              {renderStars(Math.round(rating), 20)}
              <ThemedText style={[styles.reviewCountText, { color: theme.textSecondary }]}>
                {reviewCount > 0 ? `Based on ${reviewCount} review${reviewCount !== 1 ? "s" : ""}` : "No reviews yet"}
              </ThemedText>
            </View>
          </View>

          {allReviews.length > 0 ? (
            <View style={styles.ratingBars}>
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = getRatingCount(stars);
                const percent = allReviews.length > 0 ? (count / allReviews.length) * 100 : 0;
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
          ) : null}
        </GlassCard>
      </Animated.View>

      {allReviews.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <View style={styles.filterRow}>
            {(["all", "5", "4", "3", "2", "1"] as FilterKey[]).map((key) => (
              <Pressable
                key={key}
                style={[
                  styles.filterChip,
                  { borderColor: theme.borderLight, backgroundColor: theme.cardBackground },
                  filter === key && { backgroundColor: Colors.accent, borderColor: Colors.accent },
                ]}
                onPress={() => setFilter(key)}
              >
                <ThemedText
                  style={[
                    styles.filterLabel,
                    { color: theme.textSecondary },
                    filter === key && { color: "#FFFFFF" },
                  ]}
                >
                  {key === "all" ? "All" : `${key}`}
                  {key !== "all" ? (
                    <Feather
                      name="star"
                      size={10}
                      color={filter === key ? "#FFFFFF" : theme.textTertiary}
                    />
                  ) : null}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.accent} />
        </View>
      ) : null}
    </>
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
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.accent}
          />
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
    marginBottom: Spacing.lg,
  },
  summaryMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  bigRating: {
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -1,
  },
  summaryInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  reviewCountText: {
    ...Typography.subhead,
    marginTop: Spacing.xs,
  },
  ratingBars: {
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  ratingLabel: {
    ...Typography.caption1,
    width: 10,
    textAlign: "right",
  },
  ratingBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  ratingBarFill: {
    height: 6,
    borderRadius: 3,
  },
  ratingCount: {
    ...Typography.caption2,
    width: 20,
    textAlign: "right",
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
    flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterLabel: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  reviewCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  reviewInfo: {
    flex: 1,
  },
  reviewerName: {
    ...Typography.headline,
    marginBottom: 4,
  },
  reviewMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  reviewDate: {
    ...Typography.caption1,
  },
  reviewComment: {
    ...Typography.body,
    lineHeight: 22,
  },
  loadingContainer: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  emptyState: {
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.title3,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
  },
});
