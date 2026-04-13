import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { useAuthStore } from "@/state/authStore";

type Channel = "push" | "email";
type Mode = "individual" | "broadcast";

interface Client {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

interface BroadcastResult {
  success: boolean;
  totalClients: number;
  emailSent: number;
  emailFailed: number;
  pushSent: number;
  pushFailed: number;
}

function SuccessBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const { theme } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[styles.successBanner, { backgroundColor: Colors.success + "20", borderColor: Colors.success + "40" }]}
    >
      <Feather name="check-circle" size={18} color={Colors.success} />
      <ThemedText type="body" style={{ color: Colors.success, flex: 1, marginLeft: Spacing.sm }}>
        {message}
      </ThemedText>
      <Pressable onPress={onDismiss}>
        <Feather name="x" size={16} color={Colors.success} />
      </Pressable>
    </Animated.View>
  );
}

export default function CommunicationsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;

  const [modeIndex, setModeIndex] = useState(0);
  const mode: Mode = modeIndex === 0 ? "individual" : "broadcast";

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<Set<Channel>>(new Set(["email"]));

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const [showBroadcastConfirm, setShowBroadcastConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/providers", providerId, "clients"],
    enabled: !!providerId,
    queryFn: async () => {
      const url = new URL(`/api/providers/${providerId}/clients`, getApiUrl());
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${useAuthStore.getState().sessionToken}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load clients");
      return res.json();
    },
  });

  const allClients = clientsData?.clients || [];

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return allClients;
    return allClients.filter((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ").toLowerCase();
      const email = (c.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [allClients, clientSearch]);

  const individualMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/providers/${providerId}/communicate/individual`, {
        clientId: selectedClient!.id,
        subject: subject.trim() || undefined,
        body: body.trim(),
        channels: Array.from(channels),
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessMessage(`Message sent to ${[selectedClient!.firstName, selectedClient!.lastName].filter(Boolean).join(" ")}.`);
      setSubject("");
      setBody("");
      setSelectedClient(null);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const broadcastMutation = useMutation<BroadcastResult>({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/providers/${providerId}/communicate/broadcast`, {
        subject: subject.trim() || undefined,
        body: body.trim(),
        channels: Array.from(channels),
      });
      return res.json() as Promise<BroadcastResult>;
    },
    onSuccess: (data: BroadcastResult) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowBroadcastConfirm(false);
      const total = data?.totalClients ?? allClients.length;
      setSuccessMessage(`Broadcast sent to ${total} client${total !== 1 ? "s" : ""}.`);
      setSubject("");
      setBody("");
    },
    onError: () => {
      setShowBroadcastConfirm(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const toggleChannel = (ch: Channel) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) {
        if (next.size > 1) next.delete(ch);
      } else {
        next.add(ch);
      }
      return next;
    });
  };

  const canSend =
    body.trim().length > 0 &&
    channels.size > 0 &&
    (mode === "broadcast" || selectedClient !== null);

  const handleSend = () => {
    if (mode === "individual") {
      individualMutation.mutate();
    } else {
      setShowBroadcastConfirm(true);
    }
  };

  const isPending = individualMutation.isPending || broadcastMutation.isPending;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {successMessage ? (
          <SuccessBanner message={successMessage} onDismiss={() => setSuccessMessage(null)} />
        ) : null}

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <ThemedText type="h2" style={{ marginBottom: Spacing.xs }}>Communications</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
            Send push notifications and emails to your clients.
          </ThemedText>

          <View style={[styles.segmentedControl, { backgroundColor: theme.cardBackground }]} testID="mode-segment">
            {(["Individual", "Broadcast"] as const).map((label, idx) => (
              <Pressable
                key={label}
                style={[
                  styles.segmentItem,
                  modeIndex === idx && { backgroundColor: Colors.accent, borderRadius: BorderRadius.card - 2 },
                ]}
                onPress={() => { setModeIndex(idx); setSuccessMessage(null); }}
                testID={`mode-${label.toLowerCase()}`}
              >
                <ThemedText
                  type="body"
                  style={{ color: modeIndex === idx ? "#fff" : theme.textSecondary, fontWeight: modeIndex === idx ? "600" : "400" }}
                >
                  {label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          {mode === "individual" ? (
            <>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                RECIPIENT
              </ThemedText>
              <Pressable
                onPress={() => setShowClientPicker(true)}
                style={[styles.recipientButton, { backgroundColor: theme.cardBackground, borderColor: theme.separator }]}
                testID="select-client-button"
              >
                {selectedClient ? (
                  <View style={styles.selectedClientRow}>
                    <Avatar
                      uri={selectedClient.avatarUrl}
                      name={[selectedClient.firstName, selectedClient.lastName].filter(Boolean).join(" ")}
                      size="small"
                    />
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {[selectedClient.firstName, selectedClient.lastName].filter(Boolean).join(" ")}
                      </ThemedText>
                      {selectedClient.email ? (
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                          {selectedClient.email}
                        </ThemedText>
                      ) : null}
                    </View>
                    <Feather name="chevron-down" size={18} color={theme.textSecondary} />
                  </View>
                ) : (
                  <View style={styles.selectedClientRow}>
                    <View style={[styles.clientPlaceholderIcon, { backgroundColor: Colors.accent + "20" }]}>
                      <Feather name="user" size={16} color={Colors.accent} />
                    </View>
                    <ThemedText type="body" style={{ color: theme.textSecondary, flex: 1, marginLeft: Spacing.sm }}>
                      Select a client...
                    </ThemedText>
                    <Feather name="chevron-down" size={18} color={theme.textSecondary} />
                  </View>
                )}
              </Pressable>
            </>
          ) : (
            <GlassCard style={[styles.broadcastPreview]}>
              <View style={styles.broadcastIconRow}>
                <View style={[styles.broadcastIcon, { backgroundColor: Colors.accent + "20" }]}>
                  <Feather name="users" size={20} color={Colors.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    Broadcast to All Clients
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                    {allClients.length} client{allClients.length !== 1 ? "s" : ""} will receive this message
                  </ThemedText>
                </View>
              </View>
            </GlassCard>
          )}

          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.lg }}>
            CHANNEL
          </ThemedText>
          <View style={styles.channelRow}>
            {(["push", "email"] as Channel[]).map((ch) => {
              const active = channels.has(ch);
              const icon = ch === "push" ? "bell" : "mail";
              const label = ch === "push" ? "Push Notification" : "Email";
              return (
                <Pressable
                  key={ch}
                  style={[
                    styles.channelChip,
                    {
                      borderColor: active ? Colors.accent : theme.separator,
                      backgroundColor: active ? Colors.accent + "15" : theme.cardBackground,
                    },
                  ]}
                  onPress={() => toggleChannel(ch)}
                  testID={`channel-${ch}`}
                >
                  <Feather name={icon} size={15} color={active ? Colors.accent : theme.textSecondary} />
                  <ThemedText
                    type="body"
                    style={{ marginLeft: 6, flex: 1, color: active ? Colors.accent : theme.text, fontWeight: active ? "600" : "400" }}
                  >
                    {label}
                  </ThemedText>
                  {active ? (
                    <View style={[styles.checkDot, { backgroundColor: Colors.accent }]}>
                      <Feather name="check" size={9} color="#fff" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.lg }}>
            SUBJECT (OPTIONAL)
          </ThemedText>
          <View style={[styles.textField, { backgroundColor: theme.cardBackground }]}>
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="e.g. Special offer for clients..."
              placeholderTextColor={theme.textSecondary}
              value={subject}
              onChangeText={setSubject}
              testID="subject-input"
            />
          </View>

          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.md }}>
            MESSAGE
          </ThemedText>
          <View style={[styles.textField, { backgroundColor: theme.cardBackground }]}>
            <TextInput
              style={[styles.textInput, { color: theme.text, minHeight: 140 }]}
              placeholder="Write your message here..."
              placeholderTextColor={theme.textSecondary}
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              testID="body-input"
            />
          </View>

          <PrimaryButton
            onPress={handleSend}
            disabled={!canSend || isPending}
            style={{ marginTop: Spacing.xl }}
            testID="send-button"
          >
            {isPending ? "Sending..." : mode === "individual" ? "Send Message" : "Send to All Clients"}
          </PrimaryButton>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showClientPicker}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowClientPicker(false)}
      >
        <ThemedView style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <ThemedText type="h2">Select Client</ThemedText>
            <Pressable onPress={() => setShowClientPicker(false)} style={styles.closeButton}>
              <Feather name="x" size={22} color={theme.text} />
            </Pressable>
          </View>

          <View style={[styles.searchBar, { backgroundColor: theme.cardBackground }]}>
            <Feather name="search" size={16} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search clients..."
              placeholderTextColor={theme.textSecondary}
              value={clientSearch}
              onChangeText={setClientSearch}
              autoFocus
              testID="client-search-input"
            />
          </View>

          {filteredClients.length === 0 ? (
            <View style={styles.emptyPicker}>
              <Feather name="users" size={32} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                No clients found
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={filteredClients}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: Spacing.screenPadding, paddingBottom: insets.bottom + Spacing.xl }}
              renderItem={({ item }) => {
                const name = [item.firstName, item.lastName].filter(Boolean).join(" ");
                const isSelected = selectedClient?.id === item.id;
                return (
                  <Pressable
                    style={[
                      styles.clientRow,
                      {
                        backgroundColor: isSelected ? Colors.accent + "10" : theme.cardBackground,
                        borderColor: isSelected ? Colors.accent + "40" : theme.separator,
                      },
                    ]}
                    onPress={() => {
                      setSelectedClient(item);
                      setClientSearch("");
                      setShowClientPicker(false);
                    }}
                    testID={`client-${item.id}`}
                  >
                    <Avatar uri={item.avatarUrl} name={name} size="small" />
                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>{name}</ThemedText>
                      {item.email ? (
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>{item.email}</ThemedText>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <Feather name="check-circle" size={18} color={Colors.accent} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          )}
        </ThemedView>
      </Modal>

      <Modal
        visible={showBroadcastConfirm}
        animationType="fade"
        transparent
        onRequestClose={() => setShowBroadcastConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmDialog, { backgroundColor: theme.background }]}>
            <View style={[styles.confirmIconWrap, { backgroundColor: Colors.accent + "20" }]}>
              <Feather name="send" size={24} color={Colors.accent} />
            </View>
            <ThemedText type="h2" style={{ textAlign: "center", marginTop: Spacing.md }}>
              Confirm Broadcast
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm, marginBottom: Spacing.xl }}>
              This will send your message to{" "}
              <ThemedText type="body" style={{ fontWeight: "700", color: theme.text }}>
                {allClients.length} client{allClients.length !== 1 ? "s" : ""}
              </ThemedText>
              {" "}via {Array.from(channels).map((ch) => ch === "push" ? "push notification" : "email").join(" and ")}.
            </ThemedText>

            {broadcastMutation.isPending ? (
              <ActivityIndicator color={Colors.accent} />
            ) : (
              <View style={styles.confirmButtons}>
                <Pressable
                  style={[styles.confirmBtn, { backgroundColor: theme.cardBackground }]}
                  onPress={() => setShowBroadcastConfirm(false)}
                  testID="broadcast-cancel-button"
                >
                  <ThemedText type="body" style={{ fontWeight: "600" }}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.confirmBtn, { backgroundColor: Colors.accent }]}
                  onPress={() => broadcastMutation.mutate()}
                  testID="broadcast-confirm-button"
                >
                  <ThemedText type="body" style={{ color: "#fff", fontWeight: "600" }}>Send Now</ThemedText>
                </Pressable>
              </View>
            )}
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
  segmentedControl: {
    flexDirection: "row",
    borderRadius: BorderRadius.card,
    padding: 3,
    marginBottom: Spacing.xl,
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  recipientButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
  },
  selectedClientRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  clientPlaceholderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  broadcastPreview: {
    marginBottom: 0,
  },
  broadcastIconRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  broadcastIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  channelRow: {
    gap: Spacing.sm,
  },
  channelChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: 2,
  },
  checkDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  textField: {
    borderRadius: BorderRadius.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  textInput: {
    fontSize: 15,
    lineHeight: 22,
  },
  pickerModal: {
    flex: 1,
    paddingTop: Spacing.xl,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.lg,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  emptyPicker: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.screenPadding,
  },
  confirmDialog: {
    width: "100%",
    borderRadius: BorderRadius.card * 1.5,
    padding: Spacing.xl,
    alignItems: "center",
  },
  confirmIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  confirmBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.card,
  },
});
