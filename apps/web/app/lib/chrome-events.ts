/**
 * Sayfa ↔ kalıcı chrome (SiteChrome) iletişimi (design §4.1). Sayfa, header'a prop geçemez;
 * bunun yerine window üzerinde bu olayları yayar.
 */
/** Kayıtlı adres listesi değişti; `detail: { count: number }`. */
export const SAVED_ADDRESSES_EVENT = "mapsbridge:saved-addresses-changed";
export type SavedAddressesChangedDetail = { count: number };
