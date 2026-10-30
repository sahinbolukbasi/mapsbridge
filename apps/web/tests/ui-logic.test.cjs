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
