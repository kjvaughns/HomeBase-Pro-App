import React from "react";
import { ScrollView, StyleSheet, View, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Avatar } from "@/components/Avatar";
import { ListRow } from "@/components/ListRow";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { useLayout } from "@/hooks/useLayout";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useThemeStore } from "@/state/themeStore";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export default function CrewMoreScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme, isDark } = useTheme();
  const { horizontalPadding } = useLayout();
  const toggleDarkMode = useThemeStore((s) => s.toggleDarkMode);

  const {
    user,
    crewMemberships,
    activeCrewProviderId,
    setActiveCrewProvider,
    canAccessProviderMode,
    setActiveRole,
    setNeedsRoleSelection,
    logout,
  } = useAuthStore();

  const active = crewMemberships.find(
    (m) => m.providerId === activeCrewProviderId,
  );

  const handleSwitchToHomeowner = () => {
    setActiveCrewProvider(null);
    setActiveRole("homeowner");
    setNeedsRoleSelection(false);
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  };

  const handleSwitchToProvider = () => {
    if (!canAccessProviderMode()) return;
    setActiveCrewProvider(null);
    setActiveRole("provider");
    setNeedsRoleSelection(false);
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  };

  const handleSwitchToOtherCrew = (providerId: string) => {
    setActiveCrewProvider(providerId);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: horizontalPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(0).duration(220)}>
          <GlassCard style={styles.profileCard}>
            <View style={styles.profileContent}>
              <Avatar uri={user?.avatarUrl} name={user?.name} size="large" />
              <View style={styles.profileInfo}>
                <ThemedText style={styles.profileName}>{user?.name}</ThemedText>
                <ThemedText
                  style={[styles.profileEmail, { color: theme.textSecondary }]}
                >
                  {user?.email}
                </ThemedText>
                {active ? (
                  <View style={styles.roleRow}>
                    <Feather name="users" size={13} color={Colors.accent} />
                    <ThemedText style={styles.roleText}>
                      Crew · {active.providerName}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(40).duration(220)}>
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            Switch View
          </ThemedText>
          <View
            style={[styles.section, { backgroundColor: theme.cardBackground }]}
          >
            <ListRow
              title="Homeowner Mode"
              subtitle="Manage your own home services"
              leftIcon="home"
              onPress={handleSwitchToHomeowner}
              isFirst
            />
            {canAccessProviderMode() ? (
              <ListRow
                title="Provider Mode"
                subtitle="Run your business"
                leftIcon="briefcase"
                onPress={handleSwitchToProvider}
              />
            ) : null}
            {crewMemberships
              .filter((m) => m.providerId !== activeCrewProviderId)
              .map((m, idx, arr) => (
                <ListRow
                  key={m.providerId}
                  title={`Crew · ${m.providerName}`}
                  leftIcon="users"
                  onPress={() => handleSwitchToOtherCrew(m.providerId)}
                  isLast={idx === arr.length - 1}
                />
              ))}
            {crewMemberships.filter((m) => m.providerId !== activeCrewProviderId)
              .length === 0 ? (
              <View style={{ height: 0 }} />
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(220)}>
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            Grow Your Career
          </ThemedText>
          <View
            style={[styles.section, { backgroundColor: theme.cardBackground }]}
          >
            <ListRow
              title="Start Your Own Business"
              subtitle="Launch your HomeBase provider account"
              leftIcon="briefcase"
              onPress={() => navigation.navigate("BecomeProvider")}
              isFirst
              isLast
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(220)}>
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            Account
          </ThemedText>
          <View
            style={[styles.section, { backgroundColor: theme.cardBackground }]}
          >
            <ListRow
              title="Account & Security"
              leftIcon="shield"
              onPress={() => navigation.navigate("AccountSecurity")}
              isFirst
              isLast
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(220)}>
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            Appearance
          </ThemedText>
          <View
            style={[styles.section, { backgroundColor: theme.cardBackground }]}
          >
            <View style={styles.switchRow}>
              <ListRow
                title="Dark Mode"
                leftIcon="moon"
                showChevron={false}
                isFirst
                isLast
              />
              <View style={styles.switchContainer}>
                <Switch
                  value={isDark}
                  onValueChange={toggleDarkMode}
                  trackColor={{
                    false: theme.backgroundTertiary,
                    true: Colors.accent,
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(220)}>
          <View
            style={[
              styles.section,
              {
                backgroundColor: theme.cardBackground,
                marginTop: Spacing.lg,
              },
            ]}
          >
            <ListRow
              title="Sign Out"
              leftIcon="log-out"
              destructive
              showChevron={false}
              onPress={logout}
              isFirst
              isLast
            />
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileCard: { marginBottom: Spacing.xl },
  profileContent: { flexDirection: "row", alignItems: "center" },
  profileInfo: { flex: 1, marginLeft: Spacing.lg },
  profileName: { ...Typography.title3 },
  profileEmail: { ...Typography.subhead, marginTop: 2 },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.xs,
  },
  roleText: {
    ...Typography.caption,
    color: Colors.accent,
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
  switchRow: { position: "relative" },
  switchContainer: {
    position: "absolute",
    right: Spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});
