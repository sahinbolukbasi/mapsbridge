import {
  Button,
  Card,
  Field,
  Icon,
  Input,
  PageHeader,
  PageShell,
  Section,
  Textarea,
} from "../components/ui";
import "../styles/legal.css";

// Başlık registry'den ("İletişim"). Form gönderim davranışı değişmedi: mailto ile e-posta
// uygulamasını açar, sunucuya bir şey göndermez.
export default function Contact() {
  return (
    <PageShell
      className="legal"
      header={
        <PageHeader
          description="Soru, öneri, iş birliği ya da destek talebin için bize yaz."
          breadcrumb={[{ label: "Ana sayfa", href: "/" }, { label: "İletişim" }]}
        />
      }
    >
      <ul className="legal-cards">
        <Card as="li" className="legal-cards__item">
          <div className="legal-cards__inner">
            <span className="legal-cards__icon">
              <Icon name="inbox" size={24} />
            </span>
            <div>
              <h2 className="legal-cards__title">E-posta</h2>
              <p className="legal-cards__body">
                Doğrudan <a href="mailto:destek@mapsbridge.com">destek@mapsbridge.com</a> adresine
                yazabilirsin.
              </p>
            </div>
          </div>
        </Card>
        <Card as="li" className="legal-cards__item">
          <div className="legal-cards__inner">
            <span className="legal-cards__icon">
              <Icon name="help" size={24} />
            </span>
            <div>
              <h2 className="legal-cards__title">Hesabınla ilgili bir sorun mu var?</h2>
              <p className="legal-cards__body">
                Giriş yaptıysan destek talebi oluşturup yanıtları tek yerden takip edebilirsin.
              </p>
              <Button href="/support/" variant="link" iconEnd={<Icon name="arrow" size={16} />}>
                Yardım ve destek
              </Button>
            </div>
          </div>
        </Card>
      </ul>
      <Section title="Mesaj gönder">
        <p>
          Bu form varsayılan e-posta uygulamanı açarak mesajını hazırlar. E-posta uygulaman yoksa
          yukarıdaki adrese doğrudan yazabilirsin.
        </p>
        <Card>
          <form
            className="legal-form"
            action="mailto:destek@mapsbridge.com"
            method="post"
            encType="text/plain"
          >
            <Field label="Konu" required>
              <Input
                id="contact-subject"
                name="subject"
                type="text"
                required
                placeholder="Mesajının konusu"
              />
            </Field>
            <Field label="Mesaj" required>
              <Textarea
                id="contact-body"
                name="body"
                rows={6}
                required
                placeholder="Mesajını buraya yaz"
              />
            </Field>
            <div>
              <Button type="submit" iconEnd={<Icon name="external" size={16} />}>
                E-posta uygulamasında aç
              </Button>
            </div>
          </form>
        </Card>
        <p>
          Gizlilik uygulamalarımız için <a href="/privacy/">gizlilik politikamıza</a> göz
          atabilirsin.
        </p>
      </Section>
    </PageShell>
  );
}
