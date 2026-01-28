import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";

interface Resource {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  type: "article" | "video" | "guide" | "tool";
  url?: string;
}

const RESOURCES: Resource[] = [
  {
    id: "1",
    icon: "book-open",
    title: "Getting Started Guide",
    description: "Learn how to set up your profile, create services, and start accepting bookings.",
    type: "guide",
  },
  {
    id: "2",
    icon: "trending-up",
    title: "Maximize Your Earnings",
    description: "Tips and strategies to increase your revenue and grow your client base.",
    type: "article",
  },
  {
    id: "3",
    icon: "star",
    title: "Getting 5-Star Reviews",
    description: "Best practices for delivering exceptional service and earning great reviews.",
    type: "article",
  },
  {
    id: "4",
    icon: "camera",
    title: "Portfolio Photography Tips",
    description: "How to take professional photos of your work to attract more clients.",
    type: "video",
  },
  {
    id: "5",
    icon: "dollar-sign",
    title: "Pricing Your Services",
    description: "Guidelines for competitive pricing that reflects your value and expertise.",
    type: "guide",
  },
  {
    id: "6",
    icon: "users",
    title: "Client Communication",
    description: "Templates and tips for professional communication with clients.",
    type: "tool",
  },
  {
    id: "7",
    icon: "calendar",
    title: "Scheduling Best Practices",
    description: "Optimize your schedule for maximum efficiency and work-life balance.",
    type: "article",
  },
  {
    id: "8",
    icon: "shield",
    title: "Insurance & Liability",
    description: "Understanding insurance requirements and protecting your business.",
    type: "guide",
  },
];

const QUICK_LINKS = [
  { icon: "file-text", label: "Terms of Service", url: "#" },
  { icon: "lock", label: "Privacy Policy", url: "#" },
  { icon: "help-circle", label: "FAQ", url: "#" },
  { icon: "mail", label: "Contact Support", url: "#" },
];

export default function ProviderResourcesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const getTypeColor = (type: Resource["type"]) => {
    switch (type) {
      case "video":
        return Colors.error;
      case "guide":
        return Colors.accent;
      case "tool":
        return Colors.warning;
      default:
        return "#3B82F6";
    }
  };

  const getTypeLabel = (type: Resource["type"]) => {
    switch (type) {
      case "video":
        return "Video";
      case "guide":
        return "Guide";
      case "tool":
        return "Tool";
      default:
        return "Article";
    }
  };

  const handleResourcePress = (resource: Resource) => {
    if (resource.url) {
      Linking.openURL(resource.url);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(0).duration(300)}>
          <GlassCard style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Feather name="book" size={32} color={Colors.accent} />
            </View>
            <ThemedText style={styles.heroTitle}>Provider Resources</ThemedText>
            <ThemedText style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
              Everything you need to succeed on HomeBase. From getting started guides to advanced growth strategies.
            </ThemedText>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(50).duration(300)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Featured Resources
          </ThemedText>
          <View style={styles.resourcesGrid}>
            {RESOURCES.map((resource, index) => (
              <Animated.View
                key={resource.id}
                entering={FadeInDown.delay(100 + index * 30).duration(300)}
              >
                <Pressable
                  style={[styles.resourceCard, { backgroundColor: theme.cardBackground }]}
                  onPress={() => handleResourcePress(resource)}
                >
                  <View style={styles.resourceHeader}>
                    <View style={[styles.resourceIcon, { backgroundColor: Colors.accent + "15" }]}>
                      <Feather name={resource.icon} size={20} color={Colors.accent} />
                    </View>
                    <View
                      style={[
                        styles.typeBadge,
                        { backgroundColor: getTypeColor(resource.type) + "20" },
                      ]}
                    >
                      <ThemedText
                        style={[styles.typeText, { color: getTypeColor(resource.type) }]}
                      >
                        {getTypeLabel(resource.type)}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.resourceTitle}>{resource.title}</ThemedText>
                  <ThemedText style={[styles.resourceDescription, { color: theme.textSecondary }]}>
                    {resource.description}
                  </ThemedText>
                  <View style={styles.resourceFooter}>
                    <ThemedText style={{ color: Colors.accent, fontWeight: "500" }}>
                      Read More
                    </ThemedText>
                    <Feather name="arrow-right" size={16} color={Colors.accent} />
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Quick Links
          </ThemedText>
          <GlassCard style={styles.quickLinksCard}>
            {QUICK_LINKS.map((link, index) => (
              <Pressable
                key={link.label}
                style={[
                  styles.quickLinkRow,
                  index < QUICK_LINKS.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.borderLight,
                  },
                ]}
              >
                <View style={styles.quickLinkLeft}>
                  <Feather name={link.icon as any} size={18} color={theme.textSecondary} />
                  <ThemedText style={styles.quickLinkText}>{link.label}</ThemedText>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textTertiary} />
              </Pressable>
            ))}
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).duration(300)}>
          <View style={[styles.supportCard, { backgroundColor: Colors.accent + "10" }]}>
            <Feather name="headphones" size={24} color={Colors.accent} />
            <View style={styles.supportInfo}>
              <ThemedText style={styles.supportTitle}>Need Help?</ThemedText>
              <ThemedText style={[styles.supportText, { color: theme.textSecondary }]}>
                Our provider support team is available Mon-Fri, 9AM-6PM PST
              </ThemedText>
            </View>
            <Pressable style={[styles.supportButton, { backgroundColor: Colors.accent }]}>
              <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Chat</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  heroTitle: {
    ...Typography.title2,
    fontWeight: "700",
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  heroSubtitle: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
  },
  sectionTitle: {
    ...Typography.footnote,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  resourcesGrid: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  resourceCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
  },
  resourceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  resourceIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  typeText: {
    ...Typography.caption2,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  resourceTitle: {
    ...Typography.headline,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  resourceDescription: {
    ...Typography.subhead,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  resourceFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  quickLinksCard: {
    marginBottom: Spacing.xl,
    overflow: "hidden",
  },
  quickLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
  },
  quickLinkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  quickLinkText: {
    ...Typography.body,
  },
  supportCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.card,
    gap: Spacing.md,
  },
  supportInfo: {
    flex: 1,
  },
  supportTitle: {
    ...Typography.headline,
    fontWeight: "600",
    marginBottom: 2,
  },
  supportText: {
    ...Typography.caption1,
  },
  supportButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
});
