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
import { HeaderTitle } from "@/components/HeaderTitle";
import { useAuthStore } from "@/state/authStore";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

export type HomeownerTabParamList = {
  FindTab: undefined;
  ManageTab: undefined;
  MessagesTab: undefined;
  MoreTab: undefined;
};

const Tab = createBottomTabNavigator<HomeownerTabParamList>();

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

export default function HomeownerTabNavigator() {
  const { theme, isDark } = useTheme();
  const { isAuthenticated } = useAuthStore();

  return (
    <Tab.Navigator
      initialRouteName="FindTab"
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
        name="FindTab"
        component={FindScreen}
        options={{
          title: "Find",
          headerTitle: () => <HeaderTitle title="Homebase" />,
          tabBarIcon: ({ color }) => (
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
          tabBarIcon: ({ color }) => (
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
            tabBarIcon: ({ color }) => (
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
          tabBarIcon: ({ color }) => (
            <Feather name="menu" size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
