import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  Pressable,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill, StatusType } from "@/components/StatusPill";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/state/authStore";
import { getApiUrl } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Home {
  id: string;
  label?: string;
  street?: string;
  formattedAddress?: string;
  city?: string;
  state?: string;
}

interface ServiceEntry {
  id: string;
  homeId: string;
  title: string;
  provider: { id: string; name: string; avatar?: string };
  date: string;
  status: "completed" | "upcoming" | "in_progress" | "cancelled";
  amount: number | null;
  category: string;
  notes?: string;
  photos?: string[];
  invoiceId?: string;
  warranty?: { expiresAt: string; notes: string };
  type: "service" | "diy" | "warranty";
}

interface PastProvider {
  id: string;
  name: string;
  avatar?: string;
  category: string;
  totalSpent: number;
  jobsCompleted: number;
  rating: number;
  lastService: string;
}

const MOCK_SERVICE_ENTRIES: ServiceEntry[] = [
  { id: "se-1", homeId: "home-1", title: "HVAC Maintenance", provider: { id: "p-1", name: "Bay Area HVAC Pros" }, date: "2026-01-20", status: "completed", amount: 185, category: "HVAC", type: "service", notes: "Annual maintenance, replaced filter, cleaned coils" },
  { id: "se-2", homeId: "home-1", title: "Leak Repair - Kitchen", provider: { id: "p-2", name: "Quick Fix Plumbing" }, date: "2026-01-10", status: "completed", amount: 320, category: "Plumbing", type: "service", notes: "Fixed leak under kitchen sink, replaced P-trap" },
  { id: "se-3", homeId: "home-1", title: "Gutter Cleaning", provider: { id: "p-3", name: "CleanPro Services" }, date: "2025-12-15", status: "completed", amount: 175, category: "Exterior", type: "service" },
  { id: "se-4", homeId: "home-1", title: "Smoke Detector Battery Replacement", provider: { id: "self", name: "DIY" }, date: "2025-12-01", status: "completed", amount: 25, category: "Safety", type: "diy" },
  { id: "se-5", homeId: "home-1", title: "AC Tune-Up", provider: { id: "p-1", name: "Bay Area HVAC Pros" }, date: "2025-11-15", status: "completed", amount: 150, category: "HVAC", type: "service", warranty: { expiresAt: "2026-11-15", notes: "Parts and labor warranty" } },
  { id: "se-6", homeId: "home-1", title: "Deep Cleaning", provider: { id: "p-4", name: "Sparkle Clean" }, date: "2025-10-20", status: "completed", amount: 280, category: "Cleaning", type: "service" },
  { id: "se-7", homeId: "home-2", title: "Window Cleaning", provider: { id: "p-3", name: "CleanPro Services" }, date: "2026-01-18", status: "completed", amount: 120, category: "Exterior", type: "service" },
  { id: "se-8", homeId: "home-2", title: "Deck Staining", provider: { id: "p-5", name: "Coastal Contractors" }, date: "2025-11-25", status: "completed", amount: 850, category: "Exterior", type: "service", warranty: { expiresAt: "2027-11-25", notes: "2-year warranty on materials" } },
  { id: "se-9", homeId: "home-2", title: "Pest Control", provider: { id: "p-6", name: "Bug Busters" }, date: "2025-10-10", status: "completed", amount: 95, category: "Pest Control", type: "service" },
  { id: "se-10", homeId: "home-1", title: "Electrical Panel Inspection", provider: { id: "p-7", name: "Volt Electric" }, date: "2026-02-15", status: "upcoming", amount: 200, category: "Electrical", type: "service" },
  { id: "se-11", homeId: "home-2", title: "Roof Inspection", provider: { id: "p-8", name: "Top Notch Roofing" }, date: "2026-02-20", status: "upcoming", amount: 150, category: "Roof", type: "service" },
  { id: "se-12", homeId: "home-2", title: "HVAC Filter Replacement", provider: { id: "self", name: "DIY" }, date: "2025-09-15", status: "completed", amount: 40, category: "HVAC", type: "diy" },
];

const MOCK_PAST_PROVIDERS: PastProvider[] = [
  { id: "p-1", name: "Bay Area HVAC Pros", category: "HVAC", totalSpent: 335, jobsCompleted: 2, rating: 4.9, lastService: "2026-01-20" },
  { id: "p-2", name: "Quick Fix Plumbing", category: "Plumbing", totalSpent: 320, jobsCompleted: 1, rating: 4.7, lastService: "2026-01-10" },
  { id: "p-3", name: "CleanPro Services", category: "Cleaning", totalSpent: 295, jobsCompleted: 2, rating: 4.8, lastService: "2026-01-18" },
  { id: "p-4", name: "Sparkle Clean", category: "Cleaning", totalSpent: 280, jobsCompleted: 1, rating: 4.6, lastService: "2025-10-20" },
  { id: "p-5", name: "Coastal Contractors", category: "General", totalSpent: 850, jobsCompleted: 1, rating: 4.9, lastService: "2025-11-25" },
];

const FILTER_OPTIONS = ["All", "Completed", "Upcoming", "Invoices", "DIY", "Warranties"];

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  HVAC: "wind",
  Plumbing: "droplet",
  Electrical: "zap",
  Roof: "home",
  Exterior: "sun",
  Cleaning: "star",
  Safety: "shield",
  "Pest Control": "target",
  General: "tool",
};

const mapStatusToType = (status: string): StatusType => {
  switch (status) {
    case "completed": return "completed";
    case "in_progress": return "inProgress";
    case "upcoming": return "scheduled";
    case "cancelled": return "cancelled";
    default: return "pending";
  }
};

export default function ServiceHistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuthStore();

  const [homes, setHomes] = useState<Home[]>([]);
  const [selectedHome, setSelectedHome] = useState<Home | null>(null);
  const [isLoadingHomes, setIsLoadingHomes] = useState(true);
  const [showHomeSelector, setShowHomeSelector] = useState(false);
  const [activeTab, setActiveTab] = useState<"timeline" | "providers">("timeline");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedEntry, setSelectedEntry] = useState<ServiceEntry | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const getHomeDisplayName = (home: Home) => {
    return home.label || home.street || home.formattedAddress?.split(",")[0] || "My Home";
  };

  const getHomeLocation = (home: Home) => {
    if (home.city && home.state) return `${home.city}, ${home.state}`;
    if (home.formattedAddress) {
      const parts = home.formattedAddress.split(",");
      return parts.length > 1 ? parts.slice(1).join(",").trim() : "";
    }
    return "";
  };

  const fetchHomes = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingHomes(false);
      return;
    }
    try {
      const response = await fetch(new URL(`/api/homes/${user.id}`, getApiUrl()).href);
      if (response.ok) {
        const data = await response.json();
        setHomes(data || []);
        if (data && data.length > 0) {
          setSelectedHome(data[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching homes:", error);
    } finally {
      setIsLoadingHomes(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchHomes();
    }, [fetchHomes])
  );

  const filteredEntries = MOCK_SERVICE_ENTRIES
    .filter((e) => selectedHome ? e.homeId === selectedHome.id : true)
    .filter((e) => {
      if (activeFilter === "All") return true;
      if (activeFilter === "Completed") return e.status === "completed";
      if (activeFilter === "Upcoming") return e.status === "upcoming";
      if (activeFilter === "Invoices") return e.amount !== null;
      if (activeFilter === "DIY") return e.type === "diy";
      if (activeFilter === "Warranties") return e.warranty !== undefined;
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const groupedByMonth = filteredEntries.reduce((acc, entry) => {
    const month = new Date(entry.date).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!acc[month]) acc[month] = [];
    acc[month].push(entry);
    return acc;
  }, {} as Record<string, ServiceEntry[]>);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
  };

  const handleEntryPress = (entry: ServiceEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedEntry(entry);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const renderTimelineEntry = (entry: ServiceEntry, index: number) => (
    <Animated.View key={entry.id} entering={FadeInDown.delay(index * 50).duration(300)}>
      <Pressable onPress={() => handleEntryPress(entry)}>
        <View style={[styles.entryCard, { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.border }]}>
          <View style={[styles.entryIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name={CATEGORY_ICONS[entry.category] || "tool"} size={18} color={Colors.accent} />
          </View>
          <View style={styles.entryContent}>
            <View style={styles.entryHeader}>
              <ThemedText style={[styles.entryTitle, { color: theme.text }]} numberOfLines={1}>{entry.title}</ThemedText>
              <StatusPill status={mapStatusToType(entry.status)} label={entry.status} size="small" />
            </View>
            <ThemedText style={[styles.entryProvider, { color: theme.textSecondary }]}>{entry.provider.name}</ThemedText>
            <View style={styles.entryMeta}>
              <ThemedText style={[styles.entryDate, { color: theme.textSecondary }]}>{formatDate(entry.date)}</ThemedText>
              {entry.amount ? <ThemedText style={[styles.entryAmount, { color: Colors.accent }]}>${entry.amount}</ThemedText> : null}
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textTertiary} />
        </View>
      </Pressable>
    </Animated.View>
  );

  const renderProviderCard = (provider: PastProvider, index: number) => (
    <Animated.View key={provider.id} entering={FadeInDown.delay(index * 50).duration(300)}>
      <GlassCard style={styles.providerCard}>
        <View style={styles.providerHeader}>
          <Avatar size="medium" name={provider.name} />
          <View style={styles.providerInfo}>
            <ThemedText style={styles.providerName}>{provider.name}</ThemedText>
            <ThemedText style={[styles.providerCategory, { color: theme.textSecondary }]}>{provider.category}</ThemedText>
            <View style={styles.providerRating}>
              <Feather name="star" size={14} color={Colors.warning} />
              <ThemedText style={styles.providerRatingText}>{provider.rating}</ThemedText>
              <ThemedText style={[styles.providerJobs, { color: theme.textSecondary }]}>
                {provider.jobsCompleted} jobs
              </ThemedText>
            </View>
          </View>
          <View style={styles.providerSpend}>
            <ThemedText style={[styles.spendLabel, { color: theme.textSecondary }]}>Total Spent</ThemedText>
            <ThemedText style={styles.spendAmount}>${provider.totalSpent}</ThemedText>
          </View>
        </View>
        <View style={styles.providerActions}>
          <Pressable style={[styles.providerBtn, { backgroundColor: Colors.accent }]} onPress={() => navigation.navigate("ProviderProfile", { providerId: provider.id })}>
            <Feather name="user" size={16} color="#FFF" />
            <ThemedText style={styles.providerBtnText}>View Profile</ThemedText>
          </Pressable>
          <Pressable style={[styles.providerBtn, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="heart" size={16} color={theme.text} />
            <ThemedText style={[styles.providerBtnText, { color: theme.text }]}>Save</ThemedText>
          </Pressable>
          <Pressable style={[styles.providerBtn, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="refresh-cw" size={16} color={theme.text} />
            <ThemedText style={[styles.providerBtnText, { color: theme.text }]}>Rebook</ThemedText>
          </Pressable>
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderEntryDetail = () => {
    if (!selectedEntry) return null;

    return (
      <Modal visible={!!selectedEntry} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={styles.detailContainer}>
          <View style={[styles.detailHeader, { paddingTop: insets.top + Spacing.md }]}>
            <Pressable onPress={() => setSelectedEntry(null)} style={styles.detailBackButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText style={styles.detailTitle}>Service Details</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
            <GlassCard style={styles.detailSummary}>
              <View style={styles.detailSummaryHeader}>
                <View style={[styles.detailIcon, { backgroundColor: Colors.accentLight }]}>
                  <Feather name={CATEGORY_ICONS[selectedEntry.category] || "tool"} size={24} color={Colors.accent} />
                </View>
                <View style={styles.detailSummaryInfo}>
                  <ThemedText style={styles.detailSummaryTitle}>{selectedEntry.title}</ThemedText>
                  <ThemedText style={[styles.detailSummaryProvider, { color: theme.textSecondary }]}>
                    {selectedEntry.provider.name}
                  </ThemedText>
                  <StatusPill status={mapStatusToType(selectedEntry.status)} label={selectedEntry.status} size="small" />
                </View>
              </View>
              <View style={[styles.detailMetaRow, { borderTopColor: theme.separator }]}>
                <View style={styles.detailMetaItem}>
                  <ThemedText style={[styles.detailMetaLabel, { color: theme.textSecondary }]}>Date</ThemedText>
                  <ThemedText style={styles.detailMetaValue}>{formatDate(selectedEntry.date)}</ThemedText>
                </View>
                <View style={styles.detailMetaItem}>
                  <ThemedText style={[styles.detailMetaLabel, { color: theme.textSecondary }]}>Amount</ThemedText>
                  <ThemedText style={styles.detailMetaValue}>{selectedEntry.amount ? `$${selectedEntry.amount}` : "N/A"}</ThemedText>
                </View>
                <View style={styles.detailMetaItem}>
                  <ThemedText style={[styles.detailMetaLabel, { color: theme.textSecondary }]}>Category</ThemedText>
                  <ThemedText style={styles.detailMetaValue}>{selectedEntry.category}</ThemedText>
                </View>
              </View>
            </GlassCard>

            {selectedEntry.notes ? (
              <View style={styles.detailSection}>
                <ThemedText style={styles.detailSectionTitle}>Work Notes</ThemedText>
                <View style={[styles.notesCard, { backgroundColor: theme.cardBackground }]}>
                  <ThemedText style={[styles.notesText, { color: theme.textSecondary }]}>{selectedEntry.notes}</ThemedText>
                </View>
              </View>
            ) : null}

            {selectedEntry.warranty ? (
              <View style={styles.detailSection}>
                <ThemedText style={styles.detailSectionTitle}>Warranty Information</ThemedText>
                <GlassCard style={styles.warrantyCard}>
                  <View style={[styles.warrantyIcon, { backgroundColor: Colors.accentLight }]}>
                    <Feather name="shield" size={20} color={Colors.accent} />
                  </View>
                  <View style={styles.warrantyInfo}>
                    <ThemedText style={styles.warrantyExpires}>
                      Expires: {formatDate(selectedEntry.warranty.expiresAt)}
                    </ThemedText>
                    <ThemedText style={[styles.warrantyNotes, { color: theme.textSecondary }]}>
                      {selectedEntry.warranty.notes}
                    </ThemedText>
                  </View>
                </GlassCard>
              </View>
            ) : null}

            <View style={styles.detailSection}>
              <ThemedText style={styles.detailSectionTitle}>Invoice</ThemedText>
              <GlassCard style={styles.invoicePreview}>
                <Feather name="file-text" size={32} color={theme.textSecondary} />
                <ThemedText style={[styles.invoiceText, { color: theme.textSecondary }]}>Invoice available</ThemedText>
                <Pressable style={[styles.invoiceBtn, { borderColor: Colors.accent }]}>
                  <ThemedText style={[styles.invoiceBtnText, { color: Colors.accent }]}>Download Receipt</ThemedText>
                </Pressable>
              </GlassCard>
            </View>

            <View style={styles.detailActions}>
              <PrimaryButton onPress={() => { setSelectedEntry(null); navigation.navigate("SmartIntake"); }}>
                Rebook Service
              </PrimaryButton>
              <Pressable style={[styles.secondaryBtn, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="message-circle" size={18} color={theme.text} />
                <ThemedText style={styles.secondaryBtnText}>Message Provider</ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </ThemedView>
      </Modal>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.cardBackground }]}>
        <Feather name="clock" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText style={styles.emptyTitle}>No service history yet</ThemedText>
      <ThemedText style={[styles.emptyDescription, { color: theme.textSecondary }]}>
        Everything done for this home will appear here
      </ThemedText>
      <View style={styles.emptyActions}>
        <Pressable style={[styles.emptyBtn, { backgroundColor: Colors.accent }]} onPress={() => navigation.navigate("HealthScore")}>
          <ThemedText style={styles.emptyBtnText}>Start with a Health Score</ThemedText>
        </Pressable>
        <Pressable style={[styles.emptyBtn, { backgroundColor: theme.cardBackground }]} onPress={() => navigation.goBack()}>
          <ThemedText style={[styles.emptyBtnText, { color: theme.text }]}>Browse Providers</ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const renderHomeSelector = () => (
    <Modal visible={showHomeSelector} animationType="fade" transparent>
      <Pressable style={styles.modalOverlay} onPress={() => setShowHomeSelector(false)}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={styles.modalTitle}>Select Home</ThemedText>
          {homes.map((home) => (
            <Pressable
              key={home.id}
              style={[styles.homeOption, selectedHome?.id === home.id && { backgroundColor: Colors.accentLight }]}
              onPress={() => { setSelectedHome(home); setShowHomeSelector(false); }}
            >
              <View>
                <ThemedText style={styles.homeOptionName}>{getHomeDisplayName(home)}</ThemedText>
                <ThemedText style={[styles.homeOptionAddress, { color: theme.textSecondary }]}>{getHomeLocation(home)}</ThemedText>
              </View>
              {selectedHome?.id === home.id ? <Feather name="check" size={20} color={Colors.accent} /> : null}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );

  if (isLoadingHomes) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: headerHeight + Spacing.xl }]}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (homes.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.emptyState, { paddingTop: headerHeight + Spacing.xl }]}>
          <View style={[styles.emptyIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name="clock" size={48} color={Colors.accent} />
          </View>
          <ThemedText style={styles.emptyTitle}>No Homes Added</ThemedText>
          <ThemedText style={[styles.emptyDescription, { color: theme.textSecondary }]}>
            Add your first home to start tracking your service history
          </ThemedText>
          <PrimaryButton onPress={() => navigation.navigate("Addresses")}>
            Add Home
          </PrimaryButton>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: headerHeight + Spacing.md }]}>
        <Pressable style={[styles.homeSelector, { backgroundColor: theme.cardBackground }]} onPress={() => setShowHomeSelector(true)}>
          <Feather name="home" size={18} color={Colors.accent} />
          <ThemedText style={styles.homeSelectorText}>{selectedHome ? getHomeDisplayName(selectedHome) : "Select Home"}</ThemedText>
          <Feather name="chevron-down" size={18} color={theme.textSecondary} />
        </Pressable>

        <View style={styles.introRow}>
          <Feather name="clock" size={20} color={Colors.accent} />
          <ThemedText style={[styles.introText, { color: theme.textSecondary }]}>
            Everything done for this home, all in one place.
          </ThemedText>
        </View>

        <View style={styles.tabBar}>
          <Pressable style={[styles.tab, activeTab === "timeline" && styles.tabActive]} onPress={() => setActiveTab("timeline")}>
            <Feather name="list" size={18} color={activeTab === "timeline" ? Colors.accent : theme.textSecondary} />
            <ThemedText style={[styles.tabText, { color: activeTab === "timeline" ? Colors.accent : theme.textSecondary }]}>Timeline</ThemedText>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === "providers" && styles.tabActive]} onPress={() => setActiveTab("providers")}>
            <Feather name="users" size={18} color={activeTab === "providers" ? Colors.accent : theme.textSecondary} />
            <ThemedText style={[styles.tabText, { color: activeTab === "providers" ? Colors.accent : theme.textSecondary }]}>Providers</ThemedText>
          </Pressable>
        </View>
      </View>

      {activeTab === "timeline" ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
            {FILTER_OPTIONS.map((filter) => (
              <Pressable
                key={filter}
                style={[styles.filterChip, { backgroundColor: activeFilter === filter ? Colors.accent : theme.cardBackground }]}
                onPress={() => { setActiveFilter(filter); Haptics.selectionAsync(); }}
              >
                <ThemedText style={[styles.filterChipText, { color: activeFilter === filter ? "#FFF" : theme.text }]}>{filter}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          {filteredEntries.length > 0 ? (
            <ScrollView
              contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing["2xl"] }]}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
              showsVerticalScrollIndicator={false}
            >
              {Object.entries(groupedByMonth).map(([month, entries]) => (
                <View key={month} style={styles.monthGroup}>
                  <ThemedText style={[styles.monthTitle, { color: theme.textSecondary }]}>{month}</ThemedText>
                  {entries.map((entry, index) => renderTimelineEntry(entry, index))}
                </View>
              ))}
            </ScrollView>
          ) : (
            renderEmptyState()
          )}
        </>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing["2xl"] }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText style={styles.sectionTitle}>Providers Who've Worked Here</ThemedText>
          {MOCK_PAST_PROVIDERS.length > 0 ? (
            MOCK_PAST_PROVIDERS.map((provider, index) => renderProviderCard(provider, index))
          ) : (
            <View style={styles.emptyProviders}>
              <ThemedText style={[styles.emptyProvidersText, { color: theme.textSecondary }]}>
                No providers have worked on this home yet
              </ThemedText>
            </View>
          )}
        </ScrollView>
      )}

      {renderEntryDetail()}
      {renderHomeSelector()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.screenPadding },
  loadingText: { ...Typography.body, marginTop: Spacing.md },
  header: { paddingHorizontal: Spacing.screenPadding },
  homeSelector: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, marginBottom: Spacing.md, gap: Spacing.sm },
  homeSelectorText: { ...Typography.subhead, fontWeight: "500" },
  introRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.lg },
  introText: { ...Typography.footnote, flex: 1 },
  tabBar: { flexDirection: "row", marginBottom: Spacing.sm },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, gap: 6 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.accent },
  tabText: { ...Typography.subhead, fontWeight: "500" },
  filterScroll: { maxHeight: 48, marginBottom: Spacing.sm },
  filterContainer: { paddingHorizontal: Spacing.screenPadding, gap: Spacing.sm },
  filterChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  filterChipText: { ...Typography.caption1, fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.screenPadding },
  monthGroup: { marginBottom: Spacing.lg },
  monthTitle: { ...Typography.caption1, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: Spacing.sm },
  entryCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm, gap: Spacing.md },
  entryIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  entryContent: { flex: 1 },
  entryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  entryTitle: { ...Typography.headline, flex: 1, marginRight: Spacing.sm },
  entryProvider: { ...Typography.caption1, marginBottom: 4 },
  entryMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  entryDate: { ...Typography.caption2 },
  entryAmount: { ...Typography.subhead, fontWeight: "600" },
  sectionTitle: { ...Typography.headline, marginBottom: Spacing.md },
  providerCard: { marginBottom: Spacing.md },
  providerHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.md },
  providerInfo: { flex: 1 },
  providerName: { ...Typography.headline, marginBottom: 2 },
  providerCategory: { ...Typography.caption1, marginBottom: 4 },
  providerRating: { flexDirection: "row", alignItems: "center", gap: 4 },
  providerRatingText: { ...Typography.caption1, fontWeight: "600" },
  providerJobs: { ...Typography.caption2, marginLeft: Spacing.xs },
  providerSpend: { alignItems: "flex-end" },
  spendLabel: { ...Typography.caption2 },
  spendAmount: { ...Typography.title3, fontWeight: "700" },
  providerActions: { flexDirection: "row", gap: Spacing.sm },
  providerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, gap: 6 },
  providerBtnText: { ...Typography.caption1, fontWeight: "600", color: "#FFF" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl, paddingTop: Spacing["3xl"] },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg },
  emptyTitle: { ...Typography.title2, marginBottom: Spacing.xs },
  emptyDescription: { ...Typography.body, textAlign: "center", marginBottom: Spacing.xl },
  emptyActions: { gap: Spacing.sm, width: "100%" },
  emptyBtn: { paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center" },
  emptyBtnText: { ...Typography.subhead, fontWeight: "600", color: "#FFF" },
  emptyProviders: { alignItems: "center", paddingVertical: Spacing["2xl"] },
  emptyProvidersText: { ...Typography.body, textAlign: "center" },

  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  detailBackButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  detailTitle: { ...Typography.headline, flex: 1, textAlign: "center" },
  detailContent: { paddingHorizontal: Spacing.screenPadding, paddingBottom: Spacing["2xl"] },
  detailSummary: { marginBottom: Spacing.lg },
  detailSummaryHeader: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md, marginBottom: Spacing.md },
  detailIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  detailSummaryInfo: { flex: 1 },
  detailSummaryTitle: { ...Typography.title3, marginBottom: 4 },
  detailSummaryProvider: { ...Typography.subhead, marginBottom: Spacing.sm },
  detailMetaRow: { flexDirection: "row", paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  detailMetaItem: { flex: 1 },
  detailMetaLabel: { ...Typography.caption2, marginBottom: 2 },
  detailMetaValue: { ...Typography.subhead, fontWeight: "500" },
  detailSection: { marginBottom: Spacing.lg },
  detailSectionTitle: { ...Typography.headline, marginBottom: Spacing.sm },
  notesCard: { padding: Spacing.md, borderRadius: BorderRadius.md },
  notesText: { ...Typography.body },
  warrantyCard: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  warrantyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  warrantyInfo: { flex: 1 },
  warrantyExpires: { ...Typography.headline, marginBottom: 2 },
  warrantyNotes: { ...Typography.caption1 },
  invoicePreview: { alignItems: "center", paddingVertical: Spacing.xl },
  invoiceText: { ...Typography.subhead, marginVertical: Spacing.sm },
  invoiceBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1 },
  invoiceBtnText: { ...Typography.subhead, fontWeight: "500" },
  detailActions: { gap: Spacing.sm, marginTop: Spacing.lg },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm },
  secondaryBtnText: { ...Typography.subhead, fontWeight: "500" },

  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", padding: Spacing.xl },
  modalContent: { width: "100%", borderRadius: BorderRadius.lg, padding: Spacing.lg },
  modalTitle: { ...Typography.title3, marginBottom: Spacing.lg },
  homeOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.lg, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  homeOptionName: { ...Typography.headline, marginBottom: 2 },
  homeOptionAddress: { ...Typography.caption1 },
});
