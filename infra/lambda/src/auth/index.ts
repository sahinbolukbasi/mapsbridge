import { verifiedUserId } from "../shared/auth";
/**
 * MapsBridge Auth Domain — Lambda handler
 * Routes: POST /auth/reset-password, POST /auth/change-password, POST /auth/refresh
 *         POST /profile/publish, POST /profile/unpublish, GET /profiles/{username}
 */

import type { ApiGatewayEvent } from "../shared/http";
import {
  ok,
  badRequest,
  forbidden,
  unauthorized,
  notFound,
  serverError,
  handlePreflight,
  extractBearerToken,
  parseBody,
} from "../shared/http";
import { Router } from "../shared/router";

const router = new Router();

router.add("POST /auth/reset-password", handleResetPassword);
router.add("POST /auth/change-password", handleChangePassword);
router.add("POST /auth/refresh", handleRefreshToken);
router.add("POST /profile/publish", handlePublishProfile);
router.add("POST /profile/unpublish", handleUnpublishProfile);
router.add("GET /profiles/{username}", handleGetProfile);

export const handler = async (event: ApiGatewayEvent) => {
  try {
    return await router.dispatch(event);
  } catch (err) {
    console.error(`[Auth] Error:`, err);
    return serverError();
  }
};

// ─── Reset Password (Forgot Password flow) ────────────────────────────────
async function handleResetPassword(event: ApiGatewayEvent) {
  const body = parseBody<{ email?: string; code?: string; newPassword?: string }>(event);
  if (!body?.email || !body?.newPassword) {
    return badRequest("E-posta ve yeni şifre zorunludur.");
  }

  const email = body.email.trim().toLowerCase();
  const password = body.newPassword;

  if (password.length < 12) {
    return badRequest("Şifre en az 12 karakter olmalıdır.");
  }

  const { CognitoIdentityProviderClient, ConfirmForgotPasswordCommand } =
    await import("@aws-sdk/client-cognito-identity-provider");
  const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

  try {
    await client.send(
      new ConfirmForgotPasswordCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: email,
        ConfirmationCode: body.code,
        Password: password,
      }),
    );
    return ok({ status: "success" });
  } catch (err: any) {
    return badRequest("Kod hatalı veya süresi dolmuş. Yeni kod isteyin.");
  }
}

// ─── Change Password (Authenticated User) ─────────────────────────────────
async function handleChangePassword(event: ApiGatewayEvent) {
  const token =
    extractBearerToken(event) || parseBody<{ accessToken?: string }>(event)?.accessToken;
  if (!token) return unauthorized();

  const body = parseBody<{ newPassword?: string }>(event);
  if (!body?.newPassword || body.newPassword.length < 12) {
    return badRequest("Yeni şifre en az 12 karakter olmalıdır.");
  }

  if (!(await verifiedUserId(token))) return unauthorized();

  const { CognitoIdentityProviderClient, ChangePasswordCommand } =
    await import("@aws-sdk/client-cognito-identity-provider");
  const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

  try {
    await client.send(
      new ChangePasswordCommand({
        AccessToken: token,
        PreviousPassword: "", // Cognito handles this
        ProposedPassword: body.newPassword,
      }),
    );
    return ok({ status: "success", message: "Şifreniz başarıyla değiştirildi." });
  } catch (err: any) {
    return unauthorized("Oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapınız.");
  }
}

// ─── Refresh Token ────────────────────────────────────────────────────────
async function handleRefreshToken(event: ApiGatewayEvent) {
  const body = parseBody<{ refreshToken?: string }>(event);
  if (!body?.refreshToken) return badRequest("Refresh token zorunludur.");

  const { CognitoIdentityProviderClient, InitiateAuthCommand } =
    await import("@aws-sdk/client-cognito-identity-provider");
  const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

  try {
    const result = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthParameters: { REFRESH_TOKEN: body.refreshToken },
      }),
    );

    return ok({
      accessToken: result.AuthenticationResult?.AccessToken,
      idToken: result.AuthenticationResult?.IdToken,
      expiresIn: result.AuthenticationResult?.ExpiresIn,
    });
  } catch {
    return unauthorized("Geçersiz refresh token. Lütfen tekrar giriş yapın.");
  }
}

// ─── Publish Profile ──────────────────────────────────────────────────────
async function handlePublishProfile(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const owner = await verifiedUserId(token);
  if (!owner) return unauthorized();

  const body = parseBody<{ username?: string; profile?: any }>(event);
  if (!body?.username) return badRequest("Kullanıcı adı zorunludur.");

  const username = body.username.toLowerCase();
  if (username.length < 3 || username.length > 30 || !/^[a-z0-9_]+$/.test(username)) {
    return badRequest("Kullanıcı adı 3–30 harf, rakam veya alt çizgi olmalıdır.");
  }

  // Store in DynamoDB (shared table from hosting.tf)
  const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  try {
    // Reserve username
    await ddb.send(
      new PutItemCommand({
        TableName: process.env.DYNAMODB_TABLE || `${process.env.ENVIRONMENT}-data`,
        Item: marshall({
          PK: `OWNER#${owner}`,
          SK: "PUBLIC_PROFILE",
          username,
        }),
        ConditionExpression: "attribute_not_exists(PK) OR #un = :name",
        ExpressionAttributeNames: { "#un": "username" },
        ExpressionAttributeValues: marshall({ ":name": username }),
      }),
    );

    // Publish profile
    const profile = body.profile || {};
    await ddb.send(
      new PutItemCommand({
        TableName: process.env.DYNAMODB_TABLE || `${process.env.ENVIRONMENT}-data`,
        Item: marshall({
          PK: `PROFILE#${username}`,
          SK: "PUBLIC",
          owner,
          published: true,
          profile: {
            firstName: profile.firstName || "Gezgin",
            lastName: profile.lastName || "",
            username,
            visitedCountries: Array.isArray(profile.visitedCountries)
              ? profile.visitedCountries.slice(0, 100)
              : [],
            routes: Array.isArray(profile.routes) ? profile.routes.slice(0, 20) : [],
            bio: profile.bio || "",
            avatar: profile.avatar || "",
          },
        }),
        ConditionExpression: "attribute_not_exists(PK) OR #owner = :owner",
        ExpressionAttributeNames: { "#owner": "owner" },
        ExpressionAttributeValues: marshall({ ":owner": owner }),
      }),
    );

    return ok({ status: "published", username });
  } catch (err: any) {
    if (err.name === "ConditionalCheckFailedException") {
      return badRequest(
        "Profil kaydedilemedi. Önceden yayınladığınız kullanıcı adını kullanın veya farklı bir ad deneyin.",
      );
    }
    throw err;
  }
}

// ─── Unpublish Profile ────────────────────────────────────────────────────
async function handleUnpublishProfile(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const owner = await verifiedUserId(token);
  if (!owner) return unauthorized();

  const body = parseBody<{ username?: string }>(event);
  if (!body?.username) return badRequest("Kullanıcı adı zorunludur.");

  const { DynamoDBClient, UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: process.env.DYNAMODB_TABLE || "",
        Key: marshall({ PK: `PROFILE#${body.username.toLowerCase()}`, SK: "PUBLIC" }),
        UpdateExpression: "SET published = :no",
        ConditionExpression: "#owner = :owner",
        ExpressionAttributeNames: { "#owner": "owner" },
        ExpressionAttributeValues: marshall({ ":owner": owner, ":no": false }),
      }),
    );
    return ok({ status: "unpublished" });
  } catch (err: any) {
    if (err.name === "ConditionalCheckFailedException") {
      return forbidden("Bu profil size ait değil.");
    }
    throw err;
  }
}

// ─── Get Profile ──────────────────────────────────────────────────────────
async function handleGetProfile(event: ApiGatewayEvent) {
  const username = event.pathParameters?.username?.toLowerCase();
  if (!username) return badRequest("Kullanıcı adı gerekli.");

  const { DynamoDBClient, GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const result = await ddb.send(
    new GetItemCommand({
      TableName: process.env.DYNAMODB_TABLE || "",
      Key: { PK: { S: `PROFILE#${username}` }, SK: { S: "PUBLIC" } },
      ConsistentRead: true,
    }),
  );

  if (!result.Item || !result.Item.published?.BOOL) {
    return notFound("Bu profil yayınlanmamış veya yayından kaldırılmış.");
  }

  const item = unmarshall(result.Item);
  return ok(item.profile);
}
