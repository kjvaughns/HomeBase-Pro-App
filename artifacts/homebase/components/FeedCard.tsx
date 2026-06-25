import React from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export interface FeedCardData {
  id: string;
  // Open string so the client renders new server-driven card types without
  // an app update. Known types get rich styling; unknown types fall back to
  // a generic presentation.
  type: string;
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaScreen?: string;
}

interface FeedCardItemProps {
  card: FeedCardData;
  onDismiss: (cardId: string) => void;
}

type CardStyle = { icon: React.ComponentProps<typeof Feather>["name"]; color: string; bg: string };

const CARD_CONFIG: Record<string, CardStyle> = {
  nearby_demand: { icon: "map-pin", color: "#6C63FF", bg: "#6C63FF18" },
  profile_insight: { icon: "eye", color: Colors.accent, bg: Colors.accentLight },
  milestone_approaching: { icon: "award", color: "#F59E0B", bg: "#F59E0B18" },
  optimization_tip: { icon: "zap", color: "#10B981", bg: "#10B98118" },
  recent_activity: { icon: "trending-up", color: "#EF4444", bg: "#EF444418" },
};

const DEFAULT_CARD_STYLE: CardStyle = { icon: "star", color: Colors.accent, bg: Colors.accentLight };

function FeedCardItem({ card, onDismiss }: FeedCardItemProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const cfg = CARD_CONFIG[card.type] ?? DEFAULT_CARD_STYLE;

  const handleCta = () => {
    if (card.ctaScreen) {
      navigation.navigate(card.ctaScreen as never);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon} size={16} color={cfg.color} />
        </View>
        <Pressable
          onPress={() => onDismiss(card.id)}
          hitSlop={10}
          style={styles.dismissBtn}
          testID={`feed-dismiss-${card.id}`}
          accessibilityLabel="Dismiss card"
        >
          <Feather name="x" size={14} color={theme.textTertiary} />
        </Pressable>
      </View>

      <ThemedText style={styles.headline} numberOfLines={2}>
        {card.headline}
      </ThemedText>
      <ThemedText style={[styles.body, { color: theme.textSecondary }]} numberOfLines={3}>
        {card.body}
      </ThemedText>

      {card.ctaLabel && card.ctaScreen ? (
        <Pressable
          onPress={handleCta}
          style={[styles.cta, { backgroundColor: cfg.bg }]}
          testID={`feed-cta-${card.id}`}
        >
          <ThemedText style={[styles.ctaText, { color: cfg.color }]}>
            {card.ctaLabel}
          </ThemedText>
          <Feather name="arrow-right" size={12} color={cfg.color} />
        </Pressable>
      ) : null}
    </View>
  );
}

interface ProviderFeedProps {
  cards: FeedCardData[];
  onDismiss: (cardId: string) => void;
}

export function ProviderFeed({ cards, onDismiss }: ProviderFeedProps) {
  const { theme } = useTheme();

  if (cards.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Today's Highlights</ThemedText>
        <View style={[styles.liveChip, { backgroundColor: Colors.accentLight }]}>
          <View style={[styles.liveDot, { backgroundColor: Colors.accent }]} />
          <ThemedText style={[styles.liveText, { color: Colors.accent }]}>Live</ThemedText>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID="provider-feed-scroll"
      >
        {cards.map((card) => (
          <FeedCardItem key={card.id} card={card} onDismiss={onDismiss} />
        ))}
      </ScrollView>
    </View>
  );
}

const CARD_WIDTH = 240;

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  scrollContent: {
    gap: Spacing.md,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissBtn: {
    padding: 4,
  },
  headline: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
