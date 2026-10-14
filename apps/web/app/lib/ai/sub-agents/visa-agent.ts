import { invokeBedrockJSON } from '../bedrock-client';
import { buildVisaContext } from '../../visa/formatter';
import { DISCLAIMER_TR } from '../../visa/rules';

export interface VisaRequirement {
  visaType: string;
  isRequired: boolean;
  maxStayDays?: number;
  processingDays?: string;
  estimatedFee?: string;
  applicationChannel: string;
}

export interface VisaDocument {
  name: string;
  required: boolean;
  notes?: string;
}

export interface VisaAgentOutput {
  nationality: string;
  destination: string;
  destinationCountry: string;
  requirement: VisaRequirement;
  documents: VisaDocument[];
  processSteps: string[];
  officialSourceUrl: string;
  officialSourceName: string;
  lastUpdated: string;
  disclaimer: string;
  warnings: string[];
}

const VISA_AGENT_SYSTEM_PROMPT = `Sen MapsBridge Seyahat Asistanı Vize ve Sınır Bilgilendirme Uzmanı Ajanısın (Visa & Border Sub-Agent).
Görevin: Belirtilen uyruk ve hedef ülke için vize/giriş gereksinimlerini, gerekli belgeleri, başvuru adımlarını ve resmi kaynakları sunmak.

KRİTİK KURALLAR:
- Kesinlik iddiasında bulunma. Her yanıtın sonunda resmî kaynak ve uyarı ekle.
- "disclaimer" alanı ASLA boş olamaz. Her zaman "Bu bilgiler sık değişebilir..." uyarısı içermeli.
- "officialSourceUrl" ASLA boş olamaz. İlgili konsolosluk, büyükelçilik veya başvuru merkezi URL'si belirtilmeli.
- Vize onayı garantisi verme, kişisel hukuki yorum yapma.
- Bilgi kesin değilse bunu açıkça belirt.
- Kullanıcıyı HER ZAMAN resmi kaynağı kontrol etmesi konusunda uyar.
- "estimatedFee" yalnızca bilinen/doğrulanabilir veriden gelsin; emin değilsen null bırak.
- Yanıtı Türkçe ver.
- Yalnızca geçerli JSON döndür.

JSON formatı:
{
  "nationality": "TR",
  "destination": "Şehir veya ülke adı",
  "destinationCountry": "Ülke adı",
  "requirement": {
    "visaType": "turistik vize | transit vize | vize muafiyeti | e-vize | kapıda vize",
    "isRequired": true,
    "maxStayDays": 90,
    "processingDays": "10-15 iş günü",
    "estimatedFee": "60 EUR veya null",
    "applicationChannel": "VFS Global | Konsolosluk | e-Vize portalı"
  },
  "documents": [
    { "name": "Pasaport", "required": true, "notes": "Son 6 ay geçerli olmalı" }
  ],
  "processSteps": [
    "1. Online randevu alın",
    "2. Belgeleri hazırlayın"
  ],
  "officialSourceUrl": "https://...",
  "officialSourceName": "Kaynak adı",
  "lastUpdated": "YYYY-MM-DD",
  "disclaimer": "Bu bilgiler sık değişebilir...",
  "warnings": ["Resmi kaynağı kontrol edin"]
}`;

const VISA_AGENT_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    nationality: { type: 'string' },
    destination: { type: 'string' },
    destinationCountry: { type: 'string' },
    requirement: {
      type: 'object' as const,
      properties: {
        visaType: { type: 'string' },
        isRequired: { type: 'boolean' },
        maxStayDays: { type: 'number' },
        processingDays: { type: 'string' },
        estimatedFee: { type: 'string' },
        applicationChannel: { type: 'string' },
      },
      required: ['visaType', 'isRequired', 'applicationChannel'],
    },
    documents: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' },
          required: { type: 'boolean' },
          notes: { type: 'string' },
        },
        required: ['name', 'required'],
      },
    },
    processSteps: { type: 'array' as const, items: { type: 'string' } },
    officialSourceUrl: { type: 'string' },
    officialSourceName: { type: 'string' },
    lastUpdated: { type: 'string' },
    disclaimer: { type: 'string' },
    warnings: { type: 'array' as const, items: { type: 'string' } },
  },
  required: [
    'nationality', 'destination', 'destinationCountry', 'requirement',
    'documents', 'processSteps', 'officialSourceUrl', 'officialSourceName',
    'lastUpdated', 'disclaimer', 'warnings',
  ],
};

function buildVisaUserQuery(
  destination: string,
  nationality: string,
  travelPurpose: string,
  existingVisaContext: string,
): string {
  const parts = [
    `Uyruk: ${nationality} pasaport sahibi.`,
    `Hedef: ${destination}.`,
    `Seyahat amacı: ${travelPurpose}.`,
  ];
  if (existingVisaContext) {
    parts.push(`Mevcut vize bilgisi (doğrula ve genişlet):\n${existingVisaContext}`);
  }
  parts.push(
    'Vize gereksinimi, gerekli belgeler, başvuru adımları, resmi kaynak ve uyarıları içeren detaylı bilgi hazırla.',
  );
  return parts.join('\n');
}

function ensureDisclaimer(output: VisaAgentOutput): VisaAgentOutput {
  if (!output.disclaimer || output.disclaimer.trim().length === 0) {
    output.disclaimer = DISCLAIMER_TR;
  }
  return output;
}

function ensureOfficialSource(output: VisaAgentOutput): VisaAgentOutput {
  if (!output.officialSourceUrl || output.officialSourceUrl.trim().length === 0) {
    output.officialSourceUrl = 'https://www.mfa.gov.tr/vizeler.tr.mfa';
    output.officialSourceName = 'T.C. Dışişleri Bakanlığı';
  }
  return output;
}

function ensureWarnings(output: VisaAgentOutput): VisaAgentOutput {
  if (!Array.isArray(output.warnings)) {
    output.warnings = [];
  }
  const hasOfficialWarning = output.warnings.some(w =>
    /resmi|official|kaynak|kontrol/iu.test(w),
  );
  if (!hasOfficialWarning) {
    output.warnings.push(
      'Seyahat öncesinde mutlaka resmi kaynakları (büyükelçilik/konsolosluk) kontrol edin.',
    );
  }
  return output;
}

export async function runVisaAgent(
  destination: string,
  nationality = 'TR',
  travelPurpose = 'tourism',
  timeoutMs = 8000,
): Promise<{ output: VisaAgentOutput; source: 'bedrock'; durationMs: number }> {
  const startTime = Date.now();

  const existingVisaContext = buildVisaContext({
    destinationId: destination,
    passportIso2: nationality,
    surface: 'chat',
  });

  const purposeLabel = travelPurpose === 'tourism' ? 'turizm'
    : travelPurpose === 'business' ? 'iş'
    : travelPurpose === 'transit' ? 'transit geçiş'
    : travelPurpose === 'study' ? 'eğitim'
    : travelPurpose;

  const userQuery = buildVisaUserQuery(destination, nationality, purposeLabel, existingVisaContext);

  const bedrockRes = await invokeBedrockJSON<VisaAgentOutput>(userQuery, {
    systemPrompt: VISA_AGENT_SYSTEM_PROMPT,
    schema: VISA_AGENT_OUTPUT_SCHEMA,
    temperature: 0.1,
    maxTokens: 2500,
    timeoutMs,
  });

  if (bedrockRes.success && bedrockRes.data && bedrockRes.data.requirement) {
    let output = bedrockRes.data;
    output.nationality = output.nationality || nationality;
    output.destination = output.destination || destination;
    output = ensureDisclaimer(output);
    output = ensureOfficialSource(output);
    output = ensureWarnings(output);

    return {
      output,
      source: 'bedrock',
      durationMs: Date.now() - startTime,
    };
  }

  throw new Error(
    `Vize bilgisi alınamadı: ${destination} (${nationality}). ` +
    'Lütfen resmi kaynakları kontrol edin: https://www.mfa.gov.tr/vizeler.tr.mfa',
  );
}
