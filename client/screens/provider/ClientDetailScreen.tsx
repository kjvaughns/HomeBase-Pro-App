import React, { useState, useMemo } from "react";
import { StyleSheet, View, ScrollView, Pressable, Linking, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";
import { useProviderStore, Client, ClientActivity, ClientNote, Job, Invoice } from "@/state/providerStore";
import { useAuthStore } from "@/state/authStore";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type TabType = "overview" | "jobs" | "invoices" | "notes" | "home";

// Helper to get client name from either name field or firstName/lastName
function getClientName(client: any): string {
  if (client.name) return client.name;
  const parts = [client.firstName, client.lastName].filter(Boolean);
  return parts.join(" ") || "Unknown";
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface ActionButtonProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}

function ActionButton({ icon, label, onPress, primary }: ActionButtonProps) {
  const { theme } = useTheme();
  
  return (
    <Pressable
      style={[
        styles.actionButton,
        primary
          ? { backgroundColor: Colors.accent }
          : { backgroundColor: theme.cardBackground },
      ]}
      onPress={onPress}
    >
      <Feather name={icon} size={18} color={primary ? "#FFFFFF" : theme.text} />
      <ThemedText
        type="caption"
        style={{ color: primary ? "#FFFFFF" : theme.text, marginTop: 4 }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

interface TabButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function TabButton({ label, active, onPress }: TabButtonProps) {
  const { theme } = useTheme();
  
  return (
    <Pressable
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
    >
      <ThemedText
        type="body"
        style={{ color: active ? Colors.accent : theme.textSecondary, fontWeight: active ? "600" : "400" }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

interface KPICardProps {
  label: string;
  value: string;
  color?: string;
}

function KPICard({ label, value, color }: KPICardProps) {
  const { theme } = useTheme();
  
  return (
    <View style={styles.kpiCard}>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        {label}
      </ThemedText>
      <ThemedText type="h3" style={{ color: color || theme.text }}>
        {value}
      </ThemedText>
    </View>
  );
}

export default function ClientDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, "ClientDetail">>();
  const navigation = useNavigation();
  const { clientId } = route.params;

  const providerProfile = useAuthStore((s) => s.providerProfile);
  const providerId = providerProfile?.id;

  // Fetch clients from API
  const { data: clientsData, isLoading } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/provider", providerId, "clients"],
    enabled: !!providerId,
  });

  const clients = clientsData?.clients || [];

  // Keep Zustand methods for activities, notes, jobs, invoices (these may still use local data)
  const getClientActivities = useProviderStore((s) => s.getClientActivities);
  const getClientNotes = useProviderStore((s) => s.getClientNotes);
  const getClientJobHistory = useProviderStore((s) => s.getClientJobHistory);
  const getClientInvoices = useProviderStore((s) => s.getClientInvoices);

  const client = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId]
  );

  const activities = useMemo(() => getClientActivities(clientId), [getClientActivities, clientId]);
  const notes = useMemo(() => getClientNotes(clientId), [getClientNotes, clientId]);
  const jobs = useMemo(() => getClientJobHistory(clientId), [getClientJobHistory, clientId]);
  const invoices = useMemo(() => getClientInvoices(clientId), [getClientInvoices, clientId]);

  const [activeTab, setActiveTab] = useState<TabType>("overview");

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.notFound, { paddingTop: headerHeight }]}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </ThemedView>
    );
  }

  if (!client) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.notFound, { paddingTop: headerHeight }]}>
          <ThemedText type="h2">Client not found</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const handleCall = () => {
    Linking.openURL(`tel:${client.phone}`);
  };

  const handleMessage = () => {
    Linking.openURL(`sms:${client.phone}`);
  };

  const handleNewJob = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    (navigation as any).navigate("AddJob", { clientId: client.id });
  };

  const handleSendInvoice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    (navigation as any).navigate("AddInvoice", { clientId: client.id });
  };

  const clientStatus = client.status || "active";
  
  const statusColor = useMemo(() => {
    switch (clientStatus) {
      case "active": return Colors.accent;
      case "lead": return "#3B82F6";
      case "inactive": return theme.textSecondary;
      default: return theme.textSecondary;
    }
  }, [clientStatus, theme]);

  const statusLabel = useMemo(() => {
    switch (clientStatus) {
      case "active": return "Active";
      case "lead": return "Lead";
      case "inactive": return "Inactive";
      case "archived": return "Archived";
      default: return clientStatus || "Active";
    }
  }, [clientStatus]);

  const renderOverview = () => (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <View style={styles.kpiRow}>
        <KPICard label="Lifetime Value" value={formatCurrency(client.ltv ?? 0)} color={Colors.accent} />
        <KPICard label="Total Jobs" value={(client.jobCount ?? 0).toString()} />
        <KPICard label="Avg Ticket" value={formatCurrency(client.avgTicket ?? 0)} />
      </View>
      
      {(client.outstandingBalance ?? 0) > 0 ? (
        <GlassCard style={styles.alertCard}>
          <View style={styles.alertRow}>
            <Feather name="alert-circle" size={20} color="#EF4444" />
            <View style={styles.alertContent}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                Outstanding Balance
              </ThemedText>
              <ThemedText type="body" style={{ color: "#EF4444" }}>
                {formatCurrency(client.outstandingBalance ?? 0)}
              </ThemedText>
            </View>
            <Pressable style={[styles.alertButton, { backgroundColor: "#EF4444" }]}>
              <ThemedText type="caption" style={{ color: "#FFFFFF" }}>Send Reminder</ThemedText>
            </Pressable>
          </View>
        </GlassCard>
      ) : null}

      {client.nextAppointment ? (
        <GlassCard style={styles.upcomingCard}>
          <View style={styles.upcomingHeader}>
            <Feather name="calendar" size={18} color={Colors.accent} />
            <ThemedText type="body" style={{ fontWeight: "600", marginLeft: Spacing.sm }}>
              Upcoming Appointment
            </ThemedText>
          </View>
          <ThemedText type="body" style={{ marginTop: Spacing.sm }}>
            {formatDate(client.nextAppointment)}
          </ThemedText>
        </GlassCard>
      ) : null}

      <ThemedText type="label" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        Recent Activity
      </ThemedText>
      {activities.length > 0 ? (
        activities.slice(0, 5).map((activity) => (
          <View key={activity.id} style={styles.activityRow}>
            <View style={[styles.activityDot, { backgroundColor: Colors.accent }]} />
            <View style={styles.activityContent}>
              <ThemedText type="body">{activity.description}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {activity.timestamp}
              </ThemedText>
            </View>
          </View>
        ))
      ) : (
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          No recent activity
        </ThemedText>
      )}
    </Animated.View>
  );

  const renderJobs = () => (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <ThemedText type="label" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        Job History ({jobs.length})
      </ThemedText>
      {jobs.length > 0 ? (
        jobs.map((job) => (
          <Pressable
            key={job.id}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              (navigation as any).navigate("ProviderJobDetail", { jobId: job.id });
            }}
          >
            <GlassCard style={styles.jobCard}>
              <View style={styles.jobHeader}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {job.service}
                </ThemedText>
                <StatusPill
                  status={job.status === "completed" ? "completed" : job.status === "scheduled" ? "scheduled" : "pending"}
                  label={job.status === "completed" ? "Completed" : job.status === "scheduled" ? "Scheduled" : "Pending"}
                />
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                {formatDate(job.date)} at {job.time}
              </ThemedText>
              <View style={styles.jobFooter}>
                <ThemedText type="body" style={{ color: Colors.accent }}>
                  {formatCurrency(job.price)}
                </ThemedText>
                <Feather name="chevron-right" size={16} color={theme.textSecondary} />
              </View>
            </GlassCard>
          </Pressable>
        ))
      ) : (
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          No jobs recorded
        </ThemedText>
      )}
    </Animated.View>
  );

  const renderInvoices = () => (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <ThemedText type="label" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        Invoices ({invoices.length})
      </ThemedText>
      {invoices.length > 0 ? (
        invoices.map((invoice) => (
          <GlassCard key={invoice.id} style={styles.invoiceCard}>
            <View style={styles.invoiceHeader}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {invoice.service}
              </ThemedText>
              <View style={[
                styles.invoiceStatus,
                { backgroundColor: invoice.status === "paid" ? Colors.accent + "20" : "#EF4444" + "20" }
              ]}>
                <ThemedText
                  type="caption"
                  style={{ color: invoice.status === "paid" ? Colors.accent : "#EF4444", fontWeight: "600" }}
                >
                  {invoice.status.toUpperCase()}
                </ThemedText>
              </View>
            </View>
            <View style={styles.invoiceDetails}>
              <ThemedText type="body" style={{ color: Colors.accent }}>
                {formatCurrency(invoice.amount)}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Due: {formatDate(invoice.dueDate)}
              </ThemedText>
            </View>
          </GlassCard>
        ))
      ) : (
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          No invoices recorded
        </ThemedText>
      )}
    </Animated.View>
  );

  const renderNotes = () => (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <View style={styles.notesHeader}>
        <ThemedText type="label" style={{ color: theme.textSecondary }}>
          NOTES ({notes.length})
        </ThemedText>
        <Pressable style={[styles.addNoteButton, { backgroundColor: Colors.accent }]}>
          <Feather name="plus" size={16} color="#FFFFFF" />
          <ThemedText type="caption" style={{ color: "#FFFFFF", marginLeft: 4 }}>Add Note</ThemedText>
        </Pressable>
      </View>
      {notes.length > 0 ? (
        notes.map((note) => (
          <GlassCard key={note.id} style={styles.noteCard}>
            <View style={styles.noteHeader}>
              <View style={[
                styles.noteBadge,
                { backgroundColor: note.isInternal ? theme.textSecondary + "20" : Colors.accent + "20" }
              ]}>
                <Feather
                  name={note.isInternal ? "lock" : "user"}
                  size={12}
                  color={note.isInternal ? theme.textSecondary : Colors.accent}
                />
                <ThemedText
                  type="caption"
                  style={{
                    marginLeft: 4,
                    color: note.isInternal ? theme.textSecondary : Colors.accent,
                  }}
                >
                  {note.isInternal ? "Private" : "Shared"}
                </ThemedText>
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatDate(note.createdAt)}
              </ThemedText>
            </View>
            <ThemedText type="body" style={{ marginTop: Spacing.sm }}>
              {note.content}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              by {note.createdBy}
            </ThemedText>
          </GlassCard>
        ))
      ) : (
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          No notes recorded
        </ThemedText>
      )}
    </Animated.View>
  );

  const renderHome = () => {
    const home = client.home;
    
    if (!home) {
      return (
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassCard style={styles.noHomeCard}>
            <Feather name="home" size={32} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginTop: Spacing.md, textAlign: "center" }}>
              No home information available
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}>
              Home details will appear here when the homeowner shares their HouseFax
            </ThemedText>
          </GlassCard>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        {home.lastUpdatedByHomeowner ? (
          <View style={[styles.sharedBadge, { backgroundColor: Colors.accent + "20" }]}>
            <Feather name="share-2" size={14} color={Colors.accent} />
            <ThemedText type="caption" style={{ color: Colors.accent, marginLeft: 4 }}>
              Shared by homeowner - Updated {formatDate(home.lastUpdatedByHomeowner)}
            </ThemedText>
          </View>
        ) : null}

        <GlassCard style={styles.homePropertyCard}>
          <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            PROPERTY DETAILS
          </ThemedText>
          <View style={styles.propertyGrid}>
            <View style={styles.propertyItem}>
              <ThemedText type="h3">{home.beds}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Beds</ThemedText>
            </View>
            <View style={styles.propertyItem}>
              <ThemedText type="h3">{home.baths}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Baths</ThemedText>
            </View>
            <View style={styles.propertyItem}>
              <ThemedText type="h3">{home.sqft.toLocaleString()}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Sq Ft</ThemedText>
            </View>
            <View style={styles.propertyItem}>
              <ThemedText type="h3">{home.yearBuilt}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Year Built</ThemedText>
            </View>
          </View>
        </GlassCard>

        {home.healthScore !== undefined ? (
          <GlassCard style={styles.healthScoreCard}>
            <View style={styles.healthScoreHeader}>
              <ThemedText type="label" style={{ color: theme.textSecondary }}>
                HOME HEALTH SCORE
              </ThemedText>
              {home.healthScoreDate ? (
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {formatDate(home.healthScoreDate)}
                </ThemedText>
              ) : null}
            </View>
            <View style={styles.healthScoreValue}>
              <ThemedText
                type="h1"
                style={{
                  color: home.healthScore >= 80 ? Colors.accent : home.healthScore >= 60 ? "#F59E0B" : "#EF4444",
                }}
              >
                {home.healthScore}
              </ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>/100</ThemedText>
            </View>
          </GlassCard>
        ) : null}

        {home.survivalKitEstimate ? (
          <GlassCard style={styles.estimateCard}>
            <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              ESTIMATED ANNUAL MAINTENANCE
            </ThemedText>
            <ThemedText type="h2" style={{ color: Colors.accent }}>
              {formatCurrency(home.survivalKitEstimate.min)} - {formatCurrency(home.survivalKitEstimate.max)}
            </ThemedText>
          </GlassCard>
        ) : null}

        {home.notableRisks && home.notableRisks.length > 0 ? (
          <GlassCard style={styles.risksCard}>
            <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              NOTABLE RISKS
            </ThemedText>
            {home.notableRisks.map((risk, index) => (
              <View key={index} style={styles.riskRow}>
                <Feather name="alert-triangle" size={14} color="#F59E0B" />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  {risk}
                </ThemedText>
              </View>
            ))}
          </GlassCard>
        ) : null}

        {(home.accessNotes || home.pets || home.parking || home.gateCode) ? (
          <GlassCard style={styles.accessCard}>
            <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              ACCESS INFORMATION
            </ThemedText>
            <View style={[styles.privateBadge, { backgroundColor: theme.textSecondary + "20" }]}>
              <Feather name="lock" size={12} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                Private to your business
              </ThemedText>
            </View>
            {home.accessNotes ? (
              <View style={styles.accessRow}>
                <Feather name="key" size={16} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>
                  {home.accessNotes}
                </ThemedText>
              </View>
            ) : null}
            {home.pets ? (
              <View style={styles.accessRow}>
                <Feather name="heart" size={16} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>
                  {home.pets}
                </ThemedText>
              </View>
            ) : null}
            {home.parking ? (
              <View style={styles.accessRow}>
                <Feather name="truck" size={16} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>
                  {home.parking}
                </ThemedText>
              </View>
            ) : null}
            {home.gateCode ? (
              <View style={styles.accessRow}>
                <Feather name="lock" size={16} color="#EF4444" />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1, color: "#EF4444" }}>
                  Gate Code: {home.gateCode}
                </ThemedText>
              </View>
            ) : null}
          </GlassCard>
        ) : null}

        {home.preferredWindows && home.preferredWindows.length > 0 ? (
          <GlassCard style={styles.preferencesCard}>
            <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              PREFERRED APPOINTMENT WINDOWS
            </ThemedText>
            <View style={styles.windowsRow}>
              {home.preferredWindows.map((window, index) => (
                <View key={index} style={[styles.windowChip, { backgroundColor: Colors.accent + "20" }]}>
                  <ThemedText type="caption" style={{ color: Colors.accent }}>
                    {window}
                  </ThemedText>
                </View>
              ))}
            </View>
          </GlassCard>
        ) : null}
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: Colors.accent + "20" }]}>
            {client.avatar ? (
              <Animated.Image source={{ uri: client.avatar }} style={styles.avatarImage} />
            ) : (
              <ThemedText type="h1" style={{ color: Colors.accent }}>
                {getInitials(getClientName(client))}
              </ThemedText>
            )}
          </View>
          <View style={styles.nameRow}>
            <ThemedText type="h2" style={styles.clientName}>
              {getClientName(client)}
            </ThemedText>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
              <ThemedText style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </ThemedText>
            </View>
          </View>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {client.clientSince
              ? `Client since ${client.clientSince}`
              : "Potential client"}
          </ThemedText>

          <View style={styles.actionButtons}>
            <ActionButton icon="briefcase" label="New Job" onPress={handleNewJob} primary />
            <ActionButton icon="file-text" label="Invoice" onPress={handleSendInvoice} />
            <ActionButton icon="message-circle" label="Message" onPress={handleMessage} />
            <ActionButton icon="phone" label="Call" onPress={handleCall} />
          </View>
        </Animated.View>

        <GlassCard style={styles.contactCard}>
          <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            CONTACT
          </ThemedText>
          <View style={styles.contactRow}>
            <Feather name="phone" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              {client.phone || "No phone"}
            </ThemedText>
            {client.phone ? (
              <Pressable onPress={handleCall} style={styles.contactAction}>
                <Feather name="external-link" size={16} color={Colors.accent} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.contactRow}>
            <Feather name="mail" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              {client.email || "No email"}
            </ThemedText>
          </View>
          {client.address ? (
            <View style={styles.contactRow}>
              <Feather name="map-pin" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>
                {client.address}
              </ThemedText>
              <Pressable
                onPress={() => Linking.openURL(`maps://?address=${encodeURIComponent(client.address || "")}`)}
                style={styles.contactAction}
              >
                <Feather name="navigation" size={16} color={Colors.accent} />
              </Pressable>
            </View>
          ) : null}
        </GlassCard>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBarScroll}
          contentContainerStyle={styles.tabBarContent}
        >
          <TabButton
            label="Overview"
            active={activeTab === "overview"}
            onPress={() => setActiveTab("overview")}
          />
          <TabButton
            label="Jobs"
            active={activeTab === "jobs"}
            onPress={() => setActiveTab("jobs")}
          />
          <TabButton
            label="Invoices"
            active={activeTab === "invoices"}
            onPress={() => setActiveTab("invoices")}
          />
          <TabButton
            label="Notes"
            active={activeTab === "notes"}
            onPress={() => setActiveTab("notes")}
          />
          <TabButton
            label="Home"
            active={activeTab === "home"}
            onPress={() => setActiveTab("home")}
          />
        </ScrollView>

        <View style={styles.tabContent}>
          {activeTab === "overview" && renderOverview()}
          {activeTab === "jobs" && renderJobs()}
          {activeTab === "invoices" && renderInvoices()}
          {activeTab === "notes" && renderNotes()}
          {activeTab === "home" && renderHome()}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  clientName: {
    marginBottom: 0,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    ...Typography.caption2,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    minWidth: 64,
  },
  contactCard: {
    marginBottom: Spacing.md,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  contactAction: {
    marginLeft: "auto",
    padding: Spacing.xs,
  },
  tabBarScroll: {
    marginBottom: Spacing.md,
  },
  tabBarContent: {
    gap: Spacing.md,
  },
  tabButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
  },
  tabContent: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  kpiCard: {
    flex: 1,
    alignItems: "center",
  },
  alertCard: {
    marginBottom: Spacing.md,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  alertContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  alertButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  upcomingCard: {
    marginBottom: Spacing.md,
  },
  upcomingHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  activityContent: {
    flex: 1,
  },
  jobCard: {
    marginBottom: Spacing.sm,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  jobFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  invoiceCard: {
    marginBottom: Spacing.sm,
  },
  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  invoiceStatus: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  invoiceDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  notesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  addNoteButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  noteCard: {
    marginBottom: Spacing.sm,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  noteBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  noHomeCard: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  homePropertyCard: {
    marginBottom: Spacing.md,
  },
  propertyGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  propertyItem: {
    alignItems: "center",
  },
  healthScoreCard: {
    marginBottom: Spacing.md,
  },
  healthScoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  healthScoreValue: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  estimateCard: {
    marginBottom: Spacing.md,
  },
  risksCard: {
    marginBottom: Spacing.md,
  },
  riskRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  accessCard: {
    marginBottom: Spacing.md,
  },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
    marginBottom: Spacing.sm,
  },
  accessRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: Spacing.sm,
  },
  preferencesCard: {
    marginBottom: Spacing.md,
  },
  windowsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  windowChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
});
