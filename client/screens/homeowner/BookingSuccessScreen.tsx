import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type ScreenRouteProp = RouteProp<RootStackParamList, "BookingSuccess">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BookingSuccessScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { jobId } = route.params;

  const jobs = useHomeownerStore((s) => s.jobs);
  const job = useMemo(() => jobs.find((j) => j.id === jobId), [jobs, jobId]);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleViewJob = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: "Main" },
          { name: "JobDetail", params: { jobId } },
        ],
      })
    );
  };

  const handleGoHome = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Main" }],
      })
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <Animated.View entering={ZoomIn.duration(500).springify()} style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.accentLight }]}>
            <Feather name="check" size={48} color={Colors.accent} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(300).duration(400)}>
          <ThemedText style={styles.title}>Booking Confirmed!</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Your service has been scheduled
          </ThemedText>
        </Animated.View>

        {job && (
          <Animated.View entering={FadeIn.delay(500).duration(400)} style={styles.detailsCard}>
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
              <View style={styles.cardRow}>
                <Feather name="user" size={18} color={theme.textSecondary} />
                <ThemedText style={styles.cardLabel}>Provider</ThemedText>
                <ThemedText style={styles.cardValue}>{job.providerName}</ThemedText>
              </View>
              <View style={styles.cardRow}>
                <Feather name="tool" size={18} color={theme.textSecondary} />
                <ThemedText style={styles.cardLabel}>Service</ThemedText>
                <ThemedText style={styles.cardValue}>{job.service}</ThemedText>
              </View>
              <View style={styles.cardRow}>
                <Feather name="calendar" size={18} color={theme.textSecondary} />
                <ThemedText style={styles.cardLabel}>Date</ThemedText>
                <ThemedText style={styles.cardValue}>{job.scheduledDate}</ThemedText>
              </View>
              <View style={styles.cardRow}>
                <Feather name="clock" size={18} color={theme.textSecondary} />
                <ThemedText style={styles.cardLabel}>Time</ThemedText>
                <ThemedText style={styles.cardValue}>{job.scheduledTime}</ThemedText>
              </View>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeIn.delay(700).duration(400)} style={styles.nextSteps}>
          <ThemedText style={styles.nextStepsTitle}>What's Next?</ThemedText>
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: Colors.accent }]} />
            <ThemedText style={[styles.stepText, { color: theme.textSecondary }]}>
              Your provider will confirm the appointment
            </ThemedText>
          </View>
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: Colors.accent }]} />
            <ThemedText style={[styles.stepText, { color: theme.textSecondary }]}>
              You'll receive reminders before the service
            </ThemedText>
          </View>
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: Colors.accent }]} />
            <ThemedText style={[styles.stepText, { color: theme.textSecondary }]}>
              Message your provider anytime with questions
            </ThemedText>
          </View>
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(900).duration(400)} style={styles.buttons}>
        <PrimaryButton onPress={handleViewJob}>View Job Details</PrimaryButton>
        <SecondaryButton onPress={handleGoHome} style={styles.secondaryBtn}>Back to Home</SecondaryButton>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...Typography.title1,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  detailsCard: {
    width: "100%",
    marginTop: Spacing.xl,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  cardLabel: {
    ...Typography.subhead,
    flex: 1,
  },
  cardValue: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  nextSteps: {
    width: "100%",
    marginTop: Spacing.xl,
  },
  nextStepsTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  stepText: {
    ...Typography.body,
    flex: 1,
  },
  buttons: {
    paddingBottom: Spacing.lg,
  },
  secondaryBtn: {
    marginTop: Spacing.sm,
  },
});
