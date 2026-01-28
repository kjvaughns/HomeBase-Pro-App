import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
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

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: "plumbing", name: "Plumbing", icon: "droplet" },
  { id: "electrical", name: "Electrical", icon: "zap" },
  { id: "hvac", name: "HVAC", icon: "wind" },
  { id: "cleaning", name: "Cleaning", icon: "home" },
  { id: "landscaping", name: "Landscaping", icon: "sun" },
  { id: "handyman", name: "Handyman", icon: "tool" },
  { id: "roofing", name: "Roofing", icon: "triangle" },
  { id: "painting", name: "Painting", icon: "edit-3" },
  { id: "flooring", name: "Flooring", icon: "grid" },
  { id: "other", name: "Other", icon: "more-horizontal" },
];

const INTAKE_QUESTIONS: Record<string, string[]> = {
  plumbing: [
    "What is the issue (leak, clog, install)?",
    "Which fixture is affected?",
    "Is it an emergency?",
  ],
  electrical: [
    "What is the issue (outlet, wiring, install)?",
    "Which area of the home?",
    "Any flickering or sparks observed?",
  ],
  hvac: [
    "What is the issue (heating, cooling, maintenance)?",
    "Type of system?",
    "When was last service?",
  ],
  cleaning: [
    "Type of cleaning (regular, deep, move-out)?",
    "Approximate square footage?",
    "Any priority areas?",
  ],
  landscaping: [
    "Type of service (mowing, design, tree work)?",
    "Approximate yard size?",
    "Any specific concerns?",
  ],
  handyman: [
    "Describe the project briefly",
    "Tools/materials needed?",
    "Time-sensitive?",
  ],
  roofing: [
    "Type of work (repair, replace, inspect)?",
    "Type of roofing material?",
    "Any visible damage?",
  ],
  painting: [
    "Interior or exterior?",
    "Number of rooms/area?",
    "Surface condition?",
  ],
  flooring: [
    "Type of flooring (hardwood, tile, carpet)?",
    "Install or repair?",
    "Square footage?",
  ],
  other: [
    "Describe the job",
    "Any special requirements?",
    "Preferred completion date?",
  ],
};

export default function AddJobScreen() {
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

  const clients = clientsData?.clients || [];

  const [step, setStep] = useState<WizardStep>(preselectedClientId ? 2 : 1);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    preselectedClientId || null
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({});
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [notes, setNotes] = useState("");

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  const selectedCategoryData = useMemo(
    () => SERVICE_CATEGORIES.find((c) => c.id === selectedCategory),
    [selectedCategory]
  );

  const intakeQuestions = useMemo(
    () => (selectedCategory ? INTAKE_QUESTIONS[selectedCategory] || [] : []),
    [selectedCategory]
  );

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
      category?: string;
      intakeData?: object;
    }) => {
      const response = await apiRequest("POST", "/api/jobs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "jobs"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "stats"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "clients"],
      });
      navigation.goBack();
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to create job. Please try again.");
      console.error("Create job error:", error);
    },
  });

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return !!selectedClientId;
      case 2:
        return !!selectedCategory;
      case 3:
        return title.trim().length > 0;
      case 4:
        return scheduledDate.trim().length > 0;
      case 5:
        return true;
      default:
        return false;
    }
  }, [step, selectedClientId, selectedCategory, title, scheduledDate]);

  const handleNext = () => {
    if (step < 5) {
      setStep((step + 1) as WizardStep);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as WizardStep);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = () => {
    if (!selectedClientId || !providerId) return;

    const description = Object.entries(intakeAnswers)
      .filter(([, answer]) => answer.trim())
      .map(([question, answer]) => `${question}: ${answer}`)
      .join("\n");

    createMutation.mutate({
      providerId,
      clientId: selectedClientId,
      title: title.trim() || `${selectedCategoryData?.name || "Service"} Job`,
      description: description || notes || undefined,
      scheduledDate: new Date(scheduledDate).toISOString(),
      scheduledTime: scheduledTime.trim() || undefined,
      estimatedPrice: estimatedPrice.trim() || undefined,
      address: selectedClient?.address || undefined,
      category: selectedCategory || undefined,
      intakeData: {
        questions: intakeAnswers,
        notes,
      },
    });
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3, 4, 5].map((s) => (
        <View key={s} style={styles.stepItem}>
          <View
            style={[
              styles.stepDot,
              {
                backgroundColor:
                  s === step
                    ? Colors.accent
                    : s < step
                    ? Colors.accent + "80"
                    : theme.separator,
              },
            ]}
          >
            {s < step ? (
              <Feather name="check" size={12} color="#FFFFFF" />
            ) : (
              <ThemedText
                style={{
                  color: s === step ? "#FFFFFF" : theme.textSecondary,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {s}
              </ThemedText>
            )}
          </View>
          {s < 5 ? (
            <View
              style={[
                styles.stepLine,
                { backgroundColor: s < step ? Colors.accent + "80" : theme.separator },
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <GlassCard style={styles.stepCard}>
      <ThemedText style={styles.stepTitle}>Select Client</ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Choose a client for this job
      </ThemedText>

      {clients.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="users" size={48} color={theme.textSecondary} />
          <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            No clients yet
          </ThemedText>
          <Pressable
            style={[styles.addClientButton, { borderColor: Colors.accent }]}
            onPress={() => (navigation as any).navigate("AddClient")}
          >
            <Feather name="plus" size={16} color={Colors.accent} />
            <ThemedText style={{ color: Colors.accent }}>Add Client</ThemedText>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.clientList} showsVerticalScrollIndicator={false}>
          {clients.map((client) => (
            <Pressable
              key={client.id}
              style={[
                styles.clientOption,
                { backgroundColor: theme.cardBackground },
                selectedClientId === client.id && {
                  borderColor: Colors.accent,
                  borderWidth: 2,
                },
              ]}
              onPress={() => setSelectedClientId(client.id)}
            >
              <View style={[styles.clientAvatar, { backgroundColor: Colors.accent + "20" }]}>
                <ThemedText style={{ color: Colors.accent, fontWeight: "600" }}>
                  {client.firstName[0]}
                  {client.lastName[0]}
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
        </ScrollView>
      )}
    </GlassCard>
  );

  const renderStep2 = () => (
    <GlassCard style={styles.stepCard}>
      <ThemedText style={styles.stepTitle}>Select Service</ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        What type of service is this?
      </ThemedText>

      <View style={styles.categoryGrid}>
        {SERVICE_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            style={[
              styles.categoryOption,
              { backgroundColor: theme.cardBackground },
              selectedCategory === cat.id && {
                borderColor: Colors.accent,
                borderWidth: 2,
                backgroundColor: Colors.accent + "10",
              },
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <View
              style={[
                styles.categoryIcon,
                {
                  backgroundColor:
                    selectedCategory === cat.id ? Colors.accent : theme.separator,
                },
              ]}
            >
              <Feather
                name={cat.icon as any}
                size={20}
                color={selectedCategory === cat.id ? "#FFFFFF" : theme.textSecondary}
              />
            </View>
            <ThemedText
              style={{
                fontSize: 13,
                fontWeight: selectedCategory === cat.id ? "600" : "400",
              }}
            >
              {cat.name}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </GlassCard>
  );

  const renderStep3 = () => (
    <GlassCard style={styles.stepCard}>
      <ThemedText style={styles.stepTitle}>Job Details</ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Describe the work needed
      </ThemedText>

      <TextField
        label="Job Title"
        value={title}
        onChangeText={setTitle}
        placeholder={`e.g., ${selectedCategoryData?.name || "Service"} for ${
          selectedClient?.firstName || "client"
        }`}
      />

      {intakeQuestions.map((question, index) => (
        <TextField
          key={index}
          label={question}
          value={intakeAnswers[question] || ""}
          onChangeText={(text) =>
            setIntakeAnswers((prev) => ({ ...prev, [question]: text }))
          }
          placeholder="Your answer"
        />
      ))}

      <TextField
        label="Additional Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Any other details..."
        multiline
        numberOfLines={3}
      />
    </GlassCard>
  );

  const renderStep4 = () => (
    <GlassCard style={styles.stepCard}>
      <ThemedText style={styles.stepTitle}>Schedule</ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        When should this job be done?
      </ThemedText>

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

      <TextField
        label="Estimated Price (optional)"
        value={estimatedPrice}
        onChangeText={setEstimatedPrice}
        placeholder="$ 150.00"
        keyboardType="decimal-pad"
      />
    </GlassCard>
  );

  const renderStep5 = () => (
    <GlassCard style={styles.stepCard}>
      <ThemedText style={styles.stepTitle}>Review</ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Confirm job details before creating
      </ThemedText>

      <View style={styles.reviewSection}>
        <View style={styles.reviewRow}>
          <Feather name="user" size={16} color={theme.textSecondary} />
          <View style={styles.reviewContent}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Client
            </ThemedText>
            <ThemedText style={{ fontWeight: "600" }}>
              {selectedClient?.firstName} {selectedClient?.lastName}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.reviewDivider, { backgroundColor: theme.separator }]} />

        <View style={styles.reviewRow}>
          <Feather
            name={(selectedCategoryData?.icon as any) || "briefcase"}
            size={16}
            color={theme.textSecondary}
          />
          <View style={styles.reviewContent}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Service
            </ThemedText>
            <ThemedText style={{ fontWeight: "600" }}>
              {selectedCategoryData?.name || "Service"}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.reviewDivider, { backgroundColor: theme.separator }]} />

        <View style={styles.reviewRow}>
          <Feather name="file-text" size={16} color={theme.textSecondary} />
          <View style={styles.reviewContent}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Job Title
            </ThemedText>
            <ThemedText style={{ fontWeight: "600" }}>
              {title || `${selectedCategoryData?.name || "Service"} Job`}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.reviewDivider, { backgroundColor: theme.separator }]} />

        <View style={styles.reviewRow}>
          <Feather name="calendar" size={16} color={theme.textSecondary} />
          <View style={styles.reviewContent}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Scheduled
            </ThemedText>
            <ThemedText style={{ fontWeight: "600" }}>
              {scheduledDate}
              {scheduledTime ? ` at ${scheduledTime}` : ""}
            </ThemedText>
          </View>
        </View>

        {estimatedPrice ? (
          <>
            <View style={[styles.reviewDivider, { backgroundColor: theme.separator }]} />
            <View style={styles.reviewRow}>
              <Feather name="dollar-sign" size={16} color={theme.textSecondary} />
              <View style={styles.reviewContent}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Estimated Price
                </ThemedText>
                <ThemedText style={{ fontWeight: "600", color: Colors.accent }}>
                  ${estimatedPrice}
                </ThemedText>
              </View>
            </View>
          </>
        ) : null}
      </View>
    </GlassCard>
  );

  const stepLabels = ["Client", "Service", "Details", "Schedule", "Review"];

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
            paddingBottom: insets.bottom + Spacing.xl + 80,
            paddingHorizontal: Spacing.screenPadding,
          }}
          showsVerticalScrollIndicator={false}
        >
          {renderStepIndicator()}

          <View style={styles.stepLabelContainer}>
            <ThemedText style={[styles.stepLabel, { color: theme.textSecondary }]}>
              Step {step} of 5: {stepLabels[step - 1]}
            </ThemedText>
          </View>

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.backgroundRoot,
              paddingBottom: insets.bottom + Spacing.md,
              borderTopColor: theme.separator,
            },
          ]}
        >
          <SecondaryButton onPress={handleBack} style={{ flex: 1 }}>
            {step === 1 ? "Cancel" : "Back"}
          </SecondaryButton>

          {step < 5 ? (
            <PrimaryButton
              onPress={handleNext}
              disabled={!canProceed}
              style={{ flex: 1 }}
            >
              Next
            </PrimaryButton>
          ) : (
            <PrimaryButton
              onPress={handleSubmit}
              disabled={createMutation.isPending}
              style={{ flex: 1 }}
            >
              {createMutation.isPending ? "Creating..." : "Create Job"}
            </PrimaryButton>
          )}
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: {
    width: 32,
    height: 2,
    marginHorizontal: 4,
  },
  stepLabelContainer: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  stepCard: {
    marginBottom: Spacing.lg,
  },
  stepTitle: {
    ...Typography.title2,
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  addClientButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  clientList: {
    maxHeight: 300,
  },
  clientOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
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
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryOption: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewSection: {
    gap: Spacing.md,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  reviewContent: {
    flex: 1,
    gap: 2,
  },
  reviewDivider: {
    height: 1,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
});
