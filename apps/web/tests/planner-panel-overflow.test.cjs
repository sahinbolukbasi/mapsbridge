// FEAT-001 (B1): /maps/ sol panel düğmeleri sayfayı aşağı uzatıyordu; kök neden CSS
// yükseklik kıstlama eksikliğiydi (eksik button type DEĞİL — tüm planlayıcı <button>'ları
// zaten type taşıyor, Button primitive de type="button" varsayıyor). Bu test kalıcı iki
// sinyali korur:
//   (a) Commit edilen maps.css'te .planner bir blok yükseklik tavanı (block-size +
//       max-block-size) taşır ve tek dikey kaydırma kabı .planner__panel'dir
//       (overflow-y:auto + min-block-size:0). CSS containment düzeltmesi için en küçük
//       dayanıklı imza budur.
//   (b) Planlayıcı kaynaklarında (travel-planner-sidebar.tsx + maps-client.tsx) ham
//       <button> öğelerinin hepsi type= taşır ve amaçlı bir <form onSubmit> dışında
//       type="submit" ham düğme yoktur. (Araç çubuğu salt ui primitive'lerinden kurulu;
//       bu yüzden düğme güvencesi markup kaynağından okunur — kırılgan tam SSR render
//       yerine aynı özelliği doğrulayan dayanıklı imza.)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const APP = path.join(__dirname, "..", "app");
const read = (rel) => fs.readFileSync(path.join(APP, rel), "utf8");

const MAPS_CSS = read("maps/maps.css");

test("(a) maps.css: .planner blok yükseklik tavanı taşır (B1 containment)", () => {
  // İlk satır @layer sırası korunur (design-system §3).
  assert.match(
    MAPS_CSS,
    /^@layer tokens, base, legacy, chrome, pages, primitives;/,
    "ilk satır @layer bildirimi değişmemeli",
  );
  // .planner kuralını ayıkla (bir sonraki selector bloğuna kadar).
  const m = MAPS_CSS.match(/\.planner\s*\{([\s\S]*?)\}/);
  assert.ok(m, ".planner kuralı yok");
  const body = m[1];
  assert.match(body, /block-size:\s*calc\(100dvh/, ".planner block-size tavanı yok");
  assert.match(body, /max-block-size:\s*calc\(100dvh/, ".planner max-block-size tavanı yok");
  assert.match(body, /overflow:\s*hidden/, ".planner overflow:hidden korunmalı");
  assert.match(body, /min-block-size:\s*0/, ".planner min-block-size:0 korunmalı");
});

test("(a) maps.css: .planner__panel tek dikey kaydırma kabı", () => {
  const m = MAPS_CSS.match(/\.planner__panel\s*\{([\s\S]*?)\}/);
  assert.ok(m, ".planner__panel kuralı yok");
  const body = m[1];
  assert.match(body, /overflow-y:\s*auto/, ".planner__panel overflow-y:auto değil");
  assert.match(body, /min-block-size:\s*0/, ".planner__panel min-block-size:0 değil");
  assert.match(
    body,
    /overscroll-behavior:\s*contain/,
    ".planner__panel overscroll-behavior:contain değil",
  );
  // __split artık bağımsız ikinci 100dvh calc yerine kıstlı ebeveynden devralır.
  const split = MAPS_CSS.match(/\.planner__split\s*\{([\s\S]*?)\}/);
  assert.ok(split, ".planner__split kuralı yok");
  assert.match(split[1], /block-size:\s*100%/, ".planner__split block-size:100% olmalı");
});

// Ham <button> öğelerini (primitive <Button> değil) yakala: küçük harf b + sınır.
const RAW_BUTTON = /<button(\s[^>]*?)?>/g;

function rawButtons(src) {
  const out = [];
  for (const m of src.matchAll(RAW_BUTTON)) out.push(m[1] ?? "");
  return out;
}

test("(b) planlayıcı ham <button>'ları type= taşır, submit sızıntısı yok", () => {
  const sidebar = read("components/trip/travel-planner-sidebar.tsx");
  const client = read("maps/maps-client.tsx");

  // maps-client araç çubuğu salt primitive'lerden kurulu: ham <button> olmamalı.
  assert.deepEqual(
    rawButtons(client),
    [],
    "maps-client.tsx'te ham <button> olmamalı (primitive kullan)",
  );

  const sidebarButtons = rawButtons(sidebar);
  assert.ok(
    sidebarButtons.length > 0,
    "sidebar'da en az bir ham <button> beklenir (gün sekmeleri)",
  );
  for (const attrs of sidebarButtons) {
    assert.match(attrs, /\btype=/, `ham <button> type= taşımıyor: <button${attrs}>`);
    assert.doesNotMatch(
      attrs,
      /type=["']submit["']/,
      `ham <button type="submit"> yasak (form dışı): <button${attrs}>`,
    );
  }
});
