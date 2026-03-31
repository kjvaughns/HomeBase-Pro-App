import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type Channel = "email" | "sms";

const MERGE_VARIABLES = [
  { key: "{{client_name}}", label: "Client Name" },
  { key: "{{provider_name}}", label: "Your Business Name" },
  { key: "{{service}}", label: "Service" },
  { key: "{{booking_date}}", label: "Booking Date" },
  { key: "{{amount_due}}", label: "Amount Due" },
];

interface Template {
  id: string;
  name: string;
  channel: Channel;
  subject?: string;
  body: string;
}

export default function SendMessageScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "SendMessage">>();
  const { clientId, clientName, clientEmail, jobId, invoiceId } = route.params;
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;
  const queryClient = useQueryClient();

  const [channel, setChannel] = useState<Channel>(clientEmail ? "email" : "sms");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [bodySelection, setBodySelection] = useState({ start: 0, end: 0 });

  const { data: templatesData } = useQuery<{ templates: Template[] }>({
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

  const templates = templatesData?.templates || [];

  const sendMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/providers/${providerId}/messages`, getApiUrl());
      return apiRequest(url.toString(), {
        method: "POST",
        body: JSON.stringify({ clientId, channel, subject, body, jobId, invoiceId }),
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/providers", providerId, "clients", clientId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/providers", providerId, "clients", "last-messages"] });
      navigation.goBack();
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to send message");
    },
  });

  const handleSend = () => {
    if (!body.trim()) {
      Alert.alert("Error", "Please enter a message body");
      return;
    }
    if (channel === "email" && !clientEmail) {
      Alert.alert("No Email", "This client does not have an email address on file.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendMutation.mutate();
  };

  const insertMergeVar = (key: string) => {
    const before = body.slice(0, bodySelection.start);
    const after = body.slice(bodySelection.end);
    setBody(before + key + after);
  };

  const applyTemplate = (template: Template) => {
    setChannel(template.channel);
    setSubject(template.subject || "");
    setBody(template.body);
    setShowTemplates(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const smsCharCount = body.length;
  const smsParts = Math.ceil(smsCharCount / 160) || 1;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <GlassCard style={styles.recipientCard}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>TO</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600", marginTop: 2 }}>
              {clientName}
            </ThemedText>
            {clientEmail ? (
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                {clientEmail}
              </ThemedText>
            ) : null}
          </GlassCard>

          <GlassCard style={styles.channelCard}>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              CHANNEL
            </ThemedText>
            <View style={styles.channelRow}>
              <Pressable
                style={[
                  styles.channelButton,
                  { borderColor: channel === "email" ? Colors.accent : theme.separator },
                  channel === "email" && { backgroundColor: Colors.accent + "15" },
                ]}
                onPress={() => setChannel("email")}
                testID="channel-email"
              >
                <Feather name="mail" size={16} color={channel === "email" ? Colors.accent : theme.textSecondary} />
                <ThemedText
                  type="body"
                  style={{ marginLeft: Spacing.xs, color: channel === "email" ? Colors.accent : theme.text, fontWeight: channel === "email" ? "600" : "400" }}
                >
                  Email
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.channelButton,
                  { borderColor: channel === "sms" ? Colors.accent : theme.separator },
                  channel === "sms" && { backgroundColor: Colors.accent + "15" },
                ]}
                onPress={() => setChannel("sms")}
                testID="channel-sms"
              >
                <Feather name="message-square" size={16} color={channel === "sms" ? Colors.accent : theme.textSecondary} />
                <ThemedText
                  type="body"
                  style={{ marginLeft: Spacing.xs, color: channel === "sms" ? Colors.accent : theme.text, fontWeight: channel === "sms" ? "600" : "400" }}
                >
                  SMS
                </ThemedText>
              </Pressable>
            </View>
            {channel === "sms" ? (
              <View style={[styles.smsBadge, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="info" size={12} color={theme.textSecondary} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                  SMS delivery pending until provider is configured
                </ThemedText>
              </View>
            ) : null}
          </GlassCard>

          {templates.length > 0 ? (
            <Pressable
              style={[styles.templateButton, { backgroundColor: theme.cardBackground }]}
              onPress={() => setShowTemplates(!showTemplates)}
              testID="template-picker"
            >
              <Feather name="layers" size={16} color={Colors.accent} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: Colors.accent, flex: 1 }}>
                Use Template
              </ThemedText>
              <Feather name={showTemplates ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}

          {showTemplates ? (
            <GlassCard style={styles.templatesDropdown}>
              {templates.map((t) => (
                <Pressable
                  key={t.id}
                  style={[styles.templateRow, { borderBottomColor: theme.separator }]}
                  onPress={() => applyTemplate(t)}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>{t.name}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
                      {t.body}
                    </ThemedText>
                  </View>
                  <View style={[styles.channelTag, { backgroundColor: Colors.accent + "20" }]}>
                    <ThemedText type="caption" style={{ color: Colors.accent, textTransform: "uppercase" }}>
                      {t.channel}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </GlassCard>
          ) : null}

          {channel === "email" ? (
            <GlassCard style={styles.inputCard}>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                SUBJECT
              </ThemedText>
              <TextInput
                style={[styles.subjectInput, { color: theme.text }]}
                placeholder="Message subject..."
                placeholderTextColor={theme.textSecondary}
                value={subject}
                onChangeText={setSubject}
                testID="subject-input"
              />
            </GlassCard>
          ) : null}

          <GlassCard style={styles.inputCard}>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
              MESSAGE
            </ThemedText>
            <TextInput
              style={[styles.bodyInput, { color: theme.text }]}
              placeholder="Write your message..."
              placeholderTextColor={theme.textSecondary}
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              onSelectionChange={(e) => setBodySelection(e.nativeEvent.selection)}
              testID="body-input"
            />
            {channel === "sms" ? (
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "right" }}>
                {smsCharCount} chars ({smsParts} {smsParts === 1 ? "part" : "parts"})
              </ThemedText>
            ) : null}
          </GlassCard>

          <GlassCard style={styles.mergeVarsCard}>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              INSERT MERGE VARIABLE
            </ThemedText>
            <View style={styles.mergeVarsRow}>
              {MERGE_VARIABLES.map((v) => (
                <Pressable
                  key={v.key}
                  style={[styles.mergeVarChip, { backgroundColor: Colors.accent + "15" }]}
                  onPress={() => insertMergeVar(v.key)}
                >
                  <ThemedText type="caption" style={{ color: Colors.accent }}>
                    {v.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </GlassCard>

          <PrimaryButton
            label={sendMutation.isPending ? "Sending..." : `Send via ${channel === "email" ? "Email" : "SMS"}`}
            onPress={handleSend}
            disabled={sendMutation.isPending || !body.trim()}
            testID="send-button"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  recipientCard: {
    marginBottom: Spacing.md,
  },
  channelCard: {
    marginBottom: Spacing.md,
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
  smsBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  templateButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.card,
    marginBottom: Spacing.md,
  },
  templatesDropdown: {
    marginBottom: Spacing.md,
    padding: 0,
    overflow: "hidden",
  },
  templateRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  channelTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
  inputCard: {
    marginBottom: Spacing.md,
  },
  subjectInput: {
    fontSize: 15,
    paddingVertical: Spacing.xs,
  },
  bodyInput: {
    fontSize: 15,
    minHeight: 160,
    paddingTop: Spacing.xs,
  },
  mergeVarsCard: {
    marginBottom: Spacing.xl,
  },
  mergeVarsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  mergeVarChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
});
