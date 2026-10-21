import { getVerifiedUser } from "../../../infra/lambda/src/shared/auth";
import { read } from "../../../infra/lambda/src/billing/store";
import { sanitizePreferences, preferenceChoices } from "../app/lib/ai/preferences";
import {
  changeMemory,
  deletionStatus,
  getMemorySettings,
  memoryTable,
  retrievePersonalMemory,
} from "./ai/memory-service";

const reply = (statusCode: number, value: unknown) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(value),
});
export async function handler(event: {
  requestContext?: { http?: { method?: string; path?: string } };
  headers?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  rawPath?: string;
}) {
  const method = event.requestContext?.http?.method;
  if (method === "OPTIONS") return reply(204, {});
  const authorization = Object.entries(event.headers || {}).find(
    ([key]) => key.toLowerCase() === "authorization",
  )?.[1];
  const user = await getVerifiedUser(
    typeof authorization === "string" && authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : undefined,
  );
  if (!user) return reply(401, { error: "Oturum doğrulanamadı." });
  if (!memoryTable())
    return reply(503, {
      error: "Kişisel hafıza henüz etkinleştirilmedi.",
      code: "MEMORY_NOT_CONFIGURED",
    });
  const path = event.rawPath || event.requestContext?.http?.path || "";
  try {
    if (method === "GET" && path === "/ai/memory/deletion-status")
      return reply(200, await deletionStatus(user.sub));
    if (method === "GET" && path === "/ai/memory") {
      const settings = await getMemorySettings(user.sub);
      const preferences = sanitizePreferences(await read(`USER#${user.sub}`, "AI_PREFERENCES"));
      const memories = await retrievePersonalMemory(
        user.sub,
        settings,
        "Önceki seyahatler ve seyahat deneyimleri",
      );
      return reply(200, {
        enabled: settings.enabled,
        version: settings.version,
        preferences,
        memories,
        memoriesArePreview: true,
        trainingDataUsage: false,
        deletion: await deletionStatus(user.sub),
      });
    }
    if ((event.body?.length || 0) > 4000) return reply(413, { error: "İstek çok uzun." });
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(
        event.isBase64Encoded
          ? Buffer.from(event.body || "", "base64").toString()
          : event.body || "{}",
      );
    } catch {
      return reply(400, { error: "Geçersiz istek." });
    }
    if (method === "PATCH" && path === "/ai/memory") {
      if (typeof body.enabled !== "boolean")
        return reply(400, { error: "Hafıza tercihi gerekli." });
      await changeMemory(user.sub, { enabled: body.enabled });
      return reply(200, { enabled: body.enabled });
    }
    if (method === "DELETE" && path === "/ai/memory") {
      if (body.scope !== "preferences" && body.scope !== "all")
        return reply(400, { error: "Silme kapsamı gerekli." });
      await changeMemory(user.sub, {
        reset: true,
        enabled: false,
        eraseHistory: body.scope === "all",
      });
      return reply(202, {
        status: "pending",
        message: "Hafıza kullanımı durduruldu. Kayıtlar siliniyor.",
      });
    }
    const key = path.startsWith("/ai/memory/") ? path.slice("/ai/memory/".length) : "";
    if (!Object.hasOwn(preferenceChoices, key)) return reply(404, { error: "Tercih bulunamadı." });
    if (method === "PATCH" || method === "DELETE") {
      const existing = sanitizePreferences(await read(`USER#${user.sub}`, "AI_PREFERENCES"));
      const next: Record<string, unknown> = { ...existing };
      if (method === "DELETE") delete next[key];
      else {
        const clean = sanitizePreferences({ [key]: body.value });
        if (!Object.hasOwn(clean, key)) return reply(400, { error: "Desteklenmeyen tercih." });
        Object.assign(next, clean);
      }
      await changeMemory(user.sub, { preferences: sanitizePreferences(next) });
      return reply(200, {
        preferences: next,
        message: "Tercih güncellendi. Eski çıkarılmış özetler de temizleniyor.",
      });
    }
    return reply(405, { error: "Yöntem desteklenmiyor." });
  } catch (error: unknown) {
    const errorName = error instanceof Error ? error.name : "";
    const conflict = ["TransactionCanceledException", "ConditionalCheckFailedException"].includes(
      errorName,
    );
    console.warn("MemoryControlFailed", errorName || "Error");
    return reply(conflict ? 409 : 503, {
      error: conflict
        ? "Tercihler değişti; yenileyip tekrar deneyin."
        : "Hafıza işlemi tamamlanamadı.",
    });
  }
}
