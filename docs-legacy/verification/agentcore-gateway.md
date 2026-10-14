# AgentCore Gateway production preparation — 2026-09-29

## Implemented

Real IAM/SigV4 MCP client, bounded Places Lambda tool, opt-in supervisor routing, response validation, metadata-only call logging, independent Terraform stack, AI Lambda environment wiring, bundle and live verification scripts. Existing consent-based AgentCore Memory remains in place. Runtime migration and full OTEL tracing are not implemented.

## Verification

- Web suite: 131/131 passed (includes all 11 Gateway tests).
- Backend suite: 117/117 passed, including billing idempotency, refunds and memory consent.
- Gateway focused suite after adding query-limit/privacy and cancellation coverage: 11/11 passed.
- `npm --prefix apps/web run typecheck`: passed. Gateway Lambda also passed a standalone TypeScript check with the project-compatible ESNext/bundler module settings.
- Existing AI bundle and new Gateway tool bundle: passed. Target zip is approximately 200 KiB.
- New Gateway Terraform: init, fmt check, validate and static IAM policy check passed with AWS provider 6.66.0.
- Existing admin-runtime Terraform: validate passed; its provider was not upgraded.
- AWS-account-backed Terraform plan: **10 create, 0 change, 0 destroy**. Saved locally as `infra/agentcore-gateway/gateway.tfplan`. No apply executed.
- Dependency installation audit: zero reported vulnerabilities.
- Read-only live Gateway smoke test on 2026-10-08: **passed**, 22 validated Places returned in 2108 ms using the existing Terraform output. No application or Terraform mutation was performed.

## Release boundary

Gateway live invocation is now verified as a read-only smoke check, but it is not claimed to be enabled on live application traffic by this work. Actual cold/warm latency characterization, effective IAM denial and end-to-end plan billing remain release checks. The existing 30-second synchronous request deadline still applies; Gateway integration does not make long tasks asynchronous. No cost reduction has been measured or claimed.

Runbook: [infra/agentcore-gateway/README.md](../../infra/agentcore-gateway/README.md).
