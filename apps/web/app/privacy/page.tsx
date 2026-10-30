import { PageHeader, PageShell, Section } from "../components/ui";
import "../styles/legal.css";
export default function Privacy() {
  return (
    <PageShell
      className="legal"
      header={
        <PageHeader
          title="Gizlilik Politikası"
          breadcrumb={[{ label: "Ana sayfa", href: "/" }, { label: "Gizlilik Politikası" }]}
        />
      }
    >
      <p>Son güncelleme: 24 Eylül 2026</p>
      <Section title="Hangi verileri işleriz?">
        <p>
          MapsBridge hesabı için ad-soyad, e-posta ve telefon numarası; haritada işaretleyip
          kaydettiğin adresler ve güvenlik oturum kayıtları işlenir.
        </p>
      </Section>
      <Section title="Google Maps ve mekan bilgileri">
        <p>
          Google haritasını, mekan aramasını veya mekan bilgilerini kullandığında arama metni,
          görüntülenen konum ve bağlantı bilgileri Google tarafından işlenebilir. Bu hizmetlerde{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            Google Gizlilik Politikası
          </a>{" "}
          da geçerlidir. Google fotoğrafları ve yorumları anlık görüntülenir; kişisel notların
          bunlardan ayrı tutulur.
        </p>
      </Section>
      <Section title="Kontrol sende">
        <p>
          Paylaştığın konumu dilediğin an silebilir, süresini sonlandırabilir veya kayıtlı
          adreslerini liste üzerinden silebilirsin.
        </p>
      </Section>
    </PageShell>
  );
}
