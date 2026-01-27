import React from "react";
import { StyleSheet, View, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import { useAuthStore, UserRole } from "@/state/authStore";

type RouteParams = {
  RoleSwitchConfirmation: {
    targetRole: UserRole;
  };
};

export default function RoleSwitchConfirmationScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "RoleSwitchConfirmation">>();
  const { theme } = useTheme();
  const { setActiveRole } = useAuthStore();

  const targetRole = route.params?.targetRole || "homeowner";
  const isProvider = targetRole === "provider";

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActiveRole(targetRole);
    navigation.reset({
      index: 0,
      routes: [{ name: "Main" }],
    });
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom + Spacing.xl }]}>
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Image
            source={require("../../assets/images/role-switch-confirmation.png")}
            style={styles.image}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          style={styles.textContent}
        >
          <ThemedText type="h1" style={styles.title}>
            Switching to {isProvider ? "Provider" : "Homeowner"} Mode
          </ThemedText>

          <ThemedText
            type="body"
            style={[styles.description, { color: theme.textSecondary }]}
          >
            {isProvider
              ? "You're about to switch to your provider dashboard. You'll be able to manage leads, jobs, and earnings."
              : "You're about to switch to homeowner mode. You'll be able to browse and book services."}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <GlassCard style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: `${Colors.accent}15` },
                ]}
              >
                <Feather
                  name={isProvider ? "briefcase" : "home"}
                  size={24}
                  color={Colors.accent}
                />
              </View>
              <View style={styles.infoText}>
                <ThemedText type="h4">
                  {isProvider ? "Provider Dashboard" : "Home Services"}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary }}
                >
                  {isProvider
                    ? "Home, Leads, Schedule, Money, More"
                    : "Find, Manage, Messages, More"}
                </ThemedText>
              </View>
            </View>
          </GlassCard>
        </Animated.View>
      </View>

      <Animated.View
        entering={FadeInDown.delay(400).duration(400)}
        style={styles.actions}
      >
        <PrimaryButton onPress={handleContinue} style={styles.button}>
          Continue
        </PrimaryButton>
        <SecondaryButton onPress={handleCancel} style={styles.button}>
          Cancel
        </SecondaryButton>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: Spacing.xl,
  },
  textContent: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    maxWidth: 300,
  },
  infoCard: {
    width: "100%",
    maxWidth: 320,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  actions: {
    gap: Spacing.md,
  },
  button: {
    width: "100%",
  },
});
