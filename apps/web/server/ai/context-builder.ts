import type { MultiAgentRequestPayload } from '../../app/lib/ai/types';
import { boundedHistory } from '../../app/lib/ai/model-history';
import { sanitizePreferences } from '../../app/lib/ai/preferences';
import { getMemorySettings, retrievePersonalMemory, type MemorySettings } from './memory-service';

export function normalizeRequest(body: any) {
  const location = body.userLocation;
  if (location !== undefined && (!Number.isFinite(location?.lat) || Math.abs(location.lat) > 90 || !Number.isFinite(location?.lng) || Math.abs(location.lng) > 180)) throw new Error('INVALID_LOCATION');
  return {
    trainingConsent: body.trainingConsent === true,
    prompt: body.prompt.trim(), conversationHistory: body.conversationHistory || [], conversationId: body.conversationId || null,
    routeMode: body.routeMode === 'calm' || body.routeMode === 'classic' || body.routeMode === 'explorer' ? body.routeMode : undefined,
    tripManifestoMarkdown: typeof body.tripManifestoMarkdown === 'string' ? body.tripManifestoMarkdown.slice(0, 10000) : null,
    userLocation: location ? { lat: location.lat, lng: location.lng } : null,
    // Client profile claims are not an authoritative source; this field is intentionally omitted.
  };
}
export async function buildPersonalContext(userId: string, payload: MultiAgentRequestPayload, snapshot?: MemorySettings): Promise<{ payload: MultiAgentRequestPayload; settings: MemorySettings }> {
  const settings = snapshot || await getMemorySettings(userId);
  const stored = payload.conversationState as (MultiAgentRequestPayload['conversationState'] & { updatedAt?: string }) | undefined;
  const erased = Boolean(settings.erasedAt && (!stored?.updatedAt || stored.updatedAt <= settings.erasedAt));
  const records = await retrievePersonalMemory(userId, settings, payload.prompt);
  // UTF-8 byte count is a conservative upper bound on token count; preserve current constraints.
  let remaining = 1500;
  const memories = records.flatMap(record => {
    const size = Buffer.byteLength(record.text, 'utf8');
    if (size > remaining) return [];
    remaining -= size; return [record];
  });
  return { settings, payload: { ...payload, profileContext: undefined,
    preferences: sanitizePreferences(payload.preferences),
    conversationState: erased ? undefined : payload.conversationState,
    conversationHistory: boundedHistory(erased ? [] : payload.conversationHistory),
    personalMemories: memories,
  } };
}
