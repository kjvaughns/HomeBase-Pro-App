import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { ListRow } from "@/components/ListRow";
import { StatusPill } from "@/components/StatusPill";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";

interface StripeStatus {
  status: "not_started" | "pending" | "complete" | "restricted";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountId?: string;
}

export default function AccountingScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();

  const providerId = providerProfile?.id;

  const { data: stripeData, isLoading } = useQuery<{ connectStatus: StripeStatus }>({
    queryKey: ["/api/stripe/connect/status"],
    enabled: !!providerId,
    retry: false,
  });

  const connectStatus = stripeData?.connectStatus;
  const isConnected = connectStatus?.chargesEnabled && connectStatus?.payoutsEnabled;
  const isPending = connectStatus?.status === "pending";

  const getStatusPill = () => {
    if (!connectStatus || connectStatus.status === "not_started") {
      return <StatusPill status="warning" label="Not Connected" size="small" />;
    }
    if (isConnected) {
      return <StatusPill status="success" label="Active" size="small" />;
    }
    if (isPending) {
      return <StatusPill status="warning" label="In Review" size="small" />;
    }
    return <StatusPill status="error" label="Restricted" size="small" />;
  };

  const getStatusDescription = () => {
    if (!connectStatus || connectStatus.status === "not_started") {
      return "Connect your Stripe account to receive direct client payments, manage invoices, and get paid faster.";
    }
    if (isConnected) {
      return "Your Stripe account is fully set up. You can receive payments and send payouts.";
    }
    if (isPending) {
      return "Your account is under review. This usually takes 1-2 business days.";
    }
    return "Some features are restricted. Complete your Stripe onboarding to resolve this.";
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
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Feather name="zap" size={18} color={Colors.accent} />
                <ThemedText style={styles.sectionTitle}>Stripe Connect</ThemedText>
              </View>
              {getStatusPill()}
            </View>

            <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
              {getStatusDescription()}
            </ThemedText>

            {isConnected ? (
              <View style={styles.statsRow}>
                <View style={[styles.statBubble, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="check-circle" size={16} color={Colors.accent} />
                  <ThemedText style={[styles.statLabel, { color: Colors.accent }]}>
                    Payments enabled
                  </ThemedText>
                </View>
                <View style={[styles.statBubble, { backgroundColor: Colors.accentLight }]}>
                  <Feather name="send" size={16} color={Colors.accent} />
                  <ThemedText style={[styles.statLabel, { color: Colors.accent }]}>
                    Payouts enabled
                  </ThemedText>
                </View>
              </View>
            ) : null}

            <View style={[styles.menuSection, { backgroundColor: theme.backgroundSecondary }]}>
              <ListRow
                title="Stripe Account Setup"
                subtitle="Onboarding, identity, bank account"
                leftIcon="credit-card"
                onPress={() => navigation.navigate("StripeConnect")}
                isFirst
                isLast
              />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Feather name="file-plus" size={18} color={Colors.accent} />
                <ThemedText style={styles.sectionTitle}>Invoicing</ThemedText>
              </View>
            </View>

            <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
              Create professional invoices, send them directly to clients, and track payment status in one place.
            </ThemedText>

            <View style={[styles.menuSection, { backgroundColor: theme.backgroundSecondary }]}>
              <ListRow
                title="Create Invoice"
                subtitle="Bill clients with itemized invoices"
                leftIcon="file-plus"
                onPress={() => navigation.navigate("AddInvoice")}
                isFirst
              />
              <ListRow
                title="Invoice History"
                subtitle="View and manage all invoices"
                leftIcon="list"
                onPress={() => navigation.navigate("StripeConnect")}
                isLast
              />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Feather name="trending-up" size={18} color={Colors.accent} />
                <ThemedText style={styles.sectionTitle}>Earnings Overview</ThemedText>
              </View>
            </View>

            <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
              Track revenue, monitor trends, and understand your business performance over time.
            </ThemedText>

            <View style={[styles.menuSection, { backgroundColor: theme.backgroundSecondary }]}>
              <ListRow
                title="Payout History"
                subtitle="View all payouts to your bank account"
                leftIcon="send"
                onPress={() => navigation.navigate("StripeConnect")}
                isFirst
              />
              <ListRow
                title="Platform Credits"
                subtitle="Credits earned and applied"
                leftIcon="gift"
                onPress={() => navigation.navigate("StripeConnect")}
                isLast
              />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <View style={[styles.infoBox, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="lock" size={14} color={Colors.accent} />
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              All financial data is encrypted and secured by Stripe. HomeBase never stores your banking credentials.
            </ThemedText>
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
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.headline,
  },
  description: {
    ...Typography.body,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    flexWrap: "wrap",
  },
  statBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  statLabel: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  menuSection: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoText: {
    ...Typography.caption1,
    flex: 1,
    lineHeight: 18,
  },
});
