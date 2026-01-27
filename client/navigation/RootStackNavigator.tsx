import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeownerTabNavigator from "@/navigation/HomeownerTabNavigator";
import ProviderTabNavigator from "@/navigation/ProviderTabNavigator";
import RoleSwitchConfirmationScreen from "@/screens/RoleSwitchConfirmationScreen";
import BecomeProviderScreen from "@/screens/BecomeProviderScreen";
import WelcomeScreen from "@/screens/auth/WelcomeScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import SignUpScreen from "@/screens/auth/SignUpScreen";
import ForgotPasswordScreen from "@/screens/auth/ForgotPasswordScreen";
import OnboardingScreen from "@/screens/auth/OnboardingScreen";
import AIChatScreen from "@/screens/homeowner/AIChatScreen";
import SmartIntakeScreen from "@/screens/homeowner/SmartIntakeScreen";
import ServiceIntakeScreen from "@/screens/homeowner/ServiceIntakeScreen";
import SurvivalKitScreen from "@/screens/homeowner/SurvivalKitScreen";
import HealthScoreScreen from "@/screens/homeowner/HealthScoreScreen";
import HouseFaxScreen from "@/screens/homeowner/HouseFaxScreen";
import BudgeterScreen from "@/screens/homeowner/BudgeterScreen";
import ServiceHistoryScreen from "@/screens/homeowner/ServiceHistoryScreen";
import ProviderListScreen from "@/screens/homeowner/ProviderListScreen";
import ProviderProfileScreen from "@/screens/homeowner/ProviderProfileScreen";
import BookingRequestScreen from "@/screens/homeowner/BookingRequestScreen";
import BookingScheduleScreen from "@/screens/homeowner/BookingScheduleScreen";
import BookingAddressScreen from "@/screens/homeowner/BookingAddressScreen";
import BookingConfirmScreen from "@/screens/homeowner/BookingConfirmScreen";
import BookingSuccessScreen from "@/screens/homeowner/BookingSuccessScreen";
import JobDetailScreen from "@/screens/homeowner/JobDetailScreen";
import AppointmentDetailScreen from "@/screens/homeowner/AppointmentDetailScreen";
import PaymentScreen from "@/screens/homeowner/PaymentScreen";
import ReviewScreen from "@/screens/homeowner/ReviewScreen";
import ProfileEditScreen from "@/screens/homeowner/ProfileEditScreen";
import AddressesScreen from "@/screens/homeowner/AddressesScreen";
import PaymentMethodsScreen from "@/screens/homeowner/PaymentMethodsScreen";
import NotificationsScreen from "@/screens/homeowner/NotificationsScreen";
import ClientDetailScreen from "@/screens/provider/ClientDetailScreen";
import AddClientScreen from "@/screens/provider/AddClientScreen";
import AddJobScreen from "@/screens/provider/AddJobScreen";
import AddInvoiceScreen from "@/screens/provider/AddInvoiceScreen";
import InvoiceDetailScreen from "@/screens/provider/InvoiceDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore, UserRole } from "@/state/authStore";
import { UrgencyLevel, JobSize } from "@/state/types";

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  Onboarding: undefined;
  Main: undefined;
  RoleSwitchConfirmation: { targetRole: UserRole };
  BecomeProvider: undefined;
  AIChat: undefined;
  SmartIntake: { prefillCategory?: string; prefillProblem?: string } | undefined;
  SurvivalKit: undefined;
  HealthScore: undefined;
  HouseFax: undefined;
  Budgeter: undefined;
  ServiceHistory: undefined;
  ProviderList: { categoryId: string; categoryName: string };
  ProviderProfile: { providerId: string };
  ServiceIntake: {
    providerId: string;
    categoryId: string;
    service: string;
  };
  BookingRequest: {
    providerId: string;
    categoryId: string;
    service: string;
  };
  BookingSchedule: {
    providerId: string;
    categoryId: string;
    service: string;
    description: string;
    urgency: UrgencyLevel;
    size: JobSize;
    photoUrls: string[];
  };
  BookingAddress: {
    providerId: string;
    categoryId: string;
    service: string;
    description: string;
    urgency: UrgencyLevel;
    size: JobSize;
    photoUrls: string[];
    scheduledDate: string;
    scheduledTime: string;
  };
  BookingConfirm: {
    providerId: string;
    categoryId: string;
    service: string;
    description: string;
    urgency: UrgencyLevel;
    size: JobSize;
    photoUrls: string[];
    scheduledDate: string;
    scheduledTime: string;
    addressId: string;
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
  ClientDetail: { clientId: string };
  AddClient: undefined;
  AddJob: undefined;
  AddInvoice: undefined;
  InvoiceDetail: { invoiceId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const { isAuthenticated, isHydrated, activeRole, canAccessProviderMode } = useAuthStore();

  const getMainComponent = () => {
    if (isAuthenticated && activeRole === "provider" && canAccessProviderMode()) {
      return ProviderTabNavigator;
    }
    return HomeownerTabNavigator;
  };

  if (!isHydrated) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={getMainComponent()}
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
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RoleSwitchConfirmation"
        component={RoleSwitchConfirmationScreen}
        options={{
          presentation: "modal",
          headerTitle: "Switch Role",
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
        name="ServiceIntake"
        component={ServiceIntakeScreen}
        options={{
          headerTitle: "Service Details",
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
        name="BookingRequest"
        component={BookingRequestScreen}
        options={{
          headerTitle: "Request Details",
        }}
      />
      <Stack.Screen
        name="BookingSchedule"
        component={BookingScheduleScreen}
        options={{
          headerTitle: "Schedule",
        }}
      />
      <Stack.Screen
        name="BookingAddress"
        component={BookingAddressScreen}
        options={{
          headerTitle: "Service Address",
        }}
      />
      <Stack.Screen
        name="BookingConfirm"
        component={BookingConfirmScreen}
        options={{
          headerTitle: "Confirm Booking",
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
    </Stack.Navigator>
  );
}
