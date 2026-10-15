import Home from "./home-client";
import { publicMetadata, siteOrigin } from "./lib/site-metadata";

export const metadata = publicMetadata(
  "Seyahatini planla, birlikte keşfet",
  "AI seyahat asistanı, kişisel haritalar ve gezgin rehberleriyle yolculuğunu planla. Duraklarını kaydet ve deneyimlerini paylaş.",
  "/",
  "tr",
);

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
              description: "Seyahat planlama, harita ve gezgin topluluğu",
              inLanguage: "tr",
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <Home />
    </>
  );
}
