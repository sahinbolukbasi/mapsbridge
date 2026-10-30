// Eş-anlamlı URL sayfası (design §5.3, D6): statik 200 + anında meta refresh + noindex,follow +
// (yalnızca hedef sitemap:true ise) hedefe canonical + query/hash koruyan inline script + görünür
// bağlantı. Server bileşenidir; hedef LEGACY_REDIRECTS tablosundan gelir (kullanıcı girdisi değil).
import type { Metadata } from "next";
import { CANONICAL_ROUTES, LEGACY_REDIRECTS, type RoutePath } from "../../lib/route-registry";
import { siteOrigin } from "../../lib/site-metadata";
import { PageHeader } from "./page-header";
import { PageShell } from "./page-shell";
import { RedirectNow } from "./redirect-now";

function targetOf(from: RoutePath): RoutePath {
  const to = LEGACY_REDIRECTS[from];
  if (!to) throw new Error(`LegacyRedirect: LEGACY_REDIRECTS'te anahtar yok (${from})`);
  if (!CANONICAL_ROUTES.some((r) => r.path === to))
    throw new Error(`LegacyRedirect: hedefin kanonik kaydı yok (${from} → ${to})`);
  return to;
}

/** robots noindex,follow; canonical yalnızca hedef kaydı sitemap:true (indexlenen) ise. */
export function legacyMetadata(from: RoutePath): Metadata {
  const to = targetOf(from);
  const target = CANONICAL_ROUTES.find((r) => r.path === to);
  return {
    title: "Yönlendiriliyor",
    robots: { index: false, follow: true },
    alternates:
      target?.sitemap && siteOrigin ? { canonical: new URL(to, siteOrigin).href } : undefined,
    other: {},
  };
}

export function LegacyRedirect({ from }: { from: RoutePath }) {
  const to = targetOf(from);
  return (
    <>
      {/* React 19 <meta>'yı <head>'e taşır; JS kapalıyken de anında hedefe gider (query'siz). */}
      <meta httpEquiv="refresh" content={`0;url=${to}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `location.replace(${JSON.stringify(to)}+location.search+location.hash);`,
        }}
      />
      <RedirectNow to={to} />
      <PageShell layout="form" header={<PageHeader title="Yönlendiriliyor…" />}>
        <p>
          <a href={to}>Devam etmek için tıklayın</a>
        </p>
      </PageShell>
    </>
  );
}
