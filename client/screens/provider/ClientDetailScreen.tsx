import React, { useState, useMemo } from "react";
import { StyleSheet, View, ScrollView, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useProviderStore, Client, ClientActivity } from "@/state/providerStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type TabType = "overview" | "activity" | "billing";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface ActionButtonProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}

function ActionButton({ icon, label, onPress, primary }: ActionButtonProps) {
  const { theme } = useTheme();
  
  return (
    <Pressable
      style={[
        styles.actionButton,
        primary
          ? { backgroundColor: Colors.accent }
          : { backgroundColor: theme.cardBackground },
      ]}
      onPress={onPress}
    >
      <Feather name={icon} size={20} color={primary ? "#FFFFFF" : theme.text} />
    </Pressable>
  );
}

interface TabButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function TabButton({ label, active, onPress }: TabButtonProps) {
  const { theme } = useTheme();
  
  return (
    <Pressable
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
    >
      <ThemedText
        type="body"
        style={{ color: active ? Colors.accent : theme.textSecondary }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

interface ActivityRowProps {
  activity: ClientActivity;
}

function ActivityRow({ activity }: ActivityRowProps) {
  const { theme } = useTheme();
  
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityDot, { backgroundColor: theme.textSecondary }]} />
      <View style={styles.activityContent}>
        <ThemedText type="body">{activity.description}</ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {activity.timestamp}
        </ThemedText>
      </View>
    </View>
  );
}

export default function ClientDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, "ClientDetail">>();
  const { clientId } = route.params;

  const clients = useProviderStore((s) => s.clients);
  const clientActivities = useProviderStore((s) => s.clientActivities);
  const invoices = useProviderStore((s) => s.invoices);

  const client = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId]
  );

  const activities = useMemo(
    () => clientActivities.filter((a) => a.clientId === clientId),
    [clientActivities, clientId]
  );

  const [activeTab, setActiveTab] = useState<TabType>("overview");

  if (!client) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Client not found</ThemedText>
      </ThemedView>
    );
  }

  const handleCall = () => {
    Linking.openURL(`tel:${client.phone}`);
  };

  const handleMessage = () => {
    Linking.openURL(`sms:${client.phone}`);
  };

  const handleInvoice = () => {
    // Navigate to create invoice
  };

  const renderOverview = () => (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <ThemedText type="label" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        Recent Activity
      </ThemedText>
      {activities.length > 0 ? (
        activities.slice(0, 5).map((activity) => (
          <ActivityRow key={activity.id} activity={activity} />
        ))
      ) : (
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          No recent activity
        </ThemedText>
      )}

      <ThemedText
        type="label"
        style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}
      >
        Details
      </ThemedText>
      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Email
          </ThemedText>
          <ThemedText type="body">{client.email}</ThemedText>
        </View>
        <View style={styles.detailItem}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Phone
          </ThemedText>
          <ThemedText type="body">{client.phone}</ThemedText>
        </View>
        {client.address ? (
          <View style={[styles.detailItem, { flex: 1, minWidth: "100%" }]}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Address
            </ThemedText>
            <ThemedText type="body">{client.address}</ThemedText>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );

  const renderActivity = () => (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <ThemedText type="label" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        All Activity
      </ThemedText>
      {activities.length > 0 ? (
        activities.map((activity) => (
          <ActivityRow key={activity.id} activity={activity} />
        ))
      ) : (
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          No activity recorded
        </ThemedText>
      )}
    </Animated.View>
  );

  const renderBilling = () => (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <ThemedText type="label" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        Billing Summary
      </ThemedText>
      <GlassCard style={styles.billingCard}>
        <View style={styles.billingRow}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Lifetime Value
          </ThemedText>
          <ThemedText type="h2" style={{ color: Colors.accent }}>
            ${client.ltv.toLocaleString()}
          </ThemedText>
        </View>
        <View style={styles.billingRow}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Total Jobs
          </ThemedText>
          <ThemedText type="h3">{client.jobCount}</ThemedText>
        </View>
        {client.clientSince ? (
          <View style={styles.billingRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Client Since
            </ThemedText>
            <ThemedText type="body">{client.clientSince}</ThemedText>
          </View>
        ) : null}
      </GlassCard>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: Colors.accent + "20" }]}>
            {client.avatar ? (
              <Animated.Image source={{ uri: client.avatar }} style={styles.avatarImage} />
            ) : (
              <ThemedText type="h1" style={{ color: Colors.accent }}>
                {getInitials(client.name)}
              </ThemedText>
            )}
          </View>
          <ThemedText type="h2" style={styles.clientName}>
            {client.name}
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {client.clientSince
              ? `Client since ${client.clientSince}`
              : "Potential client"}{" "}
            {client.ltv > 0 ? `| LTV $${client.ltv.toLocaleString()}` : ""}
          </ThemedText>

          <View style={styles.actionButtons}>
            <ActionButton icon="phone" label="Call" onPress={handleCall} />
            <ActionButton icon="message-circle" label="Message" onPress={handleMessage} primary />
            <ActionButton icon="file-text" label="Invoice" onPress={handleInvoice} />
          </View>
        </Animated.View>

        <View style={[styles.tabBar, { borderBottomColor: theme.separator }]}>
          <TabButton
            label="Overview"
            active={activeTab === "overview"}
            onPress={() => setActiveTab("overview")}
          />
          <TabButton
            label="Activity"
            active={activeTab === "activity"}
            onPress={() => setActiveTab("activity")}
          />
          <TabButton
            label="Billing"
            active={activeTab === "billing"}
            onPress={() => setActiveTab("billing")}
          />
        </View>

        <View style={styles.tabContent}>
          {activeTab === "overview" && renderOverview()}
          {activeTab === "activity" && renderActivity()}
          {activeTab === "billing" && renderBilling()}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
  },
  clientName: {
    marginBottom: Spacing.xs,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
  },
  tabContent: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  activityContent: {
    flex: 1,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  detailItem: {
    minWidth: "45%",
  },
  billingCard: {
    gap: Spacing.md,
  },
  billingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
