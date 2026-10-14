# MapsBridge Technical Documentation

> Serverless travel planning platform with multi-agent AI, real-time messaging, and a credit-based billing system — built on AWS.

---

## Quick Navigation

### Architecture
| Document | Description |
|----------|-------------|
| [System Overview](architecture/system-overview.md) | High-level architecture, request flows, domain isolation |
| [Folder Structure](architecture/folder-structure.md) | Monorepo organization, directory guide |
| [Database Design](architecture/database.md) | DynamoDB single-table design, key patterns, GSI, TTL |

### API Reference
| Document | Description |
|----------|-------------|
| [API Endpoints](api/endpoints.md) | Complete REST API (routes, chat, auth, marketplace, stripe, ai, operations) |
| [Admin API](api/admin.md) | 40+ admin endpoints, RBAC, user/content/AI management |

### AI System
| Document | Description |
|----------|-------------|
| [AI Architecture](ai/architecture.md) | Two-phase LLM pipeline, supervisor, Bedrock integration |
| [Multi-Agent System](ai/agents.md) | 19 sub-agents, routing, scoring, smart questions |
| [Memory & Training](ai/memory-and-training.md) | AgentCore memory, consent-based training pipeline |
| [Guardrails & Safety](ai/guardrails-and-safety.md) | 8-layer safety system, PII masking, domain boundaries |
| [FinOps](ai/finops.md) | Cost tracking, credit economy, work limits, dashboards |

### Development
| Document | Description |
|----------|-------------|
| [Getting Started](development/getting-started.md) | Prerequisites, setup, environment variables, key commands |

### Operations
| Document | Description |
|----------|-------------|
| [Infrastructure](operations/infrastructure.md) | AWS modules (VPC, API, DB, messaging, storage, payments, analytics, security) |
| [Deployment](operations/deployment.md) | Frontend/Lambda deployment, rollback, pre-deploy checklist |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (static export), React 19, TypeScript |
| **CDN** | CloudFront + S3, locale-aware routing, security headers |
| **API** | API Gateway v2 (HTTP) + Lambda (Node.js 22, ARM64/Graviton) |
| **WebSocket** | API Gateway WebSocket + 3 Lambda handlers |
| **Database** | DynamoDB (single-table), Aurora Serverless v2, ElastiCache Redis |
| **AI** | AWS Bedrock (Claude), AgentCore MCP Gateway, Knowledge Bases (RAG) |
| **Payments** | Stripe (checkout, subscriptions, webhooks via SQS) |
| **Auth** | Cognito User Pool (email + Google/Apple federation) |
| **IaC** | Terraform (8 modules + 5 standalone stacks) |
| **Observability** | CloudWatch, X-Ray, EMF metrics, custom dashboards |
| **Security** | WAF v2 (OWASP), Bedrock Guardrails, PII masking |

## Domain Architecture

```
Client (Next.js SPA)
  │
  ├─► CloudFront CDN ──► S3 (static assets)
  │
  └─► API Gateway v2 (HTTP)
        ├── /auth/*          ──► auth Lambda
        ├── /routes/*        ──► routes Lambda
        ├── /chat/*          ──► chat Lambda
        ├── /marketplace/*   ──► marketplace Lambda
        ├── /ai/*            ──► ai Lambda (512MB, concurrency: 2)
        ├── /stripe/*        ──► stripe Lambda
        ├── /admin/*         ──► admin Lambda
        └── /system/*        ──► operations Lambda
                                    │
      API Gateway (WebSocket)       │
        ├── $connect         ──► ws-onconnect Lambda
        ├── $default         ──► ws-onmessage Lambda
        └── $disconnect      ──► ws-ondisconnect Lambda
                                    │
                               DynamoDB ◄──── Single Table
```

## Key Numbers

| Metric | Value |
|--------|-------|
| Lambda functions | 8 HTTP + 3 WebSocket + workers |
| API endpoints | 70+ (including 40+ admin) |
| AI sub-agents | 19 specialized agents |
| DynamoDB key patterns | 35+ entity types |
| Terraform modules | 8 + 5 standalone stacks |
| AI safety layers | 8 (PII → guardrails → billing) |
