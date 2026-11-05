// FEAT-009: topluluk, mesajlar, profil, gezgin profili ve /k/ saf mantığı + kapı sözleşmesi.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const APP = path.resolve(__dirname, "../app");
const plain = (v) => JSON.parse(JSON.stringify(v));
const read = (rel) => fs.readFileSync(path.join(APP, rel), "utf8");

const { toCopyStops, copyRouteName, COPY_MAX_STOPS } = loadTs(
  path.join(APP, "lib/trip/copy-stops.ts"),
);
const feed = loadTs(path.join(APP, "lib/community/feed.ts"));
const conv = loadTs(path.join(APP, "features/messaging/conversations.ts"));
const { profileTabRedirect } = loadTs(path.join(APP, "lib/navigation/profile-redirect.ts"));
const samples = loadTs(path.join(APP, "[username]/sample-routes.ts"));

test("copy-stops: yalnızca adı ve geçerli koordinatı olan duraklar; değer uydurulmaz (I1)", () => {
  const out = plain(
    toCopyStops([
      { label: "Pantheon", lat: 41.8986, lng: 12.4769, category: "tarih" },
      { name: "Adı name'de", lat: "41.1", lng: "29.0" },
      { label: "Koordinatsız" },
      { label: "Kutup ötesi", lat: 91, lng: 0 },
      { lat: 41, lng: 29 },
      null,
      "x",
    ]),
  );
  assert.deepEqual(out, [
    { id: "stop-1", name: "Pantheon", lat: 41.8986, lng: 12.4769, category: "tarih", day: 1 },
    { id: "stop-2", name: "Adı name'de", lat: 41.1, lng: 29, day: 1 },
  ]);
  assert.deepEqual(plain(toCopyStops(undefined)), []);
  const many = Array.from({ length: 40 }, (_, i) => ({ label: `D${i}`, lat: 1, lng: 1 }));
  assert.equal(toCopyStops(many).length, COPY_MAX_STOPS);
  assert.equal(copyRouteName("  Roma   3 gün "), "Roma 3 gün");
  assert.equal(copyRouteName(""), null);
});

test("feed: modlar yalnızca koddaki gerçek sıralama/süzmeler; Yakınımda yok", () => {
  assert.deepEqual(plain(feed.FEED_MODES), ["latest", "popular", "following"]);
  const posts = [
    { id: "post-1", authorUsername: "elif", category: "Gastronomi", likesCount: 9 },
    { id: "post-3", authorUsername: "@Can", category: "Tarih & Kültür", likesCount: 1 },
    { id: "post-2", authorUsername: "mert", tags: ["#gastronomi"], likesCount: 5 },
  ];
  const ids = (list) => plain(list.map((p) => p.id));
  const base = { category: "all", followed: [] };
  assert.deepEqual(ids(feed.filterFeed(posts, { ...base, mode: "latest" })), [
    "post-3",
    "post-2",
    "post-1",
  ]);
  assert.deepEqual(ids(feed.filterFeed(posts, { ...base, mode: "popular" })), [
    "post-1",
    "post-2",
    "post-3",
  ]);
  assert.deepEqual(
    ids(feed.filterFeed(posts, { mode: "following", category: "all", followed: ["can"] })),
    ["post-3"],
  );
  assert.deepEqual(
    ids(feed.filterFeed(posts, { mode: "latest", category: "Gastronomi", followed: [] })),
    ["post-2", "post-1"],
  );
  assert.equal(feed.sameUser("@Elif", "elif"), true);
  assert.equal(feed.sameUser("", ""), false);
  assert.deepEqual(plain(feed.extractHashtags("Roma #yemek ve #Gezi #yemek")), ["#yemek", "#Gezi"]);
  assert.deepEqual(plain(feed.extractHashtags("etiketsiz")), []);
  for (const c of feed.FEED_CATEGORIES) assert.ok(feed.CATEGORY_LABEL_KEY[c], c);
});

test("conversations: cihazdaki doğrudan mesajlardan kronolojik sohbetler, en son yazışılan önde", () => {
  const stored = [
    { id: "3", fromUsername: "ayse", toUsername: "me", message: "Yeni", createdAt: "c" },
    { id: "2", fromUsername: "me", toUsername: "Elif", message: "Selam", createdAt: "b" },
    { id: "1", fromUsername: "elif", toUsername: "me", message: "Roma?", createdAt: "a" },
    { id: "0", fromUsername: "x", toUsername: "me", message: "" },
  ];
  const list = plain(conv.conversationsFromDirectMessages(stored, "me", "Ben", (s) => `t-${s}`));
  assert.deepEqual(
    list.map((c) => [c.id, c.title, c.messages.map((m) => m.text)]),
    [
      ["dm_ayse", "ayse", ["Yeni"]],
      ["dm_elif", "elif", ["Roma?", "Selam"]],
    ],
  );
  assert.equal(list[1].messages[1].isOutgoing, true);
  assert.equal(list[1].messages[1].senderName, "Ben");
  assert.equal(list[1].lastTime, "t-b");
  assert.deepEqual(plain(conv.conversationsFromDirectMessages({}, "me", "Ben", String)), []);
  assert.equal(conv.directConversationId("@Elif Demir"), "dm_elif_demir");
  assert.equal(conv.cleanHandle("  @@elif "), "elif");
  const all = [
    { id: "g", type: "group", title: "Roma ekibi", routeTag: "Roma 3 gün", messages: [] },
    { id: "d", type: "direct", title: "elif", messages: [] },
  ];
  assert.deepEqual(plain(conv.filterConversations(all, "groups", "").map((c) => c.id)), ["g"]);
  assert.deepEqual(plain(conv.filterConversations(all, "all", "roma 3").map((c) => c.id)), ["g"]);
  assert.deepEqual(plain(conv.CONVERSATION_FILTERS), ["all", "groups", "direct"]);
});

test("profil: ?tab=routes planlayıcının rota seçicisine gider, diğerleri yok sayılır", () => {
  assert.equal(profileTabRedirect("?tab=routes"), "/maps/?view=trips");
  assert.equal(profileTabRedirect("?tab=ROUTES"), "/maps/?view=trips");
  assert.equal(profileTabRedirect("?tab=posts"), null);
  assert.equal(profileTabRedirect(""), null);
});

test("gezgin profili: örnek profiller = staticParams, örnek rotalarda sayısal iddia yok (F2)", () => {
  const page = read("[username]/page.tsx");
  for (const u of samples.SAMPLE_PROFILE_USERNAMES) {
    assert.ok(page.includes(`username: "${u}"`), `${u} generateStaticParams'ta yok`);
    assert.equal(samples.isSampleProfile(u.toUpperCase()), true);
  }
  assert.equal(samples.isSampleProfile("elif"), false);
  for (const r of samples.SAMPLE_ROUTES) {
    assert.deepEqual(Object.keys(r).sort(), [
      "category",
      "id",
      "image",
      "stops",
      "summary",
      "title",
    ]);
    assert.ok(r.stops.length >= 2);
    assert.doesNotMatch(`${r.summary.tr} ${r.summary.en}`, /\d/, `${r.id}: özet sayı içeriyor`);
  }
  const client = read("[username]/public-profile-client.tsx");
  assert.match(client, /tone="example"/);
  assert.doesNotMatch(client, /followerCount|ratingCount|rating|priceTag|2800|1420/);
});

test("kapılar: eski sarmalayıcılar silindi, tek AuthGate kullanılır (F18, R7)", () => {
  const gate = read("components/auth-gate.tsx");
  assert.doesNotMatch(gate, /FullPagePromotion|AuthActionModal|PanelGuestBanner/);
  const files = [
    "messages/page.tsx",
    "profile/page.tsx",
    "profile/edit/page.tsx",
    "profile/photo/page.tsx",
    "community/page.tsx",
    "[username]/public-profile-client.tsx",
    "k/page.tsx",
  ];
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, /FullPagePromotion|AuthActionModal|PanelGuestBanner/, f);
    assert.doesNotMatch(src, /material-symbols/, `${f}: Material Symbols`);
  }
  assert.match(read("messages/page.tsx"), /<AuthGate variant="page" reason="messages"/);
  for (const f of ["profile/page.tsx", "profile/edit/page.tsx", "profile/photo/page.tsx"])
    assert.match(read(f), /<AuthGate variant="page" reason="profile"/, f);
  assert.match(read("community/page.tsx"), /variant="sheet"\s+reason="save"/);
  // Mesajlaşma kredi harcamaz: ComposerBar'a maliyet verilmez.
  assert.doesNotMatch(read("messages/page.tsx"), /cost=\{/);
});

test("/k/: kod tek kuraldan (share-code) geçer; geçersizde istek atılmaz", () => {
  const src = read("k/page.tsx");
  assert.match(src, /readShareCode\(raw\)/);
  assert.match(src, /home\.share\.error/);
  // submit: geçersiz kodda lookup çağrılmadan önce return edilir.
  const submit = src.slice(src.indexOf("function submit("), src.indexOf("const dest"));
  assert.ok(submit.indexOf("return;") < submit.indexOf("lookup(valid)"));
  assert.match(src, /<CopyRouteButton/);
});
