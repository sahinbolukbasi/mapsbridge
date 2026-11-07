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
  // FEAT-012: Planla önizleme haritası kaldırıldı; tek harita WebView'i rota görünümündedir.
  assert.ok(count >= 1, "harita WebView'i bulunamadı");
  assert.deepEqual(missing, [], `WebView etiketi eksik: ${missing.join(", ")}`);
});

// Android üst ofset ratchet'i (design §7.3): SafeArea Android'de üst boşluk eklemez; ekranlardaki
// manuel ofsetler baseline'dır. Sayı artarsa test düşer; azalırsa baseline'ı düşürün.
// FEAT-012: ekranlar yeniden yazılınca 7 → 1 (yalnız MapScreen'in yüzen arama satırı).
const OFFSET_BASELINE = {
  "src/screens/MapScreen.tsx": 1,
};
test("Android üst ofset ratchet'i ≤ baseline (1) ve androidTopInset kullanımı 0", () => {
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
  assert.ok(total <= 1, `toplam ofset ${total} > 1`);
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
// FEAT-011 src/ui ve BottomTabBar'ı Pressable'a taşıyınca 423'e, FEAT-012 ekranları, Paywall ve
// modalları primitive'lerle yeniden kurunca 0'a indi. Sayı yalnızca düşer; listede olmayan (yeni)
// dosyada 0'dır. Liste boş: artık hiçbir dosyada TouchableOpacity yok.
const TOUCHABLE_BASELINE = {};
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

test("R16: expo-haptics yalnız src/ui/haptics.ts sarmalayıcısından (reduce-motion + sistem ayarı)", () => {
  const offenders = [];
  for (const rel of FILES) {
    if (rel === "src/ui/haptics.ts") continue;
    const src = read(rel);
    for (const m of src.matchAll(/(?:from\s+|require\(\s*|import\(\s*)["']expo-haptics["']/g))
      offenders.push(`${rel}:${lineOf(src, m.index)}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `src/ui/haptics.ts sarmalayıcısını kullanın:\n${offenders.join("\n")}`,
  );
  if (FILES.includes("src/ui/haptics.ts"))
    assert.match(
      read("src/ui/haptics.ts"),
      /isReducedMotion\(|useReducedMotion\(/,
      "haptik reduce-motion'a saygılı",
    );
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
  // FEAT-011 review #3/#4: iOS'ta canlı bölge yok → announceForAccessibility; sheet adlı eylemler.
  assert.match(read("src/ui/useAnnounce.ts"), /AccessibilityInfo\.announceForAccessibility/);
  for (const file of ["MessageLog", "Stepper", "ComposerBar"])
    assert.match(read(`src/ui/${file}.tsx`), /useAnnounce\(/, `${file} iOS duyurusu yok`);
  assert.match(sheet, /name: "expand"/);
  assert.match(sheet, /name: "collapse"/);
  assert.doesNotMatch(sheet, /"increment"|"decrement"/);
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
  // Misafir modu (design §6.3/§6.4; FEAT-011 review #1/#2): gezi kaydı sahibe bağlı, çıkışta
  // geziler ve satın alma kimliği bırakılır; misafirin Pro tetikleyicisi paywall değil kapı açar.
  assert.match(app, /tripStore\.setOwner\(tripOwner\)/);
  assert.match(app, /tripStore\.clearForSignOut\(\)/);
  assert.match(app, /resetRevenueCat\(\)/);
  assert.doesNotMatch(app, /tripStore\s*\.syncWithServer\(/, "eşitleme yalnız setOwner üzerinden");
  assert.match(app, /<PlanScreen[\s\S]*?guest=\{!signedIn\}/);
  assert.match(app, /<MapScreen[\s\S]*?guest=\{!signedIn\}/);
  // FEAT-012: Pro şablonları kaldırıldı; Planla ve rota görünümü RevenueCat'e dokunmaz, misafir
  // kaydetme/paylaşma AuthGate sheet açar (FEAT-011 review #1 notu çözüldü).
  for (const rel of ["src/screens/PlanScreen.tsx", "src/screens/MapScreen.tsx"]) {
    const src = read(rel);
    assert.doesNotMatch(src, /PaywallModal|getOfferings|isProSync|revenuecat/, rel);
    assert.match(src, /<AuthGate\s+variant="sheet"/, `${rel} misafir kapısı`);
  }
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

// ── FEAT-012: ekranlar web ile pariteye (design §9, §6.4, J6; kararlar S2/S6/S7/S10/S21/S22) ──
/** Tam satır yorumları ve blok yorumları atılmış kaynak (yasaklı ifadeler yorumda anlatılabilir). */
const code = (rel) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");

test("FEAT-012: eski karşılama, ikon seti ve uydurma kaynaklar kaldırıldı", () => {
  for (const rel of ["src/screens/WelcomeScreen.tsx", "src/components/Icons.tsx"])
    assert.ok(!fs.existsSync(path.join(mobile, rel)), `${rel} silinmeli`);
  for (const rel of FILES)
    assert.doesNotMatch(read(rel), /components\/Icons|from "\.\/Icons"/, rel);
});

test("FEAT-012 (S6, S1, §7.1): mağaza/indir/yakında, EN POPÜLER, deneme ve kredi kartı vaadi yok", () => {
  const banned =
    /yakında|uygulamayı indir|app store|google play|en popüler|ücretsiz deneme|kredi kartı gerekmez|botanical atelier/i;
  const offenders = FILES.filter((rel) => banned.test(code(rel)));
  assert.deepEqual(offenders, [], offenders.join(", "));
});

test("FEAT-012: Keşfet metni yalnız i18n/home.ts'ten, girişi Asistan'a gider; Apple 'yakında' yok", () => {
  const explore = read("src/screens/ExploreScreen.tsx");
  assert.match(explore, /from "\.\.\/i18n\/home"/);
  assert.match(explore, /readShareCode/);
  assert.doesNotMatch(explore, /home\.mobile\./);
  const app = read("App.tsx");
  assert.match(app, /<ExploreScreen/);
  assert.doesNotMatch(app, /WelcomeScreen|handleAppleSignIn|onSelectApple/);
  assert.match(app, /setAssistantPrompt\(\{ text, nonce: Date\.now\(\) \}\);\s*selectTab\("ai"\)/);
  assert.doesNotMatch(code("src/screens/AuthScreen.tsx"), /Apple/);
});

test("FEAT-012 (§6.1): misafir asistan ağ çağrısı yapmaz; üye asistan rozetsiz gönder + not (S22)", () => {
  const guest = code("src/screens/GuestAssistantView.tsx");
  assert.doesNotMatch(guest, /services\/api|aiService|fetch\(/);
  assert.match(guest, /<AuthGate\s+variant="sheet"\s+reason="ai"\s+draft/);
  assert.match(guest, /cost=\{5\}/);
  const app = read("App.tsx");
  assert.match(app, /signedIn \? \(\s*<AIScreen[\s\S]*?\) : \(\s*<GuestAssistantView/);
  const ai = code("src/screens/AIScreen.tsx");
  assert.match(ai, /note=\{tr\("assistant\.composer\.costNote"\)\}/);
  assert.doesNotMatch(ai, /<ComposerBar[^>]*\bcost=/, "gönder düğmesi kredi rozeti taşımaz (S22)");
  assert.match(ai, /announcement=\{announcement\}/, "iOS duyurusu (FEAT-011 review #3)");
  // Taslak: otomatik ücretli çağrı yok; kullanıcı dokununca gider.
  assert.match(
    ai,
    /onCreate=\{\(\) => send\(buildGuestSummaryMessage\(guestDraft\), \{ fromDraft: true \}\)\}/,
  );
  assert.doesNotMatch(ai, /useEffect\([^)]*send\(/);
  // I8: affiliate yalnız Hazırlık sekmesinde.
  assert.match(ai, /tab === "prep"/);
});

test("FEAT-012 (S10/S21): Mesajlar sekmesi MessageLog + ComposerBar, grup/süzgeç yok", () => {
  const chat = code("src/screens/ChatScreen.tsx");
  assert.match(chat, /<MessageLog/);
  assert.match(chat, /<ComposerBar/);
  assert.match(chat, /announcement=/);
  assert.doesNotMatch(chat, /isGroup|Gruplar|NewGroup|"groups"/);
  assert.match(read("App.tsx"), /case "messages":\s*return <ChatScreen/);
});

test("FEAT-012 (§6.4): Topluluk yazma eylemleri misafirde AuthGate", () => {
  const c = code("src/screens/CommunityScreen.tsx");
  for (const call of ["toggleLike", "toggleBookmark"])
    assert.match(
      c,
      new RegExp(`requireMember\\("save", \\(\\) => socialSyncService\\.${call}`),
      call,
    );
  assert.match(c, /requireMember\("save", \(\) => setComposeOpen\(true\)\)/);
  assert.match(c, /requireMember\("messages"/);
  assert.doesNotMatch(c, /retweet|Bildir|Sessize|@canberk/);
});

test("FEAT-012 (S2/S18): Paywall 4 plan, fiyat yalnız katalogdan, satın alma revenuecat ile", () => {
  const pw = code("src/components/PaywallModal.tsx");
  assert.match(pw, /PLAN_TIERS\.map/);
  assert.match(pw, /billingService\.getPlans\(\)/);
  assert.match(
    pw,
    /import \{ getOfferings, purchasePackage, restorePurchases \} from "\.\.\/services\/revenuecat"/,
  );
  assert.match(pw, /findMonthlyProduct/);
  assert.doesNotMatch(pw, /priceString|\$rc_annual|\$rc_lifetime|yearly/);
  // Misafirde RevenueCat çağrılmaz.
  assert.match(pw, /loadCatalog\(\);\s*if \(guest\) return;\s*getOfferings\(\)/);
});

test("FEAT-012 (I1/I2): rota görünümü bağlantı değerlerini yalnız OSRM'den alır", () => {
  const map = code("src/screens/MapScreen.tsx");
  assert.doesNotMatch(map, /walkTimeFromPrev|distanceFromPrev|rating: 4\.8|optimizeRoute\(\)/);
  assert.match(map, /<Connector/);
  assert.match(map, /optimizeStopOrder\(route\.stops\)/);
  assert.doesNotMatch(
    map,
    /<Button[^>]*label=\{tr\("planner\.optimize"\)\}[^>]*cost=/,
    "S19: rozet yok",
  );
  const html = read("src/map/leaflet-html.ts");
  assert.match(html, /type: "ROUTE_LEGS"/);
  assert.match(html, /OSRM_MAX_POINTS/);
});
// ── Increment 4.2: bağımlılıklar tam sürüm; app.config.ts kaynak, app.json eşit; izinler TR + EN ──
test("4.2: native paketler tam sürüm, app.json app.config.ts ile eşit, izin metinleri TR + EN", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(mobile, "package.json"), "utf8"));
  const pinned = {
    "expo-haptics": "57.0.3",
    "expo-notifications": "57.0.25",
    "expo-sharing": "57.0.25",
    "expo-linking": "57.0.13",
    "expo-location": "57.0.23",
    "expo-file-system": "57.0.7",
    "expo-local-authentication": "57.0.3",
  };
  for (const [name, version] of Object.entries(pinned))
    assert.equal(pkg.dependencies[name], version, `${name} tam sürüm`);
  for (const name of ["react-native-purchases", "react-native-purchases-ui"])
    assert.match(pkg.dependencies[name], /^\d+\.\d+\.\d+$/, `${name} aralık değil tam sürüm`);
  const { loadTs } = require("./helpers/load-ts.cjs");
  const cfg = loadTs(path.join(mobile, "app.config.ts"), { globals: { process: { env: {} } } });
  const json = JSON.parse(fs.readFileSync(path.join(mobile, "app.json"), "utf8"));
  assert.deepEqual(json, JSON.parse(JSON.stringify(cfg.APP_CONFIG)), "app.json = app.config.ts");
  const keys = [
    "NSLocationWhenInUseUsageDescription",
    "NSCameraUsageDescription",
    "NSPhotoLibraryUsageDescription",
    "NSPhotoLibraryAddUsageDescription",
    "NSFaceIDUsageDescription",
  ];
  const expo = json.expo;
  for (const lang of ["tr", "en"]) {
    const strings = JSON.parse(fs.readFileSync(path.join(mobile, expo.locales[lang]), "utf8"));
    for (const k of keys) assert.ok(strings[k] && strings[k].length > 20, `${lang} ${k}`);
  }
  for (const k of keys) assert.ok(expo.ios.infoPlist[k], `infoPlist ${k}`);
  // Arka plan konumu istenmez (yalnız uygulama açıkken "Yakınımda").
  assert.ok(!expo.ios.infoPlist.NSLocationAlwaysUsageDescription);
  assert.ok(!expo.android.permissions.includes("ACCESS_BACKGROUND_LOCATION"));
  assert.ok(
    expo.android.blockedPermissions.includes("android.permission.ACCESS_BACKGROUND_LOCATION"),
  );
});
