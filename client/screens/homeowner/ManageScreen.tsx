import React, { useState } from "react";
import { StyleSheet, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedView } from "@/components/ThemedView";
import { BookingCard } from "@/components/BookingCard";
import { EmptyState } from "@/components/EmptyState";
import { AccountGateModal } from "@/components/AccountGateModal";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { Spacing, Colors } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { mockBookings, Booking } from "@/state/mockData";

export default function ManageScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { isAuthenticated, login } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAccountGate, setShowAccountGate] = useState(false);

  const bookings = isAuthenticated ? mockBookings : [];

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleBookingPress = (booking: Booking) => {
    // Navigate to booking details
  };

  const handleMockSignIn = () => {
    login({
      id: "1",
      name: "Alex Johnson",
      email: "alex@example.com",
    });
    setShowAccountGate(false);
  };

  const renderBooking = ({ item, index }: { item: Booking; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(400)}>
      <BookingCard
        booking={item}
        onPress={() => handleBookingPress(item)}
        testID={`booking-${item.id}`}
      />
    </Animated.View>
  );

  const renderEmpty = () => {
    if (!isAuthenticated) {
      return (
        <EmptyState
          image={require("../../../assets/images/empty-bookings.png")}
          title="Sign in to manage bookings"
          description="Create an account to book services, track your projects, and manage your home."
          primaryAction={{
            label: "Sign In",
            onPress: () => setShowAccountGate(true),
          }}
        />
      );
    }

    return (
      <EmptyState
        image={require("../../../assets/images/empty-bookings.png")}
        title="No bookings yet"
        description="When you book a service, it will appear here. Start by finding a pro!"
        primaryAction={{
          label: "Find a Pro",
          onPress: () => {},
        }}
      />
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <SkeletonCard />}
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
          }}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={bookings}
        renderItem={renderBooking}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
          },
          bookings.length === 0 && styles.emptyContainer,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      />

      <AccountGateModal
        visible={showAccountGate}
        onClose={() => setShowAccountGate(false)}
        onSignIn={handleMockSignIn}
        onSignUp={handleMockSignIn}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
  },
});
