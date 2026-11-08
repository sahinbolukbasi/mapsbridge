// B5 (FEAT-005): mesajlaşma ara → çöz → istek → kabul akışı. Yeni mesaj formu gönderildiğinde
// alıcı ÖNCE sunucuda çözülür (createThread): 404 USER_NOT_FOUND → yazışma kutusu AÇILMAZ,
// başarı → sohbet "bekleyen" durumda açılır (composer kabul edilene kadar kapalı). Saf mantık
// (resolveOutcome, groupThreads, chatErrorKey) + kaynak/i18n sözleşmesi. Danger-zone yok.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const APP = path.resolve(__dirname, "../app");
const MOBILE_SRC = path.resolve(__dirname, "../../mobile/src");
const read = (rel) => fs.readFileSync(path.join(APP, rel), "utf8");
const plain = (v) => JSON.parse(JSON.stringify(v));

const reqs = loadTs(path.join(APP, "features/messaging/requests.ts"));
const tr = require("../app/locales/tr.json");
const en = require("../app/locales/en.json");

test("resolveOutcome: başarı → 'pending', 404 USER_NOT_FOUND → 'notFound'", () => {
  assert.equal(reqs.resolveOutcome(null), "pending");
  assert.equal(reqs.resolveOutcome(undefined), "pending");
  assert.equal(reqs.resolveOutcome({ status: 404, code: "USER_NOT_FOUND" }), "notFound");
  assert.equal(reqs.resolveOutcome({ status: 403, code: "REQUEST_CLOSED" }), "closed");
  assert.equal(reqs.resolveOutcome({ status: 409, code: "REQUEST_PENDING" }), "waiting");
  // Uç henüz canlı değil / ağ hatası / bilinmeyen kod → "error" (çözemedik, kutu açılmaz).
  assert.equal(reqs.resolveOutcome({ status: 404, code: undefined }), "error");
  assert.equal(reqs.resolveOutcome({ status: 0 }), "error");
  assert.equal(reqs.resolveOutcome({ status: 500, code: "SERVER_ERROR" }), "error");
});

test("yeni mesaj: 'notFound' sonucunda yazışma kutusu AÇILMAZ (kaynak sözleşmesi)", () => {
  const page = read("messages/page.tsx");
  // startDirect önce createThread ile çözer; alıcı yoksa kutu açılmaz, modal açık kalır.
  assert.match(page, /await chatApi\.createThread\(name, text\)/);
  assert.match(page, /resolveOutcome\(\{ status: e\?\.status, code: e\?\.code \}\)/);
  assert.match(page, /if \(outcome === "notFound"\)/);
  assert.match(page, /errorKey: "messages\.req\.userNotFound", keepOpen: true/);
  // Başarılı çözümde sohbet bekleyen (pendingOut) durumda açılır; composer o sırada kapalı.
  assert.match(page, /pendingOut: true/);
  assert.match(page, /disabled=\{Boolean\(active\.pendingOut\)\}/);
  // Yeni mesaj formu bir ilk mesaj ister: boş mesajla çözme denenmez.
  assert.match(page, /messages\.newChat\.messageRequired/);
  // open(...) yalnızca createThread başarıya ulaştıktan sonra çağrılır (optimistik pane yok).
  const start = page.indexOf("async function startDirect");
  const end = page.indexOf("if (authed === false)");
  const body = page.slice(start, end);
  const openIdx = body.indexOf("open(conv.id)");
  const createIdx = body.indexOf("chatApi.createThread(name, text)");
  assert.ok(createIdx > -1 && openIdx > createIdx, "önce çöz, sonra kutuyu aç");
});

test("groupThreads: gelen/giden/aktif/bilinmeyen doğru kovalara düşer", () => {
  const threads = [
    { threadId: "in", request: { status: "pending", from: "x", to: "me" } },
    { threadId: "out", request: { status: "pending", from: "me", to: "y" } },
    { threadId: "old" },
    { threadId: "ok", request: { status: "accepted", from: "me", to: "z" } },
    { threadId: "no", request: { status: "declined", from: "me", to: "z" } },
    { threadId: "bl", request: { status: "blocked", from: "q", to: "me" } },
    { threadId: "u", request: { status: "unknown" } },
  ];
  const g = plain(reqs.groupThreads(threads, "me"));
  assert.deepEqual(
    g.incoming.map((t) => t.threadId),
    ["in"],
  );
  assert.deepEqual(
    g.outgoing.map((t) => t.threadId),
    ["out"],
  );
  assert.deepEqual(
    g.active.map((t) => t.threadId),
    ["old", "ok"],
  );
  assert.deepEqual(
    g.unknown.map((t) => t.threadId),
    ["u"],
  );
});

test("chatErrorKey: 404/409(gönderen↔alıcı)/403 doğru i18n anahtarına eşlenir", () => {
  assert.equal(reqs.chatErrorKey(404, "USER_NOT_FOUND"), "messages.req.userNotFound");
  assert.equal(reqs.chatErrorKey(409, "REQUEST_PENDING", true), "messages.req.waiting");
  assert.equal(reqs.chatErrorKey(409, "REQUEST_PENDING", false), "messages.req.respondFirst");
  assert.equal(reqs.chatErrorKey(403, "REQUEST_CLOSED"), "messages.req.closed");
  assert.equal(reqs.chatErrorKey(404, undefined), null);
  assert.equal(reqs.chatErrorKey(500, "SERVER_ERROR"), null);
});

test("yeni i18n anahtarları tr.json ve en.json'da var; TR değeri koddaki fallback'e eşit", () => {
  const keys = [
    "messages.newChat.message",
    "messages.newChat.messageRequired",
    "messages.newChat.messageHint",
    "messages.newChat.failed",
    "messages.req.userNotFound",
    "messages.req.sentNote",
    "messages.req.waitAccept",
  ];
  for (const k of keys) {
    assert.ok(tr[k], `tr.json eksik: ${k}`);
    assert.ok(en[k], `en.json eksik: ${k}`);
  }
  // I11: koddaki Türkçe fallback tr.json değerine eşit.
  assert.equal(tr["messages.newChat.messageRequired"], "Bir mesaj yaz.");
  assert.equal(tr["messages.newChat.message"], "İlk mesaj");
});

test("native parite: ChatScreen resolve-before-compose, geçersiz alıcıya kutu yok", () => {
  const native = fs.readFileSync(path.join(MOBILE_SRC, "screens/ChatScreen.tsx"), "utf8");
  assert.match(native, /chatRequestApi\.createThread\(handle, text\)/);
  assert.match(native, /resolveOutcome\(\{ status: e\?\.status, code: e\?\.code \}\)/);
  assert.match(native, /if \(outcome === "notFound"\)/);
  assert.match(native, /messages\.newChat\.messageRequired/);
  // Mobil saf mantık web kopyasıyla birebir (parite).
  assert.equal(
    fs.readFileSync(path.join(MOBILE_SRC, "ui/logic/chat-requests.ts"), "utf8"),
    read("features/messaging/requests.ts"),
  );
});
