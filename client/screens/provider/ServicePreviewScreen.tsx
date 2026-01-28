import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";

type ServicePreviewParams = {
  service: {
    name: string;
    category: string;
    description: string;
    pricingModel: string;
    price: string;
    duration: string;
  };
};

export default function ServicePreviewScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<RouteProp<{ params: ServicePreviewParams }, "params">>();

  const service = route.params?.service || {
    name: "Sample Service",
    category: "Cleaning",
    description: "This is how your service will appear to homeowners.",
    pricingModel: "fixed",
    price: "120",
    duration: "60",
  };

  const getPriceDisplay = () => {
    if (service.pricingModel === "quote") {
      return "Get Quote";
    }
    return `$${service.price || "0"}`;
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.previewBanner, { backgroundColor: Colors.accent + "15" }]}>
          <Feather name="eye" size={16} color={Colors.accent} />
          <ThemedText style={[styles.previewText, { color: Colors.accent }]}>
            This is how homeowners see your service
          </ThemedText>
        </View>

        <Animated.View entering={FadeInDown.delay(50).duration(300)}>
          <GlassCard style={styles.serviceCard}>
            <View style={styles.serviceHeader}>
              <View style={styles.serviceIconContainer}>
                <Feather name="star" size={20} color={Colors.accent} />
              </View>
              <View style={styles.serviceInfo}>
                <ThemedText type="h3" style={{ fontWeight: "700" }}>
                  {service.name || "Service Name"}
                </ThemedText>
                <ThemedText type="caption" style={{ color: Colors.accent }}>
                  {service.category || "Category"}
                </ThemedText>
              </View>
            </View>

            <ThemedText
              type="body"
              style={[styles.description, { color: theme.textSecondary }]}
            >
              {service.description || "Service description will appear here."}
            </ThemedText>

            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Feather name="clock" size={16} color={theme.textSecondary} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 6 }}>
                  {service.duration || "60"} mins
                </ThemedText>
              </View>
              <View style={styles.detailItem}>
                <Feather name="calendar" size={16} color={theme.textSecondary} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 6 }}>
                  Book anytime
                </ThemedText>
              </View>
            </View>

            <View style={styles.priceSection}>
              <View>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Starting from
                </ThemedText>
                <ThemedText type="h1" style={{ color: Colors.accent }}>
                  {getPriceDisplay()}
                </ThemedText>
              </View>
              <PrimaryButton onPress={() => {}} style={styles.bookButton}>
                Book Now
              </PrimaryButton>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <GlassCard style={styles.infoCard}>
            <ThemedText style={styles.sectionTitle}>WHAT'S INCLUDED</ThemedText>
            
            <View style={styles.checkItem}>
              <Feather name="check-circle" size={18} color={Colors.accent} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                Professional service by verified pro
              </ThemedText>
            </View>
            <View style={styles.checkItem}>
              <Feather name="check-circle" size={18} color={Colors.accent} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                All materials and equipment included
              </ThemedText>
            </View>
            <View style={styles.checkItem}>
              <Feather name="check-circle" size={18} color={Colors.accent} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                Satisfaction guaranteed
              </ThemedText>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <GlassCard style={styles.infoCard}>
            <ThemedText style={styles.sectionTitle}>INTAKE QUESTIONS</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Homeowners will be asked these questions during booking:
            </ThemedText>
            
            <View style={[styles.questionPreview, { backgroundColor: theme.backgroundElevated }]}>
              <ThemedText type="body">1. Do you have pets? (Yes/No)</ThemedText>
            </View>
          </GlassCard>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.screenPadding,
    gap: Spacing.md,
  },
  previewBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  previewText: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  serviceCard: {
    padding: Spacing.lg,
  },
  serviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  serviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent + "15",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  serviceInfo: {
    flex: 1,
  },
  description: {
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  detailsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  bookButton: {
    paddingHorizontal: Spacing.xl,
  },
  infoCard: {
    padding: Spacing.md,
  },
  sectionTitle: {
    ...Typography.caption1,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    opacity: 0.7,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  questionPreview: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
