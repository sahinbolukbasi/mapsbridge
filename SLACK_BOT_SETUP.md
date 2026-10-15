# Slack Bot Setup - MapsBridge Control Center

Interactive Slack bot'u Slack kanalında komutlarla sistemi yönet.

## 🤖 Bot Features

```
/deploy [branch]         → Deployment tetikle
/status                  → Sistem durumu kontrol
/health                  → Health check
/logs [type]             → Log bağlantıları
/rollback                → Son deploy'ı geri al
```

Interactive buttons:

- View Logs
- Refresh Status
- Auto-Recover
- Rollback

## 📋 Setup Steps

### 1. Slack App Oluştur

1. https://api.slack.com/apps
2. **Create New App** → **From scratch**
3. App name: `mapsbridge-bot`
4. Workspace: Seç

### 2. Bot Token Scopes

**Settings** → **OAuth & Permissions**

**Bot Token Scopes Ekle:**

```
chat:write              - Messages gönder
commands:write          - Slash commands
users:read              - User info
chat:write.public       - Public channels'a yaz
```

### 3. Slash Commands Oluştur

**Features** → **Slash Commands** → **Create New Command**

Şu komutları ekle:

**Command 1: /deploy**

- Command: `/deploy`
- Request URL: `https://api.mapsbridge.com/slack-bot/deploy`
- Short Description: `Trigger deployment`
- Usage hint: `[main|develop]`

**Command 2: /status**

- Command: `/status`
- Request URL: `https://api.mapsbridge.com/slack-bot/status`
- Short Description: `System status report`

**Command 3: /health**

- Command: `/health`
- Request URL: `https://api.mapsbridge.com/slack-bot/health`
- Short Description: `Health check`

**Command 4: /logs**

- Command: `/logs`
- Request URL: `https://api.mapsbridge.com/slack-bot/logs`
- Short Description: `View deployment logs`
- Usage hint: `[deploy|ci|monitor]`

**Command 5: /rollback**

- Command: `/rollback`
- Request URL: `https://api.mapsbridge.com/slack-bot/rollback`
- Short Description: `Rollback last deployment`

### 4. Interactivity Kur

**Features** → **Interactivity & Shortcuts**

**Interactivity ON**

- Request URL: `https://api.mapsbridge.com/slack-bot/interactive`

### 5. Event Subscriptions

**Features** → **Event Subscriptions**

Enable Events: ON

- Request URL: `https://api.mapsbridge.com/slack-bot/events`

Subscribe to bot events:

- `message.channels`
- `app_mention`

### 6. Bot Install

**Settings** → **Install App**

- Install to Workspace
- Copy **Bot User OAuth Token**: `xoxb-...`

### 7. Invite Bot to Channels

Slack workspace'de:

```
/invite @mapsbridge-bot
```

Şu channels'a invite et:

- #deployments
- #ci-status
- #health-alerts
- #incidents
- #dashboard

### 8. GitHub Secrets Ekle

```bash
# GitHub repo → Settings → Secrets

SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...  (Settings → Basic Information)
SLACK_BOT_USER_ID=U...     (from OAuth Token page)
```

### 9. Environment Variables

Terraform/Lambda'ya ekle:

```hcl
# terraform.tfvars
slack_bot_token = "xoxb-..."
slack_signing_secret = "..."
slack_bot_user_id = "U..."
```

## 🎮 Using the Bot

### Deploy Command

```
/deploy main
```

Response:

```
🚀 Deployment Triggered by @your-name

Branch: main
Status: Starting deployment workflow...

Workflow: Deploy
Duration: 25-35 min
```

### Status Command

```
/status
```

Response:

```
📊 System Status Report

Site: ✅ healthy
API: ✅ healthy
Lambda: ✅ active
Last Deploy: success

[View Logs] [Refresh]
```

### Health Command

```
/health
```

Response (if all good):

```
✅ All Systems Healthy

Website: ✅ healthy
API: ✅ healthy
Lambda: ✅ active
Time: 2:34 PM
```

Response (if issues):

```
⚠️ Issues Detected

Website: ❌ down
API: ✅ healthy
Lambda: ✅ active
Time: 2:34 PM

[Auto-Recover]
```

### Logs Command

```
/logs deploy
```

Response:

```
📋 Logs: deploy

[Deploy Logs] [CI Logs] [Monitor Logs]
```

### Rollback Command

```
/rollback
```

Response:

```
🔄 Rollback Initiated by @your-name

Rolling back to previous version...

Action: Rollback Last Deploy
Status: In Progress
```

## 🔧 Bot Behavior

### Incoming Messages

Bot listens to:

- Commands starting with `/`
- @mapsbridge-bot mentions
- Deployments in threads

### Automatic Responses

Bot automatically posts to channels:

- Deployment updates (via webhooks)
- Health check results
- CI/CD status
- Error recovery status

### Action Buttons

Rich message formatting:

- Blue buttons: info/status
- Red buttons: critical/recovery
- All buttons are clickable & interactive

## 📊 Workflow Integration

Bot works with existing workflows:

```
User types: /deploy main
   ↓
Bot: 🚀 Deployment Triggered
   ↓
GitHub: Deploy workflow starts
   ↓
Webhook: Bot gets updates
   ↓
Bot: Posts progress to #deployments
   ↓
Every 5 min: Bot posts health status
   ↓
If issue: Bot posts to #incidents
```

## 🔐 Security

- Slack signature verification
- Request timestamp validation (5 min window)
- Admin token for sensitive operations
- User tracking (who triggered actions)

## 🐛 Troubleshooting

### Bot not responding

- Check Request URL is correct
- Verify Signing Secret in Lambda env
- Check Bot Token scope
- Verify Slack command syntax

### 404 Not Found

- Ensure endpoint exists: `/slack-bot/[command]`
- Check Lambda routes are registered
- Verify API Gateway paths

### Signature verification failed

- Check SLACK_SIGNING_SECRET is correct
- Verify timestamp isn't too old
- Check request body isn't modified

### Bot not in channel

- Invite bot: `/invite @mapsbridge-bot`
- Check channel permissions
- Verify bot has `chat:write` scope

## 🎯 Advanced Usage

### Monitor from Slack

```
/health
[Auto-Recover] button clicked
→ Bot triggers auto-recovery
→ Posts recovery status
→ Updates health in real-time
```

### Deploy & Monitor

```
/deploy main
→ Deployment starts
→ Every 5 min: health updates
→ When complete: final status
→ If issue: auto-recovery attempted
```

### Check Logs

```
/logs ci
→ Links to GitHub Actions
→ Can view detailed logs
→ Track test failures
```

## 📞 Commands Reference

| Command   | Usage            | Response                |
| --------- | ---------------- | ----------------------- |
| /deploy   | /deploy [branch] | 🚀 Deployment Triggered |
| /status   | /status          | 📊 System Status Report |
| /health   | /health          | ✅ Health Status        |
| /logs     | /logs [type]     | 📋 Log Links            |
| /rollback | /rollback        | 🔄 Rollback Started     |

## 🔄 Conversation Flow

### Normal Deployment

```
User: /deploy main
Bot: 🚀 Deployment Triggered...

[5 min later]
Bot: ✅ All Systems Healthy

[10 min later]
Bot: ✅ All Systems Healthy

[35 min later]
Bot: 🚀 Deployment Complete - All Systems Live
```

### Failed Deployment

```
User: /deploy main
Bot: 🚀 Deployment Triggered...

[10 min later]
Bot: ⚠️ Issues Detected (in #incidents)
User: /health
Bot: Website: ❌ down
     [Auto-Recover]

User clicks: [Auto-Recover]
Bot: 🔧 Auto-Recovery Started...
Bot: ✅ All Systems Healthy
```

## 📈 Monitoring in Real-Time

Keep Slack open and watch:

```
#deployments    ← Deploy events
#ci-status      ← Test results
#health-alerts  ← System health (every 5 min)
#incidents      ← Critical issues
#dashboard      ← Status updates (every 15 min)
```

Talk to bot via commands:

```
/status         → Current system state
/health         → Health check
/logs           → View workflow logs
```

## 🎓 Learn More

- [Slack API Docs](https://api.slack.com)
- [Slash Commands](https://api.slack.com/interactivity/slash-commands)
- [Interactivity](https://api.slack.com/interactivity)
- [Slack Bot Best Practices](https://api.slack.com/bot-users)
