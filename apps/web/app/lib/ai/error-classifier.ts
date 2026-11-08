/**
 * AI hata sınıflandırıcı (saf fonksiyonlar).
 *
 * Bedrock ve faturalandırma kaynaklı hataları kullanıcıya anlamlı, kararlı kodlara eşler.
 * Tasarım notu (teşhis Öncelik A): Bedrock `ValidationException` (girdi çok büyük / geçersiz
 * istek) eskiden genel "Model yanıtı alınamadı." mesajına sessizce düşüyordu; bu, uzun
 * oturumlarda belirsiz 503 `AI_RESULT_UNCONFIRMED` üretiyordu. Artık bağlam-boyutu hataları
 * ayrı `CONTEXT_TOO_LARGE` kodu alır ve kullanıcıya net bir kurtarma yolu gösterilir.
 *
 * Bu modül hiçbir yan etki içermez (log/metrik yok); yalnızca sınıflandırma yapar ki
 * birim testiyle en küçük fonksiyona kadar doğrulanabilsin.
 */

/** İstemciye ve handler'a taşınan kararlı AI hata kodları. */
export type AIErrorCode =
  | "CONTEXT_TOO_LARGE"
  | "AI_TIMEOUT"
  | "THROTTLED"
  | "INSUFFICIENT_CREDITS"
  | "USER_DAILY_LIMIT"
  | "SERVICE_DAILY_LIMIT"
  | "WALLET_FROZEN"
  | "MODEL_INVOCATION_FAILED";

export interface ClassifiedError {
  code: AIErrorCode;
  /** İstemcide tekrar denemenin anlamlı olup olmadığı (geçici/tekrar edilebilir hata). */
  retriable: boolean;
  /** Kullanıcıya gösterilecek varsayılan Türkçe mesaj (I11: tr varsayılan). */
  message: string;
}

/** Bedrock SDK hata adları → bağlam/boyut hatası mı? */
const CONTEXT_ERROR_NAMES = new Set(["ValidationException"]);

/** Bedrock SDK hata adları → geçici/tekrar edilebilir mi? */
const RETRIABLE_ERROR_NAMES = new Set([
  "ThrottlingException",
  "ServiceUnavailableException",
  "ModelTimeoutException",
  "TimeoutError",
  "AbortError",
]);

/** Faturalandırma kodları (store.ts BillingError) — DOKUNULMAZ, yalnızca mesajlanır. */
const BILLING_CODES = new Set([
  "INSUFFICIENT_CREDITS",
  "USER_DAILY_LIMIT",
  "SERVICE_DAILY_LIMIT",
  "WALLET_FROZEN",
]);

/**
 * Bir hatanın bağlam-boyutu (girdi çok büyük) hatası olup olmadığını saptar.
 * Hem Bedrock `ValidationException` adını hem de `modelMessages` tarafından atılan
 * `CONTEXT_TOO_LARGE` kodunu kabul eder.
 */
export function isContextSizeError(error: unknown): boolean {
  const e = error as { name?: string; code?: string; message?: string } | null | undefined;
  if (!e) return false;
  if (e.code === "CONTEXT_TOO_LARGE") return true;
  if (e.name && CONTEXT_ERROR_NAMES.has(e.name)) return true;
  // Bazı ValidationException'lar yalnızca mesajda "input is too long" türü ipucu taşır.
  const msg = (e.message || "").toLowerCase();
  return (
    msg.includes("context budget") ||
    msg.includes("too long") ||
    msg.includes("too large") ||
    msg.includes("input is too") ||
    msg.includes("maximum context length")
  );
}

/** Bedrock hata adı (SDK `name`) verilen kararlı AI kodunu döndürür. */
export function classifyBedrockErrorName(name: string | undefined): AIErrorCode {
  if (!name) return "MODEL_INVOCATION_FAILED";
  if (CONTEXT_ERROR_NAMES.has(name)) return "CONTEXT_TOO_LARGE";
  if (name === "ThrottlingException") return "THROTTLED";
  if (["ModelTimeoutException", "TimeoutError", "AbortError"].includes(name)) return "AI_TIMEOUT";
  if (RETRIABLE_ERROR_NAMES.has(name)) return "MODEL_INVOCATION_FAILED";
  return "MODEL_INVOCATION_FAILED";
}

const MESSAGES: Record<AIErrorCode, string> = {
  CONTEXT_TOO_LARGE:
    "Bu sohbet çok uzadı ve modelin bağlam sınırını aştı. Son konuşmayı özetleyip devam edebilir ya da yeni bir seyahat başlatabilirsin.",
  AI_TIMEOUT: "AI yanıtı zaman aşımına uğradı. Lütfen tekrar deneyin.",
  THROTTLED: "Servis şu an yoğun. Birkaç saniye sonra tekrar deneyin.",
  INSUFFICIENT_CREDITS: "Bu işlem için yeterli krediniz yok.",
  USER_DAILY_LIMIT:
    "Bugünlük mesaj sınırına ulaştınız. Sayaç her gece saat 03:00'te (Türkiye saati) sıfırlanır.",
  SERVICE_DAILY_LIMIT: "Servis kapasitesi şu an yoğun. Birkaç dakika sonra tekrar deneyin.",
  WALLET_FROZEN: "Kredi hesabınız geçici olarak durduruldu. Detay için destek ekibine ulaşın.",
  MODEL_INVOCATION_FAILED: "Model yanıtı alınamadı. Lütfen tekrar deneyin.",
};

/**
 * Herhangi bir hatayı (Bedrock SDK hatası, BillingError, `modelMessages` throw'u) kararlı
 * bir koda + tekrar-edilebilirlik + Türkçe mesaja sınıflandırır.
 *
 * Faturalandırma kodlarını (günlük sınır / kredi) YALNIZCA mesajlar — hiçbir sınırı
 * zayıflatmaz; bunlar store.ts tarafından zaten üretilmiş kodlardır (danger zone).
 */
export function classifyAIError(error: unknown): ClassifiedError {
  const e = error as { name?: string; code?: string; message?: string } | null | undefined;

  // 1) Faturalandırma kodları (tasarım gereği sınırlar) — yalnızca kullanıcıya anlat.
  if (e?.code && BILLING_CODES.has(e.code)) {
    const code = e.code as AIErrorCode;
    return { code, retriable: code === "SERVICE_DAILY_LIMIT", message: MESSAGES[code] };
  }

  // 2) Bağlam-boyutu hatası — ayrı kod + net kurtarma yolu (tekrar denemek işe yaramaz).
  if (isContextSizeError(error)) {
    return { code: "CONTEXT_TOO_LARGE", retriable: false, message: MESSAGES.CONTEXT_TOO_LARGE };
  }

  // 3) Geçici Bedrock hataları — tekrar edilebilir.
  const code = classifyBedrockErrorName(e?.name);
  const retriable = code === "AI_TIMEOUT" || code === "THROTTLED";
  return { code, retriable, message: MESSAGES[code] };
}
