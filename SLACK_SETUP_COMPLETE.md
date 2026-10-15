# Slack Integration Setup - Complete Guide

Tüm CI/CD workflows Slack'a bildirim gönderiyor. Her kanal kendi webhook'u alıyor.

## 🎯 Adımlar

### 1. Slack Workspace'de Channels Oluştur

```bash
# Slack workspace'inde şu channels'ları oluştur:
#deployments     → Deployment success/fail events
#ci-status       → CI pass/fail events
#health-alerts   → Health check warnings
#incidents       → Critical failures
#dashboard       → Status updates every 15 min
```

### 2. Slack Apps Portal'da Webhooks Oluştur

**Her kanal için webhook oluştur:**

#### Webhook 1: #deployments

1. https://api.slack.com/apps
2. **Create New App** → **From scratch**
3. App name: `mapsbridge-deployments`
4. Workspace: Seç
5. **Incoming Webhooks** → Enable
6. **Add New Webhook to Workspace**
7. Channel seç: `#deployments`
8. URL'yi kopyala

#### Webhook 2: #ci-status

Aynı şekilde repeat:

- App name: `mapsbridge-ci`
- Channel: `#ci-status`

#### Webhook 3: #health-alerts

- App name: `mapsbridge-health`
- Channel: `#health-alerts`

#### Webhook 4: #incidents

- App name: `mapsbridge-incidents`
- Channel: `#incidents`

#### Webhook 5: #dashboard

- App name: `mapsbridge-dashboard`
- Channel: `#dashboard`

### 3. GitHub Secrets Ekle

GitHub repo → **Settings** → **Secrets and variables** → **Actions**

Her webhook'u GitHub secret olarak ekle:

```bash
# Deployment notifications
SLACK_WEBHOOK_DEPLOYMENTS=https://hooks.slack.com/services/YOUR/WEBHOOK/DEPLOYMENTS

# CI notifications
SLACK_WEBHOOK_CI=https://hooks.slack.com/services/YOUR/WEBHOOK/CI

# Health check alerts
SLACK_WEBHOOK_ALERTS=https://hooks.slack.com/services/YOUR/WEBHOOK/ALERTS

# Critical incidents
SLACK_WEBHOOK_INCIDENTS=https://hooks.slack.com/services/YOUR/WEBHOOK/INCIDENTS

# Status dashboard
SLACK_WEBHOOK_DASHBOARD=https://hooks.slack.com/services/YOUR/WEBHOOK/DASHBOARD
```

## 📊 Notification Mapping

| Event            | Webhook                   | Payload                                             |
| ---------------- | ------------------------- | --------------------------------------------------- |
| CI Pass          | SLACK_WEBHOOK_CI          | ✅ CI Passed - Ready to Deploy                      |
| CI Fail          | SLACK_WEBHOOK_CI          | ❌ CI Failed + test failures + auto-fix status      |
| Deploy Success   | SLACK_WEBHOOK_DEPLOYMENTS | 🚀 Deployment Complete - All Systems Live           |
| Deploy Failed    | SLACK_WEBHOOK_INCIDENTS   | ❌ Deployment Failed + logs link                    |
| Site Healthy     | SLACK_WEBHOOK_ALERTS      | ✅ All Systems Healthy                              |
| Issues Detected  | SLACK_WEBHOOK_ALERTS      | ⚠️ Deployment Issues Detected + recovery status     |
| Failure Detected | SLACK_WEBHOOK_INCIDENTS   | 🚨 Workflow Failure - Auto-Diagnostic + suggestions |
| Status Update    | SLACK_WEBHOOK_DASHBOARD   | 📊 System Status Dashboard                          |

## 🔄 Workflow Timeline

### Normal Deployment

```
1. Push to develop
   ↓
2. #ci-status: ✅ CI Passed (5-10 min)
   ↓
3. Auto-merge to main
   ↓
4. #deployments: 🚀 Deployment Started
   ↓
5. (25-35 min later)
   ↓
6. #deployments: 🚀 Deployment Complete - All Systems Live
   ↓
7. Every 5 min: #health-alerts: ✅ All Systems Healthy
   ↓
8. Every 15 min: #dashboard: 📊 System Status Dashboard
```

### Failed Deployment

```
1. Push to develop
   ↓
2. #ci-status: ❌ CI Failed + auto-fix status
   ↓
3. (auto-fix attempts...)
   ↓
4. If fixed → #ci-status: ✅ Auto-Fixed
   ↓
5. If not fixed → #incidents: 🚨 Workflow Failure + diagnostics
```

### Health Issues

```
Every 5 minutes:
   ↓
Check site, API, Lambda
   ↓
If OK: #health-alerts: ✅ All Systems Healthy (quiet)
   ↓
If Issue:
   → #health-alerts: ⚠️ Issues Detected + recovery status
   → Auto-recovery attempts
   → If fails → #incidents: Manual intervention needed
```

## 🧪 Test

### Test Webhook Locally

```bash
# Test each webhook
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test from GitHub Actions"}' \
  https://hooks.slack.com/services/YOUR/WEBHOOK/DEPLOYMENTS

# Should see message in #deployments channel
```

### Test with GitHub Actions

```bash
# Push to develop branch (triggers CI)
git checkout develop
git commit --allow-empty -m "test: trigger CI"
git push origin develop

# Watch #ci-status for notification
# Wait for auto-merge
# Watch #deployments for deploy notification
# Monitor #health-alerts for health checks
```

## 📋 Workflows & Their Notifications

### 1. **CI Workflow** (on develop push)

- **Success** → #ci-status: ✅ CI Passed
- **Failure** → #ci-status: ❌ CI Failed

### 2. **CI Monitor** (on CI complete)

- **Auto-fixed** → #ci-status: ✅ Auto-Fixed
- **Still failing** → #incidents: 🔍 Issues Need Manual Fix

### 3. **Deploy Workflow** (on main push)

- **Success** → #deployments: 🚀 Deployment Complete
- **Failure** → #incidents: ❌ Deployment Failed

### 4. **Deployment Monitor** (every 5 min)

- **Healthy** → #health-alerts: ✅ All Systems Healthy
- **Issues** → #health-alerts: ⚠️ Issues Detected
- **Recovery failed** → #incidents: 🚨 Manual Intervention

### 5. **Auto Troubleshoot** (on failures)

- **Diagnosed** → #incidents: 🔍 Auto-Diagnostic Report

### 6. **Status Dashboard** (every 15 min)

- **Always** → #dashboard: 📊 System Status Update

## 🔧 Customization

### Change Notification Frequency

Edit workflow `.yml` files:

```yaml
# deployment-monitor.yml - change from 5 min to 10 min
schedule:
  - cron: "*/10 * * * *" # Every 10 minutes

# status-dashboard.yml - change from 15 min to 30 min
schedule:
  - cron: "*/30 * * * *" # Every 30 minutes
```

### Add More Channels

1. Create new Slack channel
2. Create new webhook for that channel
3. Add GitHub secret: `SLACK_WEBHOOK_NEWCHANNEL`
4. Edit workflow `.yml`:
   ```yaml
   - name: Slack Notification - NewEvent
     uses: slackapi/slack-github-action@v1.24.0
     with:
       webhook-url: ${{ secrets.SLACK_WEBHOOK_NEWCHANNEL }}
       payload: |
         { ... }
   ```

### Disable Notifications

Comment out the Slack notification steps in workflows:

```yaml
# - name: Slack Notification
#   uses: slackapi/slack-github-action@v1.24.0
#   ...
```

Or disable workflow:

```bash
gh workflow disable deployment-monitor.yml
```

## 🐛 Troubleshooting

### Webhook not working

- Check webhook URL format
- Verify secret is set correctly
- Test with curl
- Check Slack app channel permissions

### Too many notifications

- Increase schedule interval
- Mute channel notifications
- Disable specific workflows

### Missing some notifications

- Check webhook URL in GitHub Secrets
- Verify workflow `.yml` has correct webhook reference
- Check Slack app permissions for channel

### Webhook expired

- Webhooks don't expire
- If not working, regenerate new one in Slack portal
- Update GitHub secret with new URL

## 📞 Support

For issues:

1. Check GitHub Actions logs: Actions tab
2. Check Slack app logs: https://api.slack.com/apps
3. Verify webhook URL format
4. Test webhook with curl command above
