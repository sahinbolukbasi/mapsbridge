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
      <Section reveal title="Abonelikler, kredi paketleri ve iptal koşulları">
        <p>
          MapsBridge üzerinde sunulan Gezgin, Pro ve Tur Lideri aylık abonelikleri ile tek seferlik
          kredi paketleri; mobil uygulamada Apple App Store / Google Play (RevenueCat) veya Polar
          güvenli ödeme altyapısı üzerinden tahsil edilir. Aylık abonelikler, mevcut dönem bitiminden
          en az 24 saat önce iptal edilmediği sürece otomatik olarak yenilenir. Aboneliğini cihazının
          mağaza abonelik ayarlarından veya profilindeki ödeme yönetimi ekranından dilediğin an iptal
          edebilir ve mobil uygulamada <em>Satın Alımları Geri Yükle</em> seçeneğini
          kullanabilirsin.
        </p>
      </Section>
      <Section reveal title="Hesap kapatma ve silme">
        <p>
          Kullanıcılar hesaplarını mobil uygulama içindeki <em>Profil &gt; Hesabımı Kalıcı Olarak Sil</em>{" "}
          butonundan veya web üzerinde{" "}
          <a href="/profile/edit/?tab=tehlike">Profil Düzenle &gt; Hesabımı Kalıcı Olarak Sil</a>{" "}
          sayfasından diledikleri zaman kalıcı olarak kapatabilirler.
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
