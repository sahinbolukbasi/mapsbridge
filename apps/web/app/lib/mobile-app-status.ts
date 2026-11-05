/**
 * Mağaza durumu için tek yapılandırma değeri (design F7, karar S6).
 *
 * S6: iOS/Android mağaza durumu bilinmiyor. Değer "unknown" iken mağaza rozeti, "uygulamayı
 * indir" düğmesi, "yakında" metni ya da sürüm numarası HİÇBİR yüzeyde render edilmez (I10).
 * Mağaza rozeti, indirme bağlantısı ya da sürüm gösterebilecek her yüzey bu değeri okur ve
 * "unknown" iken hiçbir şey çizmez. Kullanıcı mağaza varlığını teyit edince "available" yapılır.
 */
export type MobileAppStatus = "unknown" | "available";

export const MOBILE_APP_STATUS: "unknown" | "available" = "unknown";

/** Mağaza varlığı iddiası (rozet, indirme düğmesi) yalnızca teyit edilmiş durumda gösterilir. */
export function showStoreClaims(status: MobileAppStatus = MOBILE_APP_STATUS): boolean {
  return status === "available";
}
