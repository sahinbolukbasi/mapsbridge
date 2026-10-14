# ROADMAP.md — 14 Aşamalı Geliştirme Yol Haritası & Önceliklendirme Matrisi

Bu belge, MapsBridge AI Seyahat Platformu'nun mevcut çalışan sistemini bozmadan, aşamalı (incremental) ve test odaklı şekilde ChatGPT seviyesinde bir AI-First platforma dönüştürülmesinin 14 aşamalı ana planıdır.

---

## 1. Önceliklendirme Matrisi (Priority Classification)

| Öncelik | Kapsam ve Odak | Aşamalar (Phases) |
|---|---|---|
| **P0: Kritik Temel & Mimari Bütünlük** | Mevcut sistem analizi, domain sınırları, diyalog motoru, tool sözleşmeleri, 230 yeşil testin korunması. | **Phase 1, Phase 2, Phase 3, Phase 4** |
| **P1: Akıllı Hafıza, Profil & Rota Üretimi** | 4 katmanlı hafıza, kullanıcı seyahat profili, çok kriterli öneri motoru, sohbetten eyleme seyahat sentezi. | **Phase 5, Phase 6, Phase 7, Phase 8** |
| **P2: Gerçek Zamanlı Veriler, Hibrit RAG & FinOps** | Canlı hava durumu, etkinlik/ulaşım entegrasyonu, hibrit vektör arama, token maliyet optimizasyonu ve semantik cache. | **Phase 9, Phase 10, Phase 11** |
| **P3: Gözlemlenebilirlik, Değerlendirme & Üretim** | Dağıtık izleme, AI kalite skorlama sistemi, evals değerlendirme senaryoları, SLA/SLO sertleştirme. | **Phase 12, Phase 13, Phase 14** |

---

## 2. 14 Aşamalı Uygulama Detayları

```mermaid
gantt
    title MapsBridge AI Seyahat Platformu Yol Haritası
    dateFormat  YYYY-MM-DD
    section P0: Temel & Mimari
    Phase 1: Sistem Analizi             :done, p1, 2026-09-27, 1d
    Phase 2: Domain Haritası            :done, p2, after p1, 1d
    Phase 3: AI Diyalog Mimarisi        :done, p3, after p2, 1d
    Phase 4: Tool-First Mimarisi        :done, p4, after p3, 1d
    section P1: Hafıza & Rota
    Phase 5: 4 Katmanlı Hafıza          :active, p5, after p4, 2d
    Phase 6: Seyahat Profili            :p6, after p5, 2d
    Phase 7: Öneri & Puanlama Motoru    :p7, after p6, 2d
    Phase 8: Rota Sentezi & Aksiyon     :p8, after p7, 2d
    section P2: Veri & FinOps
    Phase 9: Real-time Entegrasyonlar   :p9, after p8, 3d
    Phase 10: Hibrit RAG & Vektör DB    :p10, after p9, 2d
    Phase 11: Maliyet & Semantik Cache  :p11, after p10, 2d
    section P3: İzleme & Sertleştirme
    Phase 12: Dağıtık İzleme (Tracing)  :p12, after p11, 2d
    Phase 13: AI Kalite & Evals         :p13, after p12, 2d
    Phase 14: Production Hardening      :p14, after p13, 2d
```

### Aşama Detayları:

#### PHASE 1: Existing System Analysis (Tamamlandı)
- Mevcut Next.js 16 SPA, 6 Mikroservis, Lambda handler'ları ve DynamoDB şeması incelendi.
- `CURRENT_ARCHITECTURE.md` belgesi oluşturuldu.

#### PHASE 2: Domain Map (Tamamlandı)
- 18 Bounded Context (`Identity`'den `Notifications`'a) aggregate'leri ve değişmezleriyle belirlendi.
- `DOMAIN_MAP.md` belgesi oluşturuldu.

#### PHASE 3: AI Architecture (Tamamlandı)
- Conversation-first diyalog akışı, akıllı dinamik soru motoru, yapılandırılmış JSON çıktısı tasarlandı.
- `AI_ARCHITECTURE.md` belgesi oluşturuldu.

#### PHASE 4: Tool Architecture (Tamamlandı)
- 18 standart fonksiyon aracı (Tools) ve sağlayıcı yedeklilik (fallback) mimarisi modellendi.
- `TOOLS.md` belgesi oluşturuldu.

#### PHASE 5: Memory Architecture (P1)
- 4 katmanlı hafıza ayrımı: Session, Trip, User Preference ve Platform Knowledge kodlandı.
- Seçici hafıza geri çağırma (`selective retrieval`) ile gereksiz token yükü engellendi.

#### PHASE 6: Travel Profile (P1)
- Kullanıcı seyahat profili şeması (`schemas/trip-profile.json`) ve şeffaf kullanıcı tercihleri paneli (`/profile/edit`) entegre edildi.

#### PHASE 7: Recommendation Engine (P1)
- 10 parametreli restoran ve mekan puanlama formülü implemente edildi; turist tuzakları elendi.

#### PHASE 8: Trip Generation & Dynamic Replanning (P1)
- Chat'ten harita masasına doğrudan pin ve gün aktarımı (`ADD_PINS_TO_DAY`) bağlandı.
- Hava durumu veya gecikme durumunda anında dinamik yeniden planlama (Dynamic Replanning) sağlandı.

#### PHASE 9: Real-time Integrations (P2)
- Canlı hava durumu (Open-Meteo), çalışma saatleri doğrulama ve etkinlik takvimi entegrasyonu.

#### PHASE 10: Hybrid RAG & Vector Search (P2)
- Titan Text Embeddings V2 + Coğrafi Yarıçap (Geo Radius) filtreli hibrit arama devreye alındı.

#### PHASE 11: Cost Optimization & Semantic Cache (P2)
- Intent bazlı telemetri, 6 varlık önbelleği ve benzer sorular için Semantik Önbellek aktif edildi.

#### PHASE 12: Observability & Distributed Tracing (P3)
- AWS X-Ray ve `x-correlation-id` ile uçtan uca alt ajan izleme.

#### PHASE 13: Evaluation & Regression Testing (P3)
- `evals/` test senaryoları ve kullanıcı geri bildirim sinyalleri (Conversion Rate) takibi.

#### PHASE 14: Production Hardening (P3)
- Multi-region failover, CloudWatch P1/P2 alarmları, 10.000 eşzamanlı kullanıcı yük testi.

---

## 3. Faz Kapanış Raporlama Standardı

Her geliştirme fazı tamamlandığında aşağıdaki 6 metrik zorunlu olarak kullanıcıya raporlanacaktır:
1. **Implemented (Uygulananlar):** Tamamlanan özellikler ve dosyalar.
2. **Missing (Kalanlar):** Bir sonraki faza devredilen işler.
3. **Technical Debt (Teknik Borç):** Varsa refactor gereksinimi.
4. **Security Risks (Güvenlik Riskleri):** Yetki veya veri sızıntı denetimi.
5. **Performance Risks (Performans Riskleri):** Gecikme ve SLA/SLO eşikleri.
6. **Estimated AI Cost (Tahmini Yapay Zekâ Maliyeti):** İstek başına harcanan token ve dolar karşılığı.
