import { Card, Section } from "./ui";

// Yasal sayfaların altındaki "İlgili belgeler" kartları (design §5.2: about/privacy/terms/
// cookies). Bağlantılar kanonik URL'lere gider; içinde bulunulan sayfa listelenmez.
const DOCS = [
  { href: "/privacy/", label: "Gizlilik politikası", desc: "Hangi verileri neden işlediğimiz." },
  { href: "/terms/", label: "Kullanım koşulları", desc: "MapsBridge'i kullanma kuralları." },
  { href: "/cookies/", label: "Çerez politikası", desc: "Çerezler ve cihazda saklananlar." },
] as const;

export function LegalRelated({ current }: { current: (typeof DOCS)[number]["href"] }) {
  return (
    <Section title="İlgili belgeler">
      <ul className="legal-related">
        {DOCS.filter((d) => d.href !== current).map((d) => (
          <Card as="li" key={d.href} variant="interactive" href={d.href} linkLabel={d.label}>
            <p className="legal-cards__body">{d.desc}</p>
          </Card>
        ))}
      </ul>
    </Section>
  );
}
