import React, { useMemo } from "react";
import { StyleSheet, View, ScrollView, Pressable, Alert } from "react-native";
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
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useHomeownerStore } from "@/state/homeownerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { JobStatus } from "@/state/types";

type ScreenRouteProp = RouteProp<RootStackParamList, "JobDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_CONFIG: Record<JobStatus, { label: string; status: "success" | "info" | "warning" | "neutral" }> = {
  requested: { label: "Requested", status: "info" },
  scheduled: { label: "Scheduled", status: "info" },
  in_progress: { label: "In Progress", status: "warning" },
  awaiting_payment: { label: "Awaiting Payment", status: "warning" },
  completed: { label: "Completed", status: "success" },
  paid: { label: "Paid", status: "success" },
  closed: { label: "Closed", status: "neutral" },
};

export default function JobDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { jobId } = route.params;

  const jobs = useHomeownerStore((s) => s.jobs);
  const invoices = useHomeownerStore((s) => s.invoices);
  const receipts = useHomeownerStore((s) => s.receipts);
  const allReviews = useHomeownerStore((s) => s.reviews);
  const advanceJobStatus = useHomeownerStore((s) => s.advanceJobStatus);
  
  const job = useMemo(() => jobs.find((j) => j.id === jobId), [jobs, jobId]);
  const invoice = useMemo(() => invoices.find((i) => i.jobId === jobId), [invoices, jobId]);
  const receipt = useMemo(() => receipts.find((r) => r.jobId === jobId), [receipts, jobId]);
  const review = useMemo(() => allReviews.find((r) => r.jobId === jobId), [allReviews, jobId]);

  if (!job) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Job not found</ThemedText>
      </ThemedView>
    );
  }

  const statusConfig = STATUS_CONFIG[job.status];

  const handleMessage = () => {
    Alert.alert("Coming Soon", "Messaging will be available in a future update.");
  };

  const handlePayment = () => {
    if (invoice) {
      navigation.navigate("Payment", { jobId: job.id, invoiceId: invoice.id });
    }
  };

  const handleReview = () => {
    navigation.navigate("Review", { jobId: job.id });
  };

  const handleSimulateUpdate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    advanceJobStatus(job.id);
  };

  const showSimulateOption = () => {
    Alert.alert(
      "Developer Tools",
      "Advance this job to the next status?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Advance Status", onPress: handleSimulateUpdate },
      ]
    );
  };

  const renderTimelineItem = (event: typeof job.timeline[0], index: number) => {
    const isLast = index === job.timeline.length - 1;
    return (
      <View key={event.id} style={styles.timelineItem}>
        <View style={styles.timelineDot}>
          <View style={[styles.dot, { backgroundColor: Colors.accent }]} />
          {!isLast && <View style={[styles.timelineLine, { backgroundColor: theme.borderLight }]} />}
        </View>
        <View style={styles.timelineContent}>
          <ThemedText style={styles.timelineTitle}>{event.title}</ThemedText>
          {event.description ? (
            <ThemedText style={[styles.timelineDesc, { color: theme.textSecondary }]}>
              {event.description}
            </ThemedText>
          ) : null}
          <ThemedText style={[styles.timelineTime, { color: theme.textTertiary }]}>
            {new Date(event.timestamp).toLocaleString()}
          </ThemedText>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <GlassCard style={styles.headerCard}>
            <View style={styles.headerRow}>
              <Avatar name={job.providerName} size="medium" />
              <View style={styles.headerInfo}>
                <ThemedText style={styles.providerName}>{job.providerName}</ThemedText>
                <ThemedText style={[styles.businessName, { color: theme.textSecondary }]}>
                  {job.providerBusinessName}
                </ThemedText>
              </View>
              <StatusPill
                label={statusConfig.label}
                status={statusConfig.status}
              />
            </View>
            <View style={styles.serviceRow}>
              <Feather name="tool" size={16} color={theme.textSecondary} />
              <ThemedText style={styles.serviceName}>{job.service}</ThemedText>
            </View>
          </GlassCard>
        </Animated.View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Details</ThemedText>
          
          <View style={[styles.detailCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
            <View style={styles.detailRow}>
              <Feather name="calendar" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Date</ThemedText>
              <ThemedText style={styles.detailValue}>{job.scheduledDate}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <Feather name="clock" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Time</ThemedText>
              <ThemedText style={styles.detailValue}>{job.scheduledTime}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Address</ThemedText>
              <ThemedText style={styles.detailValue} numberOfLines={2}>{job.address}</ThemedText>
            </View>
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Feather name="file-text" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Description</ThemedText>
              <ThemedText style={styles.detailValue} numberOfLines={3}>{job.description}</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Timeline</ThemedText>
          <View style={[styles.timelineCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
            {job.timeline.map(renderTimelineItem)}
          </View>
        </View>

        {invoice && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Payment</ThemedText>
            <View style={[styles.invoiceCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
              <View style={styles.invoiceHeader}>
                <ThemedText style={styles.invoiceTitle}>Invoice #{invoice.id.slice(-6)}</ThemedText>
                <StatusPill
                  label={invoice.status === "paid" ? "Paid" : "Unpaid"}
                  status={invoice.status === "paid" ? "success" : "warning"}
                  size="small"
                />
              </View>
              <View style={styles.invoiceTotal}>
                <ThemedText style={[styles.totalLabel, { color: theme.textSecondary }]}>Total</ThemedText>
                <ThemedText style={styles.totalValue}>${invoice.total}</ThemedText>
              </View>
              {receipt && (
                <View style={styles.receiptInfo}>
                  <Feather name="check-circle" size={16} color={Colors.accent} />
                  <ThemedText style={[styles.receiptText, { color: theme.textSecondary }]}>
                    Paid on {new Date(receipt.createdAt).toLocaleDateString()}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        )}

        {review && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Your Review</ThemedText>
            <View style={[styles.reviewCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
              <View style={styles.reviewStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Feather
                    key={star}
                    name="star"
                    size={18}
                    color={star <= review.rating ? Colors.accent : theme.borderLight}
                  />
                ))}
              </View>
              <ThemedText style={[styles.reviewComment, { color: theme.textSecondary }]}>
                "{review.comment}"
              </ThemedText>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <SecondaryButton onPress={handleMessage}>
            Message Provider
          </SecondaryButton>

          {job.status === "awaiting_payment" && invoice && invoice.status !== "paid" ? (
            <PrimaryButton onPress={handlePayment} style={styles.actionBtn}>
              Pay Invoice
            </PrimaryButton>
          ) : null}

          {(job.status === "paid" || job.status === "completed") && !review ? (
            <PrimaryButton onPress={handleReview} style={styles.actionBtn}>
              Leave a Review
            </PrimaryButton>
          ) : null}
        </View>

        <Pressable onLongPress={showSimulateOption} style={styles.debugTrigger}>
          <ThemedText style={[styles.debugText, { color: theme.textTertiary }]}>
            Long press to simulate status update
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  providerName: {
    ...Typography.headline,
    fontWeight: "600",
  },
  businessName: {
    ...Typography.subhead,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  serviceName: {
    ...Typography.body,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  detailCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
    gap: Spacing.sm,
  },
  detailLabel: {
    ...Typography.subhead,
    width: 80,
  },
  detailValue: {
    ...Typography.body,
    flex: 1,
    textAlign: "right",
  },
  timelineCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  timelineItem: {
    flexDirection: "row",
  },
  timelineDot: {
    alignItems: "center",
    width: 24,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: Spacing.md,
  },
  timelineTitle: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  timelineDesc: {
    ...Typography.caption1,
    marginTop: 2,
  },
  timelineTime: {
    ...Typography.caption2,
    marginTop: 4,
  },
  invoiceCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  invoiceTitle: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  invoiceTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    ...Typography.body,
  },
  totalValue: {
    ...Typography.title2,
    fontWeight: "700",
    color: Colors.accent,
  },
  receiptInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  receiptText: {
    ...Typography.caption1,
  },
  reviewCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  reviewStars: {
    flexDirection: "row",
    gap: 4,
    marginBottom: Spacing.sm,
  },
  reviewComment: {
    ...Typography.body,
    fontStyle: "italic",
  },
  actions: {
    marginTop: Spacing.md,
  },
  actionBtn: {
    marginTop: Spacing.sm,
  },
  debugTrigger: {
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  debugText: {
    ...Typography.caption2,
  },
});
