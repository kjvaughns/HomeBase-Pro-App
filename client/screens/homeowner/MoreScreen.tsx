import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Switch, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
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
import { useThemeStore } from "@/state/themeStore";

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const {
    isAuthenticated,
    user,
    hasProviderProfile,
    canAccessProviderMode,
    logout,
    setActiveRole,
    setNeedsRoleSelection,
  } = useAuthStore();

  const [showAccountGate, setShowAccountGate] = useState(false);
  
  const toggleDarkMode = useThemeStore((s) => s.toggleDarkMode);
  const { isDark } = useTheme();

  const handleSignIn = () => {
    setShowAccountGate(false);
    navigation.navigate("Login");
  };

  const handleSignUp = () => {
    setShowAccountGate(false);
    navigation.navigate("SignUp");
  };

  const handleBecomeProvider = () => {
    navigation.navigate("BecomeProvider");
  };

  const handleSwitchToProvider = () => {
    if (canAccessProviderMode()) {
      setActiveRole("provider");
      setNeedsRoleSelection(false);
      navigation.reset({
        index: 0,
        routes: [{ name: "ProviderTabs" }],
      });
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
                <ThemedText style={styles.welcomeTitle}>Welcome to HomeBase</ThemedText>
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
        <GlassCard style={styles.profileCard} onPress={() => navigation.navigate("ProfileEdit")}>
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
                Tools
              </ThemedText>
              <View style={styles.toolsGrid}>
                <Pressable
                  style={[styles.toolTile, { backgroundColor: theme.cardBackground }]}
                  onPress={() => navigation.navigate("SurvivalKit")}
                >
                  <View style={[styles.toolIcon, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="shield" size={20} color={Colors.accent} />
                  </View>
                  <ThemedText style={styles.toolTitle}>Survival Kit</ThemedText>
                  <ThemedText style={[styles.toolSubtitle, { color: theme.textSecondary }]}>
                    Maintenance plan
                  </ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.toolTile, { backgroundColor: theme.cardBackground }]}
                  onPress={() => navigation.navigate("HouseFax")}
                >
                  <View style={[styles.toolIcon, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="file-text" size={20} color={Colors.accent} />
                  </View>
                  <ThemedText style={styles.toolTitle}>HouseFax</ThemedText>
                  <ThemedText style={[styles.toolSubtitle, { color: theme.textSecondary }]}>
                    Home ledger
                  </ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.toolTile, { backgroundColor: theme.cardBackground }]}
                  onPress={() => navigation.navigate("HealthScore")}
                >
                  <View style={[styles.toolIcon, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="activity" size={20} color={Colors.accent} />
                  </View>
                  <ThemedText style={styles.toolTitle}>Health Score</ThemedText>
                  <ThemedText style={[styles.toolSubtitle, { color: theme.textSecondary }]}>
                    Home status
                  </ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.toolTile, { backgroundColor: theme.cardBackground }]}
                  onPress={() => navigation.navigate("ServiceHistory")}
                >
                  <View style={[styles.toolIcon, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="clock" size={20} color={Colors.accent} />
                  </View>
                  <ThemedText style={styles.toolTitle}>Service History</ThemedText>
                  <ThemedText style={[styles.toolSubtitle, { color: theme.textSecondary }]}>
                    Past services
                  </ThemedText>
                </Pressable>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                Account
              </ThemedText>
              <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                <ListRow
                  title="Notifications"
                  leftIcon="bell"
                  onPress={() => navigation.navigate("Notifications")}
                  isFirst
                />
                <ListRow
                  title="Payment Methods"
                  leftIcon="credit-card"
                  onPress={() => navigation.navigate("PaymentMethods")}
                />
                <ListRow
                  title="Addresses"
                  leftIcon="map-pin"
                  onPress={() => navigation.navigate("Addresses")}
                />
                <ListRow
                  title="Saved Providers"
                  leftIcon="heart"
                  onPress={() => navigation.navigate("SavedProviders")}
                  isLast
                />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(400).duration(400)}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                Settings
              </ThemedText>
              <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                {hasProviderProfile() && canAccessProviderMode() ? (
                  <ListRow
                    title="Switch to Provider Mode"
                    subtitle="Access your provider dashboard"
                    leftIcon="briefcase"
                    onPress={handleSwitchToProvider}
                    isFirst
                    isLast
                  />
                ) : (
                  <ListRow
                    title="Become a Service Provider"
                    subtitle="Earn money by helping homeowners"
                    leftIcon="briefcase"
                    onPress={handleBecomeProvider}
                    isFirst
                    isLast
                  />
                )}
              </View>
            </Animated.View>
          </>
        ) : null}

        <Animated.View entering={FadeInDown.delay(isAuthenticated ? 500 : 200).duration(400)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Appearance
          </ThemedText>
          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.darkModeRow}>
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
                  trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </Animated.View>

        {!isAuthenticated ? (
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              Account Type
            </ThemedText>
            <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
              <ListRow
                title="Switch Account Type"
                subtitle="Choose Homeowner or Service Provider"
                leftIcon="refresh-cw"
                onPress={() => navigation.navigate("AccountTypeSelection")}
                isFirst
                isLast
              />
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(isAuthenticated ? 600 : 300).duration(400)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Support
          </ThemedText>
          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <ListRow
              title="Help Center"
              leftIcon="help-circle"
              onPress={() => navigation.navigate("HelpCenter")}
              isFirst
            />
            <ListRow
              title="Contact Us"
              leftIcon="message-circle"
              onPress={() => navigation.navigate("ContactUs")}
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
          <Animated.View entering={FadeInDown.delay(700).duration(400)}>
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

        <Animated.View entering={FadeInDown.delay(800).duration(400)}>
          <ThemedText style={[styles.version, { color: theme.textTertiary }]}>
            Version 1.0.0
          </ThemedText>
        </Animated.View>
      </ScrollView>

      <AccountGateModal
        visible={showAccountGate}
        onClose={() => setShowAccountGate(false)}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
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
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  toolTile: {
    width: "48%",
    padding: Spacing.md,
    borderRadius: BorderRadius.card,
    alignItems: "center",
  },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  toolTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: 2,
  },
  toolSubtitle: {
    ...Typography.caption1,
  },
  darkModeRow: {
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
