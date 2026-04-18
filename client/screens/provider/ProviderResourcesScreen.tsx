import React, { useEffect, useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getApiUrl } from "@/lib/query-client";
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

const RESOURCES_CACHE_KEY = "@homebase/provider-resources-cache-v1";

/**
 * Minimal cold-start fallback used only when the device has never reached
 * the server (no AsyncStorage cache) and is offline. The server owns the
 * authoritative content; this list exists purely so the screen is never
 * empty on a brand-new install with no connectivity.
 */
const COLD_START_FALLBACK: Resource[] = [
  {
    id: "cold-start-1",
    icon: "book-open",
    title: "Getting Started on HomeBase",
    description:
      "Complete your Business Hub profile, add services with clear pricing, create a public booking link, and connect Stripe to accept payments.",
    type: "guide",
    url: "https://homebaseproapp.com/blog/getting-started-on-homebase",
  },
  {
    id: "cold-start-2",
    icon: "wifi-off",
    title: "Reconnect to load the latest articles",
    description:
      "Provider Resources are kept up to date by our marketing team. Reconnect to the internet to load the latest guides, articles, and tools.",
    type: "article",
    url: "https://homebaseproapp.com/blog",
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
    url: "https://homebaseproapp.com/terms",
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

  const [cachedResources, setCachedResources] = useState<Resource[] | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(RESOURCES_CACHE_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        try {
          const parsed = JSON.parse(raw) as Resource[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCachedResources(parsed);
          }
        } catch {
          // Ignore corrupted cache
        }
      })
      .catch(() => {
        // Ignore cache read errors
      });
    return () => {
      active = false;
    };
  }, []);

  const { data: remoteResources } = useQuery<Resource[]>({
    queryKey: ["/api/provider-resources"],
    queryFn: async () => {
      const url = new URL("/api/provider-resources", getApiUrl());
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load resources: ${res.status}`);
      const json = (await res.json()) as { resources: Resource[] };
      return json.resources;
    },
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (remoteResources && remoteResources.length > 0) {
      AsyncStorage.setItem(
        RESOURCES_CACHE_KEY,
        JSON.stringify(remoteResources),
      ).catch(() => {
        // Ignore cache write errors
      });
    }
  }, [remoteResources]);

  const resources: Resource[] =
    remoteResources && remoteResources.length > 0
      ? remoteResources
      : cachedResources && cachedResources.length > 0
        ? cachedResources
        : COLD_START_FALLBACK;

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
            {resources.map((resource, index) => (
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
