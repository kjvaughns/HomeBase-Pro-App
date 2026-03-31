import React, { useState, useMemo, useCallback } from "react";
import {
  StyleSheet,
  FlatList,
  RefreshControl,
  View,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { LeadCard } from "@/components/LeadCard";
import { FilterChips, FilterOption } from "@/components/FilterChips";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { StatusPill } from "@/components/StatusPill";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { Lead } from "@/state/providerStore";
import { useAuthStore } from "@/state/authStore";
import { apiRequest, getApiUrl, getAuthHeaders } from "@/lib/query-client";

type LeadFilter = "all" | "new" | "contacted" | "quoted" | "won" | "lost";

const filterOptions: FilterOption<LeadFilter>[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "quoted", label: "Quoted" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

interface IntakeSubmission {
  id: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  address?: string | null;
  problemDescription: string;
  status: string;
  createdAt: string;
  convertedClientId?: string | null;
  preferredTimesJson?: string | null;
}

interface AcceptModalState {
  visible: boolean;
  submission: IntakeSubmission | null;
  scheduledDate: string;
  notes: string;
}

export default function LeadsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const navigation = useNavigation();

  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;

  const [filter, setFilter] = useState<LeadFilter>("all");
  const [acceptModal, setAcceptModal] = useState<AcceptModalState>({
    visible: false,
    submission: null,
    scheduledDate: "",
    notes: "",
  });

  const { data, isLoading, refetch, isRefetching } = useQuery<{ leads: Lead[] }>({
    queryKey: ["/api/providers", providerId, "leads"],
    enabled: !!providerId,
    queryFn: async () => {
      const url = new URL(`/api/providers/${providerId}/leads`, getApiUrl());
      const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  const { data: submissionsData, refetch: refetchSubmissions } = useQuery<{ submissions: IntakeSubmission[] }>({
    queryKey: ["/api/providers", providerId, "intake-submissions"],
    enabled: !!providerId,
    queryFn: async () => {
      const url = new URL(`/api/providers/${providerId}/intake-submissions`, getApiUrl());
      const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  const leads: Lead[] = data?.leads ?? [];
  const submissions: IntakeSubmission[] = (submissionsData?.submissions ?? []).filter(
    (s) => s.status === "submitted"
  );

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Lead["status"] }) => {
      return apiRequest("PATCH", `/api/leads/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers", providerId, "leads"] });
    },
  });

  const declineSubmission = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PUT", `/api/intake-submissions/${id}`, { status: "declined" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers", providerId, "intake-submissions"] });
      refetchSubmissions();
    },
  });

  const acceptSubmission = useMutation({
    mutationFn: async ({
      id,
      scheduledDate,
      notes,
    }: {
      id: string;
      scheduledDate?: string;
      notes?: string;
    }) => {
      const baseUrl = getApiUrl();
      const url = new URL(`/api/intake-submissions/${id}/accept`, baseUrl);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ scheduledDate: scheduledDate || undefined, notes: notes || undefined }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to accept booking" }));
        throw new Error(data.error || "Failed to accept booking");
      }
      return res.json() as Promise<{ message: string; clientId: string; job: { id: string } }>;
    },
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/providers", providerId, "intake-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/providers", providerId, "leads"] });
      refetchSubmissions();
      setAcceptModal({ visible: false, submission: null, scheduledDate: "", notes: "" });
      Alert.alert(
        "Booking Accepted",
        "A client and job have been created successfully.",
        [
          { text: "Done", style: "cancel" },
          {
            text: "View Client",
            onPress: () => (navigation as any).navigate("ClientDetail", { clientId: data.clientId }),
          },
        ]
      );
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message || "Failed to accept booking.");
    },
  });

  const filteredLeads = useMemo(() => {
    if (filter === "all") return leads;
    return leads.filter((l) => l.status === filter);
  }, [leads, filter]);

  const filterOptionsWithCounts = useMemo(() => {
    return filterOptions.map((opt) => ({
      ...opt,
      count: opt.key === "all" ? leads.length : leads.filter((l) => l.status === opt.key).length,
    }));
  }, [leads]);

  const handleContact = (lead: Lead) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateStatus.mutate({ id: lead.id, status: "contacted" });
  };

  const handleDecline = (lead: Lead) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    updateStatus.mutate({ id: lead.id, status: "lost" });
  };

  const handleRefresh = useCallback(() => {
    refetch();
    refetchSubmissions();
  }, [refetch, refetchSubmissions]);

  const openAcceptModal = (submission: IntakeSubmission) => {
    // Prefill scheduled date from the first preferred time the client requested
    let prefillDate = "";
    if (submission.preferredTimesJson) {
      try {
        const times = JSON.parse(submission.preferredTimesJson) as string[];
        if (times.length > 0) {
          const d = new Date(times[0]);
          if (!isNaN(d.getTime())) {
            prefillDate = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    setAcceptModal({
      visible: true,
      submission,
      scheduledDate: prefillDate,
      notes: "",
    });
  };

  const renderSubmissionCard = ({ item, index }: { item: IntakeSubmission; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <GlassCard style={styles.submissionCard} testID={`submission-${item.id}`}>
        <View style={styles.submissionHeader}>
          <View style={styles.submissionTitleRow}>
            <View style={[styles.newDot, { backgroundColor: Colors.accent }]} />
            <ThemedText type="h4" numberOfLines={1} style={styles.submissionName}>
              {item.clientName}
            </ThemedText>
          </View>
          <StatusPill status="info" label="New Request" size="small" />
        </View>

        <ThemedText
          type="body"
          style={[styles.submissionDesc, { color: theme.textSecondary }]}
          numberOfLines={3}
        >
          {item.problemDescription}
        </ThemedText>

        {item.clientPhone ? (
          <View style={styles.submissionMeta}>
            <Feather name="phone" size={13} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {item.clientPhone}
            </ThemedText>
          </View>
        ) : null}
        {item.address ? (
          <View style={styles.submissionMeta}>
            <Feather name="map-pin" size={13} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
              {item.address}
            </ThemedText>
          </View>
        ) : null}

        <View style={[styles.submissionActions, { borderTopColor: theme.separator }]}>
          <SecondaryButton
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              declineSubmission.mutate(item.id);
            }}
            style={styles.actionBtnSmall}
          >
            Decline
          </SecondaryButton>
          <PrimaryButton
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              openAcceptModal(item);
            }}
            style={styles.actionBtnSmall}
          >
            Accept Booking
          </PrimaryButton>
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderLead = ({ item, index }: { item: Lead; index: number }) => (
    <Animated.View entering={FadeInDown.delay((submissions.length + index) * 50).duration(300)}>
      <LeadCard
        lead={item}
        onPress={() => {}}
        onContact={() => handleContact(item)}
        onDecline={() => handleDecline(item)}
        testID={`lead-${item.id}`}
      />
    </Animated.View>
  );

  const renderHeader = () => (
    <View style={styles.filterWrapper}>
      {submissions.length > 0 ? (
        <View style={[styles.sectionLabel, { borderBottomColor: theme.separator }]}>
          <Feather name="bell" size={14} color={Colors.accent} />
          <ThemedText type="caption" style={[styles.sectionLabelText, { color: Colors.accent }]}>
            Booking Requests ({submissions.length})
          </ThemedText>
        </View>
      ) : null}

      {submissions.map((sub, index) =>
        renderSubmissionCard({ item: sub, index })
      )}

      {submissions.length > 0 && leads.length > 0 ? (
        <View style={[styles.sectionLabel, { borderBottomColor: theme.separator }]}>
          <Feather name="users" size={14} color={theme.textSecondary} />
          <ThemedText type="caption" style={[styles.sectionLabelText, { color: theme.textSecondary }]}>
            CRM Leads
          </ThemedText>
        </View>
      ) : null}

      <FilterChips
        options={filterOptionsWithCounts}
        selected={filter}
        onSelect={setFilter}
        showCounts
        style={styles.filterChips}
      />
    </View>
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../../assets/images/empty-leads.png")}
      title={filter === "all" ? "No leads yet" : `No ${filter} leads`}
      description={
        filter === "all"
          ? "New job requests from homeowners will appear here. Keep your profile up to date to attract more leads!"
          : `You don't have any ${filter} leads at the moment.`
      }
    />
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredLeads}
        renderItem={renderLead}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={filteredLeads.length === 0 && submissions.length === 0 ? renderEmpty : null}
        contentContainerStyle={[
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
          filteredLeads.length === 0 && submissions.length === 0 && styles.emptyContainer,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
      />

      <Modal
        visible={acceptModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setAcceptModal((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHandle} />
            <ThemedText type="h3" style={styles.modalTitle}>
              Accept Booking
            </ThemedText>
            {acceptModal.submission ? (
              <ThemedText type="body" style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                Accepting request from {acceptModal.submission.clientName}. A client record and job will be created automatically.
              </ThemedText>
            ) : null}

            <ThemedText type="label" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Scheduled Date (optional)
            </ThemedText>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              value={acceptModal.scheduledDate}
              onChangeText={(v) => setAcceptModal((prev) => ({ ...prev, scheduledDate: v }))}
              placeholder="e.g. 2026-04-15"
              placeholderTextColor={theme.textTertiary}
              testID="accept-scheduled-date"
            />

            <ThemedText type="label" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Notes (optional)
            </ThemedText>
            <TextInput
              style={[
                styles.textInput,
                styles.textInputMulti,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              value={acceptModal.notes}
              onChangeText={(v) => setAcceptModal((prev) => ({ ...prev, notes: v }))}
              placeholder="Any notes for this job..."
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={3}
              testID="accept-notes"
            />

            <View style={styles.modalButtons}>
              <SecondaryButton
                onPress={() => setAcceptModal((prev) => ({ ...prev, visible: false }))}
                style={styles.modalBtn}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton
                onPress={() => {
                  if (acceptModal.submission) {
                    acceptSubmission.mutate({
                      id: acceptModal.submission.id,
                      scheduledDate: acceptModal.scheduledDate || undefined,
                      notes: acceptModal.notes || undefined,
                    });
                  }
                }}
                disabled={acceptSubmission.isPending}
                style={styles.modalBtn}
              >
                {acceptSubmission.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  "Confirm"
                )}
              </PrimaryButton>
            </View>
            <View style={{ height: insets.bottom }} />
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterWrapper: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.screenPadding,
  },
  filterChips: {
    paddingVertical: Spacing.sm,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.sm,
  },
  sectionLabelText: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  submissionCard: {
    marginBottom: Spacing.md,
  },
  submissionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  submissionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flex: 1,
    marginRight: Spacing.sm,
  },
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  submissionName: {
    flex: 1,
  },
  submissionDesc: {
    marginBottom: Spacing.sm,
  },
  submissionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  submissionActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtnSmall: {
    paddingHorizontal: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingTop: Spacing.md,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    marginBottom: Spacing.sm,
  },
  modalSubtitle: {
    marginBottom: Spacing.xl,
  },
  fieldLabel: {
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    fontSize: 11,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    fontSize: 15,
  },
  textInputMulti: {
    height: 80,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalBtn: {
    flex: 1,
  },
});
