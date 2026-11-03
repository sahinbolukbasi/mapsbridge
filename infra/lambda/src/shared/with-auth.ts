// Ortak kimlik çözümleme yardımcısı (DRY — R1)
// --------------------------------------------
// routes/index.ts ve diğer handler'larda ~12 kez tekrarlayan şu bloğu tek yere toplar:
//
//   const token = extractBearerToken(event);
//   if (!token) return unauthorized();
//   const userId = (event as EventWithUser).verifiedUser?.sub || (await verifiedUserId(token));
//   if (!userId) return unauthorized();
//
// DAVRANIŞ BİREBİR KORUNUR (danger-zone #4 bölgesi):
//   1) Bearer token yoksa → null (çağıran unauthorized() döner).
//   2) Middleware zaten doğruladıysa event.verifiedUser.sub kullanılır (tekrar doğrulama yok).
//   3) Aksi halde token verifiedUserId ile doğrulanır.
//   4) userId yoksa → null.
//
// Not: Bu bir PORT/repository soyutlaması DEĞİL (o R8/DIP işi). Yalnızca tekrar eden
// transport-seviyesi auth bloğunun DRY'lanması. Middleware sırası (auth→tier→kota) DEĞİŞMEZ.

import { extractBearerToken } from "./http";
import type { ApiGatewayEvent } from "./http";
import { verifiedUserId } from "./auth";

type EventMaybeVerified = ApiGatewayEvent & {
  verifiedUser?: { sub: string } | null;
};

/**
 * İsteğin doğrulanmış kullanıcı id'sini (Cognito sub) çözer.
 * Çözemezse null döner — çağıran tipik olarak `unauthorized()` ile yanıtlar.
 *
 * Önceki satır-içi kalıpla BİREBİR aynı davranış:
 *   const userId = await resolveUserId(event);
 *   if (!userId) return unauthorized();
 */
export async function resolveUserId(event: ApiGatewayEvent): Promise<string | null> {
  const token = extractBearerToken(event);
  if (!token) return null;
  const cached = (event as EventMaybeVerified).verifiedUser?.sub;
  if (cached) return cached;
  return await verifiedUserId(token);
}

/**
 * Korumalı ("pro" gerektiren) route guard'ı. Mevcut auth→entitlement sırasını
 * değiştirmez; yalnızca auth'tan SONRA ek bir kontrol ekler (danger-zone #4 notu).
 * Dönüş:
 *   { userId }          → yetkili, devam et
 *   { error: "auth" }   → kimlik yok → çağıran unauthorized() döner
 *   { error: "upgrade" }→ kimlik var ama pro değil → çağıran 403 + upgrade döner
 * Yetki kararı YALNIZCA kendi DynamoDB kaydımızdan (hasEntitlement).
 */
export async function requireProEntitlement(
  event: ApiGatewayEvent,
): Promise<{ userId: string } | { error: "auth" | "upgrade" }> {
  const userId = await resolveUserId(event);
  if (!userId) return { error: "auth" };
  const { hasEntitlement } = await import("../billing/store");
  if (!(await hasEntitlement(userId, "pro"))) return { error: "upgrade" };
  return { userId };
}
