import React from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedView } from "@/components/ThemedView";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/state/authStore";
import { useOnboardingStore } from "@/state/onboardingStore";
import { Spacing } from "@/constants/theme";
import { YouAreLiveStep } from "./shared/YouAreLiveStep";

type Props = NativeStackScreenProps<RootStackParamList, "ProviderYouAreLive">;

// The "You're Live" finale for the primary (pre-signup) provider onboarding
// funnel. Registered unconditionally in RootStackNavigator (like
// ProviderSetupFlow) so it stays mounted even after login() flips
// isAuthenticated/isProviderMode and swaps out the pre-auth screen stack.
export default function ProviderYouAreLiveScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { businessName, providerId } = route.params;
  const { activateProviderMode } = useAuthStore();
  const { setHasCompletedProviderSetup } = useOnboardingStore();

  const handleGoToDashboard = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setHasCompletedProviderSetup(true);
    activateProviderMode();
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
      <YouAreLiveStep
        businessName={businessName}
        providerId={providerId}
        onGoToDashboard={handleGoToDashboard}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
