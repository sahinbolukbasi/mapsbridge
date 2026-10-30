// HTTP hata → Türkçe UI hatası (saf, design §8.5). apiFetch'in fırlattığı değeri sınıflandırır.
// api-client.ts değiştirilmez (NFR-6); üç Error öneki ui-logic.test.cjs'te kaynağa karşı doğrulanır.

export const APIFETCH_MESSAGES = {
  timeout: "İstek zaman aşımına uğradı.",
  network: "Sunucuya erişilemedi.",
  uncertain: "Sunucu yanıtı alınamadı.",
} as const;

export type UiErrorKind =
  | "network"
  | "timeout"
  | "uncertain"
  | "unknown"
  | "bad-request"
  | "unauthorized"
  | "forbidden"
  | "not-deployed"
  | "not-found"
  | "conflict"
  | "rate-limited"
  | "server"
  | "unavailable";

export type UiError = {
  kind: UiErrorKind;
  title: string;
  message: string;
  retryable: boolean;
  action?: "login" | "refresh";
  status?: number;
  /** Çağıran yalnızca bu alan "warn" ise console.warn yazar (PII yok: kind + status + endpoint). */
  log?: "warn";
};

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const DEFAULT_SERVER_MESSAGE = /^İşlem başarısız oldu \(\d+\)$/;
const NETWORK_TEXT = "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";
const UNKNOWN_TEXT = "Bir sorun oluştu. Sayfayı yenileyip tekrar deneyin.";
const UNCERTAIN_TEXT =
  "Bağlantı işlem sırasında koptu. İşlem tamamlanmış olabilir. Listeyi yenileyip kontrol etmeden tekrar denemeyin.";

type ApiErrorLike = { status: number; message?: unknown };

function isApiError(err: unknown): err is ApiErrorLike {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { status?: unknown }).status === "number"
  );
}

/** Sunucunun kendi mesajı (apiFetch'in varsayılan "İşlem başarısız oldu (n)" metni değilse). */
function serverMessage(err: ApiErrorLike): string | null {
  const m = typeof err.message === "string" ? err.message.trim() : "";
  return m && !DEFAULT_SERVER_MESSAGE.test(m) ? m : null;
}

export function toUiError(err: unknown, ctx: { method?: HttpMethod } = {}): UiError {
  const mutation = (ctx.method ?? "GET") !== "GET";
  const unsure = (kind: UiErrorKind, title: string, message: string): UiError =>
    mutation
      ? { kind, title, message, retryable: false, action: "refresh", log: "warn" }
      : { kind, title, message, retryable: true, log: "warn" };

  if (err instanceof Error) {
    const msg = err.message;
    if (msg.startsWith(APIFETCH_MESSAGES.network))
      return {
        kind: "network",
        title: "Bağlantı kurulamadı",
        message: NETWORK_TEXT,
        retryable: true,
        log: "warn",
      };
    if (msg.startsWith(APIFETCH_MESSAGES.timeout))
      return unsure(
        "timeout",
        "İstek zaman aşımına uğradı",
        "Sunucu zamanında yanıt vermedi. Tekrar deneyin.",
      );
    if (msg.startsWith(APIFETCH_MESSAGES.uncertain))
      return mutation
        ? {
            kind: "uncertain",
            title: "İşlemin sonucu doğrulanamadı",
            message: UNCERTAIN_TEXT,
            retryable: false,
            action: "refresh",
            log: "warn",
          }
        : {
            kind: "network",
            title: "Bağlantı kurulamadı",
            message: NETWORK_TEXT,
            retryable: true,
            log: "warn",
          };
    return unsure("unknown", "Beklenmeyen hata", UNKNOWN_TEXT);
  }
  if (!isApiError(err)) return unsure("unknown", "Beklenmeyen hata", UNKNOWN_TEXT);

  const status = err.status;
  const server = serverMessage(err);
  const base = { status };
  if (status === 400)
    return {
      ...base,
      kind: "bad-request",
      title: "İstek geçersiz",
      message: server ?? "Gönderilen bilgiler geçersiz. Alanları kontrol edip tekrar deneyin.",
      retryable: false,
    };
  if (status === 401)
    return {
      ...base,
      kind: "unauthorized",
      title: "Oturum süresi doldu",
      message: "Devam etmek için yeniden giriş yapın.",
      retryable: false,
      action: "login",
    };
  if (status === 403)
    return {
      ...base,
      kind: "forbidden",
      title: "Yetkiniz yok",
      message: server ?? "Bu bölüm için yetkiniz bulunmuyor.",
      retryable: false,
    };
  if (status === 404)
    return server
      ? {
          ...base,
          kind: "not-found",
          title: "Kayıt bulunamadı",
          message: server,
          retryable: false,
          action: "refresh",
        }
      : {
          ...base,
          kind: "not-deployed",
          title: "Bu özellik henüz canlıda değil",
          message:
            "Yönetim API'sinin bu bölümü canlı ortamda henüz etkin değil (404). Altyapı güncellemesi tamamlanınca kullanılabilir olacak.",
          retryable: true,
          log: "warn",
        };
  if (status === 409)
    return {
      ...base,
      kind: "conflict",
      title: "Kayıt değişti",
      message: `${server ? `${server} ` : ""}Listeyi yenileyip tekrar deneyin.`,
      retryable: true,
      action: "refresh",
    };
  if (status === 429)
    return {
      ...base,
      kind: "rate-limited",
      title: "Çok fazla istek",
      message: "Biraz bekleyip tekrar deneyin.",
      retryable: true,
      log: "warn",
    };
  if (status === 502 || status === 503 || status === 504)
    return {
      ...base,
      kind: "unavailable",
      title: "Hizmet geçici olarak kullanılamıyor",
      message: server ?? `Hizmet şu anda yanıt vermiyor (${status}).`,
      retryable: true,
      log: "warn",
    };
  if (status >= 500)
    return mutation
      ? {
          ...base,
          kind: "uncertain",
          title: "İşlemin sonucu doğrulanamadı",
          message:
            "İşlem tamamlanmış olabilir. Listeyi yenileyip kontrol etmeden tekrar denemeyin.",
          retryable: false,
          action: "refresh",
          log: "warn",
        }
      : {
          ...base,
          kind: "server",
          title: "Sunucu hatası",
          message: `Sunucuda beklenmeyen bir hata oluştu (${status}). Biraz sonra tekrar deneyin.`,
          retryable: true,
          log: "warn",
        };
  return { ...unsure("unknown", "Beklenmeyen hata", server ?? UNKNOWN_TEXT), ...base };
}
