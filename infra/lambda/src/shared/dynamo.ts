import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

let clientInstance: DynamoDBClient | null = null;

/**
 * Returns a singleton DynamoDBClient instance.
 */
export function getDynamoClient(): DynamoDBClient {
  if (!clientInstance) {
    clientInstance = new DynamoDBClient({ region: process.env.AWS_REGION });
  }
  return clientInstance;
}

/**
 * Returns the configured primary DynamoDB table name.
 */
export function getTableName(): string {
  return process.env.DYNAMODB_TABLE || `mapsbridge-${process.env.ENVIRONMENT || "dev"}-data`;
}

export { marshall, unmarshall };
