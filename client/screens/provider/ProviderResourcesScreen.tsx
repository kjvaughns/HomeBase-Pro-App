import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

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
  const [cacheLoaded, setCacheLoaded] = useState(false);
  // `null` means we haven't determined connectivity yet (treat as online so we
  // don't flash the offline state on first render).
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(RESOURCES_CACHE_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Resource[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCachedResources(parsed);
            }
          } catch {
            // Ignore corrupted cache
          }
        }
        setCacheLoaded(true);
      })
      .catch(() => {
        if (active) setCacheLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const apply = (state: NetInfoState) => {
      // `isInternetReachable` can be null on some platforms before the first
      // probe completes; treat null as "assume online" to avoid false offline.
      const reachable =
        state.isInternetReachable === null ? true : state.isInternetReachable;
      setIsOnline(Boolean(state.isConnected) && reachable);
    };
    NetInfo.fetch().then(apply).catch(() => setIsOnline(true));
    const unsubscribe = NetInfo.addEventListener(apply);
    return unsubscribe;
  }, []);

  const {
    data: remoteResources,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery<Resource[]>({
    queryKey: ["/api/provider-resources"],
    queryFn: async () => {
      const url = new URL("/api/provider-resources", getApiUrl());
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load resources: ${res.status}`);
      const json = (await res.json()) as { resources: Resource[] };
      return json.resources;
    },
    staleTime: 1000 * 60 * 10,
    // Skip the network request entirely when we know we're offline; the cached
    // list (if any) will still render and refetch will resume when we go back
    // online.
    enabled: isOnline !== false,
    retry: 1,
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
        : [];

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

  // Decide which state to render for the resources section.
  // Order of precedence:
  //  1. We have resources (from server or cache) → show them.
  //  2. Still loading initial data (cache or first fetch) → spinner.
  //  3. Device is offline with no cache → offline placeholder.
  //  4. Online but request failed → error state with retry.
  //  5. Online but server returned an empty list → empty state with retry.
  const hasResources = resources.length > 0;
  const initialLoading =
    !hasResources && (!cacheLoaded || (isLoading && isOnline !== false));
  const showOffline = !hasResources && isOnline === false && cacheLoaded;
  const showError =
    !hasResources && !initialLoading && !showOffline && isError;
  const showEmpty =
    !hasResources &&
    !initialLoading &&
    !showOffline &&
    !showError &&
    remoteResources !== undefined;

  const renderResourcesSection = () => {
    if (hasResources) {
      return (
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
      );
    }

    if (initialLoading) {
      return (
        <View testID="resources-loading" style={styles.statusCard}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      );
    }

    if (showOffline) {
      return (
        <GlassCard style={styles.statusCard} testID="resources-offline">
          <View style={[styles.statusIcon, { backgroundColor: theme.textSecondary + "15" }]}>
            <Feather name="wifi-off" size={24} color={theme.textSecondary} />
          </View>
          <ThemedText style={styles.statusTitle}>You&apos;re offline</ThemedText>
          <ThemedText style={[styles.statusText, { color: theme.textSecondary }]}>
            Reconnect to the internet to load the latest guides, articles, and tools from our marketing team.
          </ThemedText>
        </GlassCard>
      );
    }

    if (showError) {
      return (
        <GlassCard style={styles.statusCard} testID="resources-error">
          <View style={[styles.statusIcon, { backgroundColor: Colors.error + "15" }]}>
            <Feather name="alert-circle" size={24} color={Colors.error} />
          </View>
          <ThemedText style={styles.statusTitle}>Couldn&apos;t load resources</ThemedText>
          <ThemedText style={[styles.statusText, { color: theme.textSecondary }]}>
            Something went wrong loading the latest guides and articles. Please try again.
          </ThemedText>
          <Pressable
            testID="button-retry-resources"
            onPress={() => refetch()}
            style={[styles.retryButton, { backgroundColor: Colors.accent }]}
            disabled={isFetching}
          >
            {isFetching ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
            )}
          </Pressable>
        </GlassCard>
      );
    }

    if (showEmpty) {
      return (
        <GlassCard style={styles.statusCard} testID="resources-empty">
          <View style={[styles.statusIcon, { backgroundColor: theme.textSecondary + "15" }]}>
            <Feather name="inbox" size={24} color={theme.textSecondary} />
          </View>
          <ThemedText style={styles.statusTitle}>No resources yet</ThemedText>
          <ThemedText style={[styles.statusText, { color: theme.textSecondary }]}>
            New guides and articles from our marketing team will appear here. Check back soon.
          </ThemedText>
          <Pressable
            testID="button-refresh-resources"
            onPress={() => refetch()}
            style={[styles.retryButton, { backgroundColor: Colors.accent }]}
            disabled={isFetching}
          >
            {isFetching ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText style={styles.retryButtonText}>Refresh</ThemedText>
            )}
          </Pressable>
        </GlassCard>
      );
    }

    return null;
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
          {renderResourcesSection()}
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
  statusCard: {
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  statusTitle: {
    ...Typography.headline,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  statusText: {
    ...Typography.subhead,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  retryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
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
