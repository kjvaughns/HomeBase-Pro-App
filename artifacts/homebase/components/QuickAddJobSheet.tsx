import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  ScrollView,
  ActivityIndicator,
  Platform,
  type TextStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "./ThemedText";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Spacing, Typography, Colors, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";
import {
  useProviderPublishedServices,
  type PublishedProviderService,
} from "@/hooks/useProviderPublishedServices";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// `outlineStyle` is a web-only CSS property not present on RN TextStyle.
// Cast through `unknown` so styles still satisfy TextStyle on native.
const WEB_NO_OUTLINE: TextStyle =
  Platform.OS === "web"
    ? ({ outlineStyle: "none" } as unknown as TextStyle)
    : {};

interface ClientLite {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
}

export interface QuickAddJobSheetProps {
  visible: boolean;
  onClose: () => void;
  defaultDate: Date;
  defaultTime: string; // "HH:MM"
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeLabel(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

function priceFromService(svc: PublishedProviderService): string | undefined {
  if (svc.pricingType === "fixed" || svc.pricingType === "service_call") {
    return svc.basePrice ?? undefined;
  }
  if (svc.pricingType === "variable") {
    return svc.priceFrom ?? undefined;
  }
  return undefined;
}

export function QuickAddJobSheet({
  visible,
  onClose,
  defaultDate,
  defaultTime,
}: QuickAddJobSheetProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isTablet } = useLayout();
  const queryClient = useQueryClient();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { providerProfile } = useAuthStore();
  const providerId = providerProfile?.id;

  const [clientQuery, setClientQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [serviceQuery, setServiceQuery] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset form whenever sheet opens
  useEffect(() => {
    if (visible) {
      setClientQuery("");
      setSelectedClientId(null);
      setServiceQuery("");
      setSelectedServiceId(null);
      setNote("");
      setErrorMessage(null);
    }
  }, [visible]);

  const { data: clientsData } = useQuery<{ clients: ClientLite[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId && visible,
  });
  const clients = clientsData?.clients ?? [];

  const { services } = useProviderPublishedServices(providerId);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );
  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  const filteredClients = useMemo(() => {
    if (selectedClientId) return [];
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients.slice(0, 6);
    return clients
      .filter((c) => {
        const name = `${c.firstName} ${c.lastName}`.toLowerCase();
        return (
          name.includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").includes(q)
        );
      })
      .slice(0, 6);
  }, [clients, clientQuery, selectedClientId]);

  const filteredServices = useMemo(() => {
    if (selectedServiceId) return [];
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return services.slice(0, 6);
    return services
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [services, serviceQuery, selectedServiceId]);

  const createJobMutation = useMutation({
    mutationFn: async () => {
      if (!providerId || !selectedClient || !selectedService) {
        throw new Error("Missing required fields");
      }
      const body = {
        providerId,
        clientId: selectedClient.id,
        customServiceId: selectedService.id,
        title: selectedService.name,
        notes: note.trim() || undefined,
        scheduledDate: defaultDate.toISOString(),
        scheduledTime: defaultTime,
        estimatedDuration: selectedService.duration ?? undefined,
        estimatedPrice: priceFromService(selectedService),
        pricingType: selectedService.pricingType,
        serviceDescription: selectedService.description ?? undefined,
      };
      const res = await apiRequest("POST", "/api/jobs", body);
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "jobs"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "stats"],
      });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Couldn't create job";
      setErrorMessage(msg);
    },
  });

  const handleSave = () => {
    setErrorMessage(null);
    if (!selectedClient) {
      setErrorMessage("Pick a client first.");
      return;
    }
    if (!selectedService) {
      setErrorMessage("Pick a service first.");
      return;
    }
    createJobMutation.mutate();
  };

  const handleNewClient = () => {
    onClose();
    navigation.navigate("AddClient");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Audit: glass backdrop on iOS, solid fallback on Android/web */}
      <Pressable style={[styles.backdrop, isTablet && styles.backdropTablet]} onPress={onClose}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={40}
            tint="systemMaterial"
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} pointerEvents="none" />
        )}
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundElevated,
              paddingBottom: insets.bottom + Spacing.lg,
              ...(isTablet && { maxWidth: 600, width: "100%", borderRadius: BorderRadius.xl }),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.title}>Quick Add Job</ThemedText>
              <ThemedText
                style={[styles.subtitle, { color: theme.textSecondary }]}
              >
                {formatDateLabel(defaultDate)} · {formatTimeLabel(defaultTime)}
              </ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="quick-add-close"
              style={[
                styles.closeBtn,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.body}
            contentContainerStyle={{ paddingBottom: Spacing.lg }}
            showsVerticalScrollIndicator={false}
          >
            {/* Client */}
            <ThemedText
              style={[styles.label, { color: theme.textTertiary }]}
            >
              CLIENT
            </ThemedText>
            <GlassCard style={styles.fieldCard}>
              {selectedClient ? (
                <Pressable
                  style={styles.selectedRow}
                  onPress={() => {
                    setSelectedClientId(null);
                    setClientQuery("");
                  }}
                  testID="quick-add-clear-client"
                >
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: Colors.accentLight },
                    ]}
                  >
                    <Feather name="user" size={14} color={Colors.accent} />
                  </View>
                  <ThemedText style={styles.selectedText}>
                    {selectedClient.firstName} {selectedClient.lastName}
                  </ThemedText>
                  <Feather name="x" size={16} color={theme.textTertiary} />
                </Pressable>
              ) : (
                <>
                  <View style={styles.searchRow}>
                    <Feather
                      name="search"
                      size={16}
                      color={theme.textTertiary}
                    />
                    <TextInput
                      value={clientQuery}
                      onChangeText={setClientQuery}
                      placeholder="Search clients"
                      placeholderTextColor={theme.textTertiary}
                      style={[styles.input, { color: theme.text }]}
                      autoCorrect={false}
                      testID="quick-add-client-search"
                    />
                  </View>
                  {filteredClients.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[
                        styles.optionRow,
                        { borderTopColor: theme.separator },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedClientId(c.id);
                      }}
                      testID={`quick-add-client-${c.id}`}
                    >
                      <ThemedText style={styles.optionText} numberOfLines={1}>
                        {c.firstName} {c.lastName}
                      </ThemedText>
                      {c.phone ? (
                        <ThemedText
                          style={[
                            styles.optionMeta,
                            { color: theme.textTertiary },
                          ]}
                          numberOfLines={1}
                        >
                          {c.phone}
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  ))}
                  <Pressable
                    style={[
                      styles.optionRow,
                      styles.newRow,
                      { borderTopColor: theme.separator },
                    ]}
                    onPress={handleNewClient}
                    accessibilityRole="button"
                    accessibilityLabel="Add new client"
                    testID="quick-add-new-client"
                  >
                    <Feather name="plus" size={14} color={Colors.accent} />
                    <ThemedText
                      style={[styles.newText, { color: Colors.accent }]}
                    >
                      New client
                    </ThemedText>
                  </Pressable>
                </>
              )}
            </GlassCard>

            {/* Service */}
            <ThemedText
              style={[styles.label, { color: theme.textTertiary }]}
            >
              SERVICE
            </ThemedText>
            <GlassCard style={styles.fieldCard}>
              {selectedService ? (
                <Pressable
                  style={styles.selectedRow}
                  onPress={() => {
                    setSelectedServiceId(null);
                    setServiceQuery("");
                  }}
                  testID="quick-add-clear-service"
                >
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: Colors.accentLight },
                    ]}
                  >
                    <Feather name="tool" size={14} color={Colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.selectedText} numberOfLines={1}>
                      {selectedService.name}
                    </ThemedText>
                    {selectedService.duration ? (
                      <ThemedText
                        style={[
                          styles.optionMeta,
                          { color: theme.textTertiary },
                        ]}
                      >
                        {selectedService.duration} min
                      </ThemedText>
                    ) : null}
                  </View>
                  <Feather name="x" size={16} color={theme.textTertiary} />
                </Pressable>
              ) : services.length === 0 ? (
                <View style={styles.emptyServices}>
                  <ThemedText
                    style={[styles.optionMeta, { color: theme.textTertiary }]}
                  >
                    Publish a service first to use Quick Add.
                  </ThemedText>
                </View>
              ) : (
                <>
                  <View style={styles.searchRow}>
                    <Feather
                      name="search"
                      size={16}
                      color={theme.textTertiary}
                    />
                    <TextInput
                      value={serviceQuery}
                      onChangeText={setServiceQuery}
                      placeholder="Search services"
                      placeholderTextColor={theme.textTertiary}
                      style={[styles.input, { color: theme.text }]}
                      autoCorrect={false}
                      testID="quick-add-service-search"
                    />
                  </View>
                  {filteredServices.map((s) => (
                    <Pressable
                      key={s.id}
                      style={[
                        styles.optionRow,
                        { borderTopColor: theme.separator },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedServiceId(s.id);
                      }}
                      testID={`quick-add-service-${s.id}`}
                    >
                      <ThemedText style={styles.optionText} numberOfLines={1}>
                        {s.name}
                      </ThemedText>
                      {s.duration ? (
                        <ThemedText
                          style={[
                            styles.optionMeta,
                            { color: theme.textTertiary },
                          ]}
                        >
                          {s.duration}m
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  ))}
                </>
              )}
            </GlassCard>

            {/* Note */}
            <ThemedText
              style={[styles.label, { color: theme.textTertiary }]}
            >
              NOTE (OPTIONAL)
            </ThemedText>
            <GlassCard style={styles.fieldCard}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add a quick note…"
                placeholderTextColor={theme.textTertiary}
                multiline
                style={[
                  styles.noteInput,
                  { color: theme.text },
                ]}
                testID="quick-add-note"
              />
            </GlassCard>

            {errorMessage ? (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: Colors.errorLight },
                ]}
              >
                <Feather name="alert-circle" size={14} color={Colors.error} />
                <ThemedText
                  style={[styles.errorText, { color: Colors.error }]}
                >
                  {errorMessage}
                </ThemedText>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <PrimaryButton
              onPress={handleSave}
              loading={createJobMutation.isPending}
              testID="quick-add-save"
            >
              Add Job
            </PrimaryButton>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropTablet: {
    alignItems: "center",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(120,120,128,0.4)",
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.title3,
    fontWeight: "700",
  },
  subtitle: {
    ...Typography.subhead,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flexGrow: 0,
  },
  label: {
    ...Typography.caption2,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  fieldCard: {
    paddingVertical: Spacing.xs,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.body,
    padding: 0,
    ...WEB_NO_OUTLINE,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    ...Typography.body,
    flex: 1,
  },
  optionMeta: {
    ...Typography.caption1,
  },
  newRow: {
    justifyContent: "flex-start",
  },
  newText: {
    ...Typography.subhead,
    fontWeight: "700",
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  selectedText: {
    ...Typography.body,
    fontWeight: "600",
    flex: 1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  noteInput: {
    ...Typography.body,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    minHeight: 64,
    textAlignVertical: "top",
    ...WEB_NO_OUTLINE,
  },
  emptyServices: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  errorText: {
    ...Typography.caption1,
    flex: 1,
  },
  footer: {
    paddingTop: Spacing.md,
  },
});
