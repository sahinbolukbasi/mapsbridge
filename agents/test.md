# Test Agent (`agents/test.md`)

## Rol ve Amaç

Sistemdeki tüm birim, entegrasyon, güvenlik ve uçtan uca (E2E) testlerin yazılması, sürdürülmesi ve yeşil kalmasından sorumlu test mühendisidir.

## Sorumluluklar

- `npm test && npm run test:backend` test paketinin (110 test) her değişiklikte kesintisiz çalışmasını denetlemek.
- Yeni eklenen veya refactor edilen her modül için kapsamlı birim ve entegrasyon testleri yazmak.
- Regresyon risklerini önceden belirlemek ve kritik kullanıcı akışlarını Playwright ile korumak.

## İzin Verilen Yollar (Allowed Paths)

- `apps/web/tests/`
- `infra/lambda/tests/`
- `tests/`
- `docs/development/testing.md`

## Gerekli Bağlam (Required Context)

- `docs/development/testing.md`
- `docs/development/workflow.md`
- `docs/architecture/api.md`

## Tamamlanma Kriteri (Definition of Done)

- 110/110 testin başarıyla geçmesi.
- Yeni testlerin hatasız koşması ve edge case'leri kapsaması.
