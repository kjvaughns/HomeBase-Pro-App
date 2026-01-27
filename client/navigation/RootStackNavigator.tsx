import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeownerTabNavigator from "@/navigation/HomeownerTabNavigator";
import ProviderTabNavigator from "@/navigation/ProviderTabNavigator";
import RoleSwitchConfirmationScreen from "@/screens/RoleSwitchConfirmationScreen";
import BecomeProviderScreen from "@/screens/BecomeProviderScreen";
import AIChatScreen from "@/screens/homeowner/AIChatScreen";
import SurvivalKitScreen from "@/screens/homeowner/SurvivalKitScreen";
import HealthScoreScreen from "@/screens/homeowner/HealthScoreScreen";
import HouseFaxScreen from "@/screens/homeowner/HouseFaxScreen";
import BudgeterScreen from "@/screens/homeowner/BudgeterScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuthStore, UserRole } from "@/state/authStore";

export type RootStackParamList = {
  Main: undefined;
  RoleSwitchConfirmation: { targetRole: UserRole };
  BecomeProvider: undefined;
  AIChat: undefined;
  SurvivalKit: undefined;
  HealthScore: undefined;
  HouseFax: undefined;
  Budgeter: undefined;
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
      <Stack.Screen
        name="AIChat"
        component={AIChatScreen}
        options={{
          headerTitle: "Ask Homebase AI",
        }}
      />
      <Stack.Screen
        name="SurvivalKit"
        component={SurvivalKitScreen}
        options={{
          headerTitle: "Survival Kit",
        }}
      />
      <Stack.Screen
        name="HealthScore"
        component={HealthScoreScreen}
        options={{
          headerTitle: "Home Health Score",
        }}
      />
      <Stack.Screen
        name="HouseFax"
        component={HouseFaxScreen}
        options={{
          headerTitle: "HouseFax",
        }}
      />
      <Stack.Screen
        name="Budgeter"
        component={BudgeterScreen}
        options={{
          headerTitle: "Home Budgeter",
        }}
      />
    </Stack.Navigator>
  );
}
