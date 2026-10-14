# Seyahat intake modeli pilotu

Üretim modeli değiştirilmez. Önce mevcut Haiku, eğitilmemiş küçük model ve fine-tuned küçük model aynı değerlendirme senaryolarında karşılaştırılır. `CUSTOM_MODEL_ENABLED=true` ve `BEDROCK_INTAKE_MODEL_ID` yalnız niyet/profil çıkarımını aday modele yönlendirir; geçersiz yanıt için toplam süre bütçesi içinde tek referans-model denemesi vardır. Farklı bölgedeki model ID'si Frankfurt istemcisine doğrudan verilemez; inference bölgesi/dağıtımı doğrulanmadan etkinleştirmeyin.

Girdi JSONL: her satır `groupId`, `source` (`editorial` veya `synthetic_reviewed`), `reviewed`, `reviewer`, `rights`, `containsPersonalData:false`, `system` ve `messages` içerir. Mesajlar Nova metin bloklarını kullanır: `{"role":"user","content":[{"text":"Roma'da üç günüm var."}]}`. İlgili konuşmalar ve yakın rota şablonları aynı groupId altında tutulmalıdır; araç kullanan örnekler bu ilk metin pilotuna dahil değildir.

```sh
python3 training/travel/prepare.py reviewed.jsonl training/travel/runs/v1
node training/travel/submit.cjs training/travel/config.json training/travel/runs/v1
# İncelenen iş isteğini göndermek için:
node training/travel/submit.cjs training/travel/config.json training/travel/runs/v1 --submit
```

Hazırlama en az 2.000 insan denetimli örnek ister; yakın kopya incelemesi etiketleme sürecinin sorumluluğundadır. Script tam kopyaları reddeder, grup bazlı %80/%10/%10 ayırır, checksum üretir. Submit varsayılan olarak yalnız iş JSON'u üretir. `--submit` train/validation dosyalarını KMS ile S3'e yükler ve ücretli işi başlatır; test setini yüklemez.

Bu çalışma 2.000–5.000 uzman onaylı örnek veya 300–500 uzman değerlendirmesi üretildiğini iddia etmez. Böyle bir veri seti projede hazır bulunmadı; eğitim işi başlatılmadı. Sentetik çıktıya insan onayı etiketi otomatik verilmez. Kişisel konuşmalar bu pilotta kabul edilmez.

Kabul: şema ≥%99, kapsam/düzeltme ve açık kısıt uyumu ≥%95, mevcut modele göre görev başarısında en fazla 2 puan düşüş; bütün eğitim/sunum/fallback giderleriyle başarılı görev maliyetinde ≥%20 düşüş veya belgeli kalite kazanımı. Mevcut `npm run eval:ai` ücretli gerçek servis değerlendirmesidir; model karşılaştırması için aynı senaryolar ve RAG sürümüyle ayrı raporlar alınmalıdır. Sonuçlar olmadan aday üretime açılmaz.

AWS belgeleri: [Nova eğitim veri biçimi](https://docs.aws.amazon.com/bedrock/latest/userguide/model-customization-prepare.html), [model/bölge desteği](https://docs.aws.amazon.com/bedrock/latest/userguide/custom-model-fine-tuning.html), [customization job](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_CreateModelCustomizationJob.html).
