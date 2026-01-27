import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";

interface ChecklistItem {
  id: string;
  name: string;
  description: string;
  checked: boolean;
}

interface ChecklistCategory {
  id: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  items: ChecklistItem[];
}

const INITIAL_CHECKLIST: ChecklistCategory[] = [
  {
    id: "water",
    title: "Water & Food",
    icon: "droplet",
    items: [
      { id: "w1", name: "Water (1 gallon per person/day)", description: "3-day supply minimum", checked: false },
      { id: "w2", name: "Non-perishable food", description: "Canned goods, protein bars", checked: false },
      { id: "w3", name: "Manual can opener", description: "Don't rely on electric", checked: false },
      { id: "w4", name: "Water purification tablets", description: "For emergency water", checked: false },
    ],
  },
  {
    id: "power",
    title: "Power & Light",
    icon: "zap",
    items: [
      { id: "p1", name: "Flashlights", description: "One per family member", checked: false },
      { id: "p2", name: "Extra batteries", description: "Multiple sizes", checked: false },
      { id: "p3", name: "Portable phone charger", description: "Keep charged", checked: false },
      { id: "p4", name: "Battery-powered radio", description: "For emergency broadcasts", checked: false },
    ],
  },
  {
    id: "medical",
    title: "First Aid & Medical",
    icon: "heart",
    items: [
      { id: "m1", name: "First aid kit", description: "Well-stocked and current", checked: false },
      { id: "m2", name: "Prescription medications", description: "7-day supply", checked: false },
      { id: "m3", name: "Pain relievers", description: "Aspirin, ibuprofen", checked: false },
      { id: "m4", name: "Emergency blankets", description: "Compact thermal blankets", checked: false },
    ],
  },
  {
    id: "documents",
    title: "Important Documents",
    icon: "file-text",
    items: [
      { id: "d1", name: "Insurance policies", description: "Copies in waterproof bag", checked: false },
      { id: "d2", name: "Identification documents", description: "Passports, IDs, birth certificates", checked: false },
      { id: "d3", name: "Emergency contact list", description: "Family, doctors, neighbors", checked: false },
      { id: "d4", name: "Cash", description: "Small bills, ATMs may not work", checked: false },
    ],
  },
];

export default function SurvivalKitScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);

  const toggleItem = (categoryId: string, itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChecklist((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.map((item) =>
                item.id === itemId ? { ...item, checked: !item.checked } : item
              ),
            }
          : category
      )
    );
  };

  const getTotalProgress = () => {
    const totalItems = checklist.reduce((acc, cat) => acc + cat.items.length, 0);
    const checkedItems = checklist.reduce(
      (acc, cat) => acc + cat.items.filter((item) => item.checked).length,
      0
    );
    return { total: totalItems, checked: checkedItems };
  };

  const progress = getTotalProgress();
  const progressPercent = Math.round((progress.checked / progress.total) * 100);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl + 88,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassCard style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <ThemedText style={styles.progressTitle}>Your Preparedness</ThemedText>
                <ThemedText style={[styles.progressSubtitle, { color: theme.textSecondary }]}>
                  {progress.checked} of {progress.total} items ready
                </ThemedText>
              </View>
              <View style={[styles.progressCircle, { borderColor: Colors.accent }]}>
                <ThemedText style={[styles.progressPercent, { color: Colors.accent }]}>
                  {progressPercent}%
                </ThemedText>
              </View>
            </View>
            <View style={[styles.progressBar, { backgroundColor: theme.backgroundTertiary }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPercent}%`, backgroundColor: Colors.accent },
                ]}
              />
            </View>
          </GlassCard>
        </Animated.View>

        {checklist.map((category, categoryIndex) => (
          <Animated.View
            key={category.id}
            entering={FadeInDown.delay(200 + categoryIndex * 100).duration(400)}
          >
            <View style={styles.categoryHeader}>
              <View style={[styles.categoryIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name={category.icon} size={18} color={Colors.accent} />
              </View>
              <ThemedText style={styles.categoryTitle}>{category.title}</ThemedText>
            </View>

            <GlassCard style={styles.categoryCard}>
              {category.items.map((item, itemIndex) => (
                <Pressable
                  key={item.id}
                  onPress={() => toggleItem(category.id, item.id)}
                  style={[
                    styles.checklistItem,
                    itemIndex < category.items.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.separator,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: item.checked ? Colors.accent : "transparent",
                        borderColor: item.checked ? Colors.accent : theme.textTertiary,
                      },
                    ]}
                  >
                    {item.checked ? (
                      <Feather name="check" size={14} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <View style={styles.itemContent}>
                    <ThemedText
                      style={[
                        styles.itemName,
                        item.checked && { textDecorationLine: "line-through", opacity: 0.6 },
                      ]}
                    >
                      {item.name}
                    </ThemedText>
                    <ThemedText style={[styles.itemDescription, { color: theme.textSecondary }]}>
                      {item.description}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </GlassCard>
          </Animated.View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.screenPadding,
  },
  progressCard: {
    marginBottom: Spacing.sectionGap,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  progressTitle: {
    ...Typography.headline,
    marginBottom: Spacing.xxs,
  },
  progressSubtitle: {
    ...Typography.subhead,
  },
  progressCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  progressPercent: {
    ...Typography.headline,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  categoryTitle: {
    ...Typography.headline,
  },
  categoryCard: {
    padding: 0,
    overflow: "hidden",
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    ...Typography.body,
    marginBottom: 2,
  },
  itemDescription: {
    ...Typography.caption1,
  },
});
