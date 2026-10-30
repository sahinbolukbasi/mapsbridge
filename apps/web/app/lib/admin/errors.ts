// Yönetim isteği hatası → Türkçe UiError (design §8.5). Eşleme components/ui/logic/http-error.ts'tedir;
// burada yalnızca uç noktanın metodu bağlama eklenir ve PII'siz uyarı logu yazılır.
import { toUiError, type UiError } from "../../components/ui/logic/http-error";
import { ADMIN_ENDPOINTS, type AdminEndpoint, type EndpointId } from "./endpoints";

export function toAdminError(err: unknown, ctx: { endpointId: EndpointId }): UiError {
  const ep: AdminEndpoint = ADMIN_ENDPOINTS[ctx.endpointId];
  const ui = toUiError(err, { method: ep.method });
  if (ui.log === "warn") {
    // Yalnızca uç nokta kimliği, durum ve tür; mesaj/gövde yazılmaz (PII yok).
    console.warn(`[admin] ${ctx.endpointId} ${ui.status ?? "-"} ${ui.kind}`);
  }
  return ui;
}
