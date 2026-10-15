# Runbook: Stripe DLQ Depth

**Alarm:** `{project}-{env}-stripe-dlq-depth` — DLQ `ApproximateNumberOfMessagesVisible` > 0  
**SLO impact:** Reliability — payment events unprocessed (revenue risk)

---

## Symptoms
- CloudWatch alarm `stripe-dlq-depth` in ALARM state
- Stripe webhook events not being processed (subscription changes, payment confirmations delayed)
- DLQ `{project}-{env}-payments-stripe-webhooks-dlq` has > 0 messages visible

## Likely Causes
| Cause | Signal |
|---|---|
| Lambda handler crash (unhandled exception) | `ERROR` in Lambda logs; `Errors` metric elevated for `stripe` function |
| Stripe event schema change | `ValidationError` / JSON parse failure in logs |
| Idempotency key conflict | DuplicateError or unique constraint in DynamoDB |
| Downstream service unavailable (DynamoDB, Secrets Manager) | Connection/timeout errors in Lambda logs |
| Lambda timeout (> 300s processing) | `Task timed out` in CloudWatch logs |

## Investigation

**1. Inspect DLQ messages:**
```bash
aws sqs receive-message \
  --queue-url https://sqs.eu-central-1.amazonaws.com/{account}/{project}-{env}-payments-stripe-webhooks-dlq \
  --max-number-of-messages 5 \
  --attribute-names All
```
Note the `ApproximateReceiveCount` — how many times each message was retried.

**2. Find the exact error in Lambda logs:**
```sql
-- CloudWatch Logs Insights — /aws/lambda/{project}-{env}-api-stripe
fields @timestamp, @message
| filter @message like /ERROR|fail|exception/i
| sort @timestamp desc
| limit 30
```

**3. Correlate with Stripe dashboard:**
- Stripe Dashboard → Developers → Webhooks → select the endpoint → Recent deliveries
- Compare event IDs in DLQ messages against Stripe's delivery log to confirm the payload

**4. Check DynamoDB for throttles or constraint violations:**
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ThrottledRequests \
  --dimensions Name=TableName,Value={project}-{env}-data \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 \
  --statistics Sum
```

## Mitigation

**Fix the handler, then replay the DLQ:**
```bash
# After deploying the fix, redrive messages back to the main queue
aws sqs start-message-move-task \
  --source-arn arn:aws:sqs:eu-central-1:{account}:{project}-{env}-payments-stripe-webhooks-dlq \
  --destination-arn arn:aws:sqs:eu-central-1:{account}:{project}-{env}-payments-stripe-webhooks
```

**Schema change → update handler:**
- Update the Stripe event parser in `services/identity-billing/` to handle the new schema
- Deploy, then replay DLQ (see above)

**Idempotency key conflict → purge duplicate:**
- Identify the duplicate event ID in the DLQ message body
- Manually delete the duplicate DLQ message:
```bash
aws sqs delete-message \
  --queue-url https://sqs.eu-central-1.amazonaws.com/{account}/{project}-{env}-payments-stripe-webhooks-dlq \
  --receipt-handle <receipt-handle-from-receive>
```

**Contact Stripe support:**
- If events are malformed on Stripe's side or if webhook signatures are failing, open a ticket at https://support.stripe.com
- Include the event ID and the raw payload from the DLQ message

---
*Last reviewed: 2026-10*
