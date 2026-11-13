/**
 * @mapsbridge/ai-core — Isolated AI Lab: RAG, Vector DB, Fine-Tuning & 24/7 Autonomous Agent System
 *
 * Bu modül, LLM ince ayarı (Fine-Tuning / DPO), hibrit RAG, vektör indeksleme (Vector DB)
 * ve 7/24 kesintisiz arka planda çalışan otonom ajanların (daemons) yapılandırma,
 * sağlık durumu ve tetikleme sözleşmelerini yönetir.
 */

export interface AutonomousDaemonConfig {
  id: string;
  name: string;
  scheduleCron: string;
  intervalMinutes: number;
  enabled: boolean;
  tier: "tier1" | "tier2" | "tier3" | "tier4";
  targetLambdaOrWorker: string;
  description: string;
  lastHeartbeatAt?: string;
  status: "running" | "idle" | "degraded" | "paused";
  metrics: {
    cyclesCompleted24h: number;
    itemsProcessed24h: number;
    avgCycleDurationMs: number;
    successRate: number;
  };
}

export interface VectorNamespaceConfig {
  namespace: string;
  description: string;
  embeddingModelId: string;
  dimensions: number;
  metric: "cosine" | "dotproduct" | "euclidean";
  documentCount: number;
  freshnessScore: number;
  lastIndexedAt: string;
  autoSyncEnabled: boolean;
}

export interface RagEngineConfig {
  enabled: boolean;
  hybridSearchEnabled: boolean;
  vectorWeight: number;
  lexicalBm25Weight: number;
  geoProximityWeight: number;
  topK: number;
  minSimilarityThreshold: number;
  strictSourceAttribution: boolean;
  autoFreshnessSweepHours: number;
}

export interface FineTuningLabConfig {
  enabled: boolean;
  autoCurateFromThumbsUp: boolean;
  autoCurateFromGoldenEval: boolean;
  piiScrubbingEnforced: boolean;
  targetBaseModelId: string;
  trainingMethod: "SFT" | "DPO" | "DISTILLATION";
  minQualityScoreThreshold: number;
  s3DatasetBucketPrefix: string;
  lastExportedAt?: string;
  curatedSampleCount: number;
}

export interface IsolatedAILabState {
  environment: "isolated-lab-v2";
  autonomousMode24x7: boolean;
  daemons: AutonomousDaemonConfig[];
  vectorDb: {
    provider: "Amazon Bedrock Knowledge Bases + OpenSearch Serverless + DynamoDB GeoVector";
    embeddingModelId: string;
    dimensions: number;
    namespaces: VectorNamespaceConfig[];
  };
  rag: RagEngineConfig;
  fineTuning: FineTuningLabConfig;
}

export const DEFAULT_AUTONOMOUS_DAEMONS: AutonomousDaemonConfig[] = [
  {
    id: "daemon-route-healer",
    name: "7/24 Otonom Rota Anomali & Zig-Zag İyileştirici",
    scheduleCron: "rate(15 minutes)",
    intervalMinutes: 15,
    enabled: true,
    tier: "tier1",
    targetLambdaOrWorker: "infra/lambda/src/background-monitor/index.ts",
    description:
      "Aktif ve yaklaşan seyahat rotalarını 7/24 tarar; coğrafi sapma (zig-zag), kapalı mekan, hava durumu uyuşmazlığı veya aşırı yürüme yükü tespit ettiğinde otonom alternatif üretir.",
    status: "running",
    metrics: {
      cyclesCompleted24h: 96,
      itemsProcessed24h: 412,
      avgCycleDurationMs: 640,
      successRate: 0.995,
    },
  },
  {
    id: "daemon-kb-freshness",
    name: "7/24 RAG & Destinasyon Bilgi Tazeliği Tarayıcısı",
    scheduleCron: "rate(6 hours)",
    intervalMinutes: 360,
    enabled: true,
    tier: "tier2",
    targetLambdaOrWorker: "infra/lambda/src/ai/kb-freshness-worker.ts",
    description:
      "Vize politikaları, şehir içi ulaşım kartı tarifeleri, müze açılış saatleri ve mevsimsel etkinliklerin TTL sürelerini denetler; bayatlayan kayıtları otonom yeniler.",
    status: "running",
    metrics: {
      cyclesCompleted24h: 4,
      itemsProcessed24h: 128,
      avgCycleDurationMs: 1850,
      successRate: 0.99,
    },
  },
  {
    id: "daemon-place-harvester",
    name: "7/24 Çok Kaynaklı Mekan & Yerel Cevher İndeksleyici",
    scheduleCron: "rate(2 hours)",
    intervalMinutes: 120,
    enabled: true,
    tier: "tier2",
    targetLambdaOrWorker: "services/place-intelligence/src/application/discovery-service.ts",
    description:
      "Popüler destinasyonlardaki yeni yerel mekanları, semt kümelerini ve doğrulanmış koordinatları tarayarak vektör indeksini ve önbelleği sıcak tutar.",
    status: "running",
    metrics: {
      cyclesCompleted24h: 12,
      itemsProcessed24h: 840,
      avgCycleDurationMs: 1420,
      successRate: 0.988,
    },
  },
  {
    id: "daemon-memory-consolidator",
    name: "7/24 AgentCore Epizodik Bellek & Persona Konsolidatörü",
    scheduleCron: "rate(30 minutes)",
    intervalMinutes: 30,
    enabled: true,
    tier: "tier1",
    targetLambdaOrWorker: "infra/lambda/src/ai-memory/worker.ts",
    description:
      "Sohbet oturumlarından ve rota geri bildirimlerinden (👍/👎) kullanıcının kalıcı seyahat DNA'sını (/preferences ve /episodes) gürültüsüz biçimde sentezler.",
    status: "running",
    metrics: {
      cyclesCompleted24h: 48,
      itemsProcessed24h: 620,
      avgCycleDurationMs: 410,
      successRate: 0.997,
    },
  },
  {
    id: "daemon-training-curator",
    name: "7/24 Kendi Kendini Eğiten Golden Dataset & Fine-Tuning Küratörü",
    scheduleCron: "rate(4 hours)",
    intervalMinutes: 240,
    enabled: true,
    tier: "tier4",
    targetLambdaOrWorker: "infra/lambda/src/ai/training-worker.ts",
    description:
      "Yüksek puanlı rotaları ve konuşmaları PII filtrelerinden geçirerek SFT/DPO ince ayar (fine-tuning) veri setine dönüştürür ve S3 eğitim havuzuna aktarır.",
    status: "running",
    metrics: {
      cyclesCompleted24h: 6,
      itemsProcessed24h: 195,
      avgCycleDurationMs: 2100,
      successRate: 0.992,
    },
  },
  {
    id: "daemon-finops-guard",
    name: "7/24 Bedrock Maliyet-Kalite & Gecikme Otonom Dengeleyici",
    scheduleCron: "rate(10 minutes)",
    intervalMinutes: 10,
    enabled: true,
    tier: "tier1",
    targetLambdaOrWorker: "infra/lambda/src/shared/ai-finops.ts",
    description:
      "Tier 1-4 Bedrock modellerinin p95 gecikme, token maliyeti ve şema başarı oranlarını gerçek zamanlı izler; bütçe veya gecikme sapmalarında otonom model dengelemesi önerir.",
    status: "running",
    metrics: {
      cyclesCompleted24h: 144,
      itemsProcessed24h: 1440,
      avgCycleDurationMs: 180,
      successRate: 1.0,
    },
  },
];

export const DEFAULT_ISOLATED_AI_LAB_STATE: IsolatedAILabState = {
  environment: "isolated-lab-v2",
  autonomousMode24x7: true,
  daemons: DEFAULT_AUTONOMOUS_DAEMONS,
  vectorDb: {
    provider: "Amazon Bedrock Knowledge Bases + OpenSearch Serverless + DynamoDB GeoVector",
    embeddingModelId: "amazon.titan-embed-text-v2:0",
    dimensions: 1024,
    namespaces: [
      {
        namespace: "places-v3-eu",
        description: "Doğrulanmış POI, semt kümeleri, açılış saatleri ve yerel ipucu vektörleri",
        embeddingModelId: "amazon.titan-embed-text-v2:0",
        dimensions: 1024,
        metric: "cosine",
        documentCount: 48500,
        freshnessScore: 0.97,
        lastIndexedAt: "2026-11-12T18:00:00.000Z",
        autoSyncEnabled: true,
      },
      {
        namespace: "destination-rag-v2",
        description: "Şehir rehberleri, ulaşım kartları, vize kuralları ve mevsimsel bilgi bankası",
        embeddingModelId: "amazon.titan-embed-text-v2:0",
        dimensions: 1024,
        metric: "cosine",
        documentCount: 14200,
        freshnessScore: 0.96,
        lastIndexedAt: "2026-11-12T18:00:00.000Z",
        autoSyncEnabled: true,
      },
      {
        namespace: "user-episodic-v1",
        description: "AgentCore kullanıcı tercihleri ve geçmiş seyahat epizodik bellek gömmeleri",
        embeddingModelId: "amazon.titan-embed-text-v2:0",
        dimensions: 1024,
        metric: "cosine",
        documentCount: 9340,
        freshnessScore: 0.99,
        lastIndexedAt: "2026-11-12T18:00:00.000Z",
        autoSyncEnabled: true,
      },
      {
        namespace: "route-patterns-v1",
        description: "Yüksek memnuniyetli altın rota (Golden Route) krono-mekansal şablonları",
        embeddingModelId: "amazon.titan-embed-text-v2:0",
        dimensions: 1024,
        metric: "cosine",
        documentCount: 3120,
        freshnessScore: 0.98,
        lastIndexedAt: "2026-11-12T18:00:00.000Z",
        autoSyncEnabled: true,
      },
    ],
  },
  rag: {
    enabled: true,
    hybridSearchEnabled: true,
    vectorWeight: 0.65,
    lexicalBm25Weight: 0.2,
    geoProximityWeight: 0.15,
    topK: 8,
    minSimilarityThreshold: 0.72,
    strictSourceAttribution: true,
    autoFreshnessSweepHours: 6,
  },
  fineTuning: {
    enabled: true,
    autoCurateFromThumbsUp: true,
    autoCurateFromGoldenEval: true,
    piiScrubbingEnforced: true,
    targetBaseModelId: "eu.amazon.nova-lite-v1:0",
    trainingMethod: "DPO",
    minQualityScoreThreshold: 0.92,
    s3DatasetBucketPrefix: "s3://mapsbridge-ai-lab/fine-tuning/datasets/v2/",
    curatedSampleCount: 1284,
  },
};

