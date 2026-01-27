import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";

import FindScreen from "@/screens/homeowner/FindScreen";
import ManageScreen from "@/screens/homeowner/ManageScreen";
import MessagesScreen from "@/screens/homeowner/MessagesScreen";
import MoreScreen from "@/screens/homeowner/MoreScreen";
import { useTheme } from "@/hooks/useTheme";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useAuthStore } from "@/state/authStore";
import { Colors, Spacing } from "@/constants/theme";

export type HomeownerTabParamList = {
  FindTab: undefined;
  ManageTab: undefined;
  MessagesTab: undefined;
  MoreTab: undefined;
};

const Tab = createBottomTabNavigator<HomeownerTabParamList>();

export default function HomeownerTabNavigator() {
  const { theme, isDark } = useTheme();
  const screenOptions = useScreenOptions();
  const { isAuthenticated } = useAuthStore();

  return (
    <Tab.Navigator
      initialRouteName="FindTab"
      screenOptions={{
        ...screenOptions,
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
        name="FindTab"
        component={FindScreen}
        options={{
          title: "Find",
          headerTitle: () => <HeaderTitle title="Homebase" />,
          tabBarIcon: ({ color, focused }) => (
            <Feather name="search" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ManageTab"
        component={ManageScreen}
        options={{
          title: "Manage",
          headerTitle: "Manage",
          tabBarIcon: ({ color, focused }) => (
            <Feather name="clipboard" size={22} color={color} />
          ),
        }}
      />
      {isAuthenticated ? (
        <Tab.Screen
          name="MessagesTab"
          component={MessagesScreen}
          options={{
            title: "Messages",
            headerTitle: "Messages",
            tabBarIcon: ({ color, focused }) => (
              <Feather name="message-circle" size={22} color={color} />
            ),
          }}
        />
      ) : null}
      <Tab.Screen
        name="MoreTab"
        component={MoreScreen}
        options={{
          title: "More",
          headerTitle: "More",
          tabBarIcon: ({ color, focused }) => (
            <Feather name="menu" size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
