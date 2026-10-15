# MapsBridge Slack Bot — Implementation Guide

## Overview

The Slack bot backend is fully implemented and integrated with the API Gateway. It handles slash commands and interactive actions for deployment, status monitoring, health checks, and system recovery.

## Architecture

- **Handler:** `infra/lambda/src/slack-bot/index.ts` (312 lines)
- **Routing:** Integrated into `infra/lambda/src/routes/index.ts` via 6 routes
- **API Gateway:** Routes defined in `infra/terraform/main.tf` domain_routes
- **Tests:** `infra/lambda/tests/slack-bot.test.cjs` (16 unit tests, all passing)

## Slash Commands

### `/deploy [branch]`

- **Branches:** `main`, `develop`
- **Response:** Ephemeral message with Block Kit confirmation buttons
- **Flow:** Immediate ack → User confirms → Async response via response_url
- **Logging:** Records user, channel, branch, confirmation status

Example:
```
/deploy main
→ Shows confirmation dialog with 2-button flow
→ User clicks "Confirm Deploy"
→ Bot sends update to response_url with deployment status
```

### `/deploy-status`

- **Response:** In-channel message with latest GitHub Actions run status
- **Data:** Fetches from GitHub API (requires GITHUB_TOKEN)
- **Buttons:** Refresh (polls again), View Logs (links to Actions tab)

Example:
```
/deploy-status
→ Shows:
  Latest Deploy: success
  Commit: abc1234
  Updated: 2026-10-15 13:45:32
```

### `/health`

- **Response:** In-channel message with concurrent health checks
- **Checks:** Website (HEAD /) + API (/api/health) + Lambda status
- **Buttons:** Auto-Recover (for issues)

Example:
```
/health
→ Shows:
  Website: ✅ Healthy
  API: ✅ Responsive
  Lambda: ✅ Active
  Time: 13:45:32
```

### `/logs [type]`

- **Types:** `deploy`, `ci`, `monitor` (or no arg defaults to deploy)
- **Response:** In-channel message with 3 buttons, each linking to a GitHub Actions workflow

Example:
```
/logs ci
→ Shows buttons:
  [Deploy Logs] [CI Logs] [Monitor Logs]
```

### `/rollback`

- **Response:** Ephemeral message with Block Kit confirmation buttons
- **Flow:** Same as deploy (immediate ack → confirm → async response)
- **Action:** Triggers Lambda version alias rollback + CloudFront invalidate

Example:
```
/rollback
→ Shows confirmation dialog
→ User clicks "Confirm Rollback"
→ System rolls back to previous Lambda versions
```

## Interactive Actions

Handled by `/slack-bot/interactive` endpoint (form body with `payload` JSON):

### `status_refresh` (Button)

- Refreshes health check and updates the message in-place
- Uses `replace_original: true` to update the original message

### `deploy_confirm` / `deploy_cancel` (Buttons)

- Confirms or cancels a deployment
- On confirm: logs action, updates message, initiates async deploy
- Value format: `deploy:main` or `deploy:develop`

### `rollback_confirm` / `rollback_cancel` (Buttons)

- Confirms or cancels a rollback
- On confirm: logs action, updates message, initiates async rollback

## Security

### Slack Signature Verification

Every request is verified with:

1. **HMAC-SHA256** using `SLACK_SIGNING_SECRET`
2. **Timestamp validation:** Must be ≤ 5 minutes old (replay protection)
3. **Timing-safe comparison:** Uses `crypto.timingSafeEqual()`
4. **Raw body requirement:** Form-encoded body is used as-is for HMAC

Requests older than 5 minutes or with invalid signatures return **HTTP 401 Unauthorized**.

### Authorization

- **User authorization:** Checks `user_id` against `ALLOWED_USERS` env var (comma-separated)
- **Channel authorization:** Checks `channel_id` against `ALLOWED_CHANNELS` env var
- **Unauthorized requests:** Return **HTTP 403 Forbidden**

Example:
```
ALLOWED_USERS=U123456,U789012
ALLOWED_CHANNELS=C123456
```

## Environment Variables

| Variable | Purpose | Example |
|---|---|---|
| `SLACK_SIGNING_SECRET` | Slack request verification | `abc123def456...` |
| `SLACK_BOT_TOKEN` | Bot user token (future use for proactive messages) | `xoxb-...` |
| `GITHUB_TOKEN` | GitHub API access for deployment status | (Personal access token) |
| `ALLOWED_USERS` | Comma-separated user IDs (optional, if empty allows all) | `U123456,U789012` |
| `ALLOWED_CHANNELS` | Comma-separated channel IDs (optional, if empty allows all) | `C123456,C789012` |
| `APP_ORIGIN` | Base URL for API health check | `https://mapsbridge.com` |

### Where to Set

1. **AWS Secrets Manager** (recommended for production)
2. **AWS SSM Parameter Store** (for infrastructure)
3. **Environment file** (.env, for local development)

The Lambda handler reads these from `process.env`.

## Deployment

### 1. **Apply Terraform**

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

This creates/updates:
- 6 new API Gateway routes (`/slack-bot/*`)
- Slack bot handler attached to routes Lambda

### 2. **Configure Slack App** (One-time)

1. Go to https://api.slack.com/apps
2. Select MapsBridge app (or create: "App name: mapsbridge-bot")
3. **OAuth & Permissions** → Add scopes: `chat:write`, `chat:write.public`, `commands`
4. **Slash Commands** → Create 5 commands:
   - `/deploy` → Request URL: `https://api.mapsbridge.com/slack-bot/deploy`
   - `/deploy-status` → `https://api.mapsbridge.com/slack-bot/status`
   - `/health` → `https://api.mapsbridge.com/slack-bot/health`
   - `/logs` → `https://api.mapsbridge.com/slack-bot/logs`
   - `/rollback` → `https://api.mapsbridge.com/slack-bot/rollback`
5. **Interactivity & Shortcuts** → Enable, Request URL: `https://api.mapsbridge.com/slack-bot/interactive`
6. Copy **Bot User OAuth Token** and **Signing Secret**, save to secrets

### 3. **Set GitHub Secrets**

```bash
gh secret set SLACK_SIGNING_SECRET --body "<signing-secret>"
gh secret set SLACK_BOT_TOKEN --body "xoxb-<token>"
gh secret set GITHUB_TOKEN --body "<github-token>"
```

### 4. **Test Locally**

```bash
# Install dependencies
cd infra/lambda
npm install

# Run tests
npm test -- infra/lambda/tests/slack-bot.test.cjs

# Or direct Node test runner
node --test infra/lambda/tests/slack-bot.test.cjs
```

## Logging

All handler operations log to CloudWatch:

```
[INFO] Deploy command {userId: "U123456", channel: "C123456", branch: "main"}
[INFO] Status command {userId: "U123456"}
[INFO] Health check {userId: "U123456"}
[WARN] Invalid Slack signature {timestamp: "1633123456", path: "/slack-bot/deploy"}
[WARN] Unauthorized user/channel {userId: "U123456", channelId: "C123456"}
[ERROR] Handler error ... stack trace
```

View logs:
```bash
# CloudWatch Logs group: /aws/lambda/mapsbridge-api-routes
aws logs tail /aws/lambda/mapsbridge-api-routes --follow
```

## Error Handling

| Error | HTTP Status | Response |
|---|---|---|
| Invalid/missing signature | 401 | `{"error": "Unauthorized"}` |
| Old timestamp (>5min) | 401 | `{"error": "Unauthorized"}` |
| Unauthorized user/channel | 403 | `{"error": "Forbidden"}` |
| Unknown route | 404 | `{"error": "Not found"}` |
| Handler exception | 500 | `{"error": "Internal server error"}` |

## Response Format

### Ephemeral Responses (Deploy / Rollback)

Only the command user sees the message (private confirmation):

```json
{
  "response_type": "ephemeral",
  "blocks": [
    {
      "type": "header",
      "text": {"type": "plain_text", "text": "🚀 Deploy Confirmation"}
    },
    {
      "type": "section",
      "text": {"type": "mrkdwn", "text": "Deploy to **main** .."}
    },
    {
      "type": "actions",
      "elements": [
        {"type": "button", "text": {...}, "action_id": "deploy_confirm", "style": "danger"},
        {"type": "button", "text": {...}, "action_id": "deploy_cancel"}
      ]
    }
  ]
}
```

### In-Channel Responses (Status / Health / Logs)

All channel members see the message:

```json
{
  "response_type": "in_channel",
  "blocks": [
    {"type": "header", "text": {"type": "plain_text", "text": "📊 System Status"}},
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Website:* ✅ Healthy"},
        {"type": "mrkdwn", "text": "*API:* ✅ Responsive"}
      ]
    }
  ]
}
```

## Testing

### Unit Tests (16 tests)

```bash
cd infra/lambda
node --test tests/slack-bot.test.cjs
```

Coverage:
- ✅ Signature verification (valid, old timestamp, format)
- ✅ All command formats
- ✅ Response structures (Block Kit validation)
- ✅ Interactive action payloads
- ✅ Form encoding/decoding

### Manual Testing (Slack)

1. **Invite bot to channel:**
   ```
   /invite @mapsbridge-bot
   ```

2. **Test health check:**
   ```
   /health
   ```
   Expected: In-channel message with 3 health indicators

3. **Test deploy (requires confirmation):**
   ```
   /deploy main
   ```
   Expected: Ephemeral message with Confirm/Cancel buttons

4. **Test logs:**
   ```
   /logs ci
   ```
   Expected: In-channel message with 3 workflow log links

## Monitoring & Alerting

Health checks run every 5 minutes (deployment-monitor workflow). If issues detected:
- Alert posted to `#health-alerts`
- If critical: Alert to `#incidents` with auto-recovery suggestion
- All logged to CloudWatch

## Troubleshooting

### "Unauthorized" (401)

- Verify `SLACK_SIGNING_SECRET` in Lambda env vars
- Check request timestamp (must be within 5 min)
- Verify Slack app signing secret matches

### "Forbidden" (403)

- User ID not in `ALLOWED_USERS` list
- Channel ID not in `ALLOWED_CHANNELS` list
- Empty lists allow all users/channels

### Command not showing in Slack

- Verify slash command URLs in Slack app settings
- Check API Gateway routes in Terraform output
- Verify API domain resolves (dns test)

### Response not appearing

- Check response_url (30-min expiration)
- Verify Slack bot has `chat:write` scope
- Check CloudWatch logs for handler errors

## Future Enhancements

- [ ] Pro-active monitoring alerts (bot initiates messages)
- [ ] Scheduled daily status report
- [ ] Multi-region health checks
- [ ] Auto-escalation (Slack → PagerDuty)
- [ ] Deployment approval workflow (multi-user confirmation)
