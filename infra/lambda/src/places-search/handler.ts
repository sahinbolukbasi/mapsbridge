// Yer verisi proxy'si: transport (Increment 1.5). Mevcut `GET /ai/chat` route'u üzerinden
// `?op=places&action=search|reverse|detail|nearby` ile çağrılır (apply gerekmez). Misafir IP
// başına (hash'li, ham IP saklanmaz), girişli kullanıcı kullanıcı başına günlük limitle çalışır.
// LLM yok, kredi düşmez; reserveAI yoluna dokunulmaz.
import { createHash } from "node:crypto";
import { jsonResponse } from "../shared/http";
import { placesRepo } from "./places.repo";
import { runPlaces, type PlacesDeps } from "./places.service";
import { amazonLocation } from "./providers/amazon-location";
import { googleConfigured, googlePlaces } from "./providers/google-places";

export type PlacesEvent = {
  queryStringParameters?: Record<string, string | undefined> | null;
  requestContext?: { http?: { sourceIp?: string } };
};

/** Misafir öznesi: IP'nin tuzlu sha256 öneki (KVKK: ham IP yazılmaz). */
export function guestSubject(ip: string | undefined): string {
  const salt = process.env.PLACES_QUOTA_SALT || "mapsbridge-places";
  return `ip#${createHash("sha256")
    .update(`${salt}:${ip || "unknown"}`)
    .digest("hex")
    .slice(0, 32)}`;
}

export async function handlePlacesRequest(
  event: PlacesEvent,
  user: { sub: string } | null,
  deps?: Partial<PlacesDeps>,
) {
  const subject = user
    ? { key: `user#${user.sub}`, guest: false }
    : { key: guestSubject(event.requestContext?.http?.sourceIp), guest: true };
  const result = await runPlaces(event.queryStringParameters, subject, {
    repo: deps?.repo || placesRepo,
    providers: deps?.providers || { amazon: amazonLocation, google: googlePlaces },
    googleConfigured: deps?.googleConfigured ?? googleConfigured(),
    now: deps?.now,
  });
  return jsonResponse(result.status, result.body);
}
