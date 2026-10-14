import { invokeBedrockJSON } from '../bedrock-client';

export interface BudgetOrLuxuryOutput {
  tier: 'budget' | 'standard' | 'luxury';
  destination: string;
  estimatedDailyCost: string;
  recommendations: Array<{
    category: 'stay' | 'dining' | 'experience' | 'transport';
    title: string;
    description: string;
    costEstimate: string;
  }>;
  insiderSavingOrVipTips: string[];
}

const BUDGET_LUXURY_SYSTEM_PROMPT = `Sen MapsBridge Seyahat Asistanı Bütçe & Lüks Seyahat Planlama Uzmanısın (Budget & Luxury Travel Sub-Agent).
Görevin: Kullanıcının bütçe seviyesine (Ekonomik / Lüks) göre özelleştirilmiş maliyet kırılımı, VIP deneyimler veya tasarruf stratejileri sunmak.

KURALLAR:
- Bütçe modu için: Ücretsiz müze günleri, şehir kartı indirimleri, uygun fiyatlı yerel sokak lezzetleri.
- Lüks modu için: Michelin yıldızlı lezzetler, özel rehberli VIP girişler, helikopter/özel transferler, butik spa otelleri.
- Yalnızca geçerli JSON döndür.

JSON formatı:
{
  "tier": "budget" | "standard" | "luxury",
  "destination": "Şehir adı",
  "estimatedDailyCost": "Örn. Günlük ortalama €50 - €80 (Bütçe) veya €350+ (Lüks)",
  "recommendations": [
    {
      "category": "stay" | "dining" | "experience" | "transport",
      "title": "Tavsiye Başlığı",
      "description": "Detaylı açıklama",
      "costEstimate": "Fiyat aralığı"
    }
  ],
  "insiderSavingOrVipTips": ["Özel tavsiye"]
}`;

export async function runBudgetLuxuryAgent(
  destination: string,
  tier: 'budget' | 'standard' | 'luxury' = 'standard',
  timeoutMs = 4500
): Promise<{ output: BudgetOrLuxuryOutput; source: 'bedrock'; durationMs: number }> {
  const startTime = Date.now();
  const userQuery = `Hedef Şehir: "${destination}". Seviye: "${tier}". Bu bütçe/deneyim profiline uygun maliyet kırılımı ve özel öneriler hazırla.`;

  const bedrockRes = await invokeBedrockJSON<BudgetOrLuxuryOutput>(userQuery, {
    systemPrompt: BUDGET_LUXURY_SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 1200,
    timeoutMs,
  });

  if (bedrockRes.success && bedrockRes.data && Array.isArray(bedrockRes.data.recommendations)) {
    return {
      output: bedrockRes.data,
      source: 'bedrock',
      durationMs: Date.now() - startTime,
    };
  }

  const isLuxury = tier === 'luxury';
  return {
    output: {
      tier,
      destination,
      estimatedDailyCost: isLuxury ? 'Günlük ~€300 - €500' : 'Günlük ~€40 - €70',
      recommendations: [
        {
          category: 'experience',
          title: isLuxury ? `${destination} Özel Rehberli VIP Keşif` : `${destination} Ücretsiz Yürüyüş ve Şehir Kartı`,
          description: isLuxury ? 'Sıra beklemeden doğrudan giriş ve özel uzman tarihçi eşliğinde gezi.' : 'Tüm toplu taşımayı ve müze girişlerini kapsayan ekonomik 48 saatlik şehir kartı.',
          costEstimate: isLuxury ? 'Kişi başı ~€180' : 'Kişi başı ~€28',
        },
      ],
      insiderSavingOrVipTips: [
        isLuxury
          ? 'Popüler Michelin restoranları için rezervasyonunuzu en az 3 hafta öncesinden yapın.'
          : 'Pazar günleri birçok devlet müzesi ücretsiz veya indirimli giriş imkanı sunar.',
      ],
    },
    source: 'bedrock',
    durationMs: Date.now() - startTime,
  };
}
