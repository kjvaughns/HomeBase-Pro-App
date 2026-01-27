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
import { PrimaryButton } from "@/components/PrimaryButton";
import { AccountGateModal } from "@/components/AccountGateModal";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const {
    isAuthenticated,
    user,
    hasProviderProfile,
    canAccessProviderMode,
    login,
    logout,
  } = useAuthStore();

  const [showAccountGate, setShowAccountGate] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleMockSignIn = () => {
    login({
      id: "1",
      name: "Alex Johnson",
      email: "alex@example.com",
    });
    setShowAccountGate(false);
  };

  const handleBecomeProvider = () => {
    navigation.navigate("BecomeProvider");
  };

  const handleSwitchToProvider = () => {
    if (canAccessProviderMode()) {
      navigation.navigate("RoleSwitchConfirmation", { targetRole: "provider" });
    }
  };

  const handleLogout = () => {
    logout();
  };

  const renderProfileSection = () => {
    if (!isAuthenticated) {
      return (
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassCard style={styles.profileCard}>
            <View style={styles.guestProfile}>
              <Avatar size="large" />
              <View style={styles.guestInfo}>
                <ThemedText style={styles.welcomeTitle}>Welcome to Homebase</ThemedText>
                <ThemedText style={[styles.welcomeSubtitle, { color: theme.textSecondary }]}>
                  Sign in to manage your home services
                </ThemedText>
                <PrimaryButton
                  onPress={() => setShowAccountGate(true)}
                  style={styles.signInButton}
                >
                  Sign In
                </PrimaryButton>
              </View>
            </View>
          </GlassCard>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <GlassCard style={styles.profileCard} onPress={() => {}}>
          <View style={styles.profileContent}>
            <Avatar uri={user?.avatarUrl} name={user?.name} size="large" />
            <View style={styles.profileInfo}>
              <ThemedText style={styles.profileName}>{user?.name}</ThemedText>
              <ThemedText style={[styles.profileEmail, { color: theme.textSecondary }]}>
                {user?.email}
              </ThemedText>
              <View style={styles.roleIndicator}>
                <Feather name="home" size={14} color={Colors.accent} />
                <ThemedText style={styles.roleText}>
                  Homeowner
                </ThemedText>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textTertiary} />
          </View>
        </GlassCard>
      </Animated.View>
    );
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
        {renderProfileSection()}

        {isAuthenticated ? (
          <>
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                Account
              </ThemedText>
              <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                <ListRow
                  title="Payment Methods"
                  leftIcon="credit-card"
                  onPress={() => {}}
                  isFirst
                />
                <ListRow
                  title="Addresses"
                  leftIcon="map-pin"
                  onPress={() => {}}
                />
                <ListRow
                  title="Saved Providers"
                  leftIcon="heart"
                  onPress={() => {}}
                  isLast
                />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                Settings
              </ThemedText>
              <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                <ListRow
                  title="Notifications"
                  leftIcon="bell"
                  showChevron={false}
                  isFirst
                  rightElement={
                    <Switch
                      value={notificationsEnabled}
                      onValueChange={setNotificationsEnabled}
                      trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                      thumbColor="#FFFFFF"
                    />
                  }
                />
                {hasProviderProfile() && canAccessProviderMode() ? (
                  <ListRow
                    title="Switch to Provider Mode"
                    subtitle="Access your provider dashboard"
                    leftIcon="briefcase"
                    onPress={handleSwitchToProvider}
                    isLast
                  />
                ) : (
                  <ListRow
                    title="Become a Service Provider"
                    subtitle="Earn money by helping homeowners"
                    leftIcon="briefcase"
                    onPress={handleBecomeProvider}
                    isLast
                  />
                )}
              </View>
            </Animated.View>
          </>
        ) : null}

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Support
          </ThemedText>
          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <ListRow
              title="Help Center"
              leftIcon="help-circle"
              onPress={() => {}}
              isFirst
            />
            <ListRow
              title="Contact Us"
              leftIcon="message-circle"
              onPress={() => {}}
            />
            <ListRow
              title="Terms of Service"
              leftIcon="file-text"
              onPress={() => {}}
            />
            <ListRow
              title="Privacy Policy"
              leftIcon="shield"
              onPress={() => {}}
              isLast
            />
          </View>
        </Animated.View>

        {isAuthenticated ? (
          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
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
        ) : null}

        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
          <ThemedText style={[styles.version, { color: theme.textTertiary }]}>
            Version 1.0.0
          </ThemedText>
        </Animated.View>
      </ScrollView>

      <AccountGateModal
        visible={showAccountGate}
        onClose={() => setShowAccountGate(false)}
        onSignIn={handleMockSignIn}
        onSignUp={handleMockSignIn}
      />
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
  guestProfile: {
    alignItems: "center",
  },
  guestInfo: {
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  welcomeTitle: {
    ...Typography.title2,
  },
  welcomeSubtitle: {
    ...Typography.subhead,
    marginTop: Spacing.xs,
  },
  signInButton: {
    marginTop: Spacing.lg,
    minWidth: 200,
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
  roleIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  roleText: {
    ...Typography.caption1,
    color: Colors.accent,
    fontWeight: "500",
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
  version: {
    ...Typography.caption1,
    textAlign: "center",
    marginTop: Spacing.xl,
  },
});
