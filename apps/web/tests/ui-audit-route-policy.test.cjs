// ui-audit istek politikası: Leaflet unpkg → yerel dosya, diğer external → abort (design R5-3).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../../..");

function decide(url, extra = {}) {
  const script = `
    import { decide } from "./scripts/ui-audit/route-policy.ts";
    const opts = { baseOrigin: "http://127.0.0.1:4100", allowExternal: false, leafletDist: "/dist", ...${JSON.stringify(extra)} };
    console.log(JSON.stringify(decide(${JSON.stringify(url)}, opts)));
  `;
  const r = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--input-type=module",
      "-e",
      script,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test("yerel istekler devam eder", () => {
  assert.deepEqual(decide("http://127.0.0.1:4100/maps/"), { action: "continue" });
});

test("Leaflet unpkg dosyaları node_modules'tan servis edilir", () => {
  assert.deepEqual(decide("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"), {
    action: "fulfill-file",
    path: path.join("/dist", "leaflet.css"),
  });
  assert.deepEqual(decide("https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"), {
    action: "fulfill-file",
    path: path.join("/dist", "images/marker-icon.png"),
  });
});

test("diğer external istekler ve dizin kaçışları engellenir", () => {
  assert.deepEqual(decide("https://tile.openstreetmap.org/1/1/1.png"), { action: "abort" });
  assert.deepEqual(decide("https://unpkg.com/leaflet@1.9.5/dist/leaflet.css"), { action: "abort" });
  assert.deepEqual(decide("https://unpkg.com/leaflet@1.9.4/dist/%2e%2e/package.json"), {
    action: "abort",
  });
});

test("unlayer: yerel _next/static CSS katmansız servis edilir (Rev 6 K1)", () => {
  assert.deepEqual(decide("http://127.0.0.1:4100/_next/static/chunks/a.css", { unlayer: true }), {
    action: "fulfill-unlayered",
  });
});

test("unlayer: yerel .js isteği devam eder", () => {
  assert.deepEqual(decide("http://127.0.0.1:4100/_next/static/chunks/a.js", { unlayer: true }), {
    action: "continue",
  });
});

test("unlayer: başka origin'deki .css engellenir", () => {
  assert.deepEqual(decide("https://example.com/_next/static/chunks/a.css", { unlayer: true }), {
    action: "abort",
  });
});

test("unlayer kapalıyken yerel .css devam eder", () => {
  assert.deepEqual(decide("http://127.0.0.1:4100/_next/static/chunks/a.css", { unlayer: false }), {
    action: "continue",
  });
});

test("--allow-external her şeye izin verir", () => {
  assert.deepEqual(decide("https://example.com/x", { allowExternal: true }), {
    action: "continue",
  });
});
