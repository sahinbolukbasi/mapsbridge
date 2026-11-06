// Primitive saf mantığı (design §3, §8.5, D17; AC-7): tabs reducer, focus-trap sırası,
// HTTP hata eşleyici (+ api-client.ts önek kontrolü), breadcrumb, url-state, resolvePageTitle.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const LOGIC = path.resolve(__dirname, "../app/components/ui/logic");
// Error test realm'inden gelir (instanceof); vm nesneleri düz nesneye çevrilip karşılaştırılır.
const load = (name) => loadTs(path.join(LOGIC, `${name}.ts`), { globals: { Error } });
const plain = (v) => JSON.parse(JSON.stringify(v));

const { nextTabIndex, firstEnabledIndex } = load("tabs-keyboard");
const { nextFocusIndex, shouldWrap, FOCUSABLE_SELECTOR } = load("focus-trap");
const { toUiError, APIFETCH_MESSAGES } = load("http-error");
const { normalizeBreadcrumb } = load("breadcrumb");
const { parseParam, buildSearch } = load("url-state");
const { resolvePageTitle } = load("page-title");
const { nextSnap, snapFromDrag, orderedSnaps, SHEET_DRAG_THRESHOLD } = load("sheet-snap");
const { chipLocked, toggleChoice, clampStep } = load("choice");

test("tabs: ok tuşları sarar, disabled atlanır, Home/End ilk/son etkin", () => {
  const d = [false, true, false, false];
  assert.equal(nextTabIndex(0, "ArrowRight", d), 2);
  assert.equal(nextTabIndex(3, "ArrowRight", d), 0);
  assert.equal(nextTabIndex(0, "ArrowLeft", d), 3);
  assert.equal(nextTabIndex(2, "ArrowLeft", d), 0);
  assert.equal(nextTabIndex(2, "Home", [true, false, false]), 1);
  assert.equal(nextTabIndex(0, "End", [false, false, true]), 1);
  assert.equal(nextTabIndex(0, "Enter", d), null);
  assert.equal(nextTabIndex(0, "ArrowDown", d), null, "yatayda dikey ok işlenmez");
  assert.equal(nextTabIndex(0, "ArrowDown", d, "vertical"), 2);
  assert.equal(nextTabIndex(0, "ArrowRight", [true, true]), null, "hepsi disabled");
  assert.equal(firstEnabledIndex([true, false]), 1);
});

test("sheet-snap: Enter/Space döngüsü, ↑/↓ sınırda kalır, sıra peek→half→full", () => {
  const all = ["full", "peek", "half"];
  assert.deepEqual(plain(orderedSnaps(all)), ["peek", "half", "full"]);
  assert.equal(nextSnap("peek", "Enter", all), "half");
  assert.equal(nextSnap("half", " ", all), "full");
  assert.equal(nextSnap("full", "Enter", all), "peek", "sondan başa sarar");
  assert.equal(nextSnap("half", "ArrowUp", all), "full");
  assert.equal(nextSnap("full", "ArrowUp", all), "full", "üst sınırda kalır");
  assert.equal(nextSnap("half", "ArrowDown", all), "peek");
  assert.equal(nextSnap("peek", "ArrowDown", all), "peek", "alt sınırda kalır");
  assert.equal(nextSnap("peek", "Tab", all), null, "desen dışı tuş");
  assert.equal(nextSnap("peek", "Enter", ["peek", "full"]), "full", "yalnız verilen snap'ler");
  assert.equal(nextSnap("half", "ArrowUp", ["peek", "full"]), "peek", "listede yoksa ilk snap");
  assert.equal(nextSnap("peek", "Enter", []), null);
});

test("sheet-snap: sürükleme eşiği ve yönü", () => {
  const all = ["peek", "half", "full"];
  const t = SHEET_DRAG_THRESHOLD;
  assert.equal(snapFromDrag(-(t - 1), "peek", all), "peek", "eşik altı yerinde kalır");
  assert.equal(snapFromDrag(-t, "peek", all), "half", "yukarı (dy<0) bir adım büyür");
  assert.equal(snapFromDrag(t, "half", all), "peek", "aşağı bir adım küçülür");
  assert.equal(snapFromDrag(-500, "full", all), "full", "üst sınır");
  assert.equal(snapFromDrag(500, "peek", all), "peek", "alt sınır");
  assert.equal(snapFromDrag(Number.NaN, "half", all), "half");
  assert.equal(snapFromDrag(-20, "peek", all, 10), "half", "özel eşik");
});

test("ChipGroup max ve Stepper sıkıştırma yardımcıları", () => {
  assert.equal(chipLocked(false, 4, "multi", 4), true, "max dolunca seçili olmayan kilitli");
  assert.equal(chipLocked(true, 4, "multi", 4), false, "seçili olan bırakılabilir");
  assert.equal(chipLocked(false, 3, "multi", 4), false);
  assert.equal(chipLocked(false, 9, "multi"), false, "max yoksa sınır yok");
  assert.equal(chipLocked(false, 1, "single", 1), false, "single değiştirilir, kilitlenmez");
  assert.deepEqual(plain(toggleChoice(["a", "b"], "c", "multi", 2)), ["a", "b"], "max aşılmaz");
  assert.deepEqual(plain(toggleChoice(["a"], "b", "multi", 2)), ["a", "b"]);
  assert.deepEqual(plain(toggleChoice(["a", "b"], "a", "multi", 2)), ["b"], "seçili çıkar");
  assert.deepEqual(plain(toggleChoice(["a"], "b", "single")), ["b"], "single tek değer");
  assert.deepEqual(plain(toggleChoice(["a"], "a", "single")), [], "single seçimi kaldırılabilir");
  assert.equal(clampStep(3, 1, 1, 14), 4);
  assert.equal(clampStep(14, 1, 1, 14), 14, "üst sınır");
  assert.equal(clampStep(1, -1, 1, 14), 1, "alt sınır");
  assert.equal(clampStep(20, -1, 1, 14), 14, "aralık dışı değer sıkıştırılır");
  assert.equal(clampStep(Number.NaN, 1, 1, 14), 2, "geçersiz değer min'den başlar");
  assert.equal(clampStep(5, 1, 7, 2), 6, "ters verilen min/max normalize");
});

test("focus-trap: Tab/Shift+Tab döngüsü ve sınırda araya girme", () => {
  assert.equal(nextFocusIndex(3, 2, false), 0);
  assert.equal(nextFocusIndex(3, 0, true), 2);
  assert.equal(nextFocusIndex(3, 1, false), 2);
  assert.equal(nextFocusIndex(3, -1, false), 0, "liste dışından ilk");
  assert.equal(nextFocusIndex(3, -1, true), 2, "liste dışından son");
  assert.equal(nextFocusIndex(0, -1, false), -1, "boş liste");
  assert.equal(shouldWrap(3, 1, false), false);
  assert.equal(shouldWrap(3, 2, false), true);
  assert.equal(shouldWrap(3, 0, true), true);
  assert.match(FOCUSABLE_SELECTOR, /button:not\(\[disabled\]\)/);
});

test("http-error: apiFetch Error önekleri api-client.ts'te hâlâ var (NFR-6, sessiz bozulma yok)", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../app/lib/api-client.ts"), "utf8");
  for (const [kind, prefix] of Object.entries(APIFETCH_MESSAGES)) {
    const re = new RegExp(`throw new Error\\("${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
    assert.match(src, re, `${kind} öneki api-client.ts'te yok: ${prefix}`);
  }
});

test("http-error: tablo (design §8.5)", () => {
  const net = toUiError(new Error("Sunucuya erişilemedi. Çevrimdışı modda çalışılıyor."));
  assert.deepEqual([net.kind, net.title, net.retryable], ["network", "Bağlantı kurulamadı", true]);

  const tGet = toUiError(new Error("İstek zaman aşımına uğradı. Lütfen…"), { method: "GET" });
  const tPost = toUiError(new Error("İstek zaman aşımına uğradı. Lütfen…"), { method: "POST" });
  assert.equal(tGet.retryable, true);
  assert.deepEqual([tPost.retryable, tPost.action], [false, "refresh"]);

  const uPost = toUiError(new Error("Sunucu yanıtı alınamadı. …"), { method: "POST" });
  const uGet = toUiError(new Error("Sunucu yanıtı alınamadı. …"), { method: "GET" });
  assert.deepEqual(
    [uPost.kind, uPost.title, uPost.retryable],
    ["uncertain", "İşlemin sonucu doğrulanamadı", false],
  );
  assert.deepEqual([uGet.kind, uGet.retryable], ["network", true]);

  const unk = toUiError(new Error("başka"), { method: "POST" });
  assert.deepEqual(
    [unk.kind, unk.title, unk.retryable, unk.action],
    ["unknown", "Beklenmeyen hata", false, "refresh"],
  );
  assert.equal(toUiError(undefined).kind, "unknown");
  assert.equal(toUiError("x").retryable, true);

  const api = (status, message = `İşlem başarısız oldu (${status})`) => ({ status, message });
  assert.equal(toUiError(api(400, "E-posta geçersiz.")).message, "E-posta geçersiz.");
  assert.deepEqual([toUiError(api(401)).action, toUiError(api(401)).retryable], ["login", false]);
  assert.equal(toUiError(api(403)).message, "Bu bölüm için yetkiniz bulunmuyor.");
  assert.equal(toUiError(api(403, "Sadece süper yönetici.")).message, "Sadece süper yönetici.");
  assert.equal(toUiError(api(404)).kind, "not-deployed", "sunucu mesajsız 404 = uç nokta yok");
  assert.equal(toUiError(api(404, "Kullanıcı bulunamadı.")).kind, "not-found");
  assert.match(toUiError(api(409, "Sürüm değişti.")).message, /^Sürüm değişti\. Listeyi yenileyip/);
  assert.equal(toUiError(api(429)).title, "Çok fazla istek");
  assert.deepEqual(
    [toUiError(api(500), { method: "GET" }).kind, toUiError(api(500), { method: "GET" }).retryable],
    ["server", true],
  );
  const p500 = toUiError(api(500), { method: "POST" });
  assert.deepEqual(
    [p500.title, p500.retryable, p500.action],
    ["İşlemin sonucu doğrulanamadı", false, "refresh"],
  );
  assert.equal(
    toUiError(api(503, "Ödeme sağlayıcısı bağlı değil.")).message,
    "Ödeme sağlayıcısı bağlı değil.",
  );
  assert.equal(toUiError(api(504)).message, "Hizmet şu anda yanıt vermiyor (504).");
});
test("http-error: 403/402 koda göre ayrışır (e-posta/cüzdan/plan/kredi)", () => {
  const api = (status, message, code, upgradeUrl) => ({ status, message, code, upgradeUrl });
  // E-posta doğrulanmamış: kod ile
  const emailByCode = toUiError(
    api(403, "AI kullanmadan önce e-postanızı doğrulayın.", "EMAIL_UNVERIFIED"),
  );
  assert.deepEqual(
    [emailByCode.kind, emailByCode.action, emailByCode.actionUrl],
    ["email-unverified", "verify-email", "/profile/edit/"],
  );
  // E-posta doğrulanmamış: kod yoksa mesaj örüntüsünden
  const emailByMsg = toUiError(api(403, "AI kullanmadan önce e-postanızı doğrulayın."));
  assert.deepEqual([emailByMsg.kind, emailByMsg.action], ["email-unverified", "verify-email"]);
  // Cüzdan donduruldu: desteğe yönlendir, upgrade DEĞİL
  const frozen = toUiError(api(403, "Kredi hesabı geçici olarak durduruldu.", "WALLET_FROZEN"));
  assert.deepEqual([frozen.kind, frozen.action], ["wallet-frozen", "refresh"]);
  // Plan limiti: upgradeUrl sunucudan gelir
  const limit = toUiError(
    api(403, "Ücretsiz planda en fazla 3 rota.", "ROUTE_LIMIT_REACHED", "/odeme/?tab=plans"),
  );
  assert.deepEqual(
    [limit.kind, limit.action, limit.actionUrl],
    ["plan-limit", "upgrade", "/odeme/?tab=plans"],
  );
  // Düz 403 (kod/upgradeUrl yok): eski davranış korunur (regresyon kalkanı)
  const plain403 = toUiError(api(403, "İşlem başarısız oldu (403)"));
  assert.deepEqual(
    [plain403.kind, plain403.action, plain403.message],
    ["forbidden", undefined, "Bu bölüm için yetkiniz bulunmuyor."],
  );
  // 402 kredi yetersiz: upgrade aksiyonu + varsayılan plan URL'i
  const credit = toUiError(api(402, "İşlem başarısız oldu (402)"));
  assert.deepEqual(
    [credit.kind, credit.action, credit.actionUrl],
    ["insufficient-credit", "upgrade", "/checkout/?tab=plans"],
  );
});

test("breadcrumb: son öğe mevcut sayfa ve link değil; boş etiketler atılır", () => {
  const v = normalizeBreadcrumb([
    { label: "Ana sayfa", href: "/" },
    { label: "  " },
    { label: "Topluluk", href: "/community/" },
  ]);
  assert.deepEqual(plain(v), [
    { label: "Ana sayfa", href: "/", current: false },
    { label: "Topluluk", current: true },
  ]);
  assert.deepEqual(plain(normalizeBreadcrumb([])), []);
});

test("url-state: parseParam bilinmeyeni fallback'e düşürür; buildSearch diğerlerini korur", () => {
  const allowed = ["drafts", "stays", "prep"];
  assert.equal(parseParam("?tab=stays&x=1", "tab", allowed, "drafts"), "stays");
  assert.equal(parseParam("?tab=evil", "tab", allowed, "drafts"), "drafts");
  assert.equal(parseParam("", "tab", allowed, "drafts"), "drafts");
  assert.equal(buildSearch("?x=1", "tab", "prep", "drafts"), "?x=1&tab=prep");
  assert.equal(buildSearch("?x=1&tab=prep", "tab", "drafts", "drafts"), "?x=1");
  assert.equal(buildSearch("?tab=prep", "tab", "drafts", "drafts"), "");
});

test("resolvePageTitle: altı durum (R5-7 / R6-4)", () => {
  const entry = { title: { tr: "Topluluk", en: "Community" } };
  const node = { type: "span", props: {} }; // ReactNode yerine geçen düz nesne
  const r = (input, pathname) => plain(resolvePageTitle(input, pathname));
  // (i) string title
  assert.deepEqual(r({ title: "Destek", locale: "tr" }), { heading: "Destek", text: "Destek" });
  // (ii) string title + titleText
  assert.deepEqual(r({ title: "Destek!", titleText: "Destek", locale: "tr" }), {
    heading: "Destek!",
    text: "Destek",
  });
  // (iii) ReactNode title + entry
  assert.deepEqual(r({ title: node, entry, locale: "en" }), { heading: node, text: "Community" });
  // (iv) yalnız titleText
  assert.deepEqual(r({ titleText: "Sayfa bulunamadı", locale: "tr" }), {
    heading: "Sayfa bulunamadı",
    text: "Sayfa bulunamadı",
  });
  // (v) yalnız entry → registry tr/en
  assert.deepEqual(r({ entry, locale: "tr" }), { heading: "Topluluk", text: "Topluluk" });
  assert.deepEqual(r({ entry, locale: "en" }), { heading: "Community", text: "Community" });
  // (vi) ReactNode tek başına ya da hiçbir kaynak yok → hata
  assert.ok("error" in r({ title: node, locale: "tr" }, "/x/"));
  assert.match(r({ locale: "tr" }, "/y/").error, /PageHeader: title\/titleText verin .*\(\/y\/\)/);
});

// AC-37 / I8 (design §9.1): affiliate yüzeylerinin tek bağlama kuralı ve tek render yeri.
const TA = path.resolve(__dirname, "../app/travel-assistant");
const { pickPrepContext } = loadTs(path.join(TA, "prep-context.ts"));
test("pickPrepContext: route / strip / none durumları (AC-37)", () => {
  const ext = (text) => (/Roma/.test(text) ? "Roma" : /Paris/.test(text) ? "Paris" : null);
  const route = { title: "R" };
  const a = (text, extra = {}) => ({ role: "assistant", text, ...extra });
  const u = (text) => ({ role: "user", text });
  const pick = (o) => plain(pickPrepContext({ extractDestination: ext, ...o }));
  // rota var → route (fiyat bayrağından bağımsız)
  assert.deepEqual(pick({ route, messages: [], surfacePricing: false }), { kind: "route", route });
  // rota yok + fiyat kapalı → none
  assert.deepEqual(pick({ route: null, messages: [a("Roma")], surfacePricing: false }), {
    kind: "none",
  });
  // son rotasız asistan mesajında hedef var → strip (doğru metin)
  assert.deepEqual(
    pick({
      route: null,
      messages: [a("Paris gezisi"), u("x"), a("Roma'ya gidelim")],
      surfacePricing: true,
    }),
    { kind: "strip", destination: "Roma", messageText: "Roma'ya gidelim" },
  );
  // son rotasız mesajda hedef yok, bir öncekinde var → önceki mesaj
  assert.deepEqual(
    pick({ route: null, messages: [a("Paris gezisi"), a("Tarih?")], surfacePricing: true }),
    { kind: "strip", destination: "Paris", messageText: "Paris gezisi" },
  );
  // hiç hedef yok → none
  assert.deepEqual(
    pick({ route: null, messages: [a("Merhaba"), u("Roma")], surfacePricing: true }),
    {
      kind: "none",
    },
  );
  // rotalı mesajlar taramada atlanır
  assert.deepEqual(
    pick({
      route: null,
      messages: [a("Paris gezisi"), a("Roma rotası", { route: { title: "x" } })],
      surfacePricing: true,
    }),
    { kind: "strip", destination: "Paris", messageText: "Paris gezisi" },
  );
});
test("I8: <TravelAffiliateCards / <InlineAffiliateStrip JSX'i yalnız travel-assistant/prep-panel.tsx'te", () => {
  const APP = path.resolve(__dirname, "../app");
  const hits = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".tsx")) {
        const src = fs.readFileSync(p, "utf8");
        if (/<(TravelAffiliateCards|InlineAffiliateStrip)\b/.test(src))
          hits.push(path.relative(APP, p));
      }
    }
  };
  walk(APP);
  assert.deepEqual(hits, [path.join("travel-assistant", "prep-panel.tsx")]);
  assert.ok(
    !fs.existsSync(path.join(APP, "ai/prep-context.ts")),
    "app/ai/ altında prep-context.ts olmamalı",
  );
  assert.ok(
    !fs.existsSync(path.join(APP, "ai/prep-panel.tsx")),
    "app/ai/ altında prep-panel.tsx olmamalı",
  );
  const aiPage = fs.readFileSync(path.join(APP, "ai/page.tsx"), "utf8");
  assert.doesNotMatch(aiPage, /TravelAffiliateCards|InlineAffiliateStrip/);
  const tr = require("../app/locales/tr.json");
  const en = require("../app/locales/en.json");
  for (const k of ["ai.prepTab", "ai.prepAffiliateTitle", "ai.prepLink"]) {
    assert.ok(tr[k] && en[k], `${k} TR/EN'de olmalı`);
  }
  // FEAT-013 (R3/G28): sekme ikonu Icon primitive'inden gelir; etiket emoji taşımaz.
  assert.equal(tr["ai.prepTab"], "Hazırlık");
  assert.equal(en["ai.prepTab"], "Trip prep");
});
test("modalPresentation (R10): sheet yalnız <768, ≥768 ve diğer boyutlar ortalı dialog", () => {
  const { modalPresentation, animatesClose, MOBILE_SHEET_QUERY } = load("modal-presentation");
  assert.equal(modalPresentation("sheet", true), "sheet");
  assert.equal(modalPresentation("sheet", false), "dialog");
  for (const size of ["sm", "md", "lg"]) {
    assert.equal(modalPresentation(size, true), "dialog");
    assert.equal(modalPresentation(size, false), "dialog");
  }
  assert.equal(MOBILE_SHEET_QUERY, "(max-width: 767.98px)");
  assert.equal(animatesClose(false), true, "hareket serbestken kapanış animasyonu beklenir");
  assert.equal(animatesClose(true), false, "azaltmada anında kapanır");
  const css = fs.readFileSync(path.resolve(__dirname, "../app/components/ui/ui.css"), "utf8");
  assert.match(css, /@keyframes ui-dialog-in\s*\{\s*from\s*\{[^}]*scale\(0\.96\)/);
  assert.match(
    css,
    /\.ui-modal\[open\]\s*\{\s*animation:\s*ui-dialog-in var\(--duration-slow\) var\(--easing-enter\)/,
  );
  assert.match(
    css,
    /\.ui-modal\.ui-modal--closing\s*\{\s*animation:\s*ui-dialog-out var\(--duration-base\) var\(--easing-exit\)/,
  );
});
test("toast-timing: hata ve eylemli süresiz, diğerleri 6 sn; duraklat/sürdür kalan süreyi korur", () => {
  const t = load("toast-timing");
  assert.equal(t.toastDuration({ tone: "danger", hasAction: false }), null);
  assert.equal(t.toastDuration({ tone: "success", hasAction: true, durationMs: 3000 }), null);
  assert.equal(t.toastDuration({ tone: "info", hasAction: false }), t.DEFAULT_TOAST_MS);
  assert.equal(t.toastDuration({ tone: "success", hasAction: false, durationMs: 3000 }), 3000);
  assert.equal(t.toastDuration({ tone: "warning", hasAction: false, durationMs: -1 }), 6000);
  let timer = t.startTimer(6000, 1000);
  timer = t.pauseTimer(timer, 3000);
  assert.deepEqual(plain(timer), { remaining: 4000, startedAt: null });
  assert.deepEqual(plain(t.pauseTimer(timer, 9000)), plain(timer), "ikinci duraklatma değiştirmez");
  assert.equal(t.timerProgress(timer, 6000, 99999), 4000 / 6000, "duraklatılmışken çubuk durur");
  timer = t.resumeTimer(timer, 10000);
  assert.deepEqual(plain(timer), { remaining: 4000, startedAt: 10000 });
  assert.equal(t.timerProgress(timer, 6000, 12000), 2000 / 6000);
  assert.equal(t.timerProgress(timer, 6000, 20000), 0);
});
test("Toast görünümü: ton şeridi + ikon, hata role=alert, süre çubuğu yalnız no-preference", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../app/components/ui/toast.tsx"), "utf8");
  assert.match(src, /role="alert" aria-live="assertive"/);
  assert.match(src, /toastDuration\(/);
  const css = fs.readFileSync(path.resolve(__dirname, "../app/components/ui/ui.css"), "utf8");
  assert.match(css, /\.ui-toast__timer \{\s*display: none;/);
  const motion = css.slice(css.indexOf("Toast: alttan 8 px"));
  assert.match(motion, /ui-toast-timer var\(--toast-duration\) var\(--easing-linear\)/);
  assert.match(css, /\.ui-toast--danger \{\s*--toast-accent: var\(--color-danger\)/);
});
test("progress: değer sınırlama, adım durumu ve duyuru metni", () => {
  const p = load("progress");
  assert.equal(p.clampProgress(50), 50);
  assert.equal(p.clampProgress(3, 4), 75);
  assert.equal(p.clampProgress(-5), 0);
  assert.equal(p.clampProgress(250), 100);
  assert.equal(p.clampProgress(Number.NaN), 0);
  assert.equal(p.clampProgress(1, 0), 0);
  assert.equal(p.clampProgress(1, 3), 33.3);
  assert.deepEqual(
    [0, 1, 2].map((i) => p.stepState(i, 1)),
    ["done", "active", "pending"],
  );
  assert.deepEqual(
    [0, 1].map((i) => p.stepState(i, 5)),
    ["done", "done"],
  );
  assert.equal(
    p.stepAnnouncement("Adım {n}/{total}: {label}", 1, ["Niyet", "Aday havuzu", "Kümeleme"]),
    "Adım 2/3: Aday havuzu",
  );
  assert.equal(p.stepAnnouncement("x", 0, []), "");
});
test("Celebrate/Skeleton/Progress: süre tavanı ve hareket yalnız no-preference (R14/R15)", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../app/components/ui/ui.css"), "utf8");
  const m = css.match(/ui-confetti calc\(var\(--duration-route\) \* ([\d.]+)\)/);
  assert.ok(m && Number(m[1]) <= 1.2, "konfeti ≤ route × 1.2");
  assert.match(css, /\.ui-celebrate__confetti \{\s*display: none;/, "azaltmada konfeti yok");
  assert.match(css, /ui-shimmer calc\(var\(--duration-route\) \* 1\.6\)/);
  const src = fs.readFileSync(
    path.resolve(__dirname, "../app/components/ui/celebrate.tsx"),
    "utf8",
  );
  assert.match(src, /role="status"/);
  assert.match(src, /CELEBRATE_BITS = 18/);
  const prog = fs.readFileSync(
    path.resolve(__dirname, "../app/components/ui/progress.tsx"),
    "utf8",
  );
  assert.match(prog, /role="progressbar"/);
  assert.match(prog, /aria-live="polite"/);
});
test("press-feedback: ripple basılan noktadan en uzak köşeye; klavyede merkez", () => {
  const { rippleOrigin } = load("press-feedback");
  const rect = { left: 100, top: 50, width: 120, height: 44 };
  assert.deepEqual(plain(rippleOrigin(rect, 110, 60)), {
    x: 10,
    y: 10,
    size: Math.ceil(Math.hypot(110, 34)),
  });
  assert.deepEqual(plain(rippleOrigin(rect, 0, 0)), {
    x: 60,
    y: 22,
    size: Math.ceil(Math.hypot(60, 22)),
  });
  assert.deepEqual(plain(rippleOrigin(rect, 500, 500)), {
    x: 60,
    y: 22,
    size: Math.ceil(Math.hypot(60, 22)),
  });
});
test("press-feedback: reveal yalnız observer + hareket serbest + ilk ekran dışıyken gizli başlar (R15)", () => {
  const { revealStartsHidden } = load("press-feedback");
  assert.equal(
    revealStartsHidden({ hasObserver: true, reducedMotion: false, inViewport: false }),
    true,
  );
  assert.equal(
    revealStartsHidden({ hasObserver: false, reducedMotion: false, inViewport: false }),
    false,
  );
  assert.equal(
    revealStartsHidden({ hasObserver: true, reducedMotion: true, inViewport: false }),
    false,
  );
  assert.equal(
    revealStartsHidden({ hasObserver: true, reducedMotion: false, inViewport: true }),
    false,
  );
  const css = fs.readFileSync(path.resolve(__dirname, "../app/components/ui/ui.css"), "utf8");
  const noPref = css.slice(css.indexOf("Hover 1 px kalkma"));
  assert.match(noPref, /html\[data-js\] \.ui-reveal\[data-reveal="pending"\]/);
  assert.ok(
    css.indexOf("html[data-js] .ui-reveal") >
      css.indexOf("@media (prefers-reduced-motion: no-preference)"),
  );
  const chrome = fs.readFileSync(
    path.resolve(__dirname, "../app/components/ui/site-chrome.tsx"),
    "utf8",
  );
  assert.match(chrome, /dataset\.js = ""/);
});
test("Button: loading görünür etiket + aria-busy, disabledReason aria-describedby, ripple", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../app/components/ui/button.tsx"), "utf8");
  assert.match(src, /loading && loadingLabel \? loadingLabel : children/);
  assert.match(src, /"aria-describedby": showReason \? reasonId : undefined/);
  assert.match(src, /useRipple/);
});
test("flash: tek seferlik, yalnız bilinen anahtar, depolama hatasında akış sürer", () => {
  const { setFlash, takeFlash } = loadTs(path.resolve(__dirname, "../app/lib/navigation/flash.ts"));
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };
  setFlash("routeSaved", storage);
  assert.equal(takeFlash(storage), "routeSaved");
  assert.equal(takeFlash(storage), null, "okununca silinir");
  storage.setItem("mapsbridge.flash", "<script>");
  assert.equal(takeFlash(storage), null, "bilinmeyen değer yok sayılır");
  const broken = {
    getItem: () => {
      throw new Error("x");
    },
    setItem: () => {
      throw new Error("x");
    },
    removeItem: () => {},
  };
  assert.doesNotThrow(() => setFlash("routeOnDevice", broken));
  assert.equal(takeFlash(broken), null);
});
test("çekirdek akış geri bildirimi bağlı (Increment 2.8)", () => {
  const read = (rel) => fs.readFileSync(path.resolve(__dirname, "../app", rel), "utf8");
  assert.match(read("travel-assistant/thinking-steps.tsx"), /<Progress\s+variant="steps"/);
  const checkout = read("checkout/checkout-client.tsx");
  assert.match(checkout, /<Progress variant="indeterminate"/);
  assert.match(checkout, /<Celebrate/);
  assert.match(checkout, /setWallet\(updated\)/);
  assert.match(read("components/trip/travel-planner-sidebar.tsx"), /announcePinDeleted/);
  assert.match(read("components/trip/share-modal.tsx"), /planner\.share\.copyFailed/);
  assert.match(read("verify/page.tsx"), /<Celebrate/);
  assert.match(read("components/trip/trip-picker.tsx"), /variant="list-row"/);
});
test("toast-hold (B2): modal açıkken toast bekletilir, son modal kapanınca sırasıyla gösterilir", () => {
  const h = load("toast-hold");
  assert.equal(h.admitToast(true), "hold");
  assert.equal(h.admitToast(false), "show");
  assert.deepEqual(plain(h.releaseHeld([1, 2], true)), { show: [], keep: [1, 2] });
  assert.deepEqual(plain(h.releaseHeld([1, 2], false)), { show: [1, 2], keep: [] });
  // :modal desteklenmezse (SyntaxError) aria-modal yedeğine düşer.
  const legacy = (s) => {
    if (s.includes(":modal")) throw new Error("unsupported");
    return s.includes("aria-modal") ? {} : null;
  };
  assert.equal(h.isModalOpen(legacy), true);
  assert.equal(
    h.isModalOpen(() => null),
    false,
  );
  const src = fs.readFileSync(path.resolve(__dirname, "../app/components/ui/toast.tsx"), "utf8");
  assert.match(src, /admitToast\(modalOpenNow\(\)\) === "hold"/);
  assert.match(src, /new MutationObserver\(flush\)/);
});
test("ShareModal (B2): kopyalama hatası modal içinde role=alert, toast'a gitmez (inert değil)", () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, "../app/components/trip/share-modal.tsx"),
    "utf8",
  );
  assert.doesNotMatch(src, /toast\.show|useToast/);
  const modal = src.slice(src.indexOf("<Modal"), src.lastIndexOf("</Modal>"));
  assert.match(modal, /copyError && \(\s*<Alert tone="danger" live="assertive">/);
  assert.match(modal, /role="status" data-share-copy-status/);
  assert.match(src, /Promise\.reject\(new Error\("clipboard unavailable"\)\)/);
});
