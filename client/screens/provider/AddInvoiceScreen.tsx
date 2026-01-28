import React, { useState } from "react";
import { StyleSheet, ScrollView, View, Alert, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { GlassCard } from "@/components/GlassCard";
import { Spacing, Typography, Colors, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

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
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const clientJobs = jobs.filter((job) => job.clientId === selectedClientId);

  const createMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "stats"] });
      navigation.goBack();
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to create invoice. Please try again.");
      console.error("Create invoice error:", error);
    },
  });

  const handleSave = () => {
    if (!selectedClientId) {
      Alert.alert("Required Field", "Please select a client.");
      return;
    }

    if (!amount.trim() || isNaN(parseFloat(amount))) {
      Alert.alert("Required Field", "Please enter a valid amount.");
      return;
    }

    if (!providerId) {
      Alert.alert("Error", "Provider profile not found.");
      return;
    }

    createMutation.mutate({
      providerId,
      clientId: selectedClientId,
      jobId: selectedJobId || undefined,
      amount: amount.trim(),
      dueDate: dueDate.trim() ? new Date(dueDate).toISOString() : undefined,
      notes: notes.trim() || undefined,
    });
  };

  const handleJobSelect = (jobId: string) => {
    if (selectedJobId === jobId) {
      setSelectedJobId(null);
    } else {
      setSelectedJobId(jobId);
      const job = jobs.find((j) => j.id === jobId);
      if (job?.estimatedPrice) {
        setAmount(job.estimatedPrice);
      }
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
          }}
          showsVerticalScrollIndicator={false}
        >
          <GlassCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Client</ThemedText>
            
            {clients.length === 0 ? (
              <View style={styles.noClients}>
                <ThemedText style={{ color: theme.textSecondary }}>
                  No clients yet. Add a client first.
                </ThemedText>
              </View>
            ) : (
              <View style={styles.clientList}>
                {clients.map((client) => (
                  <Pressable
                    key={client.id}
                    style={[
                      styles.clientOption,
                      { backgroundColor: theme.cardBackground },
                      selectedClientId === client.id && { borderColor: Colors.accent, borderWidth: 2 },
                    ]}
                    onPress={() => {
                      setSelectedClientId(client.id);
                      setSelectedJobId(null);
                    }}
                  >
                    <View style={[styles.clientAvatar, { backgroundColor: Colors.accent + "20" }]}>
                      <ThemedText style={{ color: Colors.accent, fontWeight: "600" }}>
                        {client.firstName[0]}{client.lastName[0]}
                      </ThemedText>
                    </View>
                    <View style={styles.clientInfo}>
                      <ThemedText style={{ fontWeight: "600" }}>
                        {client.firstName} {client.lastName}
                      </ThemedText>
                      {client.email ? (
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                          {client.email}
                        </ThemedText>
                      ) : null}
                    </View>
                    {selectedClientId === client.id ? (
                      <Feather name="check-circle" size={20} color={Colors.accent} />
                    ) : (
                      <View style={[styles.radioOuter, { borderColor: theme.textSecondary }]} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </GlassCard>

          {selectedClientId && clientJobs.length > 0 ? (
            <GlassCard style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Link to Job (Optional)</ThemedText>
              <View style={styles.jobList}>
                {clientJobs.map((job) => (
                  <Pressable
                    key={job.id}
                    style={[
                      styles.jobOption,
                      { backgroundColor: theme.cardBackground },
                      selectedJobId === job.id && { borderColor: Colors.accent, borderWidth: 2 },
                    ]}
                    onPress={() => handleJobSelect(job.id)}
                  >
                    <View style={styles.jobInfo}>
                      <ThemedText style={{ fontWeight: "600" }}>
                        {job.title}
                      </ThemedText>
                      {job.estimatedPrice ? (
                        <ThemedText type="caption" style={{ color: Colors.accent }}>
                          ${job.estimatedPrice}
                        </ThemedText>
                      ) : null}
                    </View>
                    {selectedJobId === job.id ? (
                      <Feather name="check-circle" size={20} color={Colors.accent} />
                    ) : (
                      <View style={[styles.radioOuter, { borderColor: theme.textSecondary }]} />
                    )}
                  </Pressable>
                ))}
              </View>
            </GlassCard>
          ) : null}

          <GlassCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Invoice Details</ThemedText>
            
            <TextField
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            
            <TextField
              label="Due Date (optional)"
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
            />
            
            <TextField
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes or description..."
              multiline
              numberOfLines={3}
            />
          </GlassCard>

          <View style={styles.buttons}>
            <PrimaryButton
              onPress={handleSave}
              disabled={createMutation.isPending || clients.length === 0}
            >
              {createMutation.isPending ? "Creating..." : "Create Invoice"}
            </PrimaryButton>
            
            <SecondaryButton
              onPress={() => navigation.goBack()}
              disabled={createMutation.isPending}
            >
              Cancel
            </SecondaryButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  noClients: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  clientList: {
    gap: Spacing.sm,
  },
  clientOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  clientInfo: {
    flex: 1,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  jobList: {
    gap: Spacing.sm,
  },
  jobOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  jobInfo: {
    flex: 1,
  },
  buttons: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
});
