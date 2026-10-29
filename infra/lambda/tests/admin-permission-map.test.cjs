// Admin İzin-Eşleme Testi
// -----------------------
// Amaç: admin/permissions.ts içindeki routePermission() her bilinen admin route için
// BEKLENEN izni döndürüyor mu — tablo-tabanlı. routePermission path-substring tabanlı
// olduğu için yeni bir uç yanlış izne (ör. "system" yerine "users") kayabilir veya
// yanlışlıkla daha dar/geniş role açılabilir. Bu test sessiz yetki kaymasını yakalar.
//
// Kaynak: PLAN.md FAZ 1 / adım 5 + danger-zone #4 (middleware/RBAC).
// Konvansiyon: node:test + node:assert/strict, CommonJS, esbuild ile TS yükleme.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

// permissions.ts saf modül (sıfır import) — doğrudan derleyip çalıştır.
function loadPermissions() {
  const filename = path.resolve(__dirname, "../src/admin/permissions.ts");
  const code = transformSync(readFileSync(filename, "utf8"), {
    loader: "ts",
    format: "cjs",
  }).code;
  const module = { exports: {} };
  const sandbox = { module, exports: module.exports, require };
  vm.runInNewContext(code, sandbox, { filename });
  return module.exports;
}

const { routePermission, can, permissions } = loadPermissions();

// Beklenen eşleme tablosu: [path, method, beklenenIzin]
// Bir uç eklendiğinde/değiştiğinde bu tablo da güncellenmeli — bilinçli senkron.
const CASES = [
  // izinsiz (null) uçlar
  ["/admin/session", "GET", null],
  ["/admin/metrics", "GET", null],
  // roller
  ["/admin/users/u1/role", "POST", "roles"],
  // krediler / cüzdan
  ["/admin/users/u1/credits", "POST", "credits"],
  ["/admin/users/u1/wallet", "GET", "credits"],
  // finans
  ["/admin/users/u1/subscription", "GET", "finance"],
  ["/admin/finance", "GET", "finance"],
  ["/admin/payments", "GET", "finance"],
  ["/admin/subscriptions", "GET", "finance"],
  ["/admin/orders/o1/refund", "POST", "finance"],
  // kullanıcılar
  ["/admin/users", "GET", "users"],
  // içerik/moderasyon
  ["/admin/routes", "GET", "content"],
  ["/admin/reports", "GET", "content"],
  ["/admin/content", "GET", "content"],
  ["/admin/shares", "GET", "content"],
  ["/admin/profiles", "GET", "content"],
  // destek
  ["/admin/tickets", "GET", "support"],
  // audit
  ["/admin/audit-logs", "GET", "audit"],
  // fallback → system (fail-closed)
  ["/admin/some-new-unmapped-endpoint", "GET", "system"],
  ["/admin/module-config", "POST", "system"],
];

test("admin izin-eşleme: routePermission her bilinen route için beklenen izni döndürür", () => {
  for (const [p, method, expected] of CASES) {
    const actual = routePermission(p, method);
    assert.equal(
      actual,
      expected,
      `routePermission("${p}","${method}") = ${JSON.stringify(actual)} ama beklenen ${JSON.stringify(expected)}. ` +
        `Yeni uç eklediyse/path değiştiyse: ya bu tabloyu güncelle ya izin kaymasını düzelt (danger-zone #4).`,
    );
  }
});

test("admin izin-eşleme: fail-closed — eşleşmeyen path 'system' döner (en kısıtlı)", () => {
  // Rastgele/beklenmedik path'ler yalnızca admin'e açık olmalı
  const unknown = routePermission("/admin/totally-unknown-xyz", "DELETE");
  assert.equal(unknown, "system", "Bilinmeyen path 'system' (fail-closed) dönmeli.");
  assert.ok(
    permissions.admin.includes("system"),
    "admin rolü 'system' iznine sahip olmalı (fail-closed path'lere yalnız admin erişsin).",
  );
  assert.ok(
    !permissions.support.includes("system"),
    "support rolü 'system' iznine sahip OLMAMALI.",
  );
  assert.ok(
    !permissions.moderator.includes("system"),
    "moderator rolü 'system' iznine sahip OLMAMALI.",
  );
});

test("admin izin-eşleme: can() rol-izin matrisi doğru", () => {
  assert.ok(can("admin", "finance"), "admin finance'a erişebilir");
  assert.ok(can("moderator", "content"), "moderator content'e erişebilir");
  assert.ok(can("support", "support"), "support support'a erişebilir");
  assert.ok(!can("support", "finance"), "support finance'a ERİŞEMEZ");
  assert.ok(!can("moderator", "users"), "moderator users'a ERİŞEMEZ");
  assert.ok(!can(undefined, "support"), "rolsüz hiçbir şeye erişemez");
});
