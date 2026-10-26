import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

let clientInstance: DynamoDBClient | null = null;

/**
 * Returns a shared singleton DynamoDBClient instance.
 *
 * Özel config (ör. maxAttempts) gerektiren çağrılar için `options` verilebilir;
 * bu durumda singleton kirletilmez ve ayrı bir örnek döndürülür. Lambda runtime'da
 * `AWS_REGION` her zaman tanımlıdır, bu yüzden bölge buradan okunur.
 */
export function getDynamoClient(options?: { maxAttempts?: number }): DynamoDBClient {
  if (options && Object.keys(options).length > 0) {
    return new DynamoDBClient({ region: process.env.AWS_REGION, ...options });
  }
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
