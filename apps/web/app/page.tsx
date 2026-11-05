import Home from "./home-client";
import { routeMetadata, siteOrigin } from "./lib/site-metadata";

export const metadata = routeMetadata("/");

export default function HomePage() {
  return (
    <>
      {siteOrigin && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "MapsBridge",
              url: siteOrigin,
              description:
                "Bağımsız seyahat arkadaşı: gezini anlat, birkaç soruyla netleştir, rotanı gün gün haritada gör. Önerilerimiz komisyona göre sıralanmaz.",
              inLanguage: "tr",
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <Home />
    </>
  );
}
