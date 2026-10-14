/**
 * Microservice-level PII masking and safety sanitization.
 */

export interface PIIMaskResult {
  maskedText: string;
  hasPII: boolean;
  detectedTypes: string[];
}

export function maskPII(text: string): PIIMaskResult {
  if (!text || typeof text !== "string") {
    return { maskedText: "", hasPII: false, detectedTypes: [] };
  }

  const detectedTypes: string[] = [];
  let result = text;

  // 1. Credit Card numbers (13 to 19 digits)
  const ccRegex = /\b(?:\d[ -]*?){13,19}\b/g;
  if (ccRegex.test(result)) {
    result = result.replace(ccRegex, (match) => {
      const cleanDigits = match.replace(/[\s-]/g, "");
      if (cleanDigits.length >= 13 && cleanDigits.length <= 19) {
        if (!detectedTypes.includes("CREDIT_CARD")) detectedTypes.push("CREDIT_CARD");
        return "[KART_NUMARASI_MASKEYLENDİ]";
      }
      return match;
    });
  }

  // 2. Email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
  if (emailRegex.test(result)) {
    detectedTypes.push("EMAIL");
    result = result.replace(emailRegex, "[E-POSTA_MASKEYLENDİ]");
  }

  // 3. Turkish TC Kimlik No (11 digits)
  const tcRegex = /\b[1-9]\d{10}\b/g;
  if (tcRegex.test(result)) {
    detectedTypes.push("TC_KIMLIK");
    result = result.replace(tcRegex, "[TCKN_MASKEYLENDİ]");
  }

  // 4. US SSN
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  if (ssnRegex.test(result)) {
    detectedTypes.push("SSN");
    result = result.replace(ssnRegex, "[SSN_MASKEYLENDİ]");
  }

  // 5. Phone numbers
  const phoneRegex = /(?:\+?\d{1,3}[ -]?)?(?:\(?\d{3}\)?[ -]?)?\d{3}[ -]?\d{2}[ -]?\d{2}\b/g;
  if (phoneRegex.test(result)) {
    result = result.replace(phoneRegex, (match) => {
      const digits = match.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 14) {
        if (!detectedTypes.includes("PHONE")) detectedTypes.push("PHONE");
        return "[TELEFON_MASKEYLENDİ]";
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
