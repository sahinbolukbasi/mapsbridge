// Yönetim paneli görüntüleme biçimleri (tr-TR). Saf.
const dateFmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const timeFmt = new Intl.DateTimeFormat("tr-TR", { timeStyle: "short" });
const numFmt = new Intl.NumberFormat("tr-TR");
const tryFmt = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const pctFmt = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });

export function formatDate(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "—";
  const t = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(t) ? dateFmt.format(t) : "—";
}

const dayFmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" });
export function formatDay(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "—";
  const t = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(t) ? dayFmt.format(t) : "—";
}

export function formatTime(value: number | null): string {
  return value ? timeFmt.format(value) : "—";
}

export function formatNumber(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? numFmt.format(value) : "—";
}

export function formatTry(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? tryFmt.format(value) : "—";
}

/** 0–1 oranı yüzdeye; null/undefined → "—". */
export function formatRate(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? pctFmt.format(value) : "—";
}

/** Bağlanmamış (null) telemetri alanları boş kart yerine açık metinle gösterilir (I10). */
export function orPending(value: unknown, format: (v: unknown) => string = formatNumber): string {
  return value === null || value === undefined ? "Henüz bağlanmadı" : format(value);
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Yönetici",
  moderator: "Moderatör",
  support: "Destek",
  user: "Kullanıcı",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Etkin",
  suspended: "Askıda",
  pending: "Bekliyor",
  resolved: "Çözüldü",
  dismissed: "Reddedildi",
  expired: "Süresi doldu",
  revoked: "İptal edildi",
  approved: "Onaylandı",
  featured: "Öne çıkarıldı",
  rejected: "Reddedildi",
  held: "Bekletiliyor",
  draft: "Taslak",
  published: "Yayında",
  archived: "Arşivde",
  open: "Açık",
  in_progress: "İşlemde",
  closed: "Kapalı",
  succeeded: "Başarılı",
  refunded: "İade edildi",
  failed: "Başarısız",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  operational: "Çalışıyor",
  degraded: "Yavaş",
  outage: "Kesinti",
};

export const statusLabel = (value: unknown): string =>
  typeof value === "string" ? (STATUS_LABELS[value] ?? value) : "—";
