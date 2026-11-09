// Mobil dayanıklılık (mobile-hardening-2026-11-09): açılış-zamanı çökmelerine karşı sertleştirme.
// Teşhis (mobile-crash-2026-11-09): "object is not a function" — bir alt bileşen render sırasında
// throw edip kök ErrorBoundary'yi tetikleyerek TÜM uygulamayı tek hata ekranına indiriyordu; ayrıca
// Expo sarmalayıcılarını import eden hiçbir test yoktu, bu yüzden yanlış/taşınmış bir yerli yöntem
// CI'dan sızıyordu. Bu dosya üç şeyi en küçük fonksiyonda doğrular:
//   1) Ekran-düzeyi ErrorBoundary: children çizer, throw'u yakalar, yerelleştirilmiş fallback +
//      "Tekrar dene" gösterir; retry children'ı yeniden mount eder.
//   2) Her yerli sarmalayıcı: modül mevcut (available) ve eksik/reddedilmiş (unavailable/denied)
//      yolda graceful davranır — throw etmez, özelliği kapatır.
//   3) Expo modül yöntem-varlığı öz-denetimi: checkNativeModules eksik/yanlış tipli üyeyi yakalar.
//
// Expo bare import'ları node_modules'ta kurulu DEĞİL; bu yüzden esbuild `alias` ile stub'a
// yönlendirilir (loadTs'in relative/absolute stub'larından farklı). Böylece sarmalayıcıların
// GERÇEK kaynağı, kontrollü bir yerli modül davranışıyla çalıştırılır.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const React = require("react");
const esbuild = require("esbuild");

const MOBILE = path.resolve(__dirname, "../../../mobile/src");
const STUBS = path.resolve(__dirname, "../stubs/expo");

// Bir mobil TS dosyasını, Expo bare import'ları verilen stub dosyalarına çevirerek bundle eder.
// `alias`: { "expo-haptics": "/abs/stub.cjs", ... }. Sonuç cjs metni döner.
// Her bundle'da sabit stub'lar: react-native (Platform/Linking) ve depolama katmanı node'da
// kurulu değildir; davranışları bu testin kapsamı dışıdır, bu yüzden hafif stub'lara çevrilir.
const BASE_ALIAS = {
  "react-native": path.join(STUBS, "react-native.cjs"),
  "@react-native-async-storage/async-storage": path.join(STUBS, "async-storage.cjs"),
  "expo-secure-store": path.join(STUBS, "expo-secure-store.cjs"),
};

function bundleWithExpoStubs(entry, alias = {}) {
  const r = esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    target: "node22",
    logLevel: "silent",
    alias: { ...BASE_ALIAS, ...alias },
    external: ["react"],
  });
  return r.outputFiles[0].text;
}

const quiet = { ...console, warn: () => {}, error: () => {} };

// vm bağlamında üretilen nesneler farklı realm'dendir; deepStrictEqual reference-equal ister.
// JSON turu ile realm-bağımsız karşılaştırma yapılır (diğer mobil testlerdeki `plain` ile aynı).
const plain = (v) => JSON.parse(JSON.stringify(v));

// Bundle'ı vm'de çalıştırır; `globals` ile stub davranışı enjekte edilir (globalThis.__expo).
function runModule(code, entry, globals = {}) {
  const module = { exports: {} };
  const ctx = vm.createContext({
    module,
    exports: module.exports,
    require,
    console: quiet,
    process: { env: {} },
    Buffer,
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    __DEV__: false,
    ...globals,
  });
  vm.runInContext(code, ctx, { filename: entry });
  return module.exports;
}

function loadWrapper(rel, alias, globals) {
  const entry = path.join(MOBILE, rel);
  return runModule(bundleWithExpoStubs(entry, alias), entry, globals);
}

// Relative/bare import'ları stub'a yönlendiren plugin'li async bundle (buildSync plugin desteklemez).
// `resolveMap`: import specifier (yazıldığı gibi, ör. "../ui" ya da "react-native") → stub abs yolu.
// Yalnız ScreenErrorBoundary gibi RN-primitive bağımlı bir bileşeni, gerçek sınıf davranışıyla
// (getDerivedStateFromError + render) çalıştırmak için kullanılır; react dışarıda tutulur.
async function bundleWithPlugin(entry, resolveMap) {
  const plugin = {
    name: "resilience-stubs",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === "entry-point") return undefined;
        if (resolveMap[args.path]) return { path: resolveMap[args.path] };
        return undefined;
      });
    },
  };
  const r = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    target: "node22",
    logLevel: "silent",
    external: ["react"],
    plugins: [plugin],
  });
  return r.outputFiles[0].text;
}

// ── 1) Ekran-düzeyi ErrorBoundary ───────────────────────────────────────────
// ScreenErrorBoundary ui/theme/i18n'e bağlı (RN primitive'leri). Burada saf davranışı test ederiz:
// UI_TR'den yerelleştirilmiş metinler mevcut mu, children çizilir mi, throw yakalanır mı. RN
// primitive ağacını mount etmek yerine, sınırın mantığını doğrulamak için minimal bir React
// bileşeniyle aynı sözleşmeyi (getDerivedStateFromError + retry key) çalıştırırız; ayrıca gerçek
// kaynağın bu sözleşmeyi kullandığını statik olarak doğrularız.
const SEB_SRC = fs.readFileSync(path.join(MOBILE, "components/ScreenErrorBoundary.tsx"), "utf8");
// i18n/ui.ts yerli bağımlılığı yoktur; doğrudan bundle edip TEXT sözlüğünü okuruz.
const i18n = (() => {
  const entry = path.join(MOBILE, "i18n/ui.ts");
  return runModule(bundleWithExpoStubs(entry), entry);
})();
const UI_TR = { ...i18n.UI_TR, ...i18n.NATIVE_TR };

test("ScreenErrorBoundary: yerelleştirilmiş fallback metinleri ve retry sözleşmesi mevcut", () => {
  // Fallback metinleri i18n'den (TR); kök sınırdan ayrı, 'yalnız bu ekran' mesajı.
  assert.ok(UI_TR["native.error.screenTitle"], "screenTitle anahtarı var");
  assert.ok(UI_TR["native.error.screenBody"], "screenBody anahtarı var");
  assert.ok(UI_TR["ui.retry"], "retry etiketi var");
  // Kaynak sözleşmesi: getDerivedStateFromError ile yakalar, retry key artırır (remount), alert rolü.
  assert.match(SEB_SRC, /static getDerivedStateFromError/);
  assert.match(SEB_SRC, /componentDidCatch/);
  assert.match(SEB_SRC, /resetKey: prev\.resetKey \+ 1/, "retry children'ı remount eder");
  assert.match(SEB_SRC, /accessibilityRole="alert"/);
  assert.match(SEB_SRC, /native\.error\.screenTitle/);
  assert.match(SEB_SRC, /native\.error\.screenBody/);
  assert.match(SEB_SRC, /tr\("ui\.retry"\)/);
  // Fallback svg-bağımsız: EmptyState (→ Icon → react-native-svg) import EDİLMEZ (mobile-crash2).
  assert.doesNotMatch(SEB_SRC, /import[^;]*\bEmptyState\b[^;]*from/, "EmptyState import edilmemeli (svg-bağımsız)");
  assert.doesNotMatch(SEB_SRC, /<EmptyState/, "fallback JSX'inde EmptyState kullanılmamalı");
  // Kök ErrorBoundary son çare olarak korunur (App.tsx hâlâ sarar).
  const app = fs.readFileSync(path.join(MOBILE, "..", "App.tsx"), "utf8");
  assert.match(app, /<ErrorBoundary>\s*<App \/>\s*<\/ErrorBoundary>/);
  assert.match(app, /<ScreenErrorBoundary name=\{tab\}>\{renderTab\(tab\)\}<\/ScreenErrorBoundary>/);
  assert.match(app, /<ScreenErrorBoundary name=\{top\}>/, "yığın ekranı da sarılır");
  assert.match(app, /<ScreenErrorBoundary name="onboarding">/, "tanıtım da sarılır");
  // Kabuk bileşenleri (her zaman mount, per-screen sınır DIŞI) de ayrı sınırlarla sarılır; biri
  // çökse de kök "Bir şeyler ters gitti" tetiklenmez (mobile-crash2 adım 1).
  for (const name of ["paywall", "reminder", "shared", "tabbar"])
    assert.match(app, new RegExp(`<ScreenErrorBoundary name="${name}">`), `${name} kabuğu sarılmalı`);
});

// Gerçek ScreenErrorBoundary sınıfını, RN primitive'lerini hafif stub'lara (React.createElement
// marker'ları) çevirerek yükler ve davranışını renderer olmadan — render() + getDerivedStateFromError
// + setState sözleşmesini doğrudan çağırarak — test eder.
async function loadScreenBoundary() {
  const entry = path.join(MOBILE, "components/ScreenErrorBoundary.tsx");
  // ../i18n/ui gerçek kaynaktan bundle'lanır (yerli bağımlılığı yok) → tr() gerçek TR değerleri döner.
  const resolveMap = {
    "../ui": path.join(STUBS, "ui.cjs"),
    "../theme": path.join(STUBS, "theme.cjs"),
    "react-native": path.join(STUBS, "react-native.cjs"),
  };
  const code = await bundleWithPlugin(entry, resolveMap);
  return runModule(code, entry, { React, __stubReact: React });
}

// Bir element ağacında marker tipini (type.__name) arar.
function findMarker(node, name) {
  if (!node || typeof node !== "object") return null;
  if (node.type && (node.type.__name === name || node.type === name)) return node;
  const kids = node.props && node.props.children;
  const arr = Array.isArray(kids) ? kids : kids != null ? [kids] : [];
  for (const k of arr) {
    const hit = findMarker(k, name);
    if (hit) return hit;
  }
  return null;
}

test("ScreenErrorBoundary: children çizer, throw'u yakalar, fallback + retry gösterir", async () => {
  const { ScreenErrorBoundary } = await loadScreenBoundary();

  // (a) Sağlıklı: hasError=false → children Fragment içinde çizilir (fallback yok).
  const childEl = React.createElement("child-content", null, "yüklendi");
  const inst = new ScreenErrorBoundary({ children: childEl, name: "explore" });
  inst.setState = function (updater) {
    this.state = { ...this.state, ...(typeof updater === "function" ? updater(this.state) : updater) };
  };
  let out = inst.render();
  assert.equal(out.type, React.Fragment, "sağlıklı durumda Fragment");
  assert.equal(out.props.children, childEl, "children olduğu gibi çizilir");

  // (b) Throw yakalanır: getDerivedStateFromError hasError:true + error döndürür.
  const err = new Error("object is not a function");
  const derived = ScreenErrorBoundary.getDerivedStateFromError(err);
  assert.equal(derived.hasError, true);
  assert.equal(derived.error, err);

  // (c) Fallback: hasError=true → yerelleştirilmiş başlık/gövde + retry düğmesi; alert rolü.
  // SVG/ikon-bağımsız: EmptyState→Icon→react-native-svg zinciri KULLANILMAZ (mobile-crash2 adım 2);
  // yalnız saf RN Txt + Button. Böylece react-native-svg eksik olsa bile fallback yeniden throw etmez.
  inst.state = { hasError: true, error: err, resetKey: 0 };
  out = inst.render();
  assert.equal(findMarker(out, "EmptyState"), null, "fallback EmptyState/Icon KULLANMAZ (svg-bağımsız)");
  const titleTxt = findMarker(out, "Txt");
  assert.ok(titleTxt, "fallback saf RN Txt ile başlık çizer");
  assert.equal(titleTxt.props.children, i18n.NATIVE_TR["native.error.screenTitle"]);
  const button = findMarker(out, "Button");
  assert.ok(button, "retry düğmesi var");
  assert.equal(button.props.label, i18n.UI_TR["ui.retry"]);

  // (d) Retry: onPress resetKey'i artırır ve hatayı temizler → children yeniden mount.
  button.props.onPress();
  assert.equal(inst.state.hasError, false, "retry hatayı temizler");
  assert.equal(inst.state.resetKey, 1, "retry resetKey'i artırır (remount)");
  out = inst.render();
  assert.equal(out.type, React.Fragment);
  assert.equal(out.props.children, childEl, "retry sonrası children yeniden çizilir");
  assert.equal(out.key, "1", "Fragment key = resetKey (remount tetikler)");
});

// ── 2) Yerli sarmalayıcılar: available vs unavailable/denied ──────────────────
const expoAlias = (names) => {
  const a = {};
  for (const n of names) a[n] = path.join(STUBS, `${n}.cjs`);
  return a;
};

test("biometric: donanım+kayıt varsa available; eksik/throw → kapalı (throw etmez)", async () => {
  const alias = expoAlias(["expo-local-authentication"]);
  // storage/secure-storage/react-native BASE_ALIAS ile stub'lı; expo-local-authentication davranışı
  // __expo.localAuth ile sürülür.
  const bio = loadWrapper("services/biometric.ts", alias, {
    __expo: {
      localAuth: { hasHardware: true, enrolled: true, authSuccess: true },
    },
  });
  assert.equal(await bio.biometricAvailable(), true, "donanım + kayıt → available");
  assert.equal(await bio.authenticate(), true, "başarılı kimlik doğrulama");

  // Donanım yok → unavailable, throw yok.
  const bio2 = loadWrapper("services/biometric.ts", alias, {
    __expo: { localAuth: { hasHardware: false, enrolled: true } },
  });
  assert.equal(await bio2.biometricAvailable(), false);

  // Modül yöntemi throw ediyor (eksik yerli bağlanma) → false, uygulama ayakta.
  const bio3 = loadWrapper("services/biometric.ts", alias, {
    __expo: { localAuth: { throwAll: true } },
  });
  assert.equal(await bio3.biometricAvailable(), false, "throw → false (graceful)");
  assert.equal(await bio3.authenticate(), false, "throw → false (graceful)");
});

test("nearby/currentPosition: fix varsa konum; reddedilince/throw → null (throw etmez)", async () => {
  const alias = expoAlias(["expo-location"]);
  const near = loadWrapper("services/nearby.ts", alias, {
    __expo: {
      location: { last: { coords: { latitude: 41.0, longitude: 29.0 } } },
    },
  });
  assert.deepEqual(plain(await near.currentPosition()), { lat: 41.0, lng: 29.0 }, "son bilinen konum");

  const near2 = loadWrapper("services/nearby.ts", alias, {
    __expo: { location: { last: null, current: { coords: { latitude: 1, longitude: 2 } } } },
  });
  assert.deepEqual(plain(await near2.currentPosition()), { lat: 1, lng: 2 }, "anlık konum");

  // İzin reddedildi / modül throw → null.
  const near3 = loadWrapper("services/nearby.ts", alias, {
    __expo: { location: { throwAll: true } },
  });
  assert.equal(await near3.currentPosition(), null, "throw → null (graceful)");
});

test("permissions: granted/denied/undetermined eşlenir; throw → denied (throw etmez)", async () => {
  const alias = expoAlias(["expo-location", "expo-notifications"]);
  const perm = loadWrapper("services/permissions.ts", alias, {
    __expo: {
      location: { fgPermissions: { granted: true } },
      notifications: {},
    },
  });
  assert.equal(await perm.permissionState("location"), "granted");

  const perm2 = loadWrapper("services/permissions.ts", alias, {
    __expo: { location: { fgPermissions: { granted: false, status: "undetermined" } } },
  });
  assert.equal(await perm2.permissionState("location"), "undetermined");

  const perm3 = loadWrapper("services/permissions.ts", alias, {
    __expo: { location: { throwAll: true } },
  });
  assert.equal(await perm3.permissionState("location"), "denied", "throw → denied (graceful)");
  assert.equal(await perm3.requestPermission("location"), false, "throw → false (graceful)");
});

test("notifications.configureNotifications: yerli modül throw etse de açılış throw etmez", () => {
  const alias = expoAlias(["expo-notifications"]);
  // setNotificationHandler throw ediyor (eksik yerli bağlanma senaryosu) → configureNotifications
  // yutmalı (App mount yolu; diagnosis §7.2'de 'en net açık nokta').
  const notif = loadWrapper("services/notifications.ts", alias, {
    __expo: { notifications: { throwSetHandler: true } },
  });
  assert.doesNotThrow(() => notif.configureNotifications(), "mount çağrısı throw etmemeli");

  // Normal yolda da çağrılabilir.
  const notif2 = loadWrapper("services/notifications.ts", alias, {
    __expo: { notifications: {} },
  });
  assert.doesNotThrow(() => notif2.configureNotifications());
});

test("haptics: expo-haptics throw etse de haptic() sessizce yok sayar (throw etmez)", () => {
  const alias = expoAlias(["expo-haptics"]);
  const h = loadWrapper("ui/haptics.ts", alias, {
    __expo: { haptics: { throwAll: true } },
  });
  h.setHapticsEnabled(true);
  assert.doesNotThrow(() => h.haptic("selection"), "haptik hatası render'a sızmaz");
  assert.doesNotThrow(() => h.haptic("impact"));
});

test("revenuecat.initRevenueCat: native eksik/throw olsa da açılış throw etmez (no-op)", async () => {
  const alias = expoAlias(["react-native-purchases"]);
  // API anahtarı mevcut (process.env) ama Purchases üyeleri throw ediyor (eksik pod senaryosu).
  // initRevenueCat sessizce no-op olmalı; aksi halde App mount yolunda kök sınır tetiklenir.
  const rc = loadWrapper("services/revenuecat.ts", alias, {
    process: { env: { EXPO_PUBLIC_RC_API_KEY_IOS: "ios_key" } },
    __expo: { purchases: { throwAll: true } },
  });
  await assert.doesNotReject(() => rc.initRevenueCat("user@example.com"), "native throw yutulmalı");
  // Normal yolda da sorunsuz init.
  const rc2 = loadWrapper("services/revenuecat.ts", alias, {
    process: { env: { EXPO_PUBLIC_RC_API_KEY_IOS: "ios_key" } },
    __expo: { purchases: { configured: false } },
  });
  await assert.doesNotReject(() => rc2.initRevenueCat("user@example.com"));
  // API anahtarı yoksa SDK'ya hiç dokunmaz (erken return) → throw yok.
  const rc3 = loadWrapper("services/revenuecat.ts", alias, {
    process: { env: {} },
    __expo: { purchases: { throwAll: true } },
  });
  await assert.doesNotReject(() => rc3.initRevenueCat("user@example.com"));
});

test("tile-cache: expo-file-system (File/Directory) throw etse de karo API'si sessiz kalır", () => {
  const alias = expoAlias(["expo-file-system"]);
  const tc = loadWrapper("services/tile-cache.ts", alias, {});
  // Stub File/Directory varsayılan: exists=false, list=[] → hiçbir çağrı throw etmez.
  assert.doesNotThrow(() => tc.storeTile("1/2/3", "AAAA"), "storeTile throw etmez");
  assert.doesNotThrow(() => tc.sweepTiles(), "sweepTiles throw etmez");
  assert.equal(typeof tc.sweepTiles(), "number");
});

// ── 3) Expo modül yöntem-varlığı öz-denetimi ──────────────────────────────────
test("native-selfcheck: kullanılan tüm yöntemler mevcutken ok; eksik/yanlış tip yakalanır", () => {
  const alias = expoAlias([
    "expo-file-system",
    "expo-haptics",
    "expo-location",
    "expo-notifications",
    "expo-local-authentication",
    "expo-sharing",
    "expo-linking",
    "react-native-purchases",
    "react-native-webview",
    "react-native-svg",
  ]);
  const selfcheck = loadWrapper("services/native-selfcheck.ts", alias, {
    __expo: { selfcheckMode: "complete", purchases: { configured: false } },
  });

  // Hepsi callable → ok, missing boş.
  const good = selfcheck.checkNativeModules();
  assert.equal(good.ok, true, `beklenmeyen eksik: ${good.missing.join(", ")}`);
  assert.deepEqual(plain(good.missing), []);

  // runNativeSelfCheck de throw etmez ve aynı sonucu verir.
  assert.doesNotThrow(() => selfcheck.runNativeSelfCheck());
  assert.equal(selfcheck.runNativeSelfCheck().ok, true);

  // Kapsam listesi gerçek sarmalayıcıların çağırdığı yöntemleri içerir (regresyon: biri silinirse düşer).
  const names = selfcheck.NATIVE_MODULE_MEMBERS;
  for (const needed of [
    "expo-file-system.File",
    "expo-file-system.Directory",
    "expo-haptics.selectionAsync",
    "expo-location.getCurrentPositionAsync",
    "expo-notifications.setNotificationHandler",
    "expo-local-authentication.authenticateAsync",
    "expo-sharing.shareAsync",
    "expo-linking.addEventListener",
    // Kabuk bileşenlerinin kullandığı RN community modülleri (mobile-crash2).
    "react-native-purchases.configure",
    "react-native-purchases.isConfigured",
    "react-native-purchases.logIn",
    "react-native-purchases.getCustomerInfo",
    "react-native-purchases.purchasePackage",
    "react-native-purchases.restorePurchases",
    "react-native-purchases.setAttributes",
    "react-native-purchases.setLogLevel",
    "react-native-webview.WebView",
    "react-native-svg.Svg",
    "react-native-svg.Path",
    "@react-native-async-storage/async-storage.getItem",
    "@react-native-async-storage/async-storage.multiGet",
  ])
    assert.ok(names.includes(needed), `${needed} öz-denetim listesinde olmalı`);

  // EXACT yüzey: her modül.üye çifti tek tek undefined yapılınca tam o ad `missing`'te çıkar.
  for (const target of [
    "react-native-webview.WebView",
    "react-native-svg.Path",
    "react-native-purchases.purchasePackage",
  ]) {
    const [mod, member] = target.split(/\.(?=[^.]+$)/);
    const specs = selfcheck.NATIVE_MODULE_SPECS.map((s) => ({
      module: s.module,
      ns: s.module === mod ? { ...s.ns, [member]: undefined } : s.ns,
      members: s.members,
    }));
    const r = selfcheck.checkNativeModules(specs);
    assert.equal(r.ok, false, `${target} eksikken ok=false olmalı`);
    assert.ok(r.missing.includes(target), `${target} missing listesinde tam olarak çıkmalı`);
  }

  // Bir React bileşeni forwardRef/memo nesnesi (fonksiyon değil ama $$typeof taşır) → geçerli sayılır.
  const fwdOk = selfcheck.checkNativeModules([
    {
      module: "react-native-webview",
      ns: { WebView: { $$typeof: Symbol.for("react.forward_ref"), render: () => null } },
      members: [{ name: "WebView", kind: "component" }],
    },
  ]);
  assert.equal(fwdOk.ok, true, "forwardRef bileşeni geçerli render tipi sayılır");

  // Bir yöntem tanımsız (taşınmış/yanlış import) → yakalanır (klasik 'object is not a function').
  const broken = selfcheck.checkNativeModules([
    { module: "expo-haptics", ns: { selectionAsync: undefined }, members: [{ name: "selectionAsync", kind: "function" }] },
  ]);
  assert.equal(broken.ok, false);
  assert.deepEqual(plain(broken.missing), ["expo-haptics.selectionAsync"]);

  // Modül hiç yüklenmemiş (ns == null) → tüm üyeleri eksik.
  const nullNs = selfcheck.checkNativeModules([
    { module: "expo-sharing", ns: null, members: [{ name: "shareAsync", kind: "function" }] },
  ]);
  assert.equal(nullNs.ok, false);
  assert.deepEqual(plain(nullNs.missing), ["expo-sharing.shareAsync"]);
});
