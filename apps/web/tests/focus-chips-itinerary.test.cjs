"use strict";
/**
 * Faz 2 tests — Focus, AnsweredSlots, Context Chips, Itinerary Actions
 *
 * Critical invariants:
 *  §12.1 — focus updates correctly from message content and map events
 *  §12.1 — anaphora ("burası") resolves to active focus label
 *  §12.2 — chips are focus-aware, max 4, never static
 *  §12.5 — itinerary tool calls parsed correctly
 *  §12.5.3 — consistency guard blocks "ekledim" without mutation
 *  §2.1  — answered slots accumulate; same slot not re-asked
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function loadTs(relPath) {
  const absPath = path.resolve(__dirname, "..", relPath);
  const cache = new Map();

  function loadFile(filepath) {
    if (cache.has(filepath)) return cache.get(filepath).exports;
    const mod = { exports: {} };
    cache.set(filepath, mod);
    const src = readFileSync(filepath, "utf8");
    const code = transformSync(src, { loader: "ts", format: "cjs" }).code;
    const fileDir = path.dirname(filepath);
    const ctx = vm.createContext({
      require: (id) => {
        if (id.startsWith("./") || id.startsWith("../")) {
          const candidates = [
            path.resolve(fileDir, id) + ".ts",
            path.resolve(fileDir, id, "index.ts"),
          ];
          for (const c of candidates) {
            try {
              return loadFile(c);
            } catch {}
          }
          throw new Error(`Cannot resolve ${id} from ${filepath}`);
        }
        if (id === "node:crypto") return require("node:crypto");
        return require(id);
      },
      module: mod,
      exports: mod.exports,
      __dirname: fileDir,
      __filename: filepath,
      process,
      console,
      URL,
      URLSearchParams,
    });
    vm.runInContext(code, ctx);
    return mod.exports;
  }

  return loadFile(absPath);
}

// ---------------------------------------------------------------------------
// Load modules
// ---------------------------------------------------------------------------

const focusMgr = loadTs("app/lib/ai/focus-manager.ts");
const contextChips = loadTs("app/lib/ai/context-chips.ts");
const itineraryActions = loadTs("app/lib/ai/itinerary-actions.ts");

// ---------------------------------------------------------------------------
// §12.1 Focus management
// ---------------------------------------------------------------------------

describe("Focus manager", () => {
  test("defaultFocus returns trip scope", () => {
    const f = focusMgr.defaultFocus(1);
    assert.equal(f.scope, "trip");
    assert.equal(f.sinceTurn, 1);
  });

  test("updateFocus: day reference in message sets day scope", () => {
    const prev = focusMgr.defaultFocus(1);
    const f = focusMgr.updateFocus({
      message: "3. gün için ne planlayabiliriz?",
      previousFocus: prev,
      turn: 2,
    });
    assert.equal(f.scope, "day");
    assert.equal(f.refId, "3");
    assert.equal(f.sinceTurn, 2);
  });

  test("updateFocus: map event overrides message", () => {
    const prev = focusMgr.defaultFocus(1);
    const f = focusMgr.updateFocus({
      message: "bütçe hakkında",
      mapEvent: { type: "place", refId: "p_123", label: "Tazza d'Oro" },
      previousFocus: prev,
      turn: 3,
    });
    assert.equal(f.scope, "place");
    assert.equal(f.refId, "p_123");
    assert.equal(f.label, "Tazza d'Oro");
  });

  test("updateFocus: known place in message sets place scope", () => {
    const prev = focusMgr.defaultFocus(1);
    const f = focusMgr.updateFocus({
      message: "Prado Müzesi ne kadar sürer?",
      mentionedPlaces: [{ id: "prado_01", name: "Prado Müzesi" }],
      previousFocus: prev,
      turn: 2,
    });
    assert.equal(f.scope, "place");
    assert.equal(f.refId, "prado_01");
    assert.equal(f.label, "Prado Müzesi");
  });

  test("updateFocus: anaphora keeps previous focus", () => {
    const prev = {
      scope: "place",
      refId: "cafe_01",
      label: "Nomad Coffee",
      sinceTurn: 2,
      updatedAt: new Date().toISOString(),
    };
    const f = focusMgr.updateFocus({
      message: "burası kalabalık mı oluyor?",
      previousFocus: prev,
      turn: 3,
    });
    // Anaphora — keep same focus
    assert.equal(f.scope, "place");
    assert.equal(f.refId, "cafe_01");
  });

  test('resolveAnaphora replaces "burası" with focus label', () => {
    const focus = {
      scope: "place",
      refId: "cafe_01",
      label: "Nomad Coffee",
      sinceTurn: 1,
      updatedAt: new Date().toISOString(),
    };
    const resolved = focusMgr.resolveAnaphora("burası çok kalabalık mı?", focus);
    assert.match(resolved, /Nomad Coffee/);
  });

  test("resolveAnaphora no-ops when no anaphora", () => {
    const focus = { scope: "place", refId: "x", label: "Louvre", sinceTurn: 1, updatedAt: "" };
    const msg = "Prado hakkında bilgi ver";
    assert.equal(focusMgr.resolveAnaphora(msg, focus), msg);
  });

  test("focusToPromptSnippet returns non-empty string for every scope", () => {
    const scopes = ["trip", "day", "place", "topic"];
    for (const scope of scopes) {
      const f = { scope, refId: "x", label: "Test", sinceTurn: 1, updatedAt: "" };
      const snippet = focusMgr.focusToPromptSnippet(f);
      assert.ok(
        typeof snippet === "string" && snippet.length > 0,
        `Empty snippet for scope ${scope}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// §12.2 Context chips
// ---------------------------------------------------------------------------

describe("Context chips", () => {
  const baseState = {
    destination: "Barcelona",
    interests: { food: ["tapas"] },
    decisions: [],
    rejections: [],
  };

  test("returns max 4 chips", () => {
    const focus = { scope: "trip", sinceTurn: 1, updatedAt: "" };
    const chips = contextChips.generateContextChips(focus, baseState);
    assert.ok(chips.length <= 4, `Got ${chips.length} chips — max is 4`);
    assert.ok(chips.length > 0);
  });

  test("place-focus chips reference the place name", () => {
    const focus = {
      scope: "place",
      refId: "sagrada_01",
      label: "Sagrada Família",
      sinceTurn: 2,
      updatedAt: "",
    };
    const chips = contextChips.generateContextChips(focus, baseState);
    const allPromptsIncludeName = chips.every((c) => c.prompt.includes("Sagrada Família"));
    assert.ok(allPromptsIncludeName, "All place chips should reference the place name");
  });

  test("day-focus chips reference the day label", () => {
    const focus = { scope: "day", refId: "2", label: "2. Gün", sinceTurn: 3, updatedAt: "" };
    const chips = contextChips.generateContextChips(focus, baseState);
    assert.ok(chips.some((c) => c.prompt.includes("2. Gün")));
  });

  test("trip-focus includes visa chip when destination set", () => {
    const focus = { scope: "trip", sinceTurn: 1, updatedAt: "" };
    const chips = contextChips.generateContextChips(focus, baseState);
    assert.ok(chips.some((c) => c.prompt.toLowerCase().includes("vize")));
  });

  test("chip labels are non-empty strings", () => {
    const focus = { scope: "trip", sinceTurn: 1, updatedAt: "" };
    const chips = contextChips.generateContextChips(focus, baseState);
    chips.forEach((c) => {
      assert.ok(c.label.length > 0);
      assert.ok(c.prompt.length > 0);
    });
  });
});

// ---------------------------------------------------------------------------
// §12.5 Itinerary actions
// ---------------------------------------------------------------------------

describe("Itinerary action parsing", () => {
  test("parses itinerary.add tool call", () => {
    const calls = [
      {
        name: "itinerary.add",
        input: { placeId: "p_001", placeName: "Prado Müzesi", dayIndex: 2, durationMin: 120 },
      },
    ];
    const actions = itineraryActions.parseItineraryToolCalls(calls);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].type, "itinerary.add");
    assert.equal(actions[0].placeId, "p_001");
    assert.equal(actions[0].dayIndex, 2);
  });

  test("parses itinerary.remove tool call", () => {
    const calls = [
      {
        name: "itinerary.remove",
        input: { placeId: "p_002", placeName: "Reina Sofía", reason: "kapalı" },
      },
    ];
    const actions = itineraryActions.parseItineraryToolCalls(calls);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].type, "itinerary.remove");
    assert.equal(actions[0].reason, "kapalı");
  });

  test("parses itinerary.reorder tool call", () => {
    const calls = [
      {
        name: "itinerary.reorder",
        input: { dayIndex: 1, orderedPlaceIds: ["p_003", "p_001", "p_002"] },
      },
    ];
    const actions = itineraryActions.parseItineraryToolCalls(calls);
    assert.equal(actions.length, 1);
    assert.deepEqual(actions[0].orderedPlaceIds, ["p_003", "p_001", "p_002"]);
  });

  test("ignores unknown tool calls", () => {
    const calls = [{ name: "unknown.tool", input: { foo: "bar" } }];
    const actions = itineraryActions.parseItineraryToolCalls(calls);
    assert.equal(actions.length, 0);
  });

  test("rejects malformed add call (missing placeId)", () => {
    const calls = [{ name: "itinerary.add", input: { placeName: "Uffizi" } }];
    const actions = itineraryActions.parseItineraryToolCalls(calls);
    assert.equal(actions.length, 0);
  });
});

// ---------------------------------------------------------------------------
// §12.5.3 Mutation consistency guard
// ---------------------------------------------------------------------------

describe("Mutation consistency guard", () => {
  test('detectMutationClaim: detects "rotaya ekledim"', () => {
    assert.ok(itineraryActions.detectMutationClaim("Prado'yu rotaya ekledim."));
  });

  test('detectMutationClaim: detects "plana ekledim"', () => {
    assert.ok(itineraryActions.detectMutationClaim("Bu mekanı plana ekledim."));
  });

  test("detectMutationClaim: does not flag neutral text", () => {
    assert.ok(!itineraryActions.detectMutationClaim("Prado hakkında bilgi verebilirim."));
  });

  test("assertMutationConsistency: returns error when claim but no mutation", () => {
    const err = itineraryActions.assertMutationConsistency("Rotaya ekledim.", false);
    assert.ok(err !== null);
    assert.match(err, /MUTATION_CLAIM_WITHOUT_DB_WRITE/);
  });

  test("assertMutationConsistency: no error when claim + mutation applied", () => {
    const err = itineraryActions.assertMutationConsistency("Rotaya ekledim.", true);
    assert.equal(err, null);
  });

  test("assertMutationConsistency: no error when no claim, no mutation", () => {
    const err = itineraryActions.assertMutationConsistency("Bu yer çok güzel.", false);
    assert.equal(err, null);
  });
});

// ---------------------------------------------------------------------------
// §12.5 buildConfirmationMessage
// ---------------------------------------------------------------------------

describe("Confirmation messages", () => {
  test("add confirmation includes place name and day", () => {
    const msg = itineraryActions.buildConfirmationMessage({
      type: "itinerary.add",
      placeId: "p1",
      placeName: "Uffizi",
      dayIndex: 3,
      addedVia: "chat",
    });
    assert.match(msg, /Uffizi/);
    assert.match(msg, /3/);
  });

  test("remove confirmation is undoable", () => {
    const msg = itineraryActions.buildConfirmationMessage({
      type: "itinerary.remove",
      placeId: "p1",
      placeName: "Louvre",
    });
    assert.match(msg, /geri al/i);
  });
});
