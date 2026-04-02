import React, { useState, useCallback } from "react";
import { StyleSheet, View, ScrollView, Pressable, ActivityIndicator, RefreshControl, Image, Modal } from "react-native";
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
import { apiRequest, getApiUrl } from "@/lib/query-client";

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
  housefaxScore?: number;
}

interface HousefaxEntry {
  id: string;
  homeId: string;
  jobId: string | null;
  appointmentId: string | null;
  serviceCategory: string;
  serviceName: string;
  providerId: string | null;
  providerName: string | null;
  completedAt: string;
  costCents: number;
  aiSummary: string | null;
  photos: string[];
  systemAffected: string | null;
  notes: string | null;
  createdAt: string;
}

interface Asset {
  system: string;
  lastServiced: string;
  serviceCount: number;
  lastServiceName: string;
  lastProviderName: string | null;
  nextDue: string | null;
  recommendedIntervalMonths: number | null;
}

interface Document {
  id: string;
  name: string;
  type: "invoice" | "receipt" | "manual" | "warranty" | "inspection";
  date: string;
  amount: number;
  providerId: string | null;
  providerName: string | null;
  hasPhotos?: boolean;
}

interface HouseFaxData {
  entries: HousefaxEntry[];
  assets: Asset[];
  score: number;
  totalSpentCents: number;
  documents: Document[];
  insights: string[];
}

const SYSTEM_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  HVAC: "wind",
  Plumbing: "droplet",
  Electrical: "zap",
  Roof: "home",
  "Pest Control": "shield",
  Lawn: "cloud-rain",
  Painting: "edit-3",
  Cleaning: "star",
  Appliances: "box",
  General: "tool",
};

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
  const [housefaxData, setHousefaxData] = useState<HouseFaxData | null>(null);
  const [isLoadingFax, setIsLoadingFax] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAssetSystem, setSelectedAssetSystem] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<string>("all");

  const fetchHomes = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingHomes(false);
      return;
    }
    try {
      const response = await apiRequest("GET", `/api/homes/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        const homesArray = Array.isArray(data?.homes) ? data.homes : [];
        setHomes(homesArray);
        if (homesArray.length > 0) {
          const defaultHome = homesArray.find((h: Home) => h.isDefault) || homesArray[0];
          setSelectedHome(defaultHome);
        }
      } else {
        setHomes([]);
      }
    } catch (error) {
      console.error("Error fetching homes:", error);
      setHomes([]);
    } finally {
      setIsLoadingHomes(false);
    }
  }, [user?.id]);

  const fetchHouseFaxData = useCallback(async (homeId: string, isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoadingFax(true);
    try {
      const url = new URL(`/api/housefax/${homeId}`, getApiUrl());
      const response = await apiRequest("GET", url.toString());
      if (response.ok) {
        const data = await response.json();
        setHousefaxData(data);
      }
    } catch (error) {
      console.error("Error fetching HouseFax data:", error);
    } finally {
      setIsLoadingFax(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHomes();
    }, [fetchHomes])
  );

  useFocusEffect(
    useCallback(() => {
      if (selectedHome?.id) {
        fetchHouseFaxData(selectedHome.id);
      }
    }, [selectedHome?.id, fetchHouseFaxData])
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const getSystemIcon = (system: string): keyof typeof Feather.glyphMap => {
    return SYSTEM_ICONS[system] || "tool";
  };

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

  const filteredEntries = housefaxData?.entries
    ? (historyFilter === "all" ? housefaxData.entries : housefaxData.entries.filter(e => e.serviceCategory === historyFilter))
    : [];

  const healthScore = selectedHome?.housefaxScore ?? housefaxData?.score ?? 0;
  const totalSpent = (housefaxData?.totalSpentCents ?? 0) / 100;

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

  const renderHealthScoreCard = () => (
    <View style={[styles.scoreCard, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.scoreCircleContainer}>
        <View style={[styles.scoreCircle, { borderColor: healthScore >= 70 ? Colors.accent : healthScore >= 40 ? "#F59E0B" : "#EF4444" }]}>
          <ThemedText style={styles.scoreNumber}>{healthScore}</ThemedText>
          <ThemedText style={[styles.scoreLabel, { color: theme.textSecondary }]}>/ 100</ThemedText>
        </View>
      </View>
      <View style={styles.scoreInfo}>
        <ThemedText style={styles.scoreTitle}>Home Health Score</ThemedText>
        <ThemedText style={[styles.scoreSubtitle, { color: theme.textSecondary }]}>
          {healthScore >= 70 ? "Well maintained" : healthScore >= 40 ? "Needs attention" : "Maintenance overdue"}
        </ThemedText>
        <View style={styles.scoreMeta}>
          <ThemedText style={[styles.scoreMetaItem, { color: theme.textSecondary }]}>
            {housefaxData?.entries.length ?? 0} jobs logged
          </ThemedText>
          <ThemedText style={[styles.scoreMetaItem, { color: Colors.accent }]}>
            {formatCurrency(totalSpent)} spent
          </ThemedText>
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

  const renderOverviewTab = () => {
    const recentEntries = housefaxData?.entries.slice(0, 4) || [];
    const hasData = recentEntries.length > 0;

    return (
      <>
        {hasData ? (
          <GlassCard style={styles.timelineCard}>
            <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
            {recentEntries.map((entry) => (
              <View key={entry.id} style={styles.timelineEvent}>
                <View style={[styles.timelineDot, { backgroundColor: Colors.accent }]}>
                  <Feather name={getSystemIcon(entry.systemAffected || entry.serviceCategory)} size={12} color="#FFFFFF" />
                </View>
                <View style={styles.timelineContent}>
                  <ThemedText style={styles.timelineTitle}>{entry.serviceName}</ThemedText>
                  <ThemedText style={[styles.timelineDate, { color: theme.textSecondary }]}>
                    {formatDate(entry.completedAt)}
                  </ThemedText>
                </View>
                {entry.costCents > 0 ? (
                  <ThemedText style={styles.timelineAmount}>{formatCurrency(entry.costCents / 100)}</ThemedText>
                ) : null}
              </View>
            ))}
            <Pressable onPress={() => setActiveTab("history")} style={styles.viewAllButton}>
              <ThemedText style={[styles.viewAllText, { color: Colors.accent }]}>View All History</ThemedText>
            </Pressable>
          </GlassCard>
        ) : (
          <GlassCard style={styles.emptyCard}>
            <View style={[styles.emptyCardIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name="file-text" size={32} color={Colors.accent} />
            </View>
            <ThemedText style={styles.emptyCardTitle}>Your HouseFax Builds Automatically</ThemedText>
            <ThemedText style={[styles.emptyCardText, { color: theme.textSecondary }]}>
              As jobs are completed, they are automatically logged here with an AI-generated summary and service history.
            </ThemedText>
            <PrimaryButton
              onPress={() => navigation.navigate("SmartIntake")}
              style={styles.emptyCardButton}
            >
              Book a Service
            </PrimaryButton>
          </GlassCard>
        )}

        {housefaxData?.insights && housefaxData.insights.length > 0 ? (
          <GlassCard style={styles.insightsPreviewCard}>
            <View style={[styles.insightIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name="zap" size={20} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.insightTitle}>Top Recommendation</ThemedText>
              <ThemedText style={[styles.insightText, { color: theme.textSecondary }]}>
                {housefaxData.insights[0]}
              </ThemedText>
            </View>
          </GlassCard>
        ) : null}
      </>
    );
  };

  const renderHistoryTab = () => {
    const categories = ["all", ...Array.from(new Set((housefaxData?.entries || []).map(e => e.serviceCategory)))];

    return (
      <>
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setHistoryFilter(cat)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: historyFilter === cat ? Colors.accentLight : theme.cardBackground,
                    borderColor: historyFilter === cat ? Colors.accent : theme.separator,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.filterChipText,
                    { color: historyFilter === cat ? Colors.accent : theme.textSecondary },
                  ]}
                >
                  {cat === "all" ? "All" : cat}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {filteredEntries.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <View style={[styles.emptyCardIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name="clock" size={32} color={Colors.accent} />
            </View>
            <ThemedText style={styles.emptyCardTitle}>No Service History Yet</ThemedText>
            <ThemedText style={[styles.emptyCardText, { color: theme.textSecondary }]}>
              Your HouseFax builds automatically as jobs are completed. Book a service to get started.
            </ThemedText>
          </GlassCard>
        ) : (
          <View style={styles.historyTimeline}>
            {filteredEntries.map((entry, index) => (
              <View key={entry.id} style={styles.historyItem}>
                <View style={styles.historyLine}>
                  <View style={[styles.historyDot, { backgroundColor: Colors.accent }]}>
                    <Feather name={getSystemIcon(entry.systemAffected || entry.serviceCategory)} size={12} color="#FFFFFF" />
                  </View>
                  {index < filteredEntries.length - 1 ? (
                    <View style={[styles.historyConnector, { backgroundColor: theme.separator }]} />
                  ) : null}
                </View>
                <GlassCard style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <ThemedText style={styles.historyTitle}>{entry.serviceName}</ThemedText>
                    <ThemedText style={[styles.historyDate, { color: theme.textSecondary }]}>
                      {formatDate(entry.completedAt)}
                    </ThemedText>
                  </View>
                  {entry.aiSummary ? (
                    <ThemedText style={[styles.historyDescription, { color: theme.textSecondary }]}>
                      {entry.aiSummary}
                    </ThemedText>
                  ) : null}
                  <View style={styles.historyMeta}>
                    {entry.providerName ? (
                      <View style={styles.historyMetaItem}>
                        <Feather name="user" size={12} color={theme.textTertiary} />
                        <ThemedText style={[styles.historyMetaText, { color: theme.textTertiary }]}>
                          {entry.providerName}
                        </ThemedText>
                      </View>
                    ) : null}
                    {entry.costCents > 0 ? (
                      <ThemedText style={[styles.historyAmount, { color: Colors.accent }]}>
                        {formatCurrency(entry.costCents / 100)}
                      </ThemedText>
                    ) : null}
                  </View>
                  {Array.isArray(entry.photos) && entry.photos.length > 0 ? (
                    <View style={styles.photosRow}>
                      {entry.photos.slice(0, 4).map((uri: string, idx: number) => (
                        <Pressable key={idx} onPress={() => setLightboxPhoto(uri)} testID={`photo-thumb-${entry.id}-${idx}`}>
                          <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                        </Pressable>
                      ))}
                      {entry.photos.length > 4 ? (
                        <View style={[styles.photoThumb, styles.photoMoreOverlay]}>
                          <ThemedText style={styles.photoMoreText}>+{entry.photos.length - 4}</ThemedText>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </GlassCard>
              </View>
            ))}
          </View>
        )}
      </>
    );
  };

  const renderAssetsTab = () => {
    if (selectedAssetSystem) {
      const asset = housefaxData?.assets.find(a => a.system === selectedAssetSystem);
      const assetEntries = housefaxData?.entries.filter(e =>
        (e.systemAffected || e.serviceCategory) === selectedAssetSystem
      ) || [];

      if (!asset) return null;

      return (
        <Animated.View entering={FadeInDown.duration(300)}>
          <Pressable onPress={() => setSelectedAssetSystem(null)} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color={theme.textSecondary} />
            <ThemedText style={[styles.backButtonText, { color: theme.textSecondary }]}>
              Back to Assets
            </ThemedText>
          </Pressable>

          <GlassCard style={styles.assetDetailCard}>
            <View style={[styles.assetDetailIcon, { backgroundColor: Colors.accentLight }]}>
              <Feather name={getSystemIcon(asset.system)} size={32} color={Colors.accent} />
            </View>
            <ThemedText style={styles.assetDetailName}>{asset.system}</ThemedText>
            <ThemedText style={[styles.assetDetailCategory, { color: theme.textSecondary }]}>
              {asset.serviceCount} service{asset.serviceCount !== 1 ? "s" : ""} logged
            </ThemedText>
            <View style={styles.assetDetailGrid}>
              <View style={styles.assetDetailItem}>
                <ThemedText style={[styles.assetDetailLabel, { color: theme.textSecondary }]}>Last Serviced</ThemedText>
                <ThemedText style={styles.assetDetailValue}>{formatDate(asset.lastServiced)}</ThemedText>
              </View>
              {asset.nextDue ? (
                <View style={styles.assetDetailItem}>
                  <ThemedText style={[styles.assetDetailLabel, { color: theme.textSecondary }]}>Next Due</ThemedText>
                  <ThemedText style={[
                    styles.assetDetailValue,
                    new Date(asset.nextDue) < new Date() ? { color: "#EF4444" } : { color: Colors.accent }
                  ]}>
                    {formatDate(asset.nextDue)}
                  </ThemedText>
                </View>
              ) : null}
              {asset.lastProviderName ? (
                <View style={styles.assetDetailItem}>
                  <ThemedText style={[styles.assetDetailLabel, { color: theme.textSecondary }]}>Provider</ThemedText>
                  <ThemedText style={styles.assetDetailValue}>{asset.lastProviderName}</ThemedText>
                </View>
              ) : null}
              {asset.recommendedIntervalMonths ? (
                <View style={styles.assetDetailItem}>
                  <ThemedText style={[styles.assetDetailLabel, { color: theme.textSecondary }]}>Service Every</ThemedText>
                  <ThemedText style={styles.assetDetailValue}>
                    {asset.recommendedIntervalMonths >= 12
                      ? `${Math.round(asset.recommendedIntervalMonths / 12)} yr`
                      : `${asset.recommendedIntervalMonths} mo`}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </GlassCard>

          {assetEntries.length > 0 ? (
            <GlassCard style={styles.serviceCard}>
              <ThemedText style={styles.sectionTitle}>Service History</ThemedText>
              {assetEntries.map(entry => (
                <View key={entry.id} style={styles.assetHistoryItem}>
                  <ThemedText style={styles.assetHistoryDate}>{formatDate(entry.completedAt)}</ThemedText>
                  <ThemedText style={styles.assetHistoryName}>{entry.serviceName}</ThemedText>
                  {entry.aiSummary ? (
                    <ThemedText style={[styles.assetHistorySummary, { color: theme.textSecondary }]}>
                      {entry.aiSummary}
                    </ThemedText>
                  ) : null}
                </View>
              ))}
            </GlassCard>
          ) : null}

          <GlassCard style={styles.serviceCard}>
            <View style={styles.serviceHeader}>
              <Feather name="calendar" size={20} color={Colors.accent} />
              <ThemedText style={styles.serviceTitle}>Book Next Service</ThemedText>
            </View>
            <PrimaryButton
              onPress={() => navigation.navigate("SmartIntake", { prefillCategory: asset.system })}
              style={styles.serviceButton}
            >
              Book Service
            </PrimaryButton>
          </GlassCard>
        </Animated.View>
      );
    }

    if (!housefaxData || housefaxData.assets.length === 0) {
      return (
        <GlassCard style={styles.emptyCard}>
          <View style={[styles.emptyCardIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name="layers" size={32} color={Colors.accent} />
          </View>
          <ThemedText style={styles.emptyCardTitle}>No Assets Tracked Yet</ThemedText>
          <ThemedText style={[styles.emptyCardText, { color: theme.textSecondary }]}>
            Assets are derived from your service history. Complete jobs to start tracking your home systems.
          </ThemedText>
        </GlassCard>
      );
    }

    return (
      <View style={styles.assetsGrid}>
        {housefaxData.assets.map((asset) => (
          <Pressable
            key={asset.system}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedAssetSystem(asset.system);
            }}
          >
            <GlassCard style={styles.assetCard}>
              <View style={[styles.assetIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name={getSystemIcon(asset.system)} size={20} color={Colors.accent} />
              </View>
              <ThemedText style={styles.assetName}>{asset.system}</ThemedText>
              <ThemedText style={[styles.assetCategory, { color: theme.textSecondary }]}>
                Last: {formatDate(asset.lastServiced)}
              </ThemedText>
              {asset.nextDue ? (
                <ThemedText style={[
                  styles.assetAge,
                  new Date(asset.nextDue) < new Date() ? { color: "#EF4444" } : { color: theme.textTertiary }
                ]}>
                  {new Date(asset.nextDue) < new Date() ? "Due now" : `Due ${formatDate(asset.nextDue)}`}
                </ThemedText>
              ) : (
                <ThemedText style={[styles.assetAge, { color: theme.textTertiary }]}>
                  {asset.serviceCount} service{asset.serviceCount !== 1 ? "s" : ""}
                </ThemedText>
              )}
            </GlassCard>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderDocumentsTab = () => {
    if (!housefaxData || housefaxData.documents.length === 0) {
      return (
        <GlassCard style={styles.emptyCard}>
          <View style={[styles.emptyCardIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name="file" size={32} color={Colors.accent} />
          </View>
          <ThemedText style={styles.emptyCardTitle}>No Documents Yet</ThemedText>
          <ThemedText style={[styles.emptyCardText, { color: theme.textSecondary }]}>
            Invoices and receipts from completed jobs will appear here automatically.
          </ThemedText>
        </GlassCard>
      );
    }

    return (
      <View style={styles.documentsGrid}>
        {housefaxData.documents.map((doc) => (
          <GlassCard key={doc.id} style={styles.documentCard}>
            <View style={[styles.docIcon, { backgroundColor: theme.backgroundTertiary }]}>
              <Feather name="file-text" size={20} color={theme.textSecondary} />
            </View>
            <ThemedText style={styles.docName} numberOfLines={2}>{doc.name}</ThemedText>
            <ThemedText style={[styles.docDate, { color: theme.textTertiary }]}>{doc.date}</ThemedText>
            {doc.amount > 0 ? (
              <ThemedText style={[styles.docAmount, { color: Colors.accent }]}>
                {formatCurrency(doc.amount)}
              </ThemedText>
            ) : null}
          </GlassCard>
        ))}
      </View>
    );
  };

  const renderInsightsTab = () => {
    if (!housefaxData || housefaxData.insights.length === 0) {
      return (
        <GlassCard style={styles.emptyCard}>
          <View style={[styles.emptyCardIcon, { backgroundColor: Colors.accentLight }]}>
            <Feather name="trending-up" size={32} color={Colors.accent} />
          </View>
          <ThemedText style={styles.emptyCardTitle}>Insights Coming Soon</ThemedText>
          <ThemedText style={[styles.emptyCardText, { color: theme.textSecondary }]}>
            As you build your service history, personalized recommendations will appear here.
          </ThemedText>
        </GlassCard>
      );
    }

    return (
      <>
        <GlassCard style={styles.risksCard}>
          <ThemedText style={styles.sectionTitle}>Personalized Recommendations</ThemedText>
          <View style={styles.suggestionsList}>
            {housefaxData.insights.map((insight, index) => (
              <View key={index} style={styles.suggestionItem}>
                <Feather name="check-circle" size={18} color={Colors.accent} />
                <ThemedText style={[styles.suggestionText, { flex: 1 }]}>{insight}</ThemedText>
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard style={styles.compareCard}>
          <View style={styles.predictiveHeader}>
            <Feather name="activity" size={20} color={Colors.accent} />
            <ThemedText style={styles.predictiveTitle}>Health Score Breakdown</ThemedText>
          </View>
          <ThemedText style={[styles.compareText, { color: theme.textSecondary }]}>
            Your home health score of {healthScore} is calculated based on service coverage, recency, and documentation.
          </ThemedText>
          <View style={styles.compareBar}>
            <View style={[styles.compareBarFill, { width: `${healthScore}%`, backgroundColor: healthScore >= 70 ? Colors.accent : healthScore >= 40 ? "#F59E0B" : "#EF4444" }]} />
          </View>
          <View style={styles.compareLabels}>
            <ThemedText style={[styles.compareLabel, { color: theme.textSecondary }]}>0</ThemedText>
            <ThemedText style={[styles.compareLabel, { color: theme.textSecondary }]}>100</ThemedText>
          </View>
        </GlassCard>
      </>
    );
  };

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
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => selectedHome?.id && fetchHouseFaxData(selectedHome.id, true)}
            tintColor={Colors.accent}
          />
        }
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
                  setHousefaxData(null);
                  fetchHouseFaxData(home.id);
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

        {isLoadingFax ? (
          <View style={styles.faxLoading}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <ThemedText style={[styles.faxLoadingText, { color: theme.textSecondary }]}>
              Loading HouseFax data...
            </ThemedText>
          </View>
        ) : null}

        {!isLoadingFax ? renderHealthScoreCard() : null}
        {renderTabs()}

        {activeTab === "overview" ? renderOverviewTab() : null}
        {activeTab === "history" ? renderHistoryTab() : null}
        {activeTab === "assets" ? renderAssetsTab() : null}
        {activeTab === "documents" ? renderDocumentsTab() : null}
        {activeTab === "insights" ? renderInsightsTab() : null}
      </ScrollView>

      {lightboxPhoto ? (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setLightboxPhoto(null)}
        >
          <Pressable
            style={styles.lightboxOverlay}
            onPress={() => setLightboxPhoto(null)}
            testID="lightbox-close"
          >
            <Image
              source={{ uri: lightboxPhoto }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          </Pressable>
        </Modal>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  faxLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  faxLoadingText: {
    ...Typography.body,
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
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  scoreCircleContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNumber: {
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 30,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  scoreInfo: {
    flex: 1,
  },
  scoreTitle: {
    ...Typography.headline,
    marginBottom: 2,
  },
  scoreSubtitle: {
    ...Typography.caption1,
    marginBottom: Spacing.sm,
  },
  scoreMeta: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  scoreMetaItem: {
    ...Typography.caption1,
    fontWeight: "500",
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
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  emptyCardIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyCardTitle: {
    ...Typography.headline,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyCardText: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  emptyCardButton: {
    minWidth: 160,
  },
  insightsPreviewCard: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    marginBottom: Spacing.xs,
  },
  insightText: {
    ...Typography.caption1,
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
    marginBottom: Spacing.xs,
  },
  historyMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  historyMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyMetaText: {
    ...Typography.caption2,
  },
  historyAmount: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  photosRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.sm,
  },
  photoMoreOverlay: {
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  photoMoreText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxImage: {
    width: "100%",
    height: "80%",
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
  assetHistoryItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  assetHistoryDate: {
    ...Typography.caption1,
    fontWeight: "600",
  },
  assetHistoryName: {
    ...Typography.body,
  },
  assetHistorySummary: {
    ...Typography.caption1,
    marginTop: 2,
  },
  serviceCard: {
    marginBottom: Spacing.md,
  },
  serviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  serviceTitle: {
    ...Typography.headline,
  },
  serviceButton: {
    marginTop: Spacing.sm,
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
  docAmount: {
    ...Typography.caption1,
    fontWeight: "600",
    marginTop: 2,
  },
  risksCard: {
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
  },
  compareCard: {
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
  compareText: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  compareBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginBottom: Spacing.xs,
    overflow: "hidden",
  },
  compareBarFill: {
    height: "100%",
    borderRadius: 6,
  },
  compareLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  compareLabel: {
    ...Typography.caption1,
  },
});
