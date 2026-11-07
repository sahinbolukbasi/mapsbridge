---
inclusion: always
---

# Teknoloji ve Kod Standartları

## Stack

| Katman      | Teknoloji                                                 |
| ----------- | --------------------------------------------------------- |
| Bölge       | `eu-central-1` (Frankfurt) — tüm servisler                |
| API         | Amazon API Gateway v2 (HTTP + WebSocket), ID `pwi1j8mq0j` |
| Hesaplama   | AWS Lambda `nodejs22.x`, per-route handler'lar            |
| Veritabanı  | Amazon DynamoDB — single-table design, tablo `{env}-data` |
| Kimlik      | Amazon Cognito + Google/Apple OAuth (JWKS doğrulama)      |
| AI          | Amazon Bedrock (Claude, Nova) — AgentCore üzerinden       |
| Web         | Next.js statik export → S3 + CloudFront                   |
| Mobil       | Expo React Native, EAS Build                              |
| Ödeme       | Stripe (web), RevenueCat (mobil)                          |
| Rota motoru | OSRM (`router.project-osrm.org` demo sunucu)              |

## Kod Standartları (ZORUNLU)

- **TypeScript her yerde** — frontend, backend, altyapı scriptleri.
- **Vanilla CSS** — CSS framework YOK (Tailwind/styled-components yok). Özel tasarım token'ları kullanılır. Not: panel tarafında bazı Tailwind-benzeri utility class'lar (`text-[15px]`) geçmişten kalmış olabilir; yeni kodda vanilla CSS tercih et.
- **ORM YOK** — doğrudan DynamoDB DocumentClient.
- **Single-table DynamoDB** — PK/SK pattern'leri. Erişim kalıbı eklemeden önce mevcut pattern'leri incele.
- **Clean Architecture** — domain / application / infrastructure katmanları. Lambda handler sadece transport. (Hedef; canlı kodda tam uygulanmıyor — gerçek+hedef için `architecture-truth.md`.)
- Kullanıcıya dönük stringler **Türkçe**.

## Next.js Uyarısı

`apps/web` içinde özel bir Next.js sürümü var. API, konvansiyon ve dosya yapısı eğitim verisinden farklı olabilir. Next.js koduna dokunmadan önce `apps/web/node_modules/next/dist/docs/` altındaki ilgili rehberi oku. `apps/web/AGENTS.md` içindeki `nextjs-agent-rules` bloğu `next dev` tarafından otomatik yazılır — commit edilmesi normaldir, silme.

## Komutlar

Kökten çalıştırılır (npm workspaces):

| Komut                                   | Açıklama                                                      |
| --------------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                           | Web dev server (apps/web). **Arka planda çalıştır, bloklar.** |
| `npm run build`                         | Prod statik export                                            |
| `npm run typecheck`                     | Web TypeScript kontrolü                                       |
| `npm test` / `npm run test:web`         | Web birim testleri (node:test)                                |
| `npm run test:backend`                  | Lambda handler testleri                                       |
| `npm run test:services`                 | Servis testleri                                               |
| `npm run test:all`                      | Tüm testler                                                   |
| `npm run lint` / `npm run lint:fix`     | ESLint                                                        |
| `npm run format`                        | Prettier                                                      |
| `npm run eval:ai`                       | AI diyalog değerlendirmesi                                    |
| `npm run monitor:synthetics`            | Canlı endpoint canary kontrolleri                             |
| `npm run mobile:start`                  | Expo dev server                                               |
| `npm run mobile:ios` / `mobile:android` | Mobil simülatör                                               |

> Not (2026-10-28 doğrulandı): backend/servis testleri altta `node --test .../*.test.cjs` koşar (ör. `infra/lambda/tests/*.test.cjs`). Tek bir danger-zone testini koşmak için: `node --test infra/lambda/tests/billing.test.cjs` gibi. Hangi dosyaya hangi test — bkz `danger-zones.md` "Koruyan test" satırları.

## Doğrulama Kuralı

Kod değişikliğinden sonra: değişen alana göre `npm run typecheck` ve ilgili test komutunu çalıştır. Backend'e dokunduysan `npm run test:backend`, servise dokunduysan `npm run test:services`. Build/test geçmeden işi tamamlanmış sayma.

## Uzun Süren Komutlar

`npm run dev`, `expo start`, `webpack --watch` gibi komutlar terminali bloklar — bunları arka planda (background) çalıştır veya kullanıcının kendi terminalinde çalıştırmasını öner.
