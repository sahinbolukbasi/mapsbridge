"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "mapsbridge.ai.userMemory.v1";

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

function load(): UserMemoryData {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}

function save(data: UserMemoryData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function useUserMemory() {
  const [memory, setMemory] = useState<UserMemoryData>(EMPTY);

  useEffect(() => {
    const m = load();
    const updated = {
      ...m,
      totalSessions: m.totalSessions + 1,
      lastActiveAt: new Date().toISOString(),
    };
    setMemory(updated);
    save(updated);
  }, []);

  const learnFromPrompt = useCallback((prompt: string) => {
    setMemory((prev) => {
      const updated = { ...prev };

      // Extract destination hints
      const destMatch = prompt.match(/(?:in |to |at |for |visit(?:ing)? )([A-ZÇĞİÖŞÜa-zçğışöüâîû][a-zçğışöüâîû]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğışöüâîû]+)*)/g);
      if (destMatch) {
        const cities = destMatch.map((m) => m.replace(/^(?:in |to |at |for |visit(?:ing)? )/, "").trim());
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

      save(updated);
      return updated;
    });
  }, []);

  const buildContextString = useCallback(
    (mem: UserMemoryData): string | undefined => {
      const parts: string[] = [];
      if (mem.destinations.length) parts.push(`Daha önce ilgi duyduğu destinasyonlar: ${mem.destinations.slice(-3).join(", ")}`);
      if (mem.interests.length) parts.push(`İlgi alanları: ${mem.interests.join(", ")}`);
      if (mem.budgetHabit) parts.push(`Bütçe tercihi: ${mem.budgetHabit === "budget" ? "ekonomik" : mem.budgetHabit === "luxury" ? "lüks" : "orta"}`);
      if (mem.travelStyle) parts.push(`Seyahat tarzı: ${mem.travelStyle}`);
      return parts.length ? `[Kullanıcı hafızası: ${parts.join(" | ")}]` : undefined;
    },
    [],
  );

  const clearMemory = useCallback(() => {
    const fresh = { ...EMPTY, totalSessions: memory.totalSessions };
    setMemory(fresh);
    save(fresh);
  }, [memory.totalSessions]);

  return { memory, learnFromPrompt, buildContextString, clearMemory };
}
