import React, { useEffect } from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { usePushNotifications } from "@/hooks/usePushNotifications";

import HomeownerTabNavigator, { type HomeownerTabParamList } from "@/navigation/HomeownerTabNavigator";
import ProviderTabNavigator, { type ProviderTabParamList } from "@/navigation/ProviderTabNavigator";
import CrewTabNavigator, { type CrewTabParamList } from "@/navigation/CrewTabNavigator";
import CrewJobDetailScreen from "@/screens/crew/CrewJobDetailScreen";
import BecomeProviderScreen from "@/screens/BecomeProviderScreen";
import FirstLaunchScreen from "@/screens/onboarding/FirstLaunchScreen";
import AccountTypeSelectionScreen from "@/screens/onboarding/AccountTypeSelectionScreen";
import HomeownerOnboardingScreen from "@/screens/onboarding/HomeownerOnboardingScreen";
import ProviderOnboardingScreen from "@/screens/onboarding/ProviderOnboardingScreen";
import EssentialSetupScreen from "@/screens/onboarding/EssentialSetupScreen";
import ProviderSetupFlow from "@/screens/onboarding/ProviderSetupFlow";
import WelcomeScreen from "@/screens/auth/WelcomeScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import SignUpScreen from "@/screens/auth/SignUpScreen";
import ForgotPasswordScreen from "@/screens/auth/ForgotPasswordScreen";
import CrewInviteAcceptScreen from "@/screens/auth/CrewInviteAcceptScreen";
import OnboardingScreen from "@/screens/auth/OnboardingScreen";
import AIChatScreen from "@/screens/homeowner/AIChatScreen";
import SmartIntakeScreen from "@/screens/homeowner/SmartIntakeScreen";
import SimpleBookingScreen from "@/screens/homeowner/SimpleBookingScreen";
import SurvivalKitScreen from "@/screens/homeowner/SurvivalKitScreen";
import HealthScoreScreen from "@/screens/homeowner/HealthScoreScreen";
import HouseFaxScreen from "@/screens/homeowner/HouseFaxScreen";
import BudgeterScreen from "@/screens/homeowner/BudgeterScreen";
import ServiceHistoryScreen from "@/screens/homeowner/ServiceHistoryScreen";
import ProviderListScreen from "@/screens/homeowner/ProviderListScreen";
import ProviderProfileScreen from "@/screens/homeowner/ProviderProfileScreen";
import BookingSuccessScreen from "@/screens/homeowner/BookingSuccessScreen";
import JobDetailScreen from "@/screens/homeowner/JobDetailScreen";
import AppointmentDetailScreen from "@/screens/homeowner/AppointmentDetailScreen";
import PaymentScreen from "@/screens/homeowner/PaymentScreen";
import ReviewScreen from "@/screens/homeowner/ReviewScreen";
import ProfileEditScreen from "@/screens/homeowner/ProfileEditScreen";
import AccountSecurityScreen from "@/screens/auth/AccountSecurityScreen";
import AddressesScreen from "@/screens/homeowner/AddressesScreen";
import NotificationsScreen from "@/screens/homeowner/NotificationsScreen";
import NotificationPreferencesScreen from "@/screens/homeowner/NotificationPreferencesScreen";
import ClientDetailScreen from "@/screens/provider/ClientDetailScreen";
import AddClientScreen from "@/screens/provider/AddClientScreen";
import AddJobScreen from "@/screens/provider/AddJobScreen";
import AddInvoiceScreen from "@/screens/provider/AddInvoiceScreen";
import InvoiceDetailScreen from "@/screens/provider/InvoiceDetailScreen";
import ManualPaymentsListScreen from "@/screens/provider/ManualPaymentsListScreen";
import EstimatesListScreen from "@/screens/provider/EstimatesListScreen";
import AddEstimateScreen from "@/screens/provider/AddEstimateScreen";
import QuickQuoteScreen from "@/screens/provider/QuickQuoteScreen";
import EstimateDetailScreen from "@/screens/provider/EstimateDetailScreen";
import ServicesScreen from "@/screens/provider/ServicesScreen";
import ServiceBlueprintWizardScreen from "@/screens/provider/ServiceBlueprintWizardScreen";
import ServiceSummaryScreen from "@/screens/provider/ServiceSummaryScreen";
import PublicProfileScreen from "@/screens/provider/PublicProfileScreen";
import ProviderJobDetailScreen from "@/screens/provider/ProviderJobDetailScreen";
import SeriesDetailScreen from "@/screens/provider/SeriesDetailScreen";
import LeadsScreen from "@/screens/provider/LeadsScreen";
import ReviewsScreen from "@/screens/provider/ReviewsScreen";
import ProviderResourcesScreen from "@/screens/provider/ProviderResourcesScreen";
import ProviderAIAssistantScreen from "@/screens/provider/ProviderAIAssistantScreen";
import StripeConnectScreen from "@/screens/provider/StripeConnectScreen";
import SubscriptionScreen from "@/screens/provider/SubscriptionScreen";
import AdminPartnersScreen from "@/screens/provider/AdminPartnersScreen";
import ReferAProScreen from "@/screens/provider/ReferAProScreen";
import AchievementsScreen from "@/screens/provider/AchievementsScreen";
import BusinessHubScreen from "@/screens/provider/BusinessHubScreen";
import CrewScreen from "@/screens/provider/CrewScreen";
import BookingLinkScreen from "@/screens/provider/BookingLinkScreen";
import SendMessageScreen from "@/screens/provider/SendMessageScreen";
import CommunicationsScreen from "@/screens/provider/CommunicationsScreen";
import SavedProvidersScreen from "@/screens/homeowner/SavedProvidersScreen";
import ReferralsScreen from "@/screens/homeowner/ReferralsScreen";
import HelpCenterScreen from "@/screens/homeowner/HelpCenterScreen";
import ContactUsScreen from "@/screens/homeowner/ContactUsScreen";
import MyTicketsScreen from "@/screens/homeowner/MyTicketsScreen";
import TicketDetailScreen from "@/screens/homeowner/TicketDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore, UserRole } from "@/state/authStore";
import { useOnboardingStore } from "@/state/onboardingStore";
import { UrgencyLevel, JobSize } from "@/state/types";

export type RootStackParamList = {
  FirstLaunch: undefined;
  AccountTypeSelection: undefined;
  HomeownerOnboarding: undefined;
  ProviderOnboarding: undefined;
  EssentialSetup: undefined;
  ProviderSetupFlow: undefined;
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  CrewInviteAccept: { token?: string } | undefined;
  Onboarding: undefined;
  Main:
    | NavigatorScreenParams<HomeownerTabParamList>
    | NavigatorScreenParams<ProviderTabParamList>
    | NavigatorScreenParams<CrewTabParamList>
    | undefined;
  BecomeProvider: undefined;
  AIChat: undefined;
  SmartIntake: { 
    prefillCategory?: string; 
    prefillProblem?: string;
    preselectedProviderId?: string;
    preselectedProviderName?: string;
  } | undefined;
  SurvivalKit: undefined;
  HealthScore: undefined;
  HouseFax: undefined;
  Budgeter: undefined;
  ServiceHistory: undefined;
  ProviderList: { categoryId: string; categoryName: string };
  ProviderProfile: { 
    providerId: string;
    provider?: import("@/state/types").Provider;
    intakeData?: {
      problemDescription: string;
      issueSummary: string;
      recommendedService: string;
      priceRange: { min: number; max: number };
      urgency: UrgencyLevel;
      category: string;
    };
  };
  SimpleBooking: {
    providerId: string;
    providerName: string;
    intakeData?: {
      problemDescription: string;
      issueSummary: string;
      recommendedService: string;
      priceRange: { min: number; max: number };
      urgency: UrgencyLevel;
      category: string;
    };
  };
  BookingSuccess: {
    jobId: string;
    awaitingDeposit?: boolean;
    depositCheckoutUrl?: string;
  };
  JobDetail: { jobId: string };
  AppointmentDetail: { appointmentId: string };
  Payment: { jobId?: string; invoiceId: string; status?: "paid" | "cancelled" };
  Review: { jobId: string };
  ProfileEdit: undefined;
  AccountSecurity: undefined;
  Addresses: undefined;
  Notifications: undefined;
  NotificationPreferences: undefined;
  ClientDetail: { clientId: string };
  AddClient: undefined;
  AddJob: { clientId?: string } | undefined;
  AddInvoice: { clientId?: string } | undefined;
  InvoiceDetail: { invoiceId: string };
  ManualPaymentsList: undefined;
  EstimatesList: undefined;
  AddEstimate:
    | {
        clientId?: string;
        prefillItems?: { description: string; qty: string; unitPrice: string }[];
        prefillNotes?: string;
      }
    | undefined;
  QuickQuote: undefined;
  EstimateDetail: { estimateId: string };
  Services: undefined;
  NewService: { onboardingMode?: boolean } | undefined;
  ServiceSummary: { serviceId: string; service: Record<string, unknown> };
  EditService: { serviceId: string; service?: Record<string, unknown>; initialStep?: number };
  BusinessProfile: undefined;
  PreviewBookingPage: { providerId?: string };
  SavedProviders: undefined;
  Referrals: undefined;
  HelpCenter: undefined;
  ContactUs: undefined;
  MyTickets: undefined;
  TicketDetail: { ticketId: string };
  ProviderJobDetail: { jobId: string };
  SeriesDetail: { seriesId: string };
  Leads: undefined;
  Reviews: undefined;
  ProviderResources: undefined;
  ProviderAIAssistant: undefined;
  StripeConnect: undefined;
  BusinessHub: undefined;
  BookingLink: undefined;
  SendMessage: {
    clientId: string;
    clientName: string;
    clientEmail?: string | null;
    jobId?: string;
    invoiceId?: string;
    clientIds?: string[];
    isBlast?: boolean;
  };
  Communications: undefined;
  Subscription: undefined;
  AdminPartners: undefined;
  ReferAPro: undefined;
  Achievements: undefined;
  Crew: undefined;
  CrewJobDetail: { jobId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const { isAuthenticated, isHydrated, activeRole, preferredRole, canAccessProviderMode, needsRoleSelection, setActiveRole, setNeedsRoleSelection, activateProviderMode, syncFromServer, activeCrewProviderId } = useAuthStore();
  const { hasCompletedFirstLaunch, hasCompletedProviderSetup, isHydrated: onboardingHydrated } = useOnboardingStore();

  usePushNotifications();

  // Task #220: rehydrate user.isAdmin and providerProfile.isPartner from
  // /api/auth/me whenever an authenticated session is available. This
  // catches admin grants/revocations made via SQL or by another admin while
  // the user was offline, so persisted Zustand state never goes stale.
  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      void syncFromServer();
    }
  }, [isHydrated, isAuthenticated]);

  // Auto-resolve role selection edge cases (e.g., very old cached state).
  // login() now sets the correct role directly, so this is mostly a safety net.
  // Task #291: when a preferredRole is persisted, honour it so providers who
  // signed up as providers never see a role-selection interstitial on launch.
  useEffect(() => {
    if (isAuthenticated && needsRoleSelection) {
      if (preferredRole === "provider" && canAccessProviderMode()) {
        setActiveRole("provider");
      } else if (preferredRole === "provider" && hasCompletedProviderSetup) {
        activateProviderMode();
      } else if (preferredRole === "homeowner") {
        setActiveRole("homeowner");
      } else if (canAccessProviderMode()) {
        // Existing approved provider — setActiveRole is fine (guard will pass).
        setActiveRole("provider");
      } else if (hasCompletedProviderSetup) {
        // New provider who completed onboarding but has no backend-approved profile
        // yet. setActiveRole("provider") would be blocked by the canAccessProviderMode
        // guard, so use activateProviderMode() which bypasses the guard.
        activateProviderMode();
      } else {
        setActiveRole("homeowner");
      }
      setNeedsRoleSelection(false);
    }
  }, [isAuthenticated, needsRoleSelection, preferredRole]);

  // canAccessProviderMode checks for an approved provider profile (existing providers).
  // hasCompletedProviderSetup covers new providers who finished ProviderOnboarding
  // but don't yet have a persisted/approved profile in the backend.
  const isProviderMode = isAuthenticated && activeRole === "provider" &&
    (canAccessProviderMode() || hasCompletedProviderSetup);

  const getMainComponent = () => {
    // Task #328: an active crew session takes precedence over the user's
    // homeowner/provider role. Switching back is handled by setActiveCrewProvider(null).
    if (isAuthenticated && activeCrewProviderId) {
      return CrewTabNavigator;
    }
    if (isProviderMode) {
      return ProviderTabNavigator;
    }
    return HomeownerTabNavigator;
  };

  if (!isHydrated || !onboardingHydrated) {
    return null;
  }

  // Show first launch for new users who haven't completed onboarding
  const showFirstLaunch = !hasCompletedFirstLaunch && !isAuthenticated;

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {showFirstLaunch ? (
        <Stack.Screen
          name="FirstLaunch"
          component={FirstLaunchScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <Stack.Screen
          name="Main"
          component={getMainComponent()}
          options={{ headerShown: false }}
        />
      )}
      {!isAuthenticated ? (
        <>
          <Stack.Screen
            name="AccountTypeSelection"
            component={AccountTypeSelectionScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="HomeownerOnboarding"
            component={HomeownerOnboardingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ProviderOnboarding"
            component={ProviderOnboardingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="EssentialSetup"
            component={EssentialSetupScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerTitle: "Sign In" }}
          />
          <Stack.Screen
            name="SignUp"
            component={SignUpScreen}
            options={{ headerTitle: "Create Account" }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ headerTitle: "Reset Password" }}
          />
          <Stack.Screen
            name="CrewInviteAccept"
            component={CrewInviteAcceptScreen}
            options={{ headerTitle: "Accept Crew Invite" }}
          />
        </>
      ) : null}
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BecomeProvider"
        component={BecomeProviderScreen}
        options={{
          headerTitle: "Become a Provider",
        }}
      />
      <Stack.Screen
        name="AIChat"
        component={AIChatScreen}
        options={{
          headerTitle: "Ask HomeBase AI",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="SmartIntake"
        component={SmartIntakeScreen}
        options={{
          headerTitle: "Get Help",
        }}
      />
      <Stack.Screen
        name="SimpleBooking"
        component={SimpleBookingScreen}
        options={{
          headerTitle: "Book Appointment",
        }}
      />
      <Stack.Screen
        name="SurvivalKit"
        component={SurvivalKitScreen}
        options={{
          headerTitle: "Survival Kit",
        }}
      />
      <Stack.Screen
        name="HealthScore"
        component={HealthScoreScreen}
        options={{
          headerTitle: "Home Health Score",
        }}
      />
      <Stack.Screen
        name="HouseFax"
        component={HouseFaxScreen}
        options={{
          headerTitle: "HouseFax",
        }}
      />
      <Stack.Screen
        name="Budgeter"
        component={BudgeterScreen}
        options={{
          headerTitle: "Home Budgeter",
        }}
      />
      <Stack.Screen
        name="ServiceHistory"
        component={ServiceHistoryScreen}
        options={{
          headerTitle: "Service History",
        }}
      />
      <Stack.Screen
        name="ProviderList"
        component={ProviderListScreen}
        options={({ route }) => ({
          headerTitle: route.params.categoryName,
        })}
      />
      <Stack.Screen
        name="ProviderProfile"
        component={ProviderProfileScreen}
        options={{
          headerTitle: "",
        }}
      />
      <Stack.Screen
        name="BookingSuccess"
        component={BookingSuccessScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="JobDetail"
        component={JobDetailScreen}
        options={{
          headerTitle: "Job Details",
        }}
      />
      <Stack.Screen
        name="AppointmentDetail"
        component={AppointmentDetailScreen}
        options={{
          headerTitle: "Appointment Details",
        }}
      />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{
          headerTitle: "Pay Invoice",
        }}
      />
      <Stack.Screen
        name="Review"
        component={ReviewScreen}
        options={{
          headerTitle: "Leave a Review",
        }}
      />
      <Stack.Screen
        name="ProfileEdit"
        component={ProfileEditScreen}
        options={{
          headerTitle: "Edit Profile",
        }}
      />
      <Stack.Screen
        name="AccountSecurity"
        component={AccountSecurityScreen}
        options={{
          headerTitle: "Account & Security",
        }}
      />
      <Stack.Screen
        name="Addresses"
        component={AddressesScreen}
        options={{
          headerTitle: "My Addresses",
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerTitle: "Notifications",
        }}
      />
      <Stack.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
        options={{
          headerTitle: "Notification Preferences",
        }}
      />
      <Stack.Screen
        name="ClientDetail"
        component={ClientDetailScreen}
        options={{
          headerTitle: "",
        }}
      />
      <Stack.Screen
        name="AddClient"
        component={AddClientScreen}
        options={{
          headerTitle: "Add Client",
        }}
      />
      <Stack.Screen
        name="AddJob"
        component={AddJobScreen}
        options={{
          headerTitle: "Add Job",
        }}
      />
      <Stack.Screen
        name="AddInvoice"
        component={AddInvoiceScreen}
        options={{
          headerTitle: "New Invoice",
        }}
      />
      <Stack.Screen
        name="InvoiceDetail"
        component={InvoiceDetailScreen}
        options={{
          headerTitle: "Invoice",
        }}
      />
      <Stack.Screen
        name="ManualPaymentsList"
        component={ManualPaymentsListScreen}
        options={{ headerTitle: "Manual Payments" }}
      />
      <Stack.Screen
        name="EstimatesList"
        component={EstimatesListScreen}
        options={{ headerTitle: "Estimates" }}
      />
      <Stack.Screen
        name="AddEstimate"
        component={AddEstimateScreen}
        options={{ headerTitle: "New Estimate" }}
      />
      <Stack.Screen
        name="QuickQuote"
        component={QuickQuoteScreen}
        options={{ headerTitle: "Quick Quote" }}
      />
      <Stack.Screen
        name="EstimateDetail"
        component={EstimateDetailScreen}
        options={{ headerTitle: "Estimate" }}
      />
      <Stack.Screen
        name="Services"
        component={ServicesScreen}
        options={{
          headerTitle: "My Services",
        }}
      />
      <Stack.Screen
        name="ServiceSummary"
        component={ServiceSummaryScreen}
        options={{
          headerTitle: "Service Overview",
        }}
      />
      <Stack.Screen
        name="NewService"
        component={ServiceBlueprintWizardScreen}
        options={{
          headerTitle: "Add Service",
        }}
      />
      <Stack.Screen
        name="EditService"
        component={ServiceBlueprintWizardScreen}
        options={{
          headerTitle: "Edit Service",
        }}
      />
      <Stack.Screen
        name="BusinessProfile"
        component={PublicProfileScreen}
        options={{
          headerTitle: "Public Profile",
        }}
      />
      <Stack.Screen
        name="SavedProviders"
        component={SavedProvidersScreen}
        options={{
          headerTitle: "Saved Providers",
        }}
      />
      <Stack.Screen
        name="HelpCenter"
        component={HelpCenterScreen}
        options={{
          presentation: "modal",
          headerTitle: "Help Center",
        }}
      />
      <Stack.Screen
        name="ContactUs"
        component={ContactUsScreen}
        options={{
          headerTitle: "Contact Us",
        }}
      />
      <Stack.Screen
        name="MyTickets"
        component={MyTicketsScreen}
        options={{
          headerTitle: "My Tickets",
        }}
      />
      <Stack.Screen
        name="TicketDetail"
        component={TicketDetailScreen}
        options={{
          headerTitle: "Ticket",
        }}
      />
      <Stack.Screen
        name="ProviderJobDetail"
        component={ProviderJobDetailScreen}
        options={{
          headerTitle: "Job Details",
        }}
      />
      <Stack.Screen
        name="SeriesDetail"
        component={SeriesDetailScreen}
        options={{
          headerTitle: "Recurring Series",
        }}
      />
      <Stack.Screen
        name="Leads"
        component={LeadsScreen}
        options={{
          headerTitle: "Leads",
        }}
      />
      <Stack.Screen
        name="Reviews"
        component={ReviewsScreen}
        options={{
          headerTitle: "Reviews",
        }}
      />
      <Stack.Screen
        name="ProviderResources"
        component={ProviderResourcesScreen}
        options={{
          headerTitle: "Resources",
        }}
      />
      <Stack.Screen
        name="ProviderAIAssistant"
        component={ProviderAIAssistantScreen}
        options={{
          headerTitle: "Business Assistant",
        }}
      />
      <Stack.Screen
        name="StripeConnect"
        component={StripeConnectScreen}
        options={{
          headerTitle: "Stripe Payments",
        }}
      />
      <Stack.Screen
        name="BusinessHub"
        component={BusinessHubScreen}
        options={{
          headerTitle: "Business Hub",
        }}
      />
      <Stack.Screen
        name="BookingLink"
        component={BookingLinkScreen}
        options={{
          headerTitle: "Booking Link",
        }}
      />
      <Stack.Screen
        name="SendMessage"
        component={SendMessageScreen}
        options={{
          headerTitle: "Send Message",
        }}
      />
      <Stack.Screen
        name="Communications"
        component={CommunicationsScreen}
        options={{
          headerTitle: "Communications",
        }}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          headerTitle: "Subscription & Plan",
        }}
      />
      <Stack.Screen
        name="AdminPartners"
        component={AdminPartnersScreen}
        options={{
          headerTitle: "HomeBase Partners",
        }}
      />
      <Stack.Screen
        name="ReferAPro"
        component={ReferAProScreen}
        options={{
          headerTitle: "Refer a Pro",
        }}
      />
      <Stack.Screen
        name="Achievements"
        component={AchievementsScreen}
        options={{
          headerTitle: "Achievements",
        }}
      />
      <Stack.Screen
        name="Crew"
        component={CrewScreen}
        options={{
          headerTitle: "Crew",
        }}
      />
      <Stack.Screen
        name="CrewJobDetail"
        component={CrewJobDetailScreen}
        options={{
          headerTitle: "Job",
        }}
      />
      <Stack.Screen
        name="Referrals"
        component={ReferralsScreen}
        options={{
          headerTitle: "Referrals",
        }}
      />
    </Stack.Navigator>
  );
}
