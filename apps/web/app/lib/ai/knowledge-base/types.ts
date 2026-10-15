export type KBEntityType =
  | "city"
  | "place"
  | "airport"
  | "transit_system"
  | "visa_rule"
  | "rental_info"
  | "customs_rule"
  | "payment_info";

export interface KBEntity {
  id: string;
  type: KBEntityType;
  country: string;
  city?: string;
  name: string;
  geo?: { lat: number; lng: number };
  payload: Record<string, unknown>;
  confidence: number;
  ttlDays: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface KBSource {
  id: string;
  entityId: string;
  url: string;
  publisher: string;
  fetchedAt: string;
  contentHash: string;
  reliability: "official" | "institutional" | "major_publication" | "ugc";
}

export interface KBConflict {
  id: string;
  entityId: string;
  field: string;
  values: Array<{ value: unknown; sourceId: string; reliability: string }>;
  resolvedBy?: string;
  resolvedAt?: string;
}

/** TTL defaults by entity type (in days). */
export const KB_TTL_DAYS: Record<KBEntityType, number> = {
  city: 365,
  place: 90,
  airport: 180,
  transit_system: 30,
  visa_rule: 30,
  rental_info: 60,
  customs_rule: 30,
  payment_info: 14,
};

/** DynamoDB PK/SK patterns for knowledge base entities. */
export const KB_PATTERNS = {
  entity: (id: string) => ({ PK: `KB#${id}`, SK: "META" }),
  source: (entityId: string, sourceId: string) => ({
    PK: `KB#${entityId}`,
    SK: `SOURCE#${sourceId}`,
  }),
  conflict: (entityId: string, conflictId: string) => ({
    PK: `KB#${entityId}`,
    SK: `CONFLICT#${conflictId}`,
  }),
  byCity: (city: string) => ({
    PK: `KBCITY#${city.toLowerCase()}`,
    SK: "",
  }),
} as const;
