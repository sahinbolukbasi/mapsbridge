/**
 * KB kalıcılık katmanı (Faz 2 / görev 7) — infrastructure/repo.
 *
 * `kb-store.ts` saf domain mantığıdır (in-memory, immutable). Bu dosya YALNIZCA
 * kalıcılığı sağlar: KB entity / source / conflict kayıtlarını DynamoDB single-table
 * desenine (KB_PATTERNS) yazar-okur. ORM YOK — doğrudan DynamoDB + marshall/unmarshall.
 *
 * DIP: DynamoDB istemcisi ve tablo adı DIŞARIDAN enjekte edilir (DynamoDeps). Böylece
 *  - bu modül `apps/web` içinde kalır ama lambda'nın singleton client'ına bağımlı değildir
 *    (backend→frontend sınır erozyonu artmaz; architecture-truth §5),
 *  - test, gerçek AWS olmadan sahte bir client enjekte edebilir.
 *
 * Erişim desenleri (KB_PATTERNS, knowledge-base/types.ts):
 *   KB#<id> / META        → entity
 *   KB#<id> / SOURCE#<sid> → source
 *   KB#<id> / CONFLICT#<cid> → conflict
 */

import { KB_PATTERNS, type KBEntity, type KBSource, type KBConflict } from "./types";

/**
 * Enjekte edilen minimal DynamoDB bağımlılıkları. Lambda tarafı kendi singleton
 * client'ını + marshall/unmarshall'ını geçer; test sahte bir uygulama geçer.
 */
export interface DynamoDeps {
  /** PutItem — tek öğe yazar. */
  put(item: Record<string, unknown>): Promise<void>;
  /** GetItem — PK+SK ile tek öğe okur; yoksa null. */
  get(pk: string, sk: string): Promise<Record<string, unknown> | null>;
  /** Query — tek PK altındaki tüm öğeleri (opsiyonel SK prefix) döner. */
  query(pk: string, skPrefix?: string): Promise<Array<Record<string, unknown>>>;
  /** DeleteItem — PK+SK ile tek öğe siler. */
  del(pk: string, sk: string): Promise<void>;
  /** Tablo adı (teşhis/log için; put/get/query/del kendi içinde kullanır). */
  table: string;
}

/** Bir KBEntity'yi DynamoDB kaydına çevirir (PK/SK + alanlar). */
export function entityToItem(entity: KBEntity): Record<string, unknown> {
  const { PK, SK } = KB_PATTERNS.entity(entity.id);
  return { PK, SK, kind: "entity", ...entity };
}

/** DynamoDB kaydını KBEntity'ye çevirir; geçersizse null. */
export function itemToEntity(item: Record<string, unknown> | null): KBEntity | undefined {
  if (!item || item.kind !== "entity" || typeof item.id !== "string") return undefined;
  const { PK: _PK, SK: _SK, kind: _kind, ...rest } = item;
  return rest as unknown as KBEntity;
}

/** Entity'yi kalıcılaştırır (upsert). */
export async function putEntity(deps: DynamoDeps, entity: KBEntity): Promise<void> {
  await deps.put(entityToItem(entity));
}

/** Entity'yi id ile okur; yoksa undefined. */
export async function getEntity(deps: DynamoDeps, id: string): Promise<KBEntity | undefined> {
  const { PK, SK } = KB_PATTERNS.entity(id);
  return itemToEntity(await deps.get(PK, SK));
}

/** Entity'yi ve TÜM alt kayıtlarını (source/conflict) siler. */
export async function deleteEntity(deps: DynamoDeps, id: string): Promise<void> {
  const rows = await deps.query(`KB#${id}`);
  await Promise.all(rows.map((r) => deps.del(String(r.PK), String(r.SK))));
}

/** Bir entity'ye kaynak (source) ekler/günceller. */
export async function putSource(deps: DynamoDeps, source: KBSource): Promise<void> {
  const { PK, SK } = KB_PATTERNS.source(source.entityId, source.id);
  await deps.put({ PK, SK, kind: "source", ...source });
}

/** Bir entity'nin tüm kaynaklarını okur. */
export async function getSources(deps: DynamoDeps, entityId: string): Promise<KBSource[]> {
  const rows = await deps.query(`KB#${entityId}`, "SOURCE#");
  return rows
    .filter((r) => r.kind === "source")
    .map((r) => {
      const { PK: _p, SK: _s, kind: _k, ...rest } = r;
      return rest as unknown as KBSource;
    });
}

/** Bir entity'ye çelişki (conflict) kaydı ekler. */
export async function putConflict(deps: DynamoDeps, conflict: KBConflict): Promise<void> {
  const { PK, SK } = KB_PATTERNS.conflict(conflict.entityId, conflict.id);
  await deps.put({ PK, SK, kind: "conflict", ...conflict });
}

/** Bir entity'nin tüm çelişki kayıtlarını okur. */
export async function getConflicts(deps: DynamoDeps, entityId: string): Promise<KBConflict[]> {
  const rows = await deps.query(`KB#${entityId}`, "CONFLICT#");
  return rows
    .filter((r) => r.kind === "conflict")
    .map((r) => {
      const { PK: _p, SK: _s, kind: _k, ...rest } = r;
      return rest as unknown as KBConflict;
    });
}

/**
 * Lambda tarafı için DynamoDeps üretici. İstemci + marshall/unmarshall + komut
 * sınıfları enjekte edilir (bu modül @aws-sdk'ya doğrudan bağlanmaz, böylece
 * apps/web bundle'ı ve testler hafif kalır).
 */
export function makeDynamoDeps(args: {
  table: string;
  send: (command: unknown) => Promise<{ Item?: unknown; Items?: unknown[] }>;
  // AWS komut sınıfları kesin tipli girdi bekler; DIP sınırında gevşek tutuyoruz
  // (çağıran gerçek @aws-sdk sınıflarını geçer). eslint-disable: kasıtlı.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  PutItemCommand: new (i: any) => unknown;
  GetItemCommand: new (i: any) => unknown;
  QueryCommand: new (i: any) => unknown;
  DeleteItemCommand: new (i: any) => unknown;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  marshall: (v: Record<string, unknown>, options?: { removeUndefinedValues?: boolean }) => Record<
    string,
    unknown
  >;
  unmarshall: (v: Record<string, unknown>) => Record<string, unknown>;
}): DynamoDeps {
  const { table, send, PutItemCommand, GetItemCommand, QueryCommand, DeleteItemCommand } = args;
  return {
    table,
    async put(item) {
      await send(
        new PutItemCommand({
          TableName: table,
          Item: args.marshall(item, { removeUndefinedValues: true }),
        }),
      );
    },
    async get(pk, sk) {
      const res = await send(
        new GetItemCommand({ TableName: table, Key: args.marshall({ PK: pk, SK: sk }) }),
      );
      return res.Item ? args.unmarshall(res.Item as Record<string, unknown>) : null;
    },
    async query(pk, skPrefix) {
      const res = await send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: skPrefix
            ? "PK = :pk AND begins_with(SK, :sk)"
            : "PK = :pk",
          ExpressionAttributeValues: args.marshall(
            skPrefix ? { ":pk": pk, ":sk": skPrefix } : { ":pk": pk },
          ),
        }),
      );
      return (res.Items || []).map((i) => args.unmarshall(i as Record<string, unknown>));
    },
    async del(pk, sk) {
      await send(
        new DeleteItemCommand({ TableName: table, Key: args.marshall({ PK: pk, SK: sk }) }),
      );
    },
  };
}
