import React from "react";
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

interface PropertyEvent {
  id: string;
  date: string;
  type: "purchase" | "renovation" | "repair" | "inspection" | "permit";
  title: string;
  description: string;
  cost?: number;
}

interface PropertyInfo {
  address: string;
  yearBuilt: number;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  lotSize: string;
  propertyType: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue: number;
}

const PROPERTY_INFO: PropertyInfo = {
  address: "123 Oak Street, San Francisco, CA 94102",
  yearBuilt: 1985,
  sqft: 2200,
  bedrooms: 4,
  bathrooms: 2.5,
  lotSize: "0.25 acres",
  propertyType: "Single Family",
  purchaseDate: "March 2019",
  purchasePrice: 850000,
  currentValue: 1150000,
};

const PROPERTY_HISTORY: PropertyEvent[] = [
  {
    id: "1",
    date: "Nov 2025",
    type: "inspection",
    title: "Annual Home Inspection",
    description: "Comprehensive inspection completed. Minor issues noted.",
  },
  {
    id: "2",
    date: "Aug 2025",
    type: "repair",
    title: "HVAC Repair",
    description: "Replaced condenser fan motor and capacitor",
    cost: 450,
  },
  {
    id: "3",
    date: "May 2024",
    type: "renovation",
    title: "Kitchen Remodel",
    description: "Full kitchen renovation including new cabinets, countertops, and appliances",
    cost: 35000,
  },
  {
    id: "4",
    date: "Jan 2024",
    type: "permit",
    title: "Kitchen Remodel Permit",
    description: "Building permit approved for kitchen renovation",
  },
  {
    id: "5",
    date: "Sep 2022",
    type: "repair",
    title: "Roof Repair",
    description: "Replaced damaged shingles after storm",
    cost: 1200,
  },
  {
    id: "6",
    date: "Mar 2019",
    type: "purchase",
    title: "Property Purchased",
    description: "Home purchased from previous owner",
    cost: 850000,
  },
];

export default function HouseFaxScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const getEventIcon = (type: PropertyEvent["type"]): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "purchase":
        return "key";
      case "renovation":
        return "tool";
      case "repair":
        return "settings";
      case "inspection":
        return "search";
      case "permit":
        return "file-text";
    }
  };

  const getEventColor = (type: PropertyEvent["type"]) => {
    switch (type) {
      case "purchase":
        return Colors.accent;
      case "renovation":
        return "#8B5CF6";
      case "repair":
        return Colors.warning;
      case "inspection":
        return "#3B82F6";
      case "permit":
        return "#6B7280";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const valueChange = PROPERTY_INFO.currentValue - PROPERTY_INFO.purchasePrice;
  const valueChangePercent = Math.round((valueChange / PROPERTY_INFO.purchasePrice) * 100);

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
          <GlassCard style={styles.propertyCard}>
            <View style={styles.propertyHeader}>
              <View style={[styles.propertyIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="home" size={24} color={Colors.accent} />
              </View>
              <View style={styles.propertyAddress}>
                <ThemedText style={styles.propertyTitle}>Your Property</ThemedText>
                <ThemedText style={[styles.addressText, { color: theme.textSecondary }]}>
                  {PROPERTY_INFO.address}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.propertyStats, { borderTopColor: theme.separator }]}>
              <View style={styles.statItem}>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Year Built
                </ThemedText>
                <ThemedText style={styles.statValue}>{PROPERTY_INFO.yearBuilt}</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Sq Ft
                </ThemedText>
                <ThemedText style={styles.statValue}>
                  {PROPERTY_INFO.sqft.toLocaleString()}
                </ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Bed / Bath
                </ThemedText>
                <ThemedText style={styles.statValue}>
                  {PROPERTY_INFO.bedrooms} / {PROPERTY_INFO.bathrooms}
                </ThemedText>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <GlassCard style={styles.valueCard}>
            <ThemedText style={styles.sectionTitle}>Property Value</ThemedText>
            <View style={styles.valueRow}>
              <View>
                <ThemedText style={[styles.valueLabel, { color: theme.textSecondary }]}>
                  Current Estimate
                </ThemedText>
                <ThemedText style={styles.valueAmount}>
                  {formatCurrency(PROPERTY_INFO.currentValue)}
                </ThemedText>
              </View>
              <View style={styles.valueChange}>
                <Feather
                  name={valueChange >= 0 ? "trending-up" : "trending-down"}
                  size={20}
                  color={valueChange >= 0 ? Colors.accent : Colors.error}
                />
                <ThemedText
                  style={[
                    styles.changeText,
                    { color: valueChange >= 0 ? Colors.accent : Colors.error },
                  ]}
                >
                  +{valueChangePercent}%
                </ThemedText>
              </View>
            </View>
            <View style={styles.purchaseInfo}>
              <ThemedText style={[styles.purchaseLabel, { color: theme.textSecondary }]}>
                Purchased {PROPERTY_INFO.purchaseDate} for{" "}
                {formatCurrency(PROPERTY_INFO.purchasePrice)}
              </ThemedText>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <ThemedText style={styles.historyTitle}>Property History</ThemedText>
        </Animated.View>

        <View style={styles.timeline}>
          {PROPERTY_HISTORY.map((event, index) => (
            <Animated.View
              key={event.id}
              entering={FadeInDown.delay(400 + index * 75).duration(400)}
              style={styles.timelineItem}
            >
              <View style={styles.timelineLine}>
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: getEventColor(event.type) },
                  ]}
                >
                  <Feather name={getEventIcon(event.type)} size={12} color="#FFFFFF" />
                </View>
                {index < PROPERTY_HISTORY.length - 1 ? (
                  <View
                    style={[styles.timelineConnector, { backgroundColor: theme.separator }]}
                  />
                ) : null}
              </View>
              <GlassCard style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <ThemedText style={styles.eventTitle}>{event.title}</ThemedText>
                  <ThemedText style={[styles.eventDate, { color: theme.textSecondary }]}>
                    {event.date}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.eventDescription, { color: theme.textSecondary }]}>
                  {event.description}
                </ThemedText>
                {event.cost ? (
                  <ThemedText style={[styles.eventCost, { color: Colors.accent }]}>
                    {formatCurrency(event.cost)}
                  </ThemedText>
                ) : null}
              </GlassCard>
            </Animated.View>
          ))}
        </View>
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
  propertyCard: {
    marginBottom: Spacing.md,
  },
  propertyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  propertyIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  propertyAddress: {
    flex: 1,
  },
  propertyTitle: {
    ...Typography.headline,
    marginBottom: 2,
  },
  addressText: {
    ...Typography.subhead,
  },
  propertyStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    ...Typography.caption1,
    marginBottom: 2,
  },
  statValue: {
    ...Typography.headline,
  },
  valueCard: {
    marginBottom: Spacing.sectionGap,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  valueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  valueLabel: {
    ...Typography.caption1,
    marginBottom: 2,
  },
  valueAmount: {
    fontSize: 28,
    fontWeight: "700",
  },
  valueChange: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  changeText: {
    ...Typography.headline,
  },
  purchaseInfo: {
    marginTop: Spacing.sm,
  },
  purchaseLabel: {
    ...Typography.footnote,
  },
  historyTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  timeline: {
    paddingLeft: Spacing.xs,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  timelineLine: {
    width: 24,
    alignItems: "center",
    marginRight: Spacing.md,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    marginTop: Spacing.xs,
  },
  eventCard: {
    flex: 1,
    padding: Spacing.md,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  eventTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    flex: 1,
    marginRight: Spacing.sm,
  },
  eventDate: {
    ...Typography.caption1,
  },
  eventDescription: {
    ...Typography.footnote,
  },
  eventCost: {
    ...Typography.subhead,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
});
