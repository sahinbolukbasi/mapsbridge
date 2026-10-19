const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildSync } = require("esbuild");
const vm = require("node:vm");
const path = require("node:path");
const WEB_ROOT = path.resolve(__dirname, "..");
const output = buildSync({
  entryPoints: [path.join(WEB_ROOT, "app/lib/message-model.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  absWorkingDir: WEB_ROOT,
});
const context = { module: { exports: {} } };
vm.runInNewContext(output.outputFiles[0].text, context);
const { normalizeMessages, belongsToConversation } = context.module.exports;

test("legacy profile inbox remains readable without discarding contact data", () => {
  const original = {
    id: "legacy",
    toUser: "gezgin",
    fromName: "Elif",
    fromContact: "elif@example.com",
    message: "Roma?",
    createdAt: "2026-09-01T10:00:00Z",
    read: false,
  };
  const [message] = normalizeMessages([original]);
  assert.equal(message.fromUsername, "elif");
  assert.equal(message.toUsername, "gezgin");
  assert.equal(message.fromContact, original.fromContact);
  assert.equal(message.read, false);
  assert.equal(original.fromUsername, undefined);
});

test("conversation visibility and deletion exclude unrelated accounts with the same correspondent", () => {
  const [mine, unrelated] = normalizeMessages([
    { id: "1", fromUsername: "elif", toUsername: "alice", message: "A" },
    { id: "2", fromUsername: "elif", toUsername: "bob", message: "B" },
  ]);
  assert.equal(belongsToConversation(mine, "Alice", "Elif"), true);
  assert.equal(belongsToConversation(unrelated, "alice"), false);
  assert.equal(belongsToConversation(unrelated, "alice", "elif"), false);
});

test("malformed archives fail before a partial list can overwrite stored data", () => {
  assert.throws(() => normalizeMessages({}));
  assert.throws(() => normalizeMessages([{ id: "valid", message: "Hello" }, null]));
});
