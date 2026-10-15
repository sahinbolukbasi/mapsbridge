# Runbook: API 5xx Spike

**Alarm:** `{project}-{env}-api-5xx-rate` — 5xx rate > 0.1% over 15 min  
**SLO impact:** Availability (target 99.9%)

---

## Symptoms

- CloudWatch alarm `api-5xx-rate` or `lambda-{auth|ai|stripe}-error-rate` in ALARM state
- Users report 500/502/503 errors from the API
- Elevated `5XXError` count in API Gateway metrics

## Likely Causes

| Cause                        | Signal                                                              |
| ---------------------------- | ------------------------------------------------------------------- |
| Lambda cold start timeout    | `Init Duration` spikes in Lambda logs, errors cluster after deploys |
| Bad deploy (runtime error)   | Error rate rises immediately after a deployment                     |
| DynamoDB throttle            | `ThrottledRequests` metric > 0 in DynamoDB console                  |
| Downstream dependency down   | Errors in Lambda logs reference external host / Aurora / Redis      |
| Lambda concurrency exhausted | `ConcurrentExecutions` at account limit                             |

## Investigation

**1. Pinpoint which Lambda is erroring:**

```sql
-- CloudWatch Logs Insights — run against /aws/lambda/{project}-{env}-api-*
fields @timestamp, @message, @logStream
| filter @message like /ERROR/
| stats count() as errors by @logStream
| sort errors desc
| limit 20
```

**2. Check for recent deploys:**

```bash
# GitHub Actions — review last 3 deploy runs
gh run list --workflow deploy.yml --limit 3
```

**3. Check DynamoDB throttles:**

- Console: DynamoDB → Tables → `{project}-{env}-data` → Metrics → Throttled requests
- Or CloudWatch: `AWS/DynamoDB`, `ThrottledRequests`, table dimension

**4. Check Lambda concurrency:**

- CloudWatch → Lambda → `ConcurrentExecutions` across all functions

**5. Tail live logs for the failing function:**

```bash
aws logs tail /aws/lambda/{project}-{env}-api-auth --follow --since 10m
```

## Mitigation

**Bad deploy → rollback:**

```bash
gh workflow run deploy.yml -f environment=prod -f rollback=true
# or manually re-run the previous successful deploy job
```

**DynamoDB throttle → request on-demand or raise capacity:**

- Switch table billing mode to PAY_PER_REQUEST temporarily in the console
- Or increase provisioned RCU/WCU as a stopgap

**Lambda cold start → pre-warm or raise concurrency:**

```bash
aws lambda put-provisioned-concurrency-config \
  --function-name {project}-{env}-api-auth \
  --qualifier \$LATEST \
  --provisioned-concurrent-executions 5
```

**Downstream service down:**

- Check Aurora: RDS console → Cluster → Events
- Check Redis: ElastiCache console → Cluster → Events
- If Aurora unavailable, Lambda will fail fast — consider returning 503 with Retry-After header

---

_Last reviewed: 2026-10_
