import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const SESSION_TOKEN_KEY = "homebase_session_token";

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export async function setSessionToken(token: string | null): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    if (token) {
      await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token, options);
    } else {
      await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY, options);
    }
  } catch (err) {
    console.warn("[secureSession] setSessionToken failed:", err);
  }
}

export async function getSessionToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY, options);
  } catch (err) {
    console.warn("[secureSession] getSessionToken failed:", err);
    return null;
  }
}
