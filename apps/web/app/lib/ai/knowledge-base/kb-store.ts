/**
 * In-memory + serializable KB entity store — domain logic layer.
 * Database persistence is handled separately (DynamoDB via KB_PATTERNS).
 */

import type { KBEntity, KBSource, KBConflict } from "./types";

export interface KBStore {
  entities: Map<string, KBEntity>;
  sources: Map<string, KBSource[]>; // entityId → sources
  conflicts: Map<string, KBConflict[]>; // entityId → conflicts
}

/** Create an empty KBStore. */
export function createKBStore(): KBStore {
  return {
    entities: new Map(),
    sources: new Map(),
    conflicts: new Map(),
  };
}

/** Immutably insert or update an entity. */
export function upsertEntity(store: KBStore, entity: KBEntity): KBStore {
  const newEntities = new Map(store.entities);
  newEntities.set(entity.id, entity);
  return { ...store, entities: newEntities };
}

export function getEntity(store: KBStore, id: string): KBEntity | undefined {
  return store.entities.get(id);
}

/**
 * Return all entities whose city matches (case-insensitive).
 * Pass `type` to narrow by KBEntityType.
 */
export function getEntitiesForCity(store: KBStore, city: string, type?: string): KBEntity[] {
  const cityLower = city.toLowerCase();
  const results: KBEntity[] = [];
  for (const entity of store.entities.values()) {
    const matchCity =
      entity.city?.toLowerCase() === cityLower || entity.country?.toLowerCase() === cityLower;
    if (matchCity && (type === undefined || entity.type === type)) {
      results.push(entity);
    }
  }
  return results;
}

/** Returns true when the entity's expiresAt timestamp is in the past. */
export function isEntityStale(entity: KBEntity): boolean {
  const expires = new Date(entity.expiresAt);
  if (isNaN(expires.getTime())) return true;
  return expires.getTime() < Date.now();
}

/** Immutably append a conflict record. */
export function addConflict(store: KBStore, conflict: KBConflict): KBStore {
  const newConflicts = new Map(store.conflicts);
  const existing = newConflicts.get(conflict.entityId) ?? [];
  newConflicts.set(conflict.entityId, [...existing, conflict]);
  return { ...store, conflicts: newConflicts };
}

/**
 * Apply a manually resolved value to an entity's payload field and mark the
 * matching conflict record as resolved.
 */
export function resolveConflict(
  store: KBStore,
  entityId: string,
  field: string,
  resolvedValue: unknown,
): KBStore {
  const entity = store.entities.get(entityId);
  if (!entity) return store;

  const updatedEntity: KBEntity = {
    ...entity,
    payload: { ...entity.payload, [field]: resolvedValue },
    updatedAt: new Date().toISOString(),
  };

  const newConflicts = new Map(store.conflicts);
  const entityConflicts = (newConflicts.get(entityId) ?? []).map((c) =>
    c.field === field ? { ...c, resolvedBy: "manual", resolvedAt: new Date().toISOString() } : c,
  );
  newConflicts.set(entityId, entityConflicts);

  const newEntities = new Map(store.entities);
  newEntities.set(entityId, updatedEntity);

  return { ...store, entities: newEntities, conflicts: newConflicts };
}

/**
 * Render an entity as a compact prompt-injection snippet (≤600 chars).
 * Caller MUST inject verbatim — do not paraphrase.
 */
export function kbEntityToPromptSnippet(entity: KBEntity): string {
  const geo = entity.geo ? ` (${entity.geo.lat.toFixed(4)},${entity.geo.lng.toFixed(4)})` : "";
  const payloadStr = Object.entries(entity.payload)
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("; ");
  const confidence = `${(entity.confidence * 100).toFixed(0)}%`;
  return (
    `[KB:${entity.type.toUpperCase()}] ${entity.name}${geo}\n` +
    `Location: ${entity.city ?? entity.country} | Confidence: ${confidence}\n` +
    `${payloadStr}\n` +
    `Updated: ${entity.updatedAt} | Expires: ${entity.expiresAt}`
  );
}

/**
 * Kaynak güvenilirlik sırası (Faz 2 / görev 9). Yüksek = daha güvenilir.
 * KBSource.reliability ve KBConflict.values[].reliability ile aynı etiketler.
 */
export const RELIABILITY_RANK: Record<string, number> = {
  official: 4,
  institutional: 3,
  major_publication: 2,
  ugc: 1,
};

export interface ConflictResolution {
  /** Otomatik seçilen değer (tek en-güvenilir kaynak varsa). */
  resolvedValue?: unknown;
  /** Seçimi yapan kaynağın id'si. */
  resolvedBySourceId?: string;
  /** Otomatik çözülemedi: en yüksek güvenilirlikte ≥2 kaynak farklı değerde. */
  ambiguous: boolean;
}

/**
 * Çoklu kaynak aynı alanda ayrıştığında çözümü SAF biçimde hesaplar:
 *  - En yüksek RELIABILITY_RANK'a sahip kaynak(lar) seçilir.
 *  - Bu en yüksek seviyede TEK bir farklı değer varsa → otomatik çözüm.
 *  - En yüksek seviyede birden çok FARKLI değer varsa → ambiguous (insan/işaret).
 * Mutasyon yok; yalnızca karar döner. Uygulama kb-store.resolveConflict veya
 * addConflict ile kalıcılaştırılır.
 */
export function resolveByReliability(
  values: Array<{ value: unknown; sourceId: string; reliability: string }>,
): ConflictResolution {
  if (values.length === 0) return { ambiguous: false };
  const maxRank = Math.max(...values.map((v) => RELIABILITY_RANK[v.reliability] ?? 0));
  const top = values.filter((v) => (RELIABILITY_RANK[v.reliability] ?? 0) === maxRank);
  const distinct = [...new Set(top.map((v) => JSON.stringify(v.value)))];
  if (distinct.length === 1) {
    return {
      resolvedValue: top[0].value,
      resolvedBySourceId: top[0].sourceId,
      ambiguous: false,
    };
  }
  // En güvenilir seviyede birden çok farklı değer → otomatik çözülemez.
  return { ambiguous: true };
}

/**
 * Bir entity alanındaki kaynak çelişkisini store'a uygular:
 *  - Otomatik çözülürse → değeri entity'ye yazar (resolveConflict, resolvedBy="reliability").
 *  - Ambiguous ise → çelişkiyi kaydeder (addConflict), insan çözümüne bırakır.
 * Immutable: yeni store + sonucu döner.
 */
export function applyConflictResolution(
  store: KBStore,
  entityId: string,
  field: string,
  values: Array<{ value: unknown; sourceId: string; reliability: string }>,
  conflictId: string,
): { store: KBStore; resolution: ConflictResolution } {
  const resolution = resolveByReliability(values);
  if (!resolution.ambiguous && resolution.resolvedValue !== undefined) {
    // Önce çelişki kaydını ekle, sonra reliability ile çözülmüş işaretle + değeri uygula.
    const withConflict = addConflict(store, { id: conflictId, entityId, field, values });
    const resolved = resolveConflict(withConflict, entityId, field, resolution.resolvedValue);
    // resolveConflict resolvedBy'ı "manual" yazar; reliability kaynağını not düş.
    const conflicts = (resolved.conflicts.get(entityId) ?? []).map((c) =>
      c.id === conflictId ? { ...c, resolvedBy: "reliability" } : c,
    );
    const newConflicts = new Map(resolved.conflicts);
    newConflicts.set(entityId, conflicts);
    return { store: { ...resolved, conflicts: newConflicts }, resolution };
  }
  // Ambiguous: yalnızca çelişkiyi kaydet, çözme.
  return {
    store: addConflict(store, { id: conflictId, entityId, field, values }),
    resolution,
  };
}

/**
 * Remove all stale entities (and their associated sources/conflicts) from the store.
 * Returns a new immutable store plus the count of pruned records.
 */
export function pruneStaleEntities(store: KBStore): { store: KBStore; pruned: number } {
  const newEntities = new Map(store.entities);
  const newSources = new Map(store.sources);
  const newConflicts = new Map(store.conflicts);
  let pruned = 0;

  for (const [id, entity] of newEntities) {
    if (isEntityStale(entity)) {
      newEntities.delete(id);
      newSources.delete(id);
      newConflicts.delete(id);
      pruned++;
    }
  }

  return {
    store: { entities: newEntities, sources: newSources, conflicts: newConflicts },
    pruned,
  };
}
