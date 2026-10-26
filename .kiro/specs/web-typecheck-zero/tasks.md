# Implementation Plan

## Overview

93 web typecheck hatasını davranış değiştirmeden sıfıra indirir. En yoğun/izole kümeden başlanır; her gruptan sonra `npm run typecheck` ile ilerleme ölçülür. Son adımda `npm run build` geçmelidir.

## Task Dependency Graph

```
Görev 1 (global tipler .d.ts)
   ├─> Görev 2 (Google auth 4 dosya)
   └─> Görev 3 (SpeechRecognition / ai page)
Görev 4 (AI planning+supervisor)   [bağımsız]
Görev 5 (Leaflet)                  [bağımsız]
Görev 6 (kalan dosyalar)           [bağımsız]
Görev 7 (build + test + lint)      [1-6 sonrası]
```

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "4", "5", "6"] },
    { "wave": 2, "tasks": ["2", "3"] },
    { "wave": 3, "tasks": ["7"] }
  ]
}
```

## Tasks

- [x] 1. Paylaşılan global tip dosyasını oluştur
  - `apps/web/app/types/globals.d.ts` oluştur: `Window["google"]` (accounts.id.renderButton, accounts.oauth2) ve `SpeechRecognition`/`SpeechRecognitionEvent`/`webkitSpeechRecognition` tek tanım
  - Mevcut dosyalardaki çakışan `declare global` bloklarının yerini bu tek kaynak alacak (Görev 2 ve 3'te kaldırılır)
  - _Requirements: 2.1, 3.1_

- [x] 2. Google kimlik doğrulama bileşenlerini tiplendir
  - `google-auth-button.tsx`, `google-one-tap.tsx`, `login/page.tsx`, `register/page.tsx` içindeki yerel `declare global` bloklarını kaldır; globals.d.ts'e güven
  - `renderButton`, `oauth2` erişimlerinin tiplendiğini doğrula
  - `npm run typecheck` (bu 4 dosya 0 hata) + runtime OAuth akışı korunur
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. SpeechRecognition ve Trip cast'ini çöz (ai/page.tsx)
  - globals.d.ts'teki SpeechRecognition tiplerini kullan
  - `Trip` dönüşümündeki cast'i güvenli/belgeli daraltmayla değiştir
  - `npm run typecheck` (ai/page.tsx 0 hata)
  - _Requirements: 3.1, 3.2_

- [x] 4. AI planlama modülünü tiplendir
- [x] 4.1 `planning.ts` daraltma (36 hata)
  - `isRecord` type guard ekle; `value.X` erişimlerini guard sonrası yap; `TripProfile`/`TripContext` dönüşümlerinde eksik alanları opsiyonel/guard'lı yap
  - Runtime prompt/parse davranışı korunur
  - `npm run typecheck`
  - _Requirements: 1.1, 1.4_
- [x] 4.2 `supervisor.ts` daraltma (14 hata)
  - `AnswerData` union'ı için `"route" in data` / null kontrolü; `output.data` null-guard; `toolCalls` erişimini daralt
  - `npm run typecheck`
  - _Requirements: 1.2, 1.4_
- [x] 4.3 `route-edit.ts` ve `bedrock-client.ts` (3 hata)
  - route-edit: literal union guard; bedrock-client: SDK overload parametre tipi
  - `npm run typecheck`
  - _Requirements: 1.3, 1.4_

- [x] 5. Leaflet kullanan sayfaları tiplendir
  - `desk/page.tsx` (4), `k/page.tsx` (2): koordinatlar için `[number, number]` tuple anotasyonu; `setView`/`addTo` için Leaflet tip genişletmesi
  - `npm run typecheck` + `npm run test:web`
  - _Requirements: 4.1, 4.2_

- [x] 6. Kalan dosyaları tiplendir
  - `profile/page.tsx` (6), `community/page.tsx` (2): route/pin union daraltma
  - `analytics/tracker.ts` (4): index signature (`Record<string, ...>`)
  - `google-place-info.tsx` (3): Place guard
  - `use-travel-planner.ts` (1): Pin[] dönüşüm tipi
  - `npm run typecheck`
  - _Requirements: 5.1, 5.2_

- [x] 7. Build, test ve lint bütünlüğü
  - `npm run typecheck` → 0 hata
  - `npm run build` → "Failed to type check" olmadan statik export
  - `npm run test:web` → 0 başarısızlık
  - `npm run lint` → 0 yeni hata (zorunlu any'ler eslint-disable ile)
  - `tsconfig` strict korundu, ignoreBuildErrors açılmadı
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

## Notes

- Hiçbir runtime mantığı değişmez — yalnızca tipler, guard'lar ve global bildirimler.
- `any` yalnızca gerçekten dinamik veride ve `eslint-disable-next-line` gerekçesiyle kullanılır.
- `strict` mod ve `ignoreBuildErrors` kesinlikle değiştirilmez — hatalar çözülür, gizlenmez.
- Her görev sonrası typecheck hata sayısı azalmalı (Property 1); artarsa o adım geri alınır.
