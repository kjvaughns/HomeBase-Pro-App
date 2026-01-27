import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, useWindowDimensions, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HomeScreen from "@/screens/homeowner/HomeScreen";
import FindScreen from "@/screens/homeowner/FindScreen";
import ManageScreen from "@/screens/homeowner/ManageScreen";
import MoreScreen from "@/screens/homeowner/MoreScreen";
import { useTheme } from "@/hooks/useTheme";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useAuthStore } from "@/state/authStore";
import { Colors, Typography } from "@/constants/theme";

export type HomeownerTabParamList = {
  HomeTab: undefined;
  FindTab: undefined;
  ManageTab: undefined;
  MoreTab: undefined;
};

const Tab = createBottomTabNavigator<HomeownerTabParamList>();

function getIconName(routeName: string): keyof typeof Feather.glyphMap {
  switch (routeName) {
    case "HomeTab":
      return "home";
    case "FindTab":
      return "search";
    case "ManageTab":
      return "clipboard";
    case "MoreTab":
      return "menu";
    default:
      return "circle";
  }
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  const horizontalMargin = Math.max(16, width * 0.04);
  const maxWidth = 400;
  const tabBarWidth = width - horizontalMargin * 2;
  const finalWidth = Math.min(tabBarWidth, maxWidth);
  
  const iconSize = width < 375 ? 18 : 20;
  const fontSize = width < 375 ? 9 : 10;
  const tabHeight = width < 375 ? 52 : 60;
  const bottomOffset = Math.max(insets.bottom > 0 ? insets.bottom + 8 : 20, 20);

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          bottom: bottomOffset,
          left: (width - finalWidth) / 2,
          width: finalWidth,
          height: tabHeight,
        },
      ]}
    >
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={80}
          tint={isDark ? "systemMaterialDark" : "systemMaterial"}
          style={[StyleSheet.absoluteFill, styles.blurView]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.androidBackground,
            {
              backgroundColor: isDark ? "rgba(28, 28, 30, 0.92)" : "rgba(255, 255, 255, 0.92)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
            },
          ]}
        />
      )}

      <View style={styles.tabsRow}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name.replace("Tab", "");
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const iconName = getIconName(route.name);
          const color = isFocused ? Colors.accent : theme.tabIconDefault;

          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              <Feather name={iconName} size={iconSize} color={color} style={styles.icon} />
              <Text style={[styles.tabText, { fontSize, color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function HomeownerTabNavigator() {
  const { theme, isDark } = useTheme();
  const { isAuthenticated } = useAuthStore();

  return (
    <Tab.Navigator
      initialRouteName={isAuthenticated ? "HomeTab" : "FindTab"}
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerTitleAlign: "center",
        headerTransparent: true,
        headerTintColor: theme.text,
        headerTitleStyle: {
          ...Typography.headline,
          color: theme.text,
        },
        headerStyle: {
          backgroundColor: Platform.select({
            ios: undefined,
            android: theme.backgroundRoot,
            web: isDark ? "rgba(28, 28, 30, 0.8)" : "rgba(255, 255, 255, 0.8)",
          }),
        },
        headerShadowVisible: false,
      }}
    >
      {isAuthenticated ? (
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{
            title: "Home",
            headerTitle: () => <HeaderTitle title="HomeBase" />,
          }}
        />
      ) : null}
      <Tab.Screen
        name="FindTab"
        component={FindScreen}
        options={{
          title: "Find",
          headerTitle: isAuthenticated ? "Find a Pro" : () => <HeaderTitle title="HomeBase" />,
        }}
      />
      <Tab.Screen
        name="ManageTab"
        component={ManageScreen}
        options={{
          title: "Manage",
          headerTitle: "Manage",
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreScreen}
        options={{
          title: "More",
          headerTitle: "More",
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  blurView: {
    borderRadius: 24,
    overflow: "hidden",
  },
  androidBackground: {
    borderRadius: 24,
    borderWidth: 1,
  },
  tabsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  icon: {
    marginBottom: 2,
  },
  tabText: {
    fontWeight: "500",
  },
});
