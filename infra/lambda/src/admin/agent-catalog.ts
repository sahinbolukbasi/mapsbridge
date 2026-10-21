import { AdminError, bodyOf, commit, get, text } from "./management";
import { ok, type ApiGatewayEvent } from "../shared/http";

export const AI_AGENTS_KEY = "SYSTEM#AI_AGENTS";

type AgentDefinition = {
  id: string;
  name: string;
  description: string;
  wired: boolean;
  enabled: boolean;
  capabilities: string[];
};

export const DEFAULT_AGENTS: AgentDefinition[] = [
  {
    id: "context",
    name: "Seyahat danışmanı",
    description: "Niyet, profil ve sohbet bağlamını yönetir.",
    wired: true,
    enabled: true,
    capabilities: ["chat", "planning", "personalization"],
  },
  {
    id: "transit",
    name: "Ulaşım ve konaklama",
    description: "Ulaşım, konaklama ve zamanlama önerileri üretir.",
    wired: true,
    enabled: true,
    capabilities: ["transit", "lodging"],
  },
  {
    id: "discovery",
    name: "Yerel keşif",
    description: "Şehir, mahalle ve mekan keşif önerileri üretir.",
    wired: true,
    enabled: true,
    capabilities: ["places", "research"],
  },
  {
    id: "emergency",
    name: "Acil yardım",
    description: "Acil durum isteklerinde güvenli yerel yönlendirme sunar.",
    wired: true,
    enabled: true,
    capabilities: ["safety"],
  },
  {
    id: "route",
    name: "Rota",
    description: "Günlük durakları kişisel kısıtlarla planlar.",
    wired: false,
    enabled: false,
    capabilities: ["routing"],
  },
  {
    id: "food",
    name: "Gastronomi",
    description: "Yemek ve restoran keşfini destekler.",
    wired: false,
    enabled: false,
    capabilities: ["food", "places"],
  },
  {
    id: "city_transit",
    name: "Şehir içi ulaşım",
    description: "Toplu taşıma seçeneklerini karşılaştırır.",
    wired: false,
    enabled: false,
    capabilities: ["transit"],
  },
  {
    id: "dynamic_replanning",
    name: "Yeniden planlama",
    description: "Değişen koşullarda rotayı yeniden düzenler.",
    wired: false,
    enabled: false,
    capabilities: ["routing", "chat"],
  },
];

function normalize(value: Record<string, unknown> | null): AgentDefinition[] {
  const stored = Array.isArray(value?.agents) ? value.agents : [];
  const byId = new Map(DEFAULT_AGENTS.map((agent) => [agent.id, agent]));
  for (const candidate of stored) {
    if (!candidate || typeof candidate !== "object") continue;
    const c = candidate as Record<string, unknown>;
    if (typeof c.id !== "string") continue;
    const base = byId.get(c.id);
    if (base) byId.set(base.id, { ...base, enabled: c.enabled === true });
  }
  return [...byId.values()];
}

export async function aiAgentCatalog() {
  const stored = await get(AI_AGENTS_KEY);
  return ok({
    agents: normalize(stored),
    version: stored?.version || 0,
    policy: {
      userAccess: "All enabled wired agents are available to authenticated AI users.",
      continuousWorkers: false,
      automaticModelTraining: false,
    },
    observedAt: new Date().toISOString(),
  });
}

export async function updateAIAgent(event: ApiGatewayEvent) {
  const id = text(event.pathParameters?.id, "Agent", 80);
  const body = bodyOf(event);
  if (typeof body.enabled !== "boolean")
    throw new AdminError(400, "Agent etkinlik durumu gerekli.");
  const existing = await get(AI_AGENTS_KEY);
  const agents = normalize(existing);
  const target = agents.find((agent) => agent.id === id);
  if (!target) throw new AdminError(404, "Agent bulunamadı.");
  if (body.enabled && !target.wired) {
    throw new AdminError(409, "Bu agent henüz supervisor akışına bağlı değil.");
  }
  const reason = text(body.reason, "İşlem gerekçesi");
  const next = await commit(
    event,
    {
      PK: AI_AGENTS_KEY,
      SK: "META",
      agents: agents.map((agent) =>
        agent.id === id ? { ...agent, enabled: body.enabled } : agent,
      ),
    },
    "ai_agent_updated",
    reason,
    existing,
  );
  return ok({ agents: normalize(next), version: next.version });
}
