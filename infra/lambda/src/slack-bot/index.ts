import crypto from "node:crypto";
import { createDeployer, listTargets } from "./deployer";
import { handleSlackEvent } from "./events-handler";

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

interface AppEnv {
  SLACK_SIGNING_SECRET?: string;
  SLACK_BOT_TOKEN?: string;
  ALLOWED_USERS?: string;
  ALLOWED_CHANNELS?: string;
  SLACK_ADMIN_USER_IDS?: string;
  DEPLOY_TARGETS?: string;
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

function isAdminUser(userId: string, env: AppEnv): boolean {
  const admins = (env.SLACK_ADMIN_USER_IDS?.split(",").map((u) => u.trim()) || []).filter(Boolean);
  if (admins.length === 0) return true;
  return admins.includes(userId);
}

const deployLocks = new Map<string, string>();

function parseFormBody(raw: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(raw));
}

async function getSystemHealth() {
  try {
    const [site, api] = await Promise.all([
      fetch("https://mapsbridge.com", { method: "HEAD", signal: AbortSignal.timeout(4000) }).then(
        (r) => (r.status < 400 ? "✅" : "⚠️"),
      ),
      fetch("https://api.mapsbridge.com/health", {
        method: "HEAD",
        signal: AbortSignal.timeout(4000),
      }).then((r) => (r.status < 400 ? "✅" : "⚠️")),
    ]);
    return { site, api, lambda: "✅" };
  } catch {
    return { site: "❌", api: "❌", lambda: "⚠️" };
  }
}

async function postToUrl(url: string, payload: Record<string, unknown>): Promise<void> {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function ephemeral(text: string) {
  return { response_type: "ephemeral", text };
}

function handleDeployCommand(text: string, userId: string) {
  const service = text.trim().split(/\s+/)[0] || "";
  const targets = listTargets();
  if (!service || (targets.length > 0 && !targets.includes(service))) {
    const list = targets.length > 0 ? targets.join(", ") : "api, admin, web";
    return ephemeral(`❌ Geçersiz servis. Kullanım: \`/deploy <servis>\`\nMevcut: ${list}`);
  }
  return {
    response_type: "ephemeral",
    blocks: [
      { type: "header", text: { type: "plain_text", text: "🚀 Deploy Onayı" } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${service}* servisini deploy etmek istiyor musunuz?\n\nİsteyen: <@${userId}>`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Onayla", emoji: true },
            value: JSON.stringify({ action: "deploy", service }),
            action_id: "deploy_confirm",
            style: "danger",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "İptal", emoji: true },
            value: JSON.stringify({ action: "cancel" }),
            action_id: "deploy_cancel",
          },
        ],
      },
    ],
  };
}

function handleRollbackCommand(text: string, userId: string) {
  const service = text.trim().split(/\s+/)[0] || "";
  const targets = listTargets();
  if (!service || (targets.length > 0 && !targets.includes(service))) {
    const list = targets.length > 0 ? targets.join(", ") : "api, admin, web";
    return ephemeral(`❌ Geçersiz servis. Kullanım: \`/rollback <servis>\`\nMevcut: ${list}`);
  }
  return {
    response_type: "ephemeral",
    blocks: [
      { type: "header", text: { type: "plain_text", text: "🔄 Rollback Onayı" } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${service}* servisini geri almak istiyor musunuz?\n\nİsteyen: <@${userId}>`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Onayla", emoji: true },
            value: JSON.stringify({ action: "rollback", service }),
            action_id: "rollback_confirm",
            style: "danger",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "İptal", emoji: true },
            value: JSON.stringify({ action: "cancel" }),
            action_id: "rollback_cancel",
          },
        ],
      },
    ],
  };
}

export async function handler(event: {
  rawPath: string;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string; path?: string } };
}) {
  const { rawPath, headers } = event;
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf-8")
    : event.body || "";

  const secret = await getSecret("SLACK_SIGNING_SECRET");
  if (!secret) {
    console.error("SLACK_SIGNING_SECRET not set");
    return { statusCode: 500, body: JSON.stringify({ error: "Configuration error" }) };
  }

  const timestamp = headers["x-slack-request-timestamp"] || "";
  const signature = headers["x-slack-signature"] || "";

  if (!verifySlackSignature(rawBody, timestamp, signature, secret)) {
    console.warn("Invalid Slack signature", { path: rawPath });
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const env = process.env as AppEnv;

  if (rawPath === "/slack-bot/events") {
    const token = await getSecret("SLACK_BOT_TOKEN");
    return handleSlackEvent(rawBody, headers, token);
  }

  const params = parseFormBody(rawBody);
  const userId = params.user_id || "";
  const channelId = params.channel_id || "";
  const text = params.text || "";

  if (!isAuthorized(userId, channelId, env)) {
    console.warn("Unauthorized user/channel", { userId, channelId });
    return {
      statusCode: 200,
      body: JSON.stringify(ephemeral("❌ Bu komutu kullanma yetkiniz yok.")),
    };
  }

  try {
    if (rawPath === "/slack-bot/deploy") {
      if (!isAdminUser(userId, env)) {
        return {
          statusCode: 200,
          body: JSON.stringify(ephemeral("❌ Deploy için admin yetkisi gereklidir.")),
        };
      }
      return { statusCode: 200, body: JSON.stringify(handleDeployCommand(text, userId)) };
    }

    if (rawPath === "/slack-bot/rollback") {
      if (!isAdminUser(userId, env)) {
        return {
          statusCode: 200,
          body: JSON.stringify(ephemeral("❌ Rollback için admin yetkisi gereklidir.")),
        };
      }
      return { statusCode: 200, body: JSON.stringify(handleRollbackCommand(text, userId)) };
    }

    if (rawPath === "/slack-bot/status") {
      const targets = listTargets();
      const statuses = await Promise.all(
        targets.map(async (name) => {
          const d = createDeployer(name);
          if (!d) return { service: name, status: "unknown", details: "not configured" };
          try {
            return await d.status();
          } catch (e: unknown) {
            return {
              service: name,
              status: "error",
              details: e instanceof Error ? e.message : String(e),
            };
          }
        }),
      );
      const fields = statuses.map((s) => ({
        type: "mrkdwn",
        text: `*${s.service}:*\n${s.status === "healthy" ? "✅" : "⚠️"} ${s.details}`,
      }));
      return {
        statusCode: 200,
        body: JSON.stringify({
          response_type: "in_channel",
          blocks: [
            { type: "header", text: { type: "plain_text", text: "📊 Deploy Durumu" } },
            fields.length > 0
              ? { type: "section", fields: fields.slice(0, 10) }
              : {
                  type: "section",
                  text: { type: "mrkdwn", text: "DEPLOY_TARGETS yapılandırılmamış." },
                },
          ],
        }),
      };
    }

    if (rawPath === "/slack-bot/health") {
      const targets = listTargets();
      const [health, serviceStatuses] = await Promise.all([
        getSystemHealth(),
        Promise.all(
          targets.map(async (name) => {
            const d = createDeployer(name);
            if (!d) return { service: name, status: "unknown", details: "" };
            try {
              return await d.status();
            } catch (e: unknown) {
              return {
                service: name,
                status: "error",
                details: e instanceof Error ? e.message : String(e),
              };
            }
          }),
        ),
      ]);
      const fields = [
        { type: "mrkdwn", text: `*Website:*\n${health.site} mapsbridge.com` },
        { type: "mrkdwn", text: `*API:*\n${health.api} api.mapsbridge.com` },
        { type: "mrkdwn", text: `*Lambda:*\n${health.lambda} Active` },
        { type: "mrkdwn", text: `*Zaman:*\n${new Date().toLocaleTimeString("tr-TR")}` },
        ...serviceStatuses.map((s) => ({
          type: "mrkdwn",
          text: `*${s.service}:*\n${s.status === "healthy" ? "✅" : "⚠️"} ${s.details || s.status}`,
        })),
      ];
      return {
        statusCode: 200,
        body: JSON.stringify({
          response_type: "in_channel",
          blocks: [
            { type: "header", text: { type: "plain_text", text: "🏥 Sistem Sağlık Kontrolü" } },
            { type: "section", fields: fields.slice(0, 10) },
          ],
        }),
      };
    }

    if (rawPath === "/slack-bot/logs") {
      const parts = text.trim().split(/\s+/);
      const service = parts[0] || "";
      const filterPattern = parts.slice(1).join(" ") || undefined;
      const targets = listTargets();
      if (!service || (targets.length > 0 && !targets.includes(service))) {
        const list = targets.length > 0 ? targets.join(", ") : "api, admin, web";
        return {
          statusCode: 200,
          body: JSON.stringify(ephemeral(`Kullanım: \`/logs <servis>\`\nMevcut: ${list}`)),
        };
      }
      const deployer = createDeployer(service);
      if (!deployer) {
        return {
          statusCode: 200,
          body: JSON.stringify(ephemeral(`❌ ${service} servisi bulunamadı.`)),
        };
      }
      const result = await deployer.logs({ since: 15 * 60 * 1000, limit: 100, filterPattern });
      const logText =
        result.lines.length > 0 ? result.lines.join("\n") : "(son 15 dakikada log yok)";
      const header = `📋 *${service}* logları (${result.logGroup})\n`;

      if (header.length + logText.length <= 2800) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            response_type: "in_channel",
            text: header + "```" + logText + "```",
          }),
        };
      }

      const botToken = await getSecret("SLACK_BOT_TOKEN");
      if (botToken && channelId) {
        const form = new FormData();
        form.append("channels", channelId);
        form.append("content", logText);
        form.append("filename", `${service}-logs.txt`);
        form.append("title", `${service} logları`);
        await fetch("https://slack.com/api/files.uploadV2", {
          method: "POST",
          headers: { Authorization: `Bearer ${botToken}` },
          body: form,
        }).catch((e) => console.error("[slack-bot] file upload error", e));
      }

      return {
        statusCode: 200,
        body: JSON.stringify(
          ephemeral(
            `📋 ${service} logları (${result.lines.length} satır) dosya olarak gönderildi.`,
          ),
        ),
      };
    }

    if (rawPath === "/slack-bot/interactive") {
      const payload = JSON.parse(params.payload || "{}");
      const actionId = payload.actions?.[0]?.action_id || "";
      const valueStr = payload.actions?.[0]?.value || "{}";
      const responseUrl = payload.response_url || "";
      const actingUser = payload.user?.id || userId;

      let value: Record<string, string> = {};
      try {
        value = JSON.parse(valueStr);
      } catch {
        value = { action: valueStr };
      }

      console.info("Interactive action", { actionId, service: value.service, userId: actingUser });

      if (actionId === "deploy_confirm" || actionId === "rollback_confirm") {
        const opLabel = actionId === "deploy_confirm" ? "deploy" : "rollback";

        if (!isAdminUser(actingUser, env)) {
          if (responseUrl) {
            await postToUrl(responseUrl, {
              replace_original: true,
              text: `❌ ${opLabel === "deploy" ? "Deploy" : "Rollback"} için admin yetkisi gereklidir.`,
            });
          }
          return { statusCode: 200, body: JSON.stringify({ ok: true }) };
        }

        const service = value.service || "";
        if (deployLocks.has(service)) {
          const lockedBy = deployLocks.get(service);
          if (responseUrl) {
            await postToUrl(responseUrl, {
              replace_original: true,
              text: `⚠️ *${service}* şu anda <@${lockedBy}> tarafından işleniyor. Lütfen bekleyin.`,
            });
          }
          return { statusCode: 200, body: JSON.stringify({ ok: true }) };
        }

        deployLocks.set(service, actingUser);

        void (async () => {
          try {
            const d = createDeployer(service);
            if (!d) {
              await postToUrl(responseUrl, {
                replace_original: true,
                text: `❌ ${service} servisi için deployer bulunamadı.`,
              });
              return;
            }
            await postToUrl(responseUrl, {
              replace_original: true,
              text: `${opLabel === "deploy" ? "🚀" : "🔄"} <@${actingUser}> *${service}* ${opLabel} başlatıyor...`,
            });
            const result = await (opLabel === "deploy" ? d.deploy() : d.rollback());
            await postToUrl(responseUrl, {
              text: result.ok
                ? `✅ *${service}* ${opLabel} başlatıldı: ${result.message}`
                : `❌ ${opLabel} başarısız: ${result.message}`,
            });
          } catch (e: unknown) {
            console.error(`[slack-bot] ${opLabel} error`, e);
            if (responseUrl) {
              await postToUrl(responseUrl, {
                text: `❌ ${opLabel} hatası: ${e instanceof Error ? e.message : String(e)}`,
              }).catch(() => {});
            }
          } finally {
            deployLocks.delete(service);
          }
        })().catch((err) => console.error("[slack-bot] bg error", err));

        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      if (
        actionId === "deploy_cancel" ||
        actionId === "rollback_cancel" ||
        (value.action === "cancel" && actionId.endsWith("_cancel"))
      ) {
        if (responseUrl) {
          await postToUrl(responseUrl, { replace_original: true, text: "❌ İptal edildi." });
        }
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      if (actionId === "status_refresh" && responseUrl) {
        const health = await getSystemHealth();
        await postToUrl(responseUrl, {
          replace_original: true,
          response_type: "in_channel",
          blocks: [
            { type: "header", text: { type: "plain_text", text: "🏥 Sistem Sağlık Kontrolü" } },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*Website:*\n${health.site}` },
                { type: "mrkdwn", text: `*API:*\n${health.api}` },
                { type: "mrkdwn", text: `*Lambda:*\n${health.lambda}` },
              ],
            },
          ],
        });
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
