import React, { useState } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { Avatar } from "@/components/Avatar";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type ScreenRouteProp = RouteProp<RootStackParamList, "Review">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { jobId } = route.params;

  const job = useHomeownerStore((s) => s.getJobById(jobId));
  const submitReview = useHomeownerStore((s) => s.submitReview);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!job) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Job not found</ThemedText>
      </ThemedView>
    );
  }

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      submitReview(jobId, rating, comment.trim());

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "Main" },
            { name: "JobDetail", params: { jobId } },
          ],
        })
      );
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingLabel = () => {
    switch (rating) {
      case 1:
        return "Poor";
      case 2:
        return "Fair";
      case 3:
        return "Good";
      case 4:
        return "Great";
      case 5:
        return "Excellent";
      default:
        return "Tap to rate";
    }
  };

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
            <Avatar name={job.providerName} size={56} />
            <View style={styles.providerInfo}>
              <ThemedText style={styles.providerName}>{job.providerName}</ThemedText>
              <ThemedText style={[styles.serviceName, { color: theme.textSecondary }]}>
                {job.service}
              </ThemedText>
            </View>
          </View>
        </GlassCard>

        <View style={styles.ratingSection}>
          <ThemedText style={styles.sectionTitle}>How was your experience?</ThemedText>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => handleStarPress(star)} style={styles.starButton}>
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
          />
        </View>

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
          { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <PrimaryButton
          label={isSubmitting ? "" : "Submit Review"}
          onPress={handleSubmit}
          disabled={rating === 0 || isSubmitting}
        >
          {isSubmitting && <ActivityIndicator color="#fff" />}
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: Spacing.xl,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
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
});
