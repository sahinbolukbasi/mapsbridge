import { PageHeader, PageShell, Section } from "../components/ui";
import "../styles/legal.css";
export default function About() {
  return (
    <PageShell
      className="legal"
      header={
        <PageHeader
          title="Hakkımızda"
          breadcrumb={[{ label: "Ana sayfa", href: "/" }, { label: "Hakkımızda" }]}
        />
      }
    >
      <p>
        MapsBridge, yapay zeka destekli bir seyahat planlama ve güvenli konum paylaşımı
        platformudur. Bir rezervasyon motoru değil, seyahatin kendisi için bir yol arkadaşıdır:
        amacımız satın alma anını değil, seyahat deneyiminin tamamını kolaylaştırmaktır.
      </p>

      <Section title="Ne yapıyoruz">
        <p>
          Çok günlü gezileri gün gün planlıyor, durakları akıllıca kümeleyip rotayı gerçek yol
          verisiyle optimize ediyoruz. Yapay zeka asistanımız rota oluşturmada ve düzenlemede
          yardımcı olur; ancak yer, fiyat ve açılış saati gibi tüm olgusal bilgiler gerçek veri
          kaynaklarından gelir. Öneriler asla ticari çıkara göre sıralanmaz.
        </p>
      </Section>
      <Section title="Neye inanıyoruz">
        <p>
          Bağımsızız ve envanter sahibi değiliz. Tavsiyelerimiz komisyona göre değil, senin için en
          iyi olana göre düzenlenir. Kişisel veriler ve konum bilgisi, açık rıza ve gizlilik
          ilkelerine (KVKK/GDPR) uygun şekilde işlenir.
        </p>
      </Section>
      <Section title="Kimler için">
        <p>
          Bireysel gezginlerden tur liderlerine kadar, seyahatini kendi tempo ve ilgi alanlarına
          göre tasarlamak isteyen herkes için tasarlandı. Web ve mobil uygulamalarımızla her yerde
          yanında.
        </p>

        <p>
          Sorularınız için <a href="/contact/">iletişim sayfamızdan</a> bize ulaşabilirsiniz.
        </p>
      </Section>
    </PageShell>
  );
}
