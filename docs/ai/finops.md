# AI FinOps & Cost Management

MapsBridge tracks AI costs at every level --- per model call, per request, per user, and across the system. Cost controls are enforced deterministically at the infrastructure layer, not by the model itself.

---

## Cost Flow

```
User Request
     |
     v
+--------------------+
| Credit Reservation |  billing/store.ts
| (debit wallet)     |  Fail-fast if insufficient credits
+--------------------+
     |
     v
+--------------------+
| Work Limit Check   |  ai-finops.ts
| (token budgets)    |  Enforce per-call and per-request caps
+--------------------+
     |
     v
+--------------------+
| Model Invocation   |  Bedrock API call
| (1..N calls)       |  Up to 6 calls per request
+--------------------+
     |
     v
+--------------------+
| Cost Tracking      |  ai-finops.ts
| (per-call meter)   |  estimateModelCost() after each call
+--------------------+
     |
     v
+--------------------+
| CloudWatch Metrics |  EMF emission via emitFinOps()
| (observability)    |  Dimensions: model, region, environment
+--------------------+
     |
     v
+--------------------+
| Billing Settlement |  billing/store.ts
| (reconcile wallet) |  Release unused reserved credits
+--------------------+
```

---

## 1. Per-Invocation Cost Tracking

**Source:** `ai-finops.ts` (~120 lines)

### Rate Cards

Cost estimation uses operator-configured rate cards supplied via the `AI_MODEL_RATES_JSON` environment variable. Each entry maps a model identifier to per-token pricing (input and output rates). This allows pricing to be updated without code changes when contracts are renegotiated.

### Core Functions

| Function | Purpose |
|---|---|
| `estimateModelCost()` | Calculates cost for a single model call using the rate card and actual token counts |
| `reserveModelWork()` | Claims token budget from the request-scoped meter; rejects if limits would be exceeded |
| `withAIRequestMeter()` | Wraps a request handler, attaching an isolated meter via `AsyncLocalStorage` |
| `requestCostSummary()` | Returns aggregate stats for the current request: total tokens, total cost, call count |

### Request-Scoped Metering

Each HTTP request runs inside a `withAIRequestMeter()` context. The meter tracks:

- Cumulative input tokens
- Cumulative output tokens
- Number of model calls
- Estimated cost (sum of all `estimateModelCost()` results)

Because metering uses `AsyncLocalStorage`, concurrent requests never interfere with each other, and the meter follows execution across `async/await` boundaries.

---

## 2. CloudWatch Metrics

**Source:** `emitFinOps()` in `ai-finops.ts`

Metrics are emitted in AWS Embedded Metric Format (EMF), which allows CloudWatch to ingest structured metrics from log output without a custom metrics agent.

### Dimensions

| Dimension | Example Values |
|---|---|
| `model` | `anthropic.claude-3-haiku`, `anthropic.claude-3-sonnet` |
| `region` | `eu-west-1`, `us-east-1` |
| `environment` | `production`, `staging` |

### Metrics

| Metric | Unit |
|---|---|
| `input_tokens` | Count |
| `output_tokens` | Count |
| `estimated_cost` | USD (float) |
| `duration_ms` | Milliseconds |

These metrics feed the CloudWatch dashboards and alarms defined in Terraform (see Section 6).

---

## 3. Credit Economy

### Action Costs

Each user action consumes a fixed number of credits, independent of actual token usage:

| Action | Credit Cost |
|---|---|
| Clarify (follow-up question) | 0 |
| Chat (general conversation) | 1 |
| Route (itinerary generation) | 5 |

### Model Tier Costs

Model tier pricing is defined in service contracts. When a request uses a higher-tier model, the additional cost is applied:

| Tier | Additional Credit Cost | Typical Use |
|---|---|---|
| Tier 1 | 0 | Lightweight classification, routing |
| Tier 2 | 0.5 | Clarification, simple chat |
| Tier 3 | 2 | Standard generation |
| Tier 4 | 5 | Complex multi-step planning |

### Subscription Plans

| Plan | Price (TL/month) | Credits Included |
|---|---|---|
| Explorer | 199 | 100 |
| Pro | 499 | 500 |
| Agency | 1,499 | 2,500 |

### Credit Packs (one-time purchase)

| Pack | Price (TL) | Credits |
|---|---|---|
| Starter | 89 | 50 |
| Popular | 299 | 300 |
| Master | 749 | 1,000 |
| Pro | 1,899 | 3,000 |

---

## 4. Client-Side Analytics

**Sources:** `finops-dashboard.ts`, `finops-summary.ts`

These modules aggregate cost data for display in admin interfaces and internal dashboards.

| Function | Purpose |
|---|---|
| `calculateCompletedPlanCost()` | Breaks down cost for a single completed travel plan: tokens by agent, model tier costs, credit consumption |
| `aggregateFinOpsMetrics()` | Produces summary statistics across all plans in a time window: total spend, average cost per plan, cost by model |
| `getCostAllocationTags()` | Returns cost allocation grouped by agent role (route agent, chat agent, emergency agent, etc.) for chargeback or analysis |

---

## 5. Work Limits

**Source:** `ai-finops.ts`

Hard limits are enforced at the infrastructure level. They are not advisory --- exceeding any limit causes the current model call or request to be rejected.

| Limit | Scope | Value |
|---|---|---|
| Max model calls | Per request | 6 |
| Max output tokens | Per call | 4,200 |
| Max output tokens | Per request | 14,000 |
| Max input size | Per call | 64 KB |

### Why These Values

- **6 calls per request** prevents unbounded agent loops. A typical route plan requires 2--4 model calls (clarify, plan, supplement, validate). The limit of 6 provides headroom without allowing runaway recursion.
- **4,200 output tokens per call** caps individual responses. A detailed day-by-day itinerary fits comfortably within this limit.
- **14,000 output tokens per request** caps the total generation across all calls. This ensures a single user request cannot monopolize capacity.
- **64 KB input per call** prevents excessively large context windows from inflating costs. RAG results and conversation history are truncated to fit.

---

## 6. Terraform Infrastructure

### Dedicated FinOps Stack

**Source:** `infra/ai-finops/main.tf`

A standalone Terraform stack for AI cost management resources. Separated from the main infrastructure to allow independent deployment and iteration.

### CloudWatch Dashboards and Alarms

| File | Purpose |
|---|---|
| `infra/terraform/finops.tf` | Core FinOps resources: metric filters, log groups, IAM roles for metric emission |
| `infra/terraform/finops-dashboard.tf` | CloudWatch dashboard definition: cost over time, tokens by model, cost by region |
| `infra/terraform/ai-alarms.tf` | AI-specific alarms: cost spike detection, token usage anomalies, error rate thresholds |

Alarms trigger SNS notifications that can be routed to Slack, email, or PagerDuty depending on operator configuration.

---

## 7. Admin Controls

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/ai-operations` | View real-time cost metrics: active requests, token consumption rate, estimated spend for current period |
| `POST` | `/admin/ai-control` | Emergency controls: disable AI system-wide, adjust rate limits, toggle specific agents |
| `GET` | `/admin/credit-stats` | Credit economy dashboard: credits granted vs. consumed vs. remaining, breakdown by module, top consumers by user |
| `GET` | `/admin/token-usage` | Token usage overview: total tokens by model, average tokens per request, trend data |

### Kill Switch

`POST /admin/ai-control` with `{ "enabled": false }` immediately disables all AI features across the platform. Requests in flight complete, but new model calls are rejected. This is the fastest path to zero AI spend in an incident.

---

## Cost Optimization Practices

1. **Tier routing** --- Simple queries (clarifications, yes/no) use Tier 1 models. Only complex planning tasks escalate to Tier 3 or Tier 4.
2. **Early rejection** --- Domain boundary checks and billing controls run before any model call, avoiding token spend on requests that would ultimately fail.
3. **Credit reservation** --- Credits are reserved before generation. If a request is rejected by guardrails mid-flight, unused credits are returned to the user wallet.
4. **Deterministic fallbacks** --- Emergency and popular-route queries bypass the model entirely, consuming zero tokens.
5. **Request-scoped budgets** --- Each request has a fixed token ceiling. Even if agent logic requests additional calls, the meter enforces the cap.
