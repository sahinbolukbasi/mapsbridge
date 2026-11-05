import { LegalRelated } from "../components/legal-related";
import { Card, PageHeader, PageShell, Section } from "../components/ui";
import { GUEST_DRAFT_KEY } from "../lib/guest/guest-draft";
import { PLANNER_TRIPS_KEY } from "../lib/trip/planner-store";
import "../styles/legal.css";

// Başlık registry'den ("Çerez politikası"). Her satır koddaki gerçek bir anahtara karşılık gelir:
// mb_session (lib/auth-context.tsx), locale (lib/auto-locale.ts), oturum anahtarları ve çıkışta
// silinenler (lib/cognito.ts signOut), planlayıcı (lib/trip/planner-store.ts) ve misafir taslağı
// mapsbridge.guestDraft.v1 (lib/guest/guest-draft.ts, 7 gün; design §6.2).
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
    keys: "mapsbridge.accessToken, mapsbridge.idToken, mapsbridge.refreshToken",
    kind: "Yerel depolama · zorunlu",
    purpose: "Hesabına giriş yapılmış halde kalmanı sağlar.",
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
        MapsBridge yalnızca oturum güvenliği, dil tercihin ve planlama işlevleri için çerez ve yerel
        depolama (localStorage) kullanır. Aşağıdaki liste bunların tamamını açıklar.
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
