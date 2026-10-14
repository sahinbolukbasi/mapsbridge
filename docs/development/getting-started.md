# Getting Started -- Developer Guide

This guide walks you through setting up the MapsBridge monorepo for local development, running the frontend, building Lambda functions, and deploying to AWS.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 22+ | Lambda runtime target; use `nvm` or `fnm` to manage versions |
| **AWS CLI** | v2 | Configured with appropriate profiles (`aws configure`) |
| **Terraform** | 1.5+ | Infrastructure-as-code for all AWS resources |
| **esbuild** | latest | Used by `build-lambdas.sh` for Lambda bundling |

Verify your toolchain:

```bash
node --version    # v22.x.x
aws --version     # aws-cli/2.x.x
terraform version # Terraform v1.5+
esbuild --version # 0.x.x
```

---

## Monorepo Structure

MapsBridge uses an npm workspaces monorepo with the following layout:

```
location/
├── apps/
│   └── web/                  # Next.js 16 frontend (static export)
├── infra/
│   ├── lambda/               # Lambda functions (TypeScript, per-domain)
│   ├── terraform/            # Main Terraform stack (modules + root configs)
│   ├── scripts/              # Build and deployment scripts
│   ├── ai-memory/            # AI memory infrastructure (standalone stack)
│   ├── ai-training/          # Training pipeline (standalone stack)
│   ├── travel-rag/           # RAG knowledge base (standalone stack)
│   ├── agentcore-gateway/    # AgentCore MCP gateway (standalone stack)
│   └── admin-runtime/        # Admin orchestration (standalone stack)
├── packages/
│   └── contracts/            # Shared types (@mapsbridge/contracts)
├── services/                 # Domain service layer
├── scripts/                  # Root-level deployment scripts
└── package.json              # Workspace root
```

### Key directories

- **apps/web** -- The Next.js 16 frontend. Statically exported and deployed to S3 behind CloudFront.
- **infra/lambda** -- All Lambda function handlers, written in TypeScript and bundled with esbuild. Each function maps to a domain (auth, admin, AI, messaging, etc.) and runs on arm64/Graviton with Node.js 22.
- **packages/contracts** -- Shared TypeScript types published as `@mapsbridge/contracts`. Both `apps/web` and `infra/lambda` depend on this package for API contracts, DTOs, and enums.
- **services/** -- Domain service layer containing business logic shared across Lambda functions.

---

## Quick Start

### 1. Install dependencies

```bash
# Root workspace
npm install

# Frontend
cd apps/web && npm install

# Lambda functions
cd infra/lambda && npm install
```

### 2. Run the frontend locally

```bash
cd apps/web
npm run dev
```

The dev server starts at `http://localhost:3000` by default.

### 3. Build Lambda functions

```bash
./infra/scripts/build-lambdas.sh
```

This script uses esbuild to bundle each Lambda handler into a self-contained `.zip` artifact ready for Terraform deployment.

### 4. Run TypeScript checks

```bash
# Frontend
npx tsc --noEmit --project apps/web/tsconfig.json

# Lambda functions
npx tsc --noEmit --project infra/lambda/tsconfig.json
```

---

## Environment Variables

Create `apps/web/.env.local` with the following variables:

```dotenv
# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-client-id

# AWS Cognito
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-cognito-app-client-id
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Authorization
NEXT_PUBLIC_SUPER_ADMINS=admin1@example.com,admin2@example.com

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID for social sign-in |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | AWS Cognito User Pool app client ID |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | AWS Cognito User Pool ID |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps JavaScript API key |
| `NEXT_PUBLIC_SUPER_ADMINS` | Comma-separated list of emails with super-admin privileges |
| `NEXT_PUBLIC_SITE_URL` | Base URL of the application (used for OAuth redirects and links) |

> **Note:** All variables prefixed with `NEXT_PUBLIC_` are embedded into the client bundle at build time. Never place secrets here.

---

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build (includes AI handler bundling) |
| `npm run typecheck` | Full type check across the project |
| `./infra/scripts/build-lambdas.sh` | Bundle all Lambda functions with esbuild |
| `terraform plan` | Preview infrastructure changes |
| `terraform apply` | Apply infrastructure changes |

---

## Deployment Overview

### Frontend (S3 + CloudFront)

The frontend is deployed as a static export to S3 with CloudFront as the CDN. The deployment script (`scripts/deploy-production.sh`) performs a 2-phase S3 sync:

1. **Phase 1 -- Immutable assets:** Static assets (`_next/`, images, fonts) are synced with `Cache-Control: public, max-age=31536000, immutable`. These files are content-hashed, so they never need revalidation.
2. **Phase 2 -- HTML and JSON:** Page files are synced with `Cache-Control: public, max-age=0, must-revalidate` to ensure visitors always get the latest content.

After upload, a CloudFront invalidation clears the edge cache.

```bash
# Full deployment
./scripts/deploy-production.sh
```

### Lambda Functions

Lambda functions are bundled with esbuild and deployed through Terraform:

```bash
# Build
./infra/scripts/build-lambdas.sh

# Deploy
cd infra/terraform
terraform plan -out=tfplan
terraform apply tfplan
```

### Infrastructure

All AWS resources are managed by Terraform. See the [Infrastructure Reference](../operations/infrastructure.md) for details on each module.

---

## Next Steps

- [Infrastructure Reference](../operations/infrastructure.md) -- Detailed documentation of all Terraform modules and AWS resources.
- [Deployment Guide](../operations/deployment.md) -- Step-by-step deployment procedures for frontend, Lambda, and infrastructure.
