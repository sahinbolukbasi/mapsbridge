/**
 * Faz 7 + Faz 8 tests:
 *  - kb-store (entity CRUD, TTL, conflict resolution, pruning, prompt snippet)
 *  - research-queue (enqueue, dequeue, priority, lifecycle, dedup)
 *  - grounding-validator (price/time/rule tags, high-risk phrases, no-source warning)
 *  - visa/rules (new destinations: Rome, Amsterdam, London, New York, Tokyo)
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// ── Module loader (TypeScript → CJS via typescript transpileModule) ───────────

function loadModule(absolutePath) {
  const ts = require("typescript");
  const code = fs.readFileSync(absolutePath, "utf8");
  const transformed = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const mod = { exports: {} };
  const dir = path.dirname(absolutePath);

  const customRequire = (spec) => {
    if (spec.startsWith(".")) {
      const candidates = [
        path.resolve(dir, spec),
        path.resolve(dir, spec + ".ts"),
        path.resolve(dir, spec + "/index.ts"),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return loadModule(c);
      }
    }
    // Built-in node: prefix modules and npm packages
    return require(spec);
  };

  const fn = new Function("require", "exports", "module", "__filename", "__dirname", transformed);
  fn(customRequire, mod.exports, mod, absolutePath, dir);
  return mod.exports;
}

const AI_LIB = path.resolve(__dirname, "../app/lib/ai");
const VISA_LIB = path.resolve(__dirname, "../app/lib/visa");

const kbStore = loadModule(path.join(AI_LIB, "knowledge-base/kb-store.ts"));
const researchQueue = loadModule(path.join(AI_LIB, "knowledge-base/research-queue.ts"));
const groundingValidator = loadModule(path.join(AI_LIB, "grounding-validator.ts"));
const visaRules = loadModule(path.join(VISA_LIB, "rules.ts"));

// ── KB Store tests ────────────────────────────────────────────────────────────

function makeEntity(overrides = {}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: "test-entity-1",
    type: "place",
    country: "Italy",
    city: "Rome",
    name: "Colosseum",
    geo: { lat: 41.8902, lng: 12.4922 },
    payload: { category: "landmark", admission: "€18" },
    confidence: 0.95,
    ttlDays: 90,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt,
    ...overrides,
  };
}

test("createKBStore returns empty store", () => {
  const store = kbStore.createKBStore();
  assert.equal(store.entities instanceof Map, true);
  assert.equal(store.entities.size, 0);
  assert.equal(store.sources instanceof Map, true);
  assert.equal(store.conflicts instanceof Map, true);
});

test("upsertEntity is immutable and getEntity retrieves the entity", () => {
  const store = kbStore.createKBStore();
  const entity = makeEntity();
  const updated = kbStore.upsertEntity(store, entity);

  // Original store unmodified
  assert.equal(store.entities.size, 0);
  assert.equal(updated.entities.size, 1);

  const found = kbStore.getEntity(updated, "test-entity-1");
  assert.equal(found.name, "Colosseum");
});

test("getEntitiesForCity returns matching entities and filters by type", () => {
  let store = kbStore.createKBStore();
  store = kbStore.upsertEntity(
    store,
    makeEntity({ id: "e1", city: "Rome", type: "place", name: "Colosseum" }),
  );
  store = kbStore.upsertEntity(
    store,
    makeEntity({ id: "e2", city: "Rome", type: "airport", name: "FCO" }),
  );
  store = kbStore.upsertEntity(
    store,
    makeEntity({ id: "e3", city: "Tokyo", type: "place", name: "Senso-ji" }),
  );

  const romeAll = kbStore.getEntitiesForCity(store, "Rome");
  assert.equal(romeAll.length, 2);

  const romePlaces = kbStore.getEntitiesForCity(store, "Rome", "place");
  assert.equal(romePlaces.length, 1);
  assert.equal(romePlaces[0].name, "Colosseum");

  const tokyo = kbStore.getEntitiesForCity(store, "Tokyo");
  assert.equal(tokyo.length, 1);
});

test("isEntityStale returns true for expired entities and false for fresh ones", () => {
  const fresh = makeEntity({ expiresAt: new Date(Date.now() + 1_000_000).toISOString() });
  const stale = makeEntity({ expiresAt: new Date(Date.now() - 1000).toISOString() });
  const badDate = makeEntity({ expiresAt: "not-a-date" });

  assert.equal(kbStore.isEntityStale(fresh), false);
  assert.equal(kbStore.isEntityStale(stale), true);
  assert.equal(kbStore.isEntityStale(badDate), true);
});

test("addConflict and resolveConflict work correctly", () => {
  let store = kbStore.createKBStore();
  const entity = makeEntity();
  store = kbStore.upsertEntity(store, entity);

  const conflict = {
    id: "c1",
    entityId: entity.id,
    field: "admission",
    values: [
      { value: "€18", sourceId: "s1", reliability: "official" },
      { value: "€16", sourceId: "s2", reliability: "major_publication" },
    ],
  };

  store = kbStore.addConflict(store, conflict);
  assert.equal(store.conflicts.get(entity.id).length, 1);

  store = kbStore.resolveConflict(store, entity.id, "admission", "€18");
  const updatedEntity = kbStore.getEntity(store, entity.id);
  assert.equal(updatedEntity.payload.admission, "€18");

  const resolvedConflict = store.conflicts.get(entity.id)[0];
  assert.equal(resolvedConflict.resolvedBy, "manual");
  assert.equal(typeof resolvedConflict.resolvedAt, "string");
});

test("kbEntityToPromptSnippet contains required fields", () => {
  const entity = makeEntity();
  const snippet = kbStore.kbEntityToPromptSnippet(entity);
  assert.equal(snippet.includes("[KB:PLACE]"), true);
  assert.equal(snippet.includes("Colosseum"), true);
  assert.equal(snippet.includes("Confidence:"), true);
  assert.equal(snippet.includes("Expires:"), true);
});

test("pruneStaleEntities removes expired entities and returns count", () => {
  let store = kbStore.createKBStore();
  store = kbStore.upsertEntity(
    store,
    makeEntity({ id: "fresh", expiresAt: new Date(Date.now() + 1_000_000).toISOString() }),
  );
  store = kbStore.upsertEntity(
    store,
    makeEntity({ id: "stale1", expiresAt: new Date(Date.now() - 1000).toISOString() }),
  );
  store = kbStore.upsertEntity(
    store,
    makeEntity({ id: "stale2", expiresAt: new Date(Date.now() - 2000).toISOString() }),
  );

  const { store: pruned, pruned: count } = kbStore.pruneStaleEntities(store);
  assert.equal(count, 2);
  assert.equal(pruned.entities.size, 1);
  assert.equal(kbStore.getEntity(pruned, "fresh") !== undefined, true);
  assert.equal(kbStore.getEntity(pruned, "stale1"), undefined);
});

// ── Research Queue tests ──────────────────────────────────────────────────────

test("createQueue returns empty queue", () => {
  const q = researchQueue.createQueue();
  assert.equal(Array.isArray(q.jobs), true);
  assert.equal(q.jobs.length, 0);
});

test("enqueueJob adds a pending job", () => {
  const q = researchQueue.createQueue();
  const { queue: q2, job } = researchQueue.enqueueJob(
    q,
    "rome:place:colosseum",
    "high",
    "thread-1",
  );
  assert.equal(q2.jobs.length, 1);
  assert.equal(job.status, "pending");
  assert.equal(job.entityRef, "rome:place:colosseum");
  assert.equal(job.priority, "high");
  assert.equal(job.requestedByThreadId, "thread-1");
  assert.equal(job.retryCount, 0);
});

test("dequeueNext picks highest priority pending job", () => {
  let q = researchQueue.createQueue();
  q = researchQueue.enqueueJob(q, "ref-low", "low").queue;
  q = researchQueue.enqueueJob(q, "ref-normal", "normal").queue;
  q = researchQueue.enqueueJob(q, "ref-high", "high").queue;

  const { queue: q2, job } = researchQueue.dequeueNext(q);
  assert.equal(job.entityRef, "ref-high");
  assert.equal(job.status, "running");
  assert.equal(typeof job.startedAt, "string");

  // Queue still has 3 jobs total, one is now running
  assert.equal(q2.jobs.length, 3);
  const runningJobs = q2.jobs.filter((j) => j.status === "running");
  assert.equal(runningJobs.length, 1);
});

test("dequeueNext returns null when no pending jobs", () => {
  const q = researchQueue.createQueue();
  const { job } = researchQueue.dequeueNext(q);
  assert.equal(job, null);
});

test("markDone and markFailed update job status and retryCount", () => {
  let q = researchQueue.createQueue();
  const { queue: q1, job } = researchQueue.enqueueJob(q, "ref-x", "normal");
  const q2 = researchQueue.markDone(q1, job.id);
  const doneJob = q2.jobs.find((j) => j.id === job.id);
  assert.equal(doneJob.status, "done");
  assert.equal(typeof doneJob.completedAt, "string");

  const q3 = researchQueue.markFailed(q1, job.id, "timeout");
  const failedJob = q3.jobs.find((j) => j.id === job.id);
  assert.equal(failedJob.status, "failed");
  assert.equal(failedJob.error, "timeout");
  assert.equal(failedJob.retryCount, 1);
});

test("shouldEnqueue prevents duplicates for pending/running jobs", () => {
  let q = researchQueue.createQueue();
  assert.equal(researchQueue.shouldEnqueue(q, "ref-dup"), true);

  const { queue: q1 } = researchQueue.enqueueJob(q, "ref-dup", "normal");
  assert.equal(researchQueue.shouldEnqueue(q1, "ref-dup"), false);
  assert.equal(researchQueue.shouldEnqueue(q1, "ref-other"), true);

  const { queue: q2 } = researchQueue.dequeueNext(q1); // → running
  assert.equal(researchQueue.shouldEnqueue(q2, "ref-dup"), false);

  const q3 = researchQueue.markDone(q2, q2.jobs[0].id);
  assert.equal(researchQueue.shouldEnqueue(q3, "ref-dup"), true);
});

test("getJobsForThread returns only jobs for that thread", () => {
  let q = researchQueue.createQueue();
  q = researchQueue.enqueueJob(q, "ref-a", "normal", "thread-A").queue;
  q = researchQueue.enqueueJob(q, "ref-b", "normal", "thread-B").queue;
  q = researchQueue.enqueueJob(q, "ref-c", "low", "thread-A").queue;

  const threadAJobs = researchQueue.getJobsForThread(q, "thread-A");
  assert.equal(threadAJobs.length, 2);
  assert.equal(
    threadAJobs.every((j) => j.requestedByThreadId === "thread-A"),
    true,
  );
});

// ── Grounding Validator tests ─────────────────────────────────────────────────

test("validateGrounding tags price claims when no sources provided", () => {
  const text = "Müze girişi €15 veya $20 tutmaktadır.";
  const result = groundingValidator.validateGrounding(text, []);
  assert.equal(
    result.issues.some((i) => i.type === "unverified_price"),
    true,
  );
  assert.equal(result.sanitizedText.includes("(doğrulanmadı)"), true);
  assert.equal(result.isGrounded, true); // no 'block' severity
});

test("validateGrounding tags time claims when no sources provided", () => {
  const text = "Müze 09:00 ile 17:30 arasında açıktır.";
  const result = groundingValidator.validateGrounding(text, []);
  assert.equal(
    result.issues.some((i) => i.type === "unverified_time"),
    true,
  );
  assert.equal(result.sanitizedText.includes("(doğrulanmadı)"), true);
});

test("validateGrounding always tags high-risk certainty phrases", () => {
  const text = "Bu restoran kesinlikle en iyisidir ve her zaman açık.";
  // Even WITH sources, high-risk phrases should be tagged
  const withSources = [
    { id: "s1", title: "Guide", url: "https://example.com", checkedAt: "2026-09-01" },
  ];
  const result = groundingValidator.validateGrounding(text, withSources);
  assert.equal(result.sanitizedText.includes("(doğrulanmamış)"), true);
  assert.equal(
    result.issues.some((i) => i.claim === "kesinlikle"),
    true,
  );
});

test("validateGrounding adds missing_source issue when text has factual claims and no sources", () => {
  const text = "Vize almadan girilemiyor. Giriş ücreti ₺500.";
  const result = groundingValidator.validateGrounding(text, []);
  assert.equal(
    result.issues.some((i) => i.type === "missing_source"),
    true,
  );
});

test("validateGrounding returns isGrounded=true when no block issues", () => {
  const text = "Güzel bir şehir. Ziyaret etmeyi düşünebilirsiniz.";
  const result = groundingValidator.validateGrounding(text, []);
  assert.equal(result.isGrounded, true);
  assert.equal(result.issues.length, 0);
});

test("extractFactualClaims returns price, time, and rule claims", () => {
  const text = "Giriş €10, açılış 10:00, vize gerekiyor.";
  const claims = groundingValidator.extractFactualClaims(text);
  assert.equal(Array.isArray(claims), true);
  assert.equal(claims.length > 0, true);
  assert.equal(
    claims.some((c) => c.includes("€10") || c.includes("€")),
    true,
  );
  assert.equal(
    claims.some((c) => c.includes("10:00")),
    true,
  );
  assert.equal(
    claims.some((c) => c.toLowerCase().includes("vize")),
    true,
  );
});

test("buildNoSourceWarning returns Turkish disclaimer string", () => {
  const warning = groundingValidator.buildNoSourceWarning();
  assert.equal(typeof warning, "string");
  assert.equal(warning.length > 0, true);
  assert.equal(warning.toLowerCase().includes("uyar"), true);
});

// ── Visa Rules tests ──────────────────────────────────────────────────────────

test("getEntryRule returns correct rule for existing destinations", () => {
  // Existing
  const barcelona = visaRules.getEntryRule("barcelona");
  assert.equal(barcelona.canSurface, true);
  assert.equal(barcelona.rule.destinationIso2, "ES");
  assert.equal(barcelona.rule.requirementLevel, "visa_required");

  const paris = visaRules.getEntryRule("paris");
  assert.equal(paris.canSurface, true);
  assert.equal(paris.rule.destinationIso2, "FR");
});

test("getEntryRule returns Rome (Italy) rule", () => {
  const rome = visaRules.getEntryRule("rome");
  assert.equal(rome.canSurface, true);
  assert.notEqual(rome.rule, null);
  assert.equal(rome.rule.destinationIso2, "IT");
  assert.equal(rome.rule.requirementLevel, "visa_required");
  assert.equal(rome.rule.maxStayDays, 90);
  assert.equal(typeof rome.rule.sourceName, "string");
  assert.equal(rome.rule.sourceName.length > 0, true);
  assert.equal(rome.rule.sourceUrl.startsWith("https://"), true);
});

test("getEntryRule returns Amsterdam (Netherlands) rule", () => {
  const amsterdam = visaRules.getEntryRule("amsterdam");
  assert.equal(amsterdam.canSurface, true);
  assert.equal(amsterdam.rule.destinationIso2, "NL");
  assert.equal(amsterdam.rule.requirementLevel, "visa_required");
  assert.equal(amsterdam.rule.maxStayDays, 90);
});

test("getEntryRule returns London (UK) rule with post-Brexit note", () => {
  const london = visaRules.getEntryRule("london");
  assert.equal(london.canSurface, true);
  assert.equal(london.rule.destinationIso2, "GB");
  assert.equal(london.rule.requirementLevel, "visa_required");
  assert.equal(
    london.rule.notes.some((n) => n.toLowerCase().includes("brexit")),
    true,
  );
  assert.equal(london.rule.sourceUrl.includes("gov.uk"), true);
});

test("getEntryRule returns New York (USA) rule mentioning B-visa", () => {
  const ny = visaRules.getEntryRule("new york");
  assert.equal(ny.canSurface, true);
  assert.equal(ny.rule.destinationIso2, "US");
  assert.equal(ny.rule.requirementLevel, "visa_required");
  assert.equal(
    ny.rule.notes.some((n) => n.includes("B-1/B-2") || n.includes("ESTA")),
    true,
  );
  assert.equal(
    ny.rule.sourceUrl.includes("usembassy.gov") || ny.rule.sourceUrl.includes("state.gov"),
    true,
  );
});

test("getEntryRule returns Tokyo (Japan) rule", () => {
  const tokyo = visaRules.getEntryRule("tokyo");
  assert.equal(tokyo.canSurface, true);
  assert.equal(tokyo.rule.destinationIso2, "JP");
  assert.equal(tokyo.rule.requirementLevel, "visa_required");
  assert.equal(typeof tokyo.rule.sourceName, "string");
  assert.equal(tokyo.rule.disclaimer.length > 0, true);
});

test("getEntryRule returns fallback for unknown destination", () => {
  const unknown = visaRules.getEntryRule("atlantis");
  assert.equal(unknown.canSurface, false);
  assert.equal(unknown.rule, null);
  assert.equal(typeof unknown.fallbackUrl, "string");
});

test("getEntryRulesForPassport TR returns 8 rules (3 existing + 5 new)", () => {
  const rules = visaRules.getEntryRulesForPassport("TR");
  assert.equal(rules.length >= 8, true);
  const isos = rules.map((r) => r.destinationIso2);
  assert.equal(isos.includes("TR"), true);
  assert.equal(isos.includes("ES"), true);
  assert.equal(isos.includes("FR"), true);
  assert.equal(isos.includes("IT"), true);
  assert.equal(isos.includes("NL"), true);
  assert.equal(isos.includes("GB"), true);
  assert.equal(isos.includes("US"), true);
  assert.equal(isos.includes("JP"), true);
});

test("all TR rules have §9.2 mandatory fields populated", () => {
  const rules = visaRules.getEntryRulesForPassport("TR");
  for (const rule of rules) {
    assert.equal(rule.sourceName.trim().length > 0, true, `sourceName empty for ${rule.id}`);
    assert.equal(rule.sourceUrl.trim().length > 0, true, `sourceUrl empty for ${rule.id}`);
    assert.equal(rule.retrievedAt.trim().length > 0, true, `retrievedAt empty for ${rule.id}`);
    assert.equal(rule.disclaimer.trim().length > 0, true, `disclaimer empty for ${rule.id}`);
    assert.equal(rule.sourceUrl.startsWith("https://"), true, `sourceUrl not https for ${rule.id}`);
  }
});
