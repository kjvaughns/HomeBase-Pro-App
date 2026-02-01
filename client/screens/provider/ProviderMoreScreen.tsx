import React from "react";
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
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useProviderStore } from "@/state/providerStore";

export default function ProviderMoreScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user, providerProfile, logout } = useAuthStore();

  const availableForWork = useProviderStore((s) => s.availableForWork);
  const notificationsEnabled = useProviderStore((s) => s.notificationsEnabled);
  const setAvailableForWork = useProviderStore((s) => s.setAvailableForWork);
  const setNotificationsEnabled = useProviderStore((s) => s.setNotificationsEnabled);

  const { setActiveRole, setNeedsRoleSelection } = useAuthStore();

  const handleSwitchToHomeowner = () => {
    setActiveRole("homeowner");
    setNeedsRoleSelection(false);
    navigation.reset({
      index: 0,
      routes: [{ name: "HomeTabs" }],
    });
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassCard style={styles.profileCard} onPress={() => {}}>
            <View style={styles.profileContent}>
              <Avatar uri={user?.avatarUrl} name={user?.name} size="large" showBadge />
              <View style={styles.profileInfo}>
                <ThemedText style={styles.profileName}>
                  {providerProfile?.businessName || user?.name}
                </ThemedText>
                <ThemedText style={[styles.profileEmail, { color: theme.textSecondary }]}>
                  {user?.email}
                </ThemedText>
                <View style={styles.roleRow}>
                  <StatusPill status="success" label="Provider" size="small" />
                  <View style={styles.ratingRow}>
                    <Feather name="star" size={14} color={Colors.warning} />
                    <ThemedText style={styles.ratingText}>
                      {providerProfile?.rating || 4.9}
                    </ThemedText>
                  </View>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textTertiary} />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Business
          </ThemedText>
          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.switchRow}>
              <ListRow
                title="Available for Work"
                subtitle="Accept new job requests"
                leftIcon="toggle-left"
                showChevron={false}
                isFirst
              />
              <View style={styles.switchContainer}>
                <Switch
                  value={availableForWork}
                  onValueChange={setAvailableForWork}
                  trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
            <ListRow
              title="AI Service Builder"
              subtitle="Create optimized service listings"
              leftIcon="cpu"
              onPress={() => navigation.navigate("Services")}
            />
            <ListRow
              title="Public Booking Page"
              subtitle="Shareable profile for clients"
              leftIcon="link"
              onPress={() => navigation.navigate("BusinessProfile")}
            />
            <ListRow
              title="Business Details"
              subtitle="Policies, areas, hours"
              leftIcon="settings"
              onPress={() => navigation.navigate("BusinessDetails")}
              isLast
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Account
          </ThemedText>
          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <ListRow
              title="Accounting"
              subtitle="Bank account & tax info"
              leftIcon="credit-card"
              onPress={() => navigation.navigate("Accounting")}
              isFirst
            />
            <ListRow
              title="Reviews"
              subtitle={`${providerProfile?.reviewCount || 45} reviews`}
              leftIcon="star"
              onPress={() => navigation.navigate("Reviews")}
              isLast
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Settings
          </ThemedText>
          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.switchRow}>
              <ListRow
                title="Notifications"
                leftIcon="bell"
                showChevron={false}
                isFirst
              />
              <View style={styles.switchContainer}>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
            <ListRow
              title="Switch to Homeowner Mode"
              subtitle="Browse and book services"
              leftIcon="home"
              onPress={handleSwitchToHomeowner}
              isLast
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Support
          </ThemedText>
          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <ListRow
              title="Provider Resources"
              subtitle="Guides, tips & best practices"
              leftIcon="book"
              onPress={() => navigation.navigate("ProviderResources")}
              isFirst
            />
            <ListRow
              title="Help Center"
              leftIcon="help-circle"
              onPress={() => navigation.navigate("HelpCenter")}
            />
            <ListRow
              title="Contact Support"
              leftIcon="message-circle"
              onPress={() => navigation.navigate("ContactUs")}
              isLast
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
          <View style={[styles.section, { backgroundColor: theme.cardBackground, marginTop: Spacing.lg }]}>
            <ListRow
              title="Sign Out"
              leftIcon="log-out"
              destructive
              showChevron={false}
              onPress={handleLogout}
              isFirst
              isLast
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(700).duration(400)}>
          <ThemedText style={[styles.version, { color: theme.textTertiary }]}>
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
  profileName: {
    ...Typography.title3,
  },
  profileEmail: {
    ...Typography.subhead,
    marginTop: 2,
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
  ratingText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  sectionTitle: {
    ...Typography.footnote,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  section: {
    borderRadius: BorderRadius.card,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  switchRow: {
    position: "relative",
  },
  switchContainer: {
    position: "absolute",
    right: Spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  version: {
    ...Typography.caption1,
    textAlign: "center",
    marginTop: Spacing.xl,
  },
});
