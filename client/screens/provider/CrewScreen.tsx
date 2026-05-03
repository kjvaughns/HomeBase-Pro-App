import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
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

interface CrewMember {
  id: string;
  providerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  color: string;
  invitedUserId: string | null;
  isActive: boolean;
  createdAt: string;
}

const CREW_COLOR_PALETTE = [
  "#38AE5F",
  "#6B7280",
  "#3B82F6",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#14B8A6",
  "#EC4899",
];

export default function CrewScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CrewMember | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState(CREW_COLOR_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ crew: CrewMember[] }>({
    queryKey: ["/api/provider", providerId, "crew"],
    enabled: !!providerId,
  });
  const crew = data?.crew || [];

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/provider", providerId, "crew"],
    });
  };

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      phone?: string;
      email?: string;
      color: string;
    }) =>
      apiRequest("POST", `/api/provider/${providerId}/crew`, payload).then((r) =>
        r.json(),
      ),
    onSuccess: () => {
      invalidate();
      closeEditor();
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      name: string;
      phone?: string | null;
      email?: string | null;
      color: string;
    }) =>
      apiRequest("PUT", `/api/crew/${payload.id}`, {
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        color: payload.color,
      }).then((r) => r.json()),
    onSuccess: () => {
      invalidate();
      closeEditor();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/crew/${id}`).then((r) => r.json()),
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      Alert.alert(
        "Cannot delete crew member",
        e.message.includes("assigned")
          ? "This crew member still has jobs assigned. Reassign or unassign those jobs first."
          : "Could not delete this crew member. Please try again.",
      );
    },
  });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setEmail("");
    setColor(CREW_COLOR_PALETTE[0]);
    setError(null);
    setEditorOpen(true);
  };

  const openEdit = (m: CrewMember) => {
    setEditing(m);
    setName(m.name);
    setPhone(m.phone ?? "");
    setEmail(m.email ?? "");
    setColor(m.color);
    setError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
    setError(null);
  };

  const handleSave = () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        name: trimmed,
        phone: phone.trim() || null,
        email: email.trim() || null,
        color,
      });
    } else {
      createMutation.mutate({
        name: trimmed,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        color,
      });
    }
  };

  const handleDelete = (m: CrewMember) => {
    Alert.alert(
      "Remove crew member?",
      `${m.name} will no longer appear on jobs you assign.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => deleteMutation.mutate(m.id),
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["3xl"],
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText
          style={[styles.helper, { color: theme.textSecondary }]}
        >
          Add the people who run jobs for your business. You can color-code each
          one and assign jobs to them on the schedule.
        </ThemedText>

        <Pressable
          style={[styles.addBtn, { backgroundColor: Colors.accent }]}
          onPress={openCreate}
          testID="button-add-crew"
        >
          <Feather name="plus" size={16} color="#FFFFFF" />
          <ThemedText style={styles.addBtnText}>Add Crew Member</ThemedText>
        </Pressable>

        {isLoading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.xl }} />
        ) : crew.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="users" size={28} color={theme.textTertiary} />
            <ThemedText
              style={[styles.emptyText, { color: theme.textSecondary }]}
            >
              No crew yet. Add yourself or your team to get started.
            </ThemedText>
          </View>
        ) : (
          crew.map((m) => (
            <GlassCard key={m.id} style={styles.row}>
              <View style={[styles.colorDot, { backgroundColor: m.color }]} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.rowName}>{m.name}</ThemedText>
                {m.phone || m.email ? (
                  <ThemedText
                    style={[styles.rowSub, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {[m.phone, m.email].filter(Boolean).join(" · ")}
                  </ThemedText>
                ) : null}
              </View>
              <Pressable
                onPress={() => openEdit(m)}
                hitSlop={10}
                style={styles.iconBtn}
                testID={`crew-edit-${m.id}`}
              >
                <Feather name="edit-2" size={16} color={theme.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => handleDelete(m)}
                hitSlop={10}
                style={styles.iconBtn}
                testID={`crew-delete-${m.id}`}
              >
                <Feather name="trash-2" size={16} color={Colors.error} />
              </Pressable>
            </GlassCard>
          ))
        )}
      </ScrollView>

      <Modal
        visible={editorOpen}
        transparent
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEditor} />
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.backgroundRoot,
                paddingBottom: Math.max(insets.bottom, Spacing.lg),
              },
            ]}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: theme.separator }]}
            />
            <ThemedText style={styles.sheetTitle}>
              {editing ? "Edit Crew Member" : "Add Crew Member"}
            </ThemedText>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
            >
              <TextField
                value={name}
                onChangeText={setName}
                placeholder="Name"
                autoCapitalize="words"
                testID="input-crew-name"
              />
              <TextField
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone (optional)"
                keyboardType="phone-pad"
              />
              <TextField
                value={email}
                onChangeText={setEmail}
                placeholder="Email (optional)"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <ThemedText
                style={[
                  styles.colorLabel,
                  { color: theme.textSecondary },
                ]}
              >
                Color
              </ThemedText>
              <View style={styles.colorRow}>
                {CREW_COLOR_PALETTE.map((c) => {
                  const active = c === color;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      style={[
                        styles.colorSwatch,
                        {
                          backgroundColor: c,
                          borderColor: active ? theme.text : "transparent",
                          borderWidth: active ? 2 : 0,
                        },
                      ]}
                      testID={`crew-color-${c}`}
                    />
                  );
                })}
              </View>

              {error ? (
                <ThemedText style={[styles.errorText, { color: Colors.error }]}>
                  {error}
                </ThemedText>
              ) : null}

              <View style={styles.sheetActions}>
                <SecondaryButton onPress={closeEditor} style={{ flex: 1 }}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton
                  onPress={handleSave}
                  loading={
                    createMutation.isPending || updateMutation.isPending
                  }
                  style={{ flex: 1 }}
                  testID="button-save-crew"
                >
                  {editing ? "Save" : "Add"}
                </PrimaryButton>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  helper: {
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    marginBottom: Spacing.lg,
  },
  addBtnText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  rowName: {
    ...Typography.body,
    fontWeight: "600",
  },
  rowSub: {
    ...Typography.caption,
    marginTop: 2,
  },
  iconBtn: {
    padding: 6,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    maxHeight: "80%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    ...Typography.h3,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  colorLabel: {
    ...Typography.caption,
    marginTop: Spacing.md,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: Spacing.md,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  errorText: {
    ...Typography.caption,
    marginTop: Spacing.sm,
  },
  sheetActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
});
