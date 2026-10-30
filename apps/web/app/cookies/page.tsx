import { PageHeader, PageShell, Section } from "../components/ui";
import "../styles/legal.css";
export default function Cookies() {
  return (
    <PageShell
      className="legal"
      header={
        <PageHeader
          title="Çerez ve Depolama Politikası"
          breadcrumb={[
            { label: "Ana sayfa", href: "/" },
            { label: "Çerez ve Depolama Politikası" },
          ]}
        />
      }
    >
      <p>
        MapsBridge, oturum güvenliği ve tema tercihleriniz (karanlık mod / dil seçimi) için zorunlu
        yerel depolama (localStorage) kullanır.
      </p>
      <Section title="Üçüncü Taraf Takibi">
        <p>
          Reklam veya pazarlama çerezleri kullanılmaz. Harita verileri açık kaynak OpenStreetMap
          üzerinden sunulur.
        </p>
      </Section>
    </PageShell>
  );
}
