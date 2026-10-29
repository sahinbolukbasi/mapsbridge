// Route-Sözleşme Testi (frontend ↔ backend hizası)
// -------------------------------------------------
// Amaç: apps/web api-client'ın çağırdığı her backend path'in, bir Lambda router'da
// gerçekten KAYITLI olmasını doğrulamak. İki taraf da string-literal path kullanıyor;
// biri değişip diğeri değişmezse (route drift) derleyici yakalamaz, sadece runtime 404 olur.
//
// Backend path'ler İKİ formatta ("METHOD /path" literali): router.add(...) VE obje-anahtarı.
//
// NORMALİZE kuralı (path param vs query ayrımı):
//   - Path parametresi DAİMA '/' ile ayrılır:  "/routes/${id}" , "/admin/users/{id}/suspend"
//     → "/${...}" veya "/{...}" segmenti ":p" olur.
//   - '/' olmadan segmente YAPIŞIK gelen "${...}" bir query/template'tir:
//     "/admin/reports${qs}" → query, path "/admin/reports"te biter.
//   - Nested template literal (`...${a?`?${a}`:""}`) regex ile güvenilir parse edilemez;
//     bu yüzden ilk kalan "${"/"?"/"`"/"#" path'i sonlandırır.
//
// Kaynak: PLAN.md FAZ 1 / adım 5. Konvansiyon: node:test + node:assert/strict, CommonJS.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "../../..");

function read(rel) {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

function normalize(p) {
  let s = p.trim();
  // 1) '/' ile ayrılmış path parametrelerini ":p" yap (önünde slash ZORUNLU):
  //    "/${id}" ve "/{id}" → "/:p"  (içinde '/' ve backtick olmayan, '}' ile kapanan blok)
  s = s.replace(/\/\$\{[^`}/]*\}/g, "/:p").replace(/\/\{[^}/]*\}/g, "/:p");
  // 2) geriye kalan ilk "${", "`", "?", "#" → path burada biter (query/koşul), gerisini at
  const cut = s.search(/[?#`]|\$\{/);
  if (cut !== -1) s = s.slice(0, cut);
  // 3) temizle
  s = s.replace(/\/{2,}/g, "/").trim();
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

function backendRegisteredPaths() {
  let out = "";
  try {
    out = execFileSync(
      "grep",
      ["-rhoE", "--exclude-dir=node_modules", "\"[A-Z]+ /[^\"]*\"", "infra/lambda/src"],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch (err) {
    if (err.status !== 1) throw err;
  }
  const paths = new Set();
  const re = /"([A-Z]+) (\/[^"]*)"/g;
  let m;
  while ((m = re.exec(out)) !== null) paths.add(normalize(m[2]));
  return paths;
}

function clientCalledPaths() {
  const src = read("apps/web/app/lib/api-client.ts");
  const paths = new Set();
  const re = /apiFetch\s*(?:<[^>]*>)?\s*\(\s*[`"](\/[A-Za-z0-9_\-/${}().,:?#&=]*)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const n = normalize(m[1]);
    if (n && n.startsWith("/")) paths.add(n);
  }
  return paths;
}

// Bilinen mimari istisnalar (drift DEĞİL). Her giriş gerekçeli.
const ALLOWLIST = new Map([
  [
    "/shares/:p",
    "GET /shares/{code} ayrı public paylaşım mekanizması; üretim tarafı routes/index.ts 'POST /routes/{id}/share'. Backend'e GET /shares/{code} eklenirse bu satırı sil.",
  ],
]);

test("route-sözleşme: api-client path literalleri çıkarılabiliyor", () => {
  assert.ok(clientCalledPaths().size > 0, "api-client'tan path çıkmadı — regex bozuk.");
});

test("route-sözleşme: backend path'leri çıkarılabiliyor (literal + obje-anahtarı)", () => {
  const backend = backendRegisteredPaths();
  assert.ok(backend.size > 0, "backend'den path çıkmadı — grep/regex bozuk.");
  assert.ok(backend.has("/routes"), "beklenen /routes bulunamadı");
  assert.ok(backend.has("/admin/metrics"), "beklenen /admin/metrics bulunamadı");
});

test("route-sözleşme: client'ın çağırdığı her path backend'de kayıtlı (segment-toleranslı)", () => {
  const client = clientCalledPaths();
  const backend = backendRegisteredPaths();

  function known(cp) {
    if (backend.has(cp)) return true;
    for (const bp of backend) {
      if (bp.startsWith(cp + "/") || cp.startsWith(bp + "/")) return true;
    }
    return false;
  }

  const orphans = [...client].filter((cp) => !known(cp) && !ALLOWLIST.has(cp));
  assert.deepEqual(
    orphans,
    [],
    `api-client şu path'leri çağırıyor ama backend'de "METHOD /path" olarak kayıtlı DEĞİL ` +
      `(route drift → runtime 404): ${JSON.stringify(orphans)}. İki tarafı hizala veya gerekçeyle ALLOWLIST'e ekle.`,
  );
});

test("route-sözleşme: ALLOWLIST güncel — listelenen istisna hâlâ backend'de yok", () => {
  const backend = backendRegisteredPaths();
  const stale = [...ALLOWLIST.keys()].filter((cp) => backend.has(cp));
  assert.deepEqual(
    stale,
    [],
    `ALLOWLIST artık geçersiz: bu path'ler backend'de kayıtlı → sil: ${JSON.stringify(stale)}`,
  );
});
