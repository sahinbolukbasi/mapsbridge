// Keşfet (native misafir ana sayfası) metinleri (design §9 "Ana sayfa", §10; kararlar S6/S11).
// Web ana sayfasının render ettiği öğelerin anahtarları ve değerleri apps/web/app/locales/{tr,en}.json
// home.* ile BİREBİR aynıdır (apps/web/tests/mobile-parity.test.cjs). home.mobile.* (mağaza/mobil
// bölümü, S6) yoktur. Native'de geçerli olmayan öğeler alınmaz (I10): home.faq.q4/a4 ("bu cihazın
// tarayıcısında saklanır", web'e özgü) ve home.faq.q5/a5 (mobilde dil seçimi yok, arayüz Türkçe),
// home.how.more (/how-it-works/ bağlantısı), home.hero.resume / home.lastTrip.* (yalnız oturumlu web),
// home.sample.* (web örnek önizlemesi). Karar S23: web'deki "sürükleyerek sırala" (native'de yalnız
// Yukarı/Aşağı taşı var) ve "Süreli ve onaya dayalı paylaşım" (native Paylaş süresiz bir Google
// Haritalar bağlantısı gönderir) native'de doğru değildir; bu iki kart native'de HOME_NATIVE_*
// metniyle çizilir. Mobil arayüz Türkçedir (I11 varsayılanı); *_EN parite için tutulur.
export const HOME_TR = {
  "home.hero.eyebrow": "Bağımsız seyahat arkadaşı",
  "home.hero.title": "Gezini anlat. Rotan haritada belirsin.",
  "home.hero.sub":
    "Nereye, kaç gün, nasıl bir tempo? Birkaç dokunuşla netleştir; MapsBridge rotanı gün gün haritaya çizsin ve yolda yanında taşısın.",
  "home.hero.inputLabel": "Nereye gitmek istiyorsun?",
  "home.hero.inputPlaceholder": "Örn. Roma'da 3 gün, yürüyerek ve yemek odaklı",
  "home.hero.submit": "Planlamaya başla",
  "home.hero.chips.label": "Başlangıç önerileri",
  "home.hero.chips.rome": "Roma'da 3 gün",
  "home.hero.chips.cappadocia": "Kapadokya'da hafta sonu",
  "home.hero.chips.lisbon": "Lizbon'u yürüyerek",
  "home.hero.chips.shareCode": "Paylaşım kodum var",
  "home.hero.trust.ranking": "Komisyona göre sıralama yok",
  "home.hero.trust.credits": "Kredi yalnızca AI işlemlerinde düşer",
  "home.hero.trust.welcome": "Ücretsiz hesapla 5 hoş geldin kredisi",
  "home.how.eyebrow": "Nasıl çalışır",
  "home.how.title": "Üç turda taslak rota. Sonra rota üzerinde iyileştir.",
  "home.how.step1.title": "Anlat.",
  "home.how.step1.body": "Şehri ve aklındaki geziyi kendi cümlelerinle yaz. Form doldurmak yok.",
  "home.how.step2.title": "İki soruyu yanıtla.",
  "home.how.step2.body":
    "Her turda en fazla iki soru, her biri dokunulabilir seçeneklerle: tarih, tempo, ilgi alanları.",
  "home.how.step3.title": "Rotan haritada.",
  "home.how.step3.body":
    "Üçüncü turda gün gün taslak rota haritada. Sonrasını rota üzerinde birlikte iyileştiririz.",
  "home.features.title": "Planla, paylaş, yolda yanında taşı.",
  "home.features.planner.title": "Gün gün planlayıcı.",
  "home.features.optimize.title": "Rota optimizasyonu.",
  "home.features.optimize.body":
    "Durak sırasını tek dokunuşla otomatik düzenle; sıra kuş uçuşu mesafeye göre kısaltılır.",
  "home.features.assistant.title": "AI seyahat asistanı.",
  "home.features.assistant.body":
    "Rotayı sohbetle oluştur ve düzenle. Mekan bilgileri veriden gelir, uydurulmaz.",
  "home.features.messages.title": "Mesajlaşma.",
  "home.features.messages.body": "Yol arkadaşlarınla gerçek zamanlı sohbet.",
  "home.features.community.title": "Topluluk.",
  "home.features.community.body": "Gezginlerin paylaştığı rotaları ve rehberleri keşfet.",
  "home.independence.title": "Bilet satmıyoruz. Yanındayız.",
  "home.independence.sub":
    "MapsBridge bir rezervasyon motoru değil. Envanterimiz yok, önerilerimizi kimse satın alamaz.",
  "home.independence.p1.title": "Komisyona göre sıralama yok.",
  "home.independence.p1.body":
    "Öneri sırası yalnızca ilgi alanın, kalite ve rotaya uyuma göre belirlenir.",
  "home.independence.p2.title": "Hazırlık ayrı sekmede.",
  "home.independence.p2.body":
    "Konaklama, ulaşım gibi bağlantılar rota önerilerinin içinde değil, ayrı Hazırlık sekmesinde durur.",
  "home.independence.p3.title": "Uydurma yer yok.",
  "home.independence.p3.body":
    "Adres, saat ve koordinat verisi kaynaktan gelir; asistan yalnızca niyetini anlar ve anlatır.",
  "home.credits.title": "Kredi yalnızca AI çalıştığında düşer.",
  "home.credits.sub":
    "Kredi işlem başlamadan ayrılır, işlem başarısız olursa otomatik iade edilir. Haritada durak eklemek, sıralamak ve paylaşmak kredi harcamaz.",
  "home.credits.cta": "Planları karşılaştır",
  "home.share.title": "Sana bir konum ya da rota mı gönderildi?",
  "home.share.sub":
    "Paylaşım kodunu gir; süresi dolmamış ve onaylanmışsa haritada açılır. Görüntülemek için hesap gerekmez.",
  "home.share.label": "Paylaşım kodu",
  "home.share.submit": "Aç",
  "home.share.error": "Kod 4–64 harf, rakam veya tireden oluşur",
  "home.faq.title": "Sık sorulanlar",
  "home.faq.q1": "Hesap açmadan deneyebilir miyim?",
  "home.faq.a1":
    "Evet. Gezini anlatıp ilk soruları yanıtlayabilir, haritada durak ekleyebilirsin; taslağın cihazında kalır. AI'ın rotanı oluşturması için ücretsiz hesap gerekir.",
  "home.faq.q2": "Kredi ne zaman düşer?",
  "home.faq.a2":
    "Yalnızca sunucuda, ücretli bir AI işlemi başlamadan önce ayrılır. İşlem başarısız olursa otomatik iade edilir. Tercih netleştirme ücretsizdir.",
  "home.faq.q3": "Önerileriniz reklam mı?",
  "home.faq.a3":
    "Hayır. Sıralama komisyona göre yapılmaz; hazırlık bağlantıları ayrı sekmededir ve öneri sırasını etkilemez.",
  "home.final.title": "Bir sonraki gezin bir cümleyle başlasın.",
} as const;

export const HOME_EN = {
  "home.hero.eyebrow": "Independent travel companion",
  "home.hero.title": "Describe your trip. Watch it land on the map.",
  "home.hero.sub":
    "Where, how many days, what pace? Settle it in a few taps and MapsBridge lays your route out day by day on the map and keeps it with you on the road.",
  "home.hero.inputLabel": "Where do you want to go?",
  "home.hero.inputPlaceholder": "e.g. 3 days in Rome, on foot, food-focused",
  "home.hero.submit": "Start planning",
  "home.hero.chips.label": "Starting ideas",
  "home.hero.chips.rome": "3 days in Rome",
  "home.hero.chips.cappadocia": "A weekend in Cappadocia",
  "home.hero.chips.lisbon": "Lisbon on foot",
  "home.hero.chips.shareCode": "I have a share code",
  "home.hero.trust.ranking": "No commission-based ranking",
  "home.hero.trust.credits": "Credits are only used for AI actions",
  "home.hero.trust.welcome": "5 welcome credits with a free account",
  "home.how.eyebrow": "How it works",
  "home.how.title": "A draft route in three turns. Then refine it on the route.",
  "home.how.step1.title": "Describe.",
  "home.how.step1.body":
    "Write the city and the trip you have in mind in your own words. No forms.",
  "home.how.step2.title": "Answer two questions.",
  "home.how.step2.body":
    "At most two questions per turn, each with options you can tap: dates, pace, interests.",
  "home.how.step3.title": "Your route, on the map.",
  "home.how.step3.body":
    "By the third turn your day-by-day draft is on the map. From there we refine it on the route itself.",
  "home.features.title": "Plan it, share it, take it with you.",
  "home.features.planner.title": "Day-by-day planner.",
  "home.features.optimize.title": "Route optimisation.",
  "home.features.optimize.body":
    "Reorder your stops automatically in one tap, shortening the order by straight-line distance.",
  "home.features.assistant.title": "AI travel assistant.",
  "home.features.assistant.body":
    "Build and edit your route by chatting. Place details come from data, never made up.",
  "home.features.messages.title": "Messaging.",
  "home.features.messages.body": "Real-time chat with your travel companions.",
  "home.features.community.title": "Community.",
  "home.features.community.body": "Discover routes and guides shared by travellers.",
  "home.independence.title": "We don't sell tickets. We're with you.",
  "home.independence.sub":
    "MapsBridge isn't a booking engine. We own no inventory, and no one can buy a place in our suggestions.",
  "home.independence.p1.title": "No commission-based ranking.",
  "home.independence.p1.body":
    "Suggestions are ordered only by your interests, quality and fit with the route.",
  "home.independence.p2.title": "Prep lives in its own tab.",
  "home.independence.p2.body":
    "Links for stays or transport sit in a separate Prep tab, never inside route suggestions.",
  "home.independence.p3.title": "No made-up places.",
  "home.independence.p3.body":
    "Addresses, hours and coordinates come from sources; the assistant only understands your intent and explains.",
  "home.credits.title": "Credits are only used when the AI works.",
  "home.credits.sub":
    "Credits are reserved before an action starts and refunded automatically if it fails. Adding, reordering and sharing stops on the map costs nothing.",
  "home.credits.cta": "Compare plans",
  "home.share.title": "Did someone send you a location or a route?",
  "home.share.sub":
    "Enter the share code; if it's still valid and approved, it opens on the map. No account needed to view.",
  "home.share.label": "Share code",
  "home.share.submit": "Open",
  "home.share.error": "A code is 4–64 letters, digits or hyphens",
  "home.faq.title": "Frequently asked questions",
  "home.faq.q1": "Can I try it without an account?",
  "home.faq.a1":
    "Yes. Describe your trip, answer the first questions and add stops on the map; your draft stays on your device. You need a free account for the AI to build your route.",
  "home.faq.q2": "When are credits used?",
  "home.faq.a2":
    "Only on our servers, reserved just before a paid AI action starts and refunded automatically if it fails. Clarifying your preferences is free.",
  "home.faq.q3": "Are your suggestions ads?",
  "home.faq.a3":
    "No. Nothing is ranked by commission; prep links sit in a separate tab and never affect the order of suggestions.",
  "home.final.title": "Let your next trip start with one sentence.",
} as const;

// Yalnız native Keşfet metinleri (S23). Anahtarlar `native.home.` ile başlar ve web locale'de yoktur.
export const HOME_NATIVE_TR = {
  "native.home.features.planner.body":
    "Durak ekle, Yukarı taşı / Aşağı taşı düğmeleriyle sırala, rotanın süresini ve mesafesini gör.",
  "native.home.features.share.title": "Rota paylaşımı.",
  "native.home.features.share.body":
    "Rotanı Google Haritalar bağlantısıyla paylaş; bağlantı durakların konumunu içerir ve süresizdir. Sana gönderilen paylaşım kodlarını buradan açabilirsin.",
} as const;

export const HOME_NATIVE_EN = {
  "native.home.features.planner.body":
    "Add stops, reorder them with Move up / Move down, see your route's time and distance.",
  "native.home.features.share.title": "Route sharing.",
  "native.home.features.share.body":
    "Share your route as a Google Maps link; the link contains your stops' locations and does not expire. Open share codes sent to you from here.",
} as const;

export type HomeKey = keyof typeof HOME_TR | keyof typeof HOME_NATIVE_TR;
const HOME_TEXT: Record<HomeKey, string> = { ...HOME_TR, ...HOME_NATIVE_TR };

/** Keşfet metni (TR). */
export function homeText(key: HomeKey): string {
  return HOME_TEXT[key];
}
