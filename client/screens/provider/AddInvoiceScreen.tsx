import React, { useState } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { GlassCard } from "@/components/GlassCard";
import { FormSectionHeader } from "@/components/FormSectionHeader";
import { Spacing, Typography, Colors, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import * as Haptics from "expo-haptics";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

interface Job {
  id: string;
  clientId: string;
  title: string;
  estimatedPrice?: string;
}

export default function AddInvoiceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { providerProfile } = useAuthStore();
  const { theme } = useTheme();

  const providerId = providerProfile?.id;
  const preselectedClientId = (route.params as any)?.clientId;

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const { data: jobsData } = useQuery<{ jobs: Job[] }>({
    queryKey: ["/api/provider", providerId, "jobs"],
    enabled: !!providerId,
  });

  const clients = clientsData?.clients || [];
  const jobs = jobsData?.jobs || [];

  const [selectedClientId, setSelectedClientId] = useState<string | null>(preselectedClientId || null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const clientJobs = jobs.filter((job) => job.clientId === selectedClientId);

  const createMutation = useMutation({
    mutationFn: async (data: {
      providerId: string;
      clientId: string;
      jobId?: string;
      amount: string;
      dueDate?: string;
      notes?: string;
      sendImmediately?: boolean;
    }) => {
      const response = await apiRequest("POST", "/api/invoices/create-and-send", data);
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "stats"] });
      navigation.goBack();
    },
    onError: (error) => {
      setFormError("Failed to create invoice. Please try again.");
      console.error("Create invoice error:", error);
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async (data: {
      providerId: string;
      clientId: string;
      jobId?: string;
      amount: string;
      dueDate?: string;
      notes?: string;
    }) => {
      const response = await apiRequest("POST", "/api/invoices", data);
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "invoices"] });
      navigation.goBack();
    },
    onError: (error) => {
      setFormError("Failed to save invoice. Please try again.");
      console.error("Save invoice error:", error);
    },
  });

  const validateForm = () => {
    setFormError(null);
    if (!selectedClientId) { setFormError("Please select a client."); return false; }
    if (!amount.trim() || isNaN(parseFloat(amount))) { setFormError("Please enter a valid amount."); return false; }
    if (!providerId) { setFormError("Provider profile not found."); return false; }
    return true;
  };

  const handleCreateAndSend = () => {
    if (!validateForm()) return;
    createMutation.mutate({
      providerId: providerId!,
      clientId: selectedClientId!,
      jobId: selectedJobId || undefined,
      amount: amount.trim(),
      dueDate: dueDate ? dueDate.toISOString() : undefined,
      notes: notes.trim() || undefined,
      sendImmediately: true,
    });
  };

  const handleSaveDraft = () => {
    if (!validateForm()) return;
    saveDraftMutation.mutate({
      providerId: providerId!,
      clientId: selectedClientId!,
      jobId: selectedJobId || undefined,
      amount: amount.trim(),
      dueDate: dueDate ? dueDate.toISOString() : undefined,
      notes: notes.trim() || undefined,
    });
  };

  const handleJobSelect = (jobId: string) => {
    if (selectedJobId === jobId) {
      setSelectedJobId(null);
    } else {
      setSelectedJobId(jobId);
      const job = jobs.find((j) => j.id === jobId);
      if (job?.estimatedPrice) setAmount(job.estimatedPrice);
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const anyLoading = createMutation.isPending || saveDraftMutation.isPending;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Client */}
        <GlassCard style={styles.section}>
          <FormSectionHeader icon="users" title="Client" />

          {clients.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="users" size={20} color={theme.textTertiary} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
                No clients yet
              </ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
                Add a client first to create an invoice.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.clientList}>
              {clients.map((client, idx) => (
                <Pressable
                  key={client.id}
                  style={[
                    styles.clientRow,
                    idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
                    selectedClientId === client.id && styles.clientRowSelected,
                  ]}
                  onPress={() => { setSelectedClientId(client.id); setSelectedJobId(null); }}
                  testID={`client-option-${client.id}`}
                >
                  <View style={[
                    styles.clientAvatar,
                    { backgroundColor: selectedClientId === client.id ? Colors.accent : Colors.accentLight },
                  ]}>
                    <ThemedText style={[
                      styles.avatarText,
                      { color: selectedClientId === client.id ? "#FFFFFF" : Colors.accent },
                    ]}>
                      {client.firstName[0]}{client.lastName[0]}
                    </ThemedText>
                  </View>
                  <View style={styles.clientInfo}>
                    <ThemedText style={[
                      styles.clientName,
                      selectedClientId === client.id && { color: Colors.accent },
                    ]}>
                      {client.firstName} {client.lastName}
                    </ThemedText>
                    {client.email ? (
                      <ThemedText style={[styles.clientEmail, { color: theme.textTertiary }]}>
                        {client.email}
                      </ThemedText>
                    ) : null}
                  </View>
                  {selectedClientId === client.id ? (
                    <Feather name="check-circle" size={20} color={Colors.accent} />
                  ) : (
                    <View style={[styles.radioOuter, { borderColor: theme.backgroundTertiary }]} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </GlassCard>

        {/* Link to Job (optional) */}
        {selectedClientId && clientJobs.length > 0 ? (
          <GlassCard style={styles.section}>
            <FormSectionHeader icon="briefcase" title="Link to Job" iconBg={theme.backgroundSecondary}>
              <View style={[styles.optionalBadge, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={[styles.optionalText, { color: theme.textTertiary }]}>Optional</ThemedText>
              </View>
            </FormSectionHeader>
            <View>
              {clientJobs.map((job, idx) => (
                <Pressable
                  key={job.id}
                  style={[
                    styles.jobRow,
                    idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
                    selectedJobId === job.id && styles.jobRowSelected,
                  ]}
                  onPress={() => handleJobSelect(job.id)}
                  testID={`job-option-${job.id}`}
                >
                  <View style={[
                    styles.jobIconWrap,
                    { backgroundColor: selectedJobId === job.id ? Colors.accentLight : theme.backgroundSecondary },
                  ]}>
                    <Feather name="tool" size={14} color={selectedJobId === job.id ? Colors.accent : theme.textTertiary} />
                  </View>
                  <View style={styles.jobInfo}>
                    <ThemedText style={[
                      styles.jobTitle,
                      selectedJobId === job.id && { color: Colors.accent },
                    ]}>
                      {job.title}
                    </ThemedText>
                    {job.estimatedPrice ? (
                      <ThemedText style={[styles.jobPrice, { color: Colors.accent }]}>
                        ${job.estimatedPrice}
                      </ThemedText>
                    ) : null}
                  </View>
                  {selectedJobId === job.id ? (
                    <Feather name="check-circle" size={20} color={Colors.accent} />
                  ) : (
                    <View style={[styles.radioOuter, { borderColor: theme.backgroundTertiary }]} />
                  )}
                </Pressable>
              ))}
            </View>
          </GlassCard>
        ) : null}

        {/* Invoice Details */}
        <GlassCard style={styles.section}>
          <FormSectionHeader icon="file-text" title="Invoice Details" />

          {/* Amount */}
          <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Amount</ThemedText>
          <TextField
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
            leftIcon="dollar-sign"
            style={styles.amountInput}
            testID="input-amount"
          />

          <View style={[styles.divider, { backgroundColor: theme.separator }]} />

          {/* Due Date */}
          <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Due Date (optional)</ThemedText>
          <Pressable
            style={[styles.datePill, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => setShowDatePicker(true)}
            testID="picker-due-date"
          >
            <Feather name="calendar" size={15} color={dueDate ? Colors.accent : theme.textTertiary} />
            <ThemedText style={[styles.datePillText, { color: dueDate ? theme.text : theme.textTertiary }]}>
              {dueDate ? formatDate(dueDate) : "Select due date"}
            </ThemedText>
            {dueDate ? (
              <Pressable
                onPress={() => setDueDate(null)}
                hitSlop={8}
              >
                <Feather name="x" size={14} color={theme.textTertiary} />
              </Pressable>
            ) : null}
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.separator }]} />

          {/* Notes */}
          <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Notes (optional)</ThemedText>
          <TextField
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any notes or description..."
            multiline
            numberOfLines={3}
            testID="input-notes"
          />
        </GlassCard>

        {formError ? (
          <View style={[styles.errorBox, { backgroundColor: Colors.errorLight }]}>
            <Feather name="alert-circle" size={16} color={Colors.error} />
            <ThemedText style={[styles.errorText, { color: Colors.error }]}>{formError}</ThemedText>
          </View>
        ) : null}

        {/* Footer Actions */}
        <View style={styles.footer}>
          <View style={styles.primaryRow}>
            <PrimaryButton
              onPress={handleCreateAndSend}
              loading={createMutation.isPending}
              disabled={anyLoading || clients.length === 0}
              style={styles.btnFlex}
              testID="button-create-send"
            >
              Send Invoice
            </PrimaryButton>
            <SecondaryButton
              onPress={handleSaveDraft}
              loading={saveDraftMutation.isPending}
              disabled={anyLoading || clients.length === 0}
              style={styles.btnFlex}
              testID="button-save-draft"
            >
              Save Draft
            </SecondaryButton>
          </View>
          <Pressable
            onPress={() => navigation.goBack()}
            disabled={anyLoading}
            style={styles.cancelRow}
          >
            <ThemedText style={[styles.cancelText, { color: theme.textTertiary }]}>Cancel</ThemedText>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>

      {showDatePicker ? (
        <DateTimePicker
          value={dueDate ?? new Date()}
          mode="date"
          display="spinner"
          minimumDate={new Date()}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(false);
            if (date) setDueDate(date);
          }}
        />
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { marginBottom: Spacing.lg },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.sm },
  fieldLabel: {
    ...Typography.footnote,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  amountInput: {
    ...Typography.title3,
    fontWeight: "700",
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubtitle: {
    ...Typography.footnote,
    textAlign: "center",
  },
  clientList: {},
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  clientRowSelected: {},
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    ...Typography.subhead,
    fontWeight: "700",
  },
  clientInfo: { flex: 1 },
  clientName: { ...Typography.subhead, fontWeight: "600" },
  clientEmail: { ...Typography.caption1, marginTop: 2 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  optionalBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  optionalText: {
    ...Typography.caption2,
    fontWeight: "500",
  },
  jobRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  jobRowSelected: {},
  jobIconWrap: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  jobInfo: { flex: 1 },
  jobTitle: { ...Typography.subhead, fontWeight: "600" },
  jobPrice: { ...Typography.caption1, fontWeight: "600", marginTop: 2 },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  datePillText: {
    ...Typography.body,
    flex: 1,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: { ...Typography.subhead, flex: 1 },
  footer: { marginTop: Spacing.md, gap: Spacing.sm },
  primaryRow: { flexDirection: "row", gap: Spacing.md },
  btnFlex: { flex: 1 },
  cancelRow: { alignItems: "center", paddingVertical: Spacing.md },
  cancelText: { ...Typography.body },
});
