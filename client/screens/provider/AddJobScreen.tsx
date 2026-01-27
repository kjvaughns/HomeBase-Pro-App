import React, { useState } from "react";
import { StyleSheet, ScrollView, View, Alert, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
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

export default function AddJobScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { providerProfile } = useAuthStore();
  const { theme } = useTheme();

  const providerId = providerProfile?.id;

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const clients = clientsData?.clients || [];

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [address, setAddress] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: {
      providerId: string;
      clientId: string;
      title: string;
      description?: string;
      scheduledDate: string;
      scheduledTime?: string;
      estimatedPrice?: string;
      address?: string;
    }) => {
      const response = await apiRequest("POST", "/api/jobs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "stats"] });
      navigation.goBack();
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to create job. Please try again.");
      console.error("Create job error:", error);
    },
  });

  const handleSave = () => {
    if (!selectedClientId) {
      Alert.alert("Required Field", "Please select a client.");
      return;
    }

    if (!title.trim()) {
      Alert.alert("Required Field", "Please enter a job title.");
      return;
    }

    if (!scheduledDate.trim()) {
      Alert.alert("Required Field", "Please enter a scheduled date.");
      return;
    }

    if (!providerId) {
      Alert.alert("Error", "Provider profile not found.");
      return;
    }

    createMutation.mutate({
      providerId,
      clientId: selectedClientId,
      title: title.trim(),
      description: description.trim() || undefined,
      scheduledDate: new Date(scheduledDate).toISOString(),
      scheduledTime: scheduledTime.trim() || undefined,
      estimatedPrice: estimatedPrice.trim() || undefined,
      address: address.trim() || undefined,
    });
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

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
                <Pressable
                  style={[styles.addClientLink, { borderColor: Colors.accent }]}
                  onPress={() => (navigation as any).navigate("AddClient")}
                >
                  <Feather name="plus" size={16} color={Colors.accent} />
                  <ThemedText style={{ color: Colors.accent }}>Add Client</ThemedText>
                </Pressable>
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
                    onPress={() => setSelectedClientId(client.id)}
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
                      {client.phone ? (
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                          {client.phone}
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

          <GlassCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Job Details</ThemedText>
            
            <TextField
              label="Job Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Pipe Repair, Bathroom Renovation"
            />
            
            <TextField
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the job..."
              multiline
              numberOfLines={3}
            />
            
            <TextField
              label="Estimated Price (optional)"
              value={estimatedPrice}
              onChangeText={setEstimatedPrice}
              placeholder="$ 150.00"
              keyboardType="decimal-pad"
            />
          </GlassCard>

          <GlassCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Schedule</ThemedText>
            
            <TextField
              label="Date"
              value={scheduledDate}
              onChangeText={setScheduledDate}
              placeholder="YYYY-MM-DD"
            />
            
            <TextField
              label="Time (optional)"
              value={scheduledTime}
              onChangeText={setScheduledTime}
              placeholder="e.g., 10:00 AM"
            />
          </GlassCard>

          <GlassCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Location</ThemedText>
            
            <TextField
              label="Address (optional)"
              value={address}
              onChangeText={setAddress}
              placeholder="Service address"
            />
          </GlassCard>

          <View style={styles.buttons}>
            <PrimaryButton
              onPress={handleSave}
              disabled={createMutation.isPending || clients.length === 0}
            >
              {createMutation.isPending ? "Creating..." : "Create Job"}
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
    gap: Spacing.md,
  },
  addClientLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
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
  buttons: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
});
