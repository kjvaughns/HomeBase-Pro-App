import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
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
import { Spacing, Colors, Typography } from "@/constants/theme";
import { apiRequest, getApiUrl, getAuthHeaders } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

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
}

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
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

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.screenPadding,
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

        <View style={styles.ratingSection}>
          <ThemedText style={styles.sectionTitle}>How was your experience?</ThemedText>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => handleStarPress(star)} style={styles.starButton} testID={`button-star-${star}`}>
                <Feather
                  name="star"
                  size={40}
                  color={star <= rating ? Colors.accent : theme.borderLight}
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

        <View style={styles.commentSection}>
          <ThemedText style={styles.sectionTitle}>Tell us more (optional)</ThemedText>
          <TextField
            placeholder="Share details of your experience..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            style={styles.textArea}
            testID="input-review-comment"
          />
        </View>

        {submitError ? (
          <View style={[styles.errorBanner, { backgroundColor: Colors.errorLight }]}>
            <Feather name="alert-circle" size={16} color={Colors.error} />
            <ThemedText style={[styles.errorText, { color: Colors.error, flex: 1, textAlign: "left" }]}>{submitError}</ThemedText>
          </View>
        ) : null}

        <View style={styles.tipsSection}>
          <ThemedText style={[styles.tipsTitle, { color: theme.textSecondary }]}>
            Tips for a helpful review:
          </ThemedText>
          <View style={styles.tipRow}>
            <Feather name="check" size={14} color={Colors.accent} />
            <ThemedText style={[styles.tipText, { color: theme.textTertiary }]}>
              Was the provider on time and professional?
            </ThemedText>
          </View>
          <View style={styles.tipRow}>
            <Feather name="check" size={14} color={Colors.accent} />
            <ThemedText style={[styles.tipText, { color: theme.textTertiary }]}>
              Did they complete the work as expected?
            </ThemedText>
          </View>
          <View style={styles.tipRow}>
            <Feather name="check" size={14} color={Colors.accent} />
            <ThemedText style={[styles.tipText, { color: theme.textTertiary }]}>
              Would you recommend them to others?
            </ThemedText>
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.md },
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
  ratingSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
    textAlign: "center",
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
  commentSection: {
    marginBottom: Spacing.lg,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
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
});
