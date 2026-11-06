// Kimlik sayfası görsel panelleri (Increment 3.2). Yalnız gerçek ürün yetenekleri (direction §4):
// kodla paylaşım, gün gün harita, cihazda saklanan duraklar (I12 kapsamı: durak/koordinat/sıra),
// kredi yalnız AI'da, hoş geldin kredisi (WELCOME_CREDITS_DISPLAY). Uydurma istatistik yok.
import type { IconName } from "../ui";
import { WELCOME_CREDITS_DISPLAY } from "../../lib/billing/credit-costs";

type Visual = {
  src: string;
  alt: string;
  place: string;
  heading: string;
  features: readonly { icon: IconName; title: string; body: string }[];
};

export const AUTH_VISUALS: Record<"login" | "register" | "reset" | "verify", Visual> = {
  login: {
    src: "/images/kapadokya-balloons.jpg",
    alt: "Kapadokya'da gün doğumunda sıcak hava balonları",
    place: "Kapadokya · Türkiye",
    heading: "Kaldığın günden, kaldığın duraktan devam.",
    features: [
      {
        icon: "map",
        title: "Gün gün harita",
        body: "Kayıtlı rotaların hesabınla açılır, duraklar aynı sırayla gelir.",
      },
      {
        icon: "offline",
        title: "Çevrimdışı duraklar",
        body: "Duraklar, koordinatlar ve sıra cihazında saklanır.",
      },
    ],
  },
  register: {
    src: "/images/tokyo-shinjuku.jpg",
    alt: "Tokyo Shinjuku'da gece ışıklı tabelalar ve yağmurlu sokak",
    place: "Shinjuku · Tokyo",
    heading: "Bir hesapla rotan her oturumda seninle.",
    features: [
      {
        icon: "key",
        title: "Kodla paylaşım",
        body: "Süreli, onaylı bağlantıyla grubun aynı haritayı görür.",
      },
      {
        icon: "route",
        title: "Gün gün rota",
        body: "Durakları günlere böl, sırala, aradaki süreyi gör.",
      },
      {
        icon: "coin",
        title: `${WELCOME_CREDITS_DISPLAY} hoş geldin kredisi`,
        body: "Kredi yalnız AI işlemlerinde düşer; planlayıcı ve paylaşım ücretsiz.",
      },
    ],
  },
  reset: {
    src: "/images/kapadokya-balloons.jpg",
    alt: "Kapadokya'da gün doğumunda sıcak hava balonları",
    place: "Kapadokya · Türkiye",
    heading: "Rotaların hesabında güvende bekliyor.",
    features: [
      {
        icon: "lock",
        title: "Güçlü şifre",
        body: "En az 12 karakter, harf, rakam ve sembol kuralı.",
      },
    ],
  },
  verify: {
    src: "/images/tokyo-shinjuku.jpg",
    alt: "Tokyo Shinjuku'da gece ışıklı tabelalar ve yağmurlu sokak",
    place: "Shinjuku · Tokyo",
    heading: "Bir adım kaldı: kodu gir, rotan hazır.",
    features: [
      {
        icon: "coin",
        title: `${WELCOME_CREDITS_DISPLAY} hoş geldin kredisi`,
        body: "Doğrulanan yeni hesaba tanımlanır; kredi yalnız AI işlemlerinde düşer.",
      },
    ],
  },
};
