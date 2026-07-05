import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  ScrollView,
  Platform,
  Alert,
  type TextStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "./ThemedText";
import { PrimaryButton } from "./PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, Colors, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const WEB_NO_OUTLINE: TextStyle =
  Platform.OS === "web"
    ? ({ outlineStyle: "none" } as unknown as TextStyle)
    : {};

export interface NoShowFeeSheetProps {
  visible: boolean;
  onClose: () => void;
  jobId: string;
  providerId?: string;
  /** Suggested default fee in cents, e.g. the job's estimated/final price. */
  suggestedAmountCents?: number;
  onSuccess?: () => void;
}

function formatCentsInput(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return "";
  return (cents / 100).toFixed(2);
}

export function NoShowFeeSheet({
  visible,
  onClose,
  jobId,
  providerId,
  suggestedAmountCents,
  onSuccess,
}: NoShowFeeSheetProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [chargeFee, setChargeFee] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setAmount(
      suggestedAmountCents && suggestedAmountCents > 0
        ? formatCentsInput(suggestedAmountCents)
        : "",
    );
    setChargeFee(true);
  }, [visible, suggestedAmountCents]);

  const feeCents = useMemo(() => {
    if (!chargeFee) return 0;
    const parsed = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100);
  }, [amount, chargeFee]);

  const canSubmit = !chargeFee || feeCents > 0;

  const noShowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/no-show`, {
        feeCents: chargeFee ? feeCents : 0,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "Failed to mark no-show",
        );
      }
      return res.json() as Promise<{
        job: unknown;
        fee: {
          status: "charged_card" | "covered_by_deposit" | "failed";
          amountCents: number;
          reason?: string;
        } | null;
      }>;
    },
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      if (providerId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/provider", providerId, "jobs"],
        });
      }
      onSuccess?.();
      onClose();
      const fee = data?.fee;
      if (chargeFee && feeCents > 0 && fee) {
        if (fee.status === "charged_card" || fee.status === "covered_by_deposit") {
          const via =
            fee.status === "covered_by_deposit"
              ? "covered by their deposit"
              : "charged to their saved card";
          Alert.alert("No-show recorded", `The fee was ${via}.`);
        } else {
          Alert.alert(
            "No-show recorded",
            fee.reason ||
              "We couldn't charge the client automatically. You may need to collect this fee manually.",
          );
        }
      } else {
        Alert.alert("No-show recorded", "The job has been marked as a no-show.");
      }
    },
    onError: (err: Error) => {
      Alert.alert("Couldn't mark no-show", err.message);
    },
  });

  const labelStyle = [styles.fieldLabel, { color: theme.textSecondary }];

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
            { paddingTop: insets.top + Spacing.md, borderBottomColor: theme.separator },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={10} testID="button-close-no-show">
            <ThemedText style={{ color: Colors.accent, fontSize: 16 }}>Cancel</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Mark No-Show</ThemedText>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 120 }}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
            The client didn't show up for this appointment. You can optionally charge a
            no-show fee to their saved card or deposit — you keep 100% of it.
          </ThemedText>

          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setChargeFee(true);
              }}
              style={[
                styles.toggleOption,
                {
                  backgroundColor: chargeFee ? Colors.accent + "20" : theme.backgroundSecondary,
                  borderColor: chargeFee ? Colors.accent : theme.separator,
                },
              ]}
              testID="button-no-show-charge-fee"
            >
              <ThemedText
                style={{ color: chargeFee ? Colors.accent : theme.text, fontWeight: "600" }}
              >
                Charge a fee
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setChargeFee(false);
              }}
              style={[
                styles.toggleOption,
                {
                  backgroundColor: !chargeFee ? Colors.accent + "20" : theme.backgroundSecondary,
                  borderColor: !chargeFee ? Colors.accent : theme.separator,
                },
              ]}
              testID="button-no-show-no-fee"
            >
              <ThemedText
                style={{ color: !chargeFee ? Colors.accent : theme.text, fontWeight: "600" }}
              >
                No fee
              </ThemedText>
            </Pressable>
          </View>

          {chargeFee ? (
            <>
              <ThemedText style={[labelStyle, { marginTop: Spacing.lg }]}>Fee amount</ThemedText>
              <View
                style={[
                  styles.amountRow,
                  { backgroundColor: theme.backgroundSecondary, borderColor: theme.separator },
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
                  testID="input-no-show-fee-amount"
                />
              </View>
            </>
          ) : null}
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
            onPress={() => noShowMutation.mutate()}
            disabled={!canSubmit || noShowMutation.isPending}
            loading={noShowMutation.isPending}
            testID="button-confirm-no-show"
          >
            {chargeFee ? "Mark No-Show & Charge Fee" : "Mark No-Show"}
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
  toggleRow: { flexDirection: "row", gap: Spacing.sm },
  toggleOption: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default NoShowFeeSheet;
