import { LegalRelated } from "../components/legal-related";
import { PageHeader, PageShell, Section } from "../components/ui";
import "../styles/legal.css";
export default function Terms() {
  return (
    <PageShell
      className="legal"
      header={
        <PageHeader
          enter
          breadcrumb={[{ label: "Ana sayfa", href: "/" }, { label: "Kullanım koşulları" }]}
        />
      }
    >
      <p>
        MapsBridge yalnızca kendi adresini veya paylaşmaya yetkili olduğun bir adresi açık rızayla
        paylaşmak içindir.
      </p>
      <Section reveal title="Google Maps hizmetleri">
        <p>
          Google Maps kullanılan özelliklerde{" "}
          <a
            href="https://maps.google.com/help/terms_maps/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Maps/Google Earth Ek Hizmet Şartları
          </a>{" "}
          geçerlidir. Mekan fotoğrafları, değerlendirmeler ve yorumlar belirtilen kaynaklara aittir;
          açılış saatleri ve işletme bilgileri değişebilir.
        </p>
      </Section>
      <Section reveal title="Yasak kullanımlar">
        <p>
          Gizli takip, izinsiz konum paylaşımı, taciz veya hukuka aykırı herhangi bir kullanım
          kesinlikle yasaktır.
        </p>
      </Section>
      <LegalRelated current="/terms/" />
    </PageShell>
  );
}
