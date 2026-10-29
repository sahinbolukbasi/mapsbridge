// Mimari Drift-Guard Testi
// -------------------------
// Amaç: steering dokümanlarının (`.kiro/steering/*`) ve AUDIT.md'nin DİSKTEKİ GERÇEKTEN
// sessizce sapmasını engellemek. Bu test diskten gerçeği türetir ve steering beyanlarıyla
// karşılaştırır. Fark varsa KIRMIZI olur — böylece bir servis/paket eklenir/silinir veya
// sınır erozyonu artarsa CI yakalar.
//
// Kaynak karar: .agents/tasks/selfdev-build-2026-10-28/PLAN.md (FAZ 1 / adım 2)
// Tek doğruluk kaynağı: .kiro/steering/architecture-truth.md
//
// Konvansiyon: node:test + node:assert/strict, CommonJS. `npm run test:backend` bunu toplar.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, readdirSync, existsSync, statSync } = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "../../..");

function listDirs(rel) {
  const abs = path.join(repoRoot, rel);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((n) => !n.startsWith("."))
    .filter((n) => {
      try {
        return statSync(path.join(abs, n)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

function read(rel) {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

// grep benzeri: deseni belirli bir alanda ara, eşleşen DOSYA listesini döndür.
// Tüm node_modules dizinlerini (iç içe dahil) hariç tut → hızlı + doğru.
// searchDir göreli (repoRoot'a) verilir.
function grepFiles(pattern, searchDir) {
  try {
    const out = execFileSync(
      "grep",
      [
        "-rln",
        "--exclude-dir=node_modules",
        "--exclude-dir=.next",
        "--exclude-dir=dist",
        "--exclude-dir=out",
        "--exclude-dir=.git",
        pattern,
        searchDir,
      ],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    // grep çıktısı iç içe node_modules'ı da yakalayabilir (--exclude-dir yalnızca adı eşler, bu doğru);
    // yine de güvenlik için node_modules içeren yolları ayıkla.
    return out
      .split("\n")
      .filter(Boolean)
      .filter((p) => !p.includes("node_modules/"));
  } catch (err) {
    if (err.status === 1) return []; // eşleşme yok
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 1. SERVİS ENVANTERİ — steering structure.md diskle eşleşmeli
// ---------------------------------------------------------------------------
test("drift-guard: services/ klasörleri steering ile birebir eşleşir", () => {
  const actual = listDirs("services");
  const expected = [
    "ai-assistant",
    "identity-billing",
    "messaging",
    "place-intelligence",
  ];
  assert.deepEqual(
    actual,
    expected,
    `services/ diskte [${actual}] ama beklenen [${expected}]. ` +
      `Bir servis eklendi/silindiyse .kiro/steering/structure.md + architecture-truth.md GÜNCELLE, sonra bu testi güncelle.`,
  );
});

// ---------------------------------------------------------------------------
// 2. PAKET ENVANTERİ — steering structure.md diskle eşleşmeli
// ---------------------------------------------------------------------------
test("drift-guard: packages/ klasörleri steering ile birebir eşleşir", () => {
  const actual = listDirs("packages");
  // HEDEF: ileride packages/ai-core eklenecek (PLAN FAZ2 R3). Eklenince bu listeyi güncelle.
  const expected = ["contracts"];
  assert.deepEqual(
    actual,
    expected,
    `packages/ diskte [${actual}] ama beklenen [${expected}]. ` +
      `Paket eklendi/silindiyse structure.md + architecture-truth.md GÜNCELLE (ör. ai-core eklenince).`,
  );
});

// ---------------------------------------------------------------------------
// 3. DEAD/LIVE SERVİS İDDİALARI — architecture-truth.md ile tutarlı
//    Not: src ağaçlarında ararız (node_modules hariç), bu yüzden hızlı.
// ---------------------------------------------------------------------------
test("drift-guard: identity-billing ÖLÜ kalır (canlı import yok)", () => {
  const live = [
    ...grepFiles("identity-billing", "infra/lambda/src"),
    ...grepFiles("identity-billing", "apps/web/app"),
    ...grepFiles("identity-billing", "apps/web/server"),
  ];
  assert.equal(
    live.length,
    0,
    `identity-billing artık import ediliyor: [${live}]. ` +
      `architecture-truth.md onu ÖLÜ sayıyor. Canlandıysa truth dosyasını güncelle; yoksa importu kaldır.`,
  );
});

test("drift-guard: messaging ve place-intelligence CANLI kalır", () => {
  const messaging = grepFiles("services/messaging", "infra/lambda/src");
  const places = grepFiles("services/place-intelligence", "infra/lambda/src");
  assert.ok(
    messaging.length > 0,
    "services/messaging canlı import beklenir (chat/index.ts). Kesildiyse architecture-truth.md güncelle.",
  );
  assert.ok(
    places.length > 0,
    "services/place-intelligence canlı import beklenir (places/index.ts). Kesildiyse architecture-truth.md güncelle.",
  );
});

// ---------------------------------------------------------------------------
// 4. SINIR EROZYONU — lambda -> apps/web ters-yön importu ARTMAMALI
//    Baseline = 6 dosya (architecture-truth.md §2). PLAN FAZ2 R4'te 0'a inecek.
// ---------------------------------------------------------------------------
test("drift-guard: lambda->apps/web ters-yön import sayısı baseline'ı AŞMAZ", () => {
  const BASELINE = 6;
  const files = grepFiles("apps/web", "infra/lambda/src");
  assert.ok(
    files.length <= BASELINE,
    `infra/lambda/src -> apps/web import ${files.length} dosyada (baseline ${BASELINE}). ARTMIŞ: [${files}]. ` +
      `Backend frontend'e bağımlı olamaz (architecture-truth.md §5). Yeni ters-yön import ekleme.`,
  );
  if (files.length < BASELINE) {
    // eslint-disable-next-line no-console
    console.log(
      `[drift-guard] iyi haber: ters-yön import ${files.length} < baseline ${BASELINE}. ` +
        `architecture-truth.md §2 ve bu testteki BASELINE'ı ${files.length}'e düşür.`,
    );
  }
});

// ---------------------------------------------------------------------------
// 5. STEERING SELF-CHECK — danger-zones.md'de adı geçen her dosya + test gerçekten var
// ---------------------------------------------------------------------------
test("drift-guard: danger-zones.md'deki tüm kod ve test dosyaları diskte var", () => {
  const dz = read(".kiro/steering/danger-zones.md");
  const pathRe = /`([a-zA-Z0-9_./-]+\.(?:ts|cjs))`/g;
  const referenced = new Set();
  let m;
  while ((m = pathRe.exec(dz)) !== null) {
    const p = m[1];
    if (/^(infra|apps|services|packages)\//.test(p)) referenced.add(p);
  }
  assert.ok(
    referenced.size > 0,
    "danger-zones.md'de hiç dosya yolu bulunamadı — regex bozulmuş olabilir.",
  );
  const missing = [...referenced].filter(
    (p) => !existsSync(path.join(repoRoot, p)),
  );
  assert.deepEqual(
    missing,
    [],
    `danger-zones.md var olmayan dosyalara atıf yapıyor: [${missing}]. ` +
      `Dosya taşındı/silindiyse danger-zones.md'yi güncelle.`,
  );
});

// ---------------------------------------------------------------------------
// 6. CHAT GSI1 — Terraform'da tanımlı (danger-zones #5 düzeltmesinin kanıtı)
// ---------------------------------------------------------------------------
test("drift-guard: chat GSI1 Terraform'da tanımlı kalır", () => {
  const tf = read("infra/terraform/hosting.tf");
  assert.ok(
    /GSI1/.test(tf) && /GSI1PK/.test(tf) && /GSI1SK/.test(tf),
    "hosting.tf'de GSI1/GSI1PK/GSI1SK bulunamadı. Chat endpoint GSI1'e dayanıyor (danger-zones #5). " +
      "GSI kaldırıldıysa chat endpoint'i kırılır — DURUP değerlendir.",
  );
});

// ---------------------------------------------------------------------------
// 7. architecture-truth.md VARLIK — tek doğruluk kaynağı silinmemeli
// ---------------------------------------------------------------------------
test("drift-guard: architecture-truth.md mevcut (tek doğruluk kaynağı)", () => {
  assert.ok(
    existsSync(path.join(repoRoot, ".kiro/steering/architecture-truth.md")),
    "architecture-truth.md silinmiş. Bu dosya drift-guard'ın referansı — silinmemeli.",
  );
});
