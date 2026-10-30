// C2 yardımcısı: legacy dosyadaki "sayfaya bağlı" kuralları (seçicisi `body ` / `body:has(` ile
// başlayan, sayfa kurallarını özgüllükle yenmek için yazılmış override'lar) aynı dosyada
// `@layer pages { … }` bloğuna taşır. Böylece sayfa CSS'iyle aynı layer'da kalırlar ve
// bugünkü özgüllük + kaynak sırası karşılaştırması birebir korunur (design §2.6).
// Kullanım: node --experimental-strip-types scripts/design-system/split-page-coupled.ts <dosya.css>
import { readFileSync, writeFileSync } from "node:fs";
import { ORDER } from "./layer-css.ts";

type Stmt = { text: string; coupled: boolean };

function topLevelStatements(body: string): Stmt[] {
  const out: Stmt[] = [];
  let i = 0;
  while (i < body.length) {
    const start = i;
    let depth = 0;
    for (; i < body.length; i++) {
      const c = body[i];
      if (c === "/" && body[i + 1] === "*") {
        i = body.indexOf("*/", i + 2) + 1;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      } else if (c === ";" && depth === 0) {
        i++;
        break;
      }
    }
    const text = body.slice(start, i);
    if (text.trim()) out.push({ text, coupled: isCoupled(text) });
  }
  return out;
}

/** Virgülle ayır, ama parantez içindeki (:is(), :has()) virgülleri yok say. */
function splitTopLevel(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of selector) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function selectorsOf(text: string): string[] {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const sels: string[] = [];
  for (const m of clean.matchAll(/([^{};]+)\{/g)) {
    const s = m[1].trim();
    if (s.startsWith("@")) continue;
    sels.push(...splitTopLevel(s));
  }
  return sels;
}

export function isCoupled(text: string): boolean {
  const sels = selectorsOf(text);
  return sels.length > 0 && sels.every((s) => /^body(\s|:has\()/.test(s));
}

export function split(css: string, layer = "legacy"): { css: string; moved: number } {
  const head = `${ORDER}\n@layer ${layer} {\n`;
  if (!css.startsWith(head)) throw new Error("dosya beklenen layer başlığıyla başlamıyor");
  const close = css.lastIndexOf("\n}");
  const body = css.slice(head.length, close);
  const tail = css.slice(close + 2);
  const stmts = topLevelStatements(body);
  // Karışık @media bloklarını (bir kısmı body-kapsamlı) iç kurallara göre böl.
  const kept: string[] = [];
  const moved: string[] = [];
  for (const s of stmts) {
    const t = s.text.trim();
    if (t.startsWith("@media") && !s.coupled) {
      const open = s.text.indexOf("{");
      const inner = s.text.slice(open + 1, s.text.lastIndexOf("}"));
      const parts = topLevelStatements(inner);
      const c = parts.filter((p) => p.coupled);
      if (c.length) {
        const prelude = s.text.slice(0, open + 1);
        const rest = parts.filter((p) => !p.coupled);
        if (rest.length) kept.push(prelude + rest.map((p) => p.text).join("") + "\n}");
        moved.push(prelude + c.map((p) => p.text).join("") + "\n}");
        continue;
      }
    }
    (s.coupled ? moved : kept).push(s.text);
  }
  if (!moved.length) return { css, moved: 0 };
  const out =
    head +
    kept.join("").replace(/^\n+/, "") +
    "\n}\n" +
    "/* Sayfaya bağlı override'lar: sayfa CSS'iyle aynı layer'da, bugünkü özgüllük korunur (design §2.6). */\n" +
    "@layer pages {\n" +
    moved.join("").replace(/^\n+/, "") +
    "\n}" +
    tail;
  return { css: out, moved: moved.length };
}

if (import.meta.main) {
  for (const file of process.argv.slice(2)) {
    const r = split(readFileSync(file, "utf8"));
    writeFileSync(file, r.css);
    process.stdout.write(`${file}: ${r.moved} ifade pages layer'ına taşındı\n`);
  }
}
