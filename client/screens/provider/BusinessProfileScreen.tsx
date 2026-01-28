import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Image,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ListRow } from "@/components/ListRow";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

export default function BusinessProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { providerProfile } = useAuthStore();

  const [businessName, setBusinessName] = useState("Clean & Co. LLC");
  const [slug, setSlug] = useState("clean-co");
  const [isSaving, setIsSaving] = useState(false);
  
  const [phone, setPhone] = useState("(415) 555-0123");
  const [email, setEmail] = useState("contact@cleanco.com");
  const [address, setAddress] = useState("123 Market St, San Francisco, CA");
  
  const [instagram, setInstagram] = useState("@cleanco_sf");
  const [facebook, setFacebook] = useState("cleancoservices");
  const [website, setWebsite] = useState("www.cleanco.com");

  const handleEditCover = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleEditLogo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  const handlePreviewBookingPage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("PreviewBookingPage" as any, {
      providerId: providerProfile?.id,
    });
  };

  const handleServiceArea = () => {
    Haptics.selectionAsync();
  };

  const handlePortfolio = () => {
    Haptics.selectionAsync();
  };

  const handleReviews = () => {
    Haptics.selectionAsync();
  };

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
            <Pressable>
              <ThemedText style={{ color: Colors.accent, fontWeight: "500" }}>
                PUBLIC PREVIEW
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <View style={styles.heroSection}>
            <View style={styles.coverContainer}>
              <Image
                source={{ uri: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80" }}
                style={styles.coverImage}
              />
              <View style={styles.coverGradient} />
              <Pressable
                style={[styles.editCoverBtn, { backgroundColor: theme.cardBackground }]}
                onPress={handleEditCover}
              >
                <Feather name="camera" size={18} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.profileRow}>
              <Pressable style={styles.logoContainer} onPress={handleEditLogo}>
                <Image
                  source={{ uri: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80" }}
                  style={styles.logoImage}
                />
              </Pressable>
              <View style={styles.profileInfo}>
                <ThemedText type="h3" style={{ fontWeight: "700" }}>
                  {businessName}
                </ThemedText>
                <View style={styles.ratingRow}>
                  <Feather name="star" size={14} color={Colors.accent} />
                  <ThemedText style={{ color: Colors.accent, marginLeft: 4, fontWeight: "500" }}>
                    4.9 (128 Reviews)
                  </ThemedText>
                </View>
              </View>
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
              />
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="globe" size={18} color={theme.textSecondary} />
              </View>
              <ThemedText style={{ color: theme.textSecondary, marginRight: 4 }}>
                homebase.co/
              </ThemedText>
              <TextInput
                style={[styles.slugInput, { color: theme.text }]}
                value={slug}
                onChangeText={setSlug}
                placeholder="your-slug"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
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
              />
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="map-pin" size={18} color={theme.textSecondary} />
              </View>
              <TextInput
                style={[styles.detailInput, { color: theme.text }]}
                value={address}
                onChangeText={setAddress}
                placeholder="Business address"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(300)}>
          <GlassCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>SOCIAL LINKS</ThemedText>

            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: "#E1306C20" }]}>
                <Feather name="instagram" size={18} color="#E1306C" />
              </View>
              <TextInput
                style={[styles.detailInput, { color: theme.text }]}
                value={instagram}
                onChangeText={setInstagram}
                placeholder="Instagram handle"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: "#1877F220" }]}>
                <Feather name="facebook" size={18} color="#1877F2" />
              </View>
              <TextInput
                style={[styles.detailInput, { color: theme.text }]}
                value={facebook}
                onChangeText={setFacebook}
                placeholder="Facebook page"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="link" size={18} color={theme.textSecondary} />
              </View>
              <TextInput
                style={[styles.detailInput, { color: theme.text }]}
                value={website}
                onChangeText={setWebsite}
                placeholder="Website URL"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
              />
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <GlassCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>CONFIGURATION</ThemedText>

            <ListRow
              leftIcon="map-pin"
              title="Service Area"
              subtitle="San Francisco, CA"
              onPress={handleServiceArea}
              showChevron
              isFirst
            />

            <ListRow
              leftIcon="image"
              title="Portfolio"
              subtitle="12 Photos"
              onPress={handlePortfolio}
              showChevron
            />

            <ListRow
              leftIcon="star"
              title="Reviews"
              onPress={handleReviews}
              showChevron
              isLast
            />
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(300)}>
          <View style={styles.actionsContainer}>
            <PrimaryButton onPress={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
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
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
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
    marginBottom: Spacing.sm,
  },
  coverContainer: {
    height: 140,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: -40,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  editCoverBtn: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.md,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#000",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  profileInfo: {
    marginLeft: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  section: {
    padding: Spacing.md,
  },
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
  slugInput: {
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
