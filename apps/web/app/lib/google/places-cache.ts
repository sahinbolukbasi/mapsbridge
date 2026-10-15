/**
 * Places & Geocoding Multi-Tier Cache
 * Cost Optimization & Snappy UX Layer
 *
 * Prevents redundant calls to Google Places API and Geocoding APIs.
 * Tier 1: In-memory LRU map (instant 0ms)
 * Tier 2: LocalStorage cache with TTL (persists across page reloads and sessions)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const MEMORY_CACHE = new Map<string, CacheEntry<any>>();

const PLACE_DETAILS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for place details
const SEARCH_TTL = 24 * 60 * 60 * 1000; // 24 hours for place searches
const GEOCODE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days for coordinates -> address

const STORAGE_PREFIX = "mapsbridge.cache.";

function getStorageKey(type: string, key: string): string {
  // Normalize key to avoid case/space issues
  const cleanKey = key.trim().toLowerCase().replace(/\s+/g, "_");
  return `${STORAGE_PREFIX}${type}.${cleanKey}`;
}

export const placesCache = {
  /**
   * Get cached Google Place details
   */
  getPlaceDetails<T = any>(placeId: string): T | null {
    if (!placeId) return null;
    const memKey = `place:${placeId}`;
    const now = Date.now();

    // 1. Check in-memory
    const mem = MEMORY_CACHE.get(memKey);
    if (mem && now - mem.timestamp < mem.ttlMs) {
      return mem.data as T;
    }

    // 2. Check localStorage
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(getStorageKey("place", placeId));
      if (!raw) return null;
      const parsed: CacheEntry<T> = JSON.parse(raw);
      if (now - parsed.timestamp < parsed.ttlMs) {
        // Hydrate memory cache
        MEMORY_CACHE.set(memKey, parsed);
        return parsed.data;
      }
      localStorage.removeItem(getStorageKey("place", placeId));
    } catch {}
    return null;
  },

  /**
   * Set cached Google Place details
   */
  setPlaceDetails<T = any>(placeId: string, data: T, ttlMs = PLACE_DETAILS_TTL): void {
    if (!placeId || !data) return;
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttlMs };
    MEMORY_CACHE.set(`place:${placeId}`, entry);

    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(getStorageKey("place", placeId), JSON.stringify(entry));
    } catch (e) {
      // If quota exceeded, clean old entries
      placesCache.pruneOldEntries();
    }
  },

  /**
   * Get cached place search results
   */
  getSearch<T = any>(query: string, locationKey = ""): T | null {
    const key = `${query.trim()}@${locationKey}`;
    const memKey = `search:${key}`;
    const now = Date.now();

    const mem = MEMORY_CACHE.get(memKey);
    if (mem && now - mem.timestamp < mem.ttlMs) {
      return mem.data as T;
    }

    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(getStorageKey("search", key));
      if (!raw) return null;
      const parsed: CacheEntry<T> = JSON.parse(raw);
      if (now - parsed.timestamp < parsed.ttlMs) {
        MEMORY_CACHE.set(memKey, parsed);
        return parsed.data;
      }
      localStorage.removeItem(getStorageKey("search", key));
    } catch {}
    return null;
  },

  /**
   * Set cached place search results
   */
  setSearch<T = any>(query: string, data: T, locationKey = "", ttlMs = SEARCH_TTL): void {
    const key = `${query.trim()}@${locationKey}`;
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttlMs };
    MEMORY_CACHE.set(`search:${key}`, entry);

    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(getStorageKey("search", key), JSON.stringify(entry));
    } catch {
      placesCache.pruneOldEntries();
    }
  },

  /**
   * Get cached reverse geocode
   */
  getReverseGeocode(lat: number, lng: number): string | null {
    const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const memKey = `geo:${coordKey}`;
    const now = Date.now();

    const mem = MEMORY_CACHE.get(memKey);
    if (mem && now - mem.timestamp < mem.ttlMs) {
      return mem.data as string;
    }

    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(getStorageKey("geo", coordKey));
      if (!raw) return null;
      const parsed: CacheEntry<string> = JSON.parse(raw);
      if (now - parsed.timestamp < parsed.ttlMs) {
        MEMORY_CACHE.set(memKey, parsed);
        return parsed.data;
      }
      localStorage.removeItem(getStorageKey("geo", coordKey));
    } catch {}
    return null;
  },

  /**
   * Set cached reverse geocode
   */
  setReverseGeocode(lat: number, lng: number, address: string, ttlMs = GEOCODE_TTL): void {
    const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const entry: CacheEntry<string> = { data: address, timestamp: Date.now(), ttlMs };
    MEMORY_CACHE.set(`geo:${coordKey}`, entry);

    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(getStorageKey("geo", coordKey), JSON.stringify(entry));
    } catch {
      placesCache.pruneOldEntries();
    }
  },

  /**
   * Clear expired or prune excess cache to prevent quota exceeded errors
   */
  pruneOldEntries(): void {
    if (typeof window === "undefined") return;
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          try {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (now - parsed.timestamp >= parsed.ttlMs) {
                keysToRemove.push(k);
              }
            }
          } catch {
            keysToRemove.push(k);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  },
};
