// Admin: promosyon kodu yönetimi (oluştur / listele / devre dışı bırak).
// Kredi verme işlemi yalnızca kullanıcı redeem'inde ve sunucuda olur (billing/promo.ts).
// RBAC: routePermission /admin/promo → "credits" (bkz. permissions.ts).
import type { ApiGatewayEvent } from "../shared/http";
import type { AuthorizedEvent } from "../shared/types";
import { ok, badRequest, serverError, parseBody } from "../shared/http";
import { recordAuditLog } from "./management";
import { BillingError } from "../billing/store";
import {
  createPromoCode,
  listPromoCodes,
  deactivatePromoCode,
  normalizeCode,
} from "../billing/promo";

function actor(event: ApiGatewayEvent): string {
  return (event as AuthorizedEvent).verifiedUser?.sub || "admin";
}

export async function handleListPromoCodes(_event: ApiGatewayEvent) {
  try {
    const codes = await listPromoCodes();
    // En yeni önce
    codes.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return ok({ codes });
  } catch (err: unknown) {
    return serverError(
      "Kodlar listelenemedi: " + (err instanceof Error ? err.message : String(err)),
    );
  }
}

export async function handleCreatePromoCode(event: ApiGatewayEvent) {
  const body = parseBody<{
    code?: string;
    credits?: number;
    maxRedemptions?: number;
    expiresAt?: string;
    note?: string;
  }>(event);
  if (!body?.code) return badRequest("Kod gerekli.");
  try {
    const created = await createPromoCode({
      code: body.code,
      credits: Number(body.credits),
      maxRedemptions: Number(body.maxRedemptions ?? 0),
      expiresAt: body.expiresAt,
      createdBy: actor(event),
      note: body.note,
    });
    await recordAuditLog(actor(event), "promo_created", created.code, body.note || "", {
      credits: created.credits,
      maxRedemptions: created.maxRedemptions,
    });
    return ok({ status: "created", code: created });
  } catch (err: unknown) {
    if (err instanceof BillingError) return badRequest(err.message);
    return serverError("Kod oluşturulamadı: " + (err instanceof Error ? err.message : String(err)));
  }
}

export async function handleDeactivatePromoCode(event: ApiGatewayEvent) {
  const code = normalizeCode(event.pathParameters?.code || "");
  if (!code) return badRequest("Kod gerekli.");
  try {
    await deactivatePromoCode(code);
    await recordAuditLog(actor(event), "promo_deactivated", code, "", {});
    return ok({ status: "deactivated", code });
  } catch (err: unknown) {
    return serverError(
      "Kod devre dışı bırakılamadı: " + (err instanceof Error ? err.message : String(err)),
    );
  }
}
