import React, { useEffect } from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { usePushNotifications } from "@/hooks/usePushNotifications";

import HomeownerTabNavigator from "@/navigation/HomeownerTabNavigator";
import ProviderTabNavigator from "@/navigation/ProviderTabNavigator";
import RoleSwitchConfirmationScreen from "@/screens/RoleSwitchConfirmationScreen";
import BecomeProviderScreen from "@/screens/BecomeProviderScreen";
import FirstLaunchScreen from "@/screens/onboarding/FirstLaunchScreen";
import AccountTypeSelectionScreen from "@/screens/onboarding/AccountTypeSelectionScreen";
import HomeownerOnboardingScreen from "@/screens/onboarding/HomeownerOnboardingScreen";
import ProviderOnboardingScreen from "@/screens/onboarding/ProviderOnboardingScreen";
import ProviderSetupFlow from "@/screens/onboarding/ProviderSetupFlow";
import WelcomeScreen from "@/screens/auth/WelcomeScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import SignUpScreen from "@/screens/auth/SignUpScreen";
import ForgotPasswordScreen from "@/screens/auth/ForgotPasswordScreen";
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
import AddressesScreen from "@/screens/homeowner/AddressesScreen";
import PaymentMethodsScreen from "@/screens/homeowner/PaymentMethodsScreen";
import NotificationsScreen from "@/screens/homeowner/NotificationsScreen";
import NotificationPreferencesScreen from "@/screens/homeowner/NotificationPreferencesScreen";
import ClientDetailScreen from "@/screens/provider/ClientDetailScreen";
import AddClientScreen from "@/screens/provider/AddClientScreen";
import AddJobScreen from "@/screens/provider/AddJobScreen";
import AddInvoiceScreen from "@/screens/provider/AddInvoiceScreen";
import InvoiceDetailScreen from "@/screens/provider/InvoiceDetailScreen";
import ServicesScreen from "@/screens/provider/ServicesScreen";
import NewServiceScreen from "@/screens/provider/NewServiceScreen";
import PublicProfileScreen from "@/screens/provider/PublicProfileScreen";
import ServicePreviewScreen from "@/screens/provider/ServicePreviewScreen";
import ProviderJobDetailScreen from "@/screens/provider/ProviderJobDetailScreen";
import BusinessDetailsScreen from "@/screens/provider/BusinessDetailsScreen";
import ReviewsScreen from "@/screens/provider/ReviewsScreen";
import ProviderResourcesScreen from "@/screens/provider/ProviderResourcesScreen";
import ProviderAIAssistantScreen from "@/screens/provider/ProviderAIAssistantScreen";
import StripeConnectScreen from "@/screens/provider/StripeConnectScreen";
import BusinessHubScreen from "@/screens/provider/BusinessHubScreen";
import BookingLinkScreen from "@/screens/provider/BookingLinkScreen";
import SendMessageScreen from "@/screens/provider/SendMessageScreen";
import CommunicationsScreen from "@/screens/provider/CommunicationsScreen";
import SavedProvidersScreen from "@/screens/homeowner/SavedProvidersScreen";
import HelpCenterScreen from "@/screens/homeowner/HelpCenterScreen";
import ContactUsScreen from "@/screens/homeowner/ContactUsScreen";
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
  ProviderSetupFlow: undefined;
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  Onboarding: undefined;
  Main: undefined;
  RoleSwitchConfirmation: { targetRole: UserRole };
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
  SavingsSpend: undefined;
  Budgeter: undefined;
  ServiceHistory: undefined;
  ProviderList: { categoryId: string; categoryName: string };
  ProviderProfile: { 
    providerId: string;
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
  BookingSuccess: { jobId: string };
  JobDetail: { jobId: string };
  AppointmentDetail: { appointmentId: string };
  Payment: { jobId: string; invoiceId: string };
  Review: { jobId: string };
  ProfileEdit: undefined;
  Addresses: undefined;
  PaymentMethods: undefined;
  Notifications: undefined;
  NotificationPreferences: undefined;
  ClientDetail: { clientId: string };
  AddClient: undefined;
  AddJob: { clientId?: string } | undefined;
  AddInvoice: { clientId?: string } | undefined;
  InvoiceDetail: { invoiceId: string };
  Services: undefined;
  NewService: undefined;
  EditService: { serviceId: string; service?: Record<string, unknown> };
  ServicePreview: { service: any };
  BusinessProfile: undefined;
  PreviewBookingPage: { providerId?: string };
  SavedProviders: undefined;
  HelpCenter: undefined;
  ContactUs: undefined;
  ProviderJobDetail: { jobId: string };
  BusinessDetails: undefined;
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
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const { isAuthenticated, isHydrated, activeRole, canAccessProviderMode, needsRoleSelection, setActiveRole, setNeedsRoleSelection } = useAuthStore();
  const { hasCompletedFirstLaunch, hasCompletedProviderSetup, isHydrated: onboardingHydrated } = useOnboardingStore();

  usePushNotifications();

  // Auto-resolve role selection: default to homeowner when the gateway would have shown.
  // Users can still switch roles from within the app.
  useEffect(() => {
    if (isAuthenticated && needsRoleSelection) {
      setActiveRole("homeowner");
      setNeedsRoleSelection(false);
    }
  }, [isAuthenticated, needsRoleSelection]);

  // canAccessProviderMode checks for an approved provider profile (existing providers).
  // hasCompletedProviderSetup covers new providers who finished ProviderOnboarding
  // but don't yet have a persisted/approved profile in the backend.
  const isProviderMode = isAuthenticated && activeRole === "provider" &&
    (canAccessProviderMode() || hasCompletedProviderSetup);

  const getMainComponent = () => {
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
        </>
      ) : null}
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RoleSwitchConfirmation"
        component={RoleSwitchConfirmationScreen}
        options={{
          presentation: "formSheet",
          headerTitle: "Switch Role",
          sheetAllowedDetents: [0.45],
          sheetCornerRadius: 20,
          sheetExpandsWhenScrolledToEdge: false,
        }}
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
          headerTransparent: false,
          headerBlurEffect: undefined,
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
        name="Addresses"
        component={AddressesScreen}
        options={{
          headerTitle: "My Addresses",
        }}
      />
      <Stack.Screen
        name="PaymentMethods"
        component={PaymentMethodsScreen}
        options={{
          headerTitle: "Payment Methods",
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
        name="Services"
        component={ServicesScreen}
        options={{
          headerTitle: "My Services",
        }}
      />
      <Stack.Screen
        name="NewService"
        component={NewServiceScreen}
        options={{
          headerTitle: "New Service",
        }}
      />
      <Stack.Screen
        name="EditService"
        component={NewServiceScreen}
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
        name="ProviderJobDetail"
        component={ProviderJobDetailScreen}
        options={{
          headerTitle: "Job Details",
        }}
      />
      <Stack.Screen
        name="BusinessDetails"
        component={BusinessDetailsScreen}
        options={{
          headerTitle: "Business Details",
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
    </Stack.Navigator>
  );
}
