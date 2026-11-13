/**
 * @mapsbridge/ai-core — Modular AI, AWS AgentCore & Bedrock Microservice Architecture Manifest
 *
 * Bu modül, MapsBridge seyahat asistanının Web, Mobil ve Admin platformlarına
 * tek bir izole mikroservis katmanı olarak hizmet vermesini sağlayan
 * mimari tanımları, AgentCore bellek/harness yapılandırmasını, 4 katmanlı
 * Bedrock model yönlendirme matrisini ve 7/24 otonom ajan kayıtlarını barındırır.
 */

export interface BedrockTierDefinition {
  tier: "tier1" | "tier2" | "tier3" | "tier4";
  roleName: string;
  modelId: string;
  fallbackModelId: string;
  maxTokens: number;
  temperature: number;
  estimatedLatencyMs: number;
  costPer1kInputUsd: number;
  costPer1kOutputUsd: number;
  useCases: string[];
}

export interface AgentCoreNamespaceConfig {
  id: string;
  namespaceTemplate: string;
  ttlDays: number;
  strategy: "semantic" | "summary" | "episodic" | "userPreference";
  description: string;
}

export interface HarnessStageConfig {
  id: string;
  order: number;
  name: string;
  deterministic: boolean;
  timeoutMs: number;
  description: string;
}

export interface SubAgentDefinition {
  id: string;
  name: string;
  domain:
    | "core"
    | "routing"
    | "discovery"
    | "gastronomy"
    | "mobility"
    | "hospitality"
    | "safety"
    | "autonomous";
  defaultTier: "tier1" | "tier2" | "tier3" | "tier4";
  wired: boolean;
  enabledByDefault: boolean;
  timeoutMs: number;
  description: string;
  tools: string[];
  guardrails: string[];
}

export const BEDROCK_MODEL_MATRIX: Record<
  "tier1" | "tier2" | "tier3" | "tier4",
  BedrockTierDefinition
> = {
  tier1: {
    tier: "tier1",
    roleName: "Ultra-Fast Intake & Intent Classifier",
    modelId: "eu.amazon.nova-micro-v1:0",
    fallbackModelId: "eu.amazon.nova-lite-v1:0",
    maxTokens: 512,
    temperature: 0.2,
    estimatedLatencyMs: 250,
    costPer1kInputUsd: 0.000035,
    costPer1kOutputUsd: 0.00014,
    useCases: [
      "Selamlama ve hızlı niyet sınıflandırma",
      "Slot/profil çıkarımı (intake)",
      "Acil durum ve cüzdan/bakiye sorguları",
    ],
  },
  tier2: {
    tier: "tier2",
    roleName: "Standard Conversational & Concierge Engine",
    modelId: "eu.amazon.nova-lite-v1:0",
    fallbackModelId: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
    maxTokens: 1500,
    temperature: 0.35,
    estimatedLatencyMs: 750,
    costPer1kInputUsd: 0.00006,
    costPer1kOutputUsd: 0.00024,
    useCases: [
      "Standart seyahat sohbeti ve mekan/restoran önerileri",
      "1-3 günlük tek şehir rota taslağı ve concierge yanıtları",
      "Paralel alt ajan (sub-agent) sentezleme",
    ],
  },
  tier3: {
    tier: "tier3",
    roleName: "Primary High-Precision Travel & Multi-Day Route Planner",
    modelId: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
    fallbackModelId: "eu.amazon.nova-lite-v1:0",
    maxTokens: 2800,
    temperature: 0.3,
    estimatedLatencyMs: 1400,
    costPer1kInputUsd: 0.0008,
    costPer1kOutputUsd: 0.004,
    useCases: [
      "4+ günlük detaylı seyahat ve çoklu semt rotaları",
      "Çok kriterli kişiselleştirme (çocuklu aile, gastronomi, bütçe, tempo)",
      "Zengin kültürel bağlam ve derin destinasyon rehberliği",
    ],
  },
  tier4: {
    tier: "tier4",
    roleName: "Deep Autonomous Replanning & Complex Optimization Engine",
    modelId: "eu.anthropic.claude-3-5-sonnet-20241022-v2:0",
    fallbackModelId: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
    maxTokens: 4096,
    temperature: 0.25,
    estimatedLatencyMs: 2800,
    costPer1kInputUsd: 0.003,
    costPer1kOutputUsd: 0.015,
    useCases: [
      "Çok şehirli / dinamik yeniden planlama (replanning)",
      "Kriz/hava durumu/kapalı mekan durumunda tam rota optimizasyonu",
      "7/24 otonom kalite değerlendirme ve altın veri (Golden Dataset) sentezi",
    ],
  },
};

export const AGENTCORE_MEMORY_NAMESPACES: AgentCoreNamespaceConfig[] = [
  {
    id: "preferences",
    namespaceTemplate: "/preferences/{actorId}",
    ttlDays: 365,
    strategy: "userPreference",
    description:
      "Kullanıcının kalıcı seyahat DNA'sı: tempo, bütçe duyarlılığı, beslenme kısıtları, yürüme toleransı ve favori ilgi alanları.",
  },
  {
    id: "trips",
    namespaceTemplate: "/trips/{actorId}",
    ttlDays: 180,
    strategy: "summary",
    description:
      "Geçmiş ve aktif seyahat özetleri, ziyaret edilen şehirler, beğenilen/reddedilen duraklar.",
  },
  {
    id: "session_context",
    namespaceTemplate: "/context/{actorId}/{sessionId}",
    ttlDays: 30,
    strategy: "semantic",
    description:
      "Aktif sohbet oturumunun kısa dönemli bağlamı, açık sorular, varsayımlar ve kilitli duraklar.",
  },
  {
    id: "episodic_feedback",
    namespaceTemplate: "/episodes/{actorId}",
    ttlDays: 365,
    strategy: "episodic",
    description:
      "Rota sonrası kullanıcı geri bildirimleri (👍/👎), yorgunluk sinyalleri ve gerçek zamanlı rota sapmaları.",
  },
];

export const AGENTCORE_HARNESS_STAGES: HarnessStageConfig[] = [
  {
    id: "pre-intake-guard",
    order: 1,
    name: "Pre-Intake PII & Prompt Guardrail",
    deterministic: true,
    timeoutMs: 25,
    description: "PII maskeleme, prompt injection kontrolü ve dil/niyet ön analizi.",
  },
  {
    id: "memory-context-hydration",
    order: 2,
    name: "AgentCore Memory & User Context Hydration",
    deterministic: true,
    timeoutMs: 350,
    description:
      "AgentCore uzun dönemli bellek (/preferences, /trips) ve aktif TripState/ThreadFocus birleştirme.",
  },
  {
    id: "multi-source-place-research",
    order: 3,
    name: "Multi-Source Geo & Curated Place Research",
    deterministic: true,
    timeoutMs: 2500,
    description:
      "Amazon Location GeoPlaces + Curated City Intelligence + OSM/Place Intelligence hibrit mekan araştırması ve skorlama.",
  },
  {
    id: "sub-agent-fanout",
    order: 4,
    name: "Parallel Sub-Agent Orchestration",
    deterministic: true,
    timeoutMs: 2000,
    description:
      "Gastronomi, şehir içi ulaşım, konaklama, uçuş, araç kiralama ve şehir istihbarat alt ajanlarının paralel çalıştırılması.",
  },
  {
    id: "tiered-bedrock-inference",
    order: 5,
    name: "4-Tier Bedrock Cost-Quality Inference",
    deterministic: false,
    timeoutMs: 12000,
    description:
      "Sorgu karmaşıklığına göre Nova Micro / Nova Lite / Claude Haiku 4.5 / Claude 3.5 Sonnet v2 model yönlendirmesi.",
  },
  {
    id: "deterministic-route-synthesis",
    order: 6,
    name: "2D Principal-Axis K-Means & Chrono-Spatial Route Weaver",
    deterministic: true,
    timeoutMs: 120,
    description:
      "I1/I2 garantili deterministik gün bölme, aykırı değer (outlier) temizleme ve sabah/öğle/akşam coğrafi sıra optimizasyonu.",
  },
  {
    id: "post-route-harness",
    order: 7,
    name: "Post-Route Enrichment Harness (Stay, Transit, Pacing & Readiness)",
    deterministic: true,
    timeoutMs: 80,
    description:
      "Rota sonrası konaklama merkezi hesaplama, günlük yürüme/tempo analizi, vize/eSIM/bütçe hazırlık kontrol listesi.",
  },
  {
    id: "async-memory-consolidation",
    order: 8,
    name: "Async SQS Memory & Training Queue Dispatch",
    deterministic: true,
    timeoutMs: 50,
    description:
      "Yanıt gecikmesini sıfırda tutarak AgentCore bellek çıkarımını ve Fine-Tuning eğitim kuyruğunu asenkron tetikleme.",
  },
];

export const UNIFIED_SUB_AGENT_CATALOG: SubAgentDefinition[] = [
  {
    id: "context",
    name: "User Context & Memory Agent",
    domain: "core",
    defaultTier: "tier1",
    wired: true,
    enabledByDefault: true,
    timeoutMs: 1200,
    description:
      "AgentCore bellek katmanından kullanıcı tercihlerini, geçmiş seyahatlerini ve bütçe/tempo profilini çıkarır.",
    tools: ["agentcore_retrieve_memory", "profile_context_builder"],
    guardrails: ["I5_NO_DEMOGRAPHIC_STEREOTYPING", "PII_REDACTION"],
  },
  {
    id: "discovery",
    name: "Multi-Source Place Discovery Agent",
    domain: "discovery",
    defaultTier: "tier2",
    wired: true,
    enabledByDefault: true,
    timeoutMs: 2500,
    description:
      "Amazon Location GeoPlaces, Curated City Intelligence ve Place Intelligence kaynaklarından doğrulanmış POI havuzu üretir.",
    tools: ["geoplaces_search_text", "curated_city_intel_lookup", "recommendation_scoring_engine"],
    guardrails: ["I1_GROUNDED_POIS_ONLY", "OUTLIER_GEO_FILTER"],
  },
  {
    id: "route",
    name: "Deterministic Geo-Cluster & Route Agent",
    domain: "routing",
    defaultTier: "tier3",
    wired: true,
    enabledByDefault: true,
    timeoutMs: 1500,
    description:
      "2D ana eksenli K-Means kümeleme, krono-mekansal (sabah/öğle/akşam) 2-opt sıralama ve günlük yürüme bütçesi dengelemesi yapar.",
    tools: ["principal_axis_kmeans", "chrono_spatial_2opt", "day_budget_fitter"],
    guardrails: ["I1_NO_UNRESEARCHED_POIS", "I2_DETERMINISTIC_GEOMETRY"],
  },
  {
    id: "food",
    name: "Authentic Gastronomy & Culinary Agent",
    domain: "gastronomy",
    defaultTier: "tier2",
    wired: true,
    enabledByDefault: true,
    timeoutMs: 1800,
    description:
      "Rota duraklarına yürüme mesafesinde, turist tuzaklarından uzak, diyet ve bütçe uyumlu yerel lezzet duraklarını eşleştirir.",
    tools: ["culinary_place_matcher", "dietary_safety_filter", "meal_slot_scheduler"],
    guardrails: ["I1_VERIFIED_VENUES", "DIETARY_STRICT_MATCH"],
  },
  {
    id: "transit",
    name: "Intercity & Airport Transit Agent",
    domain: "mobility",
    defaultTier: "tier2",
    wired: true,
    enabledByDefault: true,
    timeoutMs: 1500,
    description:
      "Havalimanı-merkez transferi, şehirlerarası hızlı tren/uçuş/otobüs bağlantılarını ve sürelerini analiz eder.",
    tools: ["airport_transfer_analyzer", "intercity_leg_estimator"],
    guardrails: ["I2_NO_ROUTE_MUTATION", "I1_NO_FABRICATED_FARES"],
  },
  {
    id: "city-transit",
    name: "Urban Micro-Mobility & Transit Pass Agent",
    domain: "mobility",
    defaultTier: "tier1",
    wired: true,
    enabledByDefault: true,
    timeoutMs: 1500,
    description:
      "Şehir içi metro/tramvay/vapur hatları, ulaşım kartları (Istanbulkart, Oyster, Navigo vb.) ve yürünebilirlik analizi sunar.",
    tools: ["urban_transit_kb", "walkability_analyzer"],
    guardrails: ["I2_NO_ROUTE_MUTATION"],
  },
  {
    id: "hotel-deal",
    name: "Stay Centroid & Neighborhood Lodging Agent",
    domain: "hospitality",
    defaultTier: "tier2",
    wired: true,
    enabledByDefault: true,
    timeoutMs: 1800,
    description:
      "Rota ağırlık merkezine (centroid) en yakın, güvenli ve ulaşımı kolay konaklama semtlerini hesaplar.",
    tools: ["stay_centroid_calculator", "neighborhood_vibe_matcher"],
    guardrails: ["I8_AFFILIATE_SEPARATION", "I1_NO_FABRICATED_PRICES"],
  },
  {
    id: "flight",
    name: "Flight Strategy & Arrival Window Agent",
    domain: "mobility",
    defaultTier: "tier1",
    wired: true,
    enabledByDefault: true,
    timeoutMs: 1500,
    description:
      "İlk ve son gün rota yoğunluğunu uçuş varış/dönüş pencerelerine göre optimize eder.",
    tools: ["arrival_window_adapter", "baggage_logistics_advisor"],
    guardrails: ["I8_AFFILIATE_SEPARATION", "I1_NO_FABRICATED_PRICES"],
  },
  {
    id: "car-rental",
    name: "Roadtrip & Car Rental Feasibility Agent",
    domain: "mobility",
    defaultTier: "tier1",
    wired: true,
    enabledByDefault: true,
    timeoutMs: 1500,
    description:
      "Şehir içi otopark zorluğu ile kırsal/kıyı rotalarında araç kiralama gereksinimini karşılaştırır.",
    tools: ["driving_feasibility_analyzer", "parking_zone_advisor"],
    guardrails: ["I2_NO_ROUTE_MUTATION"],
  },
  {
    id: "city-intel",
    name: "Destination Insider & RAG Intelligence Agent",
    domain: "discovery",
    defaultTier: "tier2",
    wired: true,
    enabledByDefault: true,
    timeoutMs: 1800,
    description:
      "Destinasyona özgü yerel ipuçları, müze kartları, resmi tatil/kapalı gün uyarıları ve mevsimsel tavsiyeleri RAG katmanından çeker.",
    tools: ["destination_rag_retriever", "seasonal_crowd_predictor"],
    guardrails: ["I1_SOURCE_ATTRIBUTION", "TTL_FRESHNESS_CHECK"],
  },
  {
    id: "emergency",
    name: "Traveler Safety & Emergency Response Agent",
    domain: "safety",
    defaultTier: "tier1",
    wired: true,
    enabledByDefault: true,
    timeoutMs: 1000,
    description:
      "Acil durum numaraları, en yakın hastane/konsolosluk/nöbetçi eczane ve güvenli bölge yönlendirmelerini anında sağlar.",
    tools: ["emergency_contacts_lookup", "nearest_medical_locator"],
    guardrails: ["ZERO_HALLUCINATION_SAFETY", "PRIORITY_BYPASS"],
  },
  {
    id: "dynamic-replanning",
    name: "Live Disruption & Dynamic Replanning Agent",
    domain: "autonomous",
    defaultTier: "tier4",
    wired: true,
    enabledByDefault: true,
    timeoutMs: 3500,
    description:
      "Ani yağmur, kapalı mekan, yorgunluk veya gecikme durumunda kilitli durakları koruyarak rotayı gerçek zamanlı yeniden kurgular.",
    tools: ["locked_stop_preserving_replanner", "weather_indoor_swapper"],
    guardrails: ["I2_DETERMINISTIC_GEOMETRY", "PRESERVE_LOCKED_STOPS"],
  },
];

