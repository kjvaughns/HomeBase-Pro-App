import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  describeChangeSource,
  formatChangeValue,
} from "@/lib/homeProfile";

export type HomeProfile = {
  id: string;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFeet?: number | null;
  yearBuilt?: number | null;
  stories?: number | null;
  lotSize?: number | null;
  hvacType?: string | null;
  hvacInstalledYear?: number | null;
  hvacLastServicedAt?: string | null;
  coolingType?: string | null;
  waterHeaterType?: string | null;
  waterHeaterInstalledYear?: number | null;
  roofMaterial?: string | null;
  roofInstalledYear?: number | null;
  sidingMaterial?: string | null;
  foundationType?: string | null;
  yardSizeSqft?: number | null;
  hasBasement?: boolean | null;
  hasGarage?: boolean | null;
  hasPool?: boolean | null;
  hasDeck?: boolean | null;
  hasSprinklers?: boolean | null;
  hasTreesNearRoof?: boolean | null;
  electricalPanelAmps?: number | null;
  electricalPanelType?: string | null;
  plumbingMaterial?: string | null;
  sewerType?: string | null;
  amenities?: string[] | null;
  knownIssues?: string | null;
  detailsUpdatedAt?: string | null;
  housefaxEnrichedAt?: string | null;
  zillowId?: string | null;
  zillowUrl?: string | null;
  estimatedValue?: string | number | null;
  address?: string | null;
};

type FieldKind = "text" | "number" | "bool" | "longtext" | "tags";

type FieldDef = {
  key: keyof HomeProfile;
  label: string;
  kind: FieldKind;
};

type SectionDef = {
  id: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  fields: FieldDef[];
};

const SECTIONS: SectionDef[] = [
  {
    id: "building",
    title: "Building",
    icon: "home",
    fields: [
      { key: "propertyType", label: "Property type", kind: "text" },
      { key: "yearBuilt", label: "Year built", kind: "number" },
      { key: "squareFeet", label: "Square feet", kind: "number" },
      { key: "stories", label: "Stories", kind: "number" },
      { key: "bedrooms", label: "Bedrooms", kind: "number" },
      { key: "bathrooms", label: "Bathrooms", kind: "number" },
      { key: "lotSize", label: "Lot size (sqft)", kind: "number" },
    ],
  },
  {
    id: "hvac",
    title: "HVAC",
    icon: "wind",
    fields: [
      { key: "hvacType", label: "Heating type", kind: "text" },
      { key: "coolingType", label: "Cooling type", kind: "text" },
      { key: "hvacInstalledYear", label: "Installed year", kind: "number" },
    ],
  },
  {
    id: "water_heater",
    title: "Water heater",
    icon: "droplet",
    fields: [
      { key: "waterHeaterType", label: "Type", kind: "text" },
      {
        key: "waterHeaterInstalledYear",
        label: "Installed year",
        kind: "number",
      },
    ],
  },
  {
    id: "roof",
    title: "Roof",
    icon: "umbrella",
    fields: [
      { key: "roofMaterial", label: "Material", kind: "text" },
      { key: "roofInstalledYear", label: "Installed year", kind: "number" },
    ],
  },
  {
    id: "exterior",
    title: "Exterior",
    icon: "sun",
    fields: [
      { key: "sidingMaterial", label: "Siding material", kind: "text" },
      { key: "foundationType", label: "Foundation type", kind: "text" },
      { key: "yardSizeSqft", label: "Yard size (sqft)", kind: "number" },
      { key: "hasBasement", label: "Has basement", kind: "bool" },
      { key: "hasGarage", label: "Has garage", kind: "bool" },
      { key: "hasPool", label: "Has pool", kind: "bool" },
      { key: "hasDeck", label: "Has deck", kind: "bool" },
      { key: "hasSprinklers", label: "Sprinklers", kind: "bool" },
      { key: "hasTreesNearRoof", label: "Trees near roof", kind: "bool" },
    ],
  },
  {
    id: "electrical",
    title: "Electrical",
    icon: "zap",
    fields: [
      { key: "electricalPanelAmps", label: "Panel amps", kind: "number" },
      { key: "electricalPanelType", label: "Panel type", kind: "text" },
    ],
  },
  {
    id: "plumbing",
    title: "Plumbing",
    icon: "git-merge",
    fields: [
      { key: "plumbingMaterial", label: "Pipe material", kind: "text" },
      { key: "sewerType", label: "Sewer type", kind: "text" },
    ],
  },
  {
    id: "amenities",
    title: "Amenities",
    icon: "star",
    fields: [
      {
        key: "amenities",
        label: "Amenities (comma separated)",
        kind: "tags",
      },
    ],
  },
  {
    id: "notes",
    title: "Homeowner notes",
    icon: "alert-circle",
    fields: [
      {
        key: "knownIssues",
        label: "Known issues / notes for providers",
        kind: "longtext",
      },
    ],
  },
];

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

type ChangeRow = {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  source: string;
  changedAt: string;
};

export interface HomeProfileSectionProps {
  home: HomeProfile;
  editable: boolean;
  highlightKnownIssues?: boolean;
  onUpdated?: (home: HomeProfile) => void;
}

export function HomeProfileSection({
  home,
  editable,
  highlightKnownIssues,
  onUpdated,
}: HomeProfileSectionProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [editingSection, setEditingSection] = useState<SectionDef | null>(null);
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [changes, setChanges] = useState<ChangeRow[] | null>(null);
  const [isLoadingChanges, setIsLoadingChanges] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = useCallback(
    (section: SectionDef) => {
      const initial: Record<string, string> = {};
      const homeRecord = home as unknown as Record<string, unknown>;
      for (const f of section.fields) {
        const v = homeRecord[f.key as string];
        if (f.kind === "tags") {
          initial[f.key as string] = Array.isArray(v)
            ? (v as string[]).join(", ")
            : "";
        } else {
          initial[f.key as string] =
            v === null || v === undefined ? "" : String(v);
        }
      }
      setDraft(initial);
      setEditingSection(section);
    },
    [home],
  );

  const cancelEdit = useCallback(() => {
    setEditingSection(null);
    setDraft({});
  }, []);

  const saveSection = useCallback(async () => {
    if (!editingSection) return;
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of editingSection.fields) {
        const raw = draft[f.key as string];
        if (raw === undefined) continue;
        if (f.kind === "number") {
          if (raw === "" || raw === null) {
            payload[f.key as string] = null;
          } else {
            const n = Number(raw);
            if (!Number.isNaN(n)) payload[f.key as string] = n;
          }
        } else if (f.kind === "tags") {
          const parts = String(raw)
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          payload[f.key as string] = parts;
        } else if (f.kind === "bool") {
          if (raw === "" || raw === null || raw === undefined) {
            payload[f.key as string] = null;
          } else {
            const s = String(raw).toLowerCase();
            payload[f.key as string] = s === "true" || s === "yes";
          }
        } else {
          payload[f.key as string] = raw === "" ? null : String(raw);
        }
      }
      const res = await apiRequest(
        "PATCH",
        `/api/homes/${home.id}/profile`,
        payload,
      );
      const data = await res.json();
      if (data?.home) onUpdated?.(data.home as HomeProfile);
      setEditingSection(null);
      setDraft({});
    } catch (e) {
      console.error("Profile save error:", e);
    } finally {
      setIsSaving(false);
    }
  }, [editingSection, draft, home.id, onUpdated]);

  const openChangeLog = useCallback(async () => {
    setShowChangeLog(true);
    if (changes) return;
    setIsLoadingChanges(true);
    try {
      const res = await apiRequest("GET", `/api/homes/${home.id}/changes`);
      const data = await res.json();
      setChanges(data?.changes ?? []);
    } catch (e) {
      console.error("Change log error:", e);
      setChanges([]);
    } finally {
      setIsLoadingChanges(false);
    }
  }, [home.id, changes]);

  const enrichedAt = home.housefaxEnrichedAt
    ? new Date(home.housefaxEnrichedAt).toLocaleDateString()
    : null;

  return (
    <View>
      {highlightKnownIssues && home.knownIssues ? (
        <GlassCard
          style={[styles.highlightCard, { borderColor: Colors.warning }]}
        >
          <View style={styles.highlightHeader}>
            <Feather name="alert-circle" size={18} color={Colors.warning} />
            <ThemedText style={styles.highlightTitle}>
              Homeowner notes for you
            </ThemedText>
          </View>
          <ThemedText style={styles.highlightBody}>
            {home.knownIssues}
          </ThemedText>
        </GlassCard>
      ) : null}

      {editable ? (
        <View style={styles.headerRow}>
          {enrichedAt ? (
            <ThemedText
              style={[styles.subtle, { color: theme.textSecondary }]}
            >
              Enriched from Zillow on {enrichedAt}
            </ThemedText>
          ) : (
            <View />
          )}
          <Pressable onPress={openChangeLog} style={styles.changeLogBtn}>
            <Feather name="clock" size={14} color={Colors.accent} />
            <ThemedText style={styles.changeLogText}>Change log</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {editable ? (
        <GlassCard style={styles.snapshotCard}>
          <View style={styles.sectionTitleRow}>
            <View
              style={[
                styles.sectionIcon,
                { backgroundColor: Colors.accentLight },
              ]}
            >
              <Feather name="map-pin" size={16} color={Colors.accent} />
            </View>
            <ThemedText style={styles.sectionTitle}>
              Property snapshot
            </ThemedText>
          </View>
          <ThemedText
            style={[styles.subtle, { color: theme.textSecondary }]}
          >
            {enrichedAt
              ? `Last pulled from public records on ${enrichedAt}.`
              : "Public records have not been pulled for this address yet."}
          </ThemedText>
          {home.estimatedValue !== null && home.estimatedValue !== undefined ? (
            <View style={styles.zestimateRow}>
              <ThemedText
                style={[styles.snapshotLabel, { color: theme.textSecondary }]}
              >
                Estimated value
              </ThemedText>
              <ThemedText style={styles.zestimateValue}>
                {(() => {
                  const n = Number(home.estimatedValue);
                  return Number.isFinite(n)
                    ? `$${Math.round(n).toLocaleString("en-US")}`
                    : String(home.estimatedValue);
                })()}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.snapshotGrid}>
            {[
              { label: "Type", value: home.propertyType },
              { label: "Year built", value: home.yearBuilt },
              { label: "Beds", value: home.bedrooms },
              { label: "Baths", value: home.bathrooms },
              { label: "Sq ft", value: home.squareFeet },
              { label: "Lot", value: home.lotSize },
            ].map((item) => (
              <View key={item.label} style={styles.snapshotItem}>
                <ThemedText
                  style={[
                    styles.snapshotLabel,
                    { color: theme.textSecondary },
                  ]}
                >
                  {item.label}
                </ThemedText>
                <ThemedText style={styles.snapshotValue}>
                  {item.value === null || item.value === undefined || item.value === ""
                    ? "—"
                    : String(item.value)}
                </ThemedText>
              </View>
            ))}
          </View>
          <View style={styles.snapshotActions}>
            {!home.zillowId ? (
              <Pressable
                onPress={async () => {
                  try {
                    const res = await apiRequest(
                      "POST",
                      `/api/homes/${home.id}/enrich`,
                      {},
                    );
                    try {
                      const data = (await res.json()) as {
                        home?: HomeProfile;
                      };
                      if (data?.home) onUpdated?.(data.home);
                      else onUpdated?.(home);
                    } catch {
                      onUpdated?.(home);
                    }
                  } catch {
                    Alert.alert(
                      "Couldn't pull property data",
                      "Try again in a moment.",
                    );
                  }
                }}
                style={styles.primaryActionBtn}
              >
                <Feather name="download" size={14} color={theme.buttonText} />
                <ThemedText style={[styles.primaryActionText, { color: theme.buttonText }]}>
                  Pull property data
                </ThemedText>
              </Pressable>
            ) : null}
            {home.zillowUrl ? (
              <Pressable
                onPress={() => {
                  if (home.zillowUrl) {
                    Linking.openURL(home.zillowUrl).catch(() => {});
                  }
                }}
                style={styles.secondaryActionBtn}
              >
                <Feather name="external-link" size={14} color={Colors.accent} />
                <ThemedText style={styles.secondaryActionText}>
                  Update on Zillow
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </GlassCard>
      ) : null}

      {SECTIONS.map((section) => (
        <GlassCard key={section.id} style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View
                style={[
                  styles.sectionIcon,
                  { backgroundColor: Colors.accentLight },
                ]}
              >
                <Feather name={section.icon} size={16} color={Colors.accent} />
              </View>
              <ThemedText style={styles.sectionTitle}>
                {section.title}
              </ThemedText>
            </View>
            {editable ? (
              <Pressable onPress={() => startEdit(section)} hitSlop={8}>
                <Feather name="edit-2" size={16} color={Colors.accent} />
              </Pressable>
            ) : null}
          </View>
          <View>
            {section.fields.map((f) => (
              <View key={String(f.key)} style={styles.row}>
                <ThemedText
                  style={[styles.rowLabel, { color: theme.textSecondary }]}
                >
                  {f.label}
                </ThemedText>
                <ThemedText style={styles.rowValue}>
                  {displayValue(
                    (home as unknown as Record<string, unknown>)[
                      f.key as string
                    ],
                  )}
                </ThemedText>
              </View>
            ))}
          </View>
        </GlassCard>
      ))}

      <Modal
        visible={!!editingSection}
        animationType="slide"
        transparent
        onRequestClose={cancelEdit}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: theme.backgroundDefault,
                paddingBottom: insets.bottom + Spacing.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                Edit {editingSection?.title}
              </ThemedText>
              <Pressable onPress={cancelEdit} hitSlop={8}>
                <Feather name="x" size={22} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: Spacing.lg }}
            >
              {editingSection?.fields.map((f) => (
                <View key={String(f.key)} style={styles.editField}>
                  <ThemedText
                    style={[
                      styles.editLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {f.label}
                  </ThemedText>
                  {f.kind === "bool" ? (
                    <View style={styles.boolRow}>
                      {[
                        { v: "true", label: "Yes" },
                        { v: "false", label: "No" },
                        { v: "", label: "Unknown" },
                      ].map((opt) => {
                        const cur = String(draft[f.key as string] ?? "");
                        const selected = cur === opt.v;
                        return (
                          <Pressable
                            key={opt.label}
                            onPress={() =>
                              setDraft((d) => ({
                                ...d,
                                [f.key as string]: opt.v,
                              }))
                            }
                            style={[
                              styles.boolChip,
                              {
                                backgroundColor: selected
                                  ? Colors.accentLight
                                  : theme.cardBackground,
                                borderColor: selected
                                  ? Colors.accent
                                  : theme.separator,
                              },
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.boolChipText,
                                selected && { color: Colors.accent },
                              ]}
                            >
                              {opt.label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput
                      value={String(draft[f.key as string] ?? "")}
                      onChangeText={(t) =>
                        setDraft((d) => ({ ...d, [f.key as string]: t }))
                      }
                      keyboardType={
                        f.kind === "number" ? "number-pad" : "default"
                      }
                      multiline={f.kind === "longtext"}
                      placeholder="—"
                      placeholderTextColor={theme.textTertiary}
                      style={[
                        styles.editInput,
                        f.kind === "longtext" && styles.editInputMultiline,
                        {
                          backgroundColor: theme.cardBackground,
                          color: theme.text,
                          borderColor: theme.separator,
                        },
                      ]}
                    />
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <SecondaryButton onPress={cancelEdit} style={{ flex: 1 }}>
                Cancel
              </SecondaryButton>
              <PrimaryButton
                onPress={saveSection}
                disabled={isSaving}
                style={{ flex: 1 }}
              >
                {isSaving ? "Saving..." : "Save"}
              </PrimaryButton>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showChangeLog}
        animationType="slide"
        transparent
        onRequestClose={() => setShowChangeLog(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: theme.backgroundDefault,
                paddingBottom: insets.bottom + Spacing.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                Home profile changes
              </ThemedText>
              <Pressable
                onPress={() => setShowChangeLog(false)}
                hitSlop={8}
              >
                <Feather name="x" size={22} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: Spacing.lg }}
            >
              {isLoadingChanges ? (
                <ActivityIndicator color={Colors.accent} />
              ) : !changes || changes.length === 0 ? (
                <ThemedText
                  style={[
                    styles.subtle,
                    { color: theme.textSecondary, textAlign: "center" },
                  ]}
                >
                  No changes recorded yet.
                </ThemedText>
              ) : (
                changes.map((c) => (
                  <View key={c.id} style={styles.changeRow}>
                    <View style={styles.changeRowHeader}>
                      <ThemedText style={styles.changeField}>
                        {humanField(c.fieldName)}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.changeMeta,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {describeChangeSource(c.source)} ·{" "}
                        {new Date(c.changedAt).toLocaleDateString()}
                      </ThemedText>
                    </View>
                    <ThemedText
                      style={[
                        styles.changeValue,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {formatChangeValue(c.oldValue)} →{" "}
                      {formatChangeValue(c.newValue)}
                    </ThemedText>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function humanField(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  subtle: { fontSize: 12 },
  changeLogBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accentLight,
  },
  changeLogText: { color: Colors.accent, fontSize: 12, fontWeight: "600" },
  highlightCard: {
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  highlightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  highlightTitle: { fontWeight: "700", fontSize: 14 },
  highlightBody: { fontSize: 14, lineHeight: 20 },
  sectionCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  snapshotCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  snapshotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.xs,
  },
  snapshotItem: {
    width: "33.333%",
    paddingVertical: 6,
  },
  snapshotLabel: { fontSize: 11, marginBottom: 2 },
  snapshotValue: { fontSize: 14, fontWeight: "600" },
  zestimateRow: {
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    marginVertical: Spacing.xs,
  },
  zestimateValue: { fontSize: 20, fontWeight: "700" },
  snapshotActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    flexWrap: "wrap",
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  primaryActionText: { fontWeight: "600", fontSize: 13 },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  secondaryActionText: { color: Colors.accent, fontWeight: "600", fontSize: 13 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontWeight: "700", fontSize: 15 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  rowLabel: { fontSize: 13, flex: 1 },
  rowValue: { fontSize: 13, fontWeight: "500", textAlign: "right", flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "85%",
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: { fontWeight: "700", fontSize: 18 },
  modalBody: { maxHeight: "100%" },
  editField: { marginBottom: Spacing.md },
  editLabel: { fontSize: 13, marginBottom: 4 },
  editInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  editInputMultiline: { minHeight: 80, textAlignVertical: "top" },
  boolRow: { flexDirection: "row", gap: 8 },
  boolChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  boolChipText: { fontSize: 13, fontWeight: "500" },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  changeRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.2)",
  },
  changeRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  changeField: { fontWeight: "600", fontSize: 13 },
  changeMeta: { fontSize: 11 },
  changeValue: { fontSize: 12, marginTop: 2 },
});
