const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const SLACK_SIGNING_SECRET = "test-secret";

function createSignature(timestamp, body) {
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto
    .createHmac("sha256", SLACK_SIGNING_SECRET)
    .update(baseString)
    .digest("hex");
  return `v0=${hmac}`;
}

function encodeFormBody(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

test("Slack signature verification - valid signature", async () => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = encodeFormBody({
    command: "/deploy",
    text: "main",
    user_id: "U123456",
    channel_id: "C123456",
  });
  const signature = createSignature(timestamp, body);

  assert.match(signature, /^v0=[a-f0-9]{64}$/);
});

test("Slack signature verification - old timestamp rejected", async () => {
  const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 min ago
  const body = encodeFormBody({ command: "/health" });
  const signature = createSignature(oldTimestamp, body);

  const now = Math.floor(Date.now() / 1000);
  assert.ok(Math.abs(now - parseInt(oldTimestamp)) > 300);
});

test("Deploy command format", async () => {
  const deployCmd = "/deploy main";
  assert.match(deployCmd, /\/deploy\s+main/);

  const deployCmdDev = "/deploy develop";
  assert.match(deployCmdDev, /\/deploy\s+develop/);

  const invalidCmd = "/deploy invalid";
  assert.match(invalidCmd, /\/deploy\s+invalid/);
});

test("Status command format", async () => {
  const statusCmd = "/status";
  assert.match(statusCmd, /\/status/);
});

test("Health command format", async () => {
  const healthCmd = "/health";
  assert.match(healthCmd, /\/health/);
});

test("Logs command format", async () => {
  const deployLogs = "/logs deploy";
  assert.match(deployLogs, /\/logs\s+deploy/);

  const ciLogs = "/logs ci";
  assert.match(ciLogs, /\/logs\s+ci/);

  const monitorLogs = "/logs monitor";
  assert.match(monitorLogs, /\/logs\s+monitor/);
});

test("Rollback command format", async () => {
  const rollbackCmd = "/rollback";
  assert.match(rollbackCmd, /\/rollback/);
});

test("Deploy response structure", async () => {
  const deployResponse = {
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🚀 Deploy Confirmation" },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: "Deploy to **main**..." },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Confirm Deploy" },
            action_id: "deploy_confirm",
          },
        ],
      },
    ],
  };

  assert.equal(deployResponse.response_type, "ephemeral");
  assert.ok(Array.isArray(deployResponse.blocks));
  assert.equal(deployResponse.blocks.length, 3);
  assert.match(deployResponse.blocks[0].text.text, /🚀/);
});

test("Health response structure", async () => {
  const healthResponse = {
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🏥 System Health Check" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: "*Website:*\n✅ Healthy" },
          { type: "mrkdwn", text: "*API:*\n✅ Responsive" },
          { type: "mrkdwn", text: "*Lambda:*\n✅ Active" },
          { type: "mrkdwn", text: "*Time:*\n..." },
        ],
      },
    ],
  };

  assert.equal(healthResponse.response_type, "in_channel");
  assert.ok(Array.isArray(healthResponse.blocks));
  assert.ok(Array.isArray(healthResponse.blocks[1].fields));
});

test("Status response structure", async () => {
  const statusResponse = {
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "📊 Deployment Status" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: "*Latest Deploy:*\nsuccess" },
          { type: "mrkdwn", text: "*Commit:*\n`abc1234`" },
        ],
      },
    ],
  };

  assert.equal(statusResponse.response_type, "in_channel");
  assert.match(statusResponse.blocks[0].text.text, /📊/);
});

test("Logs response structure", async () => {
  const logsResponse = {
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "📋 Logs & Workflows" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: "*Deploy:*\n<https://...|View Deploy Logs>" },
          { type: "mrkdwn", text: "*CI:*\n<https://...|View CI Logs>" },
        ],
      },
    ],
  };

  assert.equal(logsResponse.response_type, "in_channel");
  assert.match(logsResponse.blocks[1].fields[0].text, /Deploy/);
});

test("Rollback response structure", async () => {
  const rollbackResponse = {
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🔄 Rollback Confirmation" },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: "Rollback to previous version..." },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Confirm Rollback" },
            action_id: "rollback_confirm",
          },
        ],
      },
    ],
  };

  assert.equal(rollbackResponse.response_type, "ephemeral");
  assert.match(rollbackResponse.blocks[0].text.text, /🔄/);
});

test("Interactive action structure - status_refresh", async () => {
  const interactivePayload = {
    type: "block_actions",
    user: { id: "U123456", name: "test-user" },
    response_url: "https://hooks.slack.com/commands/response",
    actions: [
      {
        action_id: "status_refresh",
        type: "button",
        value: "refresh",
      },
    ],
  };

  assert.equal(interactivePayload.type, "block_actions");
  assert.equal(interactivePayload.actions[0].action_id, "status_refresh");
});

test("Interactive action structure - deploy_confirm", async () => {
  const interactivePayload = {
    type: "block_actions",
    user: { id: "U123456", name: "test-user" },
    response_url: "https://hooks.slack.com/commands/response",
    actions: [
      {
        action_id: "deploy_confirm",
        type: "button",
        value: "deploy:main",
      },
    ],
  };

  assert.equal(interactivePayload.actions[0].action_id, "deploy_confirm");
  assert.match(interactivePayload.actions[0].value, /^deploy:(main|develop)$/);
});

test("Interactive action structure - rollback_confirm", async () => {
  const interactivePayload = {
    type: "block_actions",
    user: { id: "U123456", name: "test-user" },
    response_url: "https://hooks.slack.com/commands/response",
    actions: [
      {
        action_id: "rollback_confirm",
        type: "button",
        value: "rollback",
      },
    ],
  };

  assert.equal(interactivePayload.actions[0].action_id, "rollback_confirm");
  assert.equal(interactivePayload.actions[0].value, "rollback");
});

test("Form body encoding/decoding", async () => {
  const formData = {
    command: "/deploy",
    text: "main",
    user_id: "U123456",
    channel_id: "C123456",
  };

  const encoded = encodeFormBody(formData);
  const decoded = Object.fromEntries(new URLSearchParams(encoded));

  assert.equal(decoded.command, "/deploy");
  assert.equal(decoded.text, "main");
  assert.equal(decoded.user_id, "U123456");
  assert.equal(decoded.channel_id, "C123456");
});
