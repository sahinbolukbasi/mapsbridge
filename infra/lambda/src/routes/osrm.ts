// OSRM Rota Hesaplama (R6 — routes/index.ts'ten ayrıldı)
// -------------------------------------------------------
// Gerçek yol rotası (OSRM /route/v1). routes/index.ts "kova" god-file'ından çıkarıldı;
// davranış BİREBİR korundu. Router kaydı (GET /routes/{id}/osrm/{profile}) index.ts'te kalır.
//
// Not (I2): rota GEOMETRİSİ deterministik koddur (OSRM API), LLM çıktısı değil — bu dosya onu korur.

import type { ApiGatewayEvent } from "../shared/http";
import {
  extractBearerToken,
  unauthorized,
  badRequest,
  ok,
  serverError,
} from "../shared/http";
import { verifiedUserId } from "../shared/auth";

type OsrmStep = {
  distance: number;
  duration: number;
  maneuver?: {
    instruction?: string;
    bearing_after?: number;
    type?: string;
    modifier?: string;
    location?: unknown;
  };
};
type OsrmLeg = {
  distance: number;
  duration: number;
  steps?: OsrmStep[];
};

export async function handleOsrmRoute(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  const userId = token ? await verifiedUserId(token) : null;
  if (!userId) return unauthorized();
  const profile = event.pathParameters?.profile || "driving";
  const validProfiles = ["driving", "walking", "cycling"];
  if (!validProfiles.includes(profile)) {
    return badRequest(
      `Geçersiz rota profili: ${profile}. Şunlardan biri olmalı: ${validProfiles.join(", ")}`,
    );
  }
  const coords = event.queryStringParameters?.coords;
  if (!coords) return badRequest("coords parametresi gerekli (format: lon1,lat1;lon2,lat2;...)");
  const COORDS_RE =
    /^(-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?)(;-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?)*$/;
  if (!COORDS_RE.test(coords))
    return badRequest("coords formatı geçersiz (beklenen: lon,lat;lon,lat;...)");
  // OSRM_BASE_URL ayarlı değilse public demo sunucuya düşülür. Demo sunucu
  // rate-limit uygular ve production için uygun değildir — görünür uyarı bırak.
  const osrmBase = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
  if (!process.env.OSRM_BASE_URL) {
    console.warn(
      "[routes] OSRM_BASE_URL tanımlı değil — public demo sunucu (router.project-osrm.org) kullanılıyor. Production'da rate-limit riski var; OSRM_BASE_URL ayarlayın.",
    );
  }
  const url = `${osrmBase}/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=true&alternatives=false`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      return badRequest(`OSRM hatası: ${response.status}`);
    }
    const data = (await response.json()) as {
      code?: string;
      message?: string;
      routes?: Array<{ distance: number; duration: number; geometry: unknown; legs?: OsrmLeg[] }>;
    };
    if (data.code !== "Ok") {
      return badRequest(`OSRM: ${data.message || "Rota hesaplanamadı."}`);
    }
    const route = data.routes?.[0];
    if (!route) return badRequest("Rota bulunamadı.");
    return ok({
      distance: route.distance, // meters
      duration: route.duration, // seconds
      polyline: route.geometry, // GeoJSON LineString
      legs: route.legs?.map((leg) => ({
        distance: leg.distance,
        duration: leg.duration,
        steps: leg.steps?.map((step) => ({
          instruction: step.maneuver?.instruction || "",
          distance: step.distance,
          duration: step.duration,
          bearingAfter: step.maneuver?.bearing_after,
          type: step.maneuver?.type,
          modifier: step.maneuver?.modifier,
          location: step.maneuver?.location,
        })),
      })),
      profile,
    });
  } catch (err: unknown) {
    console.error("[OSRM Error]", err);
    return serverError("Rota hesaplanamadı. Lütfen tekrar deneyin.");
  }
}
