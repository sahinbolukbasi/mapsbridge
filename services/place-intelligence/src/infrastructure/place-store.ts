/**
 * Place Store — DynamoDB persistence for collected place data
 *
 * Key schema:
 *   PK = PLACE#{city}          SK = {source}#{sourceId}    → individual place
 *   PK = CITY#{city}           SK = DISCOVERY#META         → last discovery metadata
 *   PK = TRAINING#{city}       SK = {category}#{language}  → training document
 *   PK = PLACE_INDEX#{city}    SK = {category}             → category index for fast lookups
 */

import type { NormalizedPlace, CityDiscoveryResult, TrainingDocument } from "../domain/types";

function client() {
  const { DynamoDBClient } =
    require("@aws-sdk/client-dynamodb") as typeof import("@aws-sdk/client-dynamodb");
  return new DynamoDBClient({ region: process.env.AWS_REGION, maxAttempts: 2 });
}

function table(): string {
  return process.env.DYNAMODB_TABLE || `mapsbridge-${process.env.ENVIRONMENT || "dev"}-data`;
}

function marshall(item: Record<string, unknown>) {
  const { marshall: m } =
    require("@aws-sdk/util-dynamodb") as typeof import("@aws-sdk/util-dynamodb");
  return m(item, { removeUndefinedValues: true });
}

function unmarshall(item: Record<string, unknown>) {
  const { unmarshall: u } =
    require("@aws-sdk/util-dynamodb") as typeof import("@aws-sdk/util-dynamodb");
  return u(item);
}

const cityKey = (city: string) => city.toLowerCase().replace(/\s+/g, "-");

export async function storePlaces(places: NormalizedPlace[]): Promise<number> {
  if (places.length === 0) return 0;

  const { BatchWriteItemCommand } =
    require("@aws-sdk/client-dynamodb") as typeof import("@aws-sdk/client-dynamodb");
  const ddb = client();
  const tableName = table();
  let written = 0;

  const chunks: NormalizedPlace[][] = [];
  for (let i = 0; i < places.length; i += 25) {
    chunks.push(places.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    const items = chunk.map((place) => ({
      PutRequest: {
        Item: marshall({
          PK: `PLACE#${cityKey(place.city)}`,
          SK: `${place.source}#${place.sourceId}`,
          ...place,
          GSI1PK: `PLACE_CAT#${cityKey(place.city)}`,
          GSI1SK: `${place.category}#${place.name}`,
        }),
      },
    }));

    await ddb.send(
      new BatchWriteItemCommand({
        RequestItems: { [tableName]: items },
      }),
      { abortSignal: AbortSignal.timeout(5000) },
    );

    written += chunk.length;
  }

  return written;
}

export async function storeDiscoveryMeta(result: CityDiscoveryResult): Promise<void> {
  const { PutItemCommand } =
    require("@aws-sdk/client-dynamodb") as typeof import("@aws-sdk/client-dynamodb");
  await client().send(
    new PutItemCommand({
      TableName: table(),
      Item: marshall({
        PK: `CITY#${cityKey(result.city)}`,
        SK: "DISCOVERY#META",
        city: result.city,
        placeCount: result.places.length,
        sources: result.sources,
        totalCollected: result.totalCollected,
        deduplicated: result.deduplicated,
        collectedAt: result.collectedAt,
        durationMs: result.durationMs,
        ttl: Math.floor(Date.now() / 1000) + 90 * 86400,
      }),
    }),
    { abortSignal: AbortSignal.timeout(3000) },
  );
}

export async function storeTrainingDocuments(docs: TrainingDocument[]): Promise<void> {
  const { PutItemCommand } =
    require("@aws-sdk/client-dynamodb") as typeof import("@aws-sdk/client-dynamodb");
  const ddb = client();
  const tableName = table();

  for (const doc of docs) {
    await ddb.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall({
          PK: `TRAINING#${cityKey(doc.city)}`,
          SK: `${doc.category}#${doc.metadata.language}`,
          ...doc,
          ttl: Math.floor(Date.now() / 1000) + 90 * 86400,
        }),
      }),
      { abortSignal: AbortSignal.timeout(3000) },
    );
  }
}

export async function getPlacesForCity(
  city: string,
  category?: string,
  limit = 100,
): Promise<NormalizedPlace[]> {
  const { QueryCommand } =
    require("@aws-sdk/client-dynamodb") as typeof import("@aws-sdk/client-dynamodb");
  const params: {
    TableName: string;
    KeyConditionExpression: string;
    ExpressionAttributeValues: ReturnType<typeof marshall>;
    Limit: number;
    IndexName?: string;
  } = {
    TableName: table(),
    KeyConditionExpression: category ? "GSI1PK = :pk AND begins_with(GSI1SK, :cat)" : "PK = :pk",
    ExpressionAttributeValues: category
      ? marshall({ ":pk": `PLACE_CAT#${cityKey(city)}`, ":cat": category })
      : marshall({ ":pk": `PLACE#${cityKey(city)}` }),
    Limit: limit,
  };

  if (category) params.IndexName = "GSI1";

  const result = await client().send(new QueryCommand(params), {
    abortSignal: AbortSignal.timeout(3000),
  });
  return (result.Items || []).map((item) => unmarshall(item) as NormalizedPlace);
}

export async function getDiscoveryMeta(city: string) {
  const { GetItemCommand } =
    require("@aws-sdk/client-dynamodb") as typeof import("@aws-sdk/client-dynamodb");
  const result = await client().send(
    new GetItemCommand({
      TableName: table(),
      Key: marshall({ PK: `CITY#${cityKey(city)}`, SK: "DISCOVERY#META" }),
    }),
    { abortSignal: AbortSignal.timeout(2000) },
  );
  return result.Item ? unmarshall(result.Item) : null;
}

export async function getTrainingDocuments(
  city: string,
  language = "tr",
): Promise<TrainingDocument[]> {
  const { QueryCommand } =
    require("@aws-sdk/client-dynamodb") as typeof import("@aws-sdk/client-dynamodb");
  const result = await client().send(
    new QueryCommand({
      TableName: table(),
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: marshall({ ":pk": `TRAINING#${cityKey(city)}` }),
      Limit: 50,
    }),
    { abortSignal: AbortSignal.timeout(3000) },
  );

  return (result.Items || [])
    .map((item) => unmarshall(item) as TrainingDocument)
    .filter((doc) => doc.metadata?.language === language);
}
