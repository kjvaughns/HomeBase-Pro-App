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

interface SystemHealth {
  id: string;
  name: string;
  icon: keyof typeof Feather.glyphMap;
  status: "good" | "fair" | "attention";
  score: number;
  lastChecked: string;
  nextService: string;
  notes: string;
}

const HOME_SYSTEMS: SystemHealth[] = [
  {
    id: "hvac",
    name: "HVAC System",
    icon: "wind",
    status: "good",
    score: 92,
    lastChecked: "Oct 2025",
    nextService: "Apr 2026",
    notes: "Filter replaced, running efficiently",
  },
  {
    id: "plumbing",
    name: "Plumbing",
    icon: "droplet",
    status: "fair",
    score: 75,
    lastChecked: "Aug 2025",
    nextService: "Feb 2026",
    notes: "Minor leak under kitchen sink detected",
  },
  {
    id: "electrical",
    name: "Electrical",
    icon: "zap",
    status: "good",
    score: 88,
    lastChecked: "Sep 2025",
    nextService: "Sep 2026",
    notes: "All circuits functioning properly",
  },
  {
    id: "roof",
    name: "Roof & Exterior",
    icon: "home",
    status: "attention",
    score: 62,
    lastChecked: "Jun 2025",
    nextService: "Overdue",
    notes: "Inspection recommended - last severe weather",
  },
  {
    id: "appliances",
    name: "Major Appliances",
    icon: "box",
    status: "good",
    score: 85,
    lastChecked: "Nov 2025",
    nextService: "May 2026",
    notes: "All appliances within warranty",
  },
  {
    id: "safety",
    name: "Safety Systems",
    icon: "shield",
    status: "fair",
    score: 78,
    lastChecked: "Jul 2025",
    nextService: "Jan 2026",
    notes: "Smoke detector batteries need replacement",
  },
];

export default function HealthScoreScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const overallScore = Math.round(
    HOME_SYSTEMS.reduce((acc, sys) => acc + sys.score, 0) / HOME_SYSTEMS.length
  );

  const getStatusColor = (status: "good" | "fair" | "attention") => {
    switch (status) {
      case "good":
        return Colors.accent;
      case "fair":
        return Colors.warning;
      case "attention":
        return Colors.error;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return Colors.accent;
    if (score >= 60) return Colors.warning;
    return Colors.error;
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Good";
    if (score >= 70) return "Fair";
    if (score >= 60) return "Needs Attention";
    return "Action Required";
  };

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
          <GlassCard style={styles.scoreCard}>
            <View style={styles.scoreHeader}>
              <View style={[styles.scoreCircle, { borderColor: getScoreColor(overallScore) }]}>
                <ThemedText style={[styles.scoreValue, { color: getScoreColor(overallScore) }]}>
                  {overallScore}
                </ThemedText>
              </View>
              <View style={styles.scoreInfo}>
                <ThemedText style={styles.scoreTitle}>Home Health Score</ThemedText>
                <ThemedText style={[styles.scoreLabel, { color: getScoreColor(overallScore) }]}>
                  {getScoreLabel(overallScore)}
                </ThemedText>
                <ThemedText style={[styles.scoreSubtitle, { color: theme.textSecondary }]}>
                  Based on {HOME_SYSTEMS.length} home systems
                </ThemedText>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <ThemedText style={styles.sectionTitle}>System Health</ThemedText>
        </Animated.View>

        {HOME_SYSTEMS.map((system, index) => (
          <Animated.View
            key={system.id}
            entering={FadeInDown.delay(300 + index * 75).duration(400)}
          >
            <GlassCard style={styles.systemCard}>
              <View style={styles.systemHeader}>
                <View style={styles.systemLeft}>
                  <View
                    style={[
                      styles.systemIcon,
                      { backgroundColor: `${getStatusColor(system.status)}20` },
                    ]}
                  >
                    <Feather
                      name={system.icon}
                      size={20}
                      color={getStatusColor(system.status)}
                    />
                  </View>
                  <View>
                    <ThemedText style={styles.systemName}>{system.name}</ThemedText>
                    <View style={styles.statusRow}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: getStatusColor(system.status) },
                        ]}
                      />
                      <ThemedText
                        style={[
                          styles.statusText,
                          { color: getStatusColor(system.status) },
                        ]}
                      >
                        {system.status === "good"
                          ? "Good"
                          : system.status === "fair"
                          ? "Fair"
                          : "Needs Attention"}
                      </ThemedText>
                    </View>
                  </View>
                </View>
                <View style={styles.systemScore}>
                  <ThemedText
                    style={[styles.systemScoreValue, { color: getScoreColor(system.score) }]}
                  >
                    {system.score}
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.systemDetails, { borderTopColor: theme.separator }]}>
                <View style={styles.detailRow}>
                  <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                    Last Checked
                  </ThemedText>
                  <ThemedText style={styles.detailValue}>{system.lastChecked}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                    Next Service
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.detailValue,
                      system.nextService === "Overdue" && { color: Colors.error },
                    ]}
                  >
                    {system.nextService}
                  </ThemedText>
                </View>
              </View>

              <ThemedText style={[styles.systemNotes, { color: theme.textSecondary }]}>
                {system.notes}
              </ThemedText>
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
  scoreCard: {
    marginBottom: Spacing.sectionGap,
  },
  scoreHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: "700",
  },
  scoreInfo: {
    flex: 1,
  },
  scoreTitle: {
    ...Typography.title3,
    marginBottom: Spacing.xxs,
  },
  scoreLabel: {
    ...Typography.headline,
    marginBottom: Spacing.xxs,
  },
  scoreSubtitle: {
    ...Typography.caption1,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  systemCard: {
    marginBottom: Spacing.md,
  },
  systemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  systemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  systemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  systemName: {
    ...Typography.headline,
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  systemScore: {
    alignItems: "center",
    justifyContent: "center",
  },
  systemScoreValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  systemDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailRow: {
    flex: 1,
  },
  detailLabel: {
    ...Typography.caption1,
    marginBottom: 2,
  },
  detailValue: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  systemNotes: {
    ...Typography.footnote,
    marginTop: Spacing.sm,
    fontStyle: "italic",
  },
});
