# Test Stratejisi, Piramidi ve Doğrulama Rehberi

Bu belge, sistemin test standartlarını, test piramidini ve kabul kriterlerini açıklar.

---

## 1. Test Piramidi (Test Pyramid)

```text
       ▲
      / \     E2E Testleri (Playwright - Kritik Akışlar)
     /   \    (Kayıt ➔ Harita ➔ AI Rota Üretimi ➔ Ödeme)
    /─────\
   /       \   Entegrasyon Testleri (Node --test)
  /         \  (Lambda Handlers + Mock DynamoDB / Stripe / Cognito)
 /───────────\
/             \ Birim Testleri (Domain Mantığı, Kredi Hesaplama, OSRM)
───────────────
```

---

## 2. Testleri Çalıştırma Komutları

Tüm test paketini çalıştırmak için kök dizinde:

```bash
# Frontend ve AI birim testleri
npm test

# Backend Lambda ve entegrasyon güvenlik testleri
npm run test:backend

# İkisini birlikte tek seferde çalıştırma (Zorunlu Kabul Testi)
npm test && npm run test:backend
```

# Canlı sentetik canary izleme (CloudFront + API Gateway)
npm run monitor:synthetics

# Tip güvenliği denetimi
npm run typecheck
```

Mobil ve e2e Playwright testleri:
```bash
npm --prefix apps/web run test:mobile
```

---

## 3. Kabul Kriterleri (Acceptance Criteria)

Bir değişikliğin geçerli sayılabilmesi için:
1. **230/230 Test Yeşil Kalmalıdır:** 120 adet frontend, AI ve evaluation testi (`npm test`) ile 110 adet backend Lambda, güvenlik ve yetkilendirme testi (`npm run test:backend`) eksiksiz geçmelidir.
2. **Canary Denetimleri Geçmelidir:** `npm run monitor:synthetics` canlı CloudFront ve API Gateway uç noktalarında 5/5 başarılı olmalıdır.
3. **Kredi Muhasebesi İhlali Yapılamaz:** Yetersiz bakiye, eşzamanlı harcama ve mükerrer ödeme senaryoları test edilmelidir.
4. **Rol İhlali Yapılamaz:** Askıya alınmış kullanıcıların API'ye erişemediği doğrulanmalıdır.
5. **Yeni Özellik Test Kapsamı:** Eklenen her yeni use-case veya domain kuralı için en az bir birim veya entegrasyon testi yazılmalıdır.
