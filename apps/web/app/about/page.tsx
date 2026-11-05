import {
  Button,
  Card,
  Icon,
  PageHeader,
  PageShell,
  Section,
  type IconName,
} from "../components/ui";
import "../styles/legal.css";

// Başlık registry'den ("Hakkımızda"); metin yalnızca product.md / spec'teki gerçek özellikleri
// anlatır. Mağaza varlığı iddiası yok (S6): mobil, telefonun tarayıcısı olarak anlatılır.
const VALUES: ReadonlyArray<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "map",
    title: "Ne yapıyoruz",
    body: "Çok günlü gezileri gün gün planlıyor, durakları haritada sıralıyor ve rotayı paylaşılabilir hale getiriyoruz. AI asistanı rota oluşturmada ve düzenlemede yardım eder; yer, adres ve açılış saati gibi olgusal bilgiler veri kaynaklarından gelir, uydurulmaz.",
  },
  {
    icon: "shield",
    title: "Neye inanıyoruz",
    body: "Bağımsızız ve envanter sahibi değiliz. Öneriler komisyona göre sıralanmaz; hazırlık bağlantıları rota önerilerinin içinde değil, ayrı bir sekmede durur. Kişisel veri ve konum bilgisi açık rıza ve KVKK/GDPR ilkelerine uygun işlenir.",
  },
  {
    icon: "users",
    title: "Kimler için",
    body: "Bireysel gezginlerden tur liderlerine kadar, gezisini kendi temposuna ve ilgi alanlarına göre kurmak isteyen herkes için. MapsBridge web'de ve telefonunun tarayıcısında aynı hesapla çalışır.",
  },
];

export default function About() {
  return (
    <PageShell
      className="legal"
      header={
        <PageHeader
          description="MapsBridge bir rezervasyon motoru değil, seyahatin kendisi için bir yol arkadaşı."
          breadcrumb={[{ label: "Ana sayfa", href: "/" }, { label: "Hakkımızda" }]}
        />
      }
    >
      <Section title="Seyahat için, satın alma anı için değil">
        <p>
          MapsBridge, yapay zeka destekli bir seyahat planlama ve güvenli konum paylaşımı
          platformudur. Amacımız satın alma anını değil, seyahat deneyiminin tamamını
          kolaylaştırmaktır: planlarken, paylaşırken ve yoldayken.
        </p>
        <ul className="legal-cards">
          {VALUES.map((v) => (
            <Card as="li" key={v.title} className="legal-cards__item">
              <div className="legal-cards__inner">
                <span className="legal-cards__icon">
                  <Icon name={v.icon} size={24} />
                </span>
                <div>
                  <h3 className="legal-cards__title">{v.title}</h3>
                  <p className="legal-cards__body">{v.body}</p>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      </Section>
      <Section title="Bize ulaş">
        <p>Soruların ve önerilerin için iletişim sayfamızdan yazabilirsin.</p>
        <div>
          <Button href="/contact/" variant="secondary" iconEnd={<Icon name="arrow" size={16} />}>
            İletişim
          </Button>
        </div>
      </Section>
    </PageShell>
  );
}
