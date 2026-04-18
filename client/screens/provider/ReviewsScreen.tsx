import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { Avatar } from "@/components/Avatar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";
import { recordHappyMoment } from "@/state/appReviewStore";

interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  createdAt: string;
  comment?: string;
  providerReply?: string | null;
  providerReplyAt?: string | null;
  providerReplyUpdatedAt?: string | null;
}

type FilterKey = "all" | "5" | "4" | "3" | "2" | "1";

const REPLY_MAX_LENGTH = 1000;

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterKey>("all");

  // Reply composer modal state
  const [activeReview, setActiveReview] = useState<Review | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [isSavingReply, setIsSavingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const providerId = providerProfile?.id;

  const { data, isLoading, refetch, isRefetching } = useQuery<{ reviews: Review[] }>({
    queryKey: ["/api/provider", providerId, "reviews"],
    enabled: !!providerId,
  });

  const allReviews = data?.reviews || [];

  useEffect(() => {
    let cancelled = false;
    const fiveStarIds = allReviews.filter((r) => r.rating === 5).map((r) => r.id);
    (async () => {
      for (const reviewId of fiveStarIds) {
        if (cancelled) return;
        try {
          await recordHappyMoment("provider_five_star_received", {
            payload: { reviewId },
          });
        } catch {
          // best-effort
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allReviews]);

  const rating = providerProfile?.rating ? Number(providerProfile.rating) : 0;
  const reviewCount = providerProfile?.reviewCount || allReviews.length;

  const filteredReviews =
    filter === "all"
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

  const openReplyComposer = (review: Review) => {
    setActiveReview(review);
    setReplyDraft(review.providerReply ?? "");
    setReplyError(null);
  };

  const closeReplyComposer = () => {
    setActiveReview(null);
    setReplyDraft("");
    setReplyError(null);
    setIsSavingReply(false);
  };

  const handleSaveReply = async () => {
    if (!activeReview) return;
    const trimmed = replyDraft.trim();
    if (!trimmed) {
      setReplyError("Please write a reply before saving.");
      return;
    }
    if (trimmed.length > REPLY_MAX_LENGTH) {
      setReplyError(`Reply must be ${REPLY_MAX_LENGTH} characters or fewer.`);
      return;
    }
    setIsSavingReply(true);
    setReplyError(null);
    try {
      const isEdit = !!activeReview.providerReply;
      await apiRequest(
        isEdit ? "PATCH" : "POST",
        `/api/reviews/${activeReview.id}/reply`,
        { reply: trimmed },
      );
      await queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "reviews"],
      });
      closeReplyComposer();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't save your reply. Please try again.";
      setReplyError(message);
      setIsSavingReply(false);
    }
  };

  const handleDeleteReply = async (reviewId: string) => {
    setDeletingId(reviewId);
    try {
      await apiRequest("DELETE", `/api/reviews/${reviewId}/reply`);
      await queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "reviews"],
      });
    } catch (err) {
      console.error("Delete reply failed:", err);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const renderReview = ({ item, index }: { item: Review; index: number }) => {
    const hasReply = !!item.providerReply;
    const replyEdited =
      hasReply &&
      item.providerReplyAt &&
      item.providerReplyUpdatedAt &&
      new Date(item.providerReplyUpdatedAt).getTime() -
        new Date(item.providerReplyAt).getTime() >
        2000;
    return (
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

          {hasReply ? (
            <View
              style={[
                styles.replyBlock,
                { backgroundColor: theme.backgroundSecondary, borderLeftColor: Colors.accent },
              ]}
            >
              <View style={styles.replyHeader}>
                <Feather name="corner-down-right" size={14} color={Colors.accent} />
                <ThemedText style={[styles.replyHeaderText, { color: Colors.accent }]}>
                  {`Response from ${providerProfile?.businessName || "you"}`}
                  {replyEdited ? " (edited)" : ""}
                </ThemedText>
                {item.providerReplyAt ? (
                  <ThemedText style={[styles.replyTimestamp, { color: theme.textTertiary }]}>
                    {`· ${formatDate(replyEdited && item.providerReplyUpdatedAt ? item.providerReplyUpdatedAt : item.providerReplyAt)}`}
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText style={[styles.replyText, { color: theme.textSecondary }]}>
                {item.providerReply}
              </ThemedText>
              <View style={styles.replyActions}>
                <Pressable
                  onPress={() => openReplyComposer(item)}
                  hitSlop={8}
                  testID={`button-edit-reply-${item.id}`}
                >
                  <ThemedText style={[styles.replyActionText, { color: Colors.accent }]}>
                    Edit
                  </ThemedText>
                </Pressable>
                <ThemedText style={{ color: theme.textTertiary }}>·</ThemedText>
                {confirmDeleteId === item.id ? (
                  <View style={styles.confirmRow}>
                    <ThemedText style={[styles.replyActionText, { color: theme.textSecondary }]}>
                      Delete?
                    </ThemedText>
                    <Pressable
                      onPress={() => handleDeleteReply(item.id)}
                      disabled={deletingId === item.id}
                      hitSlop={8}
                      testID={`button-confirm-delete-reply-${item.id}`}
                    >
                      {deletingId === item.id ? (
                        <ActivityIndicator size="small" color={Colors.error} />
                      ) : (
                        <ThemedText style={[styles.replyActionText, { color: Colors.error }]}>
                          Yes
                        </ThemedText>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => setConfirmDeleteId(null)}
                      hitSlop={8}
                      testID={`button-cancel-delete-reply-${item.id}`}
                    >
                      <ThemedText style={[styles.replyActionText, { color: theme.textSecondary }]}>
                        Cancel
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setConfirmDeleteId(item.id)}
                    hitSlop={8}
                    testID={`button-delete-reply-${item.id}`}
                  >
                    <ThemedText style={[styles.replyActionText, { color: Colors.error }]}>
                      Delete
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => openReplyComposer(item)}
              style={[styles.replyButton, { borderColor: theme.borderLight }]}
              testID={`button-reply-${item.id}`}
            >
              <Feather name="message-circle" size={14} color={Colors.accent} />
              <ThemedText style={[styles.replyButtonText, { color: Colors.accent }]}>
                Reply
              </ThemedText>
            </Pressable>
          )}
        </View>
      </Animated.View>
    );
  };

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
                {reviewCount > 0
                  ? `Based on ${reviewCount} review${reviewCount !== 1 ? "s" : ""}`
                  : "No reviews yet"}
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

      <Modal
        visible={!!activeReview}
        animationType="slide"
        transparent
        onRequestClose={closeReplyComposer}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeReplyComposer} />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.backgroundDefault,
                paddingBottom: insets.bottom + Spacing.lg,
              },
            ]}
          >
            <View style={styles.modalHandle} />
            <ThemedText style={styles.modalTitle}>
              {activeReview?.providerReply ? "Edit your reply" : "Reply to review"}
            </ThemedText>
            {activeReview ? (
              <View
                style={[
                  styles.modalReviewPreview,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <View style={styles.modalReviewHeader}>
                  <ThemedText style={styles.modalReviewerName}>
                    {activeReview.reviewerName}
                  </ThemedText>
                  {renderStars(activeReview.rating, 12)}
                </View>
                {activeReview.comment ? (
                  <ThemedText
                    style={[styles.modalReviewComment, { color: theme.textSecondary }]}
                    numberOfLines={3}
                  >
                    {activeReview.comment}
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
            <TextInput
              value={replyDraft}
              onChangeText={setReplyDraft}
              placeholder="Thank your client, share your perspective, or address their feedback…"
              placeholderTextColor={theme.textTertiary}
              multiline
              maxLength={REPLY_MAX_LENGTH}
              style={[
                styles.replyInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.borderLight,
                },
              ]}
              testID="input-review-reply"
            />
            <View style={styles.charCountRow}>
              <ThemedText style={[styles.charCount, { color: theme.textTertiary }]}>
                {replyDraft.length}/{REPLY_MAX_LENGTH}
              </ThemedText>
            </View>
            {replyError ? (
              <ThemedText style={[styles.errorText, { color: Colors.error }]}>
                {replyError}
              </ThemedText>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={closeReplyComposer}
                style={[styles.cancelButton, { borderColor: theme.borderLight }]}
                disabled={isSavingReply}
                testID="button-cancel-reply"
              >
                <ThemedText style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
                  Cancel
                </ThemedText>
              </Pressable>
              <View style={styles.saveButtonWrap}>
                <PrimaryButton
                  onPress={handleSaveReply}
                  loading={isSavingReply}
                  disabled={isSavingReply || !replyDraft.trim()}
                  testID="button-save-reply"
                >
                  {activeReview?.providerReply ? "Save changes" : "Post reply"}
                </PrimaryButton>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryCard: { marginBottom: Spacing.lg },
  summaryMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  bigRating: { fontSize: 48, fontWeight: "700", letterSpacing: -1 },
  summaryInfo: { flex: 1, gap: Spacing.xs },
  starsRow: { flexDirection: "row", gap: 2 },
  reviewCountText: { ...Typography.subhead, marginTop: Spacing.xs },
  ratingBars: {
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  ratingLabel: { ...Typography.caption1, width: 10, textAlign: "right" },
  ratingBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  ratingBarFill: { height: 6, borderRadius: 3 },
  ratingCount: { ...Typography.caption2, width: 20, textAlign: "right" },
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
  filterLabel: { ...Typography.caption1, fontWeight: "500" },
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
  reviewInfo: { flex: 1 },
  reviewerName: { ...Typography.headline, marginBottom: 4 },
  reviewMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  reviewDate: { ...Typography.caption1 },
  reviewComment: { ...Typography.body, lineHeight: 22 },
  replyBlock: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.xs,
  },
  replyHeaderText: { ...Typography.caption1, fontWeight: "600" },
  replyTimestamp: { ...Typography.caption2, marginLeft: 4 },
  replyText: { ...Typography.subhead, lineHeight: 20 },
  replyActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  replyActionText: { ...Typography.caption1, fontWeight: "600" },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
  },
  replyButtonText: { ...Typography.caption1, fontWeight: "600" },
  loadingContainer: { paddingVertical: Spacing.xl, alignItems: "center" },
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
  emptyTitle: { ...Typography.title3, marginBottom: Spacing.sm, textAlign: "center" },
  emptySubtitle: { ...Typography.body, textAlign: "center", lineHeight: 22 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  modalHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
    marginBottom: Spacing.md,
  },
  modalTitle: { ...Typography.title3, marginBottom: Spacing.md },
  modalReviewPreview: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  modalReviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  modalReviewerName: { ...Typography.subhead, fontWeight: "600" },
  modalReviewComment: { ...Typography.subhead, lineHeight: 20 },
  replyInput: {
    minHeight: 120,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    textAlignVertical: "top",
    ...Typography.body,
  },
  charCountRow: { alignItems: "flex-end", marginTop: 4 },
  charCount: { ...Typography.caption2 },
  errorText: { ...Typography.caption1, marginTop: Spacing.xs },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  cancelButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  cancelButtonText: { ...Typography.subhead, fontWeight: "600" },
  saveButtonWrap: { flex: 1 },
});
