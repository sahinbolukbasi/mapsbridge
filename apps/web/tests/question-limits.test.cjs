// I3 çalışma zamanı koruması (design §13): QuestionCard'a giden sorular en fazla 2, her biri 2–4
// seçenek. components/assistant/logic/question-limits.ts saf modülü.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const FILE = path.resolve(__dirname, "../app/components/assistant/logic/question-limits.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));
const opts = (n) => Array.from({ length: n }, (_, i) => ({ id: `o${i}`, label: `Seçenek ${i}` }));
const q = (id, n, extra = {}) => ({
  id,
  text: `Soru ${id}`,
  mode: "single",
  options: opts(n),
  ...extra,
});

function load(nodeEnv) {
  const warnings = [];
  const mod = loadTs(FILE, {
    globals: {
      process: { env: { NODE_ENV: nodeEnv } },
      console: { ...console, warn: (...a) => warnings.push(a.join(" ")) },
    },
  });
  return { ...mod, warnings };
}

test("clampQuestions: geçerli girdi değişmez, uyarı yok", () => {
  const { clampQuestions, warnings } = load("development");
  const input = [q("a", 2), q("b", 4)];
  const r = clampQuestions(input);
  assert.equal(r.clamped, false);
  assert.deepEqual(plain(r.questions), input);
  assert.equal(warnings.length, 0);
});

test("clampQuestions: en fazla 2 soru, 4'ten fazla seçenek kesilir, <2 seçenekli soru atılır", () => {
  const { clampQuestions, warnings } = load("development");
  const r = clampQuestions([q("a", 1), q("b", 6), q("c", 3), q("d", 2)]);
  assert.equal(r.clamped, true);
  assert.deepEqual(
    plain(r.questions).map((x) => [x.id, x.options.length]),
    [
      ["b", 4],
      ["c", 3],
    ],
  );
  assert.equal(warnings.length, 1, "geliştirmede bir kez console.warn");
  assert.match(warnings[0], /I3/);
});

test("clampQuestions: geçerli soru kalmazsa boş (kart render edilmez, I10)", () => {
  const { clampQuestions } = load("development");
  assert.deepEqual(plain(clampQuestions([q("a", 0), q("b", 1)]).questions), []);
  assert.deepEqual(plain(clampQuestions([]).questions), []);
  assert.deepEqual(plain(clampQuestions(undefined).questions), []);
  assert.equal(clampQuestions([]).clamped, false);
});

test("clampQuestions: multi max seçenek sayısına sıkıştırılır", () => {
  const { clampQuestions } = load("development");
  const [only] = plain(clampQuestions([q("m", 6, { mode: "multi", max: 9 })]).questions);
  assert.equal(only.options.length, 4);
  assert.equal(only.max, 4);
});

test("clampQuestions: üretimde log yok", () => {
  const { clampQuestions, warnings } = load("production");
  assert.equal(clampQuestions([q("a", 1), q("b", 5), q("c", 2), q("d", 2)]).clamped, true);
  assert.equal(warnings.length, 0);
});

test("allAnswered / answerLabels: Devam her soru yanıtlanınca; etiketler soru sırasıyla", () => {
  const { allAnswered, answerLabels } = load("development");
  const qs = [q("a", 3), q("b", 2, { mode: "multi" })];
  assert.equal(allAnswered(qs, {}), false);
  assert.equal(allAnswered(qs, { a: ["o1"] }), false);
  assert.equal(allAnswered(qs, { a: ["o1"], b: [] }), false);
  assert.equal(allAnswered(qs, { a: ["o1"], b: ["o0"] }), true);
  assert.equal(allAnswered([], {}), false);
  assert.deepEqual(plain(answerLabels(qs, { b: ["o1", "o0"], a: ["o2", "x"] })), [
    "Seçenek 2",
    "Seçenek 1",
    "Seçenek 0",
  ]);
});
