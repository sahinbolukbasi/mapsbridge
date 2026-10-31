// Yeni sayfa iskeleti (design §11 "Scaffold", steering §Yeni sayfa ekleme).
// Kullanım: npm run new:page -- <slug> [--layout content|reading|form|landing|app|sidebar] [--root <dizin>]
// app/<slug>/{layout.tsx, page.tsx, <slug>.css} üretir; route-registry kayıt satırını stdout'a yazar.
// Slug ^[a-z0-9-]{2,40}$ olmalı; var olan klasörün üzerine yazılmaz (exit 1).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const LAYOUTS = ["content", "reading", "form", "landing", "app", "sidebar"] as const;
type Layout = (typeof LAYOUTS)[number];
const LAYER = "@layer tokens, base, legacy, chrome, pages, primitives;";

export function pageFiles(slug: string, layout: Layout): Record<string, string> {
  return {
    "layout.tsx": `import { routeMetadata } from "../lib/site-metadata";
export const metadata = routeMetadata("/${slug}/");
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
`,
    "page.tsx": `import { PageHeader, PageShell, Section } from "../components/ui";
import "./${slug}.css";
export default function Page() {
  return (
    <PageShell layout="${layout}" header={<PageHeader />}>
      <Section title="Bölüm">
        <p className="${slug}-intro">İçerik buraya.</p>
      </Section>
    </PageShell>
  );
}
`,
    [`${slug}.css`]: `${LAYER}
@layer pages {
  /* Yalnızca yerleşim; renk/boşluk token'larla (bkz. .kiro/steering/design-system.md). */
  .${slug}-intro {
    margin: 0;
  }
}
`,
  };
}

export function registryLine(slug: string, layout: Layout): string {
  return `  { path: "/${slug}/", file: "app/${slug}/page.tsx", layout: "${layout}", title: t("Başlık", "Title"), sitemap: false, robots: "noindex" },`;
}

function main(argv: string[]): number {
  let slug: string | undefined;
  let layout: Layout = "content";
  let root = resolve(import.meta.dirname, "../..");
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--layout") layout = argv[++i] as Layout;
    else if (a === "--root") root = resolve(argv[++i]);
    else if (a.startsWith("--")) {
      console.error(`new-page: bilinmeyen seçenek: ${a}`);
      return 1;
    } else slug = a;
  }
  if (!slug || !/^[a-z0-9-]{2,40}$/.test(slug)) {
    console.error(
      "new-page: slug ^[a-z0-9-]{2,40}$ kuralına uymalı (ör. npm run new:page -- yeni-sayfa)",
    );
    return 1;
  }
  if (!LAYOUTS.includes(layout)) {
    console.error(`new-page: --layout şunlardan biri olmalı: ${LAYOUTS.join(", ")}`);
    return 1;
  }
  const dir = join(root, "apps/web/app", slug);
  if (existsSync(dir)) {
    console.error(`new-page: apps/web/app/${slug} zaten var; üzerine yazılmaz.`);
    return 1;
  }
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(pageFiles(slug, layout)))
    writeFileSync(join(dir, name), body);
  console.log(`Oluşturuldu: apps/web/app/${slug}/{layout.tsx,page.tsx,${slug}.css}`);
  console.log("route-registry.ts'e ekleyin:");
  console.log(registryLine(slug, layout));
  return 0;
}

if (import.meta.main ?? process.argv[1]?.endsWith("new-page.ts"))
  process.exitCode = main(process.argv.slice(2));
