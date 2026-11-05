// Çıktıları yazar; --check modunda yalnızca karşılaştırır (fark varsa exit 1).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkInverseScope, checkPairs, checkPrimitiveSurfaces } from "../src/contrast.ts";
import { toCss, toNative, toNativeIcons, toWebIcons, toWebTs } from "../src/emit.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const outputs: Array<[string, () => string]> = [
  ["apps/web/app/styles/tokens.css", toCss],
  ["apps/web/app/lib/design-tokens.ts", toWebTs],
  ["apps/mobile/src/theme/tokens.ts", toNative],
  ["apps/web/app/lib/icon-paths.ts", toWebIcons],
  ["apps/mobile/src/theme/icon-paths.ts", toNativeIcons],
];

const failures = [...checkPairs(), ...checkInverseScope()];
if (failures.length > 0) {
  for (const f of failures) {
    console.error(
      `Kontrast yetersiz: ${f.fg} / ${f.bg} = ${f.ratio.toFixed(2)} (eşik ${f.min}; ${f.note})`,
    );
  }
  process.exit(1);
}
const surfaceFailures = checkPrimitiveSurfaces();
if (surfaceFailures.length > 0) {
  for (const f of surfaceFailures) {
    console.error(
      `Primitive kontrastı yetersiz: ${f.primitive}/${f.variant} (${f.scope} kap ${f.container}) ${f.kind} ${f.fg} / ${f.bg} = ${f.ratio.toFixed(2)} (eşik ${f.min})`,
    );
  }
  process.exit(1);
}

const check = process.argv.includes("--check");
let drift = false;
for (const [rel, render] of outputs) {
  const file = resolve(root, rel);
  const next = render();
  if (check) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (current !== next) {
      const a = current.split("\n");
      const b = next.split("\n");
      const i = b.findIndex((line, idx) => line !== a[idx]);
      console.error(
        `Token çıktısı güncel değil: ${rel} (satır ${i + 1}). Çalıştır: npm run tokens:build`,
      );
      drift = true;
    }
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, next);
    process.stdout.write(`yazıldı: ${rel}\n`);
  }
}
process.exit(drift ? 1 : 0);
