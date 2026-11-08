// Harita sağlayıcı derin bağlantıları (D3): her sağlayıcı için origin'li/origin'siz URL,
// koordinat kodlaması ve işletim sistemine göre varsayılan sağlayıcı.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const APP = path.resolve(__dirname, "../app");
const { buildDirections, defaultProvider, PROVIDERS } = loadTs(
  path.join(APP, "lib/share/map-directions.ts"),
);

const DEST = { lat: 41.008237, lng: 28.978359 };
const ORIGIN = { lat: 40.9, lng: 29.1 };
const TO = encodeURIComponent("41.008237,28.978359");
const FROM = encodeURIComponent("40.900000,29.100000");

test("Apple: origin'li ve origin'siz URL", () => {
  assert.equal(
    buildDirections({ dest: DEST, origin: ORIGIN, provider: "apple" }),
    `https://maps.apple.com/?saddr=${FROM}&daddr=${TO}&dirflg=d`,
  );
  assert.equal(
    buildDirections({ dest: DEST, provider: "apple" }),
    `https://maps.apple.com/?daddr=${TO}&dirflg=d`,
  );
});

test("Google: origin'li ve origin'siz URL", () => {
  assert.equal(
    buildDirections({ dest: DEST, origin: ORIGIN, provider: "google" }),
    `https://www.google.com/maps/dir/?api=1&origin=${FROM}&destination=${TO}`,
  );
  assert.equal(
    buildDirections({ dest: DEST, origin: null, provider: "google" }),
    `https://www.google.com/maps/dir/?api=1&destination=${TO}`,
  );
});

test("Yandex: origin'li ve origin'siz (boş from) URL", () => {
  assert.equal(
    buildDirections({ dest: DEST, origin: ORIGIN, provider: "yandex" }),
    `https://yandex.com/maps/?rtext=${FROM}~${TO}&rtt=auto`,
  );
  assert.equal(
    buildDirections({ dest: DEST, provider: "yandex" }),
    `https://yandex.com/maps/?rtext=~${TO}&rtt=auto`,
  );
});

test("koordinat URL kodlaması: virgül %2C olur", () => {
  const url = buildDirections({ dest: DEST, provider: "google" });
  assert.ok(url.includes("%2C"), "virgül kodlandı");
  assert.ok(!url.includes("28.978359,"), "ham virgül yok");
});

test("defaultProvider: iOS/mac → apple, diğerleri → google", () => {
  assert.equal(defaultProvider("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), "apple");
  assert.equal(defaultProvider("MacIntel"), "apple");
  assert.equal(defaultProvider("iPad"), "apple");
  assert.equal(defaultProvider("Mozilla/5.0 (Linux; Android 14)"), "google");
  assert.equal(defaultProvider("Win32"), "google");
  assert.equal(defaultProvider(null), "google");
  assert.equal(defaultProvider(undefined), "google");
});

test("PROVIDERS: üç sağlayıcı, apple/google/yandex sırası", () => {
  assert.equal(PROVIDERS.map((p) => p.id).join(","), "apple,google,yandex");
  for (const p of PROVIDERS) assert.ok(p.labelKey && p.fallback);
});
