const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

/**
 * Loads ChatService. The file re-exports threadParticipants from infra/lambda
 * which we stub out; only the pure ChatService class is under test.
 */
function loadChatService() {
  const fullPath = path.resolve(
    __dirname,
    "../src/application/chat-service.ts",
  );
  const code = readFileSync(fullPath, "utf8");
  const transformed = transformSync(code, { loader: "ts", format: "cjs" }).code;
  const mod = { exports: {} };

  vm.runInNewContext(transformed, {
    module: mod,
    exports: mod.exports,
    require(spec) {
      // Stub the infra re-export
      if (spec.includes("infra/lambda") || spec.includes("thread-access")) {
        return { threadParticipants: () => [] };
      }
      return require(spec);
    },
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
  });
  return mod.exports;
}

const { ChatService } = loadChatService();

// ── Static constants ────────────────────────────────────────────────────────

test("ChatService exposes correct static limits", () => {
  assert.equal(ChatService.MAX_MESSAGE_LENGTH, 2000);
  assert.equal(ChatService.MAX_THREAD_LIST, 50);
  assert.equal(ChatService.MAX_MESSAGE_HISTORY, 200);
});

// ── isParticipant ───────────────────────────────────────────────────────────

test("isParticipant returns true when user is in participants list", () => {
  const participants = ["user-a", "user-b", "user-c"];
  assert.equal(ChatService.isParticipant(participants, "user-b"), true);
});

test("isParticipant returns false when user is not in participants list", () => {
  const participants = ["user-a", "user-b"];
  assert.equal(ChatService.isParticipant(participants, "user-x"), false);
});

test("isParticipant returns false for empty participants list", () => {
  assert.equal(ChatService.isParticipant([], "user-a"), false);
});

// ── getRecipients ───────────────────────────────────────────────────────────

test("getRecipients excludes the sender from the list", () => {
  const participants = ["alice", "bob", "carol"];
  const recipients = ChatService.getRecipients(participants, "bob");
  assert.deepEqual(recipients, ["alice", "carol"]);
});

test("getRecipients returns empty array when sender is the only participant", () => {
  const recipients = ChatService.getRecipients(["alice"], "alice");
  assert.deepEqual(recipients, []);
});

// ── truncateMessage ─────────────────────────────────────────────────────────

test("truncateMessage trims whitespace and preserves short messages", () => {
  const result = ChatService.truncateMessage("  hello world  ");
  assert.equal(result, "hello world");
});

test("truncateMessage truncates messages exceeding MAX_MESSAGE_LENGTH", () => {
  const long = "a".repeat(3000);
  const result = ChatService.truncateMessage(long);
  assert.equal(result.length, ChatService.MAX_MESSAGE_LENGTH);
});

test("truncateMessage handles empty string", () => {
  const result = ChatService.truncateMessage("   ");
  assert.equal(result, "");
});
