import React, { useState, useMemo, useCallback } from "react";
import { StyleSheet, View, ScrollView, Modal, Pressable, Alert, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { Avatar } from "@/components/Avatar";
import { StatusPill } from "@/components/StatusPill";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type AppointmentDetailParams = { appointmentId: string };
type ScreenRouteProp = RouteProp<{ AppointmentDetail: AppointmentDetailParams }, "AppointmentDetail">;

type AppointmentStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

interface Appointment {
  id: string;
  userId: string;
  homeId: string;
  providerId: string;
  serviceName: string;
  description?: string;
  scheduledDate: string;
  scheduledTime: string;
  urgency: string;
  jobSize: string;
  estimatedPrice?: number;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; status: "success" | "info" | "warning" | "neutral" | "cancelled" }> = {
  pending: { label: "Pending", status: "info" },
  confirmed: { label: "Confirmed", status: "info" },
  in_progress: { label: "In Progress", status: "warning" },
  completed: { label: "Completed", status: "success" },
  cancelled: { label: "Cancelled", status: "cancelled" },
};

const TIME_SLOTS = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM",
  "4:00 PM", "5:00 PM"
];

export default function AppointmentDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { appointmentId } = route.params;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [conditionUpdate, setConditionUpdate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading, error } = useQuery<{ appointment: Appointment }>({
    queryKey: ["/api/appointments", appointmentId],
    queryFn: async () => {
      const response = await fetch(new URL(`/api/appointments/${appointmentId}`, getApiUrl()).toString());
      if (!response.ok) throw new Error("Failed to fetch appointment");
      return response.json();
    },
  });

  const appointment = data?.appointment;
  const statusConfig = appointment ? STATUS_CONFIG[appointment.status] : null;

  const generateDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  const handleReschedule = useCallback(async () => {
    if (!selectedDate || !selectedTime || !appointment) return;

    setIsSubmitting(true);
    try {
      const formattedDate = selectedDate.toISOString().split("T")[0];
      await apiRequest("POST", `/api/appointments/${appointmentId}/reschedule`, {
        scheduledDate: formattedDate,
        scheduledTime: selectedTime,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setShowRescheduleModal(false);
      setSelectedDate(null);
      setSelectedTime(null);
    } catch (err) {
      Alert.alert("Error", "Failed to reschedule appointment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedDate, selectedTime, appointment, appointmentId, queryClient]);

  const handleCancel = useCallback(async () => {
    if (!appointment) return;

    setIsSubmitting(true);
    try {
      await apiRequest("POST", `/api/appointments/${appointmentId}/cancel`);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setShowCancelModal(false);
      navigation.goBack();
    } catch (err) {
      Alert.alert("Error", "Failed to cancel appointment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [appointment, appointmentId, queryClient, navigation]);

  const handleMessage = () => {
    if (appointment) {
      (navigation as any).navigate("Chat", { jobId: appointment.id });
    }
  };

  const handleConditionUpdate = useCallback(async () => {
    if (!conditionUpdate.trim() || !appointment) return;

    setIsSubmitting(true);
    try {
      await apiRequest("POST", `/api/appointments/${appointmentId}/update-condition`, {
        description: conditionUpdate,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setShowConditionModal(false);
      setConditionUpdate("");
      Alert.alert("Update Sent", "The provider has been notified about the change in your situation.");
    } catch (err) {
      Alert.alert("Error", "Failed to submit update. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [conditionUpdate, appointment, appointmentId, queryClient]);

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading appointment...
        </ThemedText>
      </ThemedView>
    );
  }

  if (error || !appointment || !statusConfig) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <Feather name="alert-circle" size={48} color={theme.textTertiary} />
        <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
          Appointment not found
        </ThemedText>
        <SecondaryButton onPress={() => navigation.goBack()}>
          Go Back
        </SecondaryButton>
      </ThemedView>
    );
  }

  const canModify = appointment.status !== "completed" && appointment.status !== "cancelled";

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
              <Avatar name="Service Provider" size="medium" />
              <View style={styles.headerInfo}>
                <ThemedText style={styles.serviceName}>{appointment.serviceName}</ThemedText>
                <ThemedText style={[styles.serviceDesc, { color: theme.textSecondary }]}>
                  {appointment.description || "Home service appointment"}
                </ThemedText>
              </View>
              <StatusPill
                label={statusConfig.label}
                status={statusConfig.status}
              />
            </View>
          </GlassCard>
        </Animated.View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Details</ThemedText>
          
          <View style={[styles.detailCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
            <View style={styles.detailRow}>
              <Feather name="calendar" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Date</ThemedText>
              <ThemedText style={styles.detailValue}>{formatDate(appointment.scheduledDate)}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <Feather name="clock" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Time</ThemedText>
              <ThemedText style={styles.detailValue}>{appointment.scheduledTime}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <Feather name="alert-circle" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Urgency</ThemedText>
              <ThemedText style={styles.detailValue}>{appointment.urgency}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <Feather name="layers" size={18} color={theme.textSecondary} />
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Job Size</ThemedText>
              <ThemedText style={styles.detailValue}>{appointment.jobSize}</ThemedText>
            </View>
            {appointment.estimatedPrice ? (
              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <Feather name="dollar-sign" size={18} color={theme.textSecondary} />
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Est. Price</ThemedText>
                <ThemedText style={[styles.detailValue, { color: Colors.accent }]}>${appointment.estimatedPrice}</ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          <SecondaryButton onPress={handleMessage}>
            Message Provider
          </SecondaryButton>

          {canModify ? (
            <>
              <SecondaryButton onPress={() => setShowConditionModal(true)} style={styles.actionBtn}>
                Update Condition
              </SecondaryButton>
              <SecondaryButton onPress={() => setShowRescheduleModal(true)} style={styles.actionBtn}>
                Reschedule
              </SecondaryButton>
              <Pressable
                style={[styles.cancelBtn, { borderColor: Colors.error }]}
                onPress={() => setShowCancelModal(true)}
              >
                <ThemedText style={[styles.cancelBtnText, { color: Colors.error }]}>
                  Cancel Appointment
                </ThemedText>
              </Pressable>
            </>
          ) : null}
        </View>

        <View style={styles.statusInfo}>
          <ThemedText style={[styles.statusInfoText, { color: theme.textTertiary }]}>
            Booked on {new Date(appointment.createdAt).toLocaleDateString()}
          </ThemedText>
        </View>
      </ScrollView>

      <Modal
        visible={showRescheduleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Reschedule Appointment</ThemedText>
            <Pressable onPress={() => setShowRescheduleModal(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <ThemedText style={styles.modalSectionTitle}>Select a New Date</ThemedText>
            <View style={styles.dateGrid}>
              {generateDates.map((date) => {
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                return (
                  <Pressable
                    key={date.toISOString()}
                    style={[
                      styles.dateItem,
                      { borderColor: isSelected ? Colors.accent : theme.borderLight },
                      isSelected && { backgroundColor: `${Colors.accent}14` },
                    ]}
                    onPress={() => setSelectedDate(date)}
                  >
                    <ThemedText style={[styles.dateDay, isSelected && { color: Colors.accent }]}>
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </ThemedText>
                    <ThemedText style={[styles.dateNum, isSelected && { color: Colors.accent }]}>
                      {date.getDate()}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText style={styles.modalSectionTitle}>Select a New Time</ThemedText>
            <View style={styles.timeGrid}>
              {TIME_SLOTS.map((time) => {
                const isSelected = selectedTime === time;
                return (
                  <Pressable
                    key={time}
                    style={[
                      styles.timeItem,
                      { borderColor: isSelected ? Colors.accent : theme.borderLight },
                      isSelected && { backgroundColor: `${Colors.accent}14` },
                    ]}
                    onPress={() => setSelectedTime(time)}
                  >
                    <ThemedText style={[styles.timeText, isSelected && { color: Colors.accent }]}>
                      {time}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: insets.bottom + Spacing.md }]}>
            <PrimaryButton
              onPress={handleReschedule}
              disabled={!selectedDate || !selectedTime || isSubmitting}
              loading={isSubmitting}
            >
              Confirm New Date & Time
            </PrimaryButton>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCancelModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.cancelModalOverlay}>
          <View style={[styles.cancelModalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.cancelModalIcon}>
              <Feather name="alert-triangle" size={40} color={Colors.error} />
            </View>
            <ThemedText style={styles.cancelModalTitle}>Cancel Appointment?</ThemedText>
            <ThemedText style={[styles.cancelModalDesc, { color: theme.textSecondary }]}>
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </ThemedText>
            <View style={styles.cancelModalActions}>
              <SecondaryButton onPress={() => setShowCancelModal(false)} style={styles.cancelModalBtn}>
                Keep Appointment
              </SecondaryButton>
              <Pressable
                style={[styles.confirmCancelBtn, { backgroundColor: Colors.error }]}
                onPress={handleCancel}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.confirmCancelBtnText}>Yes, Cancel</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showConditionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowConditionModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Update Condition</ThemedText>
            <Pressable onPress={() => setShowConditionModal(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <ThemedText style={[styles.conditionDesc, { color: theme.textSecondary }]}>
              Has your situation changed? Let the provider know if the job has gotten worse or if there are new issues.
            </ThemedText>
            
            <TextInput
              style={[
                styles.conditionInput,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.borderLight,
                  color: theme.text,
                },
              ]}
              placeholder="Describe what has changed..."
              placeholderTextColor={theme.textTertiary}
              value={conditionUpdate}
              onChangeText={setConditionUpdate}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <PrimaryButton
              onPress={handleConditionUpdate}
              disabled={!conditionUpdate.trim() || isSubmitting}
              style={styles.conditionSubmitBtn}
            >
              {isSubmitting ? "Sending..." : "Send Update"}
            </PrimaryButton>
          </ScrollView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  errorText: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  headerCard: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  serviceName: {
    ...Typography.headline,
    fontWeight: "600",
  },
  serviceDesc: {
    ...Typography.subhead,
    marginTop: 2,
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
  actions: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionBtn: {
    marginTop: 0,
  },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  cancelBtnText: {
    ...Typography.body,
    fontWeight: "600",
  },
  statusInfo: {
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  statusInfoText: {
    ...Typography.caption1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    paddingTop: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalTitle: {
    ...Typography.title3,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    padding: Spacing.md,
  },
  modalSectionTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  dateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  dateItem: {
    width: 56,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  dateDay: {
    ...Typography.caption2,
  },
  dateNum: {
    ...Typography.headline,
    fontWeight: "600",
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  timeItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  timeText: {
    ...Typography.body,
  },
  modalFooter: {
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  cancelModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  cancelModalContent: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
  },
  cancelModalIcon: {
    marginBottom: Spacing.md,
  },
  cancelModalTitle: {
    ...Typography.title3,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  cancelModalDesc: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  cancelModalActions: {
    width: "100%",
    gap: Spacing.sm,
  },
  cancelModalBtn: {
    marginTop: 0,
  },
  confirmCancelBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  confirmCancelBtnText: {
    ...Typography.body,
    fontWeight: "600",
    color: "#fff",
  },
  conditionDesc: {
    ...Typography.body,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  conditionInput: {
    minHeight: 120,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  conditionSubmitBtn: {
    marginTop: Spacing.sm,
  },
});
