import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Avatar } from "@/components/Avatar";
import { ListRow } from "@/components/ListRow";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";

export default function ProviderMoreScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user, providerProfile, setActiveRole, logout } = useAuthStore();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [availableForWork, setAvailableForWork] = useState(true);

  const handleSwitchToHomeowner = () => {
    navigation.navigate("RoleSwitchConfirmation", { targetRole: "homeowner" });
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassCard style={styles.profileCard}>
            <View style={styles.profileContent}>
              <Avatar uri={user?.avatarUrl} name={user?.name} size="large" showBadge />
              <View style={styles.profileInfo}>
                <ThemedText type="h2">
                  {providerProfile?.businessName || user?.name}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {user?.email}
                </ThemedText>
                <View style={styles.roleRow}>
                  <StatusPill status="success" label="Provider" />
                  <View style={styles.ratingRow}>
                    <Feather name="star" size={14} color="#F59E0B" />
                    <ThemedText type="label">
                      {providerProfile?.rating || 4.9}
                    </ThemedText>
                  </View>
                </View>
              </View>
              <Feather name="edit-2" size={20} color={theme.textSecondary} />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <ThemedText type="label" style={styles.sectionTitle}>
            Business
          </ThemedText>
          <View
            style={[
              styles.section,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <ListRow
              title="Available for Work"
              subtitle="Accept new job requests"
              leftIcon="toggle-left"
              showChevron={false}
              rightElement={
                <Switch
                  value={availableForWork}
                  onValueChange={setAvailableForWork}
                  trackColor={{ false: theme.border, true: Colors.accent }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ListRow
              title="Services & Pricing"
              leftIcon="tool"
              onPress={() => {}}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ListRow
              title="Service Areas"
              leftIcon="map"
              onPress={() => {}}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ListRow
              title="Business Hours"
              leftIcon="clock"
              onPress={() => {}}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <ThemedText type="label" style={styles.sectionTitle}>
            Account
          </ThemedText>
          <View
            style={[
              styles.section,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <ListRow
              title="Bank Account"
              leftIcon="credit-card"
              onPress={() => {}}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ListRow
              title="Tax Information"
              leftIcon="file-text"
              onPress={() => {}}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ListRow
              title="Reviews"
              subtitle={`${providerProfile?.reviewCount || 45} reviews`}
              leftIcon="star"
              onPress={() => {}}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <ThemedText type="label" style={styles.sectionTitle}>
            Settings
          </ThemedText>
          <View
            style={[
              styles.section,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <ListRow
              title="Notifications"
              leftIcon="bell"
              showChevron={false}
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: theme.border, true: Colors.accent }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ListRow
              title="Switch to Homeowner Mode"
              subtitle="Browse and book services"
              leftIcon="home"
              onPress={handleSwitchToHomeowner}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <ThemedText type="label" style={styles.sectionTitle}>
            Support
          </ThemedText>
          <View
            style={[
              styles.section,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <ListRow
              title="Provider Resources"
              leftIcon="book"
              onPress={() => {}}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ListRow
              title="Help Center"
              leftIcon="help-circle"
              onPress={() => {}}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ListRow
              title="Contact Support"
              leftIcon="message-circle"
              onPress={() => {}}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
          <View
            style={[
              styles.section,
              { backgroundColor: theme.backgroundDefault, marginTop: Spacing.xl },
            ]}
          >
            <ListRow
              title="Sign Out"
              leftIcon="log-out"
              destructive
              showChevron={false}
              onPress={handleLogout}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(700).duration(400)}>
          <ThemedText
            type="caption"
            style={[styles.version, { color: theme.textTertiary }]}
          >
            Version 1.0.0
          </ThemedText>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    marginBottom: Spacing.xl,
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    color: "#6B7280",
  },
  section: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  divider: {
    height: 1,
    marginLeft: Spacing.lg + 36 + Spacing.md,
  },
  version: {
    textAlign: "center",
    marginTop: Spacing.xl,
  },
});
