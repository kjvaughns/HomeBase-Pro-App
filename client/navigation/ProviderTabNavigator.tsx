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
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { HeaderTitle } from "@/components/HeaderTitle";
import { Colors } from "@/constants/theme";

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
  const screenOptions = useScreenOptions();

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        ...screenOptions,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
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
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="LeadsTab"
        component={LeadsScreen}
        options={{
          title: "Leads",
          headerTitle: "Leads",
          tabBarIcon: ({ color, size }) => (
            <Feather name="users" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ScheduleTab"
        component={ScheduleScreen}
        options={{
          title: "Schedule",
          headerTitle: "Schedule",
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MoneyTab"
        component={MoneyScreen}
        options={{
          title: "Money",
          headerTitle: "Money",
          tabBarIcon: ({ color, size }) => (
            <Feather name="dollar-sign" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={ProviderMoreScreen}
        options={{
          title: "More",
          headerTitle: "More",
          tabBarIcon: ({ color, size }) => (
            <Feather name="menu" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
