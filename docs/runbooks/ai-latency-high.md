# Runbook: AI Endpoint Latency High

**Alarm:** `{project}-{env}-ai-lambda-latency-p95` — AI Lambda p95 duration > 5000ms over 15 min  
**SLO impact:** Latency (AI target: p95 < 5s)

---

## Symptoms

- CloudWatch alarm `ai-lambda-latency-p95` in ALARM state
- Users experience slow or timing-out route-planner responses (`POST /ai/route-planner`)
- `Duration` p95 for `{project}-{env}-api-ai` Lambda exceeds 5000ms

## Likely Causes

| Cause                                 | Signal                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------ |
| Bedrock model throttling              | `ThrottlingException` in Lambda logs; Bedrock `ThrottledRequests` metric |
| Large context / high token count      | `MapsBridge/TravelAI RequestTokens` metric elevated                      |
| Bedrock service degradation           | AWS Health Dashboard alert for Bedrock in eu-central-1                   |
| Oversized model selected              | High duration correlates with a specific model ID                        |
| Concurrent requests exhausting Lambda | `ConcurrentExecutions` near limit                                        |

## Investigation

**1. Check Bedrock throttle metrics:**

- CloudWatch: `AWS/Bedrock`, `ThrottledRequests`, model dimension
- Or in Lambda logs:

```sql
-- CloudWatch Logs Insights — /aws/lambda/{project}-{env}-api-ai
fields @timestamp, @message
| filter @message like /ThrottlingException|ThrottledRequests/
| sort @timestamp desc
| limit 20
```

**2. Check token usage trend:**

```sql
-- CloudWatch Logs Insights — /aws/lambda/{project}-{env}-api-ai
fields @timestamp, @message
| filter @message like /inputTokens|outputTokens/
| parse @message '"inputTokens":*,' as inputTokens
| stats avg(inputTokens), max(inputTokens) by bin(5m)
```

**3. Check Bedrock service health:**

```
https://health.aws.amazon.com/health/status
```

Filter for region `eu-central-1`, service `Amazon Bedrock`.

**4. Review request queue depth:**

- CloudWatch: `AWS/Lambda`, `ConcurrentExecutions`, FunctionName = `{project}-{env}-api-ai`

## Mitigation

**Bedrock throttling → reduce concurrency or switch model:**

```bash
# Lower Lambda reserved concurrency to prevent burst of Bedrock calls
aws lambda put-function-concurrency \
  --function-name {project}-{env}-api-ai \
  --reserved-concurrent-executions 10
```

Or update `var.bedrock_model_id` in `terraform.tfvars` to a faster/higher-quota model and redeploy.

**Reduce max_tokens to cut latency:**

- In `services/ai-assistant/` or the Lambda handler, lower the `max_tokens` parameter passed to Bedrock.
- Each output token adds ~20ms; reducing from 2000 → 1000 tokens can halve latency.

**Enable Bedrock request queuing (on-demand throughput):**

- In the Bedrock console, request a provisioned throughput increase for the model in use.
- Or contact AWS Support to raise the RPM quota for `anthropic.claude-*` models in eu-central-1.

**Temporary degraded mode:**

- Set `AI_DAILY_REQUEST_LIMIT = 0` via SSM/env update to gate new AI requests while investigating.
- This surfaces a 503 to clients rather than a slow timeout.

---

_Last reviewed: 2026-10_
