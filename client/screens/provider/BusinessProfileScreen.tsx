import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ListRow } from "@/components/ListRow";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface ProviderData {
  id: string;
  businessName: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  serviceArea: string | null;
  avatarUrl: string | null;
  rating: string | null;
  reviewCount: number | null;
}

export default function BusinessProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { providerProfile, user } = useAuthStore();
  const queryClient = useQueryClient();
  const providerId = providerProfile?.id;
  const userId = user?.id;

  const { data, isLoading } = useQuery<{ provider: ProviderData }>({
    queryKey: ["/api/provider/user", userId],
    enabled: !!userId,
    queryFn: async () => {
      const url = new URL(`/api/provider/user/${userId}`, getApiUrl());
      const { getAuthHeaders } = await import("@/lib/query-client");
      const res = await fetch(url.toString(), { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) throw new Error("Failed to load provider");
      return res.json();
    },
  });

  const provider = data?.provider;

  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceArea, setServiceArea] = useState("");

  useEffect(() => {
    if (provider) {
      setBusinessName(provider.businessName || "");
      setPhone(provider.phone || "");
      setEmail(provider.email || "");
      setServiceArea(provider.serviceArea || "");
    }
  }, [provider]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!providerId) throw new Error("No provider ID");
      const url = new URL(`/api/provider/${providerId}`, getApiUrl());
      return apiRequest("PUT", url.toString(), { businessName, phone, email, serviceArea });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/provider/user", userId] });
      Alert.alert("Saved", "Your profile has been updated.");
    },
    onError: () => {
      Alert.alert("Error", "Failed to save changes. Please try again.");
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handlePreviewBookingPage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("PreviewBookingPage", { providerId });
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.centered, { paddingTop: insets.top + Spacing.xl }]}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(50).duration(300)}>
          <View style={styles.header}>
            <ThemedText type="h2">Business Profile</ThemedText>
            <Pressable onPress={handlePreviewBookingPage}>
              <ThemedText style={{ color: Colors.accent, fontWeight: "500" }}>
                PUBLIC PREVIEW
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <View style={styles.heroSection}>
            <View style={[styles.avatarCircle, { backgroundColor: Colors.accentLight }]}>
              <ThemedText style={styles.avatarInitial}>
                {businessName.charAt(0) || providerProfile?.businessName?.charAt(0) || "B"}
              </ThemedText>
            </View>
            <View style={{ marginLeft: Spacing.md }}>
              <ThemedText type="h3" style={{ fontWeight: "700" }}>
                {businessName || providerProfile?.businessName || "Your Business"}
              </ThemedText>
              {provider?.rating ? (
                <View style={styles.ratingRow}>
                  <Feather name="star" size={14} color={Colors.accent} />
                  <ThemedText style={{ color: Colors.accent, marginLeft: 4, fontWeight: "500" }}>
                    {parseFloat(provider.rating).toFixed(1)} ({provider.reviewCount ?? 0} Reviews)
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <GlassCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>DETAILS</ThemedText>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="briefcase" size={18} color={theme.textSecondary} />
              </View>
              <TextInput
                style={[styles.detailInput, { color: theme.text }]}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Business Name"
                placeholderTextColor={theme.textSecondary}
                testID="input-business-name"
              />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <GlassCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>CONTACT INFO</ThemedText>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="phone" size={18} color={theme.textSecondary} />
              </View>
              <TextInput
                style={[styles.detailInput, { color: theme.text }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                testID="input-phone"
              />
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="mail" size={18} color={theme.textSecondary} />
              </View>
              <TextInput
                style={[styles.detailInput, { color: theme.text }]}
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                testID="input-email"
              />
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="map-pin" size={18} color={theme.textSecondary} />
              </View>
              <TextInput
                style={[styles.detailInput, { color: theme.text }]}
                value={serviceArea}
                onChangeText={setServiceArea}
                placeholder="Service area (e.g. San Francisco, CA)"
                placeholderTextColor={theme.textSecondary}
                testID="input-service-area"
              />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(300)}>
          <View style={styles.actionsContainer}>
            <PrimaryButton
              onPress={handleSave}
              disabled={saveMutation.isPending}
              testID="button-save-profile"
            >
              {saveMutation.isPending ? "Saving..." : "Save Changes"}
            </PrimaryButton>

            <Pressable
              style={[styles.previewButton, { borderColor: theme.borderLight }]}
              onPress={handlePreviewBookingPage}
            >
              <Feather name="eye" size={18} color={theme.text} />
              <ThemedText style={{ marginLeft: Spacing.sm }}>
                Preview Booking Page
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    padding: Spacing.screenPadding,
    gap: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  heroSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.accent,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  section: { padding: Spacing.md },
  sectionTitle: {
    ...Typography.caption1,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    opacity: 0.7,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(128,128,128,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  detailInput: {
    ...Typography.body,
    flex: 1,
  },
  actionsContainer: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});
