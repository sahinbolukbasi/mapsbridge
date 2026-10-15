/**
 * Shared DynamoDB Client
 * Centralized DynamoDB configuration and connection management
 * Reduces code duplication across all services
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export interface DynamoDBConfig {
  region?: string;
  tableName?: string;
  maxRetries?: number;
  connectionTimeout?: number;
}

export class DynamoDBFactory {
  private static clients: Map<string, DynamoDBDocumentClient> = new Map();
  private static tableNames: Map<string, string> = new Map();

  /**
   * Get or create a DynamoDB DocumentClient
   * Uses connection pooling for efficiency
   */
  static getClient(config: DynamoDBConfig = {}): DynamoDBDocumentClient {
    const region = config.region || process.env.AWS_REGION || "us-east-1";
    const key = `client-${region}`;

    if (!this.clients.has(key)) {
      const client = new DynamoDBClient({
        region,
        maxRetries: config.maxRetries || 3,
        requestHandler: {
          requestTimeout: config.connectionTimeout || 5000,
        },
      });

      const docClient = DynamoDBDocumentClient.from(client, {
        marshallOptions: {
          removeUndefinedValues: true,
          convertClassInstanceToMap: true,
        },
        unmarshallOptions: {
          wrapNumbers: false,
        },
      });

      this.clients.set(key, docClient);
    }

    return this.clients.get(key)!;
  }

  /**
   * Get the DynamoDB table name
   * Validates table name is configured
   */
  static getTableName(): string {
    const tableName = process.env.DYNAMODB_TABLE;
    if (!tableName) {
      throw new Error("DYNAMODB_TABLE environment variable is not configured");
    }
    return tableName;
  }

  /**
   * Clear cached clients (useful for testing)
   */
  static clearCache(): void {
    this.clients.clear();
    this.tableNames.clear();
  }
}

/**
 * Common DynamoDB operations with built-in error handling and retries
 */
export class DynamoDBOperations {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor(client?: DynamoDBDocumentClient) {
    this.client = client || DynamoDBFactory.getClient();
    this.tableName = DynamoDBFactory.getTableName();
  }

  /**
   * Get item by primary key
   */
  async get(PK: string, SK: string, options?: { consistentRead?: boolean }) {
    const result = await this.client.send(
      new (await import("@aws-sdk/lib-dynamodb")).GetCommand({
        TableName: this.tableName,
        Key: { PK, SK },
        ConsistentRead: options?.consistentRead || true,
      }),
    );
    return result.Item;
  }

  /**
   * Put item with optional condition
   */
  async put(
    item: Record<string, any>,
    options?: {
      condition?: string;
      attributeNames?: Record<string, string>;
      attributeValues?: Record<string, any>;
    },
  ) {
    const command = new (await import("@aws-sdk/lib-dynamodb")).PutCommand({
      TableName: this.tableName,
      Item: item,
      ...(options?.condition && {
        ConditionExpression: options.condition,
        ExpressionAttributeNames: options.attributeNames,
        ExpressionAttributeValues: options.attributeValues,
      }),
    });

    await this.client.send(command);
    return item;
  }

  /**
   * Query items by partition key
   */
  async query(
    PK: string,
    options?: {
      skBeginsWith?: string;
      limit?: number;
      consistentRead?: boolean;
      projectionExpression?: string;
    },
  ) {
    const keyConditionExpression = options?.skBeginsWith
      ? "PK = :pk AND begins_with(SK, :sk)"
      : "PK = :pk";

    const expressionAttributeValues: Record<string, any> = {
      ":pk": PK,
    };

    if (options?.skBeginsWith) {
      expressionAttributeValues[":sk"] = options.skBeginsWith;
    }

    const result = await this.client.send(
      new (await import("@aws-sdk/lib-dynamodb")).QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: options?.limit,
        ConsistentRead: options?.consistentRead,
        ProjectionExpression: options?.projectionExpression,
      }),
    );

    return result.Items || [];
  }

  /**
   * Update item with specified attributes
   */
  async update(
    PK: string,
    SK: string,
    updates: Record<string, any>,
    options?: {
      condition?: string;
      attributeNames?: Record<string, string>;
    },
  ) {
    const updateExpressionParts: string[] = [];
    const expressionAttributeNames: Record<string, string> = { ...(options?.attributeNames || {}) };
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value], index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;

      updateExpressionParts.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    });

    const updateExpression = `SET ${updateExpressionParts.join(", ")}`;

    await this.client.send(
      new (await import("@aws-sdk/lib-dynamodb")).UpdateCommand({
        TableName: this.tableName,
        Key: { PK, SK },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: options?.condition,
      }),
    );

    return { PK, SK, ...updates };
  }

  /**
   * Delete item by key
   */
  async delete(PK: string, SK: string, options?: { condition?: string }) {
    await this.client.send(
      new (await import("@aws-sdk/lib-dynamodb")).DeleteCommand({
        TableName: this.tableName,
        Key: { PK, SK },
        ConditionExpression: options?.condition,
      }),
    );
    return true;
  }

  /**
   * Perform transactional write operations
   */
  async transactWrite(operations: any[]) {
    const result = await this.client.send(
      new (await import("@aws-sdk/client-dynamodb")).TransactWriteItemsCommand({
        TransactItems: operations,
      }),
    );
    return result;
  }
}

/**
 * DynamoDB utilities for common patterns
 */
export class DynamoDBUtils {
  /**
   * Generate TTL timestamp for DynamoDB items
   */
  static getTTL(daysFromNow: number = 30): number {
    return Math.floor((Date.now() + daysFromNow * 24 * 60 * 60 * 1000) / 1000);
  }

  /**
   * Check if an error is a conditional check failure
   */
  static isConditionalCheckFailed(error: any): boolean {
    return error.name === "ConditionalCheckFailedException";
  }

  /**
   * Create a pagination token for query results
   */
  static createPaginationToken(lastEvaluatedKey?: Record<string, any>): string | undefined {
    if (!lastEvaluatedKey) return undefined;
    return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64");
  }

  /**
   * Decode pagination token
   */
  static decodePaginationToken(token: string): Record<string, any> | undefined {
    try {
      return JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    } catch {
      return undefined;
    }
  }
}

export default DynamoDBFactory;
