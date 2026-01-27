import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeownerTabNavigator from "@/navigation/HomeownerTabNavigator";
import ProviderTabNavigator from "@/navigation/ProviderTabNavigator";
import RoleSwitchConfirmationScreen from "@/screens/RoleSwitchConfirmationScreen";
import BecomeProviderScreen from "@/screens/BecomeProviderScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuthStore, UserRole } from "@/state/authStore";

export type RootStackParamList = {
  Main: undefined;
  RoleSwitchConfirmation: { targetRole: UserRole };
  BecomeProvider: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, activeRole, canAccessProviderMode } = useAuthStore();

  const getMainComponent = () => {
    if (isAuthenticated && activeRole === "provider" && canAccessProviderMode()) {
      return ProviderTabNavigator;
    }
    return HomeownerTabNavigator;
  };

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={getMainComponent()}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RoleSwitchConfirmation"
        component={RoleSwitchConfirmationScreen}
        options={{
          presentation: "modal",
          headerTitle: "Switch Role",
        }}
      />
      <Stack.Screen
        name="BecomeProvider"
        component={BecomeProviderScreen}
        options={{
          headerTitle: "Become a Provider",
        }}
      />
    </Stack.Navigator>
  );
}
