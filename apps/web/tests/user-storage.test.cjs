const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { buildSync } = require("esbuild");
const vm = require("node:vm");

const WEB_ROOT = path.resolve(__dirname, "..");

function store(throws) {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      if (throws) throw new Error("QuotaExceeded");
      map.set(k, v);
    },
    removeItem: (k) => map.delete(k),
  };
}

function loadStorage(localStorage) {
  const result = buildSync({
    entryPoints: [path.join(WEB_ROOT, "app/lib/user-storage.ts")],
    absWorkingDir: WEB_ROOT,
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
  });
  const events = [];
  const context = {
    module: { exports: {} },
    window: {
      dispatchEvent: (e) => events.push(e),
    },
    localStorage,
    CustomEvent: class CustomEvent {
      constructor(type) {
        this.type = type;
      }
    },
  };
  vm.runInNewContext(result.outputFiles[0].text, context);
  return { userStorage: context.module.exports.userStorage, events };
}

test("getItem returns null when not logged in", () => {
  const data = store();
  // No email, no token — not logged in
  const { userStorage } = loadStorage(data);
  assert.equal(userStorage.getItem("savedAddresses"), null);

  // Only email, no token — still not logged in
  const data2 = store();
  data2.setItem("mapsbridge.userEmail", "a@example.com");
  const { userStorage: us2 } = loadStorage(data2);
  assert.equal(us2.getItem("savedAddresses"), null);

  // Only token, no email — still not logged in
  const data3 = store();
  data3.setItem("mapsbridge.accessToken", "token");
  const { userStorage: us3 } = loadStorage(data3);
  assert.equal(us3.getItem("savedAddresses"), null);
});

test("setItem throws when not logged in", () => {
  const data = store();
  const { userStorage } = loadStorage(data);
  assert.throws(() => userStorage.setItem("savedAddresses", "value"), {
    message: /giriş yapın/,
  });
});

test("removeItem is silent when not logged in", () => {
  const data = store();
  const { userStorage } = loadStorage(data);
  // Should not throw
  assert.doesNotThrow(() => userStorage.removeItem("savedAddresses"));
});

test("scoped key includes encoded email", () => {
  const data = store();
  data.setItem("mapsbridge.userEmail", "User+Test@Example.COM");
  data.setItem("mapsbridge.accessToken", "token");
  const { userStorage } = loadStorage(data);
  userStorage.setItem("prefs", "dark");

  const expectedKey =
    "mapsbridge.account." +
    encodeURIComponent("user+test@example.com") +
    ".prefs";
  assert.equal(data.getItem(expectedKey), "dark");
  assert.equal(userStorage.getItem("prefs"), "dark");
});

test("legacy email fallback reads adreskopru.userEmail", () => {
  const data = store();
  // No mapsbridge.userEmail, but adreskopru.userEmail is present
  data.setItem("adreskopru.userEmail", "legacy@example.com");
  data.setItem("mapsbridge.accessToken", "token");
  const { userStorage } = loadStorage(data);
  userStorage.setItem("notes", "hello");

  const expectedKey =
    "mapsbridge.account." +
    encodeURIComponent("legacy@example.com") +
    ".notes";
  assert.equal(data.getItem(expectedKey), "hello");
  assert.equal(userStorage.getItem("notes"), "hello");
});

test("storage error dispatches mapsbridge:storage-error event", () => {
  const data = store(true); // setItem always throws
  data.setItem = (() => {
    // We need getItem to work normally but setItem to throw only on scoped writes.
    // Re-implement: allow setup calls, throw on scoped calls.
    const map = new Map();
    const originalSet = (k, v) => map.set(k, v);
    const originalGet = (k) => map.get(k) ?? null;
    data.getItem = originalGet;
    data.removeItem = (k) => map.delete(k);

    // Seed the required auth keys
    originalSet("mapsbridge.userEmail", "a@example.com");
    originalSet("mapsbridge.accessToken", "token");

    // Return a setItem that throws only for scoped keys (mapsbridge.account.*)
    return (k, v) => {
      if (k.startsWith("mapsbridge.account.")) {
        throw new Error("QuotaExceeded");
      }
      originalSet(k, v);
    };
  })();

  const { userStorage, events } = loadStorage(data);
  assert.throws(() => userStorage.setItem("prefs", "dark"), {
    message: /Depolama alanını kontrol edin/,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "mapsbridge:storage-error");
});
