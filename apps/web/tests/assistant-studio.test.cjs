// Oturumlu asistan (FEAT-013, final review #2): Kartograf yüzeyi ve I11.
// (a) kaynakta Material Symbols, satır içi style, <style> ve emoji-ikon üretimi yok;
// (b) t("anahtar", "TR yedeği") çiftlerinin her anahtarı tr/en'de var ve TR değeri yedeğe eşit;
// (c) taslak paneli bölümleri ve karşılama gerçek bileşen markup'ıyla (react-dom/server) EN
//     sözlükle render edilir: eksik EN anahtarı yok, Icon (svg) ve tablist var, Türkçe yedek yok.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const esbuild = require("esbuild");
const { loadTs } = require("./helpers/load-ts.cjs");

const APP = path.join(__dirname, "..", "app");
const TA = path.join(APP, "travel-assistant");
const tr = require(path.join(APP, "locales/tr.json"));
const en = require(path.join(APP, "locales/en.json"));
const SOURCES = [
  "travel-assistant-client.tsx",
  "draft-sections.tsx",
  "mini-route-map.tsx",
  "studio-welcome.tsx",
  "smart-actions.tsx",
  "contextual-followups.tsx",
  "thinking-steps.tsx",
  "prep-panel.tsx",
  "travel-affiliate-cards.tsx",
  "loading.tsx",
];
const read = (f) => fs.readFileSync(path.join(TA, f), "utf8");

test("oturumlu asistan kaynakları: Material Symbols, satır içi style, <style> yok", () => {
  for (const f of SOURCES) {
    const src = read(f);
    assert.doesNotMatch(src, /material-symbols/, `${f}: Material Symbols`);
    assert.doesNotMatch(src, /\bstyle=\{\{/, `${f}: satır içi style`);
    assert.doesNotMatch(src, /<style[\s>]/, `${f}: <style>`);
    // İkon, etiket metninin bölünmesiyle üretilmez (eski "✈ Hazırlık".split(" ")).
    assert.doesNotMatch(src, /\)\.split\(" "\)/, `${f}: t(...).split(" ")`);
  }
});

const STR = String.raw`"((?:[^"\\]|\\.)*)"`;
const PAIR = new RegExp(String.raw`\bt\(\s*` + STR + String.raw`,\s*` + STR, "g");
const unescape = (s) => JSON.parse(`"${s}"`);

test("I11: t(anahtar, TR yedeği) çiftleri tr/en'de var, TR değeri yedeğe eşit", () => {
  const problems = [];
  let count = 0;
  for (const f of SOURCES) {
    for (const m of read(f).matchAll(PAIR)) {
      count++;
      const [key, fallback] = [m[1], unescape(m[2])];
      if (!(key in tr)) problems.push(`${f}: ${key} tr.json'da yok`);
      else if (tr[key] !== fallback) problems.push(`${f}: ${key} TR "${tr[key]}" ≠ "${fallback}"`);
      if (!(key in en)) problems.push(`${f}: ${key} en.json'da yok`);
    }
  }
  assert.ok(count > 150, `beklenenden az çeviri çağrısı (${count})`);
  assert.deepEqual(problems, []);
});

test("I11: karşılama/rota tarzı veri çiftleri (studio-starters.ts) tr/en'de var", () => {
  const S = loadTs(path.join(TA, "studio-starters.ts"));
  const texts = [];
  for (const d of S.POPULAR_DESTINATIONS) texts.push(d.city, d.country, d.prompt);
  for (const a of S.ACTIVITY_STARTERS) texts.push(a.label, a.desc, a.prompt);
  for (const g of S.KB_QUICK_GUIDES) texts.push(g.city, g.topic, g.prompt);
  for (const s of S.ROUTE_STYLES) texts.push(s.label, s.hint);
  const problems = [];
  for (const [key, fallback] of texts) {
    if (tr[key] !== fallback) problems.push(`${key}: TR "${tr[key]}" ≠ "${fallback}"`);
    if (!en[key]) problems.push(`${key} en.json'da yok`);
  }
  assert.deepEqual(problems, []);
  // Aya göre dönüş korunur (ay × 3 kaydırma) ve 6 rehber döner.
  assert.equal(S.getSeasonalGuides(6, 0)[0].id, "istanbul-districts");
  assert.equal(S.getSeasonalGuides(6, 1)[0].id, "tokyo-transit");
  assert.equal(S.getSeasonalGuides(6, 5).length, 6);
});

test("Hazırlık sekmesi etiketi gerçek metin (R3): ai.prepTab emoji taşımaz", () => {
  assert.equal(tr["ai.prepTab"], "Hazırlık");
  assert.equal(en["ai.prepTab"], "Trip prep");
  const client = read("travel-assistant-client.tsx");
  assert.match(client, /<Icon name="plane" size=\{16\} \/>\s*\{t\("ai\.prepTab", "Hazırlık"\)\}/);
  // I8: PrepPanel yalnız Hazırlık (flights) sekmesinin paneli ve rotasız şerit olarak.
  assert.equal((client.match(/<PrepPanel\b/g) || []).length, 2);
  // Taslak sekmeleri dar panelde sarar: Tavsiye (uyarı rozeti) ve Güvenlik kaydırmada gizlenmez.
  assert.match(client, /<Tabs\s+wrap\s+label=\{t\("studio\.draft\.tabs"/);
});

async function loadRender() {
  const stub = {
    name: "locale-stub",
    setup(build) {
      build.onResolve({ filter: /^react(\/.*)?$/ }, (args) => ({
        path: require.resolve(args.path, { paths: [path.join(APP, "..")] }),
      }));
      build.onResolve({ filter: /lib\/locale-context$/ }, () => ({
        path: "locale-stub",
        namespace: "stub",
      }));
      build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: `
          export const useLocale = () => ({
            locale: globalThis.__LOCALE__,
            isEnglish: globalThis.__LOCALE__ === "en",
            t: (k, f) => {
              const v = globalThis.__DICT__[k];
              if (v === undefined) globalThis.__MISSES__.push(k);
              return v ?? f ?? k;
            },
          });`,
        loader: "js",
      }));
    },
  };
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement as h } from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        import { DraftStops, DraftStay, DraftDiscovery, DraftAdvisory, DraftEmergency } from "./draft-sections";
        import { StudioWelcome } from "./studio-welcome";
        import { SmartActions } from "./smart-actions";
        import { ContextualFollowups } from "./contextual-followups";
        import { ThinkingSteps } from "./thinking-steps";
        import { TravelAffiliateCards, InlineAffiliateStrip } from "./travel-affiliate-cards";
        export function render(fx) {
          const noop = () => {};
          return renderToStaticMarkup(h("div", null,
            h(DraftStops, { route: fx.route, day: 1, onDay: noop }),
            h(DraftStay, { info: fx.stay, onAsk: noop, onAddPlace: noop }),
            h(DraftStay, { info: null, onAsk: noop, onAddPlace: noop }),
            h(DraftDiscovery, { info: fx.discovery, onAsk: noop, onAddPlace: noop }),
            h(DraftAdvisory, { info: fx.advisory }),
            h(DraftEmergency, { info: fx.emergency }),
            h(StudioWelcome, { busy: false, onPick: noop }),
            h(SmartActions, { messages: fx.messages, route: fx.route, currentTrip: null, onAction: noop, busy: false }),
            h(ContextualFollowups, { message: fx.messages[1], route: fx.route, onAction: noop, busy: false }),
            h(ThinkingSteps, { isRoute: true, livePhase: { index: 4 } }),
            h(TravelAffiliateCards, { route: fx.route }),
            h(InlineAffiliateStrip, { destination: "Roma", messageText: "Roma" }),
          ));
        }`,
      resolveDir: TA,
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    target: "node22",
    jsx: "automatic",
    loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
    plugins: [stub],
  });
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require,
    console,
    process,
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    MessageChannel,
    URL,
    URLSearchParams,
  };
  sandbox.globalThis = sandbox;
  vm.runInContext(result.outputFiles[0].text, vm.createContext(sandbox));
  return (locale, fx) => {
    sandbox.__LOCALE__ = locale;
    sandbox.__DICT__ = locale === "en" ? en : tr;
    sandbox.__MISSES__ = [];
    const html = module.exports.render(fx);
    return { html, misses: [...new Set(sandbox.__MISSES__)] };
  };
}

const FIXTURE = {
  route: {
    title: "Roma klasikleri",
    summary: "Özet",
    estimatedDays: 2,
    theme: "tarih",
    destination: "Roma",
    stops: [
      {
        id: "s1",
        name: "Kolezyum",
        lat: 41.89,
        lng: 12.49,
        day: 1,
        description: "Antik amfitiyatro",
        suggestedDuration: "2 saat",
        timeSlot: "morning",
        distanceToNextKm: 1.2,
        address: "Piazza del Colosseo",
      },
      {
        id: "s2",
        name: "Pantheon",
        lat: 41.9,
        lng: 12.48,
        day: 2,
        description: "Tapınak",
        suggestedDuration: "1 saat",
      },
    ],
  },
  stay: {
    recommendedAreas: ["Monti"],
    stays: [
      {
        name: "Otel A",
        priceLevel: "€€",
        type: "butik",
        area: "Monti",
        description: "d",
        pros: ["merkezi"],
      },
    ],
    transitTips: [{ title: "Metro", description: "B hattı", estimatedCost: "€1.50" }],
    cityCardRecommendation: "Roma Pass",
  },
  discovery: {
    specialties: ["Carbonara"],
    gems: [{ name: "Gizli bahçe", category: "park", description: "d", highlight: "sessiz" }],
    cultureTips: ["Öğle arası"],
  },
  advisory: {
    country: "İtalya",
    countrySlug: "italy",
    level: "some_risk",
    levelLabel: "Bazı riskler",
    summary: "Özet",
    lastChecked: "2026-11-01T10:00:00.000Z",
    changeNote: "Not",
    sourceUrl: "https://www.gov.uk/foreign-travel-advice/italy",
    disclaimer: "Uyarı metni",
  },
  emergency: {
    destinationCountry: "İtalya",
    turkishEmbassyConsulate: {
      title: "T.C. Roma Büyükelçiliği",
      address: "Via Palestro 28",
      phone: "+39 06 445941",
      emergencyHotline: "+39 335 000000",
      workingHours: "09:00–17:00",
    },
    localEmergencyNumbers: {
      police: "113",
      ambulance: "118",
      fire: "115",
      generalEmergency: "112",
    },
    safetyAndPassportTips: ["Pasaport fotokopisi taşı"],
  },
  messages: [
    { id: "u1", role: "user", text: "Roma" },
    { id: "a1", role: "assistant", text: "Rota hazır", route: null },
  ],
};
FIXTURE.messages[1].route = FIXTURE.route;

test("taslak bölümleri + karşılama EN sözlükle render edilir: eksik anahtar ve Türkçe yedek yok", async () => {
  const render = await loadRender();
  const enOut = render("en", FIXTURE);
  assert.deepEqual(enOut.misses, [], `EN'de eksik anahtar: ${enOut.misses.join(", ")}`);
  for (const s of ["Day 1", "Suggested visit: 2 saat", "Save this hotel to my route", "Police"])
    assert.ok(enOut.html.includes(s), `EN çıktısında "${s}" yok`);
  // Hazırlık sekmesi affiliate yüzeyi (rotalı kartlar + rotasız şerit) de EN'dir (I11).
  for (const s of ["Travel deals for Roma", "See flight prices", "Travel insurance", "For Roma:"])
    assert.ok(enOut.html.includes(s), `EN çıktısında "${s}" yok`);
  for (const s of ["seyahat fırsatları", "Fiyatlarını Gör", "Uçuş Ara", "Otel Bul", "ortaklık"])
    assert.ok(!enOut.html.includes(s), `EN çıktısında Türkçe "${s}" var (I11)`);
  for (const s of ["Önerilen ziyaret", "Bu oteli rotama kaydet", "Polis", "Sohbette sor"])
    assert.ok(!enOut.html.includes(s), `EN çıktısında Türkçe "${s}" var (I11)`);
  const trOut = render("tr", FIXTURE);
  assert.deepEqual(trOut.misses, []);
  assert.ok(trOut.html.includes("1. Gün") && trOut.html.includes("Önerilen ziyaret: 2 saat"));
  for (const { html } of [enOut, trOut]) {
    assert.match(html, /role="tablist"/);
    assert.match(html, /<svg class="ui-icon/);
    assert.doesNotMatch(html, /material-symbols/);
    assert.doesNotMatch(html, /\p{Extended_Pictographic}/u, "markup'ta emoji");
    // Koyu zeminli durak numarası data-surface="inverse" taşır (G18).
    assert.match(html, /class="as-studio-stop__num" data-surface="inverse"/);
  }
});

// Increment 1.10 (bug 6): buffered /ai/chat 12 sn varsayılanıyla kesiliyordu.
test("AI_CHAT_TIMEOUT_MS ≥ 35000 ve iki buffered /ai/chat çağrısı sabiti kullanır", () => {
  const chat = fs.readFileSync(path.join(APP, "lib/ai/chat.ts"), "utf8");
  const m = chat.match(/export const AI_CHAT_TIMEOUT_MS = (\d+);/);
  assert.ok(m, "AI_CHAT_TIMEOUT_MS yok");
  assert.ok(Number(m[1]) >= 35000);
  const client = fs.readFileSync(path.join(TA, "travel-assistant-client.tsx"), "utf8");
  const calls = [...client.matchAll(/apiFetch\("\/ai\/chat", \{([^}]*)\}/g)].map((x) => x[1]);
  assert.equal(calls.length, 2, "iki buffered çağrı");
  for (const body of calls) assert.match(body, /timeoutMs: AI_CHAT_TIMEOUT_MS/);
});

test("düşünme aşamaları gerçek boru hattı adımları; yapılmayan iş iddiası ve süre metni yok", () => {
  const src = fs.readFileSync(path.join(TA, "thinking-steps.tsx"), "utf8");
  for (const key of ["intent", "research", "cluster", "route", "finalize"])
    assert.ok(src.includes(`studio.think.${key}"`), key);
  assert.doesNotMatch(src, /QUICK_FACTS|Travelpayouts|FCDO|AgentCore Gateway|Uçuş fiyat/);
  assert.doesNotMatch(src, /\d+\s*(sn|saniye|dk|seconds?)\b/i, "süre metni uydurulmaz");
});

// ── FEAT-004 B4: dar rota sütunu, daraltılabilir geçmiş, mini harita, asistan içi optimize ──

test("FEAT-004: yeni i18n anahtarları tr/en'de var ve TR değeri koddaki yedeğe eşit", () => {
  const keys = {
    "studio.sessions.collapse": "Sohbet geçmişini gizle",
    "studio.sessions.expand": "Sohbet geçmişini göster",
    "studio.map.caption": "{title} · {days} gün · {stops} durak",
    "studio.optimize": "Rotayı optimize et",
    "studio.optimize.done": "Durak sırası güncellendi: yaklaşık {km} km daha kısa.",
    "studio.optimize.none": "Rota sırası zaten en kısa sıraya yakın.",
  };
  for (const [key, trVal] of Object.entries(keys)) {
    assert.equal(tr[key], trVal, `${key} TR değeri`);
    assert.ok(key in en, `${key} en.json'da yok`);
  }
});

test("FEAT-004: sohbet geçmişi daraltma — daraltılınca yalnız + (ve aç) düğmesi, açılınca liste", () => {
  const client = read("travel-assistant-client.tsx");
  // Daraltma durumu + cihaza özel kalıcılık.
  assert.match(client, /const \[sessionsCollapsed, setSessionsCollapsed\] = useState/);
  assert.match(client, /SESSIONS_COLLAPSED_KEY/);
  // Daraltılmış dalda yalnız IconButton'lar (yeni + aç); "Yeni seyahat planla" metin düğmesi YOK.
  const collapsed = client.slice(
    client.indexOf("data-collapsed={sessionsCollapsed"),
    client.indexOf('<div className="as-studio__sessions-head">'),
  );
  assert.match(collapsed, /sessionsCollapsed \?/);
  assert.match(collapsed, /icon="plus"/);
  assert.match(collapsed, /setSessionsCollapsed\(false\)/);
  assert.match(collapsed, /icon="menu"/);
  // Açık dal: tam "Yeni seyahat planla" düğmesi + geçmiş listesi + daralt düğmesi.
  assert.match(client, /\{t\("studio\.new", "Yeni seyahat planla"\)\}/);
  assert.match(client, /setSessionsCollapsed\(true\)/);
  assert.match(client, /className="as-studio-history"/);
});

test("FEAT-004: mini harita ve asistan içi optimize kontrolü client'ta bağlı", () => {
  const client = read("travel-assistant-client.tsx");
  assert.match(client, /import \{ MiniRouteMap \} from "\.\/mini-route-map"/);
  assert.match(client, /import \{ optimizeAssistantRoute \} from "\.\/route-optimize"/);
  assert.match(client, /<MiniRouteMap route=\{route\} \/>/);
  // Optimize butonu + kredi/sunucu YOK (S19/I2): ne reserveAI ne apiFetch optimize akışında.
  assert.match(client, /\{t\("studio\.optimize", "Rotayı optimize et"\)\}/);
  const fn = client.slice(client.indexOf("function optimizeRoute()"));
  const body = fn.slice(0, fn.indexOf("\n  function download"));
  assert.match(body, /optimizeAssistantRoute\(route\)/);
  assert.doesNotMatch(body, /apiFetch|reserveAI|credit|kredi/i);
});

test("FEAT-004: mini-route-map koyu zeminli başlık data-surface=inverse ve Leaflet/ağ yok (I1/I12)", () => {
  const src = read("mini-route-map.tsx");
  assert.match(src, /data-surface="inverse"/);
  // Yorumları çıkarıp yalnız kodda Leaflet/ağ/dinamik import olmadığını doğrula.
  const code = src.replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(code, /leaflet|apiFetch|\bfetch\(|import\(/i);
  // Koordinat türetimi saf deriver'a devredilir (uydurma yok).
  assert.match(src, /routeMiniMap\(route\)/);
  assert.match(src, /if \(!model\) return null/);
});

test("FEAT-004: DraftStops günleri sekmelere böler (FIXTURE'da gün 1 ve gün 2)", async () => {
  const render = await loadRender();
  const trOut = render("tr", FIXTURE);
  // İki gün sekmesi (tablist) ve seçili gün içeriği.
  assert.match(trOut.html, /role="tablist"/);
  assert.ok(trOut.html.includes("1. Gün") && trOut.html.includes("2. Gün"), "gün sekmeleri yok");
});

test("FEAT-004: asistan içi optimize bilinen kötü sırayı düzeltir; optimalde no-op (I2)", () => {
  const mod = loadTs(path.join(TA, "route-optimize.ts"));
  const stop = (id, lat, lng, day) => ({
    id,
    name: id,
    lat,
    lng,
    day,
    description: "",
    suggestedDuration: "1 saat",
  });
  const plan = (stops) => ({
    title: "T",
    summary: "",
    estimatedDays: 1,
    theme: "x",
    destination: "D",
    stops,
  });
  // Bilinen kötü sıra: A(0,0) → C(0,2) → B(0,1) → D(0,3). En kısa: A,B,C,D.
  const bad = plan([
    stop("A", 0, 0, 1),
    stop("C", 0, 2, 1),
    stop("B", 0, 1, 1),
    stop("D", 0, 3, 1),
  ]);
  const res = mod.optimizeAssistantRoute(bad);
  assert.ok(res, "iyileşme bulunmalı");
  assert.ok(res.savedDistanceKm > 0, "tasarruf > 0");
  // vm bağlamından dönen dizi prototipi farklı; sıralamayı string olarak karşılaştır.
  assert.equal(res.route.stops.map((s) => s.id).join(","), "A,B,C,D");
  // Zaten optimal sıra → null (no-op).
  const good = plan([
    stop("A", 0, 0, 1),
    stop("B", 0, 1, 1),
    stop("C", 0, 2, 1),
    stop("D", 0, 3, 1),
  ]);
  assert.equal(mod.optimizeAssistantRoute(good), null);
});

test("openMap: girişli kullanıcıda rota sunucuya yazılır (routesApi.create) ve dönen kimlikle açılır", () => {
  const client = fs.readFileSync(path.join(TA, "travel-assistant-client.tsx"), "utf8");
  const fn = client.slice(client.indexOf("async function openMap()"));
  const body = fn.slice(0, fn.indexOf("\n  function dictate"));
  assert.match(body, /routesApi\.create\(/);
  assert.match(body, /\/maps\/\?tripId=\$\{encodeURIComponent\(res\.routeId\)\}/);
  assert.match(body, /`ai-\$\{activeId\}`/, "hata/misafir yolunda yerel ai- yazımı kalır");
});
