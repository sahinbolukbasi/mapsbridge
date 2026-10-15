# Slack Integration Setup

## Otomatik Deployment Notifications

### 1. Slack Workspace Setup

#### Incoming Webhooks Oluştur
1. Slack workspace'e git: https://api.slack.com/apps
2. **Create New App** → **From scratch**
3. **App Name:** `mapsbridge-bot`
4. **Workspace:** Seç
5. **Incoming Webhooks** enable et

#### Webhook URL Oluştur
1. **Add New Webhook to Workspace**
2. Channel seç: `#deployments` (oluştur)
3. URL'yi kopyala

### 2. GitHub Secrets Ekle

```bash
# GitHub repo → Settings → Secrets and variables → Actions
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 3. Notification Types

#### CI Status Notifications
- ✅ CI pass → slot kanal bildirimi
- ❌ CI fail → detaylı error report
- 🔧 Auto-fix applied → fix durumu

#### Deployment Notifications
- 🚀 Deploy started → branch, commit
- ✅ Deploy success → timing, services
- ❌ Deploy failed → error logs
- 🔄 Auto-rollback → status

#### Health Check Notifications
- ✅ All healthy → status
- ⚠️ Issues detected → detaylar
- 🔧 Auto-recovery → action taken
- 🚨 Manual intervention needed → critical alert

### 4. Channels Setup

```
#deployments       - Deploy workflow başarı/başarısızlık
#ci-status         - CI pass/fail reports
#health-alerts     - Deployment health issues
#rollbacks         - Auto-rollback notifications
#incidents         - Critical alerts
```

### 5. Testing

```bash
# Test webhook
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test message from GitHub Actions"}' \
  YOUR_WEBHOOK_URL
```

### 6. Escalation Policy

| Severity | Channel | Action |
|----------|---------|--------|
| Info | #deployments | Log only |
| Warning | #health-alerts | Log + monitor |
| Error | #incidents | Log + auto-recovery + notify |
| Critical | @channel | Page oncall + notify slack + create issue |

### 7. Monitoring Dashboard

Create Slack dashboard with:
- Last deployment status
- Current health metrics
- Recent issues
- Rollback history

## Auto-Recovery & Alerts

### When Deploy Fails
1. Slack → #incidents: **Deploy Failed**
2. GitHub: Create issue with label `deployment-alert`
3. Auto-recovery attempts run
4. If recovery succeeds → Slack: **Issue Resolved**
5. If recovery fails → Slack: **Manual Intervention Required** + @oncall

### When Site Is Down
1. Deployment monitor detects (every 5 min)
2. Slack → #health-alerts: **Site Down**
3. Auto-recovery: CloudFront invalidate, Lambda restart
4. Slack → #health-alerts: **Recovery Attempted**
5. If not fixed in 5 min → create GitHub issue + escalate

### When Tests Fail
1. CI monitor detects failures
2. Slack → #ci-status: **CI Failed**
3. Auto-fix runs: formatting, lint fixes
4. If fixed → commit + push → Slack: **Auto-Fixed**
5. If not fixed → manual review needed

## Configuration Files

### deployment-monitor.yml
- Runs every 5 minutes
- Checks: site, API, Lambda
- Auto-recovery on failures
- Slack notifications

### ci-monitor.yml
- On CI completion
- Analyzes test failures
- Auto-fixes formatting/lint
- Reports to Slack

### auto-merge.yml (existing)
- develop → main promotion
- Triggers deploy workflow
- Slack notification included

## Manual Override

```bash
# Skip Slack notification for a deploy
SKIP_SLACK_NOTIFICATION=true gh workflow run deploy.yml --ref main

# Disable monitoring temporarily
gh workflow disable deployment-monitor.yml
```

## Troubleshooting

### Webhook not working
- Check webhook URL format
- Verify SLACK_WEBHOOK_URL secret is set
- Test with curl command above
- Check Slack app permissions

### Too many notifications
- Adjust schedule in deployment-monitor.yml
- Change notification verbosity
- Mute channels if needed

### Missing deployments in Slack
- Check if workflow ran (Actions tab)
- Verify webhook secret is correct
- Check if channel exists
- Review workflow logs for errors
