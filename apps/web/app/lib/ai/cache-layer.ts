/**
 * Multi-Tier Travel AI Cache Layer
 * Conforms to docs/plans/agentcore-architecture.md Section 10.2
 */

export type CacheCategory = "weather" | "pricing" | "places" | "base_plan";

export const CACHE_TTL_SECONDS: Record<CacheCategory, number> = {
  weather: 15 * 60, // ~15 minutes
  pricing: 5 * 60, // ~5 minutes
  places: 24 * 60 * 60, // ~24 hours (1 day)
  base_plan: 7 * 24 * 60 * 60, // 7 days (long-term template, personalized later)
};

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp in ms
  createdAt: number;
}

class MemoryCacheStore {
  private store: Map<string, CacheEntry<any>> = new Map();

  generateCacheKey(category: CacheCategory, ...parts: string[]): string {
    const cleanParts = parts.map((p) => p.trim().toLowerCase().replace(/\s+/g, "_"));
    return `${category}:${cleanParts.join(":")}`;
  }

  get<T>(category: CacheCategory, ...keyParts: string[]): T | null {
    const key = this.generateCacheKey(category, ...keyParts);
    const entry = this.store.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(
    category: CacheCategory,
    value: T,
    customTtlSeconds?: number,
    ...keyParts: string[]
  ): void {
    const key = this.generateCacheKey(category, ...keyParts);
    const ttlSeconds =
      customTtlSeconds !== undefined ? customTtlSeconds : CACHE_TTL_SECONDS[category];
    const expiresAt = Date.now() + ttlSeconds * 1000;

    this.store.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    });
  }

  has(category: CacheCategory, ...keyParts: string[]): boolean {
    return this.get(category, ...keyParts) !== null;
  }

  invalidateCategory(category: CacheCategory): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(`${category}:`)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export const travelCache = new MemoryCacheStore();
