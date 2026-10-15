<p align="center">
  <img src="apps/web/public/favicon.svg" alt="MapsBridge" width="80" height="80" />
</p>

<h1 align="center">MapsBridge</h1>

<p align="center">
  AI-powered travel planning &amp; location sharing platform built on AWS serverless.
</p>

<p align="center">
  <a href="https://mapsbridge.com">Live Site</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#getting-started">Getting Started</a> &middot;
  <a href="#deployment">Deployment</a>
</p>

---

## Overview

MapsBridge is a full-stack travel platform where users create multi-day trip itineraries, get AI-powered travel recommendations via AWS Bedrock (Claude, Nova), explore community routes, and securely share their location through time-limited links.

**Key capabilities:**

- Multi-day trip planner with route optimization (OSRM)
- AI travel assistant with multi-model orchestration (Bedrock AgentCore)
- Real-time WebSocket messaging
- Secure, consent-based location sharing (`/k/?code=...`)
- Bilingual UI (Turkish / English) with locale detection
- Credit-based billing with Stripe integration

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CloudFront CDN                       │
│                     mapsbridge.com (S3)                     │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
    ┌──────────▼──────────┐       ┌───────────▼────────────┐
    │   API Gateway v2    │       │   Lambda Function URL  │
    │   (HTTP + WebSocket)│       │   (AI Streaming)       │
    │   103 routes        │       └───────────┬────────────┘
    └──────────┬──────────┘                   │
               │                              │
    ┌──────────▼──────────┐       ┌───────────▼────────────┐
    │   Lambda (Node.js)  │       │   Bedrock AgentCore    │
    │   Admin Runtime     │       │   Claude / Nova Models │
    └──────────┬──────────┘       └───────────┬────────────┘
               │                              │
    ┌──────────▼──────────────────────────────▼────────────┐
    │              DynamoDB (Single-Table Design)           │
    │              + AI Memory Table                        │
    └──────────────────────────────────────────────────────┘
```

**Infrastructure:** 4 Terraform stacks &middot; 38 Lambda handlers &middot; Cognito auth &middot; CloudWatch alarms

---

## Repository Structure

```
mapsbridge/
├── apps/
│   ├── web/                    # Next.js 16 static export (32 pages, vanilla CSS)
│   └── mobile/                 # React Native / Expo (iOS + Android)
├── services/                   # Domain microservices (DDD, Clean Architecture)
│   ├── ai-assistant/           # Bedrock orchestration, sub-agents, JSONL pipeline
│   ├── identity-billing/       # Cognito JWT, credit wallet, Stripe webhooks
│   ├── map-trip/               # Route engine, OSRM, timed location sharing
│   ├── messaging/              # Real-time WebSocket chat & threads
│   ├── community/              # Traveler routes, articles, marketplace
│   ├── admin/                  # RBAC, maintenance mode, audit logging
│   └── place-intelligence/     # POI data, Google Places integration
├── packages/                   # Shared libraries
│   ├── contracts/              # Domain types, DTOs, value objects
│   ├── api-client/             # Typed HTTP client for all API routes
│   ├── shared/                 # Validators, error classes
│   ├── ui/                     # Design tokens, icons (web + mobile)
│   ├── database/               # DynamoDB client wrapper
│   ├── security/               # Rate limiter, Lambda middleware
│   └── monitoring/             # Structured logger
├── infra/                      # Infrastructure as Code
│   ├── terraform/              # Core stack: S3, CloudFront, Cognito, DynamoDB, API GW
│   ├── admin-runtime/          # Lambda functions, route integrations, AI config
│   ├── agentcore-gateway/      # Bedrock AgentCore MCP gateway
│   ├── ai-memory/              # AI memory table, guardrails, model access
│   └── lambda/                 # Lambda handler source (TypeScript)
├── monitoring/                 # Observability
│   ├── alarms/                 # P1/P2 CloudWatch alarm definitions
│   ├── dashboards/             # Production overview dashboard
│   ├── synthetics/             # Canary health checks
│   ├── tracing/                # X-Ray distributed tracing
│   └── runbooks/               # Incident response guides
├── schemas/                    # JSON schemas (trip-plan, trip-profile, KB metadata)
├── data/                       # Travel content (pilot cities)
├── training/                   # Model fine-tuning pipeline
├── docs/                       # Technical documentation
├── scripts/                    # Deployment & utility scripts
└── .github/                    # CI/CD workflows, PR & issue templates
```

---

## Getting Started

### Prerequisites

- **Node.js** 22+
- **npm** 10+
- **AWS CLI** + **Terraform** (for infrastructure)

### Install & Run

```bash
# Install all workspace dependencies
npm ci

# Start local dev server (web)
npm run dev

# Type checking
npm run typecheck

# Run tests
npm test

# Production build (static export)
npm run build
```

### Mobile

```bash
npm run mobile:start       # Start Expo dev server
npm run mobile:ios         # Run on iOS simulator
npm run mobile:android     # Run on Android emulator
```

---

## Deployment

### CI/CD Pipeline

Every push to `main` triggers the GitHub Actions pipeline:

1. **Quality** — TypeScript type check + unit tests
2. **Build** — Next.js static export with environment secrets
3. **Deploy** — S3 sync + CloudFront invalidation (via OIDC)

### Infrastructure

Each Terraform stack is deployed independently:

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply

cd ../admin-runtime
terraform init
terraform plan
terraform apply
```

### AWS Services Used

| Service             | Purpose                                |
| ------------------- | -------------------------------------- |
| S3 + CloudFront     | Static hosting with edge caching       |
| API Gateway v2      | HTTP + WebSocket API (103 routes)      |
| Lambda (Node.js 22) | Serverless compute (38 handlers)       |
| DynamoDB            | Single-table design + AI memory        |
| Cognito             | User authentication (email + Google)   |
| Bedrock             | AI models (Claude, Nova) via AgentCore |
| CloudWatch          | Monitoring, alarms, dashboards         |
| EventBridge         | Async event routing between services   |

---

## Development

### Monorepo Structure

This is an npm workspace monorepo. Shared packages under `packages/` are consumed by `apps/` and `services/` via workspace references.

### Key Commands

| Command                      | Description                 |
| ---------------------------- | --------------------------- |
| `npm run dev`                | Start web dev server        |
| `npm run build`              | Production build            |
| `npm run typecheck`          | TypeScript check            |
| `npm test`                   | Run all tests               |
| `npm run test:backend`       | Lambda handler tests        |
| `npm run monitor:synthetics` | Run synthetic canary checks |

### Code Standards

- **TypeScript** everywhere (frontend, backend, infrastructure scripts)
- **Clean Architecture** with domain/application/infrastructure layers
- **Single-table DynamoDB** design with PK/SK patterns
- **No ORMs** — direct DynamoDB DocumentClient
- **Vanilla CSS** — no CSS frameworks, custom design tokens

---

## Monitoring

Production monitoring is configured in the `monitoring/` directory:

- **Alarms**: P1 (critical) and P2 (warning) CloudWatch alarms for Lambda errors, API latency, DynamoDB throttling
- **Dashboards**: Production overview with all service metrics
- **Synthetics**: Automated canary runner testing live endpoints
- **Tracing**: AWS X-Ray distributed tracing with correlation context
- **Runbooks**: Incident response procedures for AI assistant issues

---

## License

All rights reserved. KVKK/GDPR compliant.
