import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import * as Haptics from "expo-haptics";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/state/authStore";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type BookingMode = "instant" | "starts_at" | "quote_only";

const PRICING_LABELS: Record<string, string> = {
  fixed: "Flat Rate",
  variable: "Starts At",
  quote: "Custom Quote",
  service_call: "Service Call",
};

const BOOKING_LABELS: Record<string, string> = {
  instant: "Instant Book",
  starts_at: "Provider Confirms",
  quote_only: "Quote Only",
};

const BOOKING_ICONS: Record<string, FeatherIconName> = {
  instant: "zap",
  starts_at: "check-circle",
  quote_only: "send",
};

const PRICING_ICONS: Record<string, FeatherIconName> = {
  fixed: "tag",
  variable: "trending-up",
  quote: "file-text",
  service_call: "tool",
};

function parseJSON<T>(raw: unknown, fallback: T): T {
  try {
    if (!raw) return fallback;
    const parsed = JSON.parse(String(raw));
    return parsed as T;
  } catch {
    return fallback;
  }
}

interface SectionRowProps {
  icon: FeatherIconName;
  label: string;
  title: string;
  subtitle?: string;
  onEdit: () => void;
  accent?: boolean;
}

function SectionRow({ icon, label, title, subtitle, onEdit, accent }: SectionRowProps) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onEdit} style={styles.sectionRow}>
      <View style={[styles.sectionIcon, { backgroundColor: Colors.accent + "18" }]}>
        <Feather name={icon} size={16} color={Colors.accent} />
      </View>
      <View style={styles.sectionInfo}>
        <ThemedText style={[styles.sectionLabel, { color: theme.textTertiary }]}>{label}</ThemedText>
        <ThemedText style={[styles.sectionTitle, { color: accent ? Colors.accent : theme.text }]} numberOfLines={2}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <View style={[styles.editChip, { backgroundColor: theme.backgroundElevated, borderColor: theme.borderLight }]}>
        <Feather name="edit-2" size={12} color={theme.textSecondary} />
        <ThemedText style={[styles.editChipText, { color: theme.textSecondary }]}>Edit</ThemedText>
      </View>
    </Pressable>
  );
}

export default function ServiceSummaryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { providerProfile } = useAuthStore();
  const queryClient = useQueryClient();
  const providerId = providerProfile?.id;

  const routeParams = route.params as RootStackParamList["ServiceSummary"];
  const { serviceId } = routeParams;

  const { data: servicesData, refetch } = useQuery<{ services: Array<Record<string, unknown>> }>({
    queryKey: ["/api/provider", providerId, "custom-services"],
    enabled: Boolean(providerId),
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const liveService = servicesData?.services?.find((s) => s.id === serviceId) ?? routeParams.service;
  const service = liveService;

  const name = String(service.name || "Unnamed Service");
  const category = String(service.category || "");
  const description = String(service.description || "");
  const pricingType = String(service.pricingType || "fixed");
  const basePrice = service.basePrice ? String(service.basePrice) : null;
  const bookingMode = String(service.bookingMode || "instant") as BookingMode;
  const isPublished = Boolean(service.isPublished);

  const questions = parseJSON<Array<{ question: string; required?: boolean }>>(service.intakeQuestionsJson, []);
  const addOns = parseJSON<Array<{ name: string; price: number }>>(service.addOnsJson, []);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const getPriceDisplay = () => {
    if (pricingType === "quote") return "Custom Quote";
    if (!basePrice) return "Price not set";
    if (pricingType === "variable") return `Starting at $${basePrice}`;
    return `$${basePrice}`;
  };

  const navigateToStep = (step: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("EditService", {
      serviceId,
      service,
      initialStep: step,
    });
  };

  const handleSave = async () => {
    if (!providerId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(true);
    setSaveError("");
    try {
      const apiPricingType = pricingType;
      const bm = pricingType === "quote" ? "quote_only" : bookingMode;
      const url = new URL(`/api/provider/${providerId}/custom-services/${serviceId}`, getApiUrl());
      await apiRequest("PUT", url.toString(), {
        name,
        category,
        description: description || null,
        pricingType: apiPricingType,
        basePrice: basePrice || null,
        isPublished: true,
        bookingMode: bm,
        intakeQuestionsJson: JSON.stringify(questions),
        addOnsJson: JSON.stringify(addOns),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "custom-services"] });
      navigation.goBack();
    } catch {
      setSaveError("Could not save changes. Please try again.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!providerId) return;
    setDeleting(true);
    setConfirmDelete(false);
    try {
      const url = new URL(`/api/provider/${providerId}/custom-services/${serviceId}`, getApiUrl());
      await apiRequest("DELETE", url.toString());
      await queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId, "custom-services"] });
      navigation.goBack();
    } catch {
      setDeleting(false);
    }
  };

  const bookingLabel = BOOKING_LABELS[bookingMode] ?? bookingMode;
  const bookingIcon = BOOKING_ICONS[bookingMode] ?? "calendar";
  const pricingLabel = PRICING_LABELS[pricingType] ?? pricingType;
  const pricingIcon = PRICING_ICONS[pricingType] ?? "tag";

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 160 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: Colors.accent + "18" }]}>
            <Feather name="briefcase" size={28} color={Colors.accent} />
          </View>
          <View style={styles.heroInfo}>
            <ThemedText type="h2" style={styles.heroName} numberOfLines={2}>{name}</ThemedText>
            <View style={styles.heroBadgeRow}>
              <View style={[styles.categoryBadge, { backgroundColor: Colors.accent + "15", borderColor: Colors.accent + "30" }]}>
                <ThemedText style={[styles.categoryBadgeText, { color: Colors.accent }]}>{category}</ThemedText>
              </View>
              <View style={[
                styles.publishedBadge,
                { backgroundColor: isPublished ? Colors.accent + "15" : theme.backgroundElevated, borderColor: isPublished ? Colors.accent + "40" : theme.borderLight },
              ]}>
                <View style={[styles.publishedDot, { backgroundColor: isPublished ? Colors.accent : theme.textTertiary }]} />
                <ThemedText style={[styles.publishedText, { color: isPublished ? Colors.accent : theme.textTertiary }]}>
                  {isPublished ? "Live" : "Draft"}
                </ThemedText>
              </View>
            </View>
            {description ? (
              <ThemedText style={[styles.heroDesc, { color: theme.textSecondary }]} numberOfLines={3}>
                {description}
              </ThemedText>
            ) : null}
          </View>
        </Animated.View>

        {/* Sections */}
        <Animated.View entering={FadeInDown.delay(60).duration(300)}>
          <GlassCard style={styles.sectionsCard}>
            <SectionRow
              icon="briefcase"
              label="SERVICE DETAILS"
              title={name}
              subtitle={description || "Tap to add a description"}
              onEdit={() => navigateToStep(0)}
            />
            <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
            <SectionRow
              icon={pricingIcon}
              label="PRICING"
              title={getPriceDisplay()}
              subtitle={pricingLabel}
              onEdit={() => navigateToStep(1)}
              accent={pricingType !== "quote"}
            />
            <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
            <SectionRow
              icon="help-circle"
              label="BOOKING QUESTIONS"
              title={questions.length > 0 ? `${questions.length} question${questions.length !== 1 ? "s" : ""}` : "None added"}
              subtitle={questions.length > 0 ? questions.map((q) => q.question).slice(0, 2).join(", ") : "Tap to add intake questions"}
              onEdit={() => navigateToStep(2)}
            />
            <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
            <SectionRow
              icon="plus-circle"
              label="ADD-ONS & UPGRADES"
              title={addOns.length > 0 ? `${addOns.length} upgrade${addOns.length !== 1 ? "s" : ""}` : "None added"}
              subtitle={addOns.length > 0 ? addOns.map((a) => a.name).slice(0, 2).join(", ") : "Tap to offer upsells"}
              onEdit={() => navigateToStep(3)}
            />
            <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
            <SectionRow
              icon={bookingIcon}
              label="BOOKING MODE"
              title={bookingLabel}
              onEdit={() => navigateToStep(4)}
            />
          </GlassCard>
        </Animated.View>

        {/* Save error */}
        {saveError.length > 0 ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <ThemedText style={[styles.saveError, { color: "#FF3B30" }]}>{saveError}</ThemedText>
          </Animated.View>
        ) : null}

        {/* Delete confirmation inline */}
        {confirmDelete ? (
          <Animated.View entering={FadeIn.duration(200)} style={[styles.deleteConfirmCard, { backgroundColor: "#FF3B3010", borderColor: "#FF3B3030" }]}>
            <View style={styles.deleteConfirmRow}>
              <Feather name="alert-triangle" size={16} color="#FF3B30" />
              <ThemedText style={[styles.deleteConfirmTitle, { color: "#FF3B30" }]}>
                Delete this service permanently?
              </ThemedText>
            </View>
            <ThemedText style={[styles.deleteConfirmSub, { color: theme.textSecondary }]}>
              This cannot be undone. Customers will no longer be able to book it.
            </ThemedText>
            <View style={styles.deleteConfirmBtns}>
              <Pressable
                onPress={() => setConfirmDelete(false)}
                style={[styles.cancelBtn, { borderColor: theme.borderLight }]}
                testID="button-cancel-delete"
              >
                <ThemedText style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                style={styles.confirmDeleteBtn}
                disabled={deleting}
                testID="button-confirm-delete"
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.confirmDeleteText}>Delete Service</ThemedText>
                )}
              </Pressable>
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Fixed bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md, borderTopColor: theme.borderLight, backgroundColor: theme.backgroundDefault }]}>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, { backgroundColor: Colors.accent, opacity: saving ? 0.7 : 1 }]}
          testID="button-save-service"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="check" size={16} color="#fff" />
              <ThemedText style={styles.saveBtnText}>Save Changes</ThemedText>
            </>
          )}
        </Pressable>

        {!confirmDelete ? (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setConfirmDelete(true); }}
            style={[styles.deleteBtn, { borderColor: "#FF3B3040" }]}
            testID="button-delete-service"
          >
            <Feather name="trash-2" size={15} color="#FF3B30" />
            <ThemedText style={[styles.deleteBtnText, { color: "#FF3B30" }]}>Delete Service</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.lg,
  },

  // Hero
  heroSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroInfo: { flex: 1 },
  heroName: { fontWeight: "800", marginBottom: Spacing.xs },
  heroBadgeRow: { flexDirection: "row", gap: Spacing.xs, flexWrap: "wrap", marginBottom: Spacing.xs },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  categoryBadgeText: { ...Typography.caption2, fontWeight: "700", letterSpacing: 0.3 },
  publishedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  publishedDot: { width: 6, height: 6, borderRadius: 3 },
  publishedText: { ...Typography.caption2, fontWeight: "700" },
  heroDesc: { ...Typography.caption1, lineHeight: 18 },

  // Sections card
  sectionsCard: { padding: 0, overflow: "hidden" },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md + 2,
    gap: Spacing.md,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionInfo: { flex: 1, minWidth: 0 },
  sectionLabel: { ...Typography.caption2, fontWeight: "700", letterSpacing: 0.5, marginBottom: 2 },
  sectionTitle: { ...Typography.body, fontWeight: "700" },
  sectionSubtitle: { ...Typography.caption1, marginTop: 2 },
  editChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    flexShrink: 0,
  },
  editChipText: { ...Typography.caption2, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.md + 36 + Spacing.md },

  // Save error
  saveError: { ...Typography.caption, textAlign: "center" },

  // Delete confirm
  deleteConfirmCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  deleteConfirmRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.xs },
  deleteConfirmTitle: { ...Typography.body, fontWeight: "700", flex: 1 },
  deleteConfirmSub: { ...Typography.caption, lineHeight: 18, marginBottom: Spacing.md },
  deleteConfirmBtns: { flexDirection: "row", gap: Spacing.sm },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelBtnText: { ...Typography.body, fontWeight: "600" },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  confirmDeleteText: { ...Typography.body, fontWeight: "700", color: "#fff" },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    minHeight: 52,
  },
  saveBtnText: { ...Typography.body, fontWeight: "700", color: "#fff", fontSize: 16 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  deleteBtnText: { ...Typography.body, fontWeight: "600" },
});
