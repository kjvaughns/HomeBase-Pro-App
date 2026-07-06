import React, { useEffect } from "react";
import { View } from "react-native";
import { useNavigation, CommonActions } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedView } from "@/components/ThemedView";

export default function EstimatesListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: "Main",
            state: {
              index: 0,
              routes: [
                {
                  name: "FinancialsTab",
                  params: {
                    initialSection: "invoices",
                    initialTransactionFilter: "estimates",
                  },
                },
              ],
            },
          },
        ],
      }),
    );
  }, [navigation]);

  return (
    <ThemedView style={{ flex: 1 }}>
      <View />
    </ThemedView>
  );
}
