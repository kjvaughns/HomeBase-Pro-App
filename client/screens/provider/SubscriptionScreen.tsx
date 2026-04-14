import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";

export default function SubscriptionScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { providerProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const isFree = (providerProfile?.completedJobs ?? 0) === 0;

  const handleManage = useCallback(async () => {
    setLoading(true);
    try {
      await Linking.openURL("https://apps.apple.com/account/subscriptions");
    } catch {}
    finally { setLoading(false); }
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl * 2,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? "#1C2E24" : "#F0FAF4",
              borderColor: Colors.accent + "40",
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.badge, { backgroundColor: Colors.accent }]}>
                <ThemedText style={styles.badgeText}>PRO</ThemedText>
              </View>
              <ThemedText style={styles.planName}>HomeBase Pro</ThemedText>
            </View>
            <View style={styles.priceRow}>
              <ThemedText style={styles.price}>$29.99</ThemedText>
              <ThemedText style={[styles.priceUnit, { color: theme.textSecondary }]}>/mo</ThemedText>
            </View>
          </View>

          <View style={[styles.statusBanner, { backgroundColor: Colors.accentLight }]}>
            <Feather
              name={isFree ? "gift" : "check-circle"}
              size={15}
              color={Colors.accent}
            />
            <ThemedText style={[styles.statusText, { color: Colors.accent }]}>
              {isFree ? "Free until your first paid booking" : "Plan active — billed monthly"}
            </ThemedText>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: pressed ? Colors.accentPressed : Colors.accent },
            ]}
            onPress={handleManage}
            disabled={loading}
            testID="button-manage-subscription"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="settings" size={16} color="#fff" />
                <ThemedText style={styles.buttonText}>Manage Subscription</ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    borderRadius: BorderRadius.card,
    borderWidth: 1.5,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  planName: {
    ...Typography.headline,
    fontWeight: "700",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  price: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  priceUnit: {
    ...Typography.subhead,
    marginLeft: 2,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statusText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.button,
    paddingVertical: 14,
  },
  buttonText: {
    color: "#fff",
    ...Typography.callout,
    fontWeight: "700",
  },
});
