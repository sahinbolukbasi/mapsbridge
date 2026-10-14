# Live smoke verification — 2026-10-08

## Read-only checks

- AWS region: `eu-central-1`
- AgentCore Gateway Terraform output: present
- AgentCore Gateway tool: `travel___research_places`
- Gateway lookup: passed
- Validated places returned: `22`
- Gateway latency: `2108 ms`
- Bedrock Guardrail status: `READY`
- Bedrock Guardrail version: `1`

The Gateway check used the existing Terraform output only for the current process environment. It performed one read-only Places lookup and did not create or modify application users, billing rows, memory records, or Terraform resources.

## Local preflight recheck — 2026-10-09

The live preflight command completed without exposing Terraform output values. Local Terraform state contains the expected AgentCore Gateway, AI Memory/Guardrail, and Travel RAG output names, but the current shell intentionally does not contain the required live smoke environment variables. No live test was started.

The local implementation gate passed after this recheck:

- Web regression suite: passed
- Backend regression suite: passed
- Web typecheck and production build: passed
- Monitoring typecheck: passed
- Terraform format and validate: passed
- Golden manifest and baseline gate: passed (`100` cases, comparison pending until a real model report exists)

The approved live window was then used for the read-only Gateway smoke test, which passed with 22 validated places and approximately 2.1 seconds latency. The Memory isolation script was also started with temporary Cognito users; default opt-out and cross-user isolation passed, but the first paid AI request returned a controlled `503 AI_RESULT_UNCONFIRMED`. Cleanup completed and removed the temporary users and application rows. The remaining Memory checks were not reported as passed.

## Not run

- Unauthorized Gateway principal denial check
- AgentCore Memory two-user isolation/purge test (creates temporary accounts and writes test records)
- Guardrail block/allow inference test
- 100-request golden model evaluation

These checks require an explicit live-test window because they either create temporary data or incur model/service usage. No credentials, endpoint values, prompts, or raw model reasoning are stored in this report.
