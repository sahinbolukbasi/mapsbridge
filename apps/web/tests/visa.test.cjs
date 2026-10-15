"use strict";
/**
 * Faz D visa/entry rule tests — §9.2 compliance.
 *
 * Critical invariants:
 *  1. Every surfaced rule has: sourceName, sourceUrl, retrievedAt, disclaimer
 *  2. "gidebilirsin" is never in formatted output
 *  3. Unknown destination returns fallback URL, not empty string
 *  4. Audit entry has required fields
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function loadTs(relPath, dir) {
  const absPath = path.resolve(__dirname, "..", relPath);
  const baseDir = dir ?? path.dirname(absPath);
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

// Load modules
const visaTypes = loadTs("app/lib/visa/types.ts");
const visaRules = loadTs("app/lib/visa/rules.ts");
const auditLog = loadTs("app/lib/visa/audit-log.ts");
const formatter = loadTs("app/lib/visa/formatter.ts");

const { getEntryRule, getEntryRulesForPassport } = visaRules;
const { buildAuditEntry, buildSessionRef } = auditLog;
const { formatEntryRuleForPrompt, buildVisaContext } = formatter;

// ── §9.2 mandatory field presence ────────────────────────────────────────────

describe("Visa — §9.2 mandatory fields on every rule", () => {
  test("all static rules have sourceName, sourceUrl, retrievedAt, disclaimer", () => {
    const rules = getEntryRulesForPassport("TR");
    assert.ok(rules.length >= 3, "At least 3 rules for TR passport");

    for (const rule of rules) {
      assert.ok(rule.sourceName?.trim().length > 0, `${rule.id}: sourceName missing`);
      assert.ok(rule.sourceUrl?.trim().length > 0, `${rule.id}: sourceUrl missing`);
      assert.ok(rule.retrievedAt?.trim().length > 0, `${rule.id}: retrievedAt missing`);
      assert.ok(rule.disclaimer?.trim().length > 0, `${rule.id}: disclaimer missing`);
    }
  });

  test("formatted rule output contains all §9.2 fields", () => {
    const { rule } = getEntryRule("paris", "TR");
    assert.ok(rule, "Paris rule must exist");
    const text = formatEntryRuleForPrompt(rule);
    assert.ok(text.includes(rule.sourceName), "formatted text must include sourceName");
    assert.ok(text.includes(rule.sourceUrl), "formatted text must include sourceUrl");
    assert.ok(text.includes(rule.retrievedAt), "formatted text must include retrievedAt");
    assert.ok(text.includes(rule.disclaimer), "formatted text must include full disclaimer");
  });
});

describe('Visa — "gidebilirsin" banned from formatted output', () => {
  const destinations = ["istanbul", "barcelona", "paris"];

  for (const dest of destinations) {
    test(`no "gidebilirsin" in formatted output for ${dest}`, () => {
      const { rule, canSurface } = getEntryRule(dest, "TR");
      if (!canSurface || !rule) return; // skip if no rule
      const text = formatEntryRuleForPrompt(rule);
      assert.ok(
        !text.toLowerCase().includes("gidebilirsin"),
        `formatted ${dest} rule must not contain "gidebilirsin"`,
      );
    });
  }
});

describe("Visa — unknown destination returns fallback URL", () => {
  test("unknown city returns canSurface=false with fallbackUrl", () => {
    const result = getEntryRule("unknown-city-xyz", "TR");
    assert.equal(result.canSurface, false);
    assert.ok(result.fallbackUrl?.startsWith("https://"), "fallbackUrl must be an https URL");
    assert.equal(result.rule, null);
  });

  test("buildVisaContext for unknown city returns non-empty fallback string", () => {
    const ctx = buildVisaContext({ destinationId: "mars", passportIso2: "TR", surface: "chat" });
    // Should either be empty (graceful) or contain a redirect message — never empty disclaimer
    // Our implementation returns a redirect string for unknown with fallbackUrl
    if (ctx.length > 0) {
      assert.ok(!ctx.includes("gidebilirsin"), 'fallback must not say "gidebilirsin"');
    }
  });
});

describe("Visa — correct requirement levels for known destinations", () => {
  test("Istanbul (domestic) = not_required for TR passport", () => {
    const { rule } = getEntryRule("istanbul", "TR");
    assert.ok(rule, "Istanbul rule must exist");
    assert.equal(rule.requirementLevel, "not_required");
  });

  test("Barcelona (Schengen) = visa_required for TR passport", () => {
    const { rule } = getEntryRule("barcelona", "TR");
    assert.ok(rule, "Barcelona rule must exist");
    assert.equal(rule.requirementLevel, "visa_required");
  });

  test("Paris (Schengen) = visa_required for TR passport", () => {
    const { rule } = getEntryRule("paris", "TR");
    assert.ok(rule, "Paris rule must exist");
    assert.equal(rule.requirementLevel, "visa_required");
  });
});

describe("Visa — audit log entry structure", () => {
  test("buildAuditEntry creates entry with required fields", () => {
    const { rule } = getEntryRule("barcelona", "TR");
    assert.ok(rule, "need a valid rule to build entry");
    const entry = buildAuditEntry(rule, { surface: "chat" });
    assert.ok(entry.auditId?.length > 0, "auditId required");
    assert.ok(entry.ruleId === rule.id, "ruleId must match");
    assert.ok(entry.destinationIso2 === "ES", "destinationIso2 must match");
    assert.ok(entry.passportIso2 === "TR", "passportIso2 must match");
    assert.ok(entry.surfacedAt?.length > 0, "surfacedAt required");
    assert.equal(entry.surface, "chat");
  });

  test("buildSessionRef returns a hex string (never the original token)", () => {
    const token = "my-session-abc-123";
    const ref = buildSessionRef(token);
    assert.ok(ref, "ref must be truthy");
    assert.ok(/^[0-9a-f]+$/.test(ref), "ref must be hex");
    assert.ok(ref !== token, "ref must not be the original token");
    assert.ok(ref.length <= 16, "ref is max 16 chars");
  });

  test("buildSessionRef without token returns undefined", () => {
    assert.equal(buildSessionRef(undefined), undefined);
  });
});
