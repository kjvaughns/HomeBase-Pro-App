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
import { useNavigation } from "@react-navigation/native";
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
  url: string;
}

const RESOURCES: Resource[] = [
  {
    id: "1",
    icon: "book-open",
    title: "Getting Started on HomeBase",
    description:
      "Complete your Business Hub profile, add services with clear pricing, create a public booking link, and connect Stripe to accept payments. A complete profile receives 3x more client inquiries.",
    type: "guide",
    url: "https://homebaseproapp.com/faqpage",
  },
  {
    id: "2",
    icon: "dollar-sign",
    title: "Setting Your Rates",
    description:
      "Research local market rates and factor in labor, materials, overhead, and a 15-20% profit margin. Update your pricing quarterly as material costs change to stay competitive and profitable.",
    type: "article",
    url: "https://homebaseproapp.com/faqpage",
  },
  {
    id: "3",
    icon: "star",
    title: "Winning 5-Star Reviews",
    description:
      "Send a reminder message 24 hours before arrival, arrive on time, take before-and-after photos of your work, and follow up the next day. Satisfied clients become long-term repeat clients.",
    type: "article",
    url: "https://homebaseproapp.com/faqpage",
  },
  {
    id: "4",
    icon: "camera",
    title: "Photographing Your Work",
    description:
      "Use natural lighting and capture wide shots plus close-up detail of finished work. Before-and-after photos can increase booking rates by up to 40%. Keep your phone steady — a small tripod helps.",
    type: "guide",
    url: "https://homebaseproapp.com/faqpage",
  },
  {
    id: "5",
    icon: "shield",
    title: "Business Insurance Guide",
    description:
      "Maintain at least $1M general liability coverage. Add workers' comp if you have employees, and a tools-and-equipment policy for high-value gear. Upload proof of insurance in your Business Hub to build trust.",
    type: "guide",
    url: "https://homebaseproapp.com/faqpage",
  },
  {
    id: "6",
    icon: "bar-chart-2",
    title: "Understanding Your Stats",
    description:
      "Your HomeBase dashboard tracks conversion rate, average job value, repeat-client rate, and total revenue. Review your stats weekly to spot trends and find opportunities to grow your business.",
    type: "tool",
    url: "https://homebaseproapp.com/faqpage",
  },
  {
    id: "7",
    icon: "calendar",
    title: "Managing Your Schedule",
    description:
      "Set your business hours to control when clients can book. Use minimum advance booking windows to avoid last-minute rushes, and block personal time to maintain work-life balance.",
    type: "article",
    url: "https://homebaseproapp.com/faqpage",
  },
  {
    id: "8",
    icon: "zap",
    title: "Getting Paid Faster",
    description:
      "Connect Stripe in your Business Hub to enable online payments. Require a deposit on booking links for larger jobs. Send invoices within 1 hour of job completion — faster invoicing means faster payment.",
    type: "guide",
    url: "https://homebaseproapp.com/faqpage",
  },
];

type QuickLink =
  | { icon: keyof typeof Feather.glyphMap; label: string; type: "url"; url: string }
  | { icon: keyof typeof Feather.glyphMap; label: string; type: "navigate"; screen: string };

const QUICK_LINKS: QuickLink[] = [
  {
    icon: "file-text",
    label: "Terms of Service",
    type: "url",
    url: "https://homebaseproapp.com/termsofservice",
  },
  {
    icon: "lock",
    label: "Privacy Policy",
    type: "url",
    url: "https://homebaseproapp.com/privacy",
  },
  {
    icon: "help-circle",
    label: "FAQ",
    type: "url",
    url: "https://homebaseproapp.com/faqpage",
  },
  {
    icon: "headphones",
    label: "Contact Support",
    type: "navigate",
    screen: "ContactUs",
  },
];

export default function ProviderResourcesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

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
    Linking.openURL(resource.url);
  };

  const handleQuickLink = (link: QuickLink) => {
    if (link.type === "url") {
      Linking.openURL(link.url);
    } else {
      navigation.navigate(link.screen);
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
              Everything you need to succeed on HomeBase — from getting started to growing a thriving business.
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
                  testID={`resource-${resource.id}`}
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
                testID={`quicklink-${link.label}`}
                style={[
                  styles.quickLinkRow,
                  index < QUICK_LINKS.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.borderLight,
                  },
                ]}
                onPress={() => handleQuickLink(link)}
              >
                <View style={styles.quickLinkLeft}>
                  <Feather name={link.icon} size={18} color={theme.textSecondary} />
                  <ThemedText style={styles.quickLinkText}>{link.label}</ThemedText>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textTertiary} />
              </Pressable>
            ))}
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).duration(300)}>
          <Pressable
            testID="button-contact-support"
            style={[styles.supportCard, { backgroundColor: Colors.accent + "10" }]}
            onPress={() => navigation.navigate("ContactUs")}
          >
            <Feather name="headphones" size={24} color={Colors.accent} />
            <View style={styles.supportInfo}>
              <ThemedText style={styles.supportTitle}>Need Help?</ThemedText>
              <ThemedText style={[styles.supportText, { color: theme.textSecondary }]}>
                Our support team typically responds within 24 hours
              </ThemedText>
            </View>
            <View style={[styles.supportButton, { backgroundColor: Colors.accent }]}>
              <ThemedText style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>Contact</ThemedText>
            </View>
          </Pressable>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
});
