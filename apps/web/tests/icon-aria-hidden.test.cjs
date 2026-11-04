// Regresyon guard'ı: ham `material-symbols-outlined` span'ları daima aria-hidden="true"
// taşımalı (ikon kod adı — "mic", "add_photo_alternate" — ekran okuyucuya okunmasın).
// Tercih edilen yol <Icon name=... /> bileşenidir (o zaten aria-hidden basar).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const APP_DIR = path.join(__dirname, "..", "app");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

test("ham material-symbols-outlined span'ları aria-hidden taşır", () => {
  const offenders = [];
  // <span ... material-symbols-outlined ... > açılış etiketi (çok satırlı olabilir)
  const spanRe = /<span\b(?:(?!<\/?span)[^>])*?material-symbols-outlined(?:(?!<\/?span)[^>])*?>/gs;
  for (const file of walk(APP_DIR)) {
    const src = fs.readFileSync(file, "utf-8");
    if (!src.includes("material-symbols-outlined")) continue;
    for (const match of src.match(spanRe) || []) {
      if (!match.includes("aria-hidden")) {
        offenders.push(`${path.relative(APP_DIR, file)}: ${match.slice(0, 80)}`);
      }
    }
  }
  assert.equal(offenders.length, 0, `aria-hidden'sız ikon span bulundu:\n${offenders.join("\n")}`);
});
