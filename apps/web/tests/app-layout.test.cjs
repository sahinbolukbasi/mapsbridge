// Genişlik sistemi (Increment 1.4 bug 2 + Increment 2.2, design-system.md R11/R12).
// App panelleri sayfa katmanında --app-panel yerleşim değişkeniyle (token değil); registry layout
// eşlemesi ve auth layout'u.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");
const APP = path.resolve(__dirname, "../app");
const read = (rel) => fs.readFileSync(path.join(APP, rel), "utf8");
const css = read("maps/maps.css");
/** `@media (min-width: 1024px) { ... }` bloklarının gövdeleri (iç içe süslü parantez sayılır). */
function mediaBlocks(src, query) {
  const out = [];
  let i = src.indexOf(query);
  while (i !== -1) {
    const open = src.indexOf("{", i);
    let depth = 0;
    let j = open;
    for (; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}" && --depth === 0) break;
    }
    out.push(src.slice(open + 1, j));
    i = src.indexOf(query, j);
  }
  return out;
}
function ruleBody(block, selector) {
  const m = block.match(new RegExp(`${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : "";
}
const panelVar = (src, selector) =>
  (ruleBody(src, selector).match(/(?:^|;|\n)\s*--app-panel:\s*([^;]+);/) ?? [])[1]?.trim();

test("üç app paneli --app-panel ile: maps 20vw, asistan 34vw, mesajlar 26vw", () => {
  assert.equal(panelVar(css, ".planner"), "clamp(16rem, 20vw, 24rem)");
  assert.equal(
    panelVar(read("travel-assistant/assistant.css"), ".as-guest"),
    "clamp(22rem, 34vw, 32rem)",
  );
  assert.equal(
    panelVar(read("travel-assistant/studio.css"), ".as-studio"),
    "clamp(22rem, 34vw, 32rem)",
  );
  assert.equal(panelVar(read("messages/messages.css"), ".msg-layout"), "clamp(18rem, 26vw, 24rem)");
  assert.match(
    ruleBody(read("messages/messages.css"), ".msg-layout"),
    /grid-template-columns:\s*var\(--app-panel\)\s+minmax\(0,\s*1fr\)/,
  );
  assert.doesNotMatch(
    read("travel-assistant/assistant.css"),
    /42fr/,
    "eski %42 | %58 bölmesi kaldı",
  );
});
test("≥1024 planner__split panel sütunu var(--app-panel), harita kalan alan", () => {
  const blocks = mediaBlocks(css, "@media (min-width: 1024px)");
  assert.ok(blocks.length > 0, "≥1024 bloğu yok");
  const body = blocks.map((b) => ruleBody(b, ".planner__split")).find(Boolean);
  assert.ok(body, ".planner__split ≥1024 kuralı yok");
  assert.match(body, /grid-template-columns:\s*var\(--app-panel\)\s+minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(css, /grid-template-columns:\s*40%\s+60%/, "eski %40 | %60 bölmesi kaldı");
});
test("panel genişliği 1280 px'te eski %40'ın yarısı (≈256 px), 1920'de en çok 384 px", () => {
  const rem = 16;
  const panel = (vw) => Math.min(24 * rem, Math.max(16 * rem, 0.2 * vw));
  assert.equal(panel(1280), 256);
  assert.equal(panel(1280), (0.4 * 1280) / 2);
  assert.equal(panel(1920), 384);
  assert.equal(panel(1024), 256, "dar masaüstünde alt sınır");
});
test("<1024 düzeni değişmez: harita üstte %45, liste altta", () => {
  const base = ruleBody(css.split("@media (min-width: 1024px)")[0], ".planner__split");
  assert.match(base, /grid-template-rows:\s*45%\s+minmax\(0,\s*1fr\)/);
  assert.match(base, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
test("registry layout eşlemesi (direction §1): community/profile content, k app, kimlik auth", () => {
  const { findRoute } = loadTs(path.join(APP, "lib/route-registry.ts"));
  const expected = {
    "/maps/": "app",
    "/travel-assistant/": "app",
    "/messages/": "app",
    "/k/": "app",
    "/community/": "content",
    "/profile/": "content",
    "/profile/edit/": "content",
    "/support/": "content",
    "/pricing/": "content",
    "/login/": "auth",
    "/register/": "auth",
    "/reset-password/": "auth",
    "/verify/": "auth",
    "/auth/callback/": "form",
    "/profile/photo/": "form",
    "/about/": "reading",
    "/privacy/": "reading",
    "/": "landing",
    "/en/": "landing",
    "/u/admin/": "sidebar",
  };
  for (const [p, layout] of Object.entries(expected))
    assert.equal(findRoute(p)?.layout, layout, `${p} → ${layout}`);
  for (const p of ["/login/", "/register/", "/reset-password/", "/verify/"])
    assert.equal(findRoute(p)?.chrome, "focus", `${p} chrome focus kalır`);
});
test("auth layout: PageShell aside ızgarası 1200 içinde minmax(0, 520px) 1fr, görselsiz tek sütun", () => {
  const ui = read("components/ui/ui.css");
  assert.match(ui, /\.ui-page-shell__auth\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*520px\)/);
  const wide = mediaBlocks(ui, "@media (min-width: 1024px)").map((b) =>
    ruleBody(b, ".ui-page-shell__auth--split"),
  );
  assert.ok(
    wide.some((b) => /grid-template-columns:\s*minmax\(0,\s*520px\)\s+minmax\(0,\s*1fr\)/.test(b)),
    "≥1024 form + görsel ızgarası yok",
  );
  assert.match(read("components/ui/page-shell.tsx"), /"auth"/);
});
test("operations.css'teki ölü 1000 px /support/ kuralı kaldırıldı; content sola yaslı dar sütun yok", () => {
  assert.doesNotMatch(read("operations.css"), /1000px/);
  assert.match(ruleBody(read("profile/profile.css"), ".profile-posts"), /margin-inline:\s*auto/);
  assert.match(read("community/community.css"), /minmax\(0,\s*1fr\)\s+20rem/);
});
