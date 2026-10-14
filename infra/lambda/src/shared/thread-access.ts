import { GetItemCommand, type DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

/** Read canonical membership, never a client recipient or an eventually consistent index. */
export async function threadParticipants(ddb: DynamoDBClient, table: string, threadId: string, userId: string): Promise<string[] | null> {
  const result = await ddb.send(new GetItemCommand({
    TableName: table,
    Key: marshall({ PK: `THREAD#${threadId}`, SK: "META" }),
    ConsistentRead: true,
  }));
  if (!result.Item) return null;
  const participants = unmarshall(result.Item).participants;
  if (!Array.isArray(participants) || participants.length < 2 ||
      participants.some(p => typeof p !== "string" || !p) || !participants.includes(userId)) return null;
  return [...new Set<string>(participants)];
}
