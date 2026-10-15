# AI Safety, Guardrails & Content Filtering

MapsBridge enforces safety through eight independent layers. Each layer operates deterministically where possible --- regex-based checks, hard-coded limits, and structural validators run without calling a model, so they cannot be bypassed by prompt manipulation.

---

## Layer 1: PII Masking

**Source:** `guardrails.ts` --- `maskPII()`

Strips personally identifiable information before any text leaves the application boundary.

| Pattern                 | Example                      |
| ----------------------- | ---------------------------- |
| Credit card numbers     | `4111 1111 1111 1111`        |
| Email addresses         | `user@example.com`           |
| TC Kimlik numbers       | 11-digit Turkish national ID |
| Social Security Numbers | `123-45-6789`                |
| Phone numbers           | `+90 555 123 4567`           |

**Applied before:**

- RAG vector queries
- Training data collection
- All external API calls (Bedrock, third-party services)

Implementation is purely regex-based. No model is involved, so masking cannot be circumvented by adversarial prompts.

---

## Layer 2: Prompt Injection Detection

**Source:** `guardrails.ts` --- `validateTopicSafety()`

Scans inbound user messages for known injection patterns:

- **Jailbreak attempts** --- "ignore previous instructions", role-play exploits
- **DAN mode** --- "Do Anything Now" and variants
- **System prompt leaking** --- requests to reveal system prompts or internal configuration

When a pattern matches, the function returns a safety violation object containing the matched reason. The request is rejected before it reaches any model.

---

## Layer 3: Travel Domain Boundary

**Source:** `guardrails.ts` --- `validateTravelScope()`

Ensures the AI assistant remains within the travel planning domain. Requests outside scope are rejected with an explanatory message.

**Rejected topics include:**

- Programming and coding questions
- Cryptocurrency and financial trading
- Mathematical problem-solving
- Political commentary and debate

This boundary is enforced at the input layer, before tokens are spent on an out-of-scope query.

---

## Layer 4: Grounding Check

**Source:** `guardrails.ts` --- `performGroundingCheck()`

Validates model-generated claims against the RAG evidence that was provided in context. If the model asserts a fact that cannot be traced back to retrieved documents, the claim is flagged or removed.

This layer prevents hallucinated information --- fabricated hotel names, incorrect opening hours, or invented travel advisories --- from reaching the user.

---

## Layer 5: Output Validation

Three independent validators inspect structured output after generation:

### Supplement Validation

**Source:** `supplement-validation.ts`

Rejects unverified prices returned by sub-agents. If a price cannot be corroborated by a known data source, it is stripped from the response.

### Route Structure Validation

**Source:** `types.ts` --- `isRoutePlan()`

Validates that generated route plans conform to the expected schema. Malformed or incomplete route objects are rejected before they reach the client.

### Feasibility Validation

**Source:** `feasibility.ts`

Checks physical and logical constraints:

- **Time overlaps** --- two activities cannot occupy the same time slot
- **Transit gaps** --- travel time between locations must be realistic
- **Budget constraints** --- plan cost must not exceed stated budget
- **Weather alternatives** --- outdoor activities must have fallback options when weather data indicates risk

---

## Layer 6: Bedrock Guardrails

**Source:** `infra/terraform/guardrails.tf`

AWS Bedrock native guardrails are applied at the model invocation level. These are configured via Terraform and operate independently of application code.

Bedrock guardrails provide an additional content filtering boundary managed by AWS infrastructure, covering toxicity, hate speech, and other categories defined in the guardrail configuration.

---

## Layer 7: FinOps Work Limits

**Source:** `ai-finops.ts`

Hard limits enforced per model invocation and per request, preventing runaway costs from recursive agent calls or unexpectedly large outputs.

| Limit                         | Value  |
| ----------------------------- | ------ |
| Max output tokens per call    | 4,200  |
| Max input bytes per call      | 64 KB  |
| Max model calls per request   | 6      |
| Max output tokens per request | 14,000 |

Metering is request-scoped via `AsyncLocalStorage`. Each incoming request gets an isolated meter that tracks cumulative token usage across all model calls within that request. When any limit is hit, further model calls are blocked regardless of what the model or agent logic requests.

---

## Layer 8: Billing Controls

**Source:** `billing/store.ts`

Financial guardrails that prevent abuse and enforce subscription economics:

| Control               | Detail                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------- |
| Daily user limit      | 20 requests per user per day                                                            |
| System-wide daily cap | Configurable ceiling across all users                                                   |
| Credit reservation    | Credits are reserved before generation begins; if insufficient, the request is rejected |
| Wallet freeze         | Admin can freeze a user wallet, immediately halting all AI access                       |

Credit reservation happens synchronously before the first model call. If generation fails or is interrupted, reserved credits are released.

---

## Deterministic Safety Nets

Several critical paths bypass the LLM entirely to guarantee availability and correctness:

- **Emergency agent** --- Uses no LLM. Returns hardcoded embassy and consulate data (addresses, phone numbers, operating hours) from a static dataset. This ensures emergency information is always accurate and available, even during model outages.
- **Route agent** --- Maintains deterministic fallback routes for popular cities. If the model fails or returns an invalid plan, the fallback provides a known-good itinerary.
- **All guardrail layers (1--4)** --- Regex-based pattern matching. No model dependency means no latency variance, no token cost, and no susceptibility to adversarial prompts.

---

## Layer Interaction

The layers execute in order. A request must pass every layer before a response is delivered:

```
User Input
  --> Layer 1: PII Masking (strip sensitive data)
  --> Layer 2: Injection Detection (reject malicious prompts)
  --> Layer 3: Domain Boundary (reject off-topic queries)
  --> Layer 8: Billing Controls (reserve credits)
  --> Layer 7: Work Limits (allocate token budget)
  --> Layer 6: Bedrock Guardrails (model-level filtering)
  --> [Model Invocation]
  --> Layer 4: Grounding Check (validate against evidence)
  --> Layer 5: Output Validation (structure, feasibility, prices)
  --> Response to User
```

If any layer rejects the request, processing stops and the user receives an appropriate error message. Credits reserved in Layer 8 are released if rejection occurs after reservation.
