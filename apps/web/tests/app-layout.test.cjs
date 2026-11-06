// App-split yerleşimi (Increment 1.4, bug 2): planlayıcı sol paneli eski %40'ın yaklaşık yarısı.
// Increment 2'de --app-panel değişkenine taşınınca bu test güncellenir.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const css = fs.readFileSync(path.resolve(__dirname, "../app/maps/maps.css"), "utf8");

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

test("≥1024 planner__split panel sütunu clamp(16rem, 20vw, 24rem), harita kalan alan", () => {
  const blocks = mediaBlocks(css, "@media (min-width: 1024px)");
  assert.ok(blocks.length > 0, "≥1024 bloğu yok");
  const body = blocks.map((b) => ruleBody(b, ".planner__split")).find(Boolean);
  assert.ok(body, ".planner__split ≥1024 kuralı yok");
  assert.match(
    body,
    /grid-template-columns:\s*clamp\(16rem,\s*20vw,\s*24rem\)\s+minmax\(0,\s*1fr\)/,
  );
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
