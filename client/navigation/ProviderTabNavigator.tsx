import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";

import ProviderHomeScreen from "@/screens/provider/ProviderHomeScreen";
import LeadsScreen from "@/screens/provider/LeadsScreen";
import ScheduleScreen from "@/screens/provider/ScheduleScreen";
import MoneyScreen from "@/screens/provider/MoneyScreen";
import ProviderMoreScreen from "@/screens/provider/ProviderMoreScreen";
import { useTheme } from "@/hooks/useTheme";
import { HeaderTitle } from "@/components/HeaderTitle";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

export type ProviderTabParamList = {
  HomeTab: undefined;
  LeadsTab: undefined;
  ScheduleTab: undefined;
  MoneyTab: undefined;
  MoreTab: undefined;
};

const Tab = createBottomTabNavigator<ProviderTabParamList>();

function FloatingTabBarBackground({ isDark, theme }: { isDark: boolean; theme: any }) {
  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={80}
        tint={isDark ? "systemMaterialDark" : "systemMaterial"}
        style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius["2xl"], overflow: "hidden" }]}
      />
    );
  }
  
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: isDark ? "rgba(28, 28, 30, 0.85)" : "rgba(255, 255, 255, 0.85)",
          borderRadius: BorderRadius["2xl"],
          borderWidth: 1,
          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
        },
      ]}
    />
  );
}

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
          marginTop: 4,
        },
        tabBarStyle: {
          position: "absolute",
          bottom: 24,
          left: 16,
          right: 16,
          height: 64,
          borderRadius: BorderRadius["2xl"],
          backgroundColor: "transparent",
          borderTopWidth: 0,
          borderTopColor: "transparent",
          elevation: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 24,
          paddingBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 8,
        },
        tabBarBackground: () => <FloatingTabBarBackground isDark={isDark} theme={theme} />,
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
