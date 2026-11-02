# Design Document

## Overview

93 web typecheck hatası 16 dosyada, 5 kök-neden kategorisinde toplanıyor. Strateji: en yoğun ve en izole kümelerden başlayıp aşağı inmek; her dosya grubundan sonra `npm run typecheck` ile ilerlemeyi ölçmek. Hiçbir runtime mantığı değişmez — yalnızca tipler.

Hata dağılımı (doğrulanmış):

| Dosya                                       | Hata | Kategori                             |
| ------------------------------------------- | ---- | ------------------------------------ |
| `app/lib/ai/planning.ts`                    | 36   | AI domain tip daraltma               |
| `app/lib/ai/supervisor.ts`                  | 14   | AI union/null daraltma               |
| `app/profile/page.tsx`                      | 6    | Trip alan erişimi                    |
| `app/ai/page.tsx`                           | 6    | SpeechRecognition global + Trip cast |
| `app/register/page.tsx`                     | 4    | Google global                        |
| `app/login/page.tsx`                        | 4    | Google global                        |
| `app/lib/analytics/tracker.ts`              | 4    | index signature                      |
| `app/desk/page.tsx`                         | 4    | Leaflet tuple                        |
| `app/components/trip/google-place-info.tsx` | 3    | Place tip                            |
| `app/lib/ai/route-edit.ts`                  | 2    | union daraltma                       |
| `app/k/page.tsx`                            | 2    | Leaflet                              |
| `app/components/google-one-tap.tsx`         | 2    | Google global                        |
| `app/components/google-auth-button.tsx`     | 2    | Google global                        |
| `app/community/page.tsx`                    | 2    | union/array                          |
| `app/lib/trip/use-travel-planner.ts`        | 1    | Pin[]                                |
| `app/lib/ai/bedrock-client.ts`              | 1    | overload                             |

## Architecture

### Yaklaşım ilkeleri

1. **Narrowing > cast:** Önce type guard (`typeof`, `in`, `Array.isArray`, kullanıcı-tanımlı guard). Cast yalnızca kaçınılmazsa, `unknown` üzerinden ve yorumla.
2. **Tek kaynak global tipler:** Google Identity ve SpeechRecognition için tek bir `.d.ts` dosyası — çakışan `declare global` bildirimlerini ortadan kaldırır.
3. **Domain tipleri güçlendir:** `planning.ts`'teki `TripProfile`/`TripContext` için ara parse tiplerini netleştir; `unknown` dönen JSON parse'larını tiplenmiş guard'lardan geçir.
4. **`any` son çare:** Yalnızca gerçekten dinamik/heterojen veride, `eslint-disable-next-line` ile.

### Global tip dosyası

`apps/web/app/types/globals.d.ts` (yeni) oluşturulur:

- `Window["google"]` — Google Identity Services (`accounts.id.renderButton`, `accounts.oauth2`) tek tanım.
- `SpeechRecognition`, `SpeechRecognitionEvent`, `webkitSpeechRecognition` — tarayıcı tipleri.

Dosya-içi `declare global` blokları bu tek kaynağa taşınır; böylece "Subsequent property declarations must have the same type" çakışması biter.

## Components and Interfaces

### Kategori 1: AI (planning.ts, supervisor.ts, route-edit.ts, bedrock-client.ts) — 53 hata

- `planning.ts`: JSON parse çıktıları için `isRecord(v): v is Record<string, unknown>` guard'ı; `value.X` erişimleri guard sonrası. `TripProfile`/`TripContext` dönüşümlerinde eksik alanlar opsiyonel veya guard'lı.
- `supervisor.ts`: `AnswerData` union'ı için `"route" in output.data` / null kontrolü; `output.data` null-guard.
- `route-edit.ts`: literal union (`"none"|"replace"|...`) için guard veya `as const` doğrulaması.
- `bedrock-client.ts`: SDK overload uyumsuzluğu için doğru parametre tipi.

### Kategori 2: Google global (4 dosya) — 12 hata

- `globals.d.ts`'e tek `window.google` tanımı; 4 dosyadaki yerel `declare global` kaldırılır.

### Kategori 3: SpeechRecognition (ai/page.tsx) — 6 hata

- `globals.d.ts`'e SpeechRecognition tipleri; `Trip` cast'i güvenli daraltmayla.

### Kategori 4: Leaflet (desk, k) — 6 hata

- Koordinatlar için `[number, number]` tuple tip anotasyonu; Leaflet metodları için mevcut `Leaflet*` tiplerinin genişletilmesi.

### Kategori 5: Kalanlar — 16 hata

- `profile/page.tsx`, `community/page.tsx`: route/pin union daraltma.
- `analytics/tracker.ts`: index signature (`Record<string, ...>`).
- `google-place-info.tsx`: Place tipi için guard.
- `use-travel-planner.ts`: Pin[] dönüşümü için tip.

## Data Models

Hiçbir veri modeli (localStorage şeması, API DTO, DynamoDB) değişmez. Yalnızca TypeScript tip bildirimleri eklenir/güçlendirilir. Mevcut `packages/contracts` tipleri tek kaynak olarak korunur; yeni domain tipi eklenmez, var olanlar doğru kullanılır.

## Error Handling

Runtime hata yönetimi değişmez. Tip daraltma eklenirken, önceden sessizce çalışan kod yolları (ör. `value.days` erişimi) guard eklendiğinde de aynı runtime sonucu vermelidir — guard'lar yalnızca TS'i tatmin eder, davranışı değiştirmez. Belgeli cast'ler runtime'da no-op'tur.

## Testing Strategy

1. Her dosya grubundan sonra `npm run typecheck` ile hata sayısı ölçülür (monoton azalmalı).
2. Grup bitince `npm run test:web` (web birim testleri yeşil kalmalı).
3. Final: `npm run build` "Failed to type check" olmadan geçmeli.
4. `npm run lint` — yeni `any` kullanımları `eslint-disable` ile; 0 yeni hata.

## Correctness Properties

### Property 1: Hata monotonluğu

Her dosya grubu düzeltildikçe toplam typecheck hata sayısı yalnızca azalmalı, hiçbir adımda artmamalıdır.

**Validates: Requirements 1.1, 6.1**

### Property 2: Runtime davranış korunumu

Hiçbir tip düzeltmesi runtime çıktısını değiştirmemelidir; type guard'lar ve cast'ler yalnızca derleme zamanı etkilidir.

**Validates: Requirements 1.4, 2.3, 5.2**

### Property 3: Global tip tekilliği

`window.google` ve SpeechRecognition tipleri tek bir kaynakta tanımlı olmalı; çoklu çakışan `declare global` bildirimi kalmamalıdır.

**Validates: Requirements 2.1, 3.1**

### Property 4: Build geçerliliği

Tüm düzeltmeler bittiğinde `npm run build` typecheck aşamasını geçmeli ve statik export üretmelidir.

**Validates: Requirements 6.2**

### Property 5: Test ve lint bütünlüğü

Mevcut web testleri yeşil kalmalı; eklenen kod yeni lint hatası üretmemelidir.

**Validates: Requirements 6.3, 6.4**

### Property 6: Strict mod korunumu

`tsconfig` strict ayarları gevşetilmemeli; `ignoreBuildErrors` açılmamalı — hatalar gerçekten çözülmeli, gizlenmemelidir.

**Validates: Requirements 6.1, 6.2**
