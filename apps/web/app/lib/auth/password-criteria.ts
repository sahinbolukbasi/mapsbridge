// Şifre kriterleri (Cognito parola politikası: ≥12, küçük, büyük, rakam, sembol). Kayıt ve
// şifre sıfırlama aynı kaynaktan okur; saf fonksiyonlar, ui-logic.test.cjs ile sınanır.
// Yalnız istemci ipucudur: asıl doğrulamayı Cognito yapar (backend değişmez).

export type PasswordCriterion = { id: string; label: string; valid: boolean };

export function passwordCriteria(password: string): PasswordCriterion[] {
  return [
    { id: "rule-length", label: "En az 12 karakter", valid: password.length >= 12 },
    { id: "rule-lower", label: "En az bir küçük harf", valid: /[a-zğüşıöç]/.test(password) },
    { id: "rule-upper", label: "En az bir büyük harf", valid: /[A-ZĞÜŞİÖÇ]/.test(password) },
    { id: "rule-number", label: "En az bir rakam", valid: /[0-9]/.test(password) },
    {
      id: "rule-symbol",
      label: "En az bir sembol (ör. !, ?, #)",
      valid: /[^A-Za-z0-9ğüşıöçĞÜŞİÖÇ]/.test(password),
    },
  ];
}

/** Güç seviyesi 0–4: karşılanan kriter oranı; boş şifre 0, hepsi karşılanınca 4. */
export function passwordStrength(criteria: readonly PasswordCriterion[]): 0 | 1 | 2 | 3 | 4 {
  if (criteria.length === 0) return 0;
  const met = criteria.filter((c) => c.valid).length;
  if (met === criteria.length) return 4;
  return Math.min(3, Math.ceil((met * 4) / criteria.length)) as 0 | 1 | 2 | 3;
}

/** Güç çubuğu metni (görünür etiket + Progress erişilebilir adı). */
export function strengthLabel(level: 0 | 1 | 2 | 3 | 4): string {
  return [
    "Şifre gücü: henüz yok",
    "Şifre gücü: zayıf",
    "Şifre gücü: orta",
    "Şifre gücü: iyi",
    "Şifre gücü: güçlü",
  ][level];
}
