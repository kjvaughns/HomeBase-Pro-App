import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";

import ProviderHomeScreen from "@/screens/provider/ProviderHomeScreen";
import LeadsScreen from "@/screens/provider/LeadsScreen";
import ScheduleScreen from "@/screens/provider/ScheduleScreen";
import MoneyScreen from "@/screens/provider/MoneyScreen";
import ProviderMoreScreen from "@/screens/provider/ProviderMoreScreen";
import { useTheme } from "@/hooks/useTheme";
import { HeaderTitle } from "@/components/HeaderTitle";
import { Colors, Spacing, Typography } from "@/constants/theme";

export type ProviderTabParamList = {
  HomeTab: undefined;
  LeadsTab: undefined;
  ScheduleTab: undefined;
  MoneyTab: undefined;
  MoreTab: undefined;
};

const Tab = createBottomTabNavigator<ProviderTabParamList>();

export default function ProviderTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerTitleAlign: "center",
        headerTransparent: true,
        headerBlurEffect: isDark ? "systemMaterialDark" : "systemMaterial",
        headerTintColor: theme.text,
        headerTitleStyle: {
          ...Typography.headline,
          color: theme.text,
        },
        headerStyle: {
          backgroundColor: Platform.select({
            ios: undefined,
            android: theme.backgroundRoot,
            web: "transparent",
          }),
        },
        headerShadowVisible: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          marginTop: -2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
            web: theme.glassOverlay,
          }),
          borderTopWidth: Platform.OS === "ios" ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: theme.separator,
          elevation: 0,
          height: Spacing.tabBarHeight + 34,
          paddingBottom: 34,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "systemMaterialDark" : "systemMaterial"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={ProviderHomeScreen}
        options={{
          title: "Home",
          headerTitle: () => <HeaderTitle title="Homebase Pro" />,
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="LeadsTab"
        component={LeadsScreen}
        options={{
          title: "Leads",
          headerTitle: "Leads",
          tabBarIcon: ({ color }) => (
            <Feather name="users" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ScheduleTab"
        component={ScheduleScreen}
        options={{
          title: "Schedule",
          headerTitle: "Schedule",
          tabBarIcon: ({ color }) => (
            <Feather name="calendar" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MoneyTab"
        component={MoneyScreen}
        options={{
          title: "Money",
          headerTitle: "Money",
          tabBarIcon: ({ color }) => (
            <Feather name="dollar-sign" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={ProviderMoreScreen}
        options={{
          title: "More",
          headerTitle: "More",
          tabBarIcon: ({ color }) => (
            <Feather name="menu" size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
