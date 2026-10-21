import { createTrainingJob } from "./ai/training-outbox";
import {
  activateAIRequestMeter,
  withAIRequestMeter,
  requestCostSummary,
} from "../../../infra/lambda/src/shared/ai-finops";
import {
  publishAIRuntime,
  readAIControl,
  recordAIOperation,
} from "../../../infra/lambda/src/shared/ai-operations";
import { runMultiAgentSupervisor } from "../app/lib/ai/supervisor";
import { getVerifiedUser } from "../../../infra/lambda/src/shared/auth";
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
} from "../../../infra/lambda/src/billing/store";
import { sanitizePreferences } from "../app/lib/ai/preferences";
import type { ConversationState } from "../app/lib/ai/planning";
import { buildPersonalContext, normalizeRequest } from "./ai/context-builder";
import { memoryTable, changeMemory, writeJob, getMemorySettings } from "./ai/memory-service";
import { createHash } from "node:crypto";

interface Event {
  body?: string;
  isBase64Encoded?: boolean;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  rawQueryString?: string;
  requestContext?: { http?: { method?: string } };
}
const reply = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body),
});
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
      (m: { role: unknown; content: unknown }) =>
        !m ||
        !["user", "assistant"].includes(m.role as string) ||
        typeof m.content !== "string" ||
        m.content.length > 1500,
    )
  )
    return reply(400, { error: "Konuşma geçmişi geçersiz." });
  const user = await resolveUser(authorization.slice(7));
  if (!user) return reply(401, { error: "Oturum doğrulanamadı." });
  try {
    if (user.emailVerified) await initializeTrial(user.sub);
  } catch {}
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
    // Wallet outages must never hide an already committed, charged answer.
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
      } catch {
        /* Retain reserved receipt for reconciliation; never duplicate a refund. */
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
