import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Switch, Modal, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import { useThemeStore } from "@/state/themeStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

export default function ProviderMoreScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme, isDark } = useTheme();
  const { user, providerProfile, logout } = useAuthStore();
  const toggleDarkMode = useThemeStore((s) => s.toggleDarkMode);

  const availableForWork = useProviderStore((s) => s.availableForWork);
  const setAvailableForWork = useProviderStore((s) => s.setAvailableForWork);

  const { setActiveRole, setNeedsRoleSelection } = useAuthStore();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await apiRequest("DELETE", "/api/auth/account", undefined);
      logout();
    } catch (err) {
      console.error("Delete account error:", err);
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
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
                  <View style={styles.ratingRow}>
                    <Feather name="star" size={14} color={Colors.warning} />
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
              title="Subscription & Plan"
              subtitle="$29.99/mo · Free until first booking"
              leftIcon="credit-card"
              onPress={() => navigation.navigate("Subscription")}
              isFirst
            />
            <ListRow
              title="Reviews"
              subtitle={`${providerProfile?.reviewCount || 0} reviews`}
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
            <ListRow
              title="Notification Preferences"
              leftIcon="bell"
              onPress={() => navigation.navigate("NotificationPreferences")}
              isFirst
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
              isLast
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

        <Animated.View entering={FadeInDown.delay(750).duration(400)}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
            Danger Zone
          </ThemedText>
          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <ListRow
              title="Delete Account"
              leftIcon="trash-2"
              destructive
              showChevron={false}
              onPress={() => setShowDeleteModal(true)}
              isFirst
              isLast
              testID="button-delete-account"
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(800).duration(400)}>
          <ThemedText style={[styles.version, { color: theme.textTertiary }]}>
            Version 1.0.0
          </ThemedText>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: "#FF3B3014" }]}>
              <Feather name="trash-2" size={28} color="#FF3B30" />
            </View>
            <ThemedText style={styles.modalTitle}>Delete Account</ThemedText>
            <ThemedText style={[styles.modalBody, { color: theme.textSecondary }]}>
              This will permanently delete your provider account and all associated data including your clients, jobs, invoices, and business profile. This action cannot be undone.
            </ThemedText>
            <Pressable
              style={[styles.modalDeleteBtn, deleteLoading && { opacity: 0.7 }]}
              onPress={handleDeleteAccount}
              disabled={deleteLoading}
              testID="button-confirm-delete"
            >
              {deleteLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.modalDeleteText}>Delete My Account</ThemedText>
              )}
            </Pressable>
            <Pressable
              style={[styles.modalCancelBtn, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => setShowDeleteModal(false)}
              disabled={deleteLoading}
              testID="button-cancel-delete"
            >
              <ThemedText style={[styles.modalCancelText, { color: theme.text }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  modalCard: {
    borderRadius: BorderRadius.card,
    padding: Spacing.xl,
    width: "100%",
    alignItems: "center",
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.title2,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  modalBody: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  modalDeleteBtn: {
    backgroundColor: "#FF3B30",
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    width: "100%",
    alignItems: "center",
    marginBottom: Spacing.sm,
    minHeight: 48,
    justifyContent: "center",
  },
  modalDeleteText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  modalCancelBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    width: "100%",
    alignItems: "center",
  },
  modalCancelText: {
    fontWeight: "600",
    fontSize: 16,
  },
});
