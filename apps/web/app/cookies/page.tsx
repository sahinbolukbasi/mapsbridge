import { LegalRelated } from "../components/legal-related";
import { Card, PageHeader, PageShell, Section } from "../components/ui";
import { GUEST_DRAFT_KEY } from "../lib/guest/guest-draft";
import { PLANNER_TRIPS_KEY } from "../lib/trip/planner-store";
import "../styles/legal.css";

// Başlık registry'den ("Çerez politikası"). Her satır koddaki gerçek bir anahtara karşılık gelir:
// mb_session (lib/auth-context.tsx), locale (lib/auto-locale.ts), oturum anahtarları ve çıkışta
// silinenler (lib/cognito.ts signOut), planlayıcı (lib/trip/planner-store.ts) ve misafir taslağı
// mapsbridge.guestDraft.v1 (lib/guest/guest-draft.ts, 7 gün; design §6.2), hesaba bağlı kayıtlar
// (lib/user-storage.ts: AI sohbet geçmişi, profil ayrıntıları), doğrudan mesajlar
// (features/messaging/conversations.ts), kullanım olayları (lib/analytics.ts), harita önbelleği
// (lib/google/places-cache.ts). lib/billing/billing-service.ts saveBillingDetails çağrılmadığı için
// mapsbridge.billing_details yazılmaz ve listelenmez.
// Liste tam envanter iddiası taşımaz; KVKK metni yayından önce sahibince onaylanmalıdır.
type StorageRow = { name: string; keys: string; kind: string; purpose: string; lifetime: string };

const ROWS: readonly StorageRow[] = [
  {
    name: "Oturum çerezi",
    keys: "mb_session",
    kind: "Çerez · zorunlu",
    purpose:
      "Giriş yaptığını sayfa sunucusuna bildirir. Değeri yalnızca 1'dir, kimlik bilgisi taşımaz.",
    lifetime: "24 saat ya da çıkış yapana kadar",
  },
  {
    name: "Dil tercihi",
    keys: "locale",
    kind: "Çerez · tercih",
    purpose: "Seçtiğin ya da algılanan dili (Türkçe/İngilizce) hatırlar.",
    lifetime: "1 yıl",
  },
  {
    name: "Oturum anahtarları",
    keys: "mapsbridge.accessToken, mapsbridge.idToken, mapsbridge.refreshToken, mapsbridge.userEmail, mapsbridge.loginTime",
    kind: "Yerel depolama · zorunlu",
    purpose:
      "Hesabına giriş yapılmış halde kalmanı sağlar. E-posta adresin ve giriş zamanın da bu cihazda tutulur.",
    lifetime: "Çıkış yapana kadar",
  },
  {
    name: "Planlayıcı verisi",
    keys: PLANNER_TRIPS_KEY,
    kind: "Yerel depolama · işlev",
    purpose:
      "Rotalarının durakları, koordinatları, gün ve sıra bilgisi; bağlantı koptuğunda listen görünür kalır.",
    lifetime: "Çıkış yapana ya da tarayıcı verisini silene kadar",
  },
  {
    name: "Cihazda saklanan taslak",
    keys: GUEST_DRAFT_KEY,
    kind: "Yerel depolama · işlev",
    purpose:
      "Hesap açmadan asistanda verdiğin yanıtlar: gezi metni, süre, tempo ve ilgi alanları. Kişisel veri içermez.",
    lifetime:
      "En fazla 7 gün; taslağı sildiğinde, taslaktan yapılan istek başarılı olduğunda ya da çıkış yaptığında daha erken silinir",
  },
  {
    name: "Hesaba bağlı kayıtlar",
    keys: "mapsbridge.account.<e-posta>.*",
    kind: "Yerel depolama · işlev",
    purpose:
      "Giriş yaptığında asistan sohbet geçmişin (en fazla 15 sohbet) ve profil ayrıntıların bu cihazda hesabına ayrılmış olarak tutulur.",
    lifetime: "Sohbeti silene ya da tarayıcı verisi silinene kadar",
  },
  {
    name: "Doğrudan mesajlar",
    keys: "mapsbridge.directMessages",
    kind: "Yerel depolama · işlev",
    purpose: "Mesajlar sayfasındaki sohbet listesini ve okunmamış sayısını gösterir.",
    lifetime: "Tarayıcı verisi silinene kadar",
  },
  {
    name: "Kullanım olayları",
    keys: "mapsbridge.analyticsEvents",
    kind: "Yerel depolama · ölçüm",
    purpose: "Topluluk gönderisi görüntüleme olaylarının son 1000 kaydı bu cihazda tutulur.",
    lifetime: "Tarayıcı verisi silinene kadar",
  },
  {
    name: "Harita önbelleği",
    keys: "mapsbridge.cache.*",
    kind: "Yerel depolama · işlev",
    purpose: "Yer ayrıntısı, yer araması ve adres sonuçlarını tekrar sorgulamamak için saklar.",
    lifetime: "Aramalar 24 saat, yer ayrıntıları 7 gün, adresler 30 gün",
  },
];

export default function Cookies() {
  return (
    <PageShell
      className="legal"
      header={
        <PageHeader
          description="MapsBridge'in tarayıcında sakladığı çerezler ve yerel depolama kayıtları."
          breadcrumb={[{ label: "Ana sayfa", href: "/" }, { label: "Çerez politikası" }]}
        />
      }
    >
      <p>
        MapsBridge oturum güvenliği, dil tercihin, planlama ve hesap işlevleri için çerez ve yerel
        depolama (localStorage) kullanır. Başlıca kayıtlar aşağıda listelenir.
      </p>
      <Section title="Saklananlar">
        <ul className="legal-storage">
          {ROWS.map((row) => (
            <Card as="li" key={row.keys} className="legal-storage__item">
              <h3 className="legal-cards__title">{row.name}</h3>
              <dl className="legal-storage__list">
                <div className="legal-storage__row">
                  <dt>Anahtar</dt>
                  <dd>
                    <code className="legal-code">{row.keys}</code>
                  </dd>
                </div>
                <div className="legal-storage__row">
                  <dt>Tür</dt>
                  <dd>{row.kind}</dd>
                </div>
                <div className="legal-storage__row">
                  <dt>Amaç</dt>
                  <dd>{row.purpose}</dd>
                </div>
                <div className="legal-storage__row">
                  <dt>Süre</dt>
                  <dd>{row.lifetime}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </ul>
      </Section>
      <Section title="Üçüncü taraf takibi">
        <p>
          Reklam veya pazarlama çerezleri kullanılmaz. Harita verileri açık kaynak OpenStreetMap
          üzerinden sunulur.
        </p>
      </Section>
      <LegalRelated current="/cookies/" />
    </PageShell>
  );
}
