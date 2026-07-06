import React from "react";
import { Modal, View, Pressable, Platform, StyleSheet, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { Colors, Spacing, BorderRadius, GlassEffect } from "@/constants/theme";

interface BottomSheetOption {
  key: string;
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  destructive?: boolean;
}

interface BottomSheetProps {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
  /**
   * Simple pick-list mode: pass `options` + `onSelect` for an action-sheet
   * style list of choices (replaces ad-hoc `Alert.alert` option lists).
   */
  options?: BottomSheetOption[];
  onSelect?: (key: string) => void;
  /** Free-form content mode: render arbitrary children below the header. */
  children?: React.ReactNode;
  /** Optional confirm/cancel footer for confirm-style sheets. */
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  confirmDestructive?: boolean;
  scrollable?: boolean;
  testID?: string;
}

export function BottomSheet({
  visible,
  title,
  message,
  onClose,
  options,
  onSelect,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  confirmDestructive = false,
  scrollable = false,
  testID,
}: BottomSheetProps) {
  const { theme, isDark } = useTheme();
  const { isTablet } = useLayout();
  const insets = useSafeAreaInsets();

  const Content = scrollable ? ScrollView : View;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, isTablet && styles.overlayTablet]} testID={testID}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={GlassEffect.intensity.medium}
            tint={isDark ? "dark" : "systemMaterial"}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        ) : (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.35)" }]}
            pointerEvents="none"
          />
        )}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.cardBackground,
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
              maxWidth: isTablet ? 600 : undefined,
              width: isTablet ? "100%" : undefined,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.separator }]} />

          {title ? (
            <ThemedText type="h3" style={styles.title}>
              {title}
            </ThemedText>
          ) : null}
          {message ? (
            <ThemedText type="body" style={[styles.message, { color: theme.textSecondary }]}>
              {message}
            </ThemedText>
          ) : null}

          {options ? (
            <View style={styles.options}>
              {options.map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => onSelect?.(option.key)}
                  style={({ pressed }) => [
                    styles.option,
                    { borderBottomColor: theme.separator },
                    pressed && { backgroundColor: theme.backgroundSecondary },
                  ]}
                  testID={testID ? `${testID}-option-${option.key}` : undefined}
                >
                  {option.icon ? (
                    <Feather
                      name={option.icon}
                      size={Spacing.iconSizeSmall}
                      color={option.destructive ? Colors.error : theme.text}
                      style={styles.optionIcon}
                    />
                  ) : null}
                  <ThemedText
                    type="body"
                    style={{ color: option.destructive ? Colors.error : theme.text }}
                  >
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}

          {children ? <Content style={styles.content}>{children}</Content> : null}

          {onConfirm ? (
            <View style={styles.footer}>
              <Pressable
                onPress={onClose}
                style={[styles.footerButton, { backgroundColor: theme.backgroundSecondary }]}
                testID={testID ? `${testID}-cancel` : undefined}
              >
                <ThemedText type="body" style={{ color: theme.text, fontWeight: "600" }}>
                  {cancelLabel}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                style={[
                  styles.footerButton,
                  { backgroundColor: confirmDestructive ? Colors.error : Colors.accent },
                ]}
                testID={testID ? `${testID}-confirm` : undefined}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  {confirmLabel ?? "Confirm"}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayTablet: {
    alignItems: "center",
  },
  container: {
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.screenPadding,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  message: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  options: {
    marginTop: Spacing.xs,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: Spacing.listRowHeight,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionIcon: {
    marginRight: Spacing.md,
  },
  content: {
    marginTop: Spacing.xs,
  },
  footer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  footerButton: {
    flex: 1,
    minHeight: Spacing.buttonHeight,
    borderRadius: BorderRadius.button,
    alignItems: "center",
    justifyContent: "center",
  },
});
