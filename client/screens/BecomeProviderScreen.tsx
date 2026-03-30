import React, { useState } from "react";
import { StyleSheet, View, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";

export default function BecomeProviderScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { user, createProviderProfile, setActiveRole, setNeedsRoleSelection } = useAuthStore();

  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceArea, setServiceArea] = useState("");

  const registerMutation = useMutation({
    mutationFn: async (data: { userId: string; businessName: string; phone?: string; email?: string; serviceArea?: string }) => {
      const response = await apiRequest("POST", "/api/provider/register", data);
      return response.json();
    },
    onSuccess: async (result) => {
      const provider = result.provider;
      if (!provider) return;
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      createProviderProfile({
        id: provider.id,
        userId: provider.userId,
        businessName: provider.businessName,
        services: [],
        status: "approved",
        rating: 0,
        reviewCount: 0,
        completedJobs: 0,
      });
      
      setActiveRole("provider");
      setNeedsRoleSelection(false);
      queryClient.invalidateQueries({ queryKey: ["/api/provider"] });
    },
    onError: async (error: any) => {
      const message: string = error.message || "";
      if (message.includes("409") && message.includes("already has a provider profile")) {
        try {
          const res = await apiRequest("GET", `/api/provider/user/${user!.id}`);
          const data = await res.json();
          const provider = data.provider ?? data;
          if (provider?.id) {
            createProviderProfile({
              id: provider.id,
              userId: provider.userId,
              businessName: provider.businessName,
              services: [],
              status: "approved",
              rating: 0,
              reviewCount: 0,
              completedJobs: 0,
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setActiveRole("provider");
            setNeedsRoleSelection(false);
            queryClient.invalidateQueries({ queryKey: ["/api/provider"] });
            return;
          }
        } catch {
        }
      }
      Alert.alert(
        "Registration Failed",
        "Unable to create your provider profile. Please try again."
      );
    },
  });

  const benefits = [
    {
      icon: "dollar-sign" as const,
      title: "Earn Money",
      description: "Set your own rates and get paid quickly",
    },
    {
      icon: "calendar" as const,
      title: "Flexible Schedule",
      description: "Work when you want, where you want",
    },
    {
      icon: "users" as const,
      title: "Find Customers",
      description: "Connect with homeowners in your area",
    },
    {
      icon: "trending-up" as const,
      title: "Grow Your Business",
      description: "Build your reputation with reviews",
    },
  ];

  const handleSubmit = () => {
    if (!businessName.trim() || !user?.id) {
      return;
    }

    registerMutation.mutate({
      userId: user.id,
      businessName: businessName.trim(),
      phone: phone.trim() || undefined,
      email: user.email,
      serviceArea: serviceArea.trim() || undefined,
    });
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        bottomOffset={Spacing.xl}
      >
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={styles.header}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${Colors.accent}15` },
            ]}
          >
            <Feather name="briefcase" size={32} color={Colors.accent} />
          </View>
          <ThemedText type="h1" style={styles.title}>
            Become a Service Provider
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.subtitle, { color: theme.textSecondary }]}
          >
            Join thousands of professionals earning money by helping homeowners
            with their projects.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <ThemedText type="label" style={styles.sectionTitle}>
            Benefits
          </ThemedText>
          <GlassCard style={styles.benefitsCard}>
            {benefits.map((benefit, index) => (
              <View key={benefit.title}>
                <View style={styles.benefitRow}>
                  <View
                    style={[
                      styles.benefitIcon,
                      { backgroundColor: `${Colors.accent}15` },
                    ]}
                  >
                    <Feather name={benefit.icon} size={20} color={Colors.accent} />
                  </View>
                  <View style={styles.benefitText}>
                    <ThemedText type="h4">{benefit.title}</ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      {benefit.description}
                    </ThemedText>
                  </View>
                </View>
                {index < benefits.length - 1 ? (
                  <View
                    style={[
                      styles.divider,
                      { backgroundColor: theme.border },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <ThemedText type="label" style={styles.sectionTitle}>
            Get Started
          </ThemedText>
          <GlassCard>
            <TextField
              label="Business Name"
              placeholder="Enter your business name"
              value={businessName}
              onChangeText={setBusinessName}
              leftIcon="briefcase"
            />

            <ThemedText
              type="caption"
              style={[styles.hint, { color: theme.textTertiary }]}
            >
              This is how customers will find you. You can change this later.
            </ThemedText>
          </GlassCard>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(400).duration(400)}
          style={styles.footer}
        >
          <PrimaryButton
            onPress={handleSubmit}
            loading={registerMutation.isPending}
            disabled={!businessName.trim()}
            style={styles.submitButton}
          >
            Continue
          </PrimaryButton>

          <ThemedText
            type="caption"
            style={[styles.terms, { color: theme.textTertiary }]}
          >
            By continuing, you agree to our Provider Terms of Service and
            acknowledge our Provider Guidelines.
          </ThemedText>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    maxWidth: 280,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    color: "#6B7280",
  },
  benefitsCard: {
    marginBottom: Spacing.xl,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  divider: {
    height: 1,
    marginLeft: 40 + Spacing.md,
    marginVertical: Spacing.xs,
  },
  hint: {
    marginTop: Spacing.sm,
  },
  footer: {
    marginTop: Spacing.xl,
  },
  submitButton: {
    marginBottom: Spacing.lg,
  },
  terms: {
    textAlign: "center",
  },
});
