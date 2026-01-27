import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeownerTabNavigator from "@/navigation/HomeownerTabNavigator";
import ProviderTabNavigator from "@/navigation/ProviderTabNavigator";
import RoleSwitchConfirmationScreen from "@/screens/RoleSwitchConfirmationScreen";
import BecomeProviderScreen from "@/screens/BecomeProviderScreen";
import AIChatScreen from "@/screens/homeowner/AIChatScreen";
import SurvivalKitScreen from "@/screens/homeowner/SurvivalKitScreen";
import HealthScoreScreen from "@/screens/homeowner/HealthScoreScreen";
import HouseFaxScreen from "@/screens/homeowner/HouseFaxScreen";
import BudgeterScreen from "@/screens/homeowner/BudgeterScreen";
import ProviderListScreen from "@/screens/homeowner/ProviderListScreen";
import ProviderProfileScreen from "@/screens/homeowner/ProviderProfileScreen";
import BookingRequestScreen from "@/screens/homeowner/BookingRequestScreen";
import BookingScheduleScreen from "@/screens/homeowner/BookingScheduleScreen";
import BookingAddressScreen from "@/screens/homeowner/BookingAddressScreen";
import BookingConfirmScreen from "@/screens/homeowner/BookingConfirmScreen";
import BookingSuccessScreen from "@/screens/homeowner/BookingSuccessScreen";
import JobDetailScreen from "@/screens/homeowner/JobDetailScreen";
import ChatScreen from "@/screens/homeowner/ChatScreen";
import PaymentScreen from "@/screens/homeowner/PaymentScreen";
import ReviewScreen from "@/screens/homeowner/ReviewScreen";
import ProfileEditScreen from "@/screens/homeowner/ProfileEditScreen";
import AddressesScreen from "@/screens/homeowner/AddressesScreen";
import PaymentMethodsScreen from "@/screens/homeowner/PaymentMethodsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuthStore, UserRole } from "@/state/authStore";
import { UrgencyLevel, JobSize } from "@/state/types";

export type RootStackParamList = {
  Main: undefined;
  RoleSwitchConfirmation: { targetRole: UserRole };
  BecomeProvider: undefined;
  AIChat: undefined;
  SurvivalKit: undefined;
  HealthScore: undefined;
  HouseFax: undefined;
  Budgeter: undefined;
  ProviderList: { categoryId: string; categoryName: string };
  ProviderProfile: { providerId: string };
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
  Chat: { jobId: string; threadId?: string };
  Payment: { jobId: string; invoiceId: string };
  Review: { jobId: string };
  ProfileEdit: undefined;
  Addresses: undefined;
  PaymentMethods: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, activeRole, canAccessProviderMode } = useAuthStore();

  const getMainComponent = () => {
    if (isAuthenticated && activeRole === "provider" && canAccessProviderMode()) {
      return ProviderTabNavigator;
    }
    return HomeownerTabNavigator;
  };

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={getMainComponent()}
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
          headerTitle: "Ask Homebase AI",
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
        name="Chat"
        component={ChatScreen}
        options={{
          headerTitle: "Messages",
          headerTransparent: false,
          headerBlurEffect: undefined,
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
    </Stack.Navigator>
  );
}
