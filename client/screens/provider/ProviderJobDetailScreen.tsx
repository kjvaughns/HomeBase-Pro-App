import React, { useState, useMemo, useCallback } from "react";
import { StyleSheet, View, ScrollView, Pressable, Linking, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useProviderStore, Job, JobChecklistItem } from "@/state/providerStore";

const STATUS_CONFIG: Record<Job["status"], { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  scheduled: { label: "Scheduled", color: "#3B82F6", icon: "calendar" },
  confirmed: { label: "Confirmed", color: "#8B5CF6", icon: "check-circle" },
  on_my_way: { label: "On My Way", color: "#F59E0B", icon: "navigation" },
  arrived: { label: "Arrived", color: "#F59E0B", icon: "map-pin" },
  in_progress: { label: "In Progress", color: "#F59E0B", icon: "tool" },
  completed: { label: "Completed", color: Colors.accent, icon: "check" },
  cancelled: { label: "Cancelled", color: "#EF4444", icon: "x-circle" },
};

const STATUS_ORDER: Job["status"][] = ["scheduled", "confirmed", "on_my_way", "arrived", "in_progress", "completed"];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(timeStr: string): string {
  return timeStr;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface StatusBannerProps {
  status: Job["status"];
}

function StatusBanner({ status }: StatusBannerProps) {
  const { theme } = useTheme();
  const config = STATUS_CONFIG[status];
  const currentIndex = STATUS_ORDER.indexOf(status);
  
  return (
    <GlassCard style={styles.statusBanner}>
      <View style={styles.statusHeader}>
        <View style={[styles.statusIcon, { backgroundColor: config.color + "20" }]}>
          <Feather name={config.icon} size={24} color={config.color} />
        </View>
        <View style={styles.statusInfo}>
          <ThemedText type="h3" style={{ color: config.color }}>
            {config.label}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {status === "completed" ? "Job finished" : status === "cancelled" ? "Job cancelled" : "In progress"}
          </ThemedText>
        </View>
      </View>
      
      {status !== "cancelled" ? (
        <View style={styles.progressBar}>
          {STATUS_ORDER.map((s, index) => {
            const isCompleted = index <= currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <View key={s} style={styles.progressItem}>
                <View
                  style={[
                    styles.progressDot,
                    isCompleted && { backgroundColor: Colors.accent },
                    isCurrent && styles.progressDotCurrent,
                    !isCompleted && { backgroundColor: theme.separator },
                  ]}
                />
                {index < STATUS_ORDER.length - 1 ? (
                  <View
                    style={[
                      styles.progressLine,
                      { backgroundColor: isCompleted ? Colors.accent : theme.separator },
                    ]}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </GlassCard>
  );
}

interface ChecklistSectionProps {
  checklist: JobChecklistItem[];
  onToggle: (id: string) => void;
}

function ChecklistSection({ checklist, onToggle }: ChecklistSectionProps) {
  const { theme } = useTheme();
  const completedCount = checklist.filter((item) => item.completed).length;
  
  return (
    <GlassCard style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="label" style={{ color: theme.textSecondary }}>
          CHECKLIST
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {completedCount}/{checklist.length}
        </ThemedText>
      </View>
      {checklist.map((item) => (
        <Pressable
          key={item.id}
          style={styles.checklistItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggle(item.id);
          }}
        >
          <View
            style={[
              styles.checkbox,
              item.completed && { backgroundColor: Colors.accent, borderColor: Colors.accent },
              !item.completed && { borderColor: theme.textSecondary },
            ]}
          >
            {item.completed ? (
              <Feather name="check" size={14} color="#FFFFFF" />
            ) : null}
          </View>
          <ThemedText
            type="body"
            style={[
              { flex: 1 },
              item.completed && { textDecorationLine: "line-through", color: theme.textSecondary },
            ]}
          >
            {item.label}
          </ThemedText>
        </Pressable>
      ))}
    </GlassCard>
  );
}

export default function ProviderJobDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ ProviderJobDetail: { jobId: string } }, "ProviderJobDetail">>();
  const { jobId } = route.params;

  const jobs = useProviderStore((s) => s.jobs);
  const startJob = useProviderStore((s) => s.startJob);
  const completeJob = useProviderStore((s) => s.completeJob);
  const cancelJob = useProviderStore((s) => s.cancelJob);

  const job = useMemo(() => jobs.find((j) => j.id === jobId), [jobs, jobId]);

  const [localChecklist, setLocalChecklist] = useState<JobChecklistItem[]>(
    job?.checklist || [
      { id: "1", label: "Arrived at location", completed: false },
      { id: "2", label: "Assessed the issue", completed: false },
      { id: "3", label: "Discussed scope with customer", completed: false },
      { id: "4", label: "Completed main work", completed: false },
      { id: "5", label: "Cleaned up area", completed: false },
      { id: "6", label: "Walkthrough with customer", completed: false },
    ]
  );

  const handleToggleChecklist = useCallback((id: string) => {
    setLocalChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  }, []);

  const handleUpdateStatus = useCallback((newStatus: Job["status"]) => {
    if (!job) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (newStatus === "in_progress") {
      startJob(job.id);
    } else if (newStatus === "completed") {
      completeJob(job.id);
    } else if (newStatus === "cancelled") {
      cancelJob(job.id);
    }
  }, [job, startJob, completeJob, cancelJob]);

  const handleCall = useCallback(() => {
    if (job?.customerPhone) {
      Linking.openURL(`tel:${job.customerPhone}`);
    }
  }, [job]);

  const handleMessage = useCallback(() => {
    if (job?.customerPhone) {
      Linking.openURL(`sms:${job.customerPhone}`);
    }
  }, [job]);

  const handleNavigate = useCallback(() => {
    if (job?.address) {
      Linking.openURL(`maps://?address=${encodeURIComponent(job.address)}`);
    }
  }, [job]);

  const handleCreateInvoice = useCallback(() => {
    Alert.alert("Create Invoice", "Navigate to create invoice for this job");
  }, []);

  if (!job) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.notFound, { paddingTop: headerHeight }]}>
          <ThemedText type="h2">Job not found</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const getNextAction = (): { label: string; status: Job["status"] } | null => {
    switch (job.status) {
      case "scheduled":
        return { label: "Confirm Job", status: "confirmed" };
      case "confirmed":
        return { label: "On My Way", status: "on_my_way" };
      case "on_my_way":
        return { label: "I've Arrived", status: "arrived" };
      case "arrived":
        return { label: "Start Work", status: "in_progress" };
      case "in_progress":
        return { label: "Complete Job", status: "completed" };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();

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
          <StatusBanner status={job.status} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassCard style={styles.section}>
            <View style={styles.customerRow}>
              <View style={[styles.avatar, { backgroundColor: Colors.accent + "20" }]}>
                {job.customerAvatar ? (
                  <Animated.Image source={{ uri: job.customerAvatar }} style={styles.avatarImage} />
                ) : (
                  <ThemedText type="body" style={{ color: Colors.accent, fontWeight: "600" }}>
                    {getInitials(job.customerName)}
                  </ThemedText>
                )}
              </View>
              <View style={styles.customerInfo}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {job.customerName}
                </ThemedText>
                <Pressable onPress={handleNavigate} style={styles.addressRow}>
                  <Feather name="map-pin" size={14} color={theme.textSecondary} />
                  <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4, flex: 1 }} numberOfLines={1}>
                    {job.address}
                  </ThemedText>
                  <Feather name="external-link" size={14} color={Colors.accent} />
                </Pressable>
              </View>
            </View>

            <View style={[styles.contactRow, { borderTopColor: theme.separator }]}>
              <Pressable style={styles.contactButton} onPress={handleCall}>
                <Feather name="phone" size={18} color={Colors.accent} />
                <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: 4 }}>Call</ThemedText>
              </Pressable>
              <Pressable style={styles.contactButton} onPress={handleMessage}>
                <Feather name="message-circle" size={18} color={Colors.accent} />
                <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: 4 }}>Text</ThemedText>
              </Pressable>
              <Pressable style={styles.contactButton} onPress={handleNavigate}>
                <Feather name="navigation" size={18} color={Colors.accent} />
                <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: 4 }}>Directions</ThemedText>
              </Pressable>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <GlassCard style={styles.section}>
            <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              JOB DETAILS
            </ThemedText>
            <ThemedText type="h3" style={{ marginBottom: Spacing.xs }}>
              {job.service}
            </ThemedText>
            <View style={styles.detailRow}>
              <Feather name="calendar" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {formatDate(job.date)} at {formatTime(job.time)}
                {job.endTime ? ` - ${formatTime(job.endTime)}` : ""}
              </ThemedText>
            </View>
            {job.description ? (
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                {job.description}
              </ThemedText>
            ) : null}
          </GlassCard>
        </Animated.View>

        {job.intakeData ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <GlassCard style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="label" style={{ color: theme.textSecondary }}>
                  AI INTAKE SUMMARY
                </ThemedText>
                <View style={[styles.aiBadge, { backgroundColor: Colors.accent + "20" }]}>
                  <Feather name="cpu" size={12} color={Colors.accent} />
                  <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: 4 }}>
                    Smart Intake
                  </ThemedText>
                </View>
              </View>
              
              {job.intakeData.problemDescription ? (
                <View style={styles.intakeItem}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Problem Description
                  </ThemedText>
                  <ThemedText type="body" style={{ marginTop: 2 }}>
                    {job.intakeData.problemDescription}
                  </ThemedText>
                </View>
              ) : null}

              {job.intakeData.followUpAnswers && job.intakeData.followUpAnswers.length > 0 ? (
                <View style={styles.intakeItem}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                    Follow-up Answers
                  </ThemedText>
                  {job.intakeData.followUpAnswers.map((qa, index) => (
                    <View key={index} style={styles.qaRow}>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        Q: {qa.question}
                      </ThemedText>
                      <ThemedText type="body">
                        A: {qa.answer}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}

              {job.intakeData.estimatedDuration ? (
                <View style={styles.intakeItem}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Estimated Duration
                  </ThemedText>
                  <ThemedText type="body" style={{ marginTop: 2 }}>
                    {job.intakeData.estimatedDuration}
                  </ThemedText>
                </View>
              ) : null}
            </GlassCard>
          </Animated.View>
        ) : null}

        {job.status !== "cancelled" && job.status !== "completed" ? (
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <ChecklistSection checklist={localChecklist} onToggle={handleToggleChecklist} />
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <GlassCard style={styles.section}>
            <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              PRICING
            </ThemedText>
            
            {job.laborCost || job.materialsCost ? (
              <>
                {job.laborCost ? (
                  <View style={styles.priceRow}>
                    <ThemedText type="body">Labor</ThemedText>
                    <ThemedText type="body">{formatCurrency(job.laborCost)}</ThemedText>
                  </View>
                ) : null}
                {job.materialsCost ? (
                  <View style={styles.priceRow}>
                    <ThemedText type="body">Materials</ThemedText>
                    <ThemedText type="body">{formatCurrency(job.materialsCost)}</ThemedText>
                  </View>
                ) : null}
                <View style={[styles.priceRow, styles.totalRow, { borderTopColor: theme.separator }]}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>Total</ThemedText>
                  <ThemedText type="h3" style={{ color: Colors.accent }}>{formatCurrency(job.price)}</ThemedText>
                </View>
              </>
            ) : (
              <View style={styles.priceRow}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>Total</ThemedText>
                <ThemedText type="h3" style={{ color: Colors.accent }}>{formatCurrency(job.price)}</ThemedText>
              </View>
            )}

            {job.paymentStatus ? (
              <View style={[styles.paymentStatus, { borderTopColor: theme.separator }]}>
                <View style={[
                  styles.paymentBadge,
                  { backgroundColor: job.paymentStatus === "paid" ? Colors.accent + "20" : "#EF4444" + "20" }
                ]}>
                  <Feather
                    name={job.paymentStatus === "paid" ? "check-circle" : "clock"}
                    size={14}
                    color={job.paymentStatus === "paid" ? Colors.accent : "#EF4444"}
                  />
                  <ThemedText
                    type="caption"
                    style={{
                      marginLeft: 4,
                      color: job.paymentStatus === "paid" ? Colors.accent : "#EF4444",
                      fontWeight: "600",
                    }}
                  >
                    {job.paymentStatus === "paid" ? "Paid" : job.paymentStatus === "partial" ? "Partial Payment" : "Unpaid"}
                  </ThemedText>
                </View>
                {job.amountPaid && job.amountPaid > 0 ? (
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {formatCurrency(job.amountPaid)} received
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
          </GlassCard>
        </Animated.View>

        {job.notes || job.internalNotes ? (
          <Animated.View entering={FadeInDown.delay(600).duration(400)}>
            <GlassCard style={styles.section}>
              <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                NOTES
              </ThemedText>
              {job.notes ? (
                <View style={styles.noteItem}>
                  <View style={styles.noteBadge}>
                    <Feather name="user" size={12} color={Colors.accent} />
                    <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: 4 }}>
                      Customer Note
                    </ThemedText>
                  </View>
                  <ThemedText type="body" style={{ marginTop: 4 }}>
                    {job.notes}
                  </ThemedText>
                </View>
              ) : null}
              {job.internalNotes ? (
                <View style={styles.noteItem}>
                  <View style={[styles.noteBadge, { backgroundColor: theme.textSecondary + "20" }]}>
                    <Feather name="lock" size={12} color={theme.textSecondary} />
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                      Internal Note
                    </ThemedText>
                  </View>
                  <ThemedText type="body" style={{ marginTop: 4 }}>
                    {job.internalNotes}
                  </ThemedText>
                </View>
              ) : null}
            </GlassCard>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundRoot }]}>
        {job.status === "completed" && !job.invoiceId ? (
          <PrimaryButton onPress={handleCreateInvoice} style={styles.actionButton}>Create Invoice</PrimaryButton>
        ) : nextAction ? (
          <PrimaryButton
            onPress={() => handleUpdateStatus(nextAction.status)}
            style={styles.actionButton}
          >{nextAction.label}</PrimaryButton>
        ) : null}
        
        {job.status !== "cancelled" && job.status !== "completed" ? (
          <Pressable
            style={[styles.cancelButton, { borderColor: "#EF4444" }]}
            onPress={() => {
              Alert.alert(
                "Cancel Job",
                "Are you sure you want to cancel this job?",
                [
                  { text: "No", style: "cancel" },
                  { text: "Yes, Cancel", style: "destructive", onPress: () => handleUpdateStatus("cancelled") },
                ]
              );
            }}
          >
            <ThemedText type="body" style={{ color: "#EF4444" }}>Cancel Job</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBanner: {
    marginBottom: Spacing.md,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  statusInfo: {
    marginLeft: Spacing.md,
  },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  progressItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressDotCurrent: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: Colors.accent,
    backgroundColor: "#FFFFFF",
  },
  progressLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  customerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: 1,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  intakeItem: {
    marginBottom: Spacing.md,
  },
  qaRow: {
    marginBottom: Spacing.xs,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  totalRow: {
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  paymentStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  noteItem: {
    marginBottom: Spacing.md,
  },
  noteBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accent + "20",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  actionButton: {
    marginBottom: Spacing.sm,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
});
