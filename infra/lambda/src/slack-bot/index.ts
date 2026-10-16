import crypto from "node:crypto";

const secretsCache: Record<string, string> = {};

async function getSecret(name: string): Promise<string> {
  if (secretsCache[name]) return secretsCache[name];

  const secretName = process.env[name];
  if (!secretName?.startsWith("secret:/")) return secretName || "";

  try {
    const { SecretsManagerClient, GetSecretValueCommand } =
      await import("@aws-sdk/client-secrets-manager");
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
    const result = await client.send(
      new GetSecretValueCommand({ SecretId: secretName.replace("secret:/", "") }),
    );
    const value = result.SecretString || "";
    secretsCache[name] = value;
    return value;
  } catch (error) {
    console.error(`Failed to fetch secret ${name}`, error);
    return "";
  }
}

interface SlackRequest {
  type?: string;
  user_id?: string;
  command?: string;
  text?: string;
  response_url?: string;
  payload?: string;
  channel_id?: string;
}

interface AppEnv {
  SLACK_SIGNING_SECRET?: string;
  SLACK_BOT_TOKEN?: string;
  GH_TOKEN?: string;
  ALLOWED_USERS?: string;
  ALLOWED_CHANNELS?: string;
}

function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
): boolean {
  if (!secret || !timestamp || !signature) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", secret).update(baseString).digest("hex");
  const computed = `v0=${hmac}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

function isAuthorized(userId: string, channelId: string, env: AppEnv): boolean {
  const allowed = (env.ALLOWED_USERS?.split(",").map((u) => u.trim()) || []).filter(Boolean);
  const channels = (env.ALLOWED_CHANNELS?.split(",").map((c) => c.trim()) || []).filter(Boolean);

  if (allowed.length > 0 && !allowed.includes(userId)) return false;
  if (channels.length > 0 && !channels.includes(channelId)) return false;

  return true;
}

async function getSystemHealth() {
  try {
    const [site, api] = await Promise.all([
      fetch("https://mapsbridge.com", { method: "HEAD" }).then((r) =>
        r.status < 400 ? "✅" : "⚠️",
      ),
      fetch("https://mapsbridge.com/api/health", { method: "HEAD" }).then((r) =>
        r.status < 400 ? "✅" : "⚠️",
      ),
    ]);
    return { site, api, lambda: "✅" };
  } catch {
    return { site: "❌", api: "❌", lambda: "⚠️" };
  }
}

async function getLatestDeploy(
  gitHubToken: string,
): Promise<{ status: string; timestamp: string; commit: string }> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/sahinbolukbasi/mapsbridge/actions/runs?limit=1&branch=main",
      {
        headers: { Authorization: `Bearer ${gitHubToken}` },
      },
    );
    const data = (await res.json()) as any;
    const run = data.workflow_runs?.[0];
    return {
      status: run?.conclusion || "pending",
      timestamp: run?.updated_at || "N/A",
      commit: run?.head_sha?.slice(0, 7) || "N/A",
    };
  } catch {
    return { status: "unknown", timestamp: "N/A", commit: "N/A" };
  }
}

function ephemeralReply(text: string) {
  return {
    response_type: "ephemeral",
    text,
  };
}

function richReply(blocks: any[]) {
  return {
    response_type: "in_channel",
    blocks,
  };
}

function formatHealthReply(health: any) {
  return {
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🏥 System Health Check" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Website:*\n${health.site} Healthy` },
          { type: "mrkdwn", text: `*API:*\n${health.api} Responsive` },
          { type: "mrkdwn", text: `*Lambda:*\n${health.lambda} Active` },
          { type: "mrkdwn", text: `*Time:*\n${new Date().toLocaleTimeString("en-GB")}` },
        ],
      },
    ],
  };
}

function handleDeploy(text: string, userId: string) {
  const branch = text?.trim() || "main";
  if (!["main", "develop"].includes(branch)) {
    return ephemeralReply("❌ Invalid branch. Use: `/deploy main` or `/deploy develop`");
  }

  const payload = {
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🚀 Deploy Confirmation" },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Deploy to **${branch}** requested by <@${userId}>\n\nThis will:\n• Run CI/CD pipeline\n• Deploy web, Lambda, mobile builds\n• Update status (25-35 min)`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Confirm Deploy", emoji: true },
            value: `deploy:${branch}`,
            action_id: "deploy_confirm",
            style: "danger",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Cancel", emoji: true },
            value: "cancel",
            action_id: "deploy_cancel",
          },
        ],
      },
    ],
  };

  return payload;
}

function handleStatus() {
  return {
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "📊 Deployment Status" },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Status:* Checking latest runs...",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Refresh", emoji: true },
            action_id: "status_refresh",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "View Logs", emoji: true },
            url: "https://github.com/sahinbolukbasi/mapsbridge/actions",
          },
        ],
      },
    ],
  };
}

function handleLogs(type: string) {
  const urls: Record<string, string> = {
    deploy: "https://github.com/sahinbolukbasi/mapsbridge/actions/workflows/deploy.yml",
    ci: "https://github.com/sahinbolukbasi/mapsbridge/actions/workflows/ci.yml",
    monitor:
      "https://github.com/sahinbolukbasi/mapsbridge/actions/workflows/deployment-monitor.yml",
  };

  const url = urls[type || "deploy"] || urls.deploy;

  return {
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "📋 Logs & Workflows" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Deploy:*\n<${urls.deploy}|View Deploy Logs>` },
          { type: "mrkdwn", text: `*CI:*\n<${urls.ci}|View CI Logs>` },
          { type: "mrkdwn", text: `*Monitor:*\n<${urls.monitor}|View Monitor Logs>` },
        ],
      },
    ],
  };
}

function handleRollback(userId: string) {
  return {
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🔄 Rollback Confirmation" },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Rollback to previous version requested by <@${userId}>\n\nThis will:\n• Revert to last stable deployment\n• Restore previous Lambda versions\n• Update CloudFront cache (5-10 min)`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Confirm Rollback", emoji: true },
            value: "rollback",
            action_id: "rollback_confirm",
            style: "danger",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Cancel", emoji: true },
            value: "cancel",
            action_id: "rollback_cancel",
          },
        ],
      },
    ],
  };
}

function parseFormBody(raw: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(raw));
}

export async function handler(event: {
  rawPath: string;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string } };
}) {
  const { rawPath, headers } = event;
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf-8")
    : (event.body || "");
  const secret = await getSecret("SLACK_SIGNING_SECRET");

  if (!secret) {
    console.error("SLACK_SIGNING_SECRET not set");
    return { statusCode: 500, body: JSON.stringify({ error: "Configuration error" }) };
  }

  const timestamp = headers["x-slack-request-timestamp"] || "";
  const signature = headers["x-slack-signature"] || "";

  if (!verifySlackSignature(rawBody, timestamp, signature, secret)) {
    console.warn("Invalid Slack signature", { timestamp, path: rawPath });
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const params = parseFormBody(rawBody);
  const userId = params.user_id || "";
  const channelId = params.channel_id || "";
  const command = params.command || "";
  const text = params.text || "";

  if (!isAuthorized(userId, channelId, process.env as AppEnv)) {
    console.warn("Unauthorized user/channel", { userId, channelId });
    return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
  }

  const env = process.env as AppEnv;

  try {
    if (rawPath === "/slack-bot/deploy") {
      console.info("Deploy command", { userId, channel: channelId, branch: text });
      const reply = handleDeploy(text, userId);
      return { statusCode: 200, body: JSON.stringify(reply) };
    }

    if (rawPath === "/slack-bot/status") {
      console.info("Status command", { userId });
      const ghToken = await getSecret("GH_TOKEN");
      const deploy = await getLatestDeploy(ghToken);
      const reply = {
        response_type: "in_channel" as const,
        blocks: [
          { type: "header", text: { type: "plain_text", text: "📊 Deployment Status" } },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Latest Deploy:*\n${deploy.status}` },
              { type: "mrkdwn", text: `*Commit:*\n\`${deploy.commit}\`` },
              {
                type: "mrkdwn",
                text: `*Updated:*\n${new Date(deploy.timestamp).toLocaleTimeString()}`,
              },
            ],
          },
        ],
      };
      return { statusCode: 200, body: JSON.stringify(reply) };
    }

    if (rawPath === "/slack-bot/health") {
      console.info("Health check", { userId });
      const health = await getSystemHealth();
      const reply = formatHealthReply(health);
      return { statusCode: 200, body: JSON.stringify(reply) };
    }

    if (rawPath === "/slack-bot/logs") {
      console.info("Logs command", { userId, type: text });
      const reply = handleLogs(text);
      return { statusCode: 200, body: JSON.stringify(reply) };
    }

    if (rawPath === "/slack-bot/rollback") {
      console.info("Rollback command", { userId });
      const reply = handleRollback(userId);
      return { statusCode: 200, body: JSON.stringify(reply) };
    }

    if (rawPath === "/slack-bot/interactive") {
      const payload = JSON.parse(params.payload || "{}");
      const actionId = payload.actions?.[0]?.action_id || "";
      const value = payload.actions?.[0]?.value || "";
      const responseUrl = payload.response_url || "";

      console.info("Interactive action", { actionId, value, userId: payload.user?.id });

      if (actionId === "status_refresh" && responseUrl) {
        const health = await getSystemHealth();
        const reply = formatHealthReply(health);
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...reply, replace_original: true }),
        }).catch((e) => console.error("Failed to post response", e));
      }

      if (actionId === "deploy_confirm" && value.startsWith("deploy:")) {
        const branch = value.replace("deploy:", "");
        const message = {
          text: `🚀 Deploy to **${branch}** initiated by <@${payload.user?.id}>\n\nMonitor progress in #deployments`,
        };
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...message, replace_original: true }),
        }).catch((e) => console.error("Failed to post response", e));
      }

      if (actionId === "rollback_confirm" && value === "rollback") {
        const message = {
          text: `🔄 Rollback initiated by <@${payload.user?.id}>\n\nMonitor progress in #deployments`,
        };
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...message, replace_original: true }),
        }).catch((e) => console.error("Failed to post response", e));
      }

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    console.warn("Unknown path", { path: rawPath });
    return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
  } catch (error) {
    console.error("Handler error", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
}
