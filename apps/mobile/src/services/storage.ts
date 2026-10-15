import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSecureItem, setSecureItem, deleteSecureItem } from "./secure-storage";

type StorageMap = Record<string, string>;
const memoryFallback: StorageMap = {};

/** Keys that contain sensitive data and should use secure storage. */
const SECURE_KEYS = new Set(["mb_token", "mb_refresh_token"]);

export const storage = {
  async getItem(key: string): Promise<string | null> {
    // Use secure storage for sensitive keys
    if (SECURE_KEYS.has(key)) {
      try {
        const secVal = await getSecureItem(key);
        if (secVal !== null && secVal !== undefined) {
          memoryFallback[key] = secVal;
          return secVal;
        }
      } catch (e) {
        console.warn("[storage] secure getItem failed for key:", key, e);
      }
    }

    try {
      const val = await AsyncStorage.getItem(key);
      if (val !== null && val !== undefined) {
        memoryFallback[key] = val;
        return val;
      }
    } catch (e) {
      console.warn("[storage] AsyncStorage.getItem failed for key:", key, e);
    }

    // Web fallback if window.localStorage is directly available
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const localVal = window.localStorage.getItem(key);
        if (localVal !== null && localVal !== undefined) {
          memoryFallback[key] = localVal;
          return localVal;
        }
      }
    } catch {}

    return memoryFallback[key] ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    memoryFallback[key] = value;

    // Use secure storage for sensitive keys
    if (SECURE_KEYS.has(key)) {
      try {
        await setSecureItem(key, value);
        return;
      } catch (e) {
        console.warn("[storage] secure setItem failed, falling back:", key, e);
      }
    }

    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn("[storage] AsyncStorage.setItem failed for key:", key, e);
    }

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {}
  },

  async removeItem(key: string): Promise<void> {
    delete memoryFallback[key];

    // Remove from secure storage if it's a sensitive key
    if (SECURE_KEYS.has(key)) {
      try {
        await deleteSecureItem(key);
      } catch (e) {
        console.warn("[storage] secure removeItem failed:", key, e);
      }
    }

    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn("[storage] AsyncStorage.removeItem failed for key:", key, e);
    }

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {}
  },

  async clear(): Promise<void> {
    Object.keys(memoryFallback).forEach((k) => delete memoryFallback[k]);
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.warn("[storage] AsyncStorage.clear failed:", e);
    }

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.clear();
      }
    } catch {}
  },

  /**
   * Read multiple keys at once (used for session bootstrapping).
   */
  async multiGet(keys: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      for (const [k, v] of pairs) {
        result[k] = v;
        if (v !== null) memoryFallback[k] = v;
      }
      return result;
    } catch (e) {
      console.warn("[storage] AsyncStorage.multiGet failed:", e);
    }

    // Fill missing keys from memoryFallback or individual gets
    for (const key of keys) {
      if (result[key] === undefined || result[key] === null) {
        result[key] = memoryFallback[key] ?? null;
      }
    }
    return result;
  },
};
