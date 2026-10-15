/**
 * MapsBridge WebSocket — OnDisconnect Handler
 * Removes the connectionId from the DynamoDB connection table.
 */

import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

export const handler = async (event: any) => {
  const connectionId = event.requestContext?.connectionId;

  if (!connectionId) {
    return { statusCode: 400, body: "Missing connectionId" };
  }

  const tableName = process.env.CONNECTIONS_TABLE || "";

  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  await ddb.send(
    new DeleteItemCommand({
      TableName: tableName,
      Key: marshall({ connectionId }),
    }),
  );

  return { statusCode: 200, body: "Disconnected" };
};
