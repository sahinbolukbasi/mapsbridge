// Kredi gösterim tablosu (design §7.4, plan D3): apps/web/app/lib/billing/credit-costs.ts'in veri
// kopyası. Mobil @mapsbridge/contracts'a ve web'e bağımlı değildir (workspace'ler arası relative
// import yasak); eşitliği apps/web/tests/mobile-parity.test.cjs doğrular (aynı satırlar, aynı
// maliyetler; `label` = web tr.json[labelKey]). Yalnızca GÖSTERİM içindir: kredi istemcide
// hesaplanmaz ve düşülmez, sunucu kredi zinciri tek otoritedir.
// ⚠ UI hoş geldin 5 / ai_chat 1 gösterir; sunucu değeri yayından önce kullanıcı tarafından
// teyit edilmeli.
import { tr } from "../i18n/ui";

export type CreditCost = number | "free";
export const CREDIT_COST_ROWS = [
  { action: "clarify", labelKey: "credits.row.clarify", label: "Tercih netleştirme", cost: "free" },
  { action: "ai_chat", labelKey: "credits.row.aiChat", label: "AI sohbet", cost: 1 },
  {
    action: "route_optimize",
    labelKey: "credits.row.routeOptimize",
    label: "Rota optimizasyonu",
    cost: 1,
  },
  {
    action: "ai_stay_dining",
    labelKey: "credits.row.stayDining",
    label: "Konaklama ve gastronomi analizi",
    cost: 2,
  },
  {
    action: "ai_deep_trip",
    labelKey: "credits.row.deepTrip",
    label: "Derin çok günlü rota",
    cost: 5,
  },
] as const;
export type CreditCostAction = (typeof CREDIT_COST_ROWS)[number]["action"];
export type CreditCostRow = (typeof CREDIT_COST_ROWS)[number];
/** Ücretsiz hesapla gösterilen hoş geldin kredisi (product.md; ⚠ S1). */
export const WELCOME_CREDITS_DISPLAY = 5;
/** Bir işlemin gösterilen maliyeti. */
export function costOf(action: CreditCostAction): CreditCost {
  const row = CREDIT_COST_ROWS.find((r) => r.action === action);
  if (!row) throw new Error(`Bilinmeyen kredi işlemi: ${action}`);
  return row.cost;
}
/** "1 kredi" / "Ücretsiz" (web formatCreditCost + tr.json credits.*). */
export function formatCreditCost(cost: CreditCost): string {
  if (cost === "free") return tr("credits.free");
  return tr(cost === 1 ? "credits.one" : "credits.other", { n: cost });
}
