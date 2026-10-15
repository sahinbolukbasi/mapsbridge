import { verifiedUserId } from "../shared/auth";
/**
 * MapsBridge Marketplace Domain — Lambda handler
 * Routes: GET/POST /marketplace/guides, GET /marketplace/guides/{id}
 *         POST /marketplace/guides/{id}/purchase
 *         GET /marketplace/guides/{id}/download (pre-signed URL)
 *         POST /marketplace/blogs, GET /marketplace/blogs, GET /marketplace/blogs/{id}
 *
 * Pre-signed URL Generation (Requirement #3):
 *   After validating a user's purchase (Stripe payment_intent.succeeded),
 *   this endpoint generates a time-limited S3 pre-signed URL for the guide PDF.
 *   URL TTL: 900 seconds (15 min) — configurable via PRESIGN_URL_TTL_SECONDS env var.
 *
 * Architecture:
 *   Guide files are stored in the private S3 bucket (guides-bucket).
 *   Purchase records are in DynamoDB.
 *   Pre-signed URLs use AWS SDK v3 @aws-sdk/s3-presigned-post.
 */

import type { ApiGatewayEvent } from "../shared/http";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  notFound,
  forbidden,
  serverError,
  handlePreflight,
  extractBearerToken,
  parseBody,
} from "../shared/http";
import { Router } from "../shared/router";

const router = new Router();

router.add("GET /marketplace/guides", handleListGuides);
router.add("GET /marketplace/guides/{id}", handleGetGuide);
router.add("POST /marketplace/guides", handleCreateGuide);
router.add("POST /marketplace/guides/{id}/purchase", handlePurchaseGuide);
router.add("GET /marketplace/guides/{id}/download", handleDownloadGuide);
router.add("POST /marketplace/blogs", handleCreateBlog);
router.add("GET /marketplace/blogs", handleListBlogs);
router.add("GET /marketplace/blogs/{id}", handleGetBlog);

export const handler = async (event: ApiGatewayEvent) => {
  try {
    return await router.dispatch(event);
  } catch (err) {
    console.error(`[Marketplace] Error:`, err);
    return serverError();
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function getTableName(): string {
  return process.env.DYNAMODB_TABLE || `adreskopru-${process.env.ENVIRONMENT}-data`;
}

async function getDdb() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  return new DynamoDBClient({ region: process.env.AWS_REGION });
}

// ─── List Guides (public marketplace) ─────────────────────────────────────
async function handleListGuides(event: ApiGatewayEvent) {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const limit = Math.min(Number(event.queryStringParameters?.limit) || 20, 100);
  const category = event.queryStringParameters?.category;

  const result = await ddb.send(
    new ScanCommand({
      TableName: getTableName(),
      FilterExpression: category
        ? "begins_with(PK, :pk) AND category = :cat"
        : "begins_with(PK, :pk)",
      ExpressionAttributeValues: category
        ? { ":pk": { S: "GUIDE#" }, ":cat": { S: category } }
        : { ":pk": { S: "GUIDE#" } },
      Limit: limit,
    }),
  );

  const guides = (result.Items || []).map((i) => {
    const item = unmarshall(i);
    // Don't expose file path in listing
    const { filePath, ...safe } = item;
    return safe;
  });

  return ok({ guides, count: guides.length });
}

// ─── Get Guide Details ────────────────────────────────────────────────────
async function handleGetGuide(event: ApiGatewayEvent) {
  const guideId = event.pathParameters?.id;
  if (!guideId) return badRequest("Rehber ID gerekli.");

  const { DynamoDBClient, GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const result = await ddb.send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: { PK: { S: `GUIDE#${guideId}` }, SK: { S: "META" } },
    }),
  );

  if (!result.Item) return notFound("Rehber bulunamadı.");
  const item = unmarshall(result.Item);
  const { filePath, ...safe } = item;
  return ok(safe);
}

// ─── Create Guide (seller upload) ─────────────────────────────────────────
async function handleCreateGuide(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const body = parseBody<{
    title?: string;
    description?: string;
    price?: number;
    category?: string;
    fileContent?: string;
    fileName?: string;
  }>(event);
  if (!body?.title || body.price === undefined) return badRequest("Başlık ve fiyat zorunludur.");

  const guideId = crypto.randomUUID();
  const now = new Date().toISOString();
  const guidesBucket = process.env.GUIDES_BUCKET || "";
  const fileKey = `guides/${userId}/${guideId}/${body.fileName || "guide.pdf"}`;

  const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  // Store guide metadata
  await ddb.send(
    new PutItemCommand({
      TableName: getTableName(),
      Item: marshall({
        PK: `GUIDE#${guideId}`,
        SK: "META",
        guideId,
        title: body.title.slice(0, 200),
        description: (body.description || "").slice(0, 2000),
        price: Math.round(body.price * 100), // store in cents
        currency: "try",
        category: body.category || "general",
        sellerId: userId,
        filePath: fileKey,
        createdAt: now,
        updatedAt: now,
        purchaseCount: 0,
      }),
    }),
  );

  // Upload file to S3 if provided
  if (body.fileContent) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({ region: process.env.AWS_REGION });
    const fileBuffer = Buffer.from(body.fileContent, "base64");

    await s3.send(
      new PutObjectCommand({
        Bucket: guidesBucket,
        Key: fileKey,
        Body: fileBuffer,
        ContentType: "application/pdf",
      }),
    );
  }

  return created({ guideId, title: body.title });
}

// ─── Purchase Guide ───────────────────────────────────────────────────────
async function handlePurchaseGuide(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  // The old endpoint accepted any paymentIntentId as proof and issued downloads.
  // Guide commerce is disabled until a server-owned order + verified fulfillment path is available.
  return {
    statusCode: 503,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ error: "Rehber satın alma servisi henüz kullanıma açık değil." }),
  };
}

// ─── Download Guide (Pre-signed URL) — Requirement #3 ────────────────────
async function handleDownloadGuide(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const guideId = event.pathParameters?.id;
  if (!guideId) return badRequest("Rehber ID gerekli.");

  const { DynamoDBClient, GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall, unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  // 1. Verify purchase
  const purchaseResult = await ddb.send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: marshall({ PK: `PURCHASE#${userId}`, SK: `GUIDE#${guideId}` }),
    }),
  );

  if (!purchaseResult.Item || unmarshall(purchaseResult.Item).verifiedPaymentVersion !== 1) {
    return forbidden("Bu rehberi satın almadınız.");
  }

  // 2. Get guide metadata for file path
  const guideResult = await ddb.send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: marshall({ PK: `GUIDE#${guideId}`, SK: "META" }),
    }),
  );

  if (!guideResult.Item) return notFound("Rehber bulunamadı.");
  const guide = unmarshall(guideResult.Item);
  const fileKey = guide.filePath;
  if (!fileKey) return notFound("Dosya bulunamadı.");

  // 3. Generate pre-signed URL
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const s3 = new S3Client({ region: process.env.AWS_REGION });
  const ttlSeconds = Math.min(Number(process.env.PRESIGN_URL_TTL_SECONDS) || 900, 3600); // max 1h

  const command = new GetObjectCommand({
    Bucket: process.env.GUIDES_BUCKET || "",
    Key: fileKey,
    ResponseContentDisposition: `attachment; filename="${guide.title.replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ\s-]/gi, "")}.pdf"`,
    ResponseContentType: "application/pdf",
  });

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: ttlSeconds });

  // 4. Fire analytics event
  try {
    const { FirehoseClient, PutRecordCommand } = await import("@aws-sdk/client-firehose");
    const firehose = new FirehoseClient({ region: process.env.AWS_REGION });
    await firehose.send(
      new PutRecordCommand({
        DeliveryStreamName: process.env.FIREHOSE_STREAM || "",
        Record: {
          Data: Buffer.from(
            JSON.stringify({
              userId,
              action: "guide_download",
              guideId,
              timestamp: Date.now(),
              metadata: JSON.stringify({ fileKey }),
            }) + "\n",
          ),
        },
      }),
    );
  } catch {
    // Non-critical
  }

  return ok({
    url: presignedUrl,
    expiresIn: ttlSeconds,
    fileName: `${guide.title}.pdf`,
  });
}

// ─── Blog CRUD ────────────────────────────────────────────────────────────
async function handleCreateBlog(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const body = parseBody<{ title?: string; content?: string; tags?: string[] }>(event);
  if (!body?.title || !body?.content) return badRequest("Başlık ve içerik zorunludur.");

  const blogId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  await ddb.send(
    new PutItemCommand({
      TableName: getTableName(),
      Item: marshall({
        PK: `BLOG#${blogId}`,
        SK: "META",
        blogId,
        title: body.title.slice(0, 200),
        content: body.content.slice(0, 50000),
        tags: (body.tags || []).slice(0, 10),
        authorId: userId,
        createdAt: now,
        updatedAt: now,
        published: true,
      }),
    }),
  );

  return created({ blogId, title: body.title });
}

async function handleListBlogs(event: ApiGatewayEvent) {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const limit = Math.min(Number(event.queryStringParameters?.limit) || 20, 100);
  const tag = event.queryStringParameters?.tag;

  const result = await ddb.send(
    new ScanCommand({
      TableName: getTableName(),
      FilterExpression: tag
        ? "begins_with(PK, :pk) AND contains(tags, :tag)"
        : "begins_with(PK, :pk)",
      ExpressionAttributeValues: tag
        ? { ":pk": { S: "BLOG#" }, ":tag": { S: tag } }
        : { ":pk": { S: "BLOG#" } },
      Limit: limit,
    }),
  );

  const blogs = (result.Items || []).map((i) => {
    const item = unmarshall(i);
    // Truncate content for listing
    if (item.content && item.content.length > 300) {
      item.content = item.content.slice(0, 300) + "...";
    }
    return item;
  });

  return ok({ blogs, count: blogs.length });
}

async function handleGetBlog(event: ApiGatewayEvent) {
  const blogId = event.pathParameters?.id;
  if (!blogId) return badRequest("Blog ID gerekli.");

  const { DynamoDBClient, GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const result = await ddb.send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: { PK: { S: `BLOG#${blogId}` }, SK: { S: "META" } },
    }),
  );

  if (!result.Item) return notFound("Blog yazısı bulunamadı.");
  return ok(unmarshall(result.Item));
}
