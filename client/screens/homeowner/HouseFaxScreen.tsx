import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, ScrollView, Pressable, Image, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { getApiUrl } from "@/lib/query-client";

type TabType = "overview" | "history" | "assets" | "documents" | "insights";

interface Home {
  id: string;
  label?: string;
  street?: string;
  formattedAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  estimatedValue?: string;
  isDefault?: boolean;
}

interface Asset {
  id: string;
  name: string;
  category: string;
  installDate: string;
  age: number;
  model?: string;
  warrantyExpires?: string;
  icon: keyof typeof Feather.glyphMap;
  nextService?: string;
}

interface HistoryEvent {
  id: string;
  date: string;
  type: "job" | "invoice" | "assessment" | "update" | "document";
  title: string;
  description: string;
  amount?: number;
}

interface Document {
  id: string;
  name: string;
  type: "invoice" | "receipt" | "manual" | "warranty" | "inspection";
  date: string;
  assetId?: string;
}

const MOCK_ASSETS: Asset[] = [
  { id: "a1", name: "Central AC System", category: "HVAC", installDate: "Jun 2018", age: 7, model: "Carrier 24ACC636", warrantyExpires: "Jun 2028", icon: "wind", nextService: "Apr 2026" },
  { id: "a2", name: "Water Heater", category: "Plumbing", installDate: "Mar 2020", age: 5, model: "Rheem 50 Gal", warrantyExpires: "Mar 2026", icon: "droplet", nextService: "Mar 2026" },
  { id: "a3", name: "Roof", category: "Exterior", installDate: "Aug 2015", age: 10, model: "Asphalt Shingles", icon: "home", nextService: "Aug 2026" },
  { id: "a4", name: "Electrical Panel", category: "Electrical", installDate: "Jan 2019", age: 6, model: "Square D 200A", icon: "zap" },
  { id: "a5", name: "Dishwasher", category: "Appliances", installDate: "Nov 2021", age: 3, model: "Bosch 500 Series", warrantyExpires: "Nov 2024", icon: "box" },
  { id: "a6", name: "Sprinkler System", category: "Lawn", installDate: "Apr 2017", age: 8, model: "Rain Bird ESP-Me", icon: "cloud-rain", nextService: "Mar 2026" },
];

const MOCK_HISTORY: HistoryEvent[] = [
  { id: "h1", date: "Jan 2026", type: "job", title: "HVAC Tune-up", description: "Annual maintenance completed", amount: 285 },
  { id: "h2", date: "Dec 2025", type: "document", title: "Home Inspection Report", description: "Annual inspection uploaded" },
  { id: "h3", date: "Nov 2025", type: "update", title: "Roof Age Updated", description: "Changed from 9 to 10 years" },
  { id: "h4", date: "Oct 2025", type: "invoice", title: "Gutter Cleaning", description: "Fall cleaning service", amount: 175 },
  { id: "h5", date: "Aug 2025", type: "job", title: "Pest Control Treatment", description: "Quarterly treatment", amount: 125 },
  { id: "h6", date: "Jun 2025", type: "assessment", title: "Survival Kit Assessment", description: "Annual maintenance plan updated" },
  { id: "h7", date: "May 2025", type: "job", title: "Water Heater Flush", description: "Annual maintenance", amount: 145 },
  { id: "h8", date: "Mar 2025", type: "invoice", title: "Lawn Care Service", description: "Spring fertilization", amount: 95 },
];

const MOCK_DOCUMENTS: Document[] = [
  { id: "d1", name: "HVAC Invoice - Jan 2026", type: "invoice", date: "Jan 2026", assetId: "a1" },
  { id: "d2", name: "Home Inspection Report 2025", type: "inspection", date: "Dec 2025" },
  { id: "d3", name: "Water Heater Warranty", type: "warranty", date: "Mar 2020", assetId: "a2" },
  { id: "d4", name: "AC Unit Manual", type: "manual", date: "Jun 2018", assetId: "a1" },
  { id: "d5", name: "Gutter Cleaning Receipt", type: "receipt", date: "Oct 2025" },
  { id: "d6", name: "Pest Control Invoice", type: "invoice", date: "Aug 2025" },
  { id: "d7", name: "Roof Warranty Certificate", type: "warranty", date: "Aug 2015", assetId: "a3" },
  { id: "d8", name: "Electrical Panel Permit", type: "inspection", date: "Jan 2019", assetId: "a4" },
];

const TOTAL_SPENT = 12450;
const TOTAL_SAVED = 4525;
const UPCOMING_TASKS = 4;

export default function HouseFaxScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user } = useAuthStore();

  const [homes, setHomes] = useState<Home[]>([]);
  const [selectedHome, setSelectedHome] = useState<Home | null>(null);
  const [isLoadingHomes, setIsLoadingHomes] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [showHomeSelector, setShowHomeSelector] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryEvent["type"] | "all">("all");

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
          const defaultHome = data.find((h: Home) => h.isDefault) || data[0];
          setSelectedHome(defaultHome);
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getEventIcon = (type: HistoryEvent["type"]): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "job": return "tool";
      case "invoice": return "file-text";
      case "assessment": return "clipboard";
      case "update": return "edit-3";
      case "document": return "file";
    }
  };

  const getEventColor = (type: HistoryEvent["type"]) => {
    switch (type) {
      case "job": return Colors.accent;
      case "invoice": return "#3B82F6";
      case "assessment": return "#8B5CF6";
      case "update": return "#F59E0B";
      case "document": return "#6B7280";
    }
  };

  const getDocIcon = (type: Document["type"]): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "invoice": return "file-text";
      case "receipt": return "credit-card";
      case "manual": return "book";
      case "warranty": return "shield";
      case "inspection": return "search";
    }
  };

  const filteredHistory = historyFilter === "all" 
    ? MOCK_HISTORY 
    : MOCK_HISTORY.filter((h) => h.type === historyFilter);

  const getHomeDisplayAddress = (home: Home) => {
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

  const renderHomeSelector = () => {
    if (!selectedHome) return null;
    
    return (
      <Pressable
        onPress={() => setShowHomeSelector(!showHomeSelector)}
        style={[styles.homeSelector, { backgroundColor: theme.cardBackground }]}
      >
        <View style={[styles.homeSelectorIcon, { backgroundColor: Colors.accentLight }]}>
          <Feather name="home" size={18} color={Colors.accent} />
        </View>
        <View style={styles.homeSelectorInfo}>
          <ThemedText style={styles.homeSelectorAddress}>{getHomeDisplayAddress(selectedHome)}</ThemedText>
          <ThemedText style={[styles.homeSelectorCity, { color: theme.textSecondary }]}>
            {getHomeLocation(selectedHome)}
          </ThemedText>
        </View>
        <Feather name={showHomeSelector ? "chevron-up" : "chevron-down"} size={20} color={theme.textSecondary} />
      </Pressable>
    );
  };

  const renderSummaryCards = () => (
    <View style={styles.summaryGrid}>
      <Pressable 
        style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}
        onPress={() => navigation.navigate("SavingsSpend")}
      >
        <Feather name="credit-card" size={20} color={theme.textSecondary} />
        <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Spent</ThemedText>
        <ThemedText style={styles.summaryValue}>{formatCurrency(TOTAL_SPENT)}</ThemedText>
      </Pressable>
      
      <Pressable 
        style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}
        onPress={() => navigation.navigate("SavingsSpend")}
      >
        <Feather name="trending-up" size={20} color={Colors.accent} />
        <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Saved</ThemedText>
        <ThemedText style={[styles.summaryValue, { color: Colors.accent }]}>{formatCurrency(TOTAL_SAVED)}</ThemedText>
      </Pressable>
      
      <Pressable 
        style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}
        onPress={() => navigation.navigate("SurvivalKit")}
      >
        <Feather name="calendar" size={20} color="#F59E0B" />
        <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Upcoming</ThemedText>
        <ThemedText style={styles.summaryValue}>{UPCOMING_TASKS}</ThemedText>
      </Pressable>
      
      <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}>
        <Feather name="activity" size={20} color="#3B82F6" />
        <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Health Trend</ThemedText>
        <View style={styles.sparkline}>
          <View style={[styles.sparklineBar, { height: 12, backgroundColor: Colors.accent }]} />
          <View style={[styles.sparklineBar, { height: 16, backgroundColor: Colors.accent }]} />
          <View style={[styles.sparklineBar, { height: 14, backgroundColor: Colors.accent }]} />
          <View style={[styles.sparklineBar, { height: 20, backgroundColor: Colors.accent }]} />
          <View style={[styles.sparklineBar, { height: 18, backgroundColor: Colors.accent }]} />
        </View>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {(["overview", "history", "assets", "documents", "insights"] as TabType[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(tab);
            }}
            style={[
              styles.tab,
              activeTab === tab && { backgroundColor: Colors.accentLight },
            ]}
          >
            <ThemedText
              style={[
                styles.tabText,
                { color: activeTab === tab ? Colors.accent : theme.textSecondary },
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const renderOverviewTab = () => (
    <>
      <GlassCard style={styles.forecastCard}>
        <View style={styles.forecastHeader}>
          <ThemedText style={styles.sectionTitle}>This Month Forecast</ThemedText>
          <ThemedText style={[styles.forecastRange, { color: Colors.accent }]}>$180 - $250</ThemedText>
        </View>
        <View style={styles.forecastTasks}>
          <View style={styles.forecastTask}>
            <Feather name="wind" size={16} color={theme.textSecondary} />
            <ThemedText style={styles.forecastTaskText}>HVAC Filter Change</ThemedText>
            <Pressable onPress={() => navigation.navigate("SmartIntake", { prefillCategory: "HVAC" })}>
              <ThemedText style={[styles.bookLink, { color: Colors.accent }]}>Book</ThemedText>
            </Pressable>
          </View>
          <View style={styles.forecastTask}>
            <Feather name="droplet" size={16} color={theme.textSecondary} />
            <ThemedText style={styles.forecastTaskText}>Plumbing Check</ThemedText>
            <Pressable>
              <ThemedText style={[styles.bookLink, { color: Colors.accent }]}>Add to Plan</ThemedText>
            </Pressable>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.timelineCard}>
        <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
        {MOCK_HISTORY.slice(0, 4).map((event, index) => (
          <View key={event.id} style={styles.timelineEvent}>
            <View style={[styles.timelineDot, { backgroundColor: getEventColor(event.type) }]}>
              <Feather name={getEventIcon(event.type)} size={12} color="#FFFFFF" />
            </View>
            <View style={styles.timelineContent}>
              <ThemedText style={styles.timelineTitle}>{event.title}</ThemedText>
              <ThemedText style={[styles.timelineDate, { color: theme.textSecondary }]}>
                {event.date}
              </ThemedText>
            </View>
            {event.amount ? (
              <ThemedText style={styles.timelineAmount}>{formatCurrency(event.amount)}</ThemedText>
            ) : null}
          </View>
        ))}
        <Pressable 
          onPress={() => setActiveTab("history")}
          style={styles.viewAllButton}
        >
          <ThemedText style={[styles.viewAllText, { color: Colors.accent }]}>View All History</ThemedText>
        </Pressable>
      </GlassCard>

      <GlassCard style={styles.insightsPreview}>
        <View style={[styles.insightIcon, { backgroundColor: Colors.accentLight }]}>
          <Feather name="zap" size={20} color={Colors.accent} />
        </View>
        <ThemedText style={styles.insightTitle}>Top Cost Drivers</ThemedText>
        <ThemedText style={[styles.insightText, { color: theme.textSecondary }]}>
          HVAC and roof maintenance are your biggest expenses. Schedule preventive care to reduce costs.
        </ThemedText>
      </GlassCard>
    </>
  );

  const renderHistoryTab = () => (
    <>
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(["all", "job", "invoice", "assessment", "update", "document"] as const).map((filter) => (
            <Pressable
              key={filter}
              onPress={() => setHistoryFilter(filter)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: historyFilter === filter ? Colors.accentLight : theme.cardBackground,
                  borderColor: historyFilter === filter ? Colors.accent : theme.separator,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.filterChipText,
                  { color: historyFilter === filter ? Colors.accent : theme.textSecondary },
                ]}
              >
                {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1) + "s"}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.historyTimeline}>
        {filteredHistory.map((event, index) => (
          <View key={event.id} style={styles.historyItem}>
            <View style={styles.historyLine}>
              <View style={[styles.historyDot, { backgroundColor: getEventColor(event.type) }]}>
                <Feather name={getEventIcon(event.type)} size={12} color="#FFFFFF" />
              </View>
              {index < filteredHistory.length - 1 ? (
                <View style={[styles.historyConnector, { backgroundColor: theme.separator }]} />
              ) : null}
            </View>
            <GlassCard style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <ThemedText style={styles.historyTitle}>{event.title}</ThemedText>
                <ThemedText style={[styles.historyDate, { color: theme.textSecondary }]}>
                  {event.date}
                </ThemedText>
              </View>
              <ThemedText style={[styles.historyDescription, { color: theme.textSecondary }]}>
                {event.description}
              </ThemedText>
              {event.amount ? (
                <ThemedText style={[styles.historyAmount, { color: Colors.accent }]}>
                  {formatCurrency(event.amount)}
                </ThemedText>
              ) : null}
            </GlassCard>
          </View>
        ))}
      </View>
    </>
  );

  const renderAssetsTab = () => {
    if (selectedAsset) {
      return (
        <Animated.View entering={FadeInDown.duration(300)}>
          <Pressable 
            onPress={() => setSelectedAsset(null)} 
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={20} color={theme.textSecondary} />
            <ThemedText style={[styles.backButtonText, { color: theme.textSecondary }]}>
              Back to Assets
            </ThemedText>
          </Pressable>

          <GlassCard style={styles.assetDetailCard}>
            <View style={[styles.assetDetailIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name={selectedAsset.icon} size={32} color={Colors.accent} />
            </View>
            <ThemedText style={styles.assetDetailName}>{selectedAsset.name}</ThemedText>
            <ThemedText style={[styles.assetDetailCategory, { color: theme.textSecondary }]}>
              {selectedAsset.category}
            </ThemedText>

            <View style={styles.assetDetailGrid}>
              <View style={styles.assetDetailItem}>
                <ThemedText style={[styles.assetDetailLabel, { color: theme.textSecondary }]}>
                  Installed
                </ThemedText>
                <ThemedText style={styles.assetDetailValue}>{selectedAsset.installDate}</ThemedText>
              </View>
              <View style={styles.assetDetailItem}>
                <ThemedText style={[styles.assetDetailLabel, { color: theme.textSecondary }]}>
                  Age
                </ThemedText>
                <ThemedText style={styles.assetDetailValue}>{selectedAsset.age} years</ThemedText>
              </View>
              {selectedAsset.model ? (
                <View style={styles.assetDetailItem}>
                  <ThemedText style={[styles.assetDetailLabel, { color: theme.textSecondary }]}>
                    Model
                  </ThemedText>
                  <ThemedText style={styles.assetDetailValue}>{selectedAsset.model}</ThemedText>
                </View>
              ) : null}
              {selectedAsset.warrantyExpires ? (
                <View style={styles.assetDetailItem}>
                  <ThemedText style={[styles.assetDetailLabel, { color: theme.textSecondary }]}>
                    Warranty
                  </ThemedText>
                  <ThemedText style={styles.assetDetailValue}>{selectedAsset.warrantyExpires}</ThemedText>
                </View>
              ) : null}
            </View>
          </GlassCard>

          {selectedAsset.nextService ? (
            <GlassCard style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Feather name="calendar" size={20} color={Colors.accent} />
                <ThemedText style={styles.serviceTitle}>Recommended Service</ThemedText>
              </View>
              <ThemedText style={[styles.serviceDate, { color: theme.textSecondary }]}>
                Next service due: {selectedAsset.nextService}
              </ThemedText>
              <View style={styles.serviceActions}>
                <PrimaryButton
                  onPress={() => navigation.navigate("SmartIntake", { prefillCategory: selectedAsset.category })}
                  style={styles.serviceButton}
                >
                  Book Service
                </PrimaryButton>
                <Pressable style={[styles.reminderButton, { borderColor: theme.separator }]}>
                  <Feather name="bell" size={18} color={Colors.accent} />
                  <ThemedText style={[styles.reminderText, { color: Colors.accent }]}>
                    Add Reminder
                  </ThemedText>
                </Pressable>
              </View>
            </GlassCard>
          ) : null}
        </Animated.View>
      );
    }

    return (
      <View style={styles.assetsGrid}>
        {MOCK_ASSETS.map((asset) => (
          <Pressable
            key={asset.id}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedAsset(asset);
            }}
          >
            <GlassCard style={styles.assetCard}>
              <View style={[styles.assetIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name={asset.icon} size={20} color={Colors.accent} />
              </View>
              <ThemedText style={styles.assetName}>{asset.name}</ThemedText>
              <ThemedText style={[styles.assetCategory, { color: theme.textSecondary }]}>
                {asset.category}
              </ThemedText>
              <ThemedText style={[styles.assetAge, { color: theme.textTertiary }]}>
                {asset.age} years old
              </ThemedText>
            </GlassCard>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderDocumentsTab = () => (
    <>
      <Pressable style={[styles.uploadButton, { borderColor: theme.separator }]}>
        <Feather name="upload" size={20} color={Colors.accent} />
        <ThemedText style={[styles.uploadText, { color: Colors.accent }]}>Upload Document</ThemedText>
      </Pressable>

      <View style={styles.documentsGrid}>
        {MOCK_DOCUMENTS.map((doc) => (
          <Pressable key={doc.id}>
            <GlassCard style={styles.documentCard}>
              <View style={[styles.docIcon, { backgroundColor: theme.backgroundTertiary }]}>
                <Feather name={getDocIcon(doc.type)} size={20} color={theme.textSecondary} />
              </View>
              <ThemedText style={styles.docName} numberOfLines={2}>{doc.name}</ThemedText>
              <ThemedText style={[styles.docDate, { color: theme.textTertiary }]}>{doc.date}</ThemedText>
            </GlassCard>
          </Pressable>
        ))}
      </View>
    </>
  );

  const renderInsightsTab = () => (
    <>
      <GlassCard style={styles.predictiveCard}>
        <View style={styles.predictiveHeader}>
          <Feather name="trending-up" size={20} color={Colors.accent} />
          <ThemedText style={styles.predictiveTitle}>Next 12 Months Forecast</ThemedText>
        </View>
        <ThemedText style={styles.predictiveValue}>
          {formatCurrency(2800)} - {formatCurrency(3500)}
        </ThemedText>
        <ThemedText style={[styles.predictiveSubtext, { color: theme.textSecondary }]}>
          Based on your home profile and maintenance history
        </ThemedText>
      </GlassCard>

      <GlassCard style={styles.risksCard}>
        <ThemedText style={styles.sectionTitle}>Upcoming Risks</ThemedText>
        <View style={styles.risksList}>
          <View style={styles.riskItem}>
            <View style={[styles.riskIcon, { backgroundColor: Colors.warningLight }]}>
              <Feather name="alert-triangle" size={16} color={Colors.warning} />
            </View>
            <View style={styles.riskContent}>
              <ThemedText style={styles.riskTitle}>Water Heater Warranty Expiring</ThemedText>
              <ThemedText style={[styles.riskDate, { color: theme.textSecondary }]}>
                Mar 2026
              </ThemedText>
            </View>
          </View>
          <View style={styles.riskItem}>
            <View style={[styles.riskIcon, { backgroundColor: Colors.errorLight }]}>
              <Feather name="home" size={16} color={Colors.error} />
            </View>
            <View style={styles.riskContent}>
              <ThemedText style={styles.riskTitle}>Roof Approaching End of Life</ThemedText>
              <ThemedText style={[styles.riskDate, { color: theme.textSecondary }]}>
                ~5 years remaining
              </ThemedText>
            </View>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.suggestionsCard}>
        <ThemedText style={styles.sectionTitle}>Suggested Actions</ThemedText>
        <View style={styles.suggestionsList}>
          <View style={styles.suggestionItem}>
            <Feather name="check-circle" size={18} color={Colors.accent} />
            <ThemedText style={styles.suggestionText}>
              Schedule HVAC tune-up before summer to avoid peak pricing
            </ThemedText>
          </View>
          <View style={styles.suggestionItem}>
            <Feather name="check-circle" size={18} color={Colors.accent} />
            <ThemedText style={styles.suggestionText}>
              Get roof inspection to plan for replacement
            </ThemedText>
          </View>
          <View style={styles.suggestionItem}>
            <Feather name="check-circle" size={18} color={Colors.accent} />
            <ThemedText style={styles.suggestionText}>
              Extend water heater warranty before it expires
            </ThemedText>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.compareCard}>
        <ThemedText style={styles.sectionTitle}>Compare to Similar Homes</ThemedText>
        <ThemedText style={[styles.compareText, { color: theme.textSecondary }]}>
          Your maintenance costs are 12% lower than similar homes in your area.
        </ThemedText>
        <View style={styles.compareBar}>
          <View style={[styles.compareBarFill, { width: "88%", backgroundColor: Colors.accent }]} />
        </View>
        <View style={styles.compareLabels}>
          <ThemedText style={[styles.compareLabel, { color: theme.textSecondary }]}>You</ThemedText>
          <ThemedText style={[styles.compareLabel, { color: theme.textSecondary }]}>Average</ThemedText>
        </View>
      </GlassCard>
    </>
  );

  if (isLoadingHomes) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: headerHeight + Spacing.xl }]}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading your homes...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (homes.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.emptyContainer, { paddingTop: headerHeight + Spacing.xl }]}>
          <View style={[styles.emptyIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name="home" size={48} color={Colors.accent} />
          </View>
          <ThemedText style={styles.emptyTitle}>No Homes Added</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Add your first home to start tracking your HouseFax data
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
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl + 88,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {renderHomeSelector()}
        
        {showHomeSelector && homes.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.homeSelectorDropdown}>
            {homes.map((home) => (
              <Pressable
                key={home.id}
                onPress={() => {
                  setSelectedHome(home);
                  setShowHomeSelector(false);
                }}
                style={[
                  styles.homeOption,
                  selectedHome?.id === home.id && { backgroundColor: Colors.accentLight },
                ]}
              >
                <Feather 
                  name="home" 
                  size={18} 
                  color={selectedHome?.id === home.id ? Colors.accent : theme.textSecondary} 
                />
                <View style={styles.homeOptionInfo}>
                  <ThemedText style={styles.homeOptionAddress}>{getHomeDisplayAddress(home)}</ThemedText>
                  <ThemedText style={[styles.homeOptionCity, { color: theme.textSecondary }]}>
                    {getHomeLocation(home)}
                  </ThemedText>
                </View>
                {selectedHome?.id === home.id ? (
                  <Feather name="check" size={18} color={Colors.accent} />
                ) : null}
              </Pressable>
            ))}
          </Animated.View>
        ) : null}

        {renderSummaryCards()}
        {renderTabs()}

        {activeTab === "overview" ? renderOverviewTab() : null}
        {activeTab === "history" ? renderHistoryTab() : null}
        {activeTab === "assets" ? renderAssetsTab() : null}
        {activeTab === "documents" ? renderDocumentsTab() : null}
        {activeTab === "insights" ? renderInsightsTab() : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.screenPadding,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.screenPadding,
  },
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.title2,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  homeSelector: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  homeSelectorIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  homeSelectorInfo: {
    flex: 1,
  },
  homeSelectorAddress: {
    ...Typography.body,
    fontWeight: "600",
  },
  homeSelectorCity: {
    ...Typography.caption1,
  },
  homeSelectorDropdown: {
    marginBottom: Spacing.md,
  },
  homeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  homeOptionInfo: {
    flex: 1,
  },
  homeOptionAddress: {
    ...Typography.body,
  },
  homeOptionCity: {
    ...Typography.caption1,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    width: "48%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    gap: Spacing.xs,
  },
  summaryLabel: {
    ...Typography.caption1,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  sparkline: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 24,
  },
  sparklineBar: {
    width: 6,
    borderRadius: 2,
  },
  tabsContainer: {
    marginBottom: Spacing.lg,
  },
  tab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.xs,
  },
  tabText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  forecastCard: {
    marginBottom: Spacing.md,
  },
  forecastHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  forecastRange: {
    ...Typography.headline,
  },
  forecastTasks: {
    gap: Spacing.sm,
  },
  forecastTask: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  forecastTaskText: {
    ...Typography.body,
    flex: 1,
  },
  bookLink: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  timelineCard: {
    marginBottom: Spacing.md,
  },
  timelineEvent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    ...Typography.body,
  },
  timelineDate: {
    ...Typography.caption1,
  },
  timelineAmount: {
    ...Typography.body,
    fontWeight: "600",
  },
  viewAllButton: {
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  viewAllText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  insightsPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  insightIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    flex: 1,
  },
  insightText: {
    ...Typography.caption1,
    flex: 2,
  },
  filterRow: {
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.xs,
    borderWidth: 1,
  },
  filterChipText: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  historyTimeline: {
    paddingLeft: Spacing.xs,
  },
  historyItem: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  historyLine: {
    width: 28,
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  historyDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  historyConnector: {
    width: 2,
    flex: 1,
    marginTop: Spacing.xs,
  },
  historyCard: {
    flex: 1,
    padding: Spacing.md,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  historyTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    flex: 1,
  },
  historyDate: {
    ...Typography.caption1,
  },
  historyDescription: {
    ...Typography.caption1,
  },
  historyAmount: {
    ...Typography.subhead,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
  assetsGrid: {
    gap: Spacing.sm,
  },
  assetCard: {
    marginBottom: Spacing.sm,
    alignItems: "center",
  },
  assetIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  assetName: {
    ...Typography.body,
    fontWeight: "600",
    textAlign: "center",
  },
  assetCategory: {
    ...Typography.caption1,
    marginTop: 2,
  },
  assetAge: {
    ...Typography.caption2,
    marginTop: 2,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  backButtonText: {
    ...Typography.subhead,
  },
  assetDetailCard: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  assetDetailIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  assetDetailName: {
    ...Typography.title2,
    marginBottom: Spacing.xs,
  },
  assetDetailCategory: {
    ...Typography.subhead,
    marginBottom: Spacing.lg,
  },
  assetDetailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    gap: Spacing.md,
  },
  assetDetailItem: {
    width: "45%",
  },
  assetDetailLabel: {
    ...Typography.caption1,
    marginBottom: 2,
  },
  assetDetailValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  serviceCard: {
    marginBottom: Spacing.md,
  },
  serviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  serviceTitle: {
    ...Typography.headline,
  },
  serviceDate: {
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  serviceActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  serviceButton: {
    flex: 1,
  },
  reminderButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  reminderText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: Spacing.lg,
  },
  uploadText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  documentsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  documentCard: {
    width: "48%",
    alignItems: "center",
    padding: Spacing.md,
  },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  docName: {
    ...Typography.caption1,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  docDate: {
    ...Typography.caption2,
  },
  predictiveCard: {
    marginBottom: Spacing.md,
  },
  predictiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  predictiveTitle: {
    ...Typography.headline,
  },
  predictiveValue: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  predictiveSubtext: {
    ...Typography.caption1,
  },
  risksCard: {
    marginBottom: Spacing.md,
  },
  risksList: {
    gap: Spacing.sm,
  },
  riskItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  riskIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  riskContent: {
    flex: 1,
  },
  riskTitle: {
    ...Typography.body,
  },
  riskDate: {
    ...Typography.caption1,
  },
  suggestionsCard: {
    marginBottom: Spacing.md,
  },
  suggestionsList: {
    gap: Spacing.sm,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  suggestionText: {
    ...Typography.body,
    flex: 1,
  },
  compareCard: {
    marginBottom: Spacing.md,
  },
  compareText: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  compareBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginBottom: Spacing.xs,
  },
  compareBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  compareLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  compareLabel: {
    ...Typography.caption1,
  },
});
