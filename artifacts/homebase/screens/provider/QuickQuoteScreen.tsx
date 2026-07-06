// Task #300 — Quick Quote from an address.
import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  TextInput as RNTextInput,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { GlassCard } from "@/components/GlassCard";
import { FormSectionHeader } from "@/components/FormSectionHeader";
import { AddressAutocomplete, type EnrichmentData } from "@/components/AddressAutocomplete";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { apiRequest } from "@/lib/query-client";

interface CustomService {
  id: string;
  name: string;
  category?: string | null;
  pricingType: string;
}

interface PreviewResponse {
  formattedAddress: string;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lotSize: number | null;
  squareFeet: number | null;
  service: { id: string; name: string; category?: string | null };
  range: { low: number; mid: number; high: number; basis: string };
  aiInsight: string | null;
}

interface QuickQuote {
  id: string;
  address: string;
  formattedAddress?: string | null;
  serviceName: string;
  lowPrice: string;
  midPrice: string;
  highPrice: string;
  finalPrice: string;
  status: string;
  sentVia?: string | null;
  createdAt: string;
}

function formatPrice(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function QuickQuoteScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { horizontalPadding } = useLayout();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { providerProfile } = useAuthStore();
  const { theme } = useTheme();
  const providerId = providerProfile?.id;

  const [enrichment, setEnrichment] = useState<EnrichmentData | null>(null);
  const [manualLotSize, setManualLotSize] = useState<string>("");
  const [manualSqft, setManualSqft] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [editedPrice, setEditedPrice] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [phoneSheetOpen, setPhoneSheetOpen] = useState(false);
  const [smsPhone, setSmsPhone] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const hasEnrichmentSize = !!(enrichment?.lotSize || enrichment?.squareFeet);

  const { data: servicesData } = useQuery<{ services: CustomService[] }>({
    queryKey: ["/api/provider", providerId, "custom-services"],
    enabled: !!providerId,
  });
  const services = servicesData?.services ?? [];
  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;

  const { data: quotesData, isLoading: quotesLoading } = useQuery<{ quotes: QuickQuote[] }>({
    queryKey: ["/api/provider", providerId, "quick-quotes"],
    enabled: !!providerId,
  });
  const recentQuotes = quotesData?.quotes ?? [];

  const previewMutation = useMutation({
    mutationFn: async (): Promise<PreviewResponse> => {
      const overrideLot = parseFloat(manualLotSize);
      const overrideSqft = parseFloat(manualSqft);
      const res = await apiRequest(
        "POST",
        `/api/provider/${providerId}/quick-quotes/preview`,
        {
          address: enrichment?.formattedAddress || "",
          customServiceId: selectedServiceId,
          overrideLotSize: Number.isFinite(overrideLot) && overrideLot > 0 ? overrideLot : undefined,
          overrideSquareFeet: Number.isFinite(overrideSqft) && overrideSqft > 0 ? overrideSqft : undefined,
        },
      );
      return res.json();
    },
    onSuccess: (data) => {
      setPreview(data);
      setEditedPrice(String(Math.round(data.range.mid)));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => setFormError("Couldn't generate the quote. Please try again."),
  });

  const buildSavePayload = (sentVia: string | null, status: string) => ({
    address: enrichment?.formattedAddress ?? "",
    formattedAddress: preview?.formattedAddress ?? enrichment?.formattedAddress,
    placeId: preview?.placeId ?? enrichment?.placeId,
    latitude: preview?.latitude ?? enrichment?.latitude ?? null,
    longitude: preview?.longitude ?? enrichment?.longitude ?? null,
    lotSize: preview?.lotSize ?? enrichment?.lotSize ?? null,
    squareFeet: preview?.squareFeet ?? enrichment?.squareFeet ?? null,
    customServiceId: selectedServiceId,
    serviceName: preview?.service.name ?? selectedService?.name ?? "Service",
    lowPrice: preview?.range.low ?? 0,
    midPrice: preview?.range.mid ?? 0,
    highPrice: preview?.range.high ?? 0,
    finalPrice: parseFloat(editedPrice) || preview?.range.mid || 0,
    pricingBasis: preview?.range.basis ?? null,
    aiInsight: preview?.aiInsight ?? null,
    notes: notes.trim() || null,
    sentVia,
    status,
  });

  const saveMutation = useMutation({
    mutationFn: async (vars: { sentVia: string | null; status: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/provider/${providerId}/quick-quotes`,
        buildSavePayload(vars.sentVia, vars.status),
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/provider", providerId, "quick-quotes"],
      });
    },
  });

  const buildShareText = (): string => {
    if (!preview) return "";
    const final = parseFloat(editedPrice) || preview.range.mid;
    const company = providerProfile?.businessName || "your service pro";
    const lines = [
      `Quote from ${company}`,
      `Service: ${preview.service.name}`,
      `Address: ${preview.formattedAddress}`,
      `Estimated price: ${formatPrice(final)}`,
      `Range: ${formatPrice(preview.range.low)} – ${formatPrice(preview.range.high)}`,
    ];
    if (notes.trim()) lines.push(`Notes: ${notes.trim()}`);
    return lines.join("\n");
  };

  const handleAddressSelected = (data: EnrichmentData) => {
    setEnrichment(data);
    setPreview(null);
    setEditedPrice("");
    setFormError(null);
  };

  const handleGenerate = () => {
    setFormError(null);
    if (!providerId) return setFormError("Provider profile not loaded yet.");
    if (!enrichment?.formattedAddress) return setFormError("Pick an address first.");
    if (!selectedServiceId) return setFormError("Pick a service.");
    previewMutation.mutate();
  };

  const handleCopy = async () => {
    if (!preview) return;
    await Clipboard.setStringAsync(buildShareText());
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSavedFlash("Copied to clipboard");
    setTimeout(() => setSavedFlash(null), 2000);
    saveMutation.mutate({ sentVia: "clipboard", status: "sent" });
  };

  const handleSendSMS = async () => {
    if (!preview) return;
    setPhoneSheetOpen(false);
    const body = encodeURIComponent(buildShareText());
    const sep = Platform.OS === "ios" ? "&" : "?";
    const cleaned = smsPhone.replace(/[^\d+]/g, "");
    const url = cleaned ? `sms:${cleaned}${sep}body=${body}` : `sms:${sep}body=${body}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
    } catch (err) {
      console.warn("[QuickQuote] sms open failed", err);
    }
    saveMutation.mutate({ sentVia: "sms", status: "sent" });
  };

  const handleSaveDraft = () => {
    if (!preview) return;
    saveMutation.mutate({ sentVia: null, status: "draft" });
    setSavedFlash("Saved as draft");
    setTimeout(() => setSavedFlash(null), 2000);
  };

  const handlePromoteToEstimate = () => {
    if (!preview) return;
    const final = parseFloat(editedPrice) || preview.range.mid;
    saveMutation.mutate({ sentVia: "estimate", status: "promoted" });
    const noteLines = [
      `Address: ${preview.formattedAddress}`,
      `Quote range: ${formatPrice(preview.range.low)} – ${formatPrice(preview.range.high)} (${preview.range.basis})`,
    ];
    if (notes.trim()) noteLines.unshift(notes.trim());
    navigation.navigate("AddEstimate", {
      prefillItems: [
        {
          description: preview.service.name,
          qty: "1",
          unitPrice: String(Math.round(final)),
        },
      ],
      prefillNotes: noteLines.join("\n"),
    });
  };

  const showRecent = recentQuotes.length > 0;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: horizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.section}>
          <FormSectionHeader icon="map-pin" title="Property address" />
          <AddressAutocomplete
            onAddressSelected={handleAddressSelected}
            placeholder="123 Main St, City, State"
            testID="input-quick-quote-address"
          />
          {enrichment ? (
            <View style={styles.metaRow}>
              {enrichment.lotSize ? (
                <View style={[styles.chip, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="grid" size={12} color={theme.textSecondary} />
                  <ThemedText style={[styles.chipText, { color: theme.textSecondary }]}>
                    Lot {enrichment.lotSize.toLocaleString()} sqft
                  </ThemedText>
                </View>
              ) : null}
              {enrichment.squareFeet ? (
                <View style={[styles.chip, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="home" size={12} color={theme.textSecondary} />
                  <ThemedText style={[styles.chipText, { color: theme.textSecondary }]}>
                    {enrichment.squareFeet.toLocaleString()} sqft home
                  </ThemedText>
                </View>
              ) : null}
              {!enrichment.lotSize && !enrichment.squareFeet ? (
                <ThemedText style={{ color: theme.textTertiary, fontSize: 12 }}>
                  No property data found — enter lot or home size below for a sharper quote.
                </ThemedText>
              ) : null}
            </View>
          ) : null}
          {enrichment && !hasEnrichmentSize ? (
            <View style={styles.manualRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.miniLabel, { color: theme.textTertiary }]}>
                  LOT SIZE (SQFT)
                </ThemedText>
                <RNTextInput
                  style={[styles.manualInput, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                  placeholder="e.g. 6500"
                  placeholderTextColor={theme.textTertiary}
                  value={manualLotSize}
                  onChangeText={setManualLotSize}
                  keyboardType="number-pad"
                  testID="input-manual-lot-size"
                />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.miniLabel, { color: theme.textTertiary }]}>
                  HOME SIZE (SQFT)
                </ThemedText>
                <RNTextInput
                  style={[styles.manualInput, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                  placeholder="e.g. 2200"
                  placeholderTextColor={theme.textTertiary}
                  value={manualSqft}
                  onChangeText={setManualSqft}
                  keyboardType="number-pad"
                  testID="input-manual-sqft"
                />
              </View>
            </View>
          ) : null}
        </GlassCard>

        <GlassCard style={styles.section}>
          <FormSectionHeader icon="briefcase" title="Service" />
          {services.length === 0 ? (
            <View>
              <ThemedText style={{ color: theme.textTertiary }}>
                You don't have any services yet. Add one to start generating quotes.
              </ThemedText>
              <SecondaryButton
                onPress={() => navigation.navigate("NewService", { onboardingMode: false })}
                style={{ marginTop: Spacing.sm }}
                testID="button-add-service"
              >
                Add a Service
              </SecondaryButton>
            </View>
          ) : (
            <Pressable
              style={[
                styles.selectRow,
                { borderColor: selectedService ? Colors.accent + "40" : theme.separator },
              ]}
              onPress={() => setServicePickerOpen(true)}
              testID="button-select-service"
            >
              <View style={[styles.iconBubble, { backgroundColor: Colors.accentLight }]}>
                <Feather name="tool" size={16} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText
                  style={{
                    fontWeight: "600",
                    color: selectedService ? theme.text : theme.textTertiary,
                  }}
                >
                  {selectedService?.name ?? "Choose a service"}
                </ThemedText>
                {selectedService?.category ? (
                  <ThemedText style={{ color: theme.textTertiary, fontSize: 13 }}>
                    {selectedService.category}
                  </ThemedText>
                ) : null}
              </View>
              <Feather name="chevron-down" size={18} color={theme.textTertiary} />
            </Pressable>
          )}
        </GlassCard>

        {formError ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color={Colors.error} />
            <ThemedText style={{ color: Colors.error, marginLeft: 8 }}>{formError}</ThemedText>
          </View>
        ) : null}

        <PrimaryButton
          onPress={handleGenerate}
          loading={previewMutation.isPending}
          disabled={previewMutation.isPending || !enrichment || !selectedServiceId}
          style={{ marginTop: Spacing.sm }}
          testID="button-generate-quote"
        >
          Generate Quote
        </PrimaryButton>

        {preview ? (
          <GlassCard style={[styles.section, { marginTop: Spacing.md }]}>
            <FormSectionHeader icon="dollar-sign" title="Suggested quote" />

            <View style={styles.priceMainRow}>
              <ThemedText style={{ color: theme.textSecondary }}>Send price</ThemedText>
              <View style={[styles.priceInputBox, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={{ color: theme.textSecondary, marginRight: 4 }}>$</ThemedText>
                <RNTextInput
                  style={[styles.priceInput, { color: theme.text }]}
                  value={editedPrice}
                  onChangeText={setEditedPrice}
                  keyboardType="decimal-pad"
                  testID="input-final-price"
                />
              </View>
            </View>

            <View style={styles.rangeRow}>
              <RangeTile label="Low" value={preview.range.low} theme={theme} />
              <RangeTile label="Mid" value={preview.range.mid} theme={theme} highlighted />
              <RangeTile label="High" value={preview.range.high} theme={theme} />
            </View>

            <View style={[styles.basisBlock, { borderColor: theme.separator }]}>
              <ThemedText style={[styles.basisLabel, { color: theme.textTertiary }]}>
                BASIS
              </ThemedText>
              <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
                {preview.range.basis}
              </ThemedText>
              {preview.aiInsight ? (
                <View style={styles.aiRow}>
                  <Feather name="zap" size={12} color={Colors.accent} />
                  <ThemedText style={[styles.aiText, { color: theme.textSecondary }]}>
                    {preview.aiInsight}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            <View style={{ height: Spacing.md }} />
            <FormSectionHeader icon="edit-3" title="Notes (optional)" />
            <TextField
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything the client should know..."
              multiline
              numberOfLines={3}
              testID="input-quote-notes"
            />

            {savedFlash ? (
              <View style={[styles.flashBox, { backgroundColor: Colors.accentLight }]}>
                <Feather name="check-circle" size={14} color={Colors.accent} />
                <ThemedText style={{ color: Colors.accent, marginLeft: 6, fontSize: 13 }}>
                  {savedFlash}
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.actionGrid}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: Colors.accent }]}
                onPress={handleCopy}
                accessibilityRole="button"
                accessibilityLabel="Copy quote"
                testID="button-copy-quote"
              >
                <Feather name="copy" size={16} color="#fff" />
                <ThemedText style={styles.actionBtnTextPrimary}>Copy</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => setPhoneSheetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Text quote to client"
                testID="button-sms-quote"
              >
                <Feather name="message-square" size={16} color={Colors.accent} />
                <ThemedText style={[styles.actionBtnText, { color: Colors.accent }]}>
                  Text
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]}
                onPress={handlePromoteToEstimate}
                accessibilityRole="button"
                accessibilityLabel="Promote quote to estimate"
                testID="button-promote-estimate"
              >
                <Feather name="file-text" size={16} color={Colors.accent} />
                <ThemedText style={[styles.actionBtnText, { color: Colors.accent }]}>
                  Estimate
                </ThemedText>
              </Pressable>
            </View>
            <SecondaryButton
              onPress={handleSaveDraft}
              style={{ marginTop: Spacing.sm }}
              testID="button-save-draft-quote"
            >
              Save as Draft
            </SecondaryButton>
          </GlassCard>
        ) : null}

        {showRecent ? (
          <View style={{ marginTop: Spacing.lg }}>
            <ThemedText style={[styles.recentHeading, { color: theme.textSecondary }]}>
              RECENT QUOTES
            </ThemedText>
            {recentQuotes.slice(0, 10).map((q) => (
              <GlassCard key={q.id} style={styles.recentCard} testID={`quote-${q.id}`}>
                <View style={styles.recentTop}>
                  <ThemedText style={{ fontWeight: "600", flex: 1 }} numberOfLines={1}>
                    {q.serviceName}
                  </ThemedText>
                  <ThemedText style={{ color: Colors.accent, fontWeight: "700" }}>
                    {formatPrice(parseFloat(q.finalPrice))}
                  </ThemedText>
                </View>
                <ThemedText
                  style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {q.formattedAddress || q.address}
                </ThemedText>
                <View style={styles.recentMeta}>
                  <ThemedText style={{ color: theme.textTertiary, fontSize: 11 }}>
                    {new Date(q.createdAt).toLocaleDateString()}
                  </ThemedText>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor:
                          q.status === "sent" || q.status === "promoted"
                            ? Colors.accentLight
                            : theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <ThemedText
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color:
                          q.status === "sent" || q.status === "promoted"
                            ? Colors.accent
                            : theme.textSecondary,
                      }}
                    >
                      {q.status.toUpperCase()}
                    </ThemedText>
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        ) : quotesLoading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.lg }} />
        ) : null}
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={servicePickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setServicePickerOpen(false)}
      >
        <ThemedView style={{ flex: 1, padding: Spacing.lg }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: Spacing.md,
            }}
          >
            <ThemedText style={{ fontSize: 18, fontWeight: "700" }}>Select service</ThemedText>
            <Pressable onPress={() => setServicePickerOpen(false)} hitSlop={8}>
              <Feather name="x" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
          {services.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => {
                setSelectedServiceId(s.id);
                setServicePickerOpen(false);
                setPreview(null);
              }}
              style={{
                paddingVertical: Spacing.md,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.separator,
              }}
              testID={`service-option-${s.id}`}
            >
              <ThemedText style={{ fontWeight: "600" }}>{s.name}</ThemedText>
              {s.category ? (
                <ThemedText style={{ color: theme.textTertiary, fontSize: 13 }}>
                  {s.category} · {s.pricingType}
                </ThemedText>
              ) : null}
            </Pressable>
          ))}
        </ThemedView>
      </Modal>

      <Modal
        visible={phoneSheetOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPhoneSheetOpen(false)}
      >
        <ThemedView style={{ flex: 1, padding: Spacing.lg }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: Spacing.md,
            }}
          >
            <ThemedText style={{ fontSize: 18, fontWeight: "700" }}>Text the quote</ThemedText>
            <Pressable onPress={() => setPhoneSheetOpen(false)} hitSlop={8}>
              <Feather name="x" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
          <ThemedText style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
            Phone number is optional — if blank, your messaging app will open with the quote already
            drafted.
          </ThemedText>
          <TextField
            value={smsPhone}
            onChangeText={setSmsPhone}
            placeholder="+15551234567"
            keyboardType="phone-pad"
            testID="input-sms-phone"
          />
          <PrimaryButton
            onPress={handleSendSMS}
            style={{ marginTop: Spacing.md }}
            testID="button-open-sms"
          >
            Open Messages
          </PrimaryButton>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

type ThemeShape = ReturnType<typeof useTheme>["theme"];

function RangeTile({
  label,
  value,
  theme,
  highlighted,
}: {
  label: string;
  value: number;
  theme: ThemeShape;
  highlighted?: boolean;
}) {
  return (
    <View
      style={[
        styles.rangeTile,
        {
          backgroundColor: highlighted ? Colors.accentLight : theme.backgroundSecondary,
          borderColor: highlighted ? Colors.accent : "transparent",
          borderWidth: highlighted ? 1 : 0,
        },
      ]}
    >
      <ThemedText style={[styles.rangeLabel, { color: theme.textTertiary }]}>{label}</ThemedText>
      <ThemedText
        style={[
          styles.rangeValue,
          { color: highlighted ? Colors.accent : theme.text },
        ]}
      >
        {formatPrice(value)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { marginBottom: Spacing.md, padding: Spacing.lg },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  chipText: { fontSize: 12, fontWeight: "500" },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  priceMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  priceInputBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 120,
  },
  priceInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "right",
  },
  rangeRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  rangeTile: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  rangeLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  rangeValue: { fontSize: 16, fontWeight: "700" },
  basisBlock: {
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  basisLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  aiRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: Spacing.sm,
  },
  aiText: { flex: 1, fontSize: 13, lineHeight: 18 },
  flashBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
    alignSelf: "flex-start",
  },
  actionGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  actionBtnText: { fontWeight: "600" },
  actionBtnTextPrimary: { color: "#fff", fontWeight: "600" },
  recentHeading: {
    ...Typography.caption1,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  recentCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  manualRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  miniLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  manualInput: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    fontSize: 14,
  },
  recentTop: { flexDirection: "row", alignItems: "center" },
  recentMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
});
