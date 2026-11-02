import type { MultiAgentRequestPayload } from "../../app/lib/ai/types";
import { boundedHistory } from "../../app/lib/ai/model-history";
import { sanitizePreferences } from "../../app/lib/ai/preferences";
import { getMemorySettings, retrievePersonalMemory, type MemorySettings } from "./memory-service";

interface RequestBody {
  userLocation?: { lat?: number; lng?: number };
  trainingConsent?: boolean;
  prompt: string;
  conversationHistory?: unknown[];
  conversationId?: string | null;
  routeMode?: string;
  tripManifestoMarkdown?: string;
  conversationFlow?: { activeTopic?: string; stage?: string; gathered?: Record<string, string> };
}
export function normalizeRequest(body: RequestBody) {
  const location = body.userLocation;
  const locLat = location?.lat;
  const locLng = location?.lng;
  if (
    location !== undefined &&
    (!Number.isFinite(locLat) ||
      Math.abs(locLat as number) > 90 ||
      !Number.isFinite(locLng) ||
      Math.abs(locLng as number) > 180)
  )
    throw new Error("INVALID_LOCATION");
  return {
    trainingConsent: body.trainingConsent === true,
    prompt: body.prompt.trim(),
    conversationHistory: body.conversationHistory || [],
    conversationId: body.conversationId || null,
    routeMode: ((): "calm" | "classic" | "explorer" | undefined => {
      if (
        body.routeMode === "calm" ||
        body.routeMode === "classic" ||
        body.routeMode === "explorer"
      )
        return body.routeMode;
      return undefined;
    })(),
    tripManifestoMarkdown:
      typeof body.tripManifestoMarkdown === "string"
        ? body.tripManifestoMarkdown.slice(0, 10000)
        : null,
    userLocation:
      location && Number.isFinite(locLat) && Number.isFinite(locLng)
        ? { lat: locLat as number, lng: locLng as number }
        : null,
    conversationFlow:
      body.conversationFlow &&
      typeof body.conversationFlow.activeTopic === "string" &&
      typeof body.conversationFlow.stage === "string"
        ? {
            activeTopic: body.conversationFlow.activeTopic as string,
            stage: body.conversationFlow.stage as string,
            gathered:
              body.conversationFlow.gathered && typeof body.conversationFlow.gathered === "object"
                ? (body.conversationFlow.gathered as Record<string, string>)
                : undefined,
          }
        : undefined,
    // Client profile claims are not an authoritative source; this field is intentionally omitted.
  };
}
export async function buildPersonalContext(
  userId: string,
  payload: MultiAgentRequestPayload,
  snapshot?: MemorySettings,
): Promise<{ payload: MultiAgentRequestPayload; settings: MemorySettings }> {
  const settings = snapshot || (await getMemorySettings(userId));
  const stored = payload.conversationState as
    (MultiAgentRequestPayload["conversationState"] & { updatedAt?: string }) | undefined;
  const erased = Boolean(
    settings.erasedAt && (!stored?.updatedAt || stored.updatedAt <= settings.erasedAt),
  );
  const records = await retrievePersonalMemory(userId, settings, payload.prompt);
  // UTF-8 byte count is a conservative upper bound on token count; preserve current constraints.
  let remaining = 1500;
  const memories = records.flatMap((record) => {
    const size = Buffer.byteLength(record.text, "utf8");
    if (size > remaining) return [];
    remaining -= size;
    return [record];
  });
  return {
    settings,
    payload: {
      ...payload,
      profileContext: undefined,
      preferences: sanitizePreferences(payload.preferences),
      conversationState: erased ? undefined : payload.conversationState,
      conversationHistory: boundedHistory(erased ? [] : payload.conversationHistory),
      personalMemories: memories,
    },
  };
}
