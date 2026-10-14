# ADR-004: Vize / Giriş Kuralları Mimarisi (Faz D)

**Tarih:** 2026-10-13  
**Durum:** Kabul Edildi  
**Yazar:** @sahin

---

## Bağlam

Kullanıcılar AI chat'ten giriş/vize koşullarını soruyor. v5 prompt vize konusunda fikir bildirmeyi yasaklıyor ancak prompt'a enjekte edilmiş doğrulanmış kural yoktu — model boşluğu kendi bilgisiyle dolduruyor ve yanlış/stale bilgi verebiliyordu.

## Karar

**Statik kural katmanı:** Türk pasaport sahipleri için 3 destinasyon kuralı, tüm §9.2 alanlarıyla birlikte kaynak kodunda sabit. Model bilgisi yerine bu kurallar sistem promptuna inject edilir.

**§9.2 zorunlu alanlar:** `sourceName`, `sourceUrl`, `retrievedAt`, `disclaimer` — bunlardan biri eksikse kural surface edilmez, fallback URL gösterilir.

**Audit log:** Her vize sorgusu `EntryRuleAuditEntry` ile loglanır. `auditId` + `ruleId` + `surface` + coarse week CloudWatch'a yazılır. Hiçbir zaman gerçek userId veya sessionToken loglanmaz — sadece `sessionRef` (SHA-256 hash, 16 char).

**"gidebilirsin" yasağı:** Test ile korunur. `formatEntryRuleForPrompt()` çıktısında bu ifade asla bulunmaz.

**Faz enjeksiyonu:** `orient`, `constrain`, `draft`, `prepare` fazlarında visa bağlamı inject edilir. `in_trip` ve `post_trip` fazlarında eklenmez (kullanıcı zaten gitmiş).

## Alternatiflere Bakış

**Canlı FCDO/MFA API çağrısı:** Gecikme ekler, API erişimi kısıtlı. Faz D kapsamı dışında bırakıldı; AgentCore advisory tool zaten genel güvenlik özetini getiriyor.

**Model bilgisine bırakmak:** Stale ve doğrulanamaz. §9.2 ile çelişiyor.

## Dosyalar

- `apps/web/app/lib/visa/types.ts` — `EntryRule`, `VisaRequirementLevel`, `EntryRuleAuditEntry`
- `apps/web/app/lib/visa/rules.ts` — 3 şehir statik kurallar (TR pasaportu)
- `apps/web/app/lib/visa/audit-log.ts` — immutable audit log
- `apps/web/app/lib/visa/formatter.ts` — `formatEntryRuleForPrompt()`, `buildVisaContext()`
- `apps/web/app/lib/ai/advisor-prompt-builder.ts` — visa context injection eklendi
- `apps/web/tests/visa.test.cjs` — 13 test

## Güncelleme Politikası

Kurallar her major release öncesinde veya kaynaklarda değişiklik haberi geldiğinde `retrievedAt` tarihiyle güncellenir. Test suite'indeki level assertion'ları değişikliğe zorlar.
