import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Animated, Dimensions, Platform, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

const AppLogo = require("../../../assets/images/icon.png");

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const { width, height } = Dimensions.get("window");

type Props = NativeStackScreenProps<RootStackParamList, "FirstLaunch">;

export default function FirstLaunchScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
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
          tension: 40,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
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

  const GlassFeatureCard = ({
    icon,
    title,
    description,
    delay,
  }: {
    icon: keyof typeof Feather.glyphMap;
    title: string;
    description: string;
    delay: number;
  }) => {
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const cardTranslateX = useRef(new Animated.Value(delay > 0 ? 40 : -40)).current;

    useEffect(() => {
      Animated.sequence([
        Animated.delay(800 + delay),
        Animated.parallel([
          Animated.timing(cardOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.spring(cardTranslateX, {
            toValue: 0,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, []);

    return (
      <Animated.View
        style={[
          styles.glassCard,
          {
            opacity: cardOpacity,
            transform: [{ translateX: cardTranslateX }],
          },
        ]}
      >
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={isDark ? 40 : 60}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)" },
            ]}
          />
        )}
        <View style={styles.glassCardContent}>
          <View style={[styles.glassIconWrapper, { backgroundColor: Colors.accent + "20" }]}>
            <Feather name={icon} size={22} color={Colors.accent} />
          </View>
          <View style={styles.glassTextContent}>
            <ThemedText type="label" style={styles.glassCardTitle}>
              {title}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, lineHeight: 18 }}>
              {description}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={18} color={theme.textTertiary} />
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={
          isDark
            ? [Colors.accent + "15", "transparent", Colors.accent + "08"]
            : [Colors.accent + "12", "transparent", Colors.accent + "06"]
        }
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
        <View style={styles.heroSection}>
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Animated.View style={[styles.logoGlow, { opacity: glowOpacity }]}>
              <LinearGradient
                colors={[Colors.accent + "40", Colors.accent + "00"]}
                style={styles.glowGradient}
              />
            </Animated.View>

            <View style={styles.logoOuterRing}>
              {Platform.OS === "ios" ? (
                <BlurView
                  intensity={isDark ? 30 : 50}
                  tint={isDark ? "dark" : "light"}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.7)" },
                  ]}
                />
              )}
              <View style={styles.logoImageContainer}>
                <Image
                  source={AppLogo}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
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
        </View>

        <View style={styles.featuresSection}>
          <GlassFeatureCard
            icon="users"
            title="For Homeowners"
            description="Find trusted pros, book services, track everything"
            delay={0}
          />
          <GlassFeatureCard
            icon="briefcase"
            title="For Service Providers"
            description="Grow your business, manage clients, get paid faster"
            delay={150}
          />
        </View>
      </View>

      <Animated.View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing.xl, opacity: buttonOpacity },
        ]}
      >
        <View style={styles.buttonWrapper}>
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={isDark ? 25 : 40}
              tint={isDark ? "dark" : "light"}
              style={[StyleSheet.absoluteFill, styles.buttonBlur]}
            />
          ) : null}
          <PrimaryButton
            onPress={() => navigation.navigate("AccountTypeSelection")}
            testID="button-get-started"
          >
            Get Started
          </PrimaryButton>
        </View>
        <ThemedText type="caption" style={[styles.footerText, { color: theme.textTertiary }]}>
          One account, two powerful experiences
        </ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlow: {
    position: "absolute",
    width: 200,
    height: 200,
  },
  glowGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 100,
  },
  logoOuterRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  logoImageContainer: {
    width: 110,
    height: 110,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 20,
  },
  appName: {
    fontSize: 38,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 17,
    textAlign: "center",
    marginTop: Spacing.xs,
    letterSpacing: 0.2,
  },
  featuresSection: {
    flex: 1,
    justifyContent: "center",
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  glassCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
  glassCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  glassIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  glassTextContent: {
    flex: 1,
  },
  glassCardTitle: {
    fontWeight: "600",
    marginBottom: 2,
  },
  footer: {
    paddingHorizontal: Spacing.screenPadding,
    alignItems: "center",
    gap: Spacing.md,
  },
  buttonWrapper: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  buttonBlur: {
    borderRadius: BorderRadius.lg,
  },
  footerText: {
    textAlign: "center",
  },
});
