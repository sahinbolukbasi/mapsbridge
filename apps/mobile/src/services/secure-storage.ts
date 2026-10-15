import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Secure storage utility for sensitive values (tokens, refresh tokens).
 * Uses expo-secure-store on native platforms and falls back to AsyncStorage on web.
 */

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export async function getSecureItem(key: string): Promise<string | null> {
  if (isNative) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn("[secure-storage] SecureStore.getItemAsync failed:", key, e);
    }
  }
  // Fallback to AsyncStorage (web or SecureStore failure)
  try {
    return await AsyncStorage.getItem(key);
  } catch (e) {
    console.warn("[secure-storage] AsyncStorage fallback failed:", key, e);
    return null;
  }
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isNative) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch (e) {
      console.warn("[secure-storage] SecureStore.setItemAsync failed:", key, e);
    }
  }
  // Fallback to AsyncStorage
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.warn("[secure-storage] AsyncStorage fallback failed:", key, e);
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (isNative) {
    try {
      await SecureStore.deleteItemAsync(key);
      return;
    } catch (e) {
      console.warn("[secure-storage] SecureStore.deleteItemAsync failed:", key, e);
    }
  }
  // Fallback to AsyncStorage
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn("[secure-storage] AsyncStorage fallback failed:", key, e);
  }
}
