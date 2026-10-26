/**
 * MapsBridge WebSocket — OnDisconnect Handler
 * Removes the connectionId from the DynamoDB connection table.
 */

import { DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { getDynamoClient } from "../shared/dynamo";
import { marshall } from "@aws-sdk/util-dynamodb";

export const handler = async (event: { requestContext?: { connectionId?: string } }) => {
  const connectionId = event.requestContext?.connectionId;

  if (!connectionId) {
    return { statusCode: 400, body: "Missing connectionId" };
  }

  const tableName = process.env.CONNECTIONS_TABLE || "";

  const ddb = getDynamoClient();

  await ddb.send(
    new DeleteItemCommand({
      TableName: tableName,
      Key: marshall({ connectionId }),
    }),
  );

  return { statusCode: 200, body: "Disconnected" };
};
