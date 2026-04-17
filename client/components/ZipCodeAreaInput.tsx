import React, { useState, useEffect } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";

function getSurroundingZips(zip: string): string[] {
  const base = parseInt(zip, 10);
  if (isNaN(base) || base < 1 || base > 99999) return [];
  const offsets = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];
  return offsets
    .map((o) => base + o)
    .filter((z) => z >= 1 && z <= 99999)
    .map((z) => z.toString().padStart(5, "0"));
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  optional?: boolean;
  testID?: string;
}

export function ZipCodeAreaInput({ value, onChange, label, optional, testID }: Props) {
  const { theme } = useTheme();

  const initFromValue = (v: string) => {
    const parts = v.split(",").map((z) => z.trim()).filter(Boolean);
    if (parts.length > 0 && /^\d{5}$/.test(parts[0])) {
      const primaryZip = parts[0];
      const nearby = getSurroundingZips(primaryZip);
      const preSelected = parts.slice(1).filter((z) => nearby.includes(z));
      return { zip: primaryZip, surrounding: nearby, selected: preSelected.length > 0 ? preSelected : nearby };
    }
    return { zip: "", surrounding: [] as string[], selected: [] as string[] };
  };

  const init = initFromValue(value || "");
  const [zip, setZip] = useState(init.zip);
  const [surrounding, setSurrounding] = useState<string[]>(init.surrounding);
  const [selected, setSelected] = useState<string[]>(init.selected);
  const isFirstRender = React.useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (zip.length === 5) {
      const nearby = getSurroundingZips(zip);
      setSurrounding(nearby);
      setSelected(nearby);
    } else {
      setSurrounding([]);
      setSelected([]);
    }
  }, [zip]);

  useEffect(() => {
    if (zip.length === 5) {
      const all = [zip, ...selected];
      onChange(all.join(", "));
    } else if (zip.length > 0) {
      onChange(zip);
    } else {
      onChange("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing; cleanup tracked in Task #107
  }, [zip, selected]);

  const toggleChip = (z: string) => {
    setSelected((prev) =>
      prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]
    );
  };

  const isValid = zip.length === 5;

  return (
    <View>
      {label ? (
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
          {label}
          {optional ? (
            <ThemedText style={[styles.label, { color: theme.textTertiary }]}> (optional)</ThemedText>
          ) : null}
        </ThemedText>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: isValid ? Colors.accent : theme.border,
          },
        ]}
      >
        <Feather
          name="map-pin"
          size={17}
          color={isValid ? Colors.accent : theme.textSecondary}
        />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="ZIP code (e.g. 90210)"
          placeholderTextColor={theme.textTertiary}
          value={zip}
          onChangeText={(v) => setZip(v.replace(/\D/g, "").slice(0, 5))}
          keyboardType="number-pad"
          maxLength={5}
          returnKeyType="done"
          testID={testID}
        />
        {isValid ? (
          <Feather name="check-circle" size={16} color={Colors.accent} />
        ) : null}
      </View>

      {isValid && surrounding.length > 0 ? (
        <View style={styles.surroundingSection}>
          <View style={styles.surroundingHeader}>
            <Feather name="layers" size={12} color={Colors.accent} />
            <ThemedText type="caption" style={{ color: Colors.accent }}>
              Nearby ZIPs included — tap to remove
            </ThemedText>
          </View>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => {}}
              style={[styles.chip, { backgroundColor: Colors.accent + "20", borderColor: Colors.accent }]}
            >
              <ThemedText type="caption" style={{ color: Colors.accent, fontWeight: "600" }}>
                {zip}
              </ThemedText>
            </Pressable>
            {surrounding.map((z) => {
              const active = selected.includes(z);
              return (
                <Pressable
                  key={z}
                  onPress={() => toggleChip(z)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? theme.backgroundSecondary
                        : theme.backgroundTertiary,
                      borderColor: active ? theme.borderLight : theme.border,
                      opacity: active ? 1 : 0.45,
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{ color: active ? theme.text : theme.textTertiary }}
                  >
                    {z}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText type="caption" style={{ color: theme.textTertiary, marginTop: Spacing.xs }}>
            {selected.length + 1} ZIP{selected.length + 1 !== 1 ? "s" : ""} in your service area
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  surroundingSection: {
    marginTop: Spacing.sm,
  },
  surroundingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: Spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
});
