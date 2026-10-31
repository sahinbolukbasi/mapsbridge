// C2'de scripts/design-system/alias-table.ts ile bir kez üretildi (kaynak: silinen sayfa :root blokları).
// Eski sayfa token adları → semantik token (design §2.5). Geçicidir: her sayfa grubu taşındığında
// o dosyanın eski adları semantik adlarla değiştirilir ve satırı buradan elle silinir. Son hali {}
// (C18: tüm kullanımlar semantik token'lara yazıldı).
// Yeni satır EKLENMEZ (guard).

export const legacyAliases: Record<string, string> = {};
