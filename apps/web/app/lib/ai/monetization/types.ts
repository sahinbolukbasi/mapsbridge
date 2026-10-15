export interface PartnerOffer {
  id: string;
  entityId?: string;
  partner: string;
  dealType: "flight" | "hotel" | "car_rental" | "activity" | "insurance" | "esim" | "transfer";
  commissionModel: "cpa" | "cpc" | "revenue_share";
  deeplink: string;
  active: boolean;
  createdAt: string;
}

/**
 * NEUTRALITY RULE: This table is NEVER used as a ranking input.
 * Ranking is determined solely by user relevance.
 * Partner links are attached AFTER ranking, to the most relevant option.
 */
export const NEUTRALITY_POLICY = {
  rule: "Sıralama komisyona göre yapılamaz. Öneri sırası yalnızca kullanıcıya uygunlukla belirlenir.",
  enforcement:
    "partner_offers tablosu öneri motorundan ayrı tutulur; öneri motoru bu tabloyu sıralama girdisi olarak görmez.",
} as const;
