import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Animated, Pressable, Platform, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useOnboardingStore } from "@/state/onboardingStore";

const AppLogo = require("../../../assets/images/icon.png");

type Props = NativeStackScreenProps<RootStackParamList, "AccountTypeSelection">;

export default function AccountTypeSelectionScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { setAccountType, setHasCompletedFirstLaunch } = useOnboardingStore();

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(16)).current;
  const card1Opacity = useRef(new Animated.Value(0)).current;
  const card1TranslateY = useRef(new Animated.Value(28)).current;
  const card2Opacity = useRef(new Animated.Value(0)).current;
  const card2TranslateY = useRef(new Animated.Value(28)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: false,
        }),
        Animated.spring(headerTranslateY, {
          toValue: 0,
          tension: 55,
          friction: 9,
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(card1Opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.spring(card1TranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(card2Opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.spring(card2TranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: false,
        }),
      ]),
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  const handleHomeowner = () => {
    setAccountType("homeowner");
    setHasCompletedFirstLaunch(true);
    // Allow one render cycle for the navigator to register "Main" before resetting
    setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    }, 0);
  };

  const handleProvider = () => {
    setAccountType("provider");
    navigation.navigate("ProviderOnboarding");
  };

  const RoleCard = ({
    icon,
    title,
    subtitle,
    onPress,
    animStyle,
    testID,
  }: {
    icon: keyof typeof Feather.glyphMap;
    title: string;
    subtitle: string;
    onPress: () => void;
    animStyle: any;
    testID: string;
  }) => (
    <Animated.View style={[styles.cardWrapper, animStyle]}>
      <Pressable
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [
          styles.card,
          {
            borderColor: isDark
              ? "rgba(255,255,255,0.09)"
              : "rgba(0,0,0,0.07)",
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={isDark ? 28 : 50}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(255,255,255,0.92)",
              },
            ]}
          />
        )}

        <View style={styles.cardInner}>
          <View style={[styles.iconBox, { backgroundColor: Colors.accent + "16" }]}>
            <Feather name={icon} size={26} color={Colors.accent} />
          </View>
          <View style={styles.cardText}>
            <ThemedText style={styles.cardTitle}>{title}</ThemedText>
            <ThemedText style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
              {subtitle}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={18} color={theme.textTertiary} />
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={
          isDark
            ? [Colors.accent + "10", "transparent", Colors.accent + "06"]
            : [Colors.accent + "08", "transparent", Colors.accent + "04"]
        }
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + Spacing["3xl"] }]}>
        <Animated.View
          style={[
            styles.header,
            { opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] },
          ]}
        >
          <View style={styles.logoRow}>
            <View
              style={[
                styles.logoBox,
                {
                  borderColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(56,174,95,0.12)",
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(255,255,255,0.9)",
                },
              ]}
            >
              <Image source={AppLogo} style={styles.logoImage} resizeMode="contain" />
            </View>
          </View>
          <ThemedText style={styles.headline}>
            How are you{"\n"}using HomeBase?
          </ThemedText>
          <ThemedText style={[styles.subheadline, { color: theme.textSecondary }]}>
            Choose your path to get started.
          </ThemedText>
        </Animated.View>

        <View style={styles.cards}>
          <RoleCard
            icon="home"
            title="Join as Homeowner"
            subtitle="Find and book trusted service pros"
            onPress={handleHomeowner}
            animStyle={{
              opacity: card1Opacity,
              transform: [{ translateY: card1TranslateY }],
            }}
            testID="card-homeowner"
          />
          <RoleCard
            icon="briefcase"
            title="Join as Provider"
            subtitle="Run and grow your service business"
            onPress={handleProvider}
            animStyle={{
              opacity: card2Opacity,
              transform: [{ translateY: card2TranslateY }],
            }}
            testID="card-provider"
          />
        </View>
      </View>

      <Animated.View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing.lg, opacity: footerOpacity },
        ]}
      >
        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={styles.signInRow}
          testID="button-sign-in"
        >
          <ThemedText style={[styles.signInText, { color: theme.textTertiary }]}>
            Already have an account?{" "}
          </ThemedText>
          <ThemedText style={[styles.signInText, { color: Colors.accent, fontWeight: "600" }]}>
            Sign in
          </ThemedText>
        </Pressable>
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
  header: {
    marginBottom: Spacing["2xl"],
  },
  logoRow: {
    alignItems: "flex-start",
    marginBottom: Spacing.xl,
  },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  headline: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: 36,
    marginBottom: Spacing.sm,
  },
  subheadline: {
    fontSize: 15,
    lineHeight: 22,
  },
  cards: {
    gap: Spacing.md,
  },
  cardWrapper: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: Spacing.screenPadding,
    alignItems: "center",
  },
  signInRow: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
  },
  signInText: {
    fontSize: 14,
  },
});
