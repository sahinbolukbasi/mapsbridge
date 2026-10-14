/**
 * Bedrock Guardrails, PII Masking and Contextual Grounding Check
 * Conforms to docs/plans/agentcore-architecture.md Section 11 & Faz 2
 */

export interface PIIMaskResult {
  maskedText: string;
  hasPII: boolean;
  detectedTypes: string[];
}

export function maskPII(text: string): PIIMaskResult {
  if (!text || typeof text !== 'string') {
    return { maskedText: '', hasPII: false, detectedTypes: [] };
  }

  const detectedTypes: string[] = [];
  let result = text;

  // 1. Credit Card numbers (13 to 19 digits with spaces or hyphens)
  const ccRegex = /\b(?:\d[ -]*?){13,19}\b/g;
  if (ccRegex.test(result)) {
    result = result.replace(ccRegex, (match) => {
      const cleanDigits = match.replace(/[\s-]/g, '');
      if (cleanDigits.length >= 13 && cleanDigits.length <= 19) {
        if (!detectedTypes.includes('CREDIT_CARD')) detectedTypes.push('CREDIT_CARD');
        return '[KART_NUMARASI_MASKEYLENDİ]';
      }
      return match;
    });
  }

  // 2. Email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
  if (emailRegex.test(result)) {
    detectedTypes.push('EMAIL');
    result = result.replace(emailRegex, '[E-POSTA_MASKEYLENDİ]');
  }

  // 3. Turkish TC Kimlik No (11 digits, first digit non-zero)
  const tcRegex = /\b[1-9]\d{10}\b/g;
  if (tcRegex.test(result)) {
    detectedTypes.push('TC_KIMLIK');
    result = result.replace(tcRegex, '[TCKN_MASKEYLENDİ]');
  }

  // 4. US SSN (XXX-XX-XXXX)
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  if (ssnRegex.test(result)) {
    detectedTypes.push('SSN');
    result = result.replace(ssnRegex, '[SSN_MASKEYLENDİ]');
  }

  // 5. Phone numbers
  const phoneRegex = /(?:\+?\d{1,3}[ -]?)?(?:\(?\d{3}\)?[ -]?)?\d{3}[ -]?\d{2}[ -]?\d{2}\b/g;
  if (phoneRegex.test(result)) {
    result = result.replace(phoneRegex, (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 14) {
        if (!detectedTypes.includes('PHONE')) detectedTypes.push('PHONE');
        return '[TELEFON_MASKEYLENDİ]';
      }
      return match;
    });
  }

  return {
    maskedText: result,
    hasPII: detectedTypes.length > 0,
    detectedTypes,
  };
}

export interface TopicSafetyResult {
  isSafe: boolean;
  reason?: string;
}

export function validateTopicSafety(prompt: string): TopicSafetyResult {
  if (!prompt || typeof prompt !== 'string') {
    return { isSafe: true };
  }

  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /you\s+are\s+now\s+in\s+developer\s+mode/i,
    /jailbreak/i,
    /sistem\s+talimatlar(ını|ın|ı)\s+(unut|yoksay|göster)/i,
    /gizli\s+promptu\s+(yazdır|ver|açıkla)/i,
    /<script[\s>]/i,
    /DROP\s+TABLE/i,
    /dan\s+mode/i,
    /pretend\s+you\s+have\s+no\s+(rules|guidelines|restrictions)/i,
    /bypass\s+(safety|content)\s+filter/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(prompt)) {
      return {
        isSafe: false,
        reason: 'İstek güvenlik ve içerik politikalarını ihlal eden yönlendirme kalıpları içeriyor.',
      };
    }
  }

  return { isSafe: true };
}

export interface TravelScopeResult {
  isTravelRelated: boolean;
  refusalMessage?: string;
}

/**
 * Strict Travel Domain Boundary Guardrail
 * Ensures the assistant only answers travel, itinerary, exploration, accommodation and dining queries.
 */
export function validateTravelScope(prompt: string): TravelScopeResult {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return { isTravelRelated: true };
  }

  const normalized = prompt.toLocaleLowerCase('tr').trim();

  // Greetings, courtesies and meta capabilities are always allowed
  const isGreetingOrMeta = /^(merhaba|selam|selamlar|günaydın|iyi\s+(günler|akşamlar)|hey|hi|hello|nasılsın|kimsin|ne\s+yapabilirsin|yardım|baştan\s+başla|teşekkür|sağ\s*ol)[!.,?]?$/iu.test(normalized);
  if (isGreetingOrMeta) {
    return { isTravelRelated: true };
  }

  // Clear non-travel domain triggers (coding, crypto/trading, math homework, general politics)
  const nonTravelPatterns = [
    /(?:python|javascript|typescript|c\+\+|java|golang|react|nextjs|sql)\s+(?:kodu?|script|fonksiyon|syntax|debug|algoritma|yaz\b)/iu,
    /kodu\s+yaz\b|programlama\s+(?:dili|ödevi)|fonksiyonu\s+yaz/iu,
    /(?:bitcoin|ethereum|kripto|forex|hisse\s+senedi|kaldıraçlı\s+işlem|yatırım\s+tavsiyesi)\b/iu,
    /(?:diferansiyel|türev\s+al|integral\s+hesapla|fizik\s+ödevi|kimya\s+denklemi)/iu,
    /(?:seçimler(i|de)?\s+kim\s+kazanır|hükümet\s+politikası\s+eleştir|siyasi\s+parti\s+programı)/iu,
    /(?:hack|ddos|exploit|açık\s+tara|şifre\s+kır(ıcı)?|brute\s*force)/iu,
  ];

  // Travel indicators that override technical terms (e.g. "Tokyo tech museum" or "gezi rotası")
  const travelContextIndicators = /(?:gezi|seyahat|tatil|rota|otel|pansiyon|hostel|restoran|kafe|müze|tur|rehber|şehir|uçak|bilet|tren|plaj|manzara|konakla|gezilecek)/iu;

  for (const pattern of nonTravelPatterns) {
    if (pattern.test(normalized) && !travelContextIndicators.test(normalized)) {
      return {
        isTravelRelated: false,
        refusalMessage: 'Ben MapsBridge seyahat asistanıyım. Yalnızca seyahat rotaları, konaklama, yerel lezzetler, ulaşım ve şehir keşifleri konularında size yardımcı olabilirim. Birlikte bir seyahat planlayalım mı?',
      };
    }
  }

  return { isTravelRelated: true };
}

export interface GroundingCheckResult {
  isGrounded: boolean;
  confidenceScore: number; // 0.0 - 1.0
  ungroundedClaims: string[];
}

export function performGroundingCheck(answerText: string, evidencePassages: string[]): GroundingCheckResult {
  if (!answerText || !answerText.trim()) {
    return { isGrounded: true, confidenceScore: 1.0, ungroundedClaims: [] };
  }

  if (!evidencePassages || evidencePassages.length === 0) {
    return {
      isGrounded: false,
      confidenceScore: 0.2,
      ungroundedClaims: ['Yanıtı destekleyen RAG kaynak pasajı bulunamadı.'],
    };
  }

  const combinedEvidence = evidencePassages.join(' ').toLowerCase();

  // Extract proper nouns / named claims (words starting with Capital or in quotes)
  const candidateClaims = answerText.match(/(?:[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)*)/g) || [];
  const commonExclusions = ['Ben', 'Sen', 'Biz', 'Bu', 'Şu', 'O', 'Gezgin', 'Harita', 'MapsBridge', 'Tur', 'Gün', 'Sabah', 'Öğle', 'Akşam', 'Gece'];

  const ungroundedClaims: string[] = [];
  let checkedCount = 0;
  let groundedCount = 0;

  for (const claim of candidateClaims) {
    if (commonExclusions.includes(claim) || claim.length < 4) continue;
    checkedCount++;
    const normClaim = claim.toLowerCase();

    if (combinedEvidence.includes(normClaim)) {
      groundedCount++;
    } else {
      ungroundedClaims.push(claim);
    }
  }

  if (checkedCount === 0) {
    return { isGrounded: true, confidenceScore: 0.9, ungroundedClaims: [] };
  }

  const ratio = groundedCount / checkedCount;
  const confidenceScore = Math.round(ratio * 100) / 100;
  const isGrounded = confidenceScore >= 0.60;

  return {
    isGrounded,
    confidenceScore,
    ungroundedClaims: isGrounded ? [] : ungroundedClaims.slice(0, 5),
  };
}
