import { invokeBedrockJSON } from '../bedrock-client';
import type { TripProfile } from '../types';

export interface ArtCultureItem {
  name: string;
  type: 'modern_art' | 'historic_museum' | 'gallery' | 'architecture' | 'sculpture';
  location: string;
  highlightExhibition: string;
  recommendedDuration: string;
  bookingAdvice: string;
}

export interface ArtCultureOutput {
  destination: string;
  venues: ArtCultureItem[];
  museumPassAdvice: string;
}

const ART_CULTURE_SYSTEM_PROMPT = `Sen MapsBridge Seyahat Asistanı Sanat, Tarih ve Kültür Uzmanı Ajanısın (Art & Culture Sub-Agent).
Görevin: Kullanıcının ziyaret edeceği şehirdeki dünya çapında müzeler, modern sanat galerileri, mimari şaheserler ve heykeller rehberi hazırlamak.

KURALLAR:
- Şehrin simge ve saygın sanat kurumlarını seç (örn: Louvre, Uffizi, MoMA, Prado vb.).
- Sıra beklemeden giriş (skip-the-line) veya müze kartı (Museum Pass) tavsiyesi ver.
- Yalnızca geçerli JSON döndür.

JSON formatı:
{
  "destination": "Şehir adı",
  "venues": [
    {
      "name": "Müze veya Galeri Adı",
      "type": "modern_art" | "historic_museum" | "gallery" | "architecture" | "sculpture",
      "location": "Semt veya Cadde",
      "highlightExhibition": "Kaçırılmaması gereken başyapıt veya sergi",
      "recommendedDuration": "Örn. 2.5 saat",
      "bookingAdvice": "Online bilet veya sıra bekleme uyarısı"
    }
  ],
  "museumPassAdvice": "Şehir müze kartı tavsiyesi"
}`;

export async function runArtCultureAgent(
  destination: string,
  profile?: Partial<TripProfile>,
  timeoutMs = 4500
): Promise<{ output: ArtCultureOutput; source: 'bedrock'; durationMs: number }> {
  const startTime = Date.now();
  const interests = profile?.interests?.culture?.join(', ') || 'modern sanat, tarih, resim';

  const userQuery = `Hedef Şehir: "${destination}". İlgi Alanları: ${interests}. En seçkin 2-4 müze ve sanat galerisi rehberi hazırla.`;

  const bedrockRes = await invokeBedrockJSON<ArtCultureOutput>(userQuery, {
    systemPrompt: ART_CULTURE_SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 1200,
    timeoutMs,
  });

  if (bedrockRes.success && bedrockRes.data && Array.isArray(bedrockRes.data.venues)) {
    return {
      output: bedrockRes.data,
      source: 'bedrock',
      durationMs: Date.now() - startTime,
    };
  }

  return {
    output: {
      destination,
      venues: [
        {
          name: `${destination} Şehir ve Sanat Müzesi`,
          type: 'historic_museum',
          location: 'Tarihi Merkez',
          highlightExhibition: 'Kalıcı tarih ve klasik sanat koleksiyonu',
          recommendedDuration: '2 saat',
          bookingAdvice: 'Öğleden önce ziyaretlerde daha az kalabalık olur',
        },
      ],
      museumPassAdvice: `${destination} Şehir Kartı alarak müzelere indirimli giriş sağlayabilirsiniz.`,
    },
    source: 'bedrock',
    durationMs: Date.now() - startTime,
  };
}
