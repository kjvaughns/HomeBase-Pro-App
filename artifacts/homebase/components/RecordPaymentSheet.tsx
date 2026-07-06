import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  ScrollView,
  Image,
  Platform,
  Alert,
  type TextStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { formatMoney } from "@/lib/format";
import { ThemedText } from "./ThemedText";
import { PrimaryButton } from "./PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, Colors, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const WEB_NO_OUTLINE: TextStyle =
  Platform.OS === "web"
    ? ({ outlineStyle: "none" } as unknown as TextStyle)
    : {};

export type ManualPaymentMethod =
  | "cash"
  | "check"
  | "card"
  | "bank_transfer"
  | "other";

export interface ExistingPayment {
  id: string;
  amountCents: number;
  method: ManualPaymentMethod | "stripe" | string;
  reference?: string | null;
  notes?: string | null;
  receivedAt?: string | null;
  photoUrl?: string | null;
}

export interface RecordPaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  invoiceId: string;
  providerId?: string;
  /** Suggested default amount in cents (typically the outstanding balance). */
  suggestedAmountCents?: number;
  /** When provided, sheet edits an existing manual payment instead of creating one. */
  existing?: ExistingPayment | null;
  onSuccess?: () => void;
}

const METHODS: { key: ManualPaymentMethod; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "cash", label: "Cash", icon: "dollar-sign" },
  { key: "check", label: "Check", icon: "edit-3" },
  { key: "card", label: "Card", icon: "credit-card" },
  { key: "bank_transfer", label: "Bank Transfer", icon: "repeat" },
  { key: "other", label: "Other", icon: "more-horizontal" },
];


function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function RecordPaymentSheet({
  visible,
  onClose,
  invoiceId,
  providerId,
  suggestedAmountCents,
  existing,
  onSuccess,
}: RecordPaymentSheetProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const isEdit = !!existing;

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ManualPaymentMethod>("cash");
  const [receivedAt, setReceivedAt] = useState<string>(isoDate(new Date()));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);

  // Reset state on open. Pre-fill from existing payment when editing, or
  // from the outstanding balance when creating.
  useEffect(() => {
    if (!visible) return;
    if (existing) {
      setAmount((existing.amountCents / 100).toFixed(2));
      setMethod(
        (METHODS.find((m) => m.key === existing.method)?.key ??
          "other") as ManualPaymentMethod,
      );
      setReceivedAt(
        existing.receivedAt
          ? isoDate(new Date(existing.receivedAt))
          : isoDate(new Date()),
      );
      setReference(existing.reference ?? "");
      setNotes(existing.notes ?? "");
      setPhotoPreview(existing.photoUrl ?? null);
      setPhotoDataUri(null);
      setPhotoChanged(false);
    } else {
      setAmount(
        suggestedAmountCents && suggestedAmountCents > 0
          ? (suggestedAmountCents / 100).toFixed(2)
          : "",
      );
      setMethod("cash");
      setReceivedAt(isoDate(new Date()));
      setReference("");
      setNotes("");
      setPhotoDataUri(null);
      setPhotoPreview(null);
      setPhotoChanged(false);
    }
  }, [visible, existing, suggestedAmountCents]);

  const amountCents = useMemo(() => {
    const parsed = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100);
  }, [amount]);

  const canSubmit = amountCents > 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        amountCents,
        method,
        receivedAt: new Date(receivedAt).toISOString(),
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      };
      if (photoChanged) {
        body.photoDataUri = photoDataUri;
      }
      const url = isEdit
        ? `/api/payments/${existing!.id}`
        : `/api/invoices/${invoiceId}/payments`;
      const res = await apiRequest(isEdit ? "PATCH" : "POST", url, body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ||
            (isEdit ? "Failed to update payment" : "Failed to record payment"),
        );
      }
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      queryClient.invalidateQueries({
        queryKey: ["/api/invoices", invoiceId, "payments"],
      });
      if (providerId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/provider", providerId, "invoices"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/provider", providerId, "stats"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/providers", providerId, "manual-payments"],
        });
      }
      onSuccess?.();
      onClose();
    },
    onError: (err: Error) => {
      Alert.alert(
        isEdit ? "Couldn't update payment" : "Couldn't record payment",
        err.message,
      );
    },
  });

  const pickPhoto = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Not available on web",
        "Use the mobile app to attach a receipt photo.",
      );
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Please allow photo library access to attach a receipt.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
    setPhotoDataUri(dataUri);
    setPhotoPreview(dataUri);
    setPhotoChanged(true);
  };

  const clearPhoto = () => {
    setPhotoDataUri(null);
    setPhotoPreview(null);
    setPhotoChanged(true);
  };

  const labelStyle = [
    styles.fieldLabel,
    { color: theme.textSecondary },
  ];
  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundSecondary,
      color: theme.text,
      borderColor: theme.separator,
    },
    WEB_NO_OUTLINE,
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + Spacing.md,
              borderBottomColor: theme.separator,
            },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={10} testID="button-close-record-payment">
            <ThemedText style={{ color: Colors.accent, fontSize: 16 }}>Cancel</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>
            {isEdit ? "Edit Payment" : "Record Payment"}
          </ThemedText>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: Spacing.lg,
            paddingBottom: insets.bottom + 120,
          }}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText style={labelStyle}>Amount</ThemedText>
          <View
            style={[
              styles.amountRow,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.separator,
              },
            ]}
          >
            <ThemedText style={[styles.currencySymbol, { color: theme.text }]}>$</ThemedText>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.textTertiary}
              style={[styles.amountInput, { color: theme.text }, WEB_NO_OUTLINE]}
              testID="input-payment-amount"
            />
          </View>

          <ThemedText style={[labelStyle, { marginTop: Spacing.lg }]}>Method</ThemedText>
          <View style={styles.methodGrid}>
            {METHODS.map((m) => {
              const active = method === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setMethod(m.key);
                  }}
                  style={[
                    styles.methodChip,
                    {
                      backgroundColor: active
                        ? Colors.accent + "20"
                        : theme.backgroundSecondary,
                      borderColor: active ? Colors.accent : theme.separator,
                    },
                  ]}
                  testID={`method-${m.key}`}
                >
                  <Feather
                    name={m.icon}
                    size={14}
                    color={active ? Colors.accent : theme.textSecondary}
                  />
                  <ThemedText
                    style={{
                      color: active ? Colors.accent : theme.text,
                      fontWeight: active ? "600" : "400",
                      fontSize: 13,
                    }}
                  >
                    {m.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText style={[labelStyle, { marginTop: Spacing.lg }]}>
            Date received
          </ThemedText>
          <TextInput
            value={receivedAt}
            onChangeText={setReceivedAt}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textTertiary}
            style={inputStyle}
            testID="input-payment-date"
          />

          <ThemedText style={[labelStyle, { marginTop: Spacing.lg }]}>
            Reference (check #, transaction ID)
          </ThemedText>
          <TextInput
            value={reference}
            onChangeText={setReference}
            placeholder="Optional"
            placeholderTextColor={theme.textTertiary}
            style={inputStyle}
            testID="input-payment-reference"
          />

          <ThemedText style={[labelStyle, { marginTop: Spacing.lg }]}>Notes</ThemedText>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional"
            placeholderTextColor={theme.textTertiary}
            multiline
            style={[inputStyle, { minHeight: 72, textAlignVertical: "top" }]}
            testID="input-payment-notes"
          />

          <ThemedText style={[labelStyle, { marginTop: Spacing.lg }]}>
            Receipt photo
          </ThemedText>
          {photoPreview ? (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: photoPreview }} style={styles.photoPreview} />
              <Pressable
                onPress={clearPhoto}
                style={[styles.photoRemove, { backgroundColor: theme.cardBackground }]}
                hitSlop={15}
                accessibilityRole="button"
                accessibilityLabel="Remove receipt photo"
                testID="button-remove-payment-photo"
              >
                <Feather name="x" size={14} color={theme.text} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={pickPhoto}
              style={[
                styles.photoPlaceholder,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.separator,
                },
              ]}
              testID="button-attach-payment-photo"
            >
              <Feather name="camera" size={18} color={theme.textSecondary} />
              <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
                Attach receipt
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + Spacing.md,
              borderTopColor: theme.separator,
              backgroundColor: theme.backgroundRoot,
            },
          ]}
        >
          <PrimaryButton
            onPress={() => saveMutation.mutate()}
            disabled={!canSubmit}
            loading={saveMutation.isPending}
            testID="button-save-payment"
          >
            {isEdit ? "Save Changes" : "Record Payment"}
          </PrimaryButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { ...Typography.headline, fontWeight: "700" },
  fieldLabel: {
    ...Typography.footnote,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  currencySymbol: { ...Typography.title2, fontWeight: "600", marginRight: 4 },
  amountInput: {
    flex: 1,
    ...Typography.title2,
    fontWeight: "600",
    paddingVertical: 4,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
  methodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  methodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  photoPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
  },
  photoPreviewWrap: {
    position: "relative",
    width: 140,
    height: 140,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  photoPreview: { width: "100%", height: "100%" },
  photoRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default RecordPaymentSheet;
