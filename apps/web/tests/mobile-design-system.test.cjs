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

// R6 (design §15, design-system.md §11): yeni kodda TouchableOpacity yerine primitive/Pressable.
// Dosya başına `TouchableOpacity` geçiş sayısı ratchet'i: 2026-11-06'da (FEAT-011 başı) 438 ölçüldü;
// FEAT-011 src/ui ve BottomTabBar'ı Pressable'a taşıyınca 423'e indi. Sayı yalnızca düşer; listede
// olmayan (yeni) dosyada 0'dır. Bir dosyada sayı düşünce baseline'ı da düşürün.
const TOUCHABLE_BASELINE = {
  "src/components/EditPostModal.tsx": 7,
  "src/components/EditProfileModal.tsx": 15,
  "src/components/ErrorBoundary.tsx": 3,
  "src/components/PaywallModal.tsx": 9,
  "src/components/RouteLoadingModal.tsx": 5,
  "src/components/ScreenTourModal.tsx": 7,
  "src/screens/AIScreen.tsx": 45,
  "src/screens/AuthScreen.tsx": 23,
  "src/screens/ChatScreen.tsx": 23,
  "src/screens/CommunityScreen.tsx": 39,
  "src/screens/MapScreen.tsx": 71,
  "src/screens/PlanScreen.tsx": 75,
  "src/screens/ProfileScreen.tsx": 49,
  "src/screens/PublicProfileView.tsx": 43,
  "src/screens/WelcomeScreen.tsx": 9,
};
test("R6: TouchableOpacity ratchet'i — dosya başına sayı yalnızca düşer, yeni dosyada 0", () => {
  const problems = [];
  let total = 0;
  for (const rel of FILES) {
    const n = (read(rel).match(/\bTouchableOpacity\b/g) ?? []).length;
    total += n;
    const max = TOUCHABLE_BASELINE[rel] ?? 0;
    if (n > max)
      problems.push(
        `${rel}: ${n} TouchableOpacity (baseline ${max}); Pressable ya da primitive kullanın`,
      );
  }
  const budget = Object.values(TOUCHABLE_BASELINE).reduce((a, b) => a + b, 0);
  assert.deepEqual(problems, [], problems.join("\n"));
  assert.ok(total <= budget, `toplam ${total} > ${budget}`);
});

test("R6: Animated.timing/spring/loop yalnız src/ui/motion.ts'te (reduce-motion tek yerden)", () => {
  const offenders = [];
  for (const rel of FILES) {
    if (rel === "src/ui/motion.ts") continue;
    const src = read(rel);
    for (const m of src.matchAll(/\bAnimated\.(timing|spring|loop|decay)\s*\(/g))
      offenders.push(`${rel}:${lineOf(src, m.index)} Animated.${m[1]}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `motion.animate / spring / loop kullanın:\n${offenders.join("\n")}`,
  );
  const motion = read("src/ui/motion.ts");
  for (const name of ["animate", "spring", "easing", "loop", "layoutNext"])
    assert.match(
      motion,
      new RegExp(`export function ${name}\\(`),
      `motion.ts ${name}() dışa aktarmalı`,
    );
  assert.match(motion, /tokens\.motion\.spring\[preset\]/, "spring değerleri token'dan");
  assert.match(motion, /isReducedMotion\(\)/, "reduce-motion gözetilir");
});

// FEAT-011 ile eklenen RN primitive'leri (design §4.2): web ile aynı ad; dokunulabilir öğeler
// Pressable, accessibilityRole taşır ve metinler maxFontSizeMultiplier ile ölçeklenir.
const PRIMITIVES = [
  "Icon",
  "Chip",
  "SegmentedControl",
  "BottomSheet",
  "Stepper",
  "Accordion",
  "CostBadge",
  "CreditCostTable",
  "PlanCard",
  "QuestionCard",
  "ComposerBar",
  "MessageLog",
  "StopRow",
  "AuthGate",
  "Media",
  "Button",
  "IconButton",
  "Card",
];
test("R6: src/ui primitive'leri Pressable kullanır (TouchableOpacity yok), index'ten dışa aktarılır", () => {
  const index = read("src/ui/index.ts");
  const problems = [];
  for (const name of PRIMITIVES) {
    const rel = `src/ui/${name}.tsx`;
    if (!fs.existsSync(path.join(mobile, rel))) {
      problems.push(`${rel} yok`);
      continue;
    }
    const src = read(rel);
    if (/\bTouchableOpacity\b/.test(src)) problems.push(`${rel}: TouchableOpacity`);
    if (/<Text\b/.test(src)) {
      const texts = openingTags(src, "Text");
      for (const t of texts)
        if (!/maxFontSizeMultiplier=/.test(t.text))
          problems.push(`${rel}:${t.line} <Text> maxFontSizeMultiplier yok`);
    }
    if (!new RegExp(`\\b${name}\\b`).test(index))
      problems.push(`src/ui/index.ts ${name} dışa aktarmıyor`);
  }
  for (const name of [
    "Chip",
    "SegmentedControl",
    "BottomSheet",
    "Accordion",
    "Button",
    "IconButton",
  ])
    if (!/<Pressable\b/.test(read(`src/ui/${name}.tsx`)))
      problems.push(`src/ui/${name}.tsx Pressable değil`);
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("R6: primitive erişilebilirlik durumları (selected / checked / expanded / canlı bölge)", () => {
  assert.match(read("src/ui/Chip.tsx"), /accessibilityState=\{\{ selected: pressed/);
  const seg = read("src/ui/SegmentedControl.tsx");
  assert.match(seg, /accessibilityRole="radiogroup"/);
  assert.match(seg, /accessibilityRole="radio"/);
  assert.match(read("src/ui/Accordion.tsx"), /accessibilityState=\{\{ expanded: open \}\}/);
  assert.match(read("src/ui/MessageLog.tsx"), /accessibilityLiveRegion="polite"/);
  const sheet = read("src/ui/BottomSheet.tsx");
  assert.match(sheet, /PanResponder\.create/);
  assert.match(sheet, /spring\(translate, .*"sheet"/);
  const icon = read("src/ui/Icon.tsx");
  assert.match(icon, /accessibilityElementsHidden: true/, "etiketsiz ikon gizlenir");
  assert.match(icon, /from "\.\.\/theme\/icon-paths"/, "path'ler üretilmiş icon-paths'ten");
});

test("Tek IA (design §5.3): misafir/üye sekme setleri ve BottomTabBar Icon + Pressable", () => {
  const types = read("src/types.ts");
  assert.match(
    types,
    /GUEST_TABS: readonly MobileTab\[\] = \["explore", "plan", "ai", "community", "login"\]/,
  );
  assert.match(
    types,
    /MEMBER_TABS: readonly MobileTab\[\] = \["plan", "ai", "community", "messages", "profile"\]/,
  );
  const bar = read("src/components/BottomTabBar.tsx");
  assert.match(bar, /<Pressable\b/);
  assert.match(bar, /<Icon\b/);
  assert.doesNotMatch(bar, /TouchableOpacity|from "\.\/Icons"/);
});

test("App: misafir göz atma açık, Splash yapay süre taşımaz, BackHandler + yazı tipleri bağlı", () => {
  const app = read("App.tsx");
  assert.doesNotMatch(app, /No guest exploration bypass/);
  assert.doesNotMatch(app, /minDurationMs/);
  assert.match(app, /useFonts\(FONT_SOURCES\)/);
  assert.match(app, /BackHandler\.addEventListener\("hardwareBackPress"/);
  assert.match(app, /GUEST_TABS/);
  const splash = read("src/components/SplashScreen.tsx");
  assert.doesNotMatch(splash, /minDurationMs|setInterval|setTimeout/);
  for (const banned of ["CANLI KÖPRÜ", "Eco-Path", "ROUTE OS", "V2.4", "4.8K"])
    assert.ok(!splash.includes(banned), `SplashScreen "${banned}" içeriyor`);
});

test("Yazı tipleri (karar S13): TTF + OFL lisansı ve expo-font tam sürüm", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(mobile, "package.json"), "utf8"));
  assert.equal(pkg.dependencies["expo-font"], "57.0.4");
  const fonts = read("src/theme/fonts.ts");
  for (const m of fonts.matchAll(/require\("\.\.\/\.\.\/(assets\/fonts\/[^"]+\.ttf)"\)/g))
    assert.ok(fs.existsSync(path.join(mobile, m[1])), `${m[1]} yok`);
  for (const lic of ["Inter-OFL.txt", "PlusJakartaSans-OFL.txt"]) {
    const text = fs.readFileSync(path.join(mobile, "assets/fonts", lic), "utf8");
    assert.match(text, /SIL Open Font License, Version 1\.1/);
  }
});
