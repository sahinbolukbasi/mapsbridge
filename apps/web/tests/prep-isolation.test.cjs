// I8 mimari testi (design §13, maps-bridge-spec I8): para kazanma yüzeyleri (affiliate) yalnız
// Hazırlık sekmesinde yaşar, rota önerileri ya da sohbet akışı içinde değil. Import grafiği
// taranır: travel-affiliate-cards yalnızca prep-panel'den, prep-panel yalnızca Hazırlık sekmesinin
// kapsayıcısından (travel-assistant-client.tsx taslak paneli: "Uçuş & Konaklama" sekmesi ve
// rotasız Hazırlık görünümü) import edilir. Yeni bir import (ör. misafir asistan, QuestionCard,
// planlayıcı) bu testi kırmızıya çevirir.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const APP = path.resolve(__dirname, "../app");
const TARGETS = {
  "travel-assistant/travel-affiliate-cards": ["travel-assistant/prep-panel.tsx"],
  "travel-assistant/prep-panel": ["travel-assistant/travel-assistant-client.tsx"],
};

function sourceFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules") sourceFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

// import x from "…", import "…", export … from "…", import("…"), require("…")
const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"']+)["']/g;

function importedModules(file) {
  const src = fs.readFileSync(file, "utf8");
  const mods = new Set();
  for (const m of src.matchAll(SPEC)) {
    const spec = m[1];
    if (!spec.startsWith(".")) continue;
    const abs = path.resolve(path.dirname(file), spec);
    mods.add(
      path
        .relative(APP, abs)
        .split(path.sep)
        .join("/")
        .replace(/\.(tsx?|jsx?)$/, ""),
    );
  }
  return mods;
}

const FILES = sourceFiles(APP);
const rel = (f) => path.relative(APP, f).split(path.sep).join("/");

for (const [target, allowed] of Object.entries(TARGETS)) {
  test(`I8: ${target} yalnızca ${allowed.join(", ")} tarafından import edilir`, () => {
    assert.ok(
      fs.existsSync(path.join(APP, `${target}.tsx`)),
      `${target}.tsx bulunamadı (taşındıysa TARGETS'ı güncelleyin)`,
    );
    const importers = FILES.filter((f) => importedModules(f).has(target))
      .map(rel)
      .sort();
    assert.deepEqual(
      importers,
      [...allowed].sort(),
      `${target} beklenmeyen yerden import ediliyor (I8: affiliate yalnız Hazırlık sekmesinde)`,
    );
  });
}

test("I8: misafir asistan ve asistan bileşenleri affiliate/prep modülü import etmez", () => {
  const scoped = FILES.filter((f) =>
    /^(components\/assistant\/|lib\/guest\/|travel-assistant\/guest-assistant\.tsx$)/.test(rel(f)),
  );
  assert.ok(scoped.length >= 4, "taranacak misafir/asistan dosyası bulunamadı");
  for (const f of scoped) {
    const mods = [...importedModules(f)];
    assert.ok(
      !mods.some((m) => /affiliate|prep-panel|prep-context/.test(m)),
      `${rel(f)}: affiliate/prep import'u (${mods.join(", ")})`,
    );
  }
});
