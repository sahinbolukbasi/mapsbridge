"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../api-client";
import { getStoredSession } from "../cognito";

const STORAGE_KEY = "mapsbridge.ai.userMemory.v1";
const SYNC_DEBOUNCE_MS = 3000;

export interface UserMemoryData {
  destinations: string[];
  interests: string[];
  budgetHabit?: "budget" | "mid" | "luxury";
  travelStyle?: "calm" | "classic" | "explorer";
  dietaryRestrictions: string[];
  languages: string[];
  lastActiveAt?: string;
  totalSessions: number;
}

const EMPTY: UserMemoryData = {
  destinations: [],
  interests: [],
  dietaryRestrictions: [],
  languages: [],
  totalSessions: 0,
};

function loadLocal(): UserMemoryData {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}

function saveLocal(data: UserMemoryData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

async function loadFromServer(): Promise<UserMemoryData | null> {
  const session = getStoredSession();
  if (!session?.token) return null;
  try {
    const res = await apiFetch<{ memory: UserMemoryData }>("/user/ai-memory");
    return res?.memory && typeof res.memory === "object" ? { ...EMPTY, ...res.memory } : null;
  } catch {
    return null;
  }
}

async function saveToServer(data: UserMemoryData): Promise<void> {
  const session = getStoredSession();
  if (!session?.token) return;
  try {
    await apiFetch("/user/ai-memory", {
      method: "PUT",
      body: JSON.stringify({ memory: data }),
    });
  } catch {}
}

export function useUserMemory() {
  const [memory, setMemory] = useState<UserMemoryData>(EMPTY);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      // Try server first, fall back to localStorage
      const serverMemory = await loadFromServer();
      const localMemory = loadLocal();

      // Merge: server wins for known fields, but keep local session count
      const merged: UserMemoryData = serverMemory
        ? {
            ...serverMemory,
            totalSessions: Math.max(serverMemory.totalSessions, localMemory.totalSessions) + 1,
            lastActiveAt: new Date().toISOString(),
          }
        : {
            ...localMemory,
            totalSessions: localMemory.totalSessions + 1,
            lastActiveAt: new Date().toISOString(),
          };

      setMemory(merged);
      saveLocal(merged);
      // Sync back to server (don't await — fire and forget)
      void saveToServer(merged);
    }
    void init();
  }, []);

  const learnFromPrompt = useCallback((prompt: string) => {
    setMemory((prev) => {
      const updated = { ...prev };

      // Extract destination hints
      const destMatch = prompt.match(
        /(?:in |to |at |for |visit(?:ing)? )([A-ZÇĞİÖŞÜa-zçğışöüâîû][a-zçğışöüâîû]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğışöüâîû]+)*)/g,
      );
      if (destMatch) {
        const cities = destMatch
          .map((m) => m.replace(/^(?:in |to |at |for |visit(?:ing)? )/, "").trim())
          .filter((c) => c.length >= 3);
        const next = Array.from(new Set([...prev.destinations, ...cities])).slice(-10);
        updated.destinations = next;
      }

      // Budget signals
      if (/bütçe|ucuz|ekonomik|budget|cheap/i.test(prompt)) updated.budgetHabit = "budget";
      else if (/lüks|luxury|5 yıldız|five.star/i.test(prompt)) updated.budgetHabit = "luxury";

      // Interest signals
      const INTEREST_SIGNALS: Record<string, string> = {
        "müze|museum": "müze",
        "yemek|restoran|lezzet|food|cuisine": "gastronomi",
        "doğa|hiking|trekking|yürüyüş": "doğa",
        "fotoğraf|photography": "fotoğraf",
        "gece hayatı|nightlife|bar|rooftop": "gece hayatı",
        "tarih|historical|tarihi": "tarih & kültür",
        "kahve|cafe|kafe": "kahve & cafe",
        "alışveriş|shopping": "alışveriş",
      };
      const newInterests: string[] = [];
      for (const [pattern, label] of Object.entries(INTEREST_SIGNALS)) {
        if (new RegExp(pattern, "i").test(prompt)) newInterests.push(label);
      }
      if (newInterests.length) {
        updated.interests = Array.from(new Set([...prev.interests, ...newInterests])).slice(-8);
      }

      saveLocal(updated);

      // Debounced server sync
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => void saveToServer(updated), SYNC_DEBOUNCE_MS);

      return updated;
    });
  }, []);

  const buildContextString = useCallback(
    (mem: UserMemoryData): string | undefined => {
      const parts: string[] = [];
      if (mem.destinations.length)
        parts.push(
          `Daha önce ilgi duyduğu destinasyonlar: ${mem.destinations.slice(-3).join(", ")}`,
        );
      if (mem.interests.length) parts.push(`İlgi alanları: ${mem.interests.join(", ")}`);
      if (mem.budgetHabit)
        parts.push(
          `Bütçe tercihi: ${mem.budgetHabit === "budget" ? "ekonomik" : mem.budgetHabit === "luxury" ? "lüks" : "orta"}`,
        );
      if (mem.travelStyle) parts.push(`Seyahat tarzı: ${mem.travelStyle}`);
      return parts.length ? `[Kullanıcı hafızası: ${parts.join(" | ")}]` : undefined;
    },
    [],
  );

  const clearMemory = useCallback(() => {
    const fresh = { ...EMPTY, totalSessions: memory.totalSessions };
    setMemory(fresh);
    saveLocal(fresh);
    void saveToServer(fresh);
  }, [memory.totalSessions]);

  return { memory, learnFromPrompt, buildContextString, clearMemory };
}
