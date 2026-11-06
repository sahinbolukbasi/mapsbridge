import { GetItemCommand, type DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

/** Read canonical membership, never a client recipient or an eventually consistent index. */
export async function threadParticipants(
  ddb: DynamoDBClient,
  table: string,
  threadId: string,
  userId: string,
): Promise<string[] | null> {
  const result = await ddb.send(
    new GetItemCommand({
      TableName: table,
      Key: marshall({ PK: `THREAD#${threadId}`, SK: "META" }),
      ConsistentRead: true,
    }),
  );
  if (!result.Item) return null;
  const participants = unmarshall(result.Item).participants;
  if (
    !Array.isArray(participants) ||
    participants.length < 2 ||
    participants.some((p) => typeof p !== "string" || !p) ||
    !participants.includes(userId)
  )
    return null;
  return [...new Set<string>(participants)];
}

/** Mesaj isteği durumu (Increment 1.14, M1/M2). */
export type ThreadRequestStatus = "pending" | "accepted" | "declined" | "blocked";
export type ThreadRequest = { status: ThreadRequestStatus; from: string; to: string };
const REQUEST_STATUSES: readonly string[] = ["pending", "accepted", "declined", "blocked"];

/**
 * THREAD#<id>/REQUEST kaydı. Kayıt yoksa (eski thread) null → kabul edilmiş sayılır (geriye
 * uyum, backfill yok). HTTP ve WebSocket gönderim yolları aynı kapıyı kullanır.
 */
export async function threadRequest(
  ddb: DynamoDBClient,
  table: string,
  threadId: string,
): Promise<ThreadRequest | null> {
  const result = await ddb.send(
    new GetItemCommand({
      TableName: table,
      Key: marshall({ PK: `THREAD#${threadId}`, SK: "REQUEST" }),
      ConsistentRead: true,
    }),
  );
  if (!result.Item) return null;
  const r = unmarshall(result.Item);
  if (
    !REQUEST_STATUSES.includes(r.status) ||
    typeof r.from !== "string" ||
    typeof r.to !== "string"
  )
    return null;
  return { status: r.status as ThreadRequestStatus, from: r.from, to: r.to };
}

/** Gönderim kararı: null = serbest; aksi halde HTTP durum kodu + mesaj. */
export function requestGate(
  request: ThreadRequest | null,
  senderId: string,
): { status: 403 | 409; error: string; code: string } | null {
  if (!request || request.status === "accepted") return null;
  if (request.status === "declined" || request.status === "blocked")
    return { status: 403, error: "Bu sohbet kapatıldı.", code: "REQUEST_CLOSED" };
  return {
    status: 409,
    error:
      request.from === senderId ? "Mesaj isteğin yanıt bekliyor." : "Önce mesaj isteğini yanıtla.",
    code: "REQUEST_PENDING",
  };
}
