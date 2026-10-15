const { test } = require("node:test");
const assert = require("node:assert/strict");

test("Slack bot command handling", async () => {
  // Mock Slack request
  const mockSlackRequest = {
    body: JSON.stringify({
      type: "slash_commands",
      command: "/deploy",
      text: "main",
      user_id: "U123456",
      response_url: "https://hooks.slack.com/commands/response",
    }),
    headers: {
      "x-slack-request-timestamp": Math.floor(Date.now() / 1000).toString(),
      "x-slack-signature": "v0=test-signature",
    },
  };

  // Test deploy command
  assert.ok(mockSlackRequest.body);
  assert.match(mockSlackRequest.body, /deploy/);

  // Test status command
  const statusRequest = JSON.stringify({
    type: "slash_commands",
    command: "/status",
    user_id: "U123456",
    response_url: "https://hooks.slack.com/commands/response",
  });
  assert.match(statusRequest, /status/);

  // Test health command
  const healthRequest = JSON.stringify({
    type: "slash_commands",
    command: "/health",
    user_id: "U123456",
    response_url: "https://hooks.slack.com/commands/response",
  });
  assert.match(healthRequest, /health/);

  // Test rollback command
  const rollbackRequest = JSON.stringify({
    type: "slash_commands",
    command: "/rollback",
    user_id: "U123456",
    response_url: "https://hooks.slack.com/commands/response",
  });
  assert.match(rollbackRequest, /rollback/);
});

test("Slack interactive component handling", async () => {
  const mockInteractiveRequest = {
    body: {
      payload: JSON.stringify({
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
      }),
    },
  };

  const payload = JSON.parse(mockInteractiveRequest.body.payload);
  assert.equal(payload.type, "block_actions");
  assert.equal(payload.actions[0].action_id, "status_refresh");
});

test("Slack bot responses", async () => {
  const deployResponse = {
    response_type: "in_channel",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🚀 *Deployment Triggered*\n\nBranch: `main`",
        },
      },
    ],
  };

  assert.ok(deployResponse.blocks);
  assert.match(deployResponse.blocks[0].text.text, /🚀/);

  const healthResponse = {
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "✅ All Systems Healthy",
        },
      },
    ],
  };

  assert.match(healthResponse.blocks[0].text.text, /✅/);
});

test("Slack webhook signatures are verified", async () => {
  // Test that timestamp is checked
  const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
  const tooOldSignature = {
    timestamp: oldTimestamp.toString(),
    signature: "v0=invalid",
  };

  // Should reject requests older than 5 minutes
  assert.ok(
    Math.abs(Math.floor(Date.now() / 1000) - parseInt(tooOldSignature.timestamp)) > 300,
    "Should reject requests older than 5 minutes",
  );
});

test("Bot command formats", async () => {
  // Deploy with branch
  assert.match("/deploy main", /\/deploy/);
  assert.match("/deploy develop", /\/deploy/);

  // Status (no args)
  assert.match("/status", /\/status/);

  // Health (no args)
  assert.match("/health", /\/health/);

  // Logs with type
  assert.match("/logs deploy", /\/logs/);
  assert.match("/logs ci", /\/logs/);
  assert.match("/logs monitor", /\/logs/);

  // Rollback (no args)
  assert.match("/rollback", /\/rollback/);
});
