import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Animated, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { Colors, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const AppLogo = require("../../../assets/images/icon.png");

type Props = NativeStackScreenProps<RootStackParamList, "FirstLaunch">;

export default function FirstLaunchScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();

  const logoScale = useRef(new Animated.Value(0.78)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 480,
          useNativeDriver: false,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 52,
          friction: 9,
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(500),
    ]).start(() => {
      navigation.navigate("AccountTypeSelection");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing; cleanup tracked in Task #107
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={
          isDark
            ? [Colors.accent + "14", "transparent"]
            : [Colors.accent + "10", "transparent"]
        }
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          styles.logoContainer,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <View
          style={[
            styles.logoRing,
            {
              borderColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(56,174,95,0.14)",
              backgroundColor: isDark
                ? "rgba(255,255,255,0.04)"
                : "rgba(255,255,255,0.9)",
            },
          ]}
        >
          <Image source={AppLogo} style={styles.logo} resizeMode="contain" />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoRing: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 92,
    height: 92,
    borderRadius: 20,
  },
});
