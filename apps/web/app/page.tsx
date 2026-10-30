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
