import { createTrainingJob } from "../../../../apps/web/server/ai/training-outbox";

// Lambda streaming global — only available in Lambda runtime
declare global {
  // eslint-disable-next-line no-var
  var awslambda:
    | {
        streamifyResponse: (
          fn: (
            event: Event,
            responseStream: NodeJS.WritableStream,
            context: unknown,
          ) => Promise<void>,
        ) => unknown;
        HttpResponseStream: {
          from: (
            stream: NodeJS.WritableStream,
            init: { statusCode: number; headers: Record<string, string> },
          ) => NodeJS.WritableStream;
        };
      }
    | undefined;
}
import {
  activateAIRequestMeter,
  withAIRequestMeter,
  requestCostSummary,
} from "../shared/ai-finops";
import { publishAIRuntime, readAIControl, recordAIOperation } from "../shared/ai-operations";
import { runMultiAgentSupervisor } from "../../../../apps/web/app/lib/ai/supervisor";
import { getVerifiedUser } from "../shared/auth";
import {
  BillingError,
  initializeTrial,
  authorizeAI,
  reserveAI,
  finishAI,
  wallet,
  read,
  forgetAIPreferences,
  aiUsage,
} from "../billing/store";
import { sanitizePreferences } from "../../../../apps/web/app/lib/ai/preferences";
import type { ConversationState } from "../../../../apps/web/app/lib/ai/planning";
import {
  buildPersonalContext,
  normalizeRequest,
} from "../../../../apps/web/server/ai/context-builder";
import {
  memoryTable,
  changeMemory,
  writeJob,
  getMemorySettings,
} from "../../../../apps/web/server/ai/memory-service";
import { createHash } from "node:crypto";
import { jsonResponse } from "../shared/http";

interface Event {
  body?: string;
  isBase64Encoded?: boolean;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  rawQueryString?: string;
  requestContext?: { http?: { method?: string; path?: string } };
}
const reply = jsonResponse;
const resolveUser = getVerifiedUser;

function getAuthHeader(headers?: Record<string, string>): string | undefined {
  if (!headers) return undefined;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "authorization") return v;
  }
  return undefined;
}

export async function handler(event: Event) {
  return withAIRequestMeter(() => handleRequest(event));
}

async function handleRequest(event: Event) {
  const method = event.requestContext?.http?.method;
  if (method === "OPTIONS") return reply(204, {});
  if (event.requestContext?.http?.path === "/health" && method === "GET")
    return reply(200, { status: "ok", service: "ai", timestamp: new Date().toISOString() });
  const authorization = getAuthHeader(event.headers);
  if (method === "GET") {
    const user = await resolveUser(
      authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined,
    );
    if (!user) return reply(401, { error: "Lütfen giriş yapın." });
    try {
      if (user.emailVerified) await initializeTrial(user.sub);
      const queryParams = event.queryStringParameters || {};
      const convId = queryParams.conversationId;
      if (convId && /^[a-zA-Z0-9_-]{16,100}$/.test(convId)) {
        const stored = await read(`USER#${user.sub}`, `AI_CHAT#${convId}`);
        return reply(200, {
          conversationId: convId,
          conversation: stored || null,
          ...(await wallet(user.sub)),
          configured: !!process.env.BEDROCK_MODEL_ID,
          usage: await aiUsage(user.sub),
          preferences: sanitizePreferences(await read(`USER#${user.sub}`, "AI_PREFERENCES")),
        });
      }
      const latest = await read(`USER#${user.sub}`, "AI_LATEST");
      let latestConversation = null;
      if (latest?.conversationId) {
        latestConversation = await read(`USER#${user.sub}`, `AI_CHAT#${latest.conversationId}`);
      }
      return reply(200, {
        latestConversationId: latest?.conversationId || null,
        conversation: latestConversation || null,
        ...(await wallet(user.sub)),
        configured: !!process.env.BEDROCK_MODEL_ID,
        usage: await aiUsage(user.sub),
        preferences: sanitizePreferences(await read(`USER#${user.sub}`, "AI_PREFERENCES")),
      });
    } catch {
      return reply(503, { error: "Kredi bilgisi alınamadı." });
    }
  }
  if (method !== "POST") return reply(405, { error: "Yöntem desteklenmiyor." });
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Lütfen giriş yapın." });
  if ((event.body?.length || 0) > 16000) return reply(413, { error: "İstek çok uzun." });
  let body;
  try {
    body = JSON.parse(
      event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64").toString()
        : event.body || "{}",
    );
  } catch {
    return reply(400, { error: "Geçersiz istek." });
  }
  if (
    body?.action !== "forgetPreferences" &&
    (!body || typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 2000)
  )
    return reply(400, { error: "İsteğinizi 1–2000 karakter arasında yazın." });
  if (
    body.conversationId !== undefined &&
    (typeof body.conversationId !== "string" ||
      !/^[a-zA-Z0-9_-]{16,100}$/.test(body.conversationId))
  )
    return reply(400, { error: "Geçersiz sohbet kimliği." });
  if (body.trainingConsent !== undefined && typeof body.trainingConsent !== "boolean")
    return reply(400, { error: "Eğitim verisi izni geçersiz." });
  const history = body.conversationHistory || [];
  if (
    !Array.isArray(history) ||
    history.length > 6 ||
    history.some(
      (m: any) =>
        !m ||
        !["user", "assistant"].includes(m.role) ||
        typeof m.content !== "string" ||
        m.content.length > 1500,
    )
  )
    return reply(400, { error: "Konuşma geçmişi geçersiz." });
  const user = await resolveUser(authorization.slice(7));
  if (!user) return reply(401, { error: "Oturum doğrulanamadı." });
  try {
    if (user.emailVerified) await initializeTrial(user.sub);
  } catch (err) {
    console.error("[ai] initializeTrial failed:", (err as Error).message);
  }
  if (!user.emailVerified)
    return reply(403, { error: "AI kullanmadan önce e-postanızı doğrulayın." });
  if (
    body.action === "forgetPreferences" ||
    /^(tercihlerimi unut|seyahat tercihlerimi sil)[.!]?$/iu.test(
      body.prompt?.split("\nTercihler:")[0].trim() || "",
    )
  ) {
    try {
      if (memoryTable()) await changeMemory(user.sub, { reset: true });
      else await forgetAIPreferences(user.sub);
      return reply(200, {
        success: true,
        orchestratorSummary: "Kayıtlı seyahat tercihlerin silindi.",
        preferences: {},
        agentsInvolved: [],
        cost: 0,
      });
    } catch {
      return reply(503, { error: "Tercihler silinemedi." });
    }
  }
  if (!process.env.BEDROCK_MODEL_ID) return reply(503, { error: "AI servisi yapılandırılmadı." });
  let reservation: Awaited<ReturnType<typeof reserveAI>> | undefined;
  let completed = false;
  let operationKey: string | undefined;
  const operationStarted = Date.now();
  try {
    await publishAIRuntime();
    const aiControl = await readAIControl();
    if (!aiControl.enabled)
      return reply(503, { error: "AI asistanı yönetici tarafından kapatıldı." });
    let normalized;
    try {
      normalized = normalizeRequest(body);
    } catch {
      return reply(400, { error: "Geçersiz konum." });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
    if (typeof body.requestId !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(body.requestId))
      return reply(400, { error: "Geçerli işlem kimliği gerekli." });
    const settings = await getMemorySettings(user.sub);
    const preferences = sanitizePreferences(await read(`USER#${user.sub}`, "AI_PREFERENCES"));
    const storedConversation = body.conversationId
      ? await read(`USER#${user.sub}`, `AI_CHAT#${body.conversationId}`)
      : null;
    const personal = await buildPersonalContext(
      user.sub,
      {
        prompt: normalized.prompt,
        routeMode: normalized.routeMode,
        preferences,
        conversationHistory: history,
        conversationState: (storedConversation as ConversationState | null) || undefined,
        tripManifestoMarkdown: normalized.tripManifestoMarkdown || undefined,
        userLocation: normalized.userLocation || undefined,
      },
      settings,
    );
    const previous = await read(`USER#${user.sub}`, `AI#${body.requestId}`);
    if (
      previous?.response &&
      personal.settings.erasedAt &&
      previous.response.memoryGeneration !== personal.settings.generation
    )
      return reply(409, { error: "Bu işlem silinen geçmişe ait. Yeni işlem kimliği kullanın." });
    if (
      previous?.state === "succeeded" &&
      previous.fingerprint === fingerprint &&
      previous.response
    ) {
      try {
        return reply(200, {
          ...previous.response,
          replayed: true,
          billing: { cost: 0, ...(await wallet(user.sub)) },
        });
      } catch {
        return reply(200, { ...previous.response, replayed: true });
      }
    }
    if (previous)
      return reply(409, {
        error:
          previous.state === "reserved"
            ? "İstek işleniyor. Aynı isteği tekrar kontrol edin."
            : "Bu işlem kimliği daha önce kullanıldı.",
        code:
          previous.state === "reserved" && previous.fingerprint === fingerprint
            ? "REQUEST_IN_PROGRESS"
            : "REQUEST_ALREADY_USED",
      });
    const config = await read("SYSTEM#CONFIG", "META");
    if (config?.maintenanceMode)
      return reply(503, {
        error: config.maintenanceMessage || "Bakım sırasında AI geçici olarak kapalı.",
      });
    await initializeTrial(user.sub);
    reservation = await reserveAI(user.sub, body.requestId, fingerprint, 0);
    activateAIRequestMeter();
    operationKey = await recordAIOperation({ kind: "request", status: "running" });
    const result = await runMultiAgentSupervisor(personal.payload, (cost) =>
      authorizeAI(reservation!, cost),
    );

    if (result.provider !== "aws_bedrock")
      throw new Error("Provider did not produce a real result");
    const { preferenceUpdates, conversationState, ...publicResult } = result;
    const actualCost =
      result.responseMode === "clarify"
        ? 0
        : (reservation?.cost ?? (result.responseMode === "chat" ? 1 : 5));
    const updates =
      memoryTable() && !personal.settings.enabled ? {} : sanitizePreferences(preferenceUpdates);
    const trainingJob = createTrainingJob({
      consent: normalized.trainingConsent,
      userId: user.sub,
      requestId: body.requestId,
      conversationId: body.conversationId,
      prompt: normalized.prompt,
      result,
    });
    const response = {
      success: true,
      trainingCollection: trainingJob ? "queued_for_review" : "not_collected",
      memoryGeneration: personal.settings.generation,
      ...publicResult,
      preferences: { ...preferences, ...updates },
      cost: actualCost,
    };
    await finishAI(reservation, true, {
      response,
      ...(trainingJob ? { trainingJob } : {}),
      preferences: { ...updates },
      finalCost: actualCost,
      ...(memoryTable()
        ? {
            memory: {
              settings: personal.settings,
              job: writeJob(
                user.sub,
                personal.settings,
                body.requestId,
                body.conversationId || body.requestId,
                updates,
                result.tripContext,
              ),
            },
          }
        : {}),
      ...(body.conversationId && conversationState
        ? {
            conversation: {
              id: body.conversationId,
              expectedVersion: storedConversation?.version || 0,
              value: {
                ...conversationState,
                updatedAt: new Date().toISOString(),
                expiresAt: Math.floor(Date.now() / 1000) + 30 * 86400,
              } as unknown as Record<string, unknown>,
            },
          }
        : {}),
    });
    completed = true;
    await recordAIOperation(
      {
        kind: "request",
        status: "succeeded",
        model: result.modelUsed,
        responseMode: result.responseMode,
        ...requestCostSummary(),
        durationMs: Date.now() - operationStarted,
        agents: (result.agentsInvolved || []).map((a) => ({
          agentId: a.agentId,
          status: a.status,
          durationMs: a.durationMs,
        })),
      },
      operationKey,
    );
    try {
      return reply(200, {
        ...response,
        billing: { cost: actualCost, ...(await wallet(user.sub)) },
      });
    } catch {
      return reply(200, response);
    }
  } catch (err) {
    if (operationKey)
      await recordAIOperation(
        {
          kind: "request",
          status: "failed",
          ...requestCostSummary(),
          durationMs: Date.now() - operationStarted,
          errorCode: "AI_RESULT_UNCONFIRMED",
        },
        operationKey,
      );
    console.error("AI handler error", err instanceof Error ? err.name : "Error");
    if (reservation && !completed) {
      try {
        await finishAI(reservation, false);
      } catch (err) {
        console.error("[ai] finishAI rollback failed:", (err as Error).message);
      }
    }
    if (err instanceof BillingError)
      return reply(err.status, { error: err.message, code: err.code });
    return reply(503, {
      error: "Yapay zeka yanıtı doğrulanamadı. Aynı isteği tekrar kontrol edin.",
      code: "AI_RESULT_UNCONFIRMED",
    });
  }
}

// ─── Streaming handler (Lambda Function URL with InvokeMode=RESPONSE_STREAM) ─

function writeSse(stream: NodeJS.WritableStream, type: string, data: Record<string, unknown>) {
  stream.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

async function handleStreamRequest(
  event: Event,
  responseStream: NodeJS.WritableStream,
): Promise<void> {
  const meta =
    global.awslambda?.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type,authorization",
      },
    }) ?? responseStream;

  try {
    const method = event.requestContext?.http?.method;
    if (method === "OPTIONS") {
      writeSse(meta, "ok", {});
      meta.end();
      return;
    }
    if (method !== "POST") {
      writeSse(meta, "error", { message: "Yöntem desteklenmiyor.", code: "METHOD_NOT_ALLOWED" });
      meta.end();
      return;
    }

    const authorization = getAuthHeader(event.headers);
    if (!authorization?.startsWith("Bearer ")) {
      writeSse(meta, "error", { message: "Lütfen giriş yapın.", code: "UNAUTHORIZED" });
      meta.end();
      return;
    }

    if ((event.body?.length || 0) > 16000) {
      writeSse(meta, "error", { message: "İstek çok uzun.", code: "PAYLOAD_TOO_LARGE" });
      meta.end();
      return;
    }
    let body: any;
    try {
      body = JSON.parse(
        event.isBase64Encoded
          ? Buffer.from(event.body || "", "base64").toString()
          : event.body || "{}",
      );
    } catch {
      writeSse(meta, "error", { message: "Geçersiz istek.", code: "BAD_REQUEST" });
      meta.end();
      return;
    }
    if (
      !body?.prompt ||
      typeof body.prompt !== "string" ||
      !body.prompt.trim() ||
      body.prompt.length > 2000
    ) {
      writeSse(meta, "error", {
        message: "İsteğinizi 1–2000 karakter arasında yazın.",
        code: "BAD_REQUEST",
      });
      meta.end();
      return;
    }

    writeSse(meta, "status", { phase: "auth", message: "Kimlik doğrulanıyor..." });
    const user = await resolveUser(authorization.slice(7));
    if (!user) {
      writeSse(meta, "error", { message: "Oturum doğrulanamadı.", code: "UNAUTHORIZED" });
      meta.end();
      return;
    }
    if (!user.emailVerified) {
      writeSse(meta, "error", { message: "E-postanızı doğrulayın.", code: "EMAIL_NOT_VERIFIED" });
      meta.end();
      return;
    }
    if (!process.env.BEDROCK_MODEL_ID) {
      writeSse(meta, "error", { message: "AI servisi yapılandırılmadı.", code: "NOT_CONFIGURED" });
      meta.end();
      return;
    }

    await (withAIRequestMeter as (fn: () => Promise<void>) => Promise<void>)(async () => {
      await publishAIRuntime();
      const aiControl = await readAIControl();
      if (!aiControl.enabled) {
        writeSse(meta, "error", {
          message: "AI asistanı yönetici tarafından kapatıldı.",
          code: "AI_DISABLED",
        });
        return;
      }

      // Validate requestId for idempotency (same as non-streaming path)
      if (typeof body.requestId !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(body.requestId)) {
        writeSse(meta, "error", { message: "Geçerli işlem kimliği gerekli.", code: "BAD_REQUEST" });
        return;
      }
      if (
        body.conversationId !== undefined &&
        (typeof body.conversationId !== "string" ||
          !/^[a-zA-Z0-9_-]{16,100}$/.test(body.conversationId))
      ) {
        writeSse(meta, "error", { message: "Geçersiz sohbet kimliği.", code: "BAD_REQUEST" });
        return;
      }

      try {
        if (user.emailVerified) await initializeTrial(user.sub);
      } catch (err) {
        console.error("[ai] initializeTrial failed:", (err as Error).message);
      }

      writeSse(meta, "status", { phase: "intake", message: "İstek değerlendiriliyor..." });
      let normalized;
      try {
        normalized = normalizeRequest(body);
      } catch {
        writeSse(meta, "error", { message: "Geçersiz konum.", code: "BAD_REQUEST" });
        return;
      }

      const settings = await getMemorySettings(user.sub);
      const preferences = sanitizePreferences(await read(`USER#${user.sub}`, "AI_PREFERENCES"));
      const storedConversation = body.conversationId
        ? await read(`USER#${user.sub}`, `AI_CHAT#${body.conversationId}`)
        : null;
      const personal = await buildPersonalContext(
        user.sub,
        {
          prompt: normalized.prompt,
          routeMode: normalized.routeMode,
          preferences,
          conversationHistory: body.conversationHistory || [],
          conversationState: (storedConversation as ConversationState | null) || undefined,
          tripManifestoMarkdown: normalized.tripManifestoMarkdown || undefined,
          userLocation: normalized.userLocation || undefined,
        },
        settings,
      );

      // Idempotency: check if this requestId already completed
      const previous = await read(`USER#${user.sub}`, `AI#${body.requestId}`);
      if (previous?.state === "succeeded" && previous.response) {
        writeSse(meta, "complete", { result: { ...previous.response, replayed: true } });
        return;
      }
      if (previous?.state === "reserved") {
        writeSse(meta, "error", { message: "İstek işleniyor.", code: "REQUEST_IN_PROGRESS" });
        return;
      }

      // Reserve credits atomically before generation
      let reservation: Awaited<ReturnType<typeof reserveAI>>;
      try {
        reservation = await reserveAI(user.sub, body.requestId, body.prompt, 0);
      } catch (err) {
        if (err instanceof BillingError) {
          writeSse(meta, "error", { message: err.message, code: err.code });
          return;
        }
        throw err;
      }

      writeSse(meta, "status", { phase: "research", message: "Araştırılıyor..." });
      activateAIRequestMeter();
      const operationKey = await recordAIOperation({ kind: "request", status: "running" });
      const operationStarted = Date.now();
      let completed = false;

      try {
        const result = await runMultiAgentSupervisor(
          personal.payload,
          async (cost) => {
            await authorizeAI(reservation, cost);
          },
          (text: string) => {
            writeSse(meta, "token", { text });
          },
        );

        const { preferenceUpdates, conversationState, ...publicResult } = result;
        const actualCost =
          result.responseMode === "clarify" ? 0 : result.responseMode === "chat" ? 1 : 5;
        const updates =
          memoryTable() && !personal.settings.enabled ? {} : sanitizePreferences(preferenceUpdates);
        const trainingJob = createTrainingJob({
          consent: normalized.trainingConsent,
          userId: user.sub,
          requestId: body.requestId,
          conversationId: body.conversationId,
          prompt: normalized.prompt,
          result,
        });
        const response = {
          success: true,
          trainingCollection: trainingJob ? "queued_for_review" : "not_collected",
          memoryGeneration: personal.settings.generation,
          ...publicResult,
          preferences: { ...preferences, ...updates },
          cost: actualCost,
        };

        await finishAI(reservation, true, {
          response,
          ...(trainingJob ? { trainingJob } : {}),
          preferences: updates as Record<string, unknown>,
          finalCost: actualCost,
          ...(memoryTable()
            ? {
                memory: {
                  settings: personal.settings,
                  job: writeJob(
                    user.sub,
                    personal.settings,
                    body.requestId,
                    body.conversationId || body.requestId,
                    updates,
                    result.tripContext,
                  ),
                },
              }
            : {}),
          ...(body.conversationId && conversationState
            ? {
                conversation: {
                  id: body.conversationId,
                  expectedVersion: storedConversation?.version || 0,
                  value: {
                    ...conversationState,
                    updatedAt: new Date().toISOString(),
                    expiresAt: Math.floor(Date.now() / 1000) + 30 * 86400,
                  } as unknown as Record<string, unknown>,
                },
              }
            : {}),
        });
        completed = true;

        await recordAIOperation(
          {
            kind: "request",
            status: "succeeded",
            model: result.modelUsed,
            responseMode: result.responseMode,
            ...requestCostSummary(),
            durationMs: Date.now() - operationStarted,
            agents: (result.agentsInvolved || []).map((a) => ({
              agentId: a.agentId,
              status: a.status,
              durationMs: a.durationMs,
            })),
          },
          operationKey,
        );
        writeSse(meta, "complete", { result: response });
      } catch (err) {
        if (!completed) {
          try {
            await finishAI(reservation, false);
          } catch (err) {
            console.error("[ai] finishAI rollback failed:", (err as Error).message);
          }
        }
        throw err;
      }
    });
  } catch (err) {
    console.error("Stream handler error", err instanceof Error ? err.name : "Error");
    try {
      writeSse(meta, "error", { message: "Bir hata oluştu.", code: "SERVER_ERROR" });
    } catch (err) {
      console.error("[ai] writeSse error failed:", (err as Error).message);
    }
  } finally {
    try {
      (meta as any).end();
    } catch (err) {
      console.error("[ai] stream end failed:", (err as Error).message);
    }
  }
}

export const streamHandler = global.awslambda?.streamifyResponse(handleStreamRequest) ?? handler;
