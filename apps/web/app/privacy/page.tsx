import { LegalRelated } from "../components/legal-related";
import { PageHeader, PageShell, Section } from "../components/ui";
import "../styles/legal.css";
export default function Privacy() {
  return (
    <PageShell
      className="legal"
      header={
        <PageHeader
          enter
          breadcrumb={[{ label: "Ana sayfa", href: "/" }, { label: "Gizlilik politikası" }]}
        />
      }
    >
      <p className="legal-meta">Son güncelleme: 9 Kasım 2026</p>
      <Section reveal title="Hangi verileri işleriz?">
        <p>
          MapsBridge hesabı için ad-soyad, e-posta ve telefon numarası; haritada işaretleyip
          kaydettiğin adresler ve güvenlik oturum kayıtları işlenir.
        </p>
      </Section>
      <Section reveal title="Google Maps ve mekan bilgileri">
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
      <Section reveal title="Mobil uygulama izinleri ve rızan (KVKK/GDPR)">
        <p>
          Maps Bridge mobil uygulamasında aşağıdaki izinler yalnızca ilgili özelliği ilk
          kullandığında, önce Türkçe bir açıklama gösterilerek ve senin onayınla istenir. Her izni
          cihaz ayarlarından dilediğin an kapatabilirsin; izni vermemen uygulamayı kullanmana engel
          olmaz.
        </p>
        <ul>
          <li>
            <strong>Konum (yalnız uygulama açıkken):</strong> “Yakınımda” ve haritada yerini
            göstermek için kullanılır. Arka planda konum toplanmaz ve konumun sunucularımızda
            saklanmaz.
          </li>
          <li>
            <strong>Kamera ve fotoğraflar:</strong> topluluk paylaşımlarına ve profil fotoğrafına
            görsel ekleyebilmen için erişilir. Yalnızca senin seçtiğin görseller işlenir.
          </li>
          <li>
            <strong>Face ID / parmak izi (uygulama kilidi):</strong> isteğe bağlıdır ve varsayılan
            olarak kapalıdır. Kimlik doğrulaması cihazında yapılır; hiçbir biyometrik veri uygulamaya
            ya da sunucuya ulaşmaz.
          </li>
          <li>
            <strong>Bildirimler:</strong> yalnızca cihazında zamanlanan yerel rota hatırlatmaları
            için kullanılır. Uzaktan push bildirimi ya da pazarlama bildirimi göndermeyiz.
          </li>
          <li>
            <strong>Hareket (CoreMotion):</strong> hareket verini toplamaz ve kullanmayız. Bu izin
            yalnızca konum bileşeninin içerdiği bir sistem kütüphanesi nedeniyle Apple tarafından
            zorunlu tutulduğu için uygulamada tanımlıdır.
          </li>
        </ul>
        <p>
          Uygulama analitik/izleme için üçüncü taraf takip teknolojisi kullanmaz; reklam kimliğiyle
          cihazlar arası takip yapılmaz.
        </p>
      </Section>
      <Section reveal title="Kontrol sende">
        <p>
          Paylaştığın konumu dilediğin an silebilir, süresini sonlandırabilir veya kayıtlı
          adreslerini liste üzerinden silebilirsin.
        </p>
      </Section>
      <LegalRelated current="/privacy/" />
    </PageShell>
  );
}
