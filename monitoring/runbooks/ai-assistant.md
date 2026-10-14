# AI Assistant alarm runbook

All alarms use `MapsBridge/TravelAI` EMF metrics and the `Environment` dimension. Do not add user IDs, prompts, conversation IDs, or place coordinates to alarm dimensions.

## Request failure rate > 2%

1. Check `RequestFailures`, `Requests`, and `RequestLatencyMs` in the AI dashboard.
2. Compare `ModelFailures`, `Timeouts`, and `UnpricedModelCalls` for the same period.
3. If failures are provider-related, verify Bedrock model access and throttling; if research-related, verify AgentCore Gateway and Amazon Location health.
4. Keep route generation fail-closed when research is unavailable. Roll back only after confirming the failure is deployment-related.

## Request p95 latency > 15 seconds

1. Separate `ModelLatencyMs` from research and memory operation logs.
2. Check whether intake, research, or final answer is consuming the configured timeout budget.
3. Reduce traffic or model work limits before raising timeouts.
4. Preserve the user-visible partial/clarify response rather than returning unbounded model reasoning.

## Provider or research timeout rate > 5%

1. Check `Timeouts` against `ModelCalls` and AgentCore Gateway timeout logs.
2. Confirm the configured one-attempt policy and bounded abort signals are active.
3. Do not enable retries globally; investigate throttling, entitlement, or downstream latency first.
4. Research timeout must not produce an unresearched route; refund/idempotency behavior must remain intact.
