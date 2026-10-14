# SECURITY.md — Güvenlik, Gizlilik, Guardrails & Kötü Amaçlı Kullanım Kalkanı

Bu belge, MapsBridge AI Asistanı'nın kötü niyetli saldırılara (Jailbreak, Prompt Injection), seyahat dışı konu istismarına, kişisel veri sızıntılarına ve hesap güvenliği ihlallerine karşı savunma hatlarını tanımlar.

---

## 1. Savunma Hatları Mimarisi (Defense-in-Depth)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        KULLANICI GİRDİSİ (INPUT)                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              1. SAVUNMA HATTI: AĞ & KİMLİK DENETİMİ                    │
│  - API Gateway Throttling (Rate Limiting: 10 istek/dakika)             │
│  - Cognito JWT Doğrulaması (Geçersiz veya askıdaki hesaplar 401 alır) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             2. SAVUNMA HATTI: PII & HASSAS VERİ MASKELEME              │
│  - Kredi Kartı, TC Kimlik No, SSN, Telefon, E-posta maskeleme          │
│  - Maskelenmemiş veri asla LLM sağlayıcısına veya loglara gitmez      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│           3. SAVUNMA HATTI: PROMPT-INJECTION & JAILBREAK KALKANI       │
│  - "DAN mode", "Önceki kuralları unut", "Sistem promptunu yaz" engeli  │
│  - Karakter manipülasyonu ve Base64 gizleme saldırılarının tespiti    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               4. SAVUNMA HATTI: SEYAHAT KAPSAM DENETİMİ                │
│  - Yazılım geliştirme / kod üretimi KESİNLİKLE YASAKTIR                │
│  - Kripto para, finansal yatırım ve siyaset KESİNLİKLE YASAKTIR        │
│  - Reddetme yanıtı: Ücretsiz (0 kredi düşülür), nazik seyahat rehberi  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             5. SAVUNMA HATTI: ÇIKTI FİLTRESİ & GÜVENLİ LİNKLER         │
│  - Yalnızca onaylı HTTPS protokolleri                                  │
│  - Halüsinatif sahte rezervasyon veya ödeme linklerinin elenmesi       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Seyahat Dışı Konu Engelleme (`validateTravelScope`)

MapsBridge genel bir soru-cevap robotu değildir. Aşağıdaki konular tespit edildiğinde işlem doğrudan durdurulur ve kullanıcı kredisi harcanmaz:

- **Yazılım & Kodlama:** Python, JavaScript, CSS, SQL sorgusu istemleri.
- **Kripto & Finans:** Bitcoin, borsa tahminleri, yatırım tavsiyeleri.
- **Akademik & Genel:** Matematik denklemleri, felsefi veya siyasi makaleler.
- **Tıbbi Teşhis:** İlaç reçetesi veya hastalık teşhisi (yalnızca yerel 112/911 acil yardım ve hastane adresi verilebilir).

### Standart Reddedilme Yanıtı:
> *"Ben MapsBridge uzman seyahat danışmanınızım. Yalnızca seyahat rotaları, konaklama, yerel lezzetler ve şehir keşfi konularında yardımcı olabilirim. Seyahat etmek istediğiniz bir şehir varsa size memnuniyetle rehberlik edebilirim."*

---

## 3. Kullanıcı Gizliliği ve Tercih Kontrolü (Privacy & GDPR/KVKK)

1. **Açık Rıza:** Kişiselleştirilmiş seyahat hafızası tamamen kullanıcının açık onayına (`opt-in`) bağlıdır.
2. **Şeffaf Profil:** Kullanıcı dilediği an profilinde biriken tercihleri inceleyebilir, belirli tercihleri silebilir veya tamamen devre dışı bırakabilir.
3. **Eğitim Verisi Anonimleştirme:** Fine-tuning için toplanan JSONL veri setlerinde kullanıcı kimliği (`userId`), e-posta ve gerçek isimler kesinlikle saklanmaz; sadece soyutlaştırılmış diyalog blokları tutulur.
