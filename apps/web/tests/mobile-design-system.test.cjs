// Mobil tasarım sistemi kuralları (design §7, AC-22/AC-23, R5-6). Yalnız node:fs kullanır;
// web build gerektirmez. CI: ci-mobile.yml "Mobile design-system rules" adımı + test:web.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const mobile = path.join(root, "apps/mobile");

/** apps/mobile/App.tsx + src/**\/*.ts(x); mobil köke göre göreli yollar. */
function sources() {
  const out = ["App.tsx"];
  const walk = (dir) => {
    for (const name of fs.readdirSync(path.join(mobile, dir)).sort()) {
      const rel = `${dir}/${name}`;
      if (fs.statSync(path.join(mobile, rel)).isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(name)) out.push(rel);
    }
  };
  walk("src");
  return out;
}
const read = (rel) => fs.readFileSync(path.join(mobile, rel), "utf8");
const FILES = sources();
const lineOf = (src, index) => src.slice(0, index).split("\n").length;

/** Bir JSX açılış etiketinin metni (süslü parantez derinliği gözetilir). */
function openingTags(src, tag) {
  const tags = [];
  // Tip parametresi (useRef<WebView>) JSX değildir: önünde tanımlayıcı karakteri olmamalı.
  const re = new RegExp(`(?<![\\w.])<${tag}(?=[\\s>/])`, "g");
  for (const m of src.matchAll(re)) {
    let depth = 0;
    let j = m.index;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    tags.push({ text: src.slice(m.index, j + 1), line: lineOf(src, m.index) });
  }
  return tags;
}

test("AC-22: hex ve rgb(a) renk literal'i yalnız src/theme/tokens.ts'te (steering §Mobil)", () => {
  const offenders = [];
  for (const rel of FILES) {
    if (rel === "src/theme/tokens.ts") continue;
    const src = read(rel);
    for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g))
      offenders.push(`${rel}:${lineOf(src, m.index)} ${m[0]}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `Renk literal'i yerine tokens.color.* / withAlpha kullanın (codemod-colors.ts --mode rn):\n${offenders.join("\n")}`,
  );
});

test("AC-22: SafeAreaView yalnız src/ui/SafeArea.tsx'te (deprecated API'nin tek kullanım yeri)", () => {
  const offenders = FILES.filter(
    (rel) =>
      rel !== "src/ui/SafeArea.tsx" && /<SafeAreaView\b|\bSafeAreaView\s*[,}]/.test(read(rel)),
  );
  assert.deepEqual(
    offenders,
    [],
    `SafeArea / Screen / ModalFrame kullanın: ${offenders.join(", ")}`,
  );
});

test("AC-22: <Modal yalnız src/ui/ModalFrame.tsx'te", () => {
  const offenders = [];
  for (const rel of FILES) {
    if (rel === "src/ui/ModalFrame.tsx") continue;
    const src = read(rel);
    for (const m of src.matchAll(/<Modal\b/g)) offenders.push(`${rel}:${lineOf(src, m.index)}`);
    if (/import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*"react-native"/.test(src))
      offenders.push(`${rel}: react-native Modal import'u`);
  }
  assert.deepEqual(offenders, [], `ModalFrame kullanın:\n${offenders.join("\n")}`);
});

test("AC-23: ModalFrame accessibilityViewIsModal + onRequestClose taşır", () => {
  const src = read("src/ui/ModalFrame.tsx").replace(/^\s*\/\/.*$/gm, "");
  const modal = openingTags(src, "Modal");
  assert.equal(modal.length, 1, "ModalFrame tek bir <Modal> render eder");
  assert.match(modal[0].text, /onRequestClose=\{/, "<Modal> her zaman onRequestClose alır");
  const roots = (src.match(/accessibilityViewIsModal=\{true\}/g) ?? []).length;
  assert.ok(roots >= 2, "overlay ve sayfa kökleri accessibilityViewIsModal taşır");
});

test("AC-22: her <WebView accessibilityLabel taşır", () => {
  const missing = [];
  let count = 0;
  for (const rel of FILES) {
    const src = read(rel);
    for (const t of openingTags(src, "WebView")) {
      count++;
      if (!/accessibilityLabel=/.test(t.text)) missing.push(`${rel}:${t.line}`);
    }
  }
  assert.ok(count >= 2, "harita WebView'leri bulunamadı");
  assert.deepEqual(missing, [], `WebView etiketi eksik: ${missing.join(", ")}`);
});

// Android üst ofset ratchet'i (design §7.3): SafeArea Android'de üst boşluk eklemez; ekranlardaki
// manuel ofsetler baseline'dır. Sayı artarsa test düşer; azalırsa baseline'ı düşürün.
const OFFSET_BASELINE = {
  "src/screens/MapScreen.tsx": 5,
  "src/screens/PublicProfileView.tsx": 1,
  "src/components/EditProfileModal.tsx": 1,
};
test("Android üst ofset ratchet'i ≤ baseline (7) ve androidTopInset kullanımı 0", () => {
  const counts = {};
  const insetUsers = [];
  for (const rel of FILES) {
    if (rel.startsWith("src/ui/")) continue;
    const src = read(rel);
    if (/\bandroidTopInset\b/.test(src)) insetUsers.push(rel);
    const usesPrimitive =
      /import\s*\{[^}]*\b(SafeArea|Screen|ModalFrame)\b[^}]*\}\s*from\s*"[./]*\/?ui"/.test(src);
    if (!usesPrimitive) continue;
    const n = (
      src.match(/\b(top|paddingTop|marginTop)\s*:\s*Platform\.OS\s*===\s*"(ios|android)"\s*\?/g) ??
      []
    ).length;
    if (n) counts[rel] = n;
  }
  for (const [rel, n] of Object.entries(counts))
    assert.ok(
      n <= (OFFSET_BASELINE[rel] ?? 0),
      `${rel}: ${n} ofset (baseline ${OFFSET_BASELINE[rel] ?? 0})`,
    );
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.ok(total <= 7, `toplam ofset ${total} > 7`);
  assert.deepEqual(insetUsers, [], "androidTopInset bu işte hiçbir kökte açılmaz (F-14)");
});

test("R5-6: SafeArea'da edges prop'u yok; androidTopInset varsayılanı false", () => {
  const src = read("src/ui/SafeArea.tsx");
  assert.doesNotMatch(src, /\bedges\s*\??:/);
  assert.match(src, /androidTopInset = false/);
});

test("AC-23: src/ui dokunulabilirleri accessibilityRole taşır, hedef ≥ tokens.touch.min", () => {
  const problems = [];
  for (const rel of FILES.filter((f) => f.startsWith("src/ui/") && f.endsWith(".tsx"))) {
    const src = read(rel);
    const tags = [...openingTags(src, "TouchableOpacity"), ...openingTags(src, "Pressable")];
    for (const t of tags)
      if (!/accessibilityRole=/.test(t.text))
        problems.push(`${rel}:${t.line} accessibilityRole yok`);
    if (tags.length && !/tokens\.touch\.min|hitSlopFor\(/.test(src))
      problems.push(`${rel}: 44pt hedef (tokens.touch.min) kullanılmıyor`);
  }
  assert.deepEqual(problems, [], problems.join("\n"));
  const icon = read("src/ui/IconButton.tsx");
  assert.match(icon, /\n\s*label: string;/, "IconButton label zorunlu");
});

test("BottomTabBar: tabbar/tab rolü ve selected durumu", () => {
  const src = read("src/components/BottomTabBar.tsx");
  assert.match(src, /accessibilityRole="tabbar"/);
  assert.match(src, /accessibilityRole="tab"/);
  assert.match(src, /accessibilityState=\{\{ selected: isActive \}\}/);
});

test("mobil token'lar: font.maxScale (compact 1.4, body 2) ve 44pt dokunma", () => {
  const src = read("src/theme/tokens.ts");
  assert.match(src, /maxScale: \{\s*compact: 1\.4,\s*body: 2\s*\}/);
  assert.match(src, /touch: \{\s*min: 44\s*\}/);
});
