export { API_ENDPOINT, apiFetch, routesApi, mediaApi, chatApi } from "./api-client";
export type { RouteStop, RouteEntity, PresignUploadResponse, ChatThreadSummary, ChatMessageItem } from "./api-client";

import { API_ENDPOINT } from "./api-client";

export async function readShare(code: string) {
  const response = await fetch(`${API_ENDPOINT}/shares/${encodeURIComponent(code.trim())}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(response.status === 429 ? "Çok fazla deneme. Biraz bekleyip tekrar deneyin." : "Paylaşım bulunamadı, iptal edildi veya süresi dolmuş.");
  const data = await response.json();
  if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng) || Math.abs(data.lat) > 90 || Math.abs(data.lng) > 180 || !Number.isFinite(data.expiresAt) || data.expiresAt * 1000 <= Date.now()) throw new Error("Paylaşım artık geçerli değil.");
  return data;
}
