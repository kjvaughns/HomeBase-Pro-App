import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, LayoutChangeEvent } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { Avatar } from "@/components/Avatar";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Spacing, Colors, Typography } from "@/constants/theme";
import { apiRequest, getApiUrl, getAuthHeaders } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { recordHappyMoment } from "@/state/appReviewStore";

type ScreenRouteProp = RouteProp<RootStackParamList, "Review">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AppointmentData {
  appointment: {
    id: string;
    serviceName: string;
    status: string;
    providerId: string;
  };
  provider: {
    businessName: string;
  } | null;
  review?: {
    id: string;
    rating: number;
    comment?: string | null;
    createdAt: string;
    providerReply?: string | null;
    providerReplyAt?: string | null;
    providerReplyUpdatedAt?: string | null;
  } | null;
}

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { jobId } = route.params;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bottomBarHeight, setBottomBarHeight] = useState(0);

  const handleBottomBarLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - bottomBarHeight) > 1) setBottomBarHeight(h);
  };

  const { data, isLoading, isError } = useQuery<AppointmentData>({
    queryKey: ["/api/appointments", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const url = new URL(`/api/appointments/${jobId}`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) throw new Error("Failed to load appointment");
      return res.json();
    },
  });

  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => {
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "Main" },
            { name: "JobDetail", params: { jobId } },
          ],
        })
      );
    }, 1800);
    return () => clearTimeout(timer);
  }, [showSuccess, navigation, jobId]);

  const handleStarPress = (star: number) => {
    Haptics.selectionAsync();
    setRating(star);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await apiRequest("POST", `/api/appointments/${jobId}/review`, {
        rating,
        comment: comment.trim() || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments", jobId] });
      setShowSuccess(true);
      if (rating >= 4) {
        recordHappyMoment("homeowner_high_review_submitted").catch(() => {});
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingLabel = () => {
    switch (rating) {
      case 1: return "Poor";
      case 2: return "Fair";
      case 3: return "Good";
      case 4: return "Great";
      case 5: return "Excellent";
      default: return "Tap to rate";
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </ThemedView>
    );
  }

  if (isError) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Feather name="alert-circle" size={40} color={Colors.error} />
        <ThemedText style={[styles.errorText, { marginTop: Spacing.md }]}>
          Could not load appointment details
        </ThemedText>
        <ThemedText style={[styles.errorSubText, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
          Please go back and try again
        </ThemedText>
      </ThemedView>
    );
  }

  if (showSuccess) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Animated.View entering={ZoomIn.springify()} style={[styles.successRing, { backgroundColor: Colors.accentLight }]}>
          <Feather name="check" size={48} color={Colors.accent} />
        </Animated.View>
        <ThemedText style={[styles.successTitle, { marginTop: Spacing.xl }]}>Review submitted</ThemedText>
        <ThemedText style={[styles.successSubtext, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
          Thank you — your feedback helps the community.
        </ThemedText>
      </ThemedView>
    );
  }

  const providerName = data?.provider?.businessName || "Service Provider";
  const serviceName = data?.appointment?.serviceName || "Service";
  const existingReview = data?.review || null;
  const formatReviewDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (existingReview) {
    const replyEdited =
      existingReview.providerReply &&
      existingReview.providerReplyAt &&
      existingReview.providerReplyUpdatedAt &&
      new Date(existingReview.providerReplyUpdatedAt).getTime() -
        new Date(existingReview.providerReplyAt).getTime() >
        2000;
    return (
      <ThemedView style={styles.container}>
        <KeyboardAwareScrollViewCompat
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: horizontalPadding,
          }}
        >
          <GlassCard style={styles.providerCard}>
            <View style={styles.providerRow}>
              <Avatar name={providerName} size="medium" />
              <View style={styles.providerInfo}>
                <ThemedText style={styles.providerName}>{providerName}</ThemedText>
                <ThemedText style={[styles.serviceName, { color: theme.textSecondary }]}>
                  {serviceName}
                </ThemedText>
              </View>
            </View>
          </GlassCard>

          <GlassCard style={styles.providerCard} testID="card-existing-review">
            <View style={styles.starsRowSmall}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= existingReview.rating ? "star" : "star-outline"}
                  size={20}
                  color={star <= existingReview.rating ? Colors.accent : theme.borderLight}
                />
              ))}
              <ThemedText style={[styles.reviewMetaText, { color: theme.textTertiary }]}>
                {`· ${formatReviewDate(existingReview.createdAt)}`}
              </ThemedText>
            </View>
            {existingReview.comment ? (
              <ThemedText style={[styles.existingComment, { color: theme.textSecondary }]}>
                {existingReview.comment}
              </ThemedText>
            ) : (
              <ThemedText style={[styles.existingComment, { color: theme.textTertiary }]}>
                You didn't leave a comment.
              </ThemedText>
            )}

            {existingReview.providerReply ? (
              <View
                style={[
                  styles.replyBlock,
                  { backgroundColor: Colors.accentLight, borderLeftColor: Colors.accent },
                ]}
                testID="block-provider-reply"
              >
                <View style={styles.replyHeader}>
                  <Feather name="corner-down-right" size={14} color={Colors.accent} />
                  <ThemedText style={[styles.replyHeaderText, { color: Colors.accent }]}>
                    {`Response from ${providerName}`}
                    {replyEdited ? " (edited)" : ""}
                  </ThemedText>
                  {existingReview.providerReplyAt ? (
                    <ThemedText style={[styles.replyTimestamp, { color: theme.textTertiary }]}>
                      {`· ${formatReviewDate(
                        replyEdited && existingReview.providerReplyUpdatedAt
                          ? existingReview.providerReplyUpdatedAt
                          : existingReview.providerReplyAt,
                      )}`}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText style={[styles.replyText, { color: theme.textSecondary }]}>
                  {existingReview.providerReply}
                </ThemedText>
              </View>
            ) : null}
          </GlassCard>
        </KeyboardAwareScrollViewCompat>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: (bottomBarHeight || 96) + Spacing.lg,
          paddingHorizontal: horizontalPadding,
        }}
      >
        <GlassCard style={styles.providerCard}>
          <View style={styles.providerRow}>
            <Avatar name={providerName} size="medium" />
            <View style={styles.providerInfo}>
              <ThemedText style={styles.providerName}>{providerName}</ThemedText>
              <ThemedText style={[styles.serviceName, { color: theme.textSecondary }]}>
                {serviceName}
              </ThemedText>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.ratingSection}>
            <ThemedText style={styles.sectionTitle}>How was your experience?</ThemedText>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => handleStarPress(star)} style={styles.starButton} testID={`button-star-${star}`}>
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={40}
                    color={star <= rating ? Colors.accent : theme.textTertiary}
                  />
                </Pressable>
              ))}
            </View>

            <ThemedText
              style={[
                styles.ratingLabel,
                { color: rating > 0 ? Colors.accent : theme.textSecondary },
              ]}
            >
              {getRatingLabel()}
            </ThemedText>
          </View>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.commentSection}>
            <ThemedText style={styles.sectionTitleLeft}>Tell us more (optional)</ThemedText>
            <TextField
              placeholder="Share details of your experience..."
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              testID="input-review-comment"
            />
          </View>
        </GlassCard>

        {submitError ? (
          <View style={[styles.errorBanner, { backgroundColor: Colors.errorLight }]}>
            <Feather name="alert-circle" size={16} color={Colors.error} />
            <ThemedText style={[styles.errorText, { color: Colors.error, flex: 1, textAlign: "left" }]}>{submitError}</ThemedText>
          </View>
        ) : null}

        <GlassCard style={styles.sectionCard}>
          <View style={styles.tipsSection}>
            <ThemedText style={[styles.tipsTitle, { color: theme.textSecondary }]}>
              Tips for a helpful review
            </ThemedText>
            <View style={styles.tipRow}>
              <Feather name="check" size={14} color={Colors.accent} />
              <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
                Was the provider on time and professional?
              </ThemedText>
            </View>
            <View style={styles.tipRow}>
              <Feather name="check" size={14} color={Colors.accent} />
              <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
                Did they complete the work as expected?
              </ThemedText>
            </View>
            <View style={styles.tipRow}>
              <Feather name="check" size={14} color={Colors.accent} />
              <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
                Would you recommend them to others?
              </ThemedText>
            </View>
          </View>
        </GlassCard>
      </KeyboardAwareScrollViewCompat>

      <View
        onLayout={handleBottomBarLayout}
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.backgroundDefault,
            borderTopColor: theme.borderLight,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}
      >
        <PrimaryButton
          onPress={handleSubmit}
          disabled={rating === 0 || isSubmitting}
          loading={isSubmitting}
          testID="button-submit-review"
        >
          Submit Review
        </PrimaryButton>
      </View>
    </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  providerCard: {
    marginBottom: Spacing.xl,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  providerInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  providerName: {
    ...Typography.headline,
    fontWeight: "600",
  },
  serviceName: {
    ...Typography.subhead,
    marginTop: 2,
  },
  sectionCard: {
    marginBottom: Spacing.lg,
  },
  ratingSection: {
    alignItems: "center",
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  sectionTitleLeft: {
    ...Typography.headline,
    marginBottom: Spacing.sm,
  },
  starsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  starButton: {
    padding: Spacing.xs,
  },
  ratingLabel: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  commentSection: {},
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.lg,
  },
  errorText: {
    ...Typography.subhead,
    textAlign: "center",
  },
  errorSubText: {
    ...Typography.body,
    textAlign: "center",
  },
  tipsSection: {
    marginBottom: Spacing.lg,
  },
  tipsTitle: {
    ...Typography.subhead,
    marginBottom: Spacing.sm,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  tipText: {
    ...Typography.caption1,
    flex: 1,
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
  successRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    ...Typography.title2,
    textAlign: "center",
  },
  successSubtext: {
    ...Typography.body,
    textAlign: "center",
  },
  starsRowSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: Spacing.sm,
  },
  reviewMetaText: {
    ...Typography.caption1,
    marginLeft: Spacing.sm,
  },
  existingComment: {
    ...Typography.body,
    lineHeight: 22,
  },
  replyBlock: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: Spacing.xs,
  },
  replyHeaderText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  replyTimestamp: {
    ...Typography.caption2,
  },
  replyText: {
    ...Typography.subhead,
    lineHeight: 20,
  },
});
