// Faz 1 / görev 5 — RAG timeout degradasyonu (I7 bütçe korunumu).
// Doğrular:
//   1) retrieval.ts, client.send'e 3000ms'lik bir AbortSignal.timeout GEÇİRİR (I7 bütçesi).
//   2) Timeout/abort hatasında status "unavailable" + passages [] döner (asla çökmez).
//   3) "unavailable" uzak sonuç + dolu yerel korpus → mergeEvidence fallback'i ile
//      status "available" olur; yani RAG düşse de yanıt kaynaklı kalır (grounding sürer).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

// retrieval.ts'i, send çağrısına geçen abortSignal'i YAKALAYAN bir Bedrock stub ile yükler.
function loadRetrieval({ throwAbort = false } = {}) {
  const captured = { abortSignalTimeoutMs: null, aborted: false };
  const cache = new Map();
  function loadFile(file) {
    const filename = path.resolve(file);
    if (cache.has(filename)) return cache.get(filename);
    if (filename.endsWith(".json")) {
      const json = JSON.parse(fs.readFileSync(filename, "utf8"));
      cache.set(filename, json);
      return json;
    }
    const module = { exports: {} };
    cache.set(filename, module.exports);
    // AbortSignal.timeout'u sarmalayıp çağrılan süreyi yakala.
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    const PatchedAbortSignal = {
      timeout(ms) {
        captured.abortSignalTimeoutMs = ms;
        return realTimeout(ms);
      },
    };
    vm.runInNewContext(
      transformSync(fs.readFileSync(filename, "utf8"), { loader: "ts", format: "cjs" }).code,
      {
        module,
        exports: module.exports,
        URL,
        AbortSignal: PatchedAbortSignal,
        process: { env: { TRAVEL_KNOWLEDGE_BASE_ID: "test-kb", AWS_REGION: "eu-central-1" } },
        console: { warn() {}, error() {}, log() {} },
        require: (spec) => {
          if (spec.startsWith("@aws-sdk"))
            return {
              BedrockAgentRuntimeClient: class {
                async send(_cmd, opts) {
                  // Gerçek handler'ın abortSignal geçirip geçirmediğini doğrula.
                  if (opts?.abortSignal) captured.aborted = true;
                  if (throwAbort) {
                    const err = new Error("Request aborted");
                    err.name = "TimeoutError";
                    throw err;
                  }
                  return { retrievalResults: [] };
                }
              },
              RetrieveCommand: class {
                constructor(i) {
                  this.input = i;
                }
              },
            };
          if (spec.startsWith(".")) {
            const base = path.resolve(path.dirname(filename), spec);
            return loadFile(spec.endsWith(".json") ? base : base + ".ts");
          }
          return require(spec);
        },
      },
      { filename },
    );
    cache.set(filename, module.exports);
    return module.exports;
  }
  const mod = loadFile(path.resolve(__dirname, "../app/lib/ai/retrieval.ts"));
  return { ...mod, captured };
}

function loadBundled() {
  const cache = new Map();
  function loadFile(file) {
    const filename = path.resolve(file);
    if (cache.has(filename)) return cache.get(filename);
    if (filename.endsWith(".json")) return JSON.parse(fs.readFileSync(filename, "utf8"));
    const module = { exports: {} };
    cache.set(filename, module.exports);
    vm.runInNewContext(
      transformSync(fs.readFileSync(filename, "utf8"), { loader: "ts", format: "cjs" }).code,
      {
        module,
        exports: module.exports,
        URL,
        console: { warn() {}, log() {} },
        require: (spec) => {
          if (spec.startsWith(".")) {
            const base = path.resolve(path.dirname(filename), spec);
            return loadFile(spec.endsWith(".json") ? base : base + ".ts");
          }
          return require(spec);
        },
      },
      { filename },
    );
    cache.set(filename, module.exports);
    return module.exports;
  }
  return loadFile(path.resolve(__dirname, "../app/lib/ai/bundled-evidence.ts"));
}

test("retrieval, send'e 3000ms AbortSignal.timeout geçirir (I7 bütçesi)", async () => {
  const h = loadRetrieval();
  await h.retrieveTravelEvidence({ prompt: "Roma yemek", researchDestination: "Roma" });
  assert.equal(h.captured.aborted, true, "abortSignal geçirilmeli");
  assert.equal(h.captured.abortSignalTimeoutMs, 3000, "timeout tam 3000ms olmalı");
});

test("timeout/abort hatasında status 'unavailable' döner, çökmez", async () => {
  const h = loadRetrieval({ throwAbort: true });
  const result = await h.retrieveTravelEvidence({ prompt: "Roma yemek" });
  assert.equal(result.status, "unavailable");
  assert.equal(result.passages.length, 0);
});

test("RAG 'unavailable' + yerel korpus → mergeEvidence fallback ile 'available' (grounding sürer)", () => {
  const { mergeEvidence, bundledEvidence } = loadBundled();
  // RAG düştü (unavailable). Yerel korpus Roma yemek için dolu.
  const remote = { status: "unavailable", passages: [] };
  const local = bundledEvidence({ prompt: "Roma yemek öner" }, Date.parse("2026-11-01"));
  assert.equal(local.status, "available"); // yerel korpus gerçekten dolu
  const merged = mergeEvidence(remote, local);
  assert.equal(merged.status, "available", "RAG düşse de yerel kanıtla available olmalı");
  assert.ok(merged.passages.length >= 1);
  assert.equal(merged.counts.remote, 0);
  assert.ok(merged.counts.local >= 1);
});

test("RAG 'unavailable' + yerel korpus da boş → status 'unavailable' korunur", () => {
  const { mergeEvidence } = loadBundled();
  const merged = mergeEvidence(
    { status: "unavailable", passages: [] },
    { status: "empty", passages: [] },
  );
  assert.equal(merged.status, "unavailable");
  assert.equal(merged.passages.length, 0);
});
