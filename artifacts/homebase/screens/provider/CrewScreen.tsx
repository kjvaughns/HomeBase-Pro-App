import React, { useLayoutEffect, useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { Spacing, Typography, Colors, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
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
  "#3B82F6",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#6B7280",
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function CrewScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const navigation = useNavigation();
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

  const openCreate = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setEmail("");
    setColor(CREW_COLOR_PALETTE[0]);
    setError(null);
    setEditorOpen(true);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={openCreate}
          hitSlop={12}
          style={styles.headerBtn}
          testID="button-add-crew"
        >
          <Feather name="plus" size={22} color={Colors.accent} />
        </Pressable>
      ),
    });
  }, [navigation]);

  const { data, isLoading } = useQuery<{ crew: CrewMember[] }>({
    queryKey: ["/api/provider", providerId, "crew"],
    enabled: !!providerId,
  });
  const crew = data?.crew ?? [];

  const { data: timeData } = useQuery<{
    timeEntries: { crewMemberId: string; clockInAt: string; clockOutAt: string | null }[];
  }>({
    queryKey: ["/api/provider", providerId, "time-entries"],
    enabled: !!providerId,
  });
  const hoursByCrewMember = (timeData?.timeEntries ?? []).reduce<Record<string, number>>((acc, entry) => {
    const end = entry.clockOutAt ? new Date(entry.clockOutAt).getTime() : Date.now();
    const ms = end - new Date(entry.clockInAt).getTime();
    acc[entry.crewMemberId] = (acc[entry.crewMemberId] ?? 0) + ms;
    return acc;
  }, {});

  const formatTotalHours = (ms: number): string => {
    const totalMinutes = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "crew"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; phone?: string; email?: string; color: string }) =>
      apiRequest("POST", `/api/provider/${providerId}/crew`, payload).then((r) => r.json()),
    onSuccess: () => { invalidate(); closeEditor(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; name: string; phone?: string | null; email?: string | null; color: string }) =>
      apiRequest("PUT", `/api/crew/${payload.id}`, {
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        color: payload.color,
      }).then((r) => r.json()),
    onSuccess: () => { invalidate(); closeEditor(); },
    onError: (e: Error) => setError(e.message),
  });

  const inviteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/crew/${id}/invite`).then((r) => r.json()),
    onSuccess: () => {
      invalidate();
      Alert.alert("Invite sent", "We emailed your crew member a sign-up link.");
    },
    onError: (e: Error) =>
      Alert.alert("Could not send invite", e.message || "Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/crew/${id}`).then((r) => r.json()),
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      Alert.alert(
        "Cannot remove crew member",
        e.message.includes("assigned")
          ? "This person is still assigned to jobs. Reassign those jobs first."
          : "Could not remove this crew member. Please try again.",
      );
    },
  });

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
    if (!trimmed) { setError("Name is required"); return; }
    if (editing) {
      updateMutation.mutate({ id: editing.id, name: trimmed, phone: phone.trim() || null, email: email.trim() || null, color });
    } else {
      createMutation.mutate({ name: trimmed, phone: phone.trim() || undefined, email: email.trim() || undefined, color });
    }
  };

  const handleDelete = (m: CrewMember) => {
    Alert.alert(
      "Remove crew member?",
      `${m.name} will be removed from your roster and unassigned from future jobs.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => deleteMutation.mutate(m.id) },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing["3xl"], paddingHorizontal: horizontalPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : crew.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: Colors.accentLight }]}>
              <Feather name="users" size={32} color={Colors.accent} />
            </View>
            <ThemedText style={styles.emptyTitle}>No crew yet</ThemedText>
            <ThemedText style={[styles.emptyBody, { color: theme.textSecondary }]}>
              Add team members so you can assign them to jobs and track who's doing what.
            </ThemedText>
            <Pressable
              style={[styles.emptyAddBtn, { backgroundColor: Colors.accent }]}
              onPress={openCreate}
              testID="button-add-crew-empty"
            >
              <Feather name="plus" size={16} color="#FFF" />
              <ThemedText style={styles.emptyAddBtnText}>Add crew member</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {crew.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => openEdit(m)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: theme.cardBackground, borderLeftColor: m.color, opacity: pressed ? 0.85 : 1 },
                ]}
                testID={`crew-card-${m.id}`}
              >
                <View style={[styles.avatar, { backgroundColor: m.color + "22" }]}>
                  <ThemedText style={[styles.avatarText, { color: m.color }]}>
                    {getInitials(m.name)}
                  </ThemedText>
                </View>

                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <ThemedText style={styles.name}>{m.name}</ThemedText>
                    {m.invitedUserId ? (
                      <View style={[styles.badge, { backgroundColor: Colors.accentLight }]}>
                        <Feather name="check" size={10} color={Colors.accent} />
                        <ThemedText style={[styles.badgeText, { color: Colors.accent }]}>Linked</ThemedText>
                      </View>
                    ) : null}
                  </View>
                  {(m.phone ?? m.email) ? (
                    <ThemedText style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
                      {[m.phone, m.email].filter(Boolean).join("  ·  ")}
                    </ThemedText>
                  ) : null}
                  {hoursByCrewMember[m.id] ? (
                    <View style={styles.hoursRow}>
                      <Feather name="clock" size={11} color={theme.textTertiary} />
                      <ThemedText style={[styles.hoursText, { color: theme.textTertiary }]}>
                        {formatTotalHours(hoursByCrewMember[m.id])} logged
                      </ThemedText>
                    </View>
                  ) : null}
                </View>

                <View style={styles.actions}>
                  {m.email && !m.invitedUserId ? (
                    <Pressable
                      onPress={() => inviteMutation.mutate(m.id)}
                      hitSlop={8}
                      style={[styles.inviteBtn, { borderColor: Colors.accent }]}
                      disabled={inviteMutation.isPending}
                      testID={`crew-invite-${m.id}`}
                    >
                      <ThemedText style={[styles.inviteBtnText, { color: Colors.accent }]}>Invite</ThemedText>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => handleDelete(m)}
                    hitSlop={8}
                    style={styles.iconBtn}
                    testID={`crew-delete-${m.id}`}
                  >
                    <Feather name="trash-2" size={15} color={theme.textTertiary} />
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={editorOpen}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={closeEditor}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEditor} />
          <View style={[styles.sheet, { backgroundColor: theme.backgroundRoot, paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
            <View style={[styles.handle, { backgroundColor: theme.separator }]} />

            <ThemedText style={styles.sheetTitle}>
              {editing ? "Edit crew member" : "Add crew member"}
            </ThemedText>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>NAME</ThemedText>
                <TextField
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                  autoCapitalize="words"
                  testID="input-crew-name"
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>PHONE</ThemedText>
                <TextField
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Optional"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>EMAIL</ThemedText>
                <TextField
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Optional — used for sending an invite"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>COLOR</ThemedText>
                <View style={styles.palette}>
                  {CREW_COLOR_PALETTE.map((c) => {
                    const active = c === color;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setColor(c)}
                        style={[
                          styles.swatch,
                          { backgroundColor: c },
                          active && styles.swatchActive,
                        ]}
                        testID={`crew-color-${c}`}
                      >
                        {active ? <Feather name="check" size={14} color="#FFF" /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {error ? (
                <ThemedText style={[styles.errorText, { color: Colors.error }]}>{error}</ThemedText>
              ) : null}

              <View style={styles.sheetBtns}>
                <SecondaryButton onPress={closeEditor} style={{ flex: 1 }}>Cancel</SecondaryButton>
                <PrimaryButton
                  onPress={handleSave}
                  loading={createMutation.isPending || updateMutation.isPending}
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
  scroll: {},
  center: { paddingTop: Spacing["3xl"], alignItems: "center" },
  headerBtn: { paddingHorizontal: Spacing.sm },

  emptyState: {
    alignItems: "center",
    paddingTop: Spacing["2xl"],
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.h3,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyBody: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  emptyAddBtnText: {
    ...Typography.body,
    color: "#FFF",
    fontWeight: "600",
  },

  list: { gap: Spacing.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { ...Typography.body, fontWeight: "600" },
  sub: { ...Typography.caption },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontWeight: "600" },
  hoursRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  hoursText: { fontSize: 11, fontWeight: "500" },

  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  inviteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  inviteBtnText: { fontSize: 12, fontWeight: "600" },
  iconBtn: { padding: 6 },

  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: Spacing.lg,
    maxHeight: "85%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  sheetTitle: {
    ...Typography.h3,
    fontWeight: "600",
    marginBottom: Spacing.xl,
  },

  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: {
    ...Typography.caption,
    fontWeight: "600",
    letterSpacing: 0.6,
    marginBottom: 6,
  },

  palette: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchActive: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  errorText: { ...Typography.caption, marginTop: Spacing.sm },
  sheetBtns: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
});
