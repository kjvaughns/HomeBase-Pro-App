import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ListRow } from "@/components/ListRow";
import { StatusPill } from "@/components/StatusPill";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";

type TabKey = "payments" | "bank" | "tax";

export default function AccountingScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<TabKey>("payments");
  const [isSaving, setIsSaving] = useState(false);

  const [bankName, setBankName] = useState("Chase Bank");
  const [accountType, setAccountType] = useState("Checking");
  const [routingNumber, setRoutingNumber] = useState("021000021");
  const [accountNumber, setAccountNumber] = useState("****4567");

  const [businessType, setBusinessType] = useState("LLC");
  const [einNumber, setEinNumber] = useState("**-***4321");
  const [businessName, setBusinessName] = useState("Clean & Co. LLC");
  const [businessAddress, setBusinessAddress] = useState("123 Market St, San Francisco, CA 94102");
  const [taxYear, setTaxYear] = useState("2024");

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  const renderPaymentsTab = () => (
    <Animated.View entering={FadeInDown.delay(50).duration(300)}>
      <GlassCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Feather name="dollar-sign" size={18} color={Colors.accent} />
            <ThemedText style={styles.sectionTitle}>Stripe Connect</ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.sectionDescription, { color: theme.textSecondary }]}>
          Connect your Stripe account to receive payments directly from clients. Manage invoices, track payouts, and more.
        </ThemedText>

        <View style={[styles.menuSection, { backgroundColor: theme.cardBackground }]}>
          <ListRow
            title="Stripe Connect Setup"
            subtitle="Onboarding, payouts, and account status"
            leftIcon="credit-card"
            onPress={() => navigation.navigate("StripeConnect")}
            isFirst
          />
          <ListRow
            title="Create Invoice"
            subtitle="Bill clients with itemized invoices"
            leftIcon="file-plus"
            onPress={() => navigation.navigate("StripeConnect")}
          />
          <ListRow
            title="Invoice History"
            subtitle="View and manage all invoices"
            leftIcon="list"
            onPress={() => navigation.navigate("StripeConnect")}
            isLast
          />
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderBankTab = () => (
    <Animated.View entering={FadeInDown.delay(50).duration(300)}>
      <GlassCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Feather name="credit-card" size={18} color={Colors.accent} />
            <ThemedText style={styles.sectionTitle}>Bank Account</ThemedText>
          </View>
          <StatusPill status="success" label="Verified" size="small" />
        </View>

        <View style={styles.bankPreview}>
          <View style={[styles.bankCard, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.bankCardHeader}>
              <Feather name="credit-card" size={24} color={Colors.accent} />
              <ThemedText style={[styles.bankCardType, { color: theme.textSecondary }]}>
                {accountType}
              </ThemedText>
            </View>
            <ThemedText style={styles.bankCardNumber}>
              **** **** **** 4567
            </ThemedText>
            <ThemedText style={[styles.bankCardName, { color: theme.textSecondary }]}>
              {bankName}
            </ThemedText>
          </View>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Bank Name
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
            value={bankName}
            onChangeText={setBankName}
            placeholder="Enter bank name"
            placeholderTextColor={theme.textTertiary}
          />
        </View>

        <View style={styles.formRow}>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              Account Type
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
              value={accountType}
              onChangeText={setAccountType}
              placeholder="Checking/Savings"
              placeholderTextColor={theme.textTertiary}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Routing Number
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
            value={routingNumber}
            onChangeText={setRoutingNumber}
            placeholder="9 digit routing number"
            placeholderTextColor={theme.textTertiary}
            keyboardType="number-pad"
            maxLength={9}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Account Number
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="Account number"
            placeholderTextColor={theme.textTertiary}
            secureTextEntry
          />
        </View>

        <View style={[styles.infoBox, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="shield" size={16} color={Colors.accent} />
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            Your banking information is encrypted and securely stored. We use industry-standard security protocols.
          </ThemedText>
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderTaxTab = () => (
    <Animated.View entering={FadeInDown.delay(50).duration(300)}>
      <GlassCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Feather name="file-text" size={18} color={Colors.accent} />
            <ThemedText style={styles.sectionTitle}>Tax Information</ThemedText>
          </View>
          <StatusPill status="success" label="W-9 on File" size="small" />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Business Type
          </ThemedText>
          <View style={styles.typeButtons}>
            {["Sole Prop", "LLC", "S-Corp", "C-Corp"].map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.typeButton,
                  { borderColor: theme.borderLight },
                  businessType === type && { backgroundColor: Colors.accent, borderColor: Colors.accent },
                ]}
                onPress={() => setBusinessType(type)}
              >
                <ThemedText
                  style={[
                    styles.typeButtonText,
                    businessType === type && { color: "#FFFFFF" },
                  ]}
                >
                  {type}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            EIN / Tax ID
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
            value={einNumber}
            onChangeText={setEinNumber}
            placeholder="XX-XXXXXXX"
            placeholderTextColor={theme.textTertiary}
            secureTextEntry
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Legal Business Name
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="As registered with IRS"
            placeholderTextColor={theme.textTertiary}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Business Address
          </ThemedText>
          <TextInput
            style={[styles.textArea, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
            value={businessAddress}
            onChangeText={setBusinessAddress}
            placeholder="Legal business address"
            placeholderTextColor={theme.textTertiary}
            multiline
            numberOfLines={2}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.taxDocuments}>
          <ThemedText style={styles.subsectionTitle}>Tax Documents</ThemedText>
          
          <Pressable style={[styles.documentRow, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.documentIcon}>
              <Feather name="file" size={20} color={Colors.accent} />
            </View>
            <View style={styles.documentInfo}>
              <ThemedText style={styles.documentName}>1099-NEC (2024)</ThemedText>
              <ThemedText style={[styles.documentMeta, { color: theme.textSecondary }]}>
                Available January 2025
              </ThemedText>
            </View>
            <Feather name="download" size={18} color={theme.textTertiary} />
          </Pressable>

          <Pressable style={[styles.documentRow, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.documentIcon}>
              <Feather name="file" size={20} color={Colors.accent} />
            </View>
            <View style={styles.documentInfo}>
              <ThemedText style={styles.documentName}>1099-NEC (2023)</ThemedText>
              <ThemedText style={[styles.documentMeta, { color: theme.textSecondary }]}>
                Downloaded Dec 15, 2023
              </ThemedText>
            </View>
            <Feather name="download" size={18} color={theme.textTertiary} />
          </Pressable>

          <Pressable style={[styles.documentRow, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.documentIcon}>
              <Feather name="file-text" size={20} color={Colors.accent} />
            </View>
            <View style={styles.documentInfo}>
              <ThemedText style={styles.documentName}>W-9 Form</ThemedText>
              <ThemedText style={[styles.documentMeta, { color: theme.textSecondary }]}>
                Submitted Mar 12, 2023
              </ThemedText>
            </View>
            <Feather name="edit-2" size={18} color={theme.textTertiary} />
          </Pressable>
        </View>
      </GlassCard>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(0).duration(300)}>
          <View style={styles.tabs}>
            <Pressable
              style={[
                styles.tab,
                activeTab === "payments" && { backgroundColor: Colors.accent },
              ]}
              onPress={() => setActiveTab("payments")}
            >
              <Feather
                name="dollar-sign"
                size={16}
                color={activeTab === "payments" ? "#FFFFFF" : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.tabText,
                  activeTab === "payments" && { color: "#FFFFFF" },
                ]}
              >
                Payments
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.tab,
                activeTab === "bank" && { backgroundColor: Colors.accent },
              ]}
              onPress={() => setActiveTab("bank")}
            >
              <Feather
                name="credit-card"
                size={16}
                color={activeTab === "bank" ? "#FFFFFF" : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.tabText,
                  activeTab === "bank" && { color: "#FFFFFF" },
                ]}
              >
                Bank
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.tab,
                activeTab === "tax" && { backgroundColor: Colors.accent },
              ]}
              onPress={() => setActiveTab("tax")}
            >
              <Feather
                name="file-text"
                size={16}
                color={activeTab === "tax" ? "#FFFFFF" : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.tabText,
                  activeTab === "tax" && { color: "#FFFFFF" },
                ]}
              >
                Tax
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        {activeTab === "payments" ? renderPaymentsTab() : activeTab === "bank" ? renderBankTab() : renderTaxTab()}

        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <PrimaryButton onPress={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </PrimaryButton>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(128,128,128,0.1)",
  },
  tabText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  section: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.headline,
    fontWeight: "600",
  },
  sectionDescription: {
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  menuSection: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  bankPreview: {
    marginBottom: Spacing.lg,
  },
  bankCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  bankCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  bankCardType: {
    ...Typography.caption1,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  bankCardNumber: {
    ...Typography.title2,
    letterSpacing: 2,
    marginBottom: Spacing.xs,
  },
  bankCardName: {
    ...Typography.subhead,
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  formRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  label: {
    ...Typography.caption1,
    marginBottom: Spacing.xs,
    fontWeight: "500",
  },
  input: {
    ...Typography.body,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  textArea: {
    ...Typography.body,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    minHeight: 60,
    textAlignVertical: "top",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  infoText: {
    ...Typography.caption1,
    flex: 1,
  },
  typeButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
  },
  typeButtonText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(128,128,128,0.2)",
    marginVertical: Spacing.lg,
  },
  subsectionTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  taxDocuments: {
    gap: Spacing.sm,
  },
  documentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accent + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    ...Typography.body,
    fontWeight: "500",
  },
  documentMeta: {
    ...Typography.caption1,
    marginTop: 2,
  },
});
