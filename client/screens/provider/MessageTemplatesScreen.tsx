import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { useAuthStore } from "@/state/authStore";

type Channel = "email" | "sms";

interface Template {
  id: string;
  name: string;
  channel: Channel;
  subject?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

const MERGE_HINTS = [
  "{{client_name}}", "{{provider_name}}", "{{service}}", "{{booking_date}}", "{{amount_due}}"
];

const DEFAULT_TEMPLATES = [
  { name: "Welcome", channel: "email" as Channel, subject: "Welcome, {{client_name}}!", body: "Hi {{client_name}},\n\nThank you for choosing {{provider_name}}. We are thrilled to work with you and look forward to providing excellent service.\n\nDon't hesitate to reach out with any questions.\n\nWarm regards,\n{{provider_name}}" },
  { name: "Appointment Reminder", channel: "email" as Channel, subject: "Reminder: {{service}} on {{booking_date}}", body: "Hi {{client_name}},\n\nThis is a friendly reminder that your {{service}} appointment is scheduled for {{booking_date}}.\n\nPlease let us know if you need to make any changes.\n\nSee you soon,\n{{provider_name}}" },
  { name: "On My Way", channel: "sms" as Channel, subject: null, body: "Hi {{client_name}}, this is {{provider_name}}. I'm on my way and will arrive shortly. See you soon!" },
  { name: "Follow-Up", channel: "email" as Channel, subject: "How did we do, {{client_name}}?", body: "Hi {{client_name}},\n\nThank you for choosing {{provider_name}} for your recent {{service}}. We hope everything went smoothly!\n\nIf you have a moment, we would love to hear your feedback.\n\nBest,\n{{provider_name}}" },
  { name: "Invoice Reminder", channel: "email" as Channel, subject: "Invoice Reminder - {{amount_due}} due", body: "Hi {{client_name}},\n\nThis is a friendly reminder that you have an outstanding invoice of {{amount_due}} from {{provider_name}}.\n\nPlease reach out if you have any questions.\n\nThank you,\n{{provider_name}}" },
];

export default function MessageTemplatesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formName, setFormName] = useState("");
  const [formChannel, setFormChannel] = useState<Channel>("email");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");

  const { data, isLoading, refetch } = useQuery<{ templates: Template[] }>({
    queryKey: ["/api/providers", providerId, "message-templates"],
    enabled: !!providerId,
    queryFn: async () => {
      const url = new URL(`/api/providers/${providerId}/message-templates`, getApiUrl());
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
      });
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
  });

  const templates = data?.templates || [];

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; channel: Channel; subject?: string; body: string }) => {
      const url = new URL(`/api/providers/${providerId}/message-templates`, getApiUrl());
      return apiRequest(url.toString(), {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers", providerId, "message-templates"] });
      setShowModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: any) => Alert.alert("Error", err.message || "Failed to create template"),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string; channel: Channel; subject?: string; body: string }) => {
      const url = new URL(`/api/providers/${providerId}/message-templates/${payload.id}`, getApiUrl());
      return apiRequest(url.toString(), {
        method: "PATCH",
        body: JSON.stringify({ name: payload.name, channel: payload.channel, subject: payload.subject, body: payload.body }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers", providerId, "message-templates"] });
      setShowModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: any) => Alert.alert("Error", err.message || "Failed to update template"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const url = new URL(`/api/providers/${providerId}/message-templates/${templateId}`, getApiUrl());
      return apiRequest(url.toString(), { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers", providerId, "message-templates"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    onError: (err: any) => Alert.alert("Error", err.message || "Failed to delete template"),
  });

  const openNew = (preset?: typeof DEFAULT_TEMPLATES[0]) => {
    setEditingTemplate(null);
    setFormName(preset?.name || "");
    setFormChannel(preset?.channel || "email");
    setFormSubject(preset?.subject || "");
    setFormBody(preset?.body || "");
    setShowModal(true);
  };

  const openEdit = (t: Template) => {
    setEditingTemplate(t);
    setFormName(t.name);
    setFormChannel(t.channel);
    setFormSubject(t.subject || "");
    setFormBody(t.body);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formName.trim() || !formBody.trim()) {
      Alert.alert("Error", "Name and body are required");
      return;
    }
    const payload = {
      name: formName.trim(),
      channel: formChannel,
      subject: formSubject.trim() || undefined,
      body: formBody.trim(),
    };
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (t: Template) => {
    Alert.alert(
      "Delete Template",
      `Are you sure you want to delete "${t.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(t.id) },
      ]
    );
  };

  const insertHint = (hint: string) => {
    setFormBody((prev) => prev + hint);
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
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.headerRow}>
            <View>
              <ThemedText type="h2">Message Templates</ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 2 }}>
                {templates.length} saved template{templates.length !== 1 ? "s" : ""}
              </ThemedText>
            </View>
            <Pressable
              style={[styles.addButton, { backgroundColor: Colors.accent }]}
              onPress={() => openNew()}
              testID="add-template-button"
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </Animated.View>

        {templates.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <GlassCard style={styles.emptyCard}>
              <Feather name="layers" size={32} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginTop: Spacing.md, textAlign: "center", fontWeight: "600" }}>
                No templates yet
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}>
                Create templates to quickly send professional messages to your clients.
              </ThemedText>
            </GlassCard>

            <ThemedText type="label" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              QUICK START TEMPLATES
            </ThemedText>
            {DEFAULT_TEMPLATES.map((preset, i) => (
              <Animated.View key={preset.name} entering={FadeInDown.delay(300 + i * 60).duration(300)}>
                <Pressable onPress={() => openNew(preset)}>
                  <GlassCard style={styles.presetCard}>
                    <View style={styles.presetHeader}>
                      <ThemedText type="body" style={{ fontWeight: "600", flex: 1 }}>{preset.name}</ThemedText>
                      <View style={[styles.channelTag, { backgroundColor: Colors.accent + "20" }]}>
                        <ThemedText type="caption" style={{ color: Colors.accent, textTransform: "uppercase" }}>
                          {preset.channel}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }} numberOfLines={2}>
                      {preset.body}
                    </ThemedText>
                    <View style={styles.useRow}>
                      <Feather name="plus-circle" size={14} color={Colors.accent} />
                      <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: 4 }}>
                        Use this template
                      </ThemedText>
                    </View>
                  </GlassCard>
                </Pressable>
              </Animated.View>
            ))}
          </Animated.View>
        ) : (
          <>
            {templates.map((t, i) => (
              <Animated.View key={t.id} entering={FadeInDown.delay(i * 50).duration(300)}>
                <GlassCard style={styles.templateCard}>
                  <View style={styles.templateHeader}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>{t.name}</ThemedText>
                      <View style={[styles.channelTag, { backgroundColor: Colors.accent + "20", alignSelf: "flex-start", marginTop: 4 }]}>
                        <ThemedText type="caption" style={{ color: Colors.accent, textTransform: "uppercase" }}>
                          {t.channel}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.templateActions}>
                      <Pressable
                        style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]}
                        onPress={() => openEdit(t)}
                        testID={`edit-template-${t.id}`}
                      >
                        <Feather name="edit-2" size={14} color={theme.text} />
                      </Pressable>
                      <Pressable
                        style={[styles.actionBtn, { backgroundColor: "#EF444420" }]}
                        onPress={() => handleDelete(t)}
                        testID={`delete-template-${t.id}`}
                      >
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>
                  {t.subject ? (
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                      Subject: {t.subject}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }} numberOfLines={3}>
                    {t.body}
                  </ThemedText>
                </GlassCard>
              </Animated.View>
            ))}

            <Pressable
              style={[styles.addMoreButton, { backgroundColor: theme.cardBackground }]}
              onPress={() => openNew()}
            >
              <Feather name="plus" size={16} color={Colors.accent} />
              <ThemedText type="body" style={{ color: Colors.accent, marginLeft: Spacing.sm }}>
                Add Another Template
              </ThemedText>
            </Pressable>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <ThemedView style={styles.modal}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            <ScrollView
              contentContainerStyle={{
                padding: Spacing.screenPadding,
                paddingTop: Spacing.xl,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <ThemedText type="h2">{editingTemplate ? "Edit Template" : "New Template"}</ThemedText>
                <Pressable onPress={() => setShowModal(false)} style={styles.closeButton}>
                  <Feather name="x" size={22} color={theme.text} />
                </Pressable>
              </View>

              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.lg }}>
                TEMPLATE NAME
              </ThemedText>
              <View style={[styles.textField, { backgroundColor: theme.cardBackground }]}>
                <TextInput
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder="e.g. Welcome, Reminder, Follow-Up..."
                  placeholderTextColor={theme.textSecondary}
                  value={formName}
                  onChangeText={setFormName}
                  testID="template-name-input"
                />
              </View>

              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.md }}>
                CHANNEL
              </ThemedText>
              <View style={styles.channelRow}>
                <Pressable
                  style={[
                    styles.channelButton,
                    { borderColor: formChannel === "email" ? Colors.accent : theme.separator },
                    formChannel === "email" && { backgroundColor: Colors.accent + "15" },
                  ]}
                  onPress={() => setFormChannel("email")}
                >
                  <Feather name="mail" size={16} color={formChannel === "email" ? Colors.accent : theme.textSecondary} />
                  <ThemedText type="body" style={{ marginLeft: Spacing.xs, color: formChannel === "email" ? Colors.accent : theme.text }}>
                    Email
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.channelButton,
                    { borderColor: formChannel === "sms" ? Colors.accent : theme.separator },
                    formChannel === "sms" && { backgroundColor: Colors.accent + "15" },
                  ]}
                  onPress={() => setFormChannel("sms")}
                >
                  <Feather name="message-square" size={16} color={formChannel === "sms" ? Colors.accent : theme.textSecondary} />
                  <ThemedText type="body" style={{ marginLeft: Spacing.xs, color: formChannel === "sms" ? Colors.accent : theme.text }}>
                    SMS
                  </ThemedText>
                </Pressable>
              </View>

              {formChannel === "email" ? (
                <>
                  <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.md }}>
                    SUBJECT (OPTIONAL)
                  </ThemedText>
                  <View style={[styles.textField, { backgroundColor: theme.cardBackground }]}>
                    <TextInput
                      style={[styles.textInput, { color: theme.text }]}
                      placeholder="Email subject..."
                      placeholderTextColor={theme.textSecondary}
                      value={formSubject}
                      onChangeText={setFormSubject}
                      testID="template-subject-input"
                    />
                  </View>
                </>
              ) : null}

              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.md }}>
                MESSAGE BODY
              </ThemedText>
              <View style={[styles.textField, { backgroundColor: theme.cardBackground }]}>
                <TextInput
                  style={[styles.textInput, { color: theme.text, minHeight: 140 }]}
                  placeholder="Write your template message..."
                  placeholderTextColor={theme.textSecondary}
                  value={formBody}
                  onChangeText={setFormBody}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  testID="template-body-input"
                />
              </View>

              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.md }}>
                MERGE VARIABLES (TAP TO INSERT)
              </ThemedText>
              <View style={styles.mergeRow}>
                {MERGE_HINTS.map((hint) => (
                  <Pressable
                    key={hint}
                    style={[styles.mergeChip, { backgroundColor: Colors.accent + "15" }]}
                    onPress={() => insertHint(hint)}
                  >
                    <ThemedText type="caption" style={{ color: Colors.accent }}>
                      {hint}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <PrimaryButton
                label={
                  createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingTemplate
                    ? "Save Changes"
                    : "Create Template"
                }
                onPress={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                style={{ marginTop: Spacing.xl }}
                testID="save-template-button"
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  presetCard: {
    marginBottom: Spacing.sm,
  },
  presetHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  useRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  templateCard: {
    marginBottom: Spacing.sm,
  },
  templateHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  templateActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  channelTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  addMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    marginTop: Spacing.md,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: {
    padding: Spacing.sm,
  },
  textField: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  textInput: {
    fontSize: 15,
  },
  channelRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  channelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  mergeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  mergeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
});
