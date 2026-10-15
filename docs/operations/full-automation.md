# Full Automation CI/CD Pipeline

Tamamen otomatik deployment, monitoring, troubleshooting ve recovery sistemi.

## 🏗️ Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────┐
│                    GIT PUSH (develop)                        │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   CI WORKFLOW                               │
│ • Secret scan                                               │
│ • Lint & format                                             │
│ • Typecheck                                                 │
│ • Tests (567/567)                                           │
│ • Terraform validate                                        │
│ • CI MONITOR (auto-fix failures)                            │
└────────────┬────────────────────────────────────────────────┘
             │
       ✅ if success ✅
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                 AUTO-MERGE WORKFLOW                         │
│ • Create PR develop → main                                  │
│ • Auto-merge on approval                                    │
│ • Trigger deploy workflow                                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│               DEPLOY WORKFLOW (parallel)                    │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Infrastructure (Terraform)                          │   │
│ │ • Init & validate                                   │   │
│ │ • Plan & apply                                      │   │
│ └──────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Web Deploy                                          │   │
│ │ • S3 sync                                           │   │
│ │ • CloudFront invalidate                             │   │
│ └──────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Lambda Deploy                                       │   │
│ │ • Package ZIP                                       │   │
│ │ • Update functions                                  │   │
│ └──────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Mobile Deploy (EAS)                                 │   │
│ │ • Build iOS                                         │   │
│ │ • Build Android                                     │   │
│ │ • Auto-submit to stores                             │   │
│ └──────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ AUTO-TROUBLESHOOT                                   │   │
│ │ • Detect failures                                   │   │
│ │ • Create diagnostic issues                          │   │
│ │ • Suggest fixes                                     │   │
│ └──────────────────────────────────────────────────────┘   │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│               SMOKE TEST (after all)                        │
│ • Check site HTTP 200                                       │
│ • Check API health                                          │
│ • Generate summary                                          │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│        DEPLOYMENT MONITOR (every 5 minutes)                 │
│ • Site health check                                         │
│ • API health check                                          │
│ • Lambda functions status                                   │
│ • Auto-recovery on failure                                  │
│ • Slack notifications                                       │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│       STATUS DASHBOARD (every 15 minutes)                   │
│ • Update README with status                                 │
│ • Generate JSON report                                      │
│ • Send Slack dashboard notification                         │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Workflows

### 1. **CI Workflow** (ci.yml)
**Trigger:** Push to develop
**Duration:** 5-10 min

```yaml
- Secret scan (Gitleaks)
- Lint & format (Prettier, ESLint)
- Typecheck (TypeScript)
- Tests (Node.js, Jest)
- Terraform validate
- → CI Monitor (auto-fix) ✅
```

**Auto-Fix Capabilities:**
- Prettier formatting
- ESLint auto-fix
- Import sort
- Lint rule fixes

### 2. **Auto-Merge Workflow** (auto-merge.yml)
**Trigger:** CI success on develop
**Duration:** 1 min

```yaml
- Check diff vs main
- Create PR develop → main
- Auto-merge with admin override
- Trigger deploy workflow
```

### 3. **Deploy Workflow** (deploy.yml)
**Trigger:** Push to main
**Duration:** 25-35 min

```yaml
PARALLEL:
- Build (web + lambda)
  ├─ npm ci
  ├─ Next.js build
  └─ Upload artifact
- Terraform
  ├─ Init
  ├─ Validate
  └─ Apply (infrastructure)
- Deploy Web
  ├─ Download artifact
  ├─ S3 sync
  └─ CloudFront invalidate
- Deploy Lambda
  ├─ Package ZIP
  └─ Update functions
- Deploy Mobile (EAS)
  ├─ Build iOS
  ├─ Build Android
  └─ Auto-submit to stores
- Smoke Test
  ├─ Check site
  ├─ Check API
  └─ Report
```

### 4. **Deployment Monitor** (deployment-monitor.yml)
**Trigger:** Every 5 minutes (scheduled)
**Duration:** 30 sec

```yaml
- Check site (HTTP 200)
- Check API (/health)
- Check Lambda functions
- Auto-recovery if issues:
  ├─ CloudFront invalidate
  ├─ Lambda rollback
  └─ Retry health checks
- Slack notification
- Create GitHub issue if failed
```

### 5. **CI Monitor** (ci-monitor.yml)
**Trigger:** CI workflow completion
**Duration:** 2-5 min

```yaml
- Analyze test failures
- Auto-fix:
  ├─ prettier --write
  ├─ eslint --fix
  └─ npm ci --prefer-offline
- Generate report
- Slack notification
```

### 6. **Auto Troubleshoot** (auto-troubleshoot.yml)
**Trigger:** Deploy/CI failure
**Duration:** 1 min

```yaml
- Detect failure type:
  ├─ Missing files
  ├─ Permission denied
  ├─ NPM error
  ├─ Action error
  ├─ Network error
  ├─ Terraform error
  └─ Test failure
- Generate fix suggestions
- Create diagnostic GitHub issue
- Slack notification with details
```

### 7. **Status Dashboard** (status-dashboard.yml)
**Trigger:** Every 15 minutes (scheduled)
**Duration:** 30 sec

```yaml
- Collect metrics:
  ├─ Latest deploy status
  ├─ Latest CI status
  ├─ Site health
  └─ API health
- Update README with status
- Generate JSON report
- Upload artifact
- Slack dashboard notification
```

## 🔔 Notification Channels

### Slack Integration

**Required Setup:**
```bash
# 1. Create Slack app: https://api.slack.com/apps
# 2. Enable Incoming Webhooks
# 3. Create channels:
#    - #deployments (deploy events)
#    - #ci-status (CI events)
#    - #health-alerts (health checks)
#    - #incidents (critical alerts)
#    - #rollbacks (recovery actions)

# 4. Add GitHub secret:
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK
```

### Notification Types

| Event | Channel | Format |
|-------|---------|--------|
| CI Pass | #ci-status | ✅ CI Passed |
| CI Fail | #ci-status | ❌ CI Failed + auto-fix status |
| Deploy Start | #deployments | 🚀 Deploy Started |
| Deploy Success | #deployments | ✅ Deploy Complete |
| Deploy Fail | #deployments + #incidents | ❌ Deploy Failed + auto-troubleshoot |
| Site Down | #health-alerts | ❌ Site Down + recovery status |
| Recovery Success | #health-alerts | ✅ Issue Resolved |
| Recovery Failed | #incidents | 🚨 Manual Intervention Needed |
| Status Update | #deployments | 📊 System Status Report |

## 🛠️ Auto-Recovery

### Automatic Actions on Failure

1. **Site Down (5 min check interval)**
   - CloudFront cache invalidate
   - Check site again
   - If still down → escalate

2. **Lambda Unhealthy**
   - Update function aliases (rollback)
   - Check health again
   - If still unhealthy → escalate

3. **CI Tests Fail**
   - Auto-fix formatting/linting
   - Re-run tests
   - If still fail → create issue

4. **Deploy Fails**
   - Detect failure type
   - Suggest fixes in issue
   - Wait for manual fix

### Manual Intervention

If auto-recovery fails:
1. GitHub issue created with diagnostics
2. Slack #incidents notification
3. Suggested fixes in issue
4. @oncall page sent
5. Manual fix required

## 📊 Monitoring & Observability

### Health Checks (every 5 min)

```bash
✓ Site HTTP 200 response
✓ API /health endpoint responding
✓ Lambda functions in "Active" state
✓ Database connectivity (implicit in API checks)
✓ CloudFront distribution enabled
```

### Metrics Collected

```json
{
  "timestamp": "2026-10-15T13:04:00Z",
  "system": {
    "site_status": "healthy",
    "api_status": "healthy"
  },
  "pipelines": {
    "deploy": "success",
    "ci": "success"
  },
  "monitoring": {
    "interval_minutes": 5,
    "auto_recovery": true,
    "auto_troubleshoot": true
  }
}
```

### Dashboard

Auto-updated every 15 minutes in README:
- System health (site, API, database)
- Recent deployments status
- Quick links to logs
- Configuration summary

## 🚨 Alerting & Escalation

### Alert Levels

| Level | Condition | Action | Notification |
|-------|-----------|--------|--------------|
| 🟢 Info | Deploy success | Log only | #deployments |
| 🟡 Warning | Health check fail | Auto-recover + monitor | #health-alerts |
| 🔴 Error | Auto-recovery fails | Create issue + escalate | #incidents |
| 🚨 Critical | Site down > 10 min | Page oncall + page | @channel |

### Escalation Timeline

```
T+0:00   Issue detected
T+0:05   Auto-recovery attempt 1
T+0:10   Auto-recovery attempt 2
T+0:15   Create GitHub issue
T+0:20   Slack #incidents notification
T+0:30   Auto-troubleshoot creates diagnostic issue
T+1:00   Manual intervention required
```

## ⚙️ Configuration

### Required GitHub Secrets

```bash
# AWS
AWS_DEPLOY_ROLE_ARN
WEB_BUCKET
CLOUDFRONT_DISTRIBUTION_ID

# Cognito
COGNITO_CLIENT_ID
COGNITO_USER_POOL_ID

# APIs
API_BASE_URL
GOOGLE_MAPS_API_KEY
GOOGLE_CLIENT_ID
AI_STREAM_URL

# Expo
EAS_TOKEN

# Slack
SLACK_WEBHOOK_URL  ← ADD THIS
```

### Terraform Config

Create `infra/terraform/prod.tfvars`:
```hcl
rc_secret_api_key       = "sk_..."
rc_webhook_auth_secret  = "webhook_..."
# ... other vars
```

## 🎯 Key Features

✅ **Fully Automated**
- No manual trigger needed
- develop push → full deployment pipeline
- Auto-merge on CI success
- Auto-fix on common issues

✅ **Self-Healing**
- Detect failures automatically
- Attempt recovery automatically
- Create diagnostic issues
- Escalate if needed

✅ **Observable**
- Real-time Slack notifications
- Status dashboard in README
- GitHub issues for diagnostics
- Workflow logs with details

✅ **Fast Feedback**
- CI: 5-10 min
- Deploy: 25-35 min
- Monitor: 5 min intervals
- Alert: < 1 min

✅ **No Manual Work**
- Formatting auto-fixed
- Tests auto-analyzed
- Failures auto-diagnosed
- Recovery auto-attempted

## 📋 Setup Checklist

- [ ] Add SLACK_WEBHOOK_URL to GitHub Secrets
- [ ] Create Slack channels (#deployments, #ci-status, etc.)
- [ ] Create AWS_DEPLOY_ROLE_ARN for GitHub OIDC
- [ ] Create prod.tfvars in infra/terraform/
- [ ] Test deployment: Push to develop
- [ ] Check Slack notifications
- [ ] Monitor first deployment
- [ ] Verify auto-recovery works

## 🔗 Quick Links

- [Deployment Monitor Logs](https://github.com/sahinbolukbasi/mapsbridge/actions/workflows/deployment-monitor.yml)
- [CI Monitor Logs](https://github.com/sahinbolukbasi/mapsbridge/actions/workflows/ci-monitor.yml)
- [Auto Troubleshoot Logs](https://github.com/sahinbolukbasi/mapsbridge/actions/workflows/auto-troubleshoot.yml)
- [Status Dashboard](https://github.com/sahinbolukbasi/mapsbridge/actions/workflows/status-dashboard.yml)
- [GitHub Issues](https://github.com/sahinbolukbasi/mapsbridge/issues?q=label%3Aauto-diagnosed)

## 🐛 Troubleshooting

### Workflows not triggering
- Check branch protection rules
- Verify GitHub Actions enabled
- Check workflow syntax

### Slack notifications not working
- Verify SLACK_WEBHOOK_URL is correct
- Test webhook with curl
- Check Slack channel permissions

### Auto-fix not working
- Check if issue is auto-fixable
- Review CI logs
- May require manual fix

### Too many notifications
- Adjust schedule intervals
- Disable non-critical workflows
- Mute Slack channels

