import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Pressable,
  Platform,
  StyleSheet,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface NativeDatePickerSheetProps {
  visible: boolean;
  value: Date;
  mode: "date" | "time";
  minimumDate?: Date;
  maximumDate?: Date;
  minuteInterval?: 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;
  title?: string;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

export function NativeDatePickerSheet({
  visible,
  value,
  mode,
  minimumDate,
  maximumDate,
  minuteInterval,
  title,
  onConfirm,
  onCancel,
}: NativeDatePickerSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Date>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  if (!visible) return null;

  // Web does not support the native DateTimePicker — return null gracefully.
  if (Platform.OS === "web") return null;

  if (Platform.OS === "android") {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="default"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        minuteInterval={minuteInterval}
        onChange={(_event: DateTimePickerEvent, date?: Date) => {
          if (date) {
            onConfirm(date);
          } else {
            onCancel();
          }
        }}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={sheet.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View
          style={[
            sheet.container,
            {
              backgroundColor: theme.cardBackground,
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
            },
          ]}
        >
          <View style={[sheet.handle, { backgroundColor: theme.separator }]} />

          <View style={sheet.header}>
            <Pressable onPress={onCancel} hitSlop={12} style={sheet.headerBtn}>
              <ThemedText style={[sheet.cancelText, { color: theme.textSecondary }]}>
                Cancel
              </ThemedText>
            </Pressable>

            <ThemedText style={sheet.titleText}>
              {title ?? (mode === "date" ? "Select Date" : "Select Time")}
            </ThemedText>

            <Pressable onPress={() => onConfirm(draft)} hitSlop={12} style={sheet.headerBtn}>
              <ThemedText style={[sheet.doneText, { color: Colors.accent }]}>
                Done
              </ThemedText>
            </Pressable>
          </View>

          <DateTimePicker
            value={draft}
            mode={mode}
            display="spinner"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            minuteInterval={minuteInterval}
            onChange={(_event: DateTimePickerEvent, date?: Date) => {
              if (date) setDraft(date);
            }}
            style={sheet.picker}
            textColor={theme.text}
          />
        </View>
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.screenPadding,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  headerBtn: {
    minWidth: 60,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "400",
  },
  titleText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    flex: 1,
  },
  doneText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
  },
  picker: {
    width: "100%",
  },
});
