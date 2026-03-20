import React from "react";
import { View, StyleSheet, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

const AppLogo = require("../../assets/images/icon.png");

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { GlassCard } from "@/components/GlassCard";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function RoleGatewayScreen() {
  const insets = useSafeAreaInsets();
  const safeTop = insets.top || 50;
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { 
    user, 
    hasProviderProfile, 
    canAccessProviderMode, 
    setActiveRole,
    setNeedsRoleSelection 
  } = useAuthStore();

  const hasProvider = hasProviderProfile();
  const canUseProvider = canAccessProviderMode();

  const handleHomeownerSelect = () => {
    setActiveRole("homeowner");
    setNeedsRoleSelection(false);
  };

  const handleProviderSelect = () => {
    if (canUseProvider) {
      setActiveRole("provider");
      setNeedsRoleSelection(false);
    } else if (hasProvider) {
      // Provider exists but not approved yet
      setActiveRole("provider");
      setNeedsRoleSelection(false);
    } else {
      // No provider profile - start onboarding
      navigation.navigate("BecomeProvider");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: safeTop + Spacing["2xl"], paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.header}>
          <Image
            source={AppLogo}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <ThemedText style={styles.appName}>HomeBase</ThemedText>
          <ThemedText style={[styles.greeting, { color: theme.textSecondary }]}>
            Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </ThemedText>
        </View>

        <View style={styles.titleSection}>
          <ThemedText style={styles.title}>How will you use HomeBase?</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            You can switch between roles anytime
          </ThemedText>
        </View>

        <View style={styles.roleCards}>
          <Pressable onPress={handleHomeownerSelect}>
            <GlassCard style={styles.roleCard}>
              <View style={[styles.roleIconContainer, { backgroundColor: theme.cardBackground }]}>
                <Feather name="home" size={28} color={Colors.accent} />
              </View>
              <View style={styles.roleTextContainer}>
                <ThemedText style={styles.roleTitle}>Homeowner</ThemedText>
                <ThemedText style={[styles.roleDescription, { color: theme.textSecondary }]}>
                  Book, pay, and manage appointments
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={24} color={theme.textSecondary} />
            </GlassCard>
          </Pressable>

          <Pressable onPress={handleProviderSelect}>
            <GlassCard style={styles.roleCard}>
              <View style={[styles.roleIconContainer, { backgroundColor: theme.cardBackground }]}>
                <Feather name="briefcase" size={28} color={Colors.accent} />
              </View>
              <View style={styles.roleTextContainer}>
                <ThemedText style={styles.roleTitle}>Service Pro</ThemedText>
                <ThemedText style={[styles.roleDescription, { color: theme.textSecondary }]}>
                  Schedule jobs, invoice clients, and get paid
                </ThemedText>
              </View>
              {hasProvider ? (
                <Feather name="chevron-right" size={24} color={theme.textSecondary} />
              ) : (
                <View style={[styles.addBadge, { backgroundColor: Colors.accent }]}>
                  <ThemedText style={styles.addBadgeText}>Add</ThemedText>
                </View>
              )}
            </GlassCard>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <ThemedText style={[styles.footerText, { color: theme.textTertiary }]}>
            One account, two powerful experiences
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  greeting: {
    fontSize: 16,
  },
  titleSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  roleCards: {
    flex: 1,
    justifyContent: "center",
    gap: Spacing.md,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  roleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  roleTextContainer: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  addBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  addBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  footerText: {
    fontSize: 13,
  },
});
