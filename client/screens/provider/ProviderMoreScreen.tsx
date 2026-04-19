import React, { useEffect, useState } from "react";
import { StyleSheet, View, ScrollView, Switch, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather, Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Avatar } from "@/components/Avatar";
import { ListRow } from "@/components/ListRow";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { PartnerBadge } from "@/components/PartnerBadge";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useProviderStore, StripeNotReadyError } from "@/state/providerStore";
import { useThemeStore } from "@/state/themeStore";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { openAppReviewFromSettings } from "@/state/appReviewStore";
import { apiRequest } from "@/lib/query-client";

export default function ProviderMoreScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme, isDark } = useTheme();
  const { user, providerProfile, logout } = useAuthStore();
  const toggleDarkMode = useThemeStore((s) => s.toggleDarkMode);

  // Client-side visibility gate for the admin link. The server-side
  // requireAdmin middleware (env ADMIN_EMAILS) is the source of truth —
  // this just hides the menu entry for non-admins.
  const adminEmails = (process.env.EXPO_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdminUser = !!user?.email &&
    adminEmails.includes(user.email.toLowerCase());

  const { isSubscribed, isInGrace, daysRemainingInGrace, status: subStatus, isPartner } =
    useSubscriptionStatus();
  const subscriptionSubtitle = isPartner
    ? "HomeBase Partner — complimentary Pro access"
    : isSubscribed
      ? "Active — manage your HomeBase Pro plan"
      : isInGrace
        ? `${daysRemainingInGrace ?? 7} days left in trial`
        : subStatus === "expired"
          ? "Trial ended — subscribe to reactivate"
          : "Free until your first paid booking";

  const availableForWork = useProviderStore((s) => s.availableForWork);
  const syncAvailableForWork = useProviderStore((s) => s.syncAvailableForWork);
  const hydrateAvailableForWork = useProviderStore((s) => s.hydrateAvailableForWork);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);

  const providerId = providerProfile?.id;
  const { data: stripeStatusData } = useQuery<{ chargesEnabled: boolean; payoutsEnabled: boolean }>({
    queryKey: ["/api/stripe/connect/status", providerId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/stripe/connect/status/${providerId}`);
      if (!response.ok) throw new Error("Failed to fetch Stripe status");
      return response.json();
    },
    enabled: !!providerId,
  });
  const stripeReady = !!stripeStatusData?.chargesEnabled;

  useEffect(() => {
    if (providerProfile?.isActive !== undefined && providerProfile?.isActive !== null) {
      hydrateAvailableForWork(providerProfile.isActive);
    }
  }, [providerProfile?.isActive, hydrateAvailableForWork]);

  const handleToggleAvailability = async (next: boolean) => {
    if (!providerId) return;
    if (next && !stripeReady) {
      navigation.navigate("StripeConnect");
      return;
    }
    setAvailabilitySaving(true);
    try {
      await syncAvailableForWork(next, providerId);
    } catch (err: unknown) {
      // Server-side gate (Task #183) — route to Stripe Connect setup, the
      // same destination as the local pre-PATCH gate above.
      if (err instanceof StripeNotReadyError) {
        navigation.navigate("StripeConnect");
        return;
      }
      const message =
        err instanceof Error
          ? err.message
          : "Please check your connection and try again.";
      Alert.alert("Couldn't update availability", message);
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const { setActiveRole, setNeedsRoleSelection } = useAuthStore();

  const handleSwitchToHomeowner = () => {
    setActiveRole("homeowner");
    setNeedsRoleSelection(false);
    navigation.reset({
      index: 0,
      routes: [{ name: "Main" }],
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
          <GlassCard style={styles.profileCard} onPress={() => navigation.navigate("BusinessHub")}>
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
                  {providerProfile?.isPartner ? <PartnerBadge size="small" /> : null}
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color={Colors.warning} />
                    <ThemedText style={styles.ratingText}>
                      {providerProfile?.rating ? Number(providerProfile.rating).toFixed(1) : "New"}
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
                subtitle={
                  !stripeReady && !!providerId
                    ? "Finish Stripe setup to start accepting bookings"
                    : "Accept new job requests"
                }
                leftIcon="toggle-left"
                showChevron={!stripeReady && !!providerId}
                onPress={
                  !stripeReady && !!providerId
                    ? () => navigation.navigate("StripeConnect")
                    : undefined
                }
                isFirst
              />
              <View style={styles.switchContainer} pointerEvents={!stripeReady ? "none" : "auto"}>
                <Switch
                  value={stripeReady ? availableForWork : false}
                  disabled={availabilitySaving || !providerId || !stripeReady}
                  onValueChange={handleToggleAvailability}
                  trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
            <ListRow
              title="Business Hub"
              subtitle="Profile, services, booking links, and policies"
              leftIcon="briefcase"
              onPress={() => navigation.navigate("BusinessHub")}
            />
            <ListRow
              title="Communications"
              subtitle="Send messages and push notifications to clients"
              leftIcon="send"
              onPress={() => navigation.navigate("Communications")}
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
              title="Subscription"
              subtitle={subscriptionSubtitle}
              leftIcon="credit-card"
              onPress={() => navigation.navigate("Subscription")}
              isFirst
              testID="row-subscription"
            />
            <ListRow
              title="Account & Security"
              subtitle="Email, password, and account deletion"
              leftIcon="shield"
              onPress={() => navigation.navigate("AccountSecurity")}
              isLast={!isAdminUser}
            />
            {/* HomeBase Partner admin (Task #211): visible only when the
                signed-in user's email is in EXPO_PUBLIC_ADMIN_EMAILS. The
                server enforces the actual gate on the endpoints. */}
            {isAdminUser ? (
              <ListRow
                title="HomeBase Partners"
                subtitle="Grant complimentary Pro access"
                leftIcon="award"
                onPress={() => navigation.navigate("AdminPartners")}
                isLast
                testID="row-admin-partners"
              />
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Settings
          </ThemedText>
          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <ListRow
              title="Notifications"
              leftIcon="bell"
              onPress={() => navigation.navigate("Notifications")}
              isFirst
            />
            <ListRow
              title="Notification Preferences"
              leftIcon="sliders"
              onPress={() => navigation.navigate("NotificationPreferences")}
            />
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
            Appearance
          </ThemedText>
          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
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
                  trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
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
            />
            <ListRow
              title="Terms of Service"
              leftIcon="file-text"
              onPress={() =>
                WebBrowser.openBrowserAsync("https://homebaseproapp.com/terms")
              }
            />
            <ListRow
              title="Privacy Policy"
              leftIcon="shield"
              onPress={() =>
                WebBrowser.openBrowserAsync("https://homebaseproapp.com/privacy")
              }
            />
            <ListRow
              title="Rate HomeBase"
              subtitle="Loving the app? Leave a quick rating."
              leftIcon="star"
              onPress={() => openAppReviewFromSettings()}
              isLast
              testID="row-rate-homebase"
            />
          </View>
        </Animated.View>

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

        <Animated.View entering={FadeInDown.delay(800).duration(400)}>
          <ThemedText style={[styles.version, { color: theme.textTertiary }]}>
            Version {Constants.expoConfig?.version ?? "1.0.0"}
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
