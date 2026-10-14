# Soft & Sade Minimalist Tasarım Sistemi Kılavuzu

Bu belge, MapsBridge Web ve Mobil arayüzlerinde yer alan sert, dikkat dağıtıcı ve uyumsuz unicode emojilerin yerine uygulanan modern, sakin, soft ve minimalist tasarım standartlarını belgeler.

---

## 1. Tasarım Felsefesi ve Amacı

Kullanıcının talimatı doğrultusunda:
> *"Web hızlı sistematik ve tüm emojiler yerine soft sade emojiler kullanman olacaktır."*

Geleneksel unicode emojiler (`🔥`, `🚀`, `⚡`, `🎉`, `🌟`, `🗺️`, `❤️`) farklı işletim sistemlerinde (iOS, Android, Windows, macOS) farklı piksellerle çizilmekte, yüksek doygunluklu renkleriyle arayüzün profesyonel ve sakin havasını bozmaktadır. 

Bu tasarım sistemi ile:
1. Tüm sert unicode emojiler elenmiş; yerlerine tek tip çizgi kalınlığına (`strokeWidth={1.8 - 2.0}`) ve yarı saydam yumuşak dolgulara sahip vektörel SVG ikonlar getirilmiştir.
2. Renk paletinde sakinleştirici botanik yeşiller, yumuşak arduvaz gri tonları, dingin çivit mavileri ve pastel amber/gül tonları kullanılmıştır.
3. Bilgi hiyerarşisi yumuşak rozetler (`SoftBadge`) ve minimal çipler ile güçlendirilmiştir.

---

## 2. İkonografi Mimarisi (`SoftIcon`)

### 2.1. Web İkon Bileşeni (`apps/web/app/components/soft-icon.tsx`)
Web tarafında hafif, bağımsız ve saf SVG ile oluşturulmuş `<SoftIcon>` bileşeni kullanılır:
```tsx
import { SoftIcon } from "@/app/components/soft-icon";

// Kullanım örnekleri:
<SoftIcon name="compass" size={16} />
<SoftIcon name="map-pin" size={14} color="#10b981" />
<SoftIcon name="send" size={18} />
<SoftIcon name="heart" size={15} />
<SoftIcon name="edit" size={14} />
<SoftIcon name="trash" size={14} />
<SoftIcon name="sparkle" size={16} />
```

### 2.2. Desteklenen Soft İkon Listesi
| İkon Adı | Karşılık Gelen Anlam | Eski Sert Emoji |
| :--- | :--- | :--- |
| `compass` | Keşif, Rota, Navigasyon | 🧭, 🗺️ |
| `map-pin` | Konum Noktası, Durak | 📍, 📌 |
| `send` | Paylaşım, Gönderi | 🚀, ✉️ |
| `sparkle` / `sparkles` | AI Asistanı, Öne Çıkanlar | ✨, ⚡, 🌟 |
| `heart` | Beğeni, Favori | ❤️, 💖 |
| `chat` | Yorum, Mesajlaşma | 💬, 🗨️ |
| `repeat` | Seyahate Ekle, Yeniden Paylaş | 🔄 |
| `edit` | Düzenle, Kalem | ✏️, 📝 |
| `trash` | Sil, Kaldır | 🗑️, ❌ |
| `user` / `users` | Profil, Gezginler, Topluluk | 👤, 👥 |
| `shield` | Güvenlik, Doğrulama | 🛡️, 🔒 |
| `leaf` | Doğa, Ekolojik Seyahat | 🌱, 🍃 |
| `mountain` | Doğa Yürüyüşü, Macera | ⛰️, 🧗 |
| `bookmark` | Kaydedilenler | 🔖 |
| `tag` | Kategori, Etiket | 🏷️ |

### 2.3. Mobil İkon Desteği (`apps/mobile/src/components/Icons.tsx`)
Mobil ortamda React Native SVG (`react-native-svg`) kullanılarak birebir aynı görsel dile sahip ikonlar deklare edilmiştir:
- `LeafIcon`, `TreesIcon`, `ShieldIcon`, `LogoutIcon`, `MapPinIcon`, `SendIcon`, `HeartIcon`, `TrashIcon`, `PlusIcon`, `CheckIcon`, `CloseIcon`, `TagIcon`.

---

## 3. Renk ve Rozet Sistemi (`SoftBadge`)

Rozetler, yüksek kontrastlı cart renkler yerine %8 - %10 şeffaflıkta zemin ve ince yarı saydam sınır çizgileri (`border: 1px solid rgba(...)`) kullanır:

| Varyant | Zemin Rengi (`bg`) | Metin Rengi (`text`) | İkon Rengi | Kullanım Alanı |
| :--- | :--- | :--- | :--- | :--- |
| `emerald` | `rgba(16, 185, 129, 0.08)` | `#065f46` (Koyu) / `#34d399` (Dark) | `#059669` | Onay, Doğrulanmış Gezgin, Kategori |
| `slate` | `rgba(100, 116, 139, 0.08)` | `#334155` (Koyu) / `#94a3b8` (Dark) | `#64748b` | Hashtagler, Metadata, Konum |
| `indigo` | `rgba(99, 102, 241, 0.08)` | `#3730a3` (Koyu) / `#818cf8` (Dark) | `#4f46e5` | AI Özellikleri, Kültür & Tarih |
| `amber` | `rgba(245, 158, 11, 0.08)` | `#92400e` (Koyu) / `#fbbf24` (Dark) | `#d97706` | Rehberli Turlar, Öne Çıkanlar |
| `rose` | `rgba(244, 63, 94, 0.08)` | `#9f1239` (Koyu) / `#fb7185` (Dark) | `#e11d48` | Beğeniler, Özel Etkinlikler |

---

## 4. Tipografi ve Mikro-Etkileşim Standartları

1. **Yazı Tipleri:** Sistem sans-serif ve Inter tabanlı modern font ailesi ile okunurluk odaklıdır.
2. **Yumuşak Geçişler:** Hover ve dokunma durumlarında `transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)` kullanılır.
3. **Karanlık Mod Uyumu:** Arka planlar agresif saf siyah (`#000000`) yerine derin okyanus arduvazı (`#0A1118`, `#121C26`) ile göz yormayacak şekilde dengelenmiştir.
