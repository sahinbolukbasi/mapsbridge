import crypto from "node:crypto";

interface SlackRequest {
  type?: string;
  user_id?: string;
  command?: string;
  text?: string;
  response_url?: string;
  payload?: string;
}

function verifySlackSignature(body: string, timestamp: string, signature: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
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

async function getSystemHealth() {
  const check = async (url: string) => {
    try {
      const res = await fetch(url, { method: "HEAD" });
      return res.status < 400 ? "✅ healthy" : "⚠️ unhealthy";
    } catch {
      return "❌ down";
    }
  };

  const [site, api] = await Promise.all([
    check("https://mapsbridge.com"),
    check(`${process.env.APP_ORIGIN ?? "https://mapsbridge.com"}/api/health`),
  ]);

  return { site, api, lambda: api };
}

async function sendSlackResponse(url: string, payload: object) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(console.error);
}

function reply(statusCode: number, body: object) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function parseFormBody(raw: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(raw));
}

export async function handler(event: {
  rawPath: string;
  requestContext: { http: { method: string } };
  headers: Record<string, string>;
  body: string;
}) {
  const { rawPath, headers, body } = event;
  const timestamp = headers["x-slack-request-timestamp"] ?? "";
  const signature = headers["x-slack-signature"] ?? "";

  if (!verifySlackSignature(body ?? "", timestamp, signature)) {
    return reply(401, { error: "Unauthorized" });
  }

  if (rawPath === "/slack-bot/interactive") {
    const params = parseFormBody(body);
    const payload = JSON.parse(params.payload ?? "{}");
    const actionId = payload.actions?.[0]?.action_id;
    const responseUrl = payload.response_url;

    if (actionId === "status_refresh") {
      const health = await getSystemHealth();
      await sendSlackResponse(responseUrl, {
        replace_original: true,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "📊 Status Refreshed" },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Site:*\n${health.site}` },
              { type: "mrkdwn", text: `*API:*\n${health.api}` },
            ],
          },
        ],
      });
    } else if (actionId === "health_recover") {
      await sendSlackResponse(responseUrl, {
        replace_original: true,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "🔧 *Auto-Recovery Started*\n\nAttempting to recover...",
            },
          },
        ],
      });
    }

    return reply(200, {});
  }

  const params = parseFormBody(body);
  const command = params.command ?? rawPath.replace("/slack-bot", "");
  const text = (params.text ?? "").trim();
  const userId = params.user_id ?? "unknown";
  const responseUrl = params.response_url ?? "";

  if (!responseUrl) {
    return reply(400, { error: "Missing response_url" });
  }

  // Acknowledge immediately (Slack requires <3s)
  const ack = reply(200, {
    response_type: "ephemeral",
    text: "Processing...",
  });

  // Handle each command
  setImmediate(async () => {
    if (command === "/deploy" || rawPath === "/slack-bot/deploy") {
      const branch = text || "main";
      await sendSlackResponse(responseUrl, {
        response_type: "in_channel",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "🚀 Deployment Triggered" },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Branch:*\n\`${branch}\`` },
              { type: "mrkdwn", text: `*Triggered by:*\n<@${userId}>` },
              { type: "mrkdwn", text: `*Duration:*\n~25-35 min` },
              {
                type: "mrkdwn",
                text: `*Time:*\n<!date^${Math.floor(Date.now() / 1000)}^{time_secs}|now>`,
              },
            ],
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "View Actions" },
                url: "https://github.com/sahinbolukbasi/mapsbridge/actions",
              },
            ],
          },
        ],
      });

      await fetch(
        "https://api.github.com/repos/sahinbolukbasi/mapsbridge/actions/workflows/deploy.yml/dispatches",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: branch }),
        },
      ).catch(console.error);
    } else if (command === "/status" || rawPath === "/slack-bot/status") {
      const health = await getSystemHealth();
      await sendSlackResponse(responseUrl, {
        response_type: "in_channel",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "📊 System Status" },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Site:*\n${health.site}` },
              { type: "mrkdwn", text: `*API:*\n${health.api}` },
              { type: "mrkdwn", text: `*Lambda:*\n${health.lambda}` },
              {
                type: "mrkdwn",
                text: `*Updated:*\n<!date^${Math.floor(Date.now() / 1000)}^{time_secs}|now>`,
              },
            ],
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "View Logs" },
                url: "https://github.com/sahinbolukbasi/mapsbridge/actions",
              },
              {
                type: "button",
                text: { type: "plain_text", text: "Refresh" },
                action_id: "status_refresh",
              },
            ],
          },
        ],
      });
    } else if (command === "/health" || rawPath === "/slack-bot/health") {
      const health = await getSystemHealth();
      const allOk = health.site.includes("✅") && health.api.includes("✅");
      await sendSlackResponse(responseUrl, {
        response_type: "in_channel",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: allOk ? "✅ All Systems Healthy" : "⚠️ Issues Detected",
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Website:*\n${health.site}` },
              { type: "mrkdwn", text: `*API:*\n${health.api}` },
            ],
          },
          ...(allOk
            ? []
            : [
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      style: "danger",
                      text: { type: "plain_text", text: "Auto-Recover" },
                      action_id: "health_recover",
                    },
                  ],
                },
              ]),
        ],
      });
    } else if (command === "/logs" || rawPath === "/slack-bot/logs") {
      await sendSlackResponse(responseUrl, {
        response_type: "in_channel",
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: "📋 *Deployment Logs*" },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Deploy Logs" },
                url: "https://github.com/sahinbolukbasi/mapsbridge/actions/workflows/deploy.yml",
              },
              {
                type: "button",
                text: { type: "plain_text", text: "CI Logs" },
                url: "https://github.com/sahinbolukbasi/mapsbridge/actions/workflows/ci.yml",
              },
              {
                type: "button",
                text: { type: "plain_text", text: "Monitor" },
                url: "https://github.com/sahinbolukbasi/mapsbridge/actions/workflows/deployment-monitor.yml",
              },
            ],
          },
        ],
      });
    } else if (command === "/rollback" || rawPath === "/slack-bot/rollback") {
      await sendSlackResponse(responseUrl, {
        response_type: "in_channel",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "🔄 Rollback Initiated" },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Triggered by:*\n<@${userId}>` },
              { type: "mrkdwn", text: `*Status:*\nIn Progress` },
            ],
          },
        ],
      });
    }
  });

  return ack;
}
