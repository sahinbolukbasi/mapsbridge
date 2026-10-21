import { maskPII } from "../../../../../services/ai-assistant/src/domain/guardrails";
import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import type { MultiAgentRequestPayload } from "./types";
import { sanitizePreferences } from "./preferences";
import { normalizeText } from "./planning";

export function canonicalCity(destination: string): string {
  const city = destination.split(",")[0].trim();
  const aliases: Record<string, string> = {
    roma: "Roma",
    rome: "Roma",
    tokyo: "Tokyo",
    tokio: "Tokyo",
    istanbul: "İstanbul",
    lima: "Lima",
  };
  return aliases[normalizeText(city)] || city;
}

export interface TravelSource {
  id: string;
  title: string;
  url: string;
  checkedAt: string;
}
export interface TravelEvidence {
  status: "disabled" | "available" | "empty" | "unavailable";
  passages: Array<TravelSource & { text: string }>;
}
let client: BedrockAgentRuntimeClient | undefined;
export async function retrieveTravelEvidence(
  payload: MultiAgentRequestPayload,
): Promise<TravelEvidence> {
  const knowledgeBaseId = process.env.TRAVEL_KNOWLEDGE_BASE_ID;
  if (!knowledgeBaseId) return { status: "disabled", passages: [] };
  const destinationCity = payload.researchDestination
    ? canonicalCity(payload.researchDestination)
    : undefined;
  client ||= new BedrockAgentRuntimeClient({
    region: process.env.AWS_REGION || "eu-central-1",
    maxAttempts: 1,
  });
  // Identity and full profile never enter the shared knowledge store or query.
  const query = JSON.stringify({
    request: maskPII(payload.prompt).maskedText.slice(0, 2000),
    previousUserMessages: (payload.conversationHistory || [])
      .filter((m) => m.role === "user")
      .slice(-2)
      .map((m) => maskPII(m.content).maskedText.slice(0, 500)),
    preferences: sanitizePreferences(payload.preferences),
  });
  try {
    const response = await client.send(
      new RetrieveCommand({
        knowledgeBaseId,
        retrievalQuery: { text: query },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: 6,
            filter: {
              andAll: [
                { equals: { key: "visibility", value: "public" } },
                { equals: { key: "approved", value: true } },
                { greaterThan: { key: "valid_until", value: Math.floor(Date.now() / 1000) } },
                ...(destinationCity ? [{ equals: { key: "city", value: destinationCity } }] : []),
              ],
            },
          },
        },
      }),
      { abortSignal: AbortSignal.timeout(3000) },
    );
    const passages: TravelEvidence["passages"] = [];
    let remaining = 9000;
    for (const item of response.retrievalResults || []) {
      const metadata = item.metadata || {};
      const text = item.content?.text?.trim();
      if (
        !text ||
        typeof metadata.source_url !== "string" ||
        typeof metadata.checked_at !== "string" ||
        !Number.isFinite(Date.parse(metadata.checked_at))
      )
        continue;
      if (
        destinationCity &&
        (typeof metadata.city !== "string" || canonicalCity(metadata.city) !== destinationCity)
      )
        continue;
      if (
        metadata.visibility !== "public" ||
        metadata.approved !== true ||
        typeof metadata.valid_until !== "number" ||
        metadata.valid_until <= Date.now() / 1000
      )
        continue;
      let url: URL;
      try {
        url = new URL(metadata.source_url);
      } catch {
        continue;
      }
      if (url.protocol !== "https:" || url.username || url.password) continue;
      const excerpt = text.slice(0, Math.min(1800, remaining));
      if (!excerpt) break;
      passages.push({
        id: `S${passages.length + 1}`,
        title: String(metadata.title || "Seyahat kaynağı").slice(0, 160),
        url: url.href,
        checkedAt: metadata.checked_at,
        text: excerpt,
      });
      remaining -= excerpt.length;
    }
    return { status: passages.length ? "available" : "empty", passages };
  } catch (error: unknown) {
    console.warn("Travel retrieval unavailable", error instanceof Error ? error.name : "Error");
    return { status: "unavailable", passages: [] };
  }
}
