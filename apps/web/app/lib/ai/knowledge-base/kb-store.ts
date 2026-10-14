/**
 * In-memory + serializable KB entity store — domain logic layer.
 * Database persistence is handled separately (DynamoDB via KB_PATTERNS).
 */

import type { KBEntity, KBSource, KBConflict } from './types';

export interface KBStore {
  entities: Map<string, KBEntity>;
  sources: Map<string, KBSource[]>;   // entityId → sources
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
export function getEntitiesForCity(
  store: KBStore,
  city: string,
  type?: string
): KBEntity[] {
  const cityLower = city.toLowerCase();
  const results: KBEntity[] = [];
  for (const entity of store.entities.values()) {
    const matchCity =
      entity.city?.toLowerCase() === cityLower ||
      entity.country?.toLowerCase() === cityLower;
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
  resolvedValue: unknown
): KBStore {
  const entity = store.entities.get(entityId);
  if (!entity) return store;

  const updatedEntity: KBEntity = {
    ...entity,
    payload: { ...entity.payload, [field]: resolvedValue },
    updatedAt: new Date().toISOString(),
  };

  const newConflicts = new Map(store.conflicts);
  const entityConflicts = (newConflicts.get(entityId) ?? []).map(c =>
    c.field === field
      ? { ...c, resolvedBy: 'manual', resolvedAt: new Date().toISOString() }
      : c
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
  const geo = entity.geo
    ? ` (${entity.geo.lat.toFixed(4)},${entity.geo.lng.toFixed(4)})`
    : '';
  const payloadStr = Object.entries(entity.payload)
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('; ');
  const confidence = `${(entity.confidence * 100).toFixed(0)}%`;
  return (
    `[KB:${entity.type.toUpperCase()}] ${entity.name}${geo}\n` +
    `Location: ${entity.city ?? entity.country} | Confidence: ${confidence}\n` +
    `${payloadStr}\n` +
    `Updated: ${entity.updatedAt} | Expires: ${entity.expiresAt}`
  );
}

/**
 * Remove all stale entities (and their associated sources/conflicts) from the store.
 * Returns a new immutable store plus the count of pruned records.
 */
export function pruneStaleEntities(
  store: KBStore
): { store: KBStore; pruned: number } {
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
