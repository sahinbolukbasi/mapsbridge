// Cascade layer sarmalarını açar (design §2.6 "unwrapLayers", Rev 6 K1).
// .agents/tools/cascade-diff.mjs:13-23'teki geçici fonksiyonun sertleştirilmiş taşımasıdır:
//  - tek geçişli tarayıcı; "…"/'…' string'leri (kaçışlarla) ve /* … */ yorumları olduğu gibi kopyalanır
//  - her derinlikte (@media/@supports içinde de) `@layer a, b;` ifadesi silinir
//  - her `@layer [ad] { … }` bloğu içeriğiyle değiştirilir (adlı ve adsız)
//  - dengesiz süslü parantez → throw
// Layer'sız CSS'te no-op ve idempotenttir: f(f(x)) === f(x).

const LAYER = /@layer(?:\s+([\w.-]+(?:\s*,\s*[\w.-]+)*))?\s*([;{])/y;

export function unwrapLayers(css: string): string {
  const out: string[] = [];
  const stack: Array<{ drop: boolean; at: number }> = [];
  let i = 0;
  let copyFrom = 0;
  const flush = (to: number) => {
    if (to > copyFrom) out.push(css.slice(copyFrom, to));
  };
  while (i < css.length) {
    const c = css[i];
    if (c === '"' || c === "'") {
      for (i++; i < css.length && css[i] !== c; i++) if (css[i] === "\\") i++;
      i++;
      continue;
    }
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    if (c === "@") {
      LAYER.lastIndex = i;
      const m = LAYER.exec(css);
      if (m && (m[2] === "{" || m[1])) {
        flush(i);
        if (m[2] === "{") stack.push({ drop: true, at: i });
        i = LAYER.lastIndex;
        copyFrom = i;
        continue;
      }
    }
    if (c === "{") stack.push({ drop: false, at: i });
    else if (c === "}") {
      const top = stack.pop();
      if (!top) throw new Error(`unwrapLayers: dengesiz süslü parantez (konum ${i})`);
      if (top.drop) {
        flush(i);
        copyFrom = i + 1;
      }
    }
    i++;
  }
  if (stack.length) {
    throw new Error(`unwrapLayers: dengesiz süslü parantez (konum ${stack[stack.length - 1].at})`);
  }
  flush(css.length);
  return out.join("");
}
