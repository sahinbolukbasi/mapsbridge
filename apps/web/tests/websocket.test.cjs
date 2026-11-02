const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function loadWs(wsEndpoint) {
  const code = readFileSync(path.resolve(__dirname, "../app/lib/websocket.ts"), "utf8");
  const transformed = transformSync(code, {
    loader: "ts",
    format: "cjs",
    target: "node22",
  }).code;
  const mod = { exports: {} };
  const instances = [];

  function MockWebSocket(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.sentMessages = [];
    this.close = () => {
      this.readyState = 3;
      if (this.onclose) this.onclose();
    };
    this.send = (data) => {
      this.sentMessages.push(data);
    };
    instances.push(this);
  }
  MockWebSocket.CONNECTING = 0;
  MockWebSocket.OPEN = 1;
  MockWebSocket.CLOSING = 2;
  MockWebSocket.CLOSED = 3;

  vm.runInNewContext(transformed, {
    module: mod,
    exports: mod.exports,
    process: { env: { NEXT_PUBLIC_WS_URL: wsEndpoint || "" } },
    WebSocket: MockWebSocket,
    setTimeout,
    clearTimeout,
    JSON,
    encodeURIComponent,
    Map,
    Math,
    console,
  });
  return { ws: mod.exports.ws, instances };
}

test("connect does nothing when WS_ENDPOINT is empty", () => {
  const { ws, instances } = loadWs("");
  ws.connect("tok");
  assert.equal(instances.length, 0);
});

test("connect creates WebSocket with token in URL", () => {
  const { ws, instances } = loadWs("wss://test.example.com");
  ws.connect("mytoken");
  assert.equal(instances.length, 1);
  assert.ok(
    instances[0].url.includes("token=mytoken"),
    `URL should contain the token, got: ${instances[0].url}`,
  );
  assert.equal(instances[0].url, "wss://test.example.com?token=mytoken");
});

test("on() registers handler and returns unsubscribe function", () => {
  const { ws, instances } = loadWs("wss://test.example.com");
  ws.connect("tok");
  const received = [];
  const unsub = ws.on("test", (data) => received.push(data));

  // Simulate incoming message
  instances[0].onmessage({ data: JSON.stringify({ action: "test", val: 1 }) });
  assert.equal(received.length, 1);
  assert.equal(received[0].val, 1);

  // Unsubscribe and verify handler no longer fires
  unsub();
  instances[0].onmessage({ data: JSON.stringify({ action: "test", val: 2 }) });
  assert.equal(received.length, 1);
});

test("wildcard handler receives all messages", () => {
  const { ws, instances } = loadWs("wss://test.example.com");
  ws.connect("tok");
  const received = [];
  ws.on("*", (data) => received.push(data));

  instances[0].onmessage({ data: JSON.stringify({ action: "foo" }) });
  assert.equal(received.length, 1);
  assert.equal(received[0].action, "foo");

  instances[0].onmessage({ data: JSON.stringify({ action: "bar" }) });
  assert.equal(received.length, 2);
  assert.equal(received[1].action, "bar");
});

test("send only works when readyState is OPEN", () => {
  const { ws, instances } = loadWs("wss://test.example.com");
  ws.connect("tok");
  const mock = instances[0];

  // readyState is CONNECTING (0) by default — send should be a no-op
  mock.readyState = 3; // CLOSED
  ws.send("ping", {});
  assert.equal(mock.sentMessages.length, 0);

  // Set to OPEN — send should work
  mock.readyState = 1; // OPEN
  ws.send("ping", { val: 1 });
  assert.equal(mock.sentMessages.length, 1);
  const parsed = JSON.parse(mock.sentMessages[0]);
  assert.equal(parsed.action, "ping");
  assert.equal(parsed.val, 1);
});

test("disconnect sets intentionallyClosed and clears state", () => {
  const { ws, instances } = loadWs("wss://test.example.com");
  ws.connect("tok");
  const oldWs = instances[0];

  ws.disconnect();

  // ws internal reference should be nulled — isConnected should be false
  assert.equal(ws.isConnected, false);

  // Simulate onclose on the old mock — should NOT trigger reconnect
  // (intentionallyClosed is true, so no new WebSocket should be created)
  const countBefore = instances.length;
  if (oldWs.onclose) oldWs.onclose();
  assert.equal(instances.length, countBefore, "no reconnect after intentional disconnect");
});

test("isConnected returns true only when readyState is OPEN", () => {
  const { ws: ws1 } = loadWs("wss://test.example.com");
  // Before connect
  assert.equal(ws1.isConnected, false);

  const { ws, instances } = loadWs("wss://test.example.com");
  ws.connect("tok");
  const mock = instances[0];

  // CONNECTING state (default)
  assert.equal(mock.readyState, 0);
  assert.equal(ws.isConnected, false);

  // OPEN state
  mock.readyState = 1;
  assert.equal(ws.isConnected, true);

  // CLOSED state
  mock.readyState = 3;
  assert.equal(ws.isConnected, false);
});
