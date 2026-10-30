import { Button, Field, Input, PageHeader, PageShell, Section, Textarea } from "../components/ui";
import "../styles/legal.css";
export default function Contact() {
  return (
    <PageShell
      className="legal"
      header={
        <PageHeader
          title="İletişim"
          breadcrumb={[{ label: "Ana sayfa", href: "/" }, { label: "İletişim" }]}
        />
      }
    >
      <p>
        Soru, öneri, iş birliği veya destek talepleriniz için bize ulaşabilirsiniz. En hızlı yanıt
        için e-posta ile yazmanız yeterli.
      </p>

      <Section title="E-posta">
        <p>
          Doğrudan <a href="mailto:destek@mapsbridge.com">destek@mapsbridge.com</a> adresine
          yazabilirsiniz.
        </p>
      </Section>
      <Section title="Mesaj gönder">
        <p>
          Aşağıdaki form, varsayılan e-posta uygulamanızı açarak mesajınızı hazırlar. E-posta
          uygulamanız yoksa yukarıdaki adrese doğrudan yazabilirsiniz.
        </p>
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
              placeholder="Mesajınızın konusu"
            />
          </Field>
          <Field label="Mesaj" required>
            <Textarea
              id="contact-body"
              name="body"
              rows={6}
              required
              placeholder="Mesajınızı buraya yazın"
            />
          </Field>
          <div>
            <Button type="submit">E-posta uygulamasında aç</Button>
          </div>
        </form>

        <p>
          Gizlilik uygulamalarımız için <a href="/privacy/">gizlilik politikamıza</a> göz
          atabilirsiniz.
        </p>
      </Section>
    </PageShell>
  );
}
