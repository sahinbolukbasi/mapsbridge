# AI Ops Agent

Automated CI/CD failure analysis using Claude (via AWS Bedrock). Triggered on `workflow_run` failures; produces a GitHub issue with root-cause classification and a suggested fix.

## Architecture

```
GitHub Actions (workflow_run failure)
  └─> aws bedrock-runtime invoke-model (Claude Haiku)
        └─> github.rest.issues.create
```

No EventBridge or Lambda involved — the analysis runs directly inside the GitHub Actions runner.

## Agent Permissions

| Resource | Permission | Notes |
|----------|------------|-------|
| AWS Bedrock (eu-central-1) | InvokeModel only | `bedrock-runtime:InvokeModel` on Haiku cross-region inference profile |
| AWS IAM role | `secrets.AWS_DEPLOY_ROLE_ARN` | Assumed via OIDC; read-only Bedrock scope |
| GitHub Actions | `actions: read` | Read failed-run job details and logs |
| GitHub Issues | `issues: write` | Create failure-analysis issues |
| GitHub Contents | `contents: read` | Checkout + git diff |
| Branch writes | None | Agent never pushes code |
| `main` / `production` | No access | Hard boundary — no push permissions |

The agent **never** commits, pushes, or opens pull requests. It only reads context and writes issues.

## Token Budget

- Model: `eu.anthropic.claude-haiku-4-5-20251001-v1:0`
- `max_tokens`: 1024 per analysis call
- Diff input truncated to 10,000 characters before being sent
- No multi-turn conversations — single prompt → single response

## Classification Rules

Each analysis produces one of four classifications. The classification determines what, if any, automated follow-up is permitted.

| Class | Meaning | Allowed Automated Action |
|-------|---------|--------------------------|
| `transient` | Flaky network / rate-limit / runner hiccup | Re-run workflow (future) |
| `safe-fix` | Lint, formatting, type error, snapshot mismatch | Open PR on `fix/agent-*` branch (future) |
| `risky` | Logic change, behaviour difference, test gap | Issue only — human review required |
| `infra` | Infrastructure, deployment, secrets, permissions | Issue only — ops team escalation |

**Current implementation:** all classes produce an issue only. Automated re-runs and fix PRs are reserved for a future phase and require explicit human approval before enablement.

### Branch Policy (future automated fixes)

When automated fix PRs are enabled:
- Target branch: `fix/agent-<run-id>` or `fix/agent-<short-sha>`
- Base branch: the failing run's `head_branch`
- Never target `main`, `master`, or `production`
- PR must pass CI before any merge

## Duplicate Prevention

Before creating an issue the agent checks open issues labelled `ci-failure`. If an issue already exists for the same workflow name and commit SHA (first 7 chars), it skips creation.

## Audit Trail

Every created issue contains:
- Workflow name and run URL (links to full logs)
- Branch and commit SHA
- Classification and confidence level
- Raw AI analysis (root cause + suggested fix)
- Disclaimer: *"Automated analysis by Claude (Bedrock) — verify before acting."*

Issues are labelled `bug`, `ci-failure`, and `class:<classification>` for filtering.

## Failure Modes

| Scenario | Behaviour |
|----------|-----------|
| Bedrock unreachable or throttled | Falls back to `infra / low confidence` issue |
| Claude returns non-JSON | JSON extracted via regex; plain text used as summary if extraction fails |
| `gh api` rate-limited | Step exits with `|| true`; issue created with empty job context |
| Duplicate issue exists | Silently skips — no duplicate created |

## Secrets Required

| Secret | Purpose |
|--------|---------|
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN for OIDC assumption |

`GH_TOKEN` is provided automatically by GitHub Actions — no manual configuration needed.
