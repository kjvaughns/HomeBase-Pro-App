import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Switch, Alert } from "react-native";
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
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
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
    activeRole,
    providerProfile,
    hasProviderProfile,
    canAccessProviderMode,
    setActiveRole,
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
                <ThemedText type="h2">Welcome to Homebase</ThemedText>
                <ThemedText
                  type="body"
                  style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
                >
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
        <GlassCard style={styles.profileCard}>
          <View style={styles.profileContent}>
            <Avatar uri={user?.avatarUrl} name={user?.name} size="large" />
            <View style={styles.profileInfo}>
              <ThemedText type="h2">{user?.name}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {user?.email}
              </ThemedText>
              <View style={styles.roleIndicator}>
                <Feather name="home" size={14} color={Colors.accent} />
                <ThemedText type="caption" style={{ color: Colors.accent }}>
                  Homeowner
                </ThemedText>
              </View>
            </View>
            <Feather name="edit-2" size={20} color={theme.textSecondary} />
          </View>
        </GlassCard>
      </Animated.View>
    );
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
        {renderProfileSection()}

        {isAuthenticated ? (
          <>
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
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
                  title="Payment Methods"
                  leftIcon="credit-card"
                  onPress={() => {}}
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <ListRow
                  title="Addresses"
                  leftIcon="map-pin"
                  onPress={() => {}}
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <ListRow
                  title="Saved Providers"
                  leftIcon="heart"
                  onPress={() => {}}
                />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
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
                {hasProviderProfile() && canAccessProviderMode() ? (
                  <ListRow
                    title="Switch to Provider Mode"
                    subtitle="Access your provider dashboard"
                    leftIcon="briefcase"
                    onPress={handleSwitchToProvider}
                  />
                ) : (
                  <ListRow
                    title="Become a Service Provider"
                    subtitle="Earn money by helping homeowners"
                    leftIcon="briefcase"
                    onPress={handleBecomeProvider}
                  />
                )}
              </View>
            </Animated.View>
          </>
        ) : null}

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
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
              title="Help Center"
              leftIcon="help-circle"
              onPress={() => {}}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ListRow
              title="Contact Us"
              leftIcon="message-circle"
              onPress={() => {}}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ListRow
              title="Terms of Service"
              leftIcon="file-text"
              onPress={() => {}}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ListRow
              title="Privacy Policy"
              leftIcon="shield"
              onPress={() => {}}
            />
          </View>
        </Animated.View>

        {isAuthenticated ? (
          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
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
        ) : null}

        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
          <ThemedText
            type="caption"
            style={[styles.version, { color: theme.textTertiary }]}
          >
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
  roleIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
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
