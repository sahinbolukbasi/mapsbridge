"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { transformSync } = require("esbuild");

const sourceRoot = path.resolve(__dirname, "../src");
const SIGNING_SECRET = "test-signing-secret";
const BOT_TOKEN = "xoxb-test-token";
const ADMIN_USER = "U_ADMIN";
const NORMAL_USER = "U_NORMAL";

const DEPLOY_TARGETS_JSON = JSON.stringify({
  api: { type: "lambda", name: "mapsbridge-prod-routes" },
});

function sign(timestamp, body) {
  const base = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", SIGNING_SECRET).update(base).digest("hex");
  return `v0=${hmac}`;
}

function nowTs() {
  return String(Math.floor(Date.now() / 1000));
}

function slackEvent(rawPath, body, opts = {}) {
  const ts = opts.timestamp ?? nowTs();
  const sig = opts.signature ?? sign(ts, body);
  return {
    rawPath,
    body,
    isBase64Encoded: false,
    headers: {
      "x-slack-request-timestamp": ts,
      "x-slack-signature": sig,
      "content-type": "application/x-www-form-urlencoded",
      ...(opts.extraHeaders || {}),
    },
    requestContext: { http: { method: "POST", path: rawPath } },
  };
}

function formBody(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function harness(options = {}) {
  const calls = { ecs: [], lambda: [], cw: [], slackFetch: [] };
  const cache = new Map();

  const ecsCommands = {};
  for (const name of ["UpdateServiceCommand", "DescribeServicesCommand"]) {
    ecsCommands[name] = class {
      constructor(i) {
        this.name = name;
        this.input = i;
      }
    };
  }

  const lambdaCommands = {};
  for (const name of [
    "PublishVersionCommand",
    "GetFunctionConfigurationCommand",
    "ListAliasesCommand",
    "UpdateAliasCommand",
  ]) {
    lambdaCommands[name] = class {
      constructor(i) {
        this.name = name;
        this.input = i;
      }
    };
  }

  const cwCommands = {};
  for (const name of ["FilterLogEventsCommand"]) {
    cwCommands[name] = class {
      constructor(i) {
        this.name = name;
        this.input = i;
      }
    };
  }

  const external = {
    "@aws-sdk/client-secrets-manager": {
      SecretsManagerClient: class {
        async send() {
          return {};
        }
      },
      GetSecretValueCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
    },
    "@aws-sdk/client-ecs": {
      ...ecsCommands,
      ECSClient: class {
        async send(cmd) {
          calls.ecs.push(cmd);
          if (options.ecsSend) return options.ecsSend(cmd);
          if (cmd.name === "DescribeServicesCommand") {
            return {
              services: [
                {
                  runningCount: 2,
                  desiredCount: 2,
                  status: "ACTIVE",
                  taskDefinition: "arn:aws:ecs:eu-central-1:123:task-definition/web:5",
                  deployments: [{ rolloutState: "COMPLETED" }],
                },
              ],
            };
          }
          return {};
        }
        destroy() {}
      },
    },
    "@aws-sdk/client-lambda": {
      ...lambdaCommands,
      LambdaClient: class {
        async send(cmd) {
          calls.lambda.push(cmd);
          if (options.lambdaSend) return options.lambdaSend(cmd);
          if (cmd.name === "GetFunctionConfigurationCommand")
            return { State: "Active", LastUpdateStatus: "Successful" };
          if (cmd.name === "ListAliasesCommand")
            return { Aliases: [{ Name: "live", FunctionVersion: "5" }] };
          return {};
        }
        destroy() {}
      },
    },
    "@aws-sdk/client-cloudwatch-logs": {
      ...cwCommands,
      CloudWatchLogsClient: class {
        async send(cmd) {
          calls.cw.push(cmd);
          if (options.cwSend) return options.cwSend(cmd);
          return { events: [{ timestamp: Date.now(), message: "INFO test log line" }] };
        }
        destroy() {}
      },
    },
    "node:crypto": require("node:crypto"),
    "node:fs": require("node:fs"),
    "node:path": require("node:path"),
  };

  const env = {
    AWS_REGION: "eu-central-1",
    SLACK_SIGNING_SECRET: SIGNING_SECRET,
    SLACK_BOT_TOKEN: BOT_TOKEN,
    DEPLOY_TARGETS: DEPLOY_TARGETS_JSON,
    SLACK_ADMIN_USER_IDS: ADMIN_USER,
    ...(options.env || {}),
  };

  function load(filename) {
    if (!filename.endsWith(".ts")) filename = filename + ".ts";
    // Try index.ts fallback for directories
    if (!require("node:fs").existsSync(filename)) {
      const idx = filename.replace(/\.ts$/, "/index.ts");
      if (require("node:fs").existsSync(idx)) filename = idx;
    }
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const src = readFileSync(filename, "utf8");
    const { code } = transformSync(src, {
      loader: "ts",
      format: "cjs",
      target: "node22",
      supported: { "dynamic-import": false },
    });
    vm.runInNewContext(
      code,
      {
        module: mod,
        exports: mod.exports,
        Buffer,
        URL,
        URLSearchParams,
        AbortSignal,
        FormData,
        TextEncoder,
        setTimeout,
        clearTimeout,
        setImmediate,
        process: { env: { ...env } },
        crypto: require("node:crypto").webcrypto,
        console: { log() {}, warn() {}, error() {}, info() {} },
        fetch: async (url, req) => {
          calls.slackFetch.push({ url, body: req?.body });
          if (options.fetch) return options.fetch(url, req);
          if (typeof url === "string" && url.includes("mapsbridge.com")) {
            return { ok: true, status: 200, json: async () => ({}) };
          }
          return { ok: true, status: 200, json: async () => ({}) };
        },
        require(specifier) {
          if (specifier.startsWith(".")) {
            return load(path.resolve(path.dirname(filename), specifier));
          }
          if (external[specifier]) return external[specifier];
          throw new Error(`Unexpected dep: ${specifier}`);
        },
      },
      { filename },
    );
    return mod.exports;
  }

  return { load, calls, env };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("valid signature passes through to handler (deploy command returns 200)", async () => {
  const h = harness({ env: { SLACK_ADMIN_USER_IDS: ADMIN_USER } });
  const body = formBody({ command: "/deploy", text: "api", user_id: ADMIN_USER, channel_id: "C1" });
  const res = await h
    .load(path.join(sourceRoot, "slack-bot"))
    .handler(slackEvent("/slack-bot/deploy", body));
  assert.equal(res.statusCode, 200);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.blocks || parsed.response_type, "should return a Slack payload");
});

test("invalid signature returns 401", async () => {
  const h = harness();
  const body = formBody({ command: "/health", user_id: ADMIN_USER });
  const res = await h
    .load(path.join(sourceRoot, "slack-bot"))
    .handler(slackEvent("/slack-bot/health", body, { signature: "v0=badbadbadbad" }));
  assert.equal(res.statusCode, 401);
});

test("old timestamp (>5min) returns 401", async () => {
  const h = harness();
  const oldTs = String(Math.floor(Date.now() / 1000) - 600);
  const body = formBody({ command: "/health", user_id: ADMIN_USER });
  const res = await h
    .load(path.join(sourceRoot, "slack-bot"))
    .handler(
      slackEvent("/slack-bot/health", body, { timestamp: oldTs, signature: sign(oldTs, body) }),
    );
  assert.equal(res.statusCode, 401);
});

test("missing x-slack-signature header returns 401", async () => {
  const h = harness();
  const body = formBody({ command: "/health", user_id: ADMIN_USER });
  const ev = slackEvent("/slack-bot/health", body);
  delete ev.headers["x-slack-signature"];
  const res = await h.load(path.join(sourceRoot, "slack-bot")).handler(ev);
  assert.equal(res.statusCode, 401);
});

test("url_verification challenge is echoed back", async () => {
  const h = harness();
  const jsonBody = JSON.stringify({
    type: "url_verification",
    challenge: "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P",
  });
  const res = await h
    .load(path.join(sourceRoot, "slack-bot"))
    .handler(slackEvent("/slack-bot/events", jsonBody));
  assert.equal(res.statusCode, 200);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.challenge, "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P");
});

test("unauthorized userId (ALLOWED_USERS set, user not in list) returns 200 with forbidden ephemeral", async () => {
  const h = harness({ env: { ALLOWED_USERS: "U_ALLOWED", SLACK_ADMIN_USER_IDS: "" } });
  const body = formBody({ command: "/health", user_id: "U_STRANGER", channel_id: "C1" });
  const res = await h
    .load(path.join(sourceRoot, "slack-bot"))
    .handler(slackEvent("/slack-bot/health", body));
  assert.equal(res.statusCode, 200);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.response_type, "ephemeral");
  assert.ok(parsed.text.includes("yetki"), "should mention permission denied");
});

test("/deploy returns ephemeral Block Kit confirmation with 3 blocks", async () => {
  const h = harness({ env: { SLACK_ADMIN_USER_IDS: ADMIN_USER } });
  const body = formBody({ command: "/deploy", text: "api", user_id: ADMIN_USER, channel_id: "C1" });
  const res = await h
    .load(path.join(sourceRoot, "slack-bot"))
    .handler(slackEvent("/slack-bot/deploy", body));
  assert.equal(res.statusCode, 200);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.response_type, "ephemeral");
  assert.ok(Array.isArray(parsed.blocks));
  assert.equal(parsed.blocks.length, 3);
  assert.ok(parsed.blocks[0].text.text.includes("🚀"));
  const confirmBtn = parsed.blocks[2].elements.find((e) => e.action_id === "deploy_confirm");
  assert.ok(confirmBtn, "should have deploy_confirm button");
  const val = JSON.parse(confirmBtn.value);
  assert.equal(val.service, "api");
});

test("/health returns in_channel response and calls deployer.status", async () => {
  const h = harness();
  const body = formBody({ command: "/health", user_id: ADMIN_USER, channel_id: "C1" });
  const res = await h
    .load(path.join(sourceRoot, "slack-bot"))
    .handler(slackEvent("/slack-bot/health", body));
  assert.equal(res.statusCode, 200);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.response_type, "in_channel");
  assert.ok(parsed.blocks?.length > 0);
  // deployer.status() calls GetFunctionConfigurationCommand for lambda target
  assert.ok(
    h.calls.lambda.some((c) => c.name === "GetFunctionConfigurationCommand"),
    "should call Lambda status",
  );
});

test("/logs calls deployer.logs (FilterLogEventsCommand)", async () => {
  const h = harness();
  const body = formBody({ command: "/logs", text: "api", user_id: ADMIN_USER, channel_id: "C1" });
  const res = await h
    .load(path.join(sourceRoot, "slack-bot"))
    .handler(slackEvent("/slack-bot/logs", body));
  assert.equal(res.statusCode, 200);
  assert.ok(
    h.calls.cw.some((c) => c.name === "FilterLogEventsCommand"),
    "should call CloudWatch FilterLogEvents",
  );
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.text || parsed.response_type, "should return a log response");
});

test("interactive deploy_confirm calls deployer.deploy for admin user", async () => {
  const h = harness({ env: { SLACK_ADMIN_USER_IDS: ADMIN_USER } });
  const interactivePayload = JSON.stringify({
    type: "block_actions",
    user: { id: ADMIN_USER },
    response_url: "https://hooks.slack.com/actions/response",
    actions: [
      {
        action_id: "deploy_confirm",
        value: JSON.stringify({ action: "deploy", service: "api" }),
      },
    ],
  });
  const body = formBody({ payload: interactivePayload, user_id: ADMIN_USER, channel_id: "C1" });
  const res = await h
    .load(path.join(sourceRoot, "slack-bot"))
    .handler(slackEvent("/slack-bot/interactive", body));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true });
  // Let microtasks run so the void block can progress
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.ok(
    h.calls.lambda.some((c) => c.name === "PublishVersionCommand"),
    "should call Lambda PublishVersion",
  );
});

test("interactive deploy_cancel does NOT call deployer.deploy", async () => {
  const h = harness({ env: { SLACK_ADMIN_USER_IDS: ADMIN_USER } });
  const interactivePayload = JSON.stringify({
    type: "block_actions",
    user: { id: ADMIN_USER },
    response_url: "https://hooks.slack.com/actions/response",
    actions: [
      {
        action_id: "deploy_cancel",
        value: JSON.stringify({ action: "cancel" }),
      },
    ],
  });
  const body = formBody({ payload: interactivePayload, user_id: ADMIN_USER, channel_id: "C1" });
  const res = await h
    .load(path.join(sourceRoot, "slack-bot"))
    .handler(slackEvent("/slack-bot/interactive", body));
  assert.equal(res.statusCode, 200);
  await new Promise((r) => setImmediate(r));
  assert.equal(
    h.calls.lambda.filter((c) => c.name === "PublishVersionCommand").length,
    0,
    "should not deploy on cancel",
  );
});

test("interactive deploy_confirm with concurrent lock returns lock message", async () => {
  // Make Lambda never resolve so the lock is held
  const h = harness({
    env: { SLACK_ADMIN_USER_IDS: ADMIN_USER },
    lambdaSend: (cmd) => {
      if (cmd.name === "PublishVersionCommand") return new Promise(() => {}); // never resolves
      if (cmd.name === "GetFunctionConfigurationCommand")
        return Promise.resolve({ State: "Active", LastUpdateStatus: "Successful" });
      return Promise.resolve({});
    },
  });

  const mkPayload = (userId) => {
    const interactivePayload = JSON.stringify({
      type: "block_actions",
      user: { id: userId },
      response_url: "https://hooks.slack.com/actions/response",
      actions: [
        {
          action_id: "deploy_confirm",
          value: JSON.stringify({ action: "deploy", service: "api" }),
        },
      ],
    });
    return formBody({ payload: interactivePayload, user_id: userId, channel_id: "C1" });
  };

  const mod = h.load(path.join(sourceRoot, "slack-bot"));

  // First deploy: sets the lock and returns { ok: true } before void block completes
  const body1 = mkPayload(ADMIN_USER);
  const res1 = await mod.handler(slackEvent("/slack-bot/interactive", body1));
  assert.equal(res1.statusCode, 200);
  assert.deepEqual(JSON.parse(res1.body), { ok: true });

  // Yield to let the void block start (it will be stuck at PublishVersionCommand forever)
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  // Second deploy: lock still held
  const body2 = mkPayload(ADMIN_USER);
  const res2 = await mod.handler(slackEvent("/slack-bot/interactive", body2));
  assert.equal(res2.statusCode, 200);
  // The handler posts to response_url with lock message — check slackFetch calls
  const lockPost = h.calls.slackFetch.find(
    (c) =>
      c.url === "https://hooks.slack.com/actions/response" &&
      c.body &&
      JSON.parse(c.body).text?.includes("işleniyor"),
  );
  assert.ok(lockPost, "should post lock warning to response_url");
});

test("Events API app_mention dedup: same event_id is processed only once", async () => {
  const h = harness();
  const eventId = "Ev111TESTDEDUP";

  const mkEventsBody = () =>
    JSON.stringify({
      type: "event_callback",
      event_id: eventId,
      event: { type: "app_mention", text: "hello", channel: "C1" },
    });

  const mod = h.load(path.join(sourceRoot, "slack-bot"));

  const res1 = await mod.handler(slackEvent("/slack-bot/events", mkEventsBody()));
  assert.equal(res1.statusCode, 200);

  const slackPostsBefore = h.calls.slackFetch.filter(
    (c) => c.url === "https://slack.com/api/chat.postMessage",
  ).length;

  // Second call with same event_id — dedup should skip processing
  const res2 = await mod.handler(slackEvent("/slack-bot/events", mkEventsBody()));
  assert.equal(res2.statusCode, 200);

  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  const slackPostsAfter = h.calls.slackFetch.filter(
    (c) => c.url === "https://slack.com/api/chat.postMessage",
  ).length;

  assert.equal(
    slackPostsAfter,
    slackPostsBefore,
    "duplicate event should not trigger a second postMessage",
  );
});
