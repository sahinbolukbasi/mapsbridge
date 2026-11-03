/**
 * Conversion Forwarder — RevenueCat satın alma event'lerini reklam platformlarına
 * iletir (offline conversion upload). SNS'ten tetiklenir.
 *
 * Tasarım ilkeleri (prompt):
 *  - Her hedef (Google Ads, Meta CAPI, GA4) BAĞIMSIZ: biri 500 dönse diğerleri gider.
 *  - Dedup: her conversion'a event_id = RevenueCat event.id (tarayıcı pixel'i ile
 *    aynı ID → çift sayılmaz).
 *  - Kalıcı başarısızlık → Lambda async DLQ (Terraform'da bağlanır).
 *  - Hedef yapılandırılmamışsa (API key yok) sessiz no-op — FAZ 2 güvenli başlangıç.
 *  - PII loglanmaz: yalnızca event_id, userId (hash değil, iç id), store, hedef, sonuç.
 */

export interface ConversionEvent {
  eventId: string; // RevenueCat event.id — dedup anahtarı
  userId: string;
  type: "INITIAL_PURCHASE" | "RENEWAL";
  store: string; // app_store | play_store | paddle
  productId: string;
  revenueUsd?: number;
  currency?: string;
  // Landing'de yakalanıp kullanıcıya bağlanan attribution (varsa)
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  utm?: Record<string, string>;
}

export type TargetName = "google_ads" | "meta_capi" | "ga4";

export interface TargetResult {
  target: TargetName;
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

/** HTTP POST yardımcı (fetch soyutlaması — teste enjekte edilebilir). */
export type Poster = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number }>;

const defaultPoster: Poster = async (url, init) => {
  const res = await fetch(url, init);
  return { ok: res.ok, status: res.status };
};

/** Google Ads offline click conversion (gclid gerektirir). */
async function sendGoogleAds(ev: ConversionEvent, post: Poster): Promise<TargetResult> {
  const endpoint = process.env.GOOGLE_ADS_CONVERSION_URL;
  if (!endpoint || !ev.gclid)
    return {
      target: "google_ads",
      status: "skipped",
      reason: !endpoint ? "not_configured" : "no_gclid",
    };
  try {
    const r = await post(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gclid: ev.gclid,
        gbraid: ev.gbraid,
        wbraid: ev.wbraid,
        conversion_action: process.env.GOOGLE_ADS_CONVERSION_ACTION,
        order_id: ev.eventId, // dedup
        value: ev.revenueUsd,
        currency: ev.currency || "USD",
      }),
    });
    return r.ok
      ? { target: "google_ads", status: "sent" }
      : { target: "google_ads", status: "failed", reason: `http_${r.status}` };
  } catch (e) {
    return { target: "google_ads", status: "failed", reason: (e as Error).name };
  }
}

/** Meta Conversions API (server-side). */
async function sendMetaCapi(ev: ConversionEvent, post: Poster): Promise<TargetResult> {
  const endpoint = process.env.META_CAPI_URL;
  if (!endpoint) return { target: "meta_capi", status: "skipped", reason: "not_configured" };
  try {
    const r = await post(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_name: "Subscribe",
        event_id: ev.eventId, // dedup (pixel ile paylaşılır)
        action_source: "app",
        custom_data: { value: ev.revenueUsd, currency: ev.currency || "USD" },
        user_data: ev.fbclid ? { fbc: ev.fbclid } : {},
      }),
    });
    return r.ok
      ? { target: "meta_capi", status: "sent" }
      : { target: "meta_capi", status: "failed", reason: `http_${r.status}` };
  } catch (e) {
    return { target: "meta_capi", status: "failed", reason: (e as Error).name };
  }
}

/** GA4 Measurement Protocol. */
async function sendGa4(ev: ConversionEvent, post: Poster): Promise<TargetResult> {
  const endpoint = process.env.GA4_MP_URL;
  if (!endpoint) return { target: "ga4", status: "skipped", reason: "not_configured" };
  try {
    const r = await post(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: ev.userId,
        events: [
          {
            name: "purchase",
            params: {
              transaction_id: ev.eventId, // dedup
              value: ev.revenueUsd,
              currency: ev.currency || "USD",
            },
          },
        ],
      }),
    });
    return r.ok
      ? { target: "ga4", status: "sent" }
      : { target: "ga4", status: "failed", reason: `http_${r.status}` };
  } catch (e) {
    return { target: "ga4", status: "failed", reason: (e as Error).name };
  }
}

/**
 * Üç hedefe BAĞIMSIZ fan-out. Biri patlasa diğerleri etkilenmez (Promise.allSettled).
 * Dönüş: her hedefin sonucu. En az bir hedef "failed" ise çağıran (handler) hata
 * fırlatır → Lambda async retry/DLQ devreye girer; "sent"/"skipped" olanlar tekrar
 * denenmez çünkü idempotency event_id ile hedef tarafında sağlanır.
 */
export async function forwardConversion(
  ev: ConversionEvent,
  post: Poster = defaultPoster,
): Promise<TargetResult[]> {
  const results = await Promise.all([
    sendGoogleAds(ev, post),
    sendMetaCapi(ev, post),
    sendGa4(ev, post),
  ]);
  for (const r of results) {
    console.log(
      JSON.stringify({
        msg: "conversion_forward",
        eventId: ev.eventId,
        target: r.target,
        status: r.status,
        reason: r.reason,
      }),
    );
  }
  return results;
}

interface SnsRecord {
  Sns?: { Message?: string };
}
interface SnsEvent {
  Records?: SnsRecord[];
}

/** SNS entry point. Mesaj = JSON ConversionEvent. */
export async function handler(event: SnsEvent): Promise<void> {
  const records = event.Records || [];
  const failures: string[] = [];
  for (const rec of records) {
    let ev: ConversionEvent;
    try {
      ev = JSON.parse(rec.Sns?.Message || "{}") as ConversionEvent;
    } catch {
      console.log(JSON.stringify({ msg: "conversion_bad_message" }));
      continue; // bozuk mesaj yeniden denenmez
    }
    if (!ev.eventId || !ev.userId) {
      console.log(JSON.stringify({ msg: "conversion_missing_fields", eventId: ev.eventId }));
      continue;
    }
    const results = await forwardConversion(ev);
    // Kalıcı başarısızlık varsa Lambda'yı hatalı bitir → async DLQ yakalar.
    if (results.some((r) => r.status === "failed")) failures.push(ev.eventId);
  }
  if (failures.length > 0) {
    throw new Error(`conversion_forward_failed: ${failures.join(",")}`);
  }
}
