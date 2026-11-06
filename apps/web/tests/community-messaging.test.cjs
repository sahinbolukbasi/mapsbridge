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

// ─── FEAT-009 review: gerçek social-sync + user-storage ile kayıt/yeniden okuma ────────────
function socialSyncEnv() {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  localStorage.setItem("mapsbridge.userEmail", "Ayse.Kaya@example.com");
  localStorage.setItem("mapsbridge.accessToken", "token");
  const window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
  class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init && init.detail;
    }
  }
  const fetch = () => Promise.resolve({ ok: false, json: async () => ({}) });
  const mod = loadTs(path.join(APP, "lib/social-sync.ts"), {
    globals: { window, localStorage, CustomEvent, fetch },
  });
  const key = `mapsbridge.account.${encodeURIComponent("ayse.kaya@example.com")}.mapsbridge.userProfileDetails`;
  return { mod, store, key };
}

test("social-sync: profil kaydı diller/ilgi/bağlantı/eski alanları korur, uydurma sayaç yazmaz", () => {
  const { mod, store, key } = socialSyncEnv();
  const stored = {
    fullName: "Ayşe",
    languages: ["Türkçe", "İngilizce"],
    interests: ["Tarih"],
    instagram: "@ayse",
    youtubeOrBlog: "https://ornek.example",
    showProBadge: false,
  };
  store.set(key, JSON.stringify(stored));
  // /profile/edit/ saveProfile sırası: birleşik ayrıntılar, sonra updateProfile.
  const clean = { ...stored, fullName: "Ayşe Kaya", username: "ayse", bio: "Merhaba" };
  store.set(key, JSON.stringify(clean));
  mod.webSocialSync.updateProfile({ fullName: "Ayşe Kaya", username: "ayse", bio: "Merhaba" });
  const after = JSON.parse(store.get(key));
  assert.deepEqual(after.languages, ["Türkçe", "İngilizce"]);
  assert.deepEqual(after.interests, ["Tarih"]);
  assert.equal(after.instagram, "@ayse");
  assert.equal(after.youtubeOrBlog, "https://ornek.example");
  assert.equal(after.showProBadge, false);
  assert.equal(after.fullName, "Ayşe Kaya");
  for (const k of [
    "followersCount",
    "followingCount",
    "routesCount",
    "stopsCount",
    "verified",
    "email",
  ])
    assert.equal(k in after, false, `${k} kaydedilmemeli`);
  const p = mod.webSocialSync.getProfile();
  assert.equal(p.username, "ayse");
  assert.equal(p.followersCount, 0);
  assert.equal(p.verified, false);
});

test("social-sync: profil ayrıntısı yoksa kimlik oturumdan; konum/avatar/etiket uydurulmaz (I1)", () => {
  const { mod } = socialSyncEnv();
  const profile = mod.webSocialSync.getProfile();
  assert.equal(profile.username, "aysekaya");
  assert.equal(profile.fullName, "Ayse.kaya");
  assert.equal(profile.email, "ayse.kaya@example.com");
  assert.equal(profile.location, "");
  assert.equal(profile.bio, "");
  const post = plain(
    mod.webSocialSync.createPost({ content: "Roma'dan selam", category: "Gastronomi" }),
  );
  assert.equal(post.authorUsername, "aysekaya");
  assert.equal(post.authorDisplayName, "Ayse.kaya");
  assert.equal("authorAvatar" in post, false);
  assert.equal("locationTag" in post, false);
  assert.equal("authorFollowersCount" in post, false);
  assert.deepEqual(post.hashtags, []);
  const src = read("lib/social-sync.ts");
  assert.doesNotMatch(src, /googleusercontent|İstanbul, Türkiye|1420|"#Seyahat"/);
  assert.deepEqual(plain(mod.deriveIdentity("x@y.z", { firstName: "Can", lastName: "Er" })), {
    fullName: "Can Er",
    username: "x",
  });
});

test("review düzeltmeleri: örnek profilde takip/mesaj yok, yorum taslağı kapıda korunur, akış canlı bölge değil", () => {
  const client = read("[username]/public-profile-client.tsx");
  const sampleBranch = client.slice(
    client.indexOf(": sample ? ("),
    client.indexOf(") : (\n            <>"),
  );
  assert.ok(sampleBranch.length > 0, "örnek profil dalı yok");
  assert.doesNotMatch(sampleBranch, /follow|messages\/\?user/);
  assert.match(
    read("features/community/components/PostCard.tsx"),
    /if \(actions\.onAddComment\(post\.id, text\)\) setComment\(""\)/,
  );
  const community = read("community/page.tsx");
  assert.doesNotMatch(community, /aria-live/);
  assert.match(community, /role="status"/);
  const edit = read("profile/edit/page.tsx");
  assert.doesNotMatch(edit, /useState<WalletData>\(\(\) => billingService\.getWallet\(\)\)/);
  assert.match(read("components/ui/media.tsx"), /naturalWidth/);
});

test("mesajlar (S21): grup oluşturma ve sohbet türü süzgeci yok; uydurma grup thread'i gönderilmez", () => {
  const src = read("messages/page.tsx");
  assert.doesNotMatch(src, /NewGroupModal|startGroup|newGroup|SegmentedControl|group-\$\{/);
  assert.doesNotMatch(src, /messages\.filter/);
});

// ─── Increment 1.12 (bug 7): composer görseli, emoji, yazar profili ─────────
const media = loadTs(path.join(APP, "features/community/media.ts"));
const emoji = loadTs(path.join(APP, "features/community/emoji.ts"));
const { profileHref, normalizeUsername } = loadTs(path.join(APP, "lib/navigation/profile-href.ts"));

test("validateImage: JPG/PNG/WEBP ve ≤10 MB; diğerleri reddedilir", () => {
  const MB = 1024 * 1024;
  for (const type of ["image/jpeg", "image/png", "image/webp"])
    assert.deepEqual(plain(media.validateImage({ type, size: 2 * MB })), { ok: true }, type);
  assert.equal(media.validateImage({ type: "image/gif", size: MB }).reason, "type");
  assert.equal(media.validateImage({ type: "application/pdf", size: MB }).reason, "type");
  assert.equal(media.validateImage({ type: "image/png", size: 10 * MB + 1 }).reason, "size");
  assert.equal(media.validateImage({ type: "image/png", size: 0 }).reason, "empty");
});

test("fitWithin: en uzun kenar ≤1600, oran korunur, büyütme yok", () => {
  assert.deepEqual(plain(media.fitWithin(4000, 3000)), { w: 1600, h: 1200 });
  assert.deepEqual(plain(media.fitWithin(1200, 3000)), { w: 640, h: 1600 });
  assert.deepEqual(plain(media.fitWithin(800, 600)), { w: 800, h: 600 });
  assert.equal(media.isDeviceOnlyImage("data:image/png;base64,AA"), true);
  assert.equal(media.isDeviceOnlyImage("https://media.example/x.jpg"), false);
});

test("createPost görsel alanını taşır; composer görseli ve emoji seçiciyi içerir", () => {
  const { mod } = socialSyncEnv();
  const post = plain(
    mod.webSocialSync.createPost({ content: "Kapadokya", photo: "data:image/jpeg;base64,AA" }),
  );
  assert.equal(post.image, "data:image/jpeg;base64,AA");
  assert.match(read("community/page.tsx"), /photo: data\.image,/);
  const modal = read("features/community/components/NewPostModal.tsx");
  assert.match(modal, /type="file"/);
  assert.match(modal, /accept=\{IMAGE_TYPES\.join\(","\)\}/);
  assert.match(modal, /onDrop=\{onDrop\}/);
  assert.match(modal, /fileRef\.current\?\.click\(\)/, "sürükle-bırakın düğme alternatifi");
  assert.match(modal, /<progress/);
  assert.match(modal, /<EmojiPicker onPick=\{addEmoji\} \/>/);
});

test("emoji imleç konumuna eklenir", () => {
  assert.deepEqual(plain(emoji.insertAt("Merhaba dünya", "🌅", 7)), {
    text: "Merhaba🌅 dünya",
    caret: 9,
  });
  assert.deepEqual(plain(emoji.insertAt("ab", "!", null)), { text: "ab!", caret: 3 });
  assert.deepEqual(plain(emoji.insertAt("abcd", "X", 1, 3)), { text: "aXd", caret: 2 });
  assert.ok(emoji.EMOJIS.length >= 8);
});

test("profileHref: örnek slug /<slug>/, gerçek kullanıcı /profiles/?u=; geçersiz null", () => {
  assert.equal(profileHref("gezgin"), "/gezgin/");
  assert.equal(profileHref("@Traveler"), "/traveler/");
  assert.equal(profileHref("@Ayse_K"), "/profiles/?u=ayse_k");
  assert.equal(profileHref("ali.veli"), "/profiles/?u=ali.veli");
  assert.equal(profileHref("../etc"), null);
  assert.equal(profileHref(""), null);
  assert.equal(normalizeUsername("<script>"), null);
});

test("PostCard: yazar adı ve avatar profil bağlantısı; aria-label görünür adla başlar; tepki animasyonu reduced-motion'a uyar", () => {
  const card = read("features/community/components/PostCard.tsx");
  assert.match(card, /const authorHref = profileHref\(post\.authorUsername\);/);
  assert.match(card, /<Link\s+href=\{authorHref\}\s+className="cm-post__author-link"/);
  assert.match(card, /aria-label=\{`\$\{post\.authorDisplayName\} — /);
  const css = read("features/community/community-feed.css");
  const motion = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
  assert.match(motion, /\.cm-react\[data-pop\] \{\s*animation: cm-pop var\(--duration-slow\)/);
  const before = css.slice(0, css.indexOf("@media (prefers-reduced-motion: no-preference)"));
  assert.doesNotMatch(before, /animation:/, "animasyon yalnız no-preference bloğunda");
  const client = read("profiles/profiles-client.tsx");
  assert.match(client, /new URLSearchParams\(window\.location\.search\)\.get\("u"\)/);
  assert.doesNotMatch(client, /import \{[^}]*useSearchParams/);
});
