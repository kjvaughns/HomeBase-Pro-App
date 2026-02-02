import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Animated, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const { width } = Dimensions.get("window");

type Props = NativeStackScreenProps<RootStackParamList, "FirstLaunch">;

export default function FirstLaunchScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const featuresOpacity = useRef(new Animated.Value(0)).current;
  const featuresTranslateY = useRef(new Animated.Value(30)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(titleTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(featuresOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(featuresTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + Spacing["3xl"] }]}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <View style={[styles.logoOuter, { backgroundColor: Colors.accent + "15" }]}>
            <View style={[styles.logoInner, { backgroundColor: Colors.accent + "30" }]}>
              <View style={[styles.logoCircle, { backgroundColor: Colors.accent }]}>
                <Feather name="home" size={48} color="#FFFFFF" />
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }],
          }}
        >
          <ThemedText type="h1" style={styles.appName}>
            HomeBase
          </ThemedText>
        </Animated.View>

        <Animated.View style={{ opacity: subtitleOpacity }}>
          <ThemedText type="body" style={[styles.tagline, { color: theme.textSecondary }]}>
            The smarter way to manage home services
          </ThemedText>
        </Animated.View>

        <Animated.View
          style={[
            styles.features,
            {
              opacity: featuresOpacity,
              transform: [{ translateY: featuresTranslateY }],
            },
          ]}
        >
          <View style={[styles.featureCard, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.featureIconWrapper, { backgroundColor: Colors.accent + "15" }]}>
              <Feather name="users" size={24} color={Colors.accent} />
            </View>
            <View style={styles.featureContent}>
              <ThemedText type="label" style={styles.featureTitle}>
                For Homeowners
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Find trusted pros, book services, track everything
              </ThemedText>
            </View>
          </View>

          <View style={[styles.featureCard, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.featureIconWrapper, { backgroundColor: Colors.accent + "15" }]}>
              <Feather name="briefcase" size={24} color={Colors.accent} />
            </View>
            <View style={styles.featureContent}>
              <ThemedText type="label" style={styles.featureTitle}>
                For Service Providers
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Grow your business, manage clients, get paid faster
              </ThemedText>
            </View>
          </View>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing.lg, opacity: buttonOpacity },
        ]}
      >
        <PrimaryButton
          onPress={() => navigation.navigate("AccountTypeSelection")}
          testID="button-get-started"
        >
          Get Started
        </PrimaryButton>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
    alignItems: "center",
  },
  logoContainer: {
    marginTop: Spacing["2xl"],
    marginBottom: Spacing.xl,
  },
  logoOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  logoInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: "center",
    justifyContent: "center",
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 36,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: 17,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  features: {
    width: "100%",
    gap: Spacing.md,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: 16,
    gap: Spacing.md,
  },
  featureIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontWeight: "600",
    marginBottom: 2,
  },
  footer: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.md,
  },
});
