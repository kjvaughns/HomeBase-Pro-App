import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Switch,
  FlatList,
  ActivityIndicator,
  TextInput,
  Image,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { NativeDatePickerSheet } from "@/components/NativeDatePickerSheet";
import { ZipCodeAreaInput } from "@/components/ZipCodeAreaInput";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { useProviderStore } from "@/state/providerStore";
import { apiRequest, getApiUrl, getAuthHeaders } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type HubTab = "profile" | "services" | "booking" | "policies";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type FeatherName = ComponentProps<typeof Feather>["name"];
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface BusinessHoursDay {
  enabled: boolean;
  open: string;
  close: string;
}

interface BookingPoliciesData {
  requireDeposit: boolean;
  depositPercent: number;
  cancellationHours: number;
  cancellationFeePercent: number;
  rescheduleHours: number;
  maxReschedules: number;
  instantBooking?: boolean;
  depositRequired?: boolean;
  depositPercentage?: number;
  advanceBookingDays?: number;
  cancellationWindowHours?: number;
}

const TABS: { key: HubTab; label: string; icon: FeatherName }[] = [
  { key: "profile", label: "Profile", icon: "user" },
  { key: "services", label: "Services", icon: "tool" },
  { key: "booking", label: "Booking", icon: "link" },
  { key: "policies", label: "Policies", icon: "file-text" },
];

const DAYS: { key: DayKey; short: string }[] = [
  { key: "mon", short: "Mon" },
  { key: "tue", short: "Tue" },
  { key: "wed", short: "Wed" },
  { key: "thu", short: "Thu" },
  { key: "fri", short: "Fri" },
  { key: "sat", short: "Sat" },
  { key: "sun", short: "Sun" },
];

const DEFAULT_HOURS: Record<DayKey, BusinessHoursDay> = {
  mon: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
  tue: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
  wed: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
  thu: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
  fri: { enabled: true, open: "8:00 AM", close: "6:00 PM" },
  sat: { enabled: true, open: "9:00 AM", close: "4:00 PM" },
  sun: { enabled: false, open: "Closed", close: "Closed" },
};

const DEFAULT_POLICIES: BookingPoliciesData = {
  requireDeposit: false,
  depositPercent: 25,
  cancellationHours: 24,
  cancellationFeePercent: 50,
  rescheduleHours: 12,
  maxReschedules: 2,
};

interface ProviderService {
  id: string;
  name: string;
  category: string;
  pricingType: "fixed" | "variable" | "service_call" | "quote";
  basePrice: string | null;
  isPublished: boolean;
}

interface BookingLink {
  id: string;
  customTitle: string | null;
  isActive: boolean;
  slug: string;
  status: "active" | "paused" | "disabled";
}

interface ProviderRecord {
  id: string;
  userId: string;
  businessName: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  hourlyRate: string | null;
  serviceRadius: number | null;
  serviceZipCodes: string[] | null;
  serviceCities: string[] | null;
  businessHours: Record<DayKey, BusinessHoursDay> | null;
  bookingPolicies: BookingPoliciesData | null;
  isPublic: boolean | null;
  instantBooking: boolean | null;
  licenseNumber: string | null;
  rating: string | null;
  reviewCount: number | null;
}

function getPricingLabel(type: string): string {
  switch (type) {
    case "fixed": return "Fixed";
    case "variable": return "Variable";
    case "service_call": return "Service Call";
    case "quote": return "Quote";
    default: return type;
  }
}

export default function BusinessHubScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user, providerProfile, createProviderProfile } = useAuthStore();
  const queryClient = useQueryClient();
  const availableForWork = useProviderStore((s) => s.availableForWork);
  const setAvailableForWork = useProviderStore((s) => s.setAvailableForWork);

  const [activeTab, setActiveTab] = useState<HubTab>("profile");

  const providerId = providerProfile?.id;

  // Load provider data from API (for profile + policies)
  const {
    data: providerData,
    isLoading: providerLoading,
    isError: providerError,
    refetch: refetchProvider,
  } = useQuery<{ provider: ProviderRecord }>({
    queryKey: ["/api/provider", providerId],
    enabled: !!providerId,
    retry: 2,
    retryDelay: 1500,
  });
  const provider = providerData?.provider;

  // Auto-recover: if providerProfile is missing OR the stored ID returns 404, fetch by userId
  const {
    data: recoveredProviderData,
    isError: recoveryError,
    refetch: refetchRecovery,
  } = useQuery<{ provider: any }>({
    queryKey: ["/api/provider/user", user?.id],
    // Run when: no providerId stored, OR when the main fetch errored (stale/wrong ID in store)
    enabled: !!user?.id && (!providerId || providerError),
    retry: 2,
    retryDelay: 1500,
  });

  useEffect(() => {
    const recovered = recoveredProviderData?.provider;
    if (!recovered) return;
    // Only update the store when the recovered ID differs from what's currently stored
    if (recovered.id !== providerId) {
      createProviderProfile({
        id: recovered.id,
        userId: recovered.userId,
        businessName: recovered.businessName || "",
        services: recovered.capabilityTags || recovered.services || [],
        status: recovered.isActive ? "approved" : "pending",
        rating: parseFloat(recovered.rating) || 0,
        reviewCount: recovered.reviewCount || 0,
        completedJobs: 0,
        serviceArea: recovered.serviceArea,
      });
    }
    // Always invalidate/refetch the main provider query with the recovered ID
    queryClient.invalidateQueries({ queryKey: ["/api/provider", recovered.id] });
  }, [recoveredProviderData]);

  // Profile tab state
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [serviceRadius, setServiceRadius] = useState("25");
  const [zipCodes, setZipCodes] = useState("");
  const [cities, setCities] = useState("");
  const [hours, setHours] = useState<Record<DayKey, BusinessHoursDay>>(DEFAULT_HOURS);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);

  // AI state
  const [aiWritingBio, setAiWritingBio] = useState(false);
  const [aiPolishing, setAiPolishing] = useState(false);
  const [detectingCities, setDetectingCities] = useState(false);
  const [bioError, setBioError] = useState("");
  const [citiesError, setCitiesError] = useState("");

  // Time picker state
  const [timePicker, setTimePicker] = useState<{ day: DayKey; field: "open" | "close" } | null>(null);

  // Policies tab state
  const [instantBooking, setInstantBooking] = useState(false);
  const [policies, setPolicies] = useState<BookingPoliciesData>(DEFAULT_POLICIES);
  const [policiesSaved, setPoliciesSaved] = useState(false);
  const [policiesSaving, setPoliciesSaving] = useState(false);
  const [policiesError, setPoliciesError] = useState("");
  const [policiesLoaded, setPoliciesLoaded] = useState(false);

  // Services + booking data
  const { data: servicesData, isLoading: servicesLoading } = useQuery<{ services: ProviderService[] }>({
    queryKey: ["/api/provider", providerId, "custom-services"],
    enabled: !!providerId && activeTab === "services",
  });
  const { data: bookingLinksData, isLoading: bookingLoading } = useQuery<{ bookingLinks: BookingLink[] }>({
    queryKey: ["/api/providers", providerId, "booking-links"],
    enabled: !!providerId && activeTab === "booking",
  });

  const services = servicesData?.services || [];
  const bookingLinks = bookingLinksData?.bookingLinks || [];

  // Populate profile state from API data
  useEffect(() => {
    if (!provider) return;
    setBusinessName(provider.businessName || user?.name || "");
    setDescription(provider.description || "");
    setPhone(provider.phone || "");
    setEmail(provider.email || "");
    setHourlyRate(provider.hourlyRate ? String(provider.hourlyRate) : "");
    if (provider.avatarUrl) setAvatarUri(provider.avatarUrl);
    if (provider.serviceRadius) setServiceRadius(String(provider.serviceRadius));
    if (provider.serviceZipCodes?.length) {
      setZipCodes(provider.serviceZipCodes.join(", "));
    }
    if (provider.serviceCities?.length) {
      setCities(provider.serviceCities.join(", "));
    }
    if (provider.businessHours) {
      setHours({ ...DEFAULT_HOURS, ...provider.businessHours });
    }
  }, [provider, user]);

  // Populate policies from API data (once only)
  useEffect(() => {
    if (!provider || policiesLoaded) return;
    if (provider.bookingPolicies) {
      const bp: BookingPoliciesData = provider.bookingPolicies;
      setPolicies({ ...DEFAULT_POLICIES, ...bp });
      if (bp.instantBooking !== undefined) {
        setInstantBooking(bp.instantBooking);
      }
    }
    setPoliciesLoaded(true);
  }, [provider, policiesLoaded]);

  const handleTabPress = (tab: HubTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const toggleDay = (day: DayKey) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const updateHour = (day: DayKey, field: "open" | "close", value: string) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handlePickLogo = async () => {
    if (!providerId) return;
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (!asset.base64) return;

      setLogoUploading(true);
      const mimeType = asset.mimeType || "image/jpeg";
      const base64Data = `data:${mimeType};base64,${asset.base64}`;

      const url = new URL(`/api/provider/${providerId}/logo`, getApiUrl());
      const resp = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ base64: base64Data }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setAvatarUri(data.avatarUrl);
        queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      // silent — user can retry
    } finally {
      setLogoUploading(false);
    }
  };

  const timeStringToDate = (timeStr: string): Date => {
    const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!match) return new Date();
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const timeToString = (date: Date): string => {
    const h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const handleDetectCities = async () => {
    const zips = zipCodes.split(",").map((s) => s.trim()).filter(Boolean);
    if (zips.length === 0) return;
    setDetectingCities(true);
    setCitiesError("");
    try {
      const url = new URL("/api/ai/suggest-cities", getApiUrl());
      const resp = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ zipCodes: zips }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.cities?.length) {
          setCities(data.cities.join(", "));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          setCitiesError("No cities found for those ZIP codes.");
          setTimeout(() => setCitiesError(""), 4000);
        }
      } else {
        setCitiesError("Could not detect cities. Try again.");
        setTimeout(() => setCitiesError(""), 4000);
      }
    } catch {
      setCitiesError("Could not detect cities. Check your connection.");
      setTimeout(() => setCitiesError(""), 4000);
    } finally {
      setDetectingCities(false);
    }
  };

  const handleWriteBio = async () => {
    if (!businessName.trim()) return;
    setAiWritingBio(true);
    setBioError("");
    try {
      const url = new URL("/api/ai/onboarding/generate-bio", getApiUrl());
      const resp = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          businessName: businessName.trim(),
          category: providerProfile?.services?.[0] || "Home Services",
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.bio) {
          setDescription(data.bio);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        setBioError("Could not write bio. Try again.");
        setTimeout(() => setBioError(""), 4000);
      }
    } catch {
      setBioError("Could not write bio. Check your connection.");
      setTimeout(() => setBioError(""), 4000);
    } finally {
      setAiWritingBio(false);
    }
  };

  const handlePolishBio = async () => {
    if (!description.trim()) return;
    setAiPolishing(true);
    setBioError("");
    try {
      const url = new URL("/api/ai/onboarding/polish-text", getApiUrl());
      const resp = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ text: description.trim(), context: "business bio" }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.polished) {
          setDescription(data.polished);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        setBioError("Could not polish text. Try again.");
        setTimeout(() => setBioError(""), 4000);
      }
    } catch {
      setBioError("Could not polish text. Check your connection.");
      setTimeout(() => setBioError(""), 4000);
    } finally {
      setAiPolishing(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!providerId) return;
    setProfileSaving(true);
    setProfileError("");
    try {
      const parsedRadius = parseInt(serviceRadius, 10);
      const parsedZipCodes = zipCodes.trim()
        ? zipCodes.split(",").map((s) => s.trim()).filter(Boolean)
        : null;
      const parsedCities = cities.trim()
        ? cities.split(",").map((s) => s.trim()).filter(Boolean)
        : null;
      await apiRequest("PATCH", `/api/provider/${providerId}`, {
        businessName: businessName.trim() || undefined,
        description: description.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        hourlyRate: hourlyRate.trim() ? parseFloat(hourlyRate) : undefined,
        businessHours: hours,
        serviceRadius: Number.isFinite(parsedRadius) ? parsedRadius : null,
        serviceZipCodes: parsedZipCodes,
        serviceCities: parsedCities,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save. Please try again.";
      setProfileError(message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSavePolicies = async () => {
    if (!providerId) return;
    setPoliciesSaving(true);
    setPoliciesError("");
    try {
      await apiRequest("PATCH", `/api/provider/${providerId}`, {
        bookingPolicies: { ...policies, instantBooking },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPoliciesSaved(true);
      setTimeout(() => setPoliciesSaved(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save policies. Please try again.";
      setPoliciesError(message);
    } finally {
      setPoliciesSaving(false);
    }
  };

  const renderProfileTab = () => (
    <KeyboardAwareScrollViewCompat
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(300)}>
        {/* Logo + Business Name */}
        <GlassCard style={styles.card}>
          <View style={styles.logoSection}>
            <Pressable onPress={handlePickLogo} style={styles.logoWrapper} testID="button-upload-logo">
              {logoUploading ? (
                <View style={[styles.logoCircle, { backgroundColor: theme.backgroundElevated }]}>
                  <ActivityIndicator color={Colors.accent} />
                </View>
              ) : avatarUri ? (
                <View style={styles.logoCircle}>
                  <Image source={{ uri: avatarUri }} style={styles.logoImage} />
                  <View style={styles.logoOverlay}>
                    <Feather name="camera" size={14} color="#FFFFFF" />
                  </View>
                </View>
              ) : (
                <View style={[styles.logoCircle, { backgroundColor: theme.backgroundElevated }]}>
                  <Feather name="camera" size={22} color={theme.textSecondary} />
                </View>
              )}
            </Pressable>

            <View style={styles.logoInfo}>
              <ThemedText style={[styles.logoHint, { color: theme.textSecondary }]}>
                Business Logo
              </ThemedText>
              <Pressable onPress={handlePickLogo} style={styles.logoChangeBtn}>
                <ThemedText style={[styles.logoChangeBtnText, { color: Colors.accent }]}>
                  {avatarUri ? "Change" : "Upload Photo"}
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.separator }]} />

          <View style={styles.fieldRow}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Business Name
            </ThemedText>
            <TextInput
              style={[styles.fieldInput, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Your business name"
              placeholderTextColor={theme.textTertiary}
              returnKeyType="done"
              testID="input-business-name"
            />
          </View>

          <View style={[styles.fieldCol, { marginTop: Spacing.sm }]}>
            <View style={styles.aiLabelRow}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary, flex: 1 }]}>
                Description
              </ThemedText>
              <View style={styles.aiButtonGroup}>
                <Pressable
                  onPress={handleWriteBio}
                  disabled={aiWritingBio || !businessName.trim()}
                  style={[styles.aiChipBtn, { opacity: aiWritingBio || !businessName.trim() ? 0.5 : 1 }]}
                  testID="button-write-bio"
                >
                  {aiWritingBio ? (
                    <ActivityIndicator size="small" color={Colors.accent} style={{ width: 12, height: 12 }} />
                  ) : (
                    <Feather name="edit-2" size={12} color={Colors.accent} />
                  )}
                  <ThemedText style={[styles.aiChipLabel, { color: Colors.accent }]}>
                    {aiWritingBio ? "Writing..." : "Write for me"}
                  </ThemedText>
                </Pressable>
                {description.trim().length > 0 ? (
                  <Pressable
                    onPress={handlePolishBio}
                    disabled={aiPolishing}
                    style={[styles.aiChipBtn, { opacity: aiPolishing ? 0.5 : 1 }]}
                    testID="button-polish-bio"
                  >
                    {aiPolishing ? (
                      <ActivityIndicator size="small" color={Colors.accent} style={{ width: 12, height: 12 }} />
                    ) : (
                      <Feather name="feather" size={12} color={Colors.accent} />
                    )}
                    <ThemedText style={[styles.aiChipLabel, { color: Colors.accent }]}>
                      {aiPolishing ? "Polishing..." : "Polish"}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            </View>
            <TextInput
              style={[styles.textArea, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your business and services..."
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={3}
              testID="input-description"
            />
            {bioError.length > 0 ? (
              <ThemedText style={[styles.aiErrorText, { color: Colors.error }]}>{bioError}</ThemedText>
            ) : null}
          </View>

          <View style={styles.fieldRow}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Phone
            </ThemedText>
            <TextInput
              style={[styles.fieldInput, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 000-0000"
              placeholderTextColor={theme.textTertiary}
              keyboardType="phone-pad"
              testID="input-phone"
            />
          </View>

          <View style={styles.fieldRow}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Business Email
            </ThemedText>
            <TextInput
              style={[styles.fieldInput, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
              value={email}
              onChangeText={setEmail}
              placeholder="contact@yourbusiness.com"
              placeholderTextColor={theme.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              testID="input-business-email"
            />
          </View>

          <View style={styles.fieldRow}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Hourly Rate ($)
            </ThemedText>
            <TextInput
              style={[styles.fieldInputSmall, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
              value={hourlyRate}
              onChangeText={setHourlyRate}
              placeholder="95"
              placeholderTextColor={theme.textTertiary}
              keyboardType="decimal-pad"
              testID="input-hourly-rate"
            />
          </View>

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>License</ThemedText>
            <ThemedText style={styles.infoValue}>
              {provider?.licenseNumber || "Not provided"}
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>Rating</ThemedText>
            <View style={styles.ratingRow}>
              <Feather name="star" size={14} color={Colors.warning} />
              <ThemedText style={styles.infoValue}>
                {provider?.rating ? Number(provider.rating).toFixed(1) : "New"}
              </ThemedText>
            </View>
          </View>
        </GlassCard>

        {/* Availability */}
        <GlassCard style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.cardTitle}>Available for Work</ThemedText>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Accept new job requests
              </ThemedText>
            </View>
            <Switch
              value={availableForWork}
              onValueChange={setAvailableForWork}
              trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </GlassCard>

        {/* Service Area */}
        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="map-pin" size={16} color={Colors.accent} />
            <ThemedText style={styles.cardTitle}>Service Area</ThemedText>
          </View>

          <View style={styles.fieldRow}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Radius (miles)
            </ThemedText>
            <TextInput
              style={[styles.fieldInputSmall, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
              value={serviceRadius}
              onChangeText={setServiceRadius}
              keyboardType="number-pad"
              placeholder="25"
              placeholderTextColor={theme.textTertiary}
            />
          </View>
          <View style={{ marginTop: Spacing.sm }}>
            <ZipCodeAreaInput
              label="ZIP Code"
              value={zipCodes}
              onChange={setZipCodes}
            />
          </View>
          <View style={[styles.fieldCol, { marginTop: Spacing.md }]}>
            <View style={styles.aiLabelRow}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary, flex: 1 }]}>
                Cities Served
              </ThemedText>
              <Pressable
                onPress={handleDetectCities}
                disabled={detectingCities || !zipCodes.trim()}
                style={[styles.aiChipBtn, { opacity: detectingCities || !zipCodes.trim() ? 0.5 : 1 }]}
                testID="button-detect-cities"
              >
                {detectingCities ? (
                  <ActivityIndicator size="small" color={Colors.accent} style={{ width: 12, height: 12 }} />
                ) : (
                  <Feather name="zap" size={12} color={Colors.accent} />
                )}
                <ThemedText style={[styles.aiChipLabel, { color: Colors.accent }]}>
                  {detectingCities ? "Detecting..." : "Detect Cities"}
                </ThemedText>
              </Pressable>
            </View>
            <TextInput
              style={[styles.textArea, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
              value={cities}
              onChangeText={setCities}
              multiline
              numberOfLines={2}
              placeholder="San Francisco, Oakland, Daly City"
              placeholderTextColor={theme.textTertiary}
            />
            {citiesError.length > 0 ? (
              <ThemedText style={[styles.aiErrorText, { color: Colors.error }]}>{citiesError}</ThemedText>
            ) : null}
          </View>
        </GlassCard>

        {/* Business Hours */}
        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="clock" size={16} color={Colors.accent} />
            <ThemedText style={styles.cardTitle}>Business Hours</ThemedText>
          </View>

          {DAYS.map((day) => {
            const dayData = hours[day.key];
            return (
              <View key={day.key} style={styles.hoursRow}>
                <Pressable
                  style={[
                    styles.dayToggle,
                    dayData.enabled && { backgroundColor: Colors.accent + "20" },
                  ]}
                  onPress={() => toggleDay(day.key)}
                >
                  <ThemedText
                    style={[
                      styles.dayLabel,
                      dayData.enabled
                        ? { color: Colors.accent, fontWeight: "600" }
                        : { color: theme.textTertiary },
                    ]}
                  >
                    {day.short}
                  </ThemedText>
                </Pressable>

                {dayData.enabled ? (
                  <View style={styles.hoursInputs}>
                    {Platform.OS === "web" ? (
                      <TextInput
                        style={[styles.timeInput, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
                        value={dayData.open}
                        onChangeText={(v) => updateHour(day.key, "open", v)}
                        placeholder="8:00 AM"
                        placeholderTextColor={theme.textTertiary}
                      />
                    ) : (
                      <Pressable
                        style={[styles.timeInput, styles.timeButton, { backgroundColor: theme.backgroundElevated }]}
                        onPress={() => setTimePicker({ day: day.key, field: "open" })}
                      >
                        <ThemedText style={{ color: theme.text, ...Typography.caption1 }}>
                          {dayData.open}
                        </ThemedText>
                      </Pressable>
                    )}
                    <ThemedText style={[{ color: theme.textTertiary, ...Typography.footnote }]}>
                      {" — "}
                    </ThemedText>
                    {Platform.OS === "web" ? (
                      <TextInput
                        style={[styles.timeInput, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
                        value={dayData.close}
                        onChangeText={(v) => updateHour(day.key, "close", v)}
                        placeholder="6:00 PM"
                        placeholderTextColor={theme.textTertiary}
                      />
                    ) : (
                      <Pressable
                        style={[styles.timeInput, styles.timeButton, { backgroundColor: theme.backgroundElevated }]}
                        onPress={() => setTimePicker({ day: day.key, field: "close" })}
                      >
                        <ThemedText style={{ color: theme.text, ...Typography.caption1 }}>
                          {dayData.close}
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                ) : (
                  <ThemedText style={[styles.closedLabel, { color: theme.textTertiary }]}>
                    Closed
                  </ThemedText>
                )}
              </View>
            );
          })}
        </GlassCard>

        {profileError.length > 0 ? (
          <View style={[styles.errorBanner, { backgroundColor: Colors.errorLight }]}>
            <Feather name="alert-circle" size={14} color={Colors.error} />
            <ThemedText style={[styles.errorText, { color: Colors.error }]}>{profileError}</ThemedText>
          </View>
        ) : null}

        {profileSaved ? (
          <View style={[styles.successBanner, { backgroundColor: Colors.accent + "15" }]}>
            <Feather name="check-circle" size={14} color={Colors.accent} />
            <ThemedText style={[styles.successText, { color: Colors.accent }]}>Profile saved</ThemedText>
          </View>
        ) : null}

        <PrimaryButton onPress={handleSaveProfile} loading={profileSaving}>
          Save Profile
        </PrimaryButton>

        <Pressable
          style={[styles.previewBtn, { borderColor: theme.borderLight }]}
          onPress={() => navigation.navigate("BusinessProfile")}
        >
          <Feather name="eye" size={16} color={theme.textSecondary} />
          <ThemedText style={[styles.previewBtnText, { color: theme.textSecondary }]}>
            Preview Public Profile
          </ThemedText>
          <Feather name="chevron-right" size={16} color={theme.textTertiary} />
        </Pressable>
      </Animated.View>
    </KeyboardAwareScrollViewCompat>
  );

  const renderServicesTab = () => (
    servicesLoading ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    ) : (
      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.tabContent,
          services.length === 0 && styles.emptyContainer,
        ]}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(300)}>
            <Pressable
              style={[styles.addServiceBtn, { backgroundColor: Colors.accent }]}
              onPress={() => navigation.navigate("NewService")}
              testID="button-add-service"
            >
              <Feather name="plus" size={16} color="#FFFFFF" />
              <ThemedText style={styles.addServiceLabel}>Add Service</ThemedText>
            </Pressable>
          </Animated.View>
        }
        ListEmptyComponent={
          <EmptyState
            image={require("../../../assets/images/empty-bookings.png")}
            title="No services yet"
            description="Create your first service listing to attract clients."
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
            <GlassCard style={styles.serviceCard}>
              <View style={styles.serviceRow}>
                <View style={styles.serviceIcon}>
                  <Feather name="tool" size={16} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.serviceName}>{item.name}</ThemedText>
                  <ThemedText style={[styles.serviceCategory, { color: theme.textSecondary }]}>
                    {item.category} · {getPricingLabel(item.pricingType)}
                    {item.basePrice ? ` · $${parseFloat(item.basePrice).toFixed(0)}` : ""}
                  </ThemedText>
                </View>
                <View style={styles.serviceActions}>
                  <StatusPill
                    status={item.isPublished ? "success" : "neutral"}
                    label={item.isPublished ? "Live" : "Draft"}
                    size="small"
                  />
                  <Pressable
                    onPress={() => navigation.navigate("EditService", { serviceId: item.id, service: item as unknown as Record<string, unknown> })}
                    style={styles.editIconBtn}
                  >
                    <Feather name="chevron-right" size={18} color={theme.textTertiary} />
                  </Pressable>
                </View>
              </View>
            </GlassCard>
          </Animated.View>
        )}
        showsVerticalScrollIndicator={false}
      />
    )
  );

  const renderBookingTab = () => (
    bookingLoading ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    ) : (
      <ScrollView
        contentContainerStyle={[
          styles.tabContent,
          bookingLinks.length === 0 && styles.emptyContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <Pressable
            style={[styles.addServiceBtn, { backgroundColor: Colors.accent }]}
            onPress={() => navigation.navigate("BookingLink")}
            testID="button-create-booking-link"
          >
            <Feather name="plus" size={16} color="#FFFFFF" />
            <ThemedText style={styles.addServiceLabel}>Create Booking Link</ThemedText>
          </Pressable>

          {bookingLinks.length === 0 ? (
            <EmptyState
              image={require("../../../assets/images/empty-bookings.png")}
              title="No booking links yet"
              description="Create a public booking link to let clients book you directly."
            />
          ) : (
            bookingLinks.map((link, index) => (
              <Animated.View key={link.id} entering={FadeInDown.delay(index * 40).duration(300)}>
                <Pressable onPress={() => navigation.navigate("BookingLink")} testID={`card-booking-link-${link.id}`}>
                  <GlassCard style={styles.serviceCard}>
                    <View style={styles.serviceRow}>
                      <View style={styles.serviceIcon}>
                        <Feather name="link" size={16} color={Colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.serviceName}>{link.customTitle || "Booking Page"}</ThemedText>
                        <ThemedText style={[styles.serviceCategory, { color: theme.textSecondary }]}>
                          https://homebaseproapp.com/providers/{link.slug}
                        </ThemedText>
                      </View>
                      <StatusPill
                        status={(link.isActive && link.status === "active") ? "success" : "neutral"}
                        label={(link.isActive && link.status === "active") ? "Active" : "Paused"}
                        size="small"
                      />
                    </View>
                  </GlassCard>
                </Pressable>
              </Animated.View>
            ))
          )}
        </Animated.View>
      </ScrollView>
    )
  );

  const renderPoliciesTab = () => (
    providerLoading && !policiesLoaded ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    ) : (
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={styles.tabContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          {/* Instant Booking */}
          <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="zap" size={16} color={Colors.accent} />
              <ThemedText style={styles.cardTitle}>Instant Booking</ThemedText>
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.infoValue}>Allow Instant Booking</ThemedText>
                <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                  Clients book without manual approval
                </ThemedText>
              </View>
              <Switch
                value={instantBooking}
                onValueChange={setInstantBooking}
                trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                thumbColor="#FFFFFF"
                testID="switch-instant-booking"
              />
            </View>
          </GlassCard>

          {/* Deposit */}
          <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="percent" size={16} color={Colors.accent} />
              <ThemedText style={styles.cardTitle}>Deposit</ThemedText>
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.infoValue}>Require Deposit</ThemedText>
                <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                  Collect upfront payment on booking
                </ThemedText>
              </View>
              <Switch
                value={policies.requireDeposit}
                onValueChange={(v) => setPolicies((p) => ({ ...p, requireDeposit: v }))}
                trackColor={{ false: theme.backgroundTertiary, true: Colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
            {policies.requireDeposit ? (
              <View style={[styles.fieldRow, { marginTop: Spacing.sm }]}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  Deposit Percent
                </ThemedText>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={[styles.numericInput, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
                    value={String(policies.depositPercent)}
                    onChangeText={(v) => setPolicies((p) => ({ ...p, depositPercent: parseInt(v) || 0 }))}
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholder="25"
                    placeholderTextColor={theme.textTertiary}
                  />
                  <ThemedText style={[styles.inputSuffix, { color: theme.textSecondary }]}>%</ThemedText>
                </View>
              </View>
            ) : null}
          </GlassCard>

          {/* Cancellation */}
          <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="x-circle" size={16} color={Colors.accent} />
              <ThemedText style={styles.cardTitle}>Cancellation Policy</ThemedText>
            </View>
            <View style={styles.fieldRow}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Free cancellation window
              </ThemedText>
              <View style={styles.inputWithSuffix}>
                <TextInput
                  style={[styles.numericInput, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
                  value={String(policies.cancellationHours)}
                  onChangeText={(v) => setPolicies((p) => ({ ...p, cancellationHours: parseInt(v) || 0 }))}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder="24"
                  placeholderTextColor={theme.textTertiary}
                />
                <ThemedText style={[styles.inputSuffix, { color: theme.textSecondary }]}>hrs</ThemedText>
              </View>
            </View>
            <View style={[styles.fieldRow, { marginTop: Spacing.sm }]}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Late cancellation fee
              </ThemedText>
              <View style={styles.inputWithSuffix}>
                <TextInput
                  style={[styles.numericInput, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
                  value={String(policies.cancellationFeePercent)}
                  onChangeText={(v) => setPolicies((p) => ({ ...p, cancellationFeePercent: parseInt(v) || 0 }))}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder="50"
                  placeholderTextColor={theme.textTertiary}
                />
                <ThemedText style={[styles.inputSuffix, { color: theme.textSecondary }]}>%</ThemedText>
              </View>
            </View>
          </GlassCard>

          {/* Reschedule */}
          <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="refresh-cw" size={16} color={Colors.accent} />
              <ThemedText style={styles.cardTitle}>Reschedule Policy</ThemedText>
            </View>
            <View style={styles.fieldRow}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Reschedule notice required
              </ThemedText>
              <View style={styles.inputWithSuffix}>
                <TextInput
                  style={[styles.numericInput, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
                  value={String(policies.rescheduleHours)}
                  onChangeText={(v) => setPolicies((p) => ({ ...p, rescheduleHours: parseInt(v) || 0 }))}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder="12"
                  placeholderTextColor={theme.textTertiary}
                />
                <ThemedText style={[styles.inputSuffix, { color: theme.textSecondary }]}>hrs</ThemedText>
              </View>
            </View>
            <View style={[styles.fieldRow, { marginTop: Spacing.sm }]}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Max reschedules per booking
              </ThemedText>
              <View style={styles.inputWithSuffix}>
                <TextInput
                  style={[styles.numericInput, { color: theme.text, backgroundColor: theme.backgroundElevated }]}
                  value={String(policies.maxReschedules)}
                  onChangeText={(v) => setPolicies((p) => ({ ...p, maxReschedules: parseInt(v) || 0 }))}
                  keyboardType="number-pad"
                  maxLength={1}
                  placeholder="2"
                  placeholderTextColor={theme.textTertiary}
                />
              </View>
            </View>
          </GlassCard>

          {policiesError.length > 0 ? (
            <View style={[styles.errorBanner, { backgroundColor: Colors.errorLight }]}>
              <Feather name="alert-circle" size={14} color={Colors.error} />
              <ThemedText style={[styles.errorText, { color: Colors.error }]}>{policiesError}</ThemedText>
            </View>
          ) : null}

          {policiesSaved ? (
            <View style={[styles.successBanner, { backgroundColor: Colors.accent + "15" }]}>
              <Feather name="check-circle" size={14} color={Colors.accent} />
              <ThemedText style={[styles.successText, { color: Colors.accent }]}>Policies saved</ThemedText>
            </View>
          ) : null}

          <PrimaryButton onPress={handleSavePolicies} loading={policiesSaving}>
            Save Policies
          </PrimaryButton>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    )
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.tabBar, { paddingTop: headerHeight + Spacing.sm }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[
                  styles.tab,
                  {
                    backgroundColor: isActive ? Colors.accent : theme.cardBackground,
                    borderColor: isActive ? Colors.accent : theme.borderLight,
                  },
                ]}
                onPress={() => handleTabPress(tab.key)}
                testID={`tab-hub-${tab.key}`}
              >
                <Feather
                  name={tab.icon}
                  size={14}
                  color={isActive ? "#FFFFFF" : theme.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.tabLabel,
                    { color: isActive ? "#FFFFFF" : theme.textSecondary },
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.content, { paddingBottom: tabBarHeight + Spacing.md }]}>
        {!providerLoading && !provider && (providerError || recoveryError || (!providerId && recoveredProviderData !== undefined && !recoveredProviderData?.provider)) ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={40} color={Colors.error} />
            <ThemedText style={styles.errorTitle}>
              We couldn't load your business profile
            </ThemedText>
            <ThemedText style={[styles.errorBody, { color: theme.textSecondary }]}>
              There was a problem connecting to your account data. Please try again.
            </ThemedText>
            <PrimaryButton
              onPress={() => {
                refetchProvider();
                refetchRecovery();
              }}
              style={styles.retryButton}
              testID="button-retry-provider"
            >
              Retry
            </PrimaryButton>
            <Pressable
              onPress={() => navigation.navigate("ContactUs")}
              style={styles.contactSupport}
              testID="button-contact-support"
            >
              <ThemedText style={[styles.contactSupportText, { color: Colors.accent }]}>
                Contact Support
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            {activeTab === "profile" ? renderProfileTab() : null}
            {activeTab === "services" ? renderServicesTab() : null}
            {activeTab === "booking" ? renderBookingTab() : null}
            {activeTab === "policies" ? renderPoliciesTab() : null}
          </>
        )}
      </View>

      {timePicker ? (
        <NativeDatePickerSheet
          visible={true}
          mode="time"
          minuteInterval={15}
          title={timePicker.field === "open" ? "Opening Time" : "Closing Time"}
          value={timeStringToDate(hours[timePicker.day][timePicker.field])}
          onConfirm={(date) => {
            updateHour(timePicker.day, timePicker.field, timeToString(date));
            setTimePicker(null);
          }}
          onCancel={() => setTimePicker(null)}
        />
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBarContent: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.sm,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  tabLabel: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  content: { flex: 1 },
  tabContent: {
    padding: Spacing.screenPadding,
    gap: Spacing.md,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  infoLabel: {
    ...Typography.footnote,
  },
  infoValue: {
    ...Typography.footnote,
    fontWeight: "500",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.md,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  fieldCol: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.footnote,
    flex: 1,
  },
  fieldInput: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    ...Typography.footnote,
    minWidth: 120,
  },
  fieldInputSmall: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    ...Typography.footnote,
    width: 70,
    textAlign: "center",
  },
  textArea: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    ...Typography.footnote,
    minHeight: 60,
    textAlignVertical: "top",
  },
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 64,
    height: 64,
  },
  logoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoInfo: {
    flex: 1,
    gap: 4,
  },
  logoHint: {
    ...Typography.footnote,
  },
  logoChangeBtn: {
    alignSelf: "flex-start",
  },
  logoChangeBtnText: {
    ...Typography.footnote,
    fontWeight: "600",
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  dayToggle: {
    width: 42,
    height: 30,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  hoursInputs: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  timeInput: {
    flex: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: Spacing.xs,
    ...Typography.caption1,
    textAlign: "center",
    minWidth: 70,
  },
  timeButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
  },
  aiLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  aiButtonGroup: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  aiChipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent + "15",
  },
  aiChipLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  aiErrorText: {
    ...Typography.caption1,
    marginTop: 4,
  },
  closedLabel: {
    ...Typography.footnote,
    flex: 1,
    paddingLeft: Spacing.xs,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  previewBtnText: {
    ...Typography.subhead,
    flex: 1,
  },
  addServiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  addServiceLabel: {
    ...Typography.subhead,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  serviceCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceName: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: 2,
  },
  serviceCategory: {
    ...Typography.caption1,
  },
  serviceActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  editIconBtn: {
    padding: 4,
  },
  numericInput: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    ...Typography.footnote,
    width: 60,
    textAlign: "center",
  },
  inputWithSuffix: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  inputSuffix: {
    ...Typography.footnote,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  successText: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorText: {
    ...Typography.caption1,
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.screenPadding,
    gap: Spacing.md,
  },
  errorTitle: {
    ...Typography.title3,
    fontWeight: "600",
    textAlign: "center",
  },
  errorBody: {
    ...Typography.body,
    textAlign: "center",
  },
  retryButton: {
    width: "100%",
    maxWidth: 240,
  },
  contactSupport: {
    paddingVertical: Spacing.sm,
  },
  contactSupportText: {
    ...Typography.callout,
    fontWeight: "500",
  },
});
