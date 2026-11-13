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
    name: "Rota & Coğrafi Kümeleme",
    description: "2D ana eksenli K-Means kümeleme ve krono-mekansal 2-opt sıralama ile günlük durakları planlar.",
    wired: true,
    enabled: true,
    capabilities: ["routing", "geo-clustering", "day-fitting"],
  },
  {
    id: "food",
    name: "Gastronomi & Yerel Lezzet",
    description: "Rota duraklarına yürüme mesafesinde, diyet ve bütçe uyumlu otantik lezzet duraklarını eşleştirir.",
    wired: true,
    enabled: true,
    capabilities: ["food", "places", "dietary"],
  },
  {
    id: "city-transit",
    name: "Şehir İçi Ulaşım & Mikro-Mobilite",
    description: "Metro, tramvay, vapur hatları ve şehir ulaşım kartı (Istanbulkart, Oyster, Navigo) rehberliği sunar.",
    wired: true,
    enabled: true,
    capabilities: ["transit", "walkability"],
  },
  {
    id: "car-rental",
    name: "Araç Kiralama & Sürüş Fizibilitesi",
    description: "Şehir içi otopark zorluğu ile kırsal/kıyı rotalarında araç kiralama gereksinimini karşılaştırır.",
    wired: true,
    enabled: true,
    capabilities: ["mobility", "roadtrip"],
  },
  {
    id: "city-intel",
    name: "Destinasyon İstihbaratı & RAG",
    description: "Şehre özgü yerel ipuçları, müze kartları, kapalı gün uyarıları ve mevsimsel tavsiyeleri RAG katmanından çeker.",
    wired: true,
    enabled: true,
    capabilities: ["rag", "research", "local-tips"],
  },
  {
    id: "hotel-deal",
    name: "Konaklama Merkezi & Semt Analizi",
    description: "Rota ağırlık merkezine (centroid) en yakın, güvenli ve ulaşımı kolay konaklama bölgelerini hesaplar.",
    wired: true,
    enabled: true,
    capabilities: ["lodging", "centroid"],
  },
  {
    id: "flight",
    name: "Uçuş & Varış Penceresi",
    description: "İlk ve son gün rota yoğunluğunu uçuş varış/dönüş pencerelerine göre optimize eder.",
    wired: true,
    enabled: true,
    capabilities: ["flights", "arrival-window"],
  },
  {
    id: "dynamic-replanning",
    name: "Dinamik Yeniden Planlama",
    description: "Ani hava değişimi, kapalı mekan veya yorgunlukta kilitli durakları koruyarak rotayı anlık yeniden kurgular.",
    wired: true,
    enabled: true,
    capabilities: ["routing", "replanning", "autonomous"],
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
