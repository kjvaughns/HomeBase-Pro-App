import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";

import FindScreen from "@/screens/homeowner/FindScreen";
import ManageScreen from "@/screens/homeowner/ManageScreen";
import MessagesScreen from "@/screens/homeowner/MessagesScreen";
import MoreScreen from "@/screens/homeowner/MoreScreen";
import { useTheme } from "@/hooks/useTheme";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useAuthStore } from "@/state/authStore";
import { Colors } from "@/constants/theme";

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
        name="FindTab"
        component={FindScreen}
        options={{
          title: "Find",
          headerTitle: () => <HeaderTitle title="Homebase" />,
          tabBarIcon: ({ color, size }) => (
            <Feather name="search" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ManageTab"
        component={ManageScreen}
        options={{
          title: "Manage",
          headerTitle: "Manage",
          tabBarIcon: ({ color, size }) => (
            <Feather name="clipboard" size={size} color={color} />
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
            tabBarIcon: ({ color, size }) => (
              <Feather name="message-circle" size={size} color={color} />
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
          tabBarIcon: ({ color, size }) => (
            <Feather name="menu" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
