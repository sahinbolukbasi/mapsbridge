# Google Cloud Platform (GCP) ve Google Maps MCP Kurulum Rehberi

Bu rehber, MapsBridge projesinde **Google Cloud Platform (GCP)** ve **Google Maps Platform** servislerinin Model Context Protocol (MCP) ve web uygulaması entegrasyonu için hazırlanmıştır.

---

## 1. Tamamlanan Kurulumlar

1. **Google Cloud SDK (`gcloud-cli` 586.0.0):**
   * Homebrew üzerinden `/opt/homebrew/bin/gcloud` konumuna kuruldu ve doğrulandı.
2. **GCP MCP Server (`@google-cloud/gcloud-mcp`):**
   * Google'ın resmi MCP sunucusu entegre edildi. Doğrudan `gcloud` CLI ve GCP API'leri ile konuşur.
3. **Google Maps MCP Server (`@modelcontextprotocol/server-google-maps`):**
   * Standart referans sunucu entegre edildi (`maps_geocode`, `maps_reverse_geocode`, `maps_search_places`, `maps_place_details`, `maps_distance_matrix`, `maps_directions`).
4. **Google Maps Code Assist MCP:**
   * Google'ın resmi uzak streamable HTTP MCP servisi (`https://mapscodeassist.googleapis.com/mcp`) eklendi.
5. **Workspace MCP Yapılandırması:**
   * [`.agents/mcp_config.json`](../../.agents/mcp_config.json) dosyası oluşturuldu.

---

## 2. `.agents/mcp_config.json` Yapılandırması

```json
{
  "mcpServers": {
    "gcp": {
      "command": "npx",
      "args": ["-y", "@google-cloud/gcloud-mcp"],
      "env": {
        "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
      }
    },
    "google-maps": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-google-maps"],
      "env": {
        "GOOGLE_MAPS_API_KEY": "${GOOGLE_MAPS_API_KEY}"
      }
    },
    "google-maps-code-assist": {
      "serverUrl": "https://mapscodeassist.googleapis.com/mcp"
    }
  }
}
```

---

## 3. Google Cloud Hesabı ile Giriş (Authentication)

GCP MCP sunucusunun projelerinizi ve kaynaklarınızı yönetebilmesi için terminalde Google hesabınızla bir defa oturum açmanız gerekmektedir:

```bash
# 1. Google Cloud hesabınızla oturum açın
gcloud auth login

# 2. Uygulama Varsayılan Kimlik Bilgilerini (ADC) ayarlayın
gcloud auth application-default login

# 3. Google Cloud projenizi seçin (Mevcut OAuth projeniz: 393729296050)
gcloud config set project YOUR_PROJECT_ID
```

---

## 4. Google Maps Platform API'lerinin Etkinleştirilmesi

Google Cloud Console üzerinden ([console.cloud.google.com](https://console.cloud.google.com/)) ilgili projeyi seçerek aşağıdaki API'leri **"APIs & Services" > "Library"** sekmesinden etkinleştirin:

1. **Maps JavaScript API** *(Web arayüzünde haritayı yüklemek için)*
2. **Places API (New)** *(Mekan arama, puan ve detay çekmek için)*
3. **Geocoding API** *(Adres - Koordinat dönüşümü için)*
4. **Directions API / Routes API** *(Rota ve yol tarifi hesaplamak için)*
5. **Distance Matrix API** *(Mekanlar arası mesafe matrisi için)*

---

## 5. API Anahtarlarının Yapılandırılması

### A. Web Frontend İçin (`apps/web/.env.local`)
Web uygulaması harita bileşeni için `apps/web/.env.local` dosyasına aşağıdaki satırları ekleyin:

```env
# Google Cloud Console -> APIs & Services -> Credentials -> Create API Key
# (Güvenlik için bu anahtara "HTTP Referrer" kısıtlaması ekleyin: localhost:3000, mapsbridge.com)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...

# Google Cloud Console -> Google Maps Platform -> Map Management -> Create Map ID (JavaScript / Vector)
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=YOUR_MAP_ID
```

> **Not:** `apps/web/app/lib/google/maps-client.ts` bu iki değişken tanımlandığında Google Maps ve Places Library'yi otomatik olarak aktif hale getirmektedir.

### B. MCP Araçları İçin (Terminal / Shell Ortamı)
MCP sunucusunun terminalde çalışabilmesi için `GOOGLE_MAPS_API_KEY` ortam değişkenini tanımlayın:

```bash
# ~/.zshrc dosyanıza ekleyebilirsiniz:
export GOOGLE_MAPS_API_KEY="AIzaSy..."
```

---

## 6. MCP Araçlarının Kullanımı

Kurulum tamamlandığında Antigravity asistanı aşağıdaki MCP araçlarını doğrudan kullanabilir hale gelir:

| Araç Adı | Açıklama |
| :--- | :--- |
| `gcloud` | GCP projeleri, Cloud Storage, Compute, Cloud Run ve IAM kaynaklarını yönetir |
| `maps_geocode` | Bir adresi enlem/boylam koordinatlarına çevirir |
| `maps_reverse_geocode` | Koordinatlardan açık adres bilgisini getirir |
| `maps_search_places` | Belirli bir konum etrafında restoran, otel, müze gibi mekanları arar |
| `maps_place_details` | Bir mekanın çalışma saatleri, puanı ve detaylarını getirir |
| `maps_directions` | İki veya daha fazla nokta arasında yol tarifi ve süre hesaplar |
| `maps_distance_matrix` | Çoklu noktalar arası mesafe ve seyahat sürelerini karşılaştırır |
