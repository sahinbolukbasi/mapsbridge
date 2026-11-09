// Faz 3 / görev 11 — sub-agent koşullu tetik (I10 + I5).
// car-rental agent'ı metro/yürüme şehrinde (carRecommended=false) kullanıcı
// açıkça araç istemedikçe TETİKLENMEZ. Karar OLGUDAN (carRecommended), demografiden
// DEĞİL (I5). Fact bilinmiyorsa mevcut davranış korunur.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

// dispatcher.ts'i sub-agent runner importlarını stub'layarak yükler (saf mantık testi).
function load() {
  const cache = new Map();
  function loadFile(file) {
    const filename = path.resolve(file);
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    cache.set(filename, module.exports);
    vm.runInNewContext(
      transformSync(fs.readFileSync(filename, "utf8"), { loader: "ts", format: "cjs" }).code,
      {
        module,
        exports: module.exports,
        setTimeout,
        clearTimeout,
        Date,
        require: (spec) => {
          // Sub-agent runner'ları çağrılmayacak (saf relevance testi) → boş stub.
          if (spec.includes("-agent")) return new Proxy({}, { get: () => () => Promise.resolve({}) });
          if (spec.startsWith("."))
            return loadFile(path.resolve(path.dirname(filename), spec + ".ts"));
          return require(spec);
        },
      },
      { filename },
    );
    cache.set(filename, module.exports);
    return module.exports;
  }
  return loadFile(path.resolve(__dirname, "../app/lib/ai/sub-agents/dispatcher.ts"));
}

const d = load();
const carEntry = d.AGENT_REGISTRY.find((e) => e.id === "car-rental");
const foodEntry = d.AGENT_REGISTRY.find((e) => e.id === "food");

test("car-rental: metro şehri (carRecommended=false) + geçersek anma → tetiklenmez (I10)", () => {
  const relevant = d.isAgentRelevant(carEntry, "araçla gezmek şart mı acaba", "chat", false, {
    carRecommended: false,
  });
  assert.equal(relevant, false);
});

test("car-rental: kullanıcı açıkça araç isterse metro şehrinde bile tetiklenir", () => {
  const relevant = d.isAgentRelevant(
    carEntry,
    "araç kiralamak istiyorum, nereden tutabilirim",
    "chat",
    false,
    { carRecommended: false },
  );
  assert.equal(relevant, true);
});

test("car-rental: carRecommended=true ise açık istekle tetiklenir", () => {
  const relevant = d.isAgentRelevant(carEntry, "araba kiralayacağım", "chat", false, {
    carRecommended: true,
  });
  assert.equal(relevant, true);
});

test("car-rental: fact bilinmiyorsa (undefined) mevcut davranış — desen eşleşince tetiklenir", () => {
  const relevant = d.isAgentRelevant(carEntry, "araç kiralama", "chat", false, undefined);
  assert.equal(relevant, true);
});

test("explicitlyWantsCar: ısrarlı istek true, geçerken anma false", () => {
  assert.equal(d.explicitlyWantsCar("araç kiralamak istiyorum"), true);
  assert.equal(d.explicitlyWantsCar("kiralık araba lazım"), true);
  assert.equal(d.explicitlyWantsCar("araba tutacağım"), true);
  assert.equal(d.explicitlyWantsCar("şehirde araçla gezmeye gerek var mı"), false);
  assert.equal(d.explicitlyWantsCar("metro ile her yere gidilir mi"), false);
});

test("I5: karar demografiye değil olguya bağlı — fact aynıysa istek metni belirleyici", () => {
  // Aynı metin, yalnızca carRecommended farkıyla farklı sonuç verir.
  const metro = d.isAgentRelevant(carEntry, "araçla mı gezsem", "route", false, {
    carRecommended: false,
  });
  const drivable = d.isAgentRelevant(carEntry, "araçla mı gezsem", "route", false, {
    carRecommended: true,
  });
  assert.equal(metro, false);
  assert.equal(drivable, true);
});

test("car-rental dışı agent (food) carRecommended'tan etkilenmez", () => {
  const relevant = d.isAgentRelevant(foodEntry, "nerede yemek yesem", "chat", false, {
    carRecommended: false,
  });
  assert.equal(relevant, true);
});

test("food: route modunda alwaysInRoute → basit olmayan sorguda tetiklenir", () => {
  assert.equal(d.isAgentRelevant(foodEntry, "3 günlük İstanbul rotası planla", "route", false), true);
  // Basit sorgu → fan-out yok.
  assert.equal(d.isAgentRelevant(foodEntry, "selam", "route", true), false);
});
