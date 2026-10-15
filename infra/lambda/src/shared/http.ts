/**
 * MapsBridge Lambda shared utilities
 * - API Gateway v2 (HTTP) event typing
 * - Standard response envelope
 * - JWT/Cognito auth helper
 */

export interface ApiGatewayEvent {
  version?: string;
  routeKey?: string;
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
  pathParameters?: Record<string, string | undefined> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext: {
    http: { method: string; path: string; sourceIp: string };
    requestId: string;
    authorizer?: {
      jwt?: { claims?: Record<string, string> };
      lambda?: { [key: string]: unknown };
    };
    connectionId?: string;
    routeKey?: string;
  };
}

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const CORS_HEADERS: Record<string, string> = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "access-control-allow-origin": process.env.ALLOWED_ORIGIN || "*",
  "access-control-allow-headers": "authorization,content-type,idempotency-key,x-api-key",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

/** Standard JSON response envelope with CORS headers */
export function jsonResponse(statusCode: number, body: unknown): ApiResponse {
  return {
    statusCode,
    headers: { ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

export const ok = (body: unknown) => jsonResponse(200, body);
export const created = (body: unknown) => jsonResponse(201, body);
export const badRequest = (msg: string = "Geçersiz istek.") => jsonResponse(400, { error: msg });
export const unauthorized = (msg: string = "Oturum belirteci bulunamadı. Lütfen giriş yapın.") =>
  jsonResponse(401, { error: msg });
export const forbidden = (msg: string = "Bu işlemi yapmaya yetkiniz yok.") =>
  jsonResponse(403, { error: msg });
export const notFound = (msg: string = "Kaynak bulunamadı.") => jsonResponse(404, { error: msg });
export const tooManyRequests = (msg: string = "Günlük token limitiniz doldu.") =>
  jsonResponse(429, { error: msg });
export const serverError = (msg: string = "Sunucu hatası. Lütfen tekrar deneyin.") =>
  jsonResponse(500, { error: msg });

/** OPTIONS preflight responder */
export function handlePreflight(): ApiResponse {
  return { statusCode: 200, headers: { ...CORS_HEADERS }, body: "" };
}

/** Extract Bearer token from Authorization header */
export function extractBearerToken(event: ApiGatewayEvent): string | null {
  const auth = event.headers?.["authorization"] || event.headers?.["Authorization"];
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/** Parse JSON body safely */
export function parseBody<T>(event: ApiGatewayEvent): T | null {
  if (!event.body) return null;
  try {
    return JSON.parse(
      event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body,
    ) as T;
  } catch {
    return null;
  }
}

/** Read SSM Parameter (plaintext or SecureString) */
export async function getSecret(path: string): Promise<string> {
  const { SSMClient, GetParameterCommand } = await import("@aws-sdk/client-ssm");
  const client = new SSMClient({ region: process.env.AWS_REGION || "eu-central-1" });
  const result = await client.send(new GetParameterCommand({ Name: path, WithDecryption: true }));
  return result.Parameter?.Value || "";
}

/**
 * Resolve env var with "secret:" prefix → SSM lookup.
 * e.g. AURORA_WRITER="secret:/mapsbridge/prod/aurora/writer"
 */
export async function resolveEnvSecret(value: string | undefined): Promise<string> {
  if (!value) return "";
  if (value.startsWith("secret:")) {
    return getSecret(value.slice("secret:".length));
  }
  return value;
}

/** Parse JSON from SQS Lambda event */
export interface SqsEvent {
  Records: Array<{
    messageId: string;
    receiptHandle: string;
    body: string;
    attributes: Record<string, string>;
    eventSourceArn: string;
  }>;
}

/** Simple in-memory LRU for connection pools at Lambda init (between invocations) */
export const memoize = <T>(fn: () => Promise<T>) => {
  let cached: T | null = null;
  let inFlight: Promise<T> | null = null;
  return async (): Promise<T> => {
    if (cached) return cached;
    if (!inFlight)
      inFlight = fn().then((v) => {
        cached = v;
        return v;
      });
    return inFlight;
  };
};
