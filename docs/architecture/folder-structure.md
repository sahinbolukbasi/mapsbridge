# Project Folder Structure

This document describes the organization of the MapsBridge monorepo, the purpose of each directory, its key files, the team roles that primarily work in it, and its dependencies on other parts of the codebase.

---

## Root Layout

```
location/
├── apps/web/                  # Next.js frontend (static export)
├── infra/                     # Infrastructure: Lambda functions, Terraform, AI pipelines
├── services/                  # Domain service layer (hexagonal architecture)
├── packages/                  # Shared packages consumed by all layers
├── agents/                    # AI agent persona definitions
├── monitoring/                # Observability configuration
├── schemas/                   # JSON schemas for validation
├── training/                  # ML training data preparation
└── docs-v2/                   # Project documentation
```

---

## apps/web/ -- Next.js Frontend

**Purpose**: The user-facing single-page application. Built with Next.js App Router and exported as a fully static site (`output: "export"`) for S3 + CloudFront hosting.

**Primary team**: Frontend

```
apps/web/
├── app/
│   ├── components/            # Shared UI components (buttons, modals, maps, cards)
│   ├── features/              # Feature modules, each self-contained
│   │   ├── landing/           # Landing page and marketing
│   │   ├── profile/           # User profile management
│   │   ├── trip-planner/      # Interactive trip planning interface
│   │   ├── community/         # Community feed and guides
│   │   └── messaging/         # Chat and real-time messaging UI
│   ├── lib/                   # Client-side libraries and integrations
│   │   ├── ai/               # AI client module (30+ files, 19 sub-agents)
│   │   │                     #   Manages prompt construction, streaming,
│   │   │                     #   agent routing, and response parsing
│   │   ├── billing/          # Stripe client integration (checkout, portal)
│   │   ├── trip/             # Trip planning logic (itinerary builder, optimizer)
│   │   └── google/           # Google Maps SDK wrapper (markers, routes, places)
│   └── locales/              # Internationalization files
│       ├── tr.json           # Turkish translations
│       └── en.json           # English translations
└── server/                   # Server-side modules (used during build / SSR dev)
    └── ai/                   # AI server modules
        ├── context/          # Context assembly for AI requests
        ├── memory/           # Conversation memory management
        └── training/         # Training signal collection
```

**Key files**:

- `app/layout.tsx` -- Root layout with providers, locale detection, analytics
- `app/lib/ai/orchestrator.ts` -- Main AI orchestration entry point
- `app/lib/ai/agents/` -- 19 sub-agent definitions (e.g., route-planner, restaurant-finder, budget-optimizer)
- `next.config.js` -- Static export configuration, image optimization, i18n

**Dependencies**: `packages/contracts` (types and DTOs), `packages/ui` (design tokens)

---

## infra/lambda/src/ -- Lambda Function Source

**Purpose**: Backend API handlers. Each subdirectory maps to one Lambda function deployed behind API Gateway.

**Primary team**: Backend

```
infra/lambda/src/
├── admin/                     # Admin domain (40+ routes)
│   ├── handlers/              # Route handlers for admin operations
│   ├── governance/            # Content moderation, user management
│   └── system/               # System configuration, module toggles
├── ai/                        # AI domain handler
│   ├── handler.ts            # Entry point, routes to sub-handlers
│   └── bedrock/              # Bedrock client, prompt templates
├── auth/                      # Auth domain
│   ├── handler.ts            # Cognito integration, token management
│   └── federation/           # Google/Apple sign-in helpers
├── billing/                   # Billing shared library
│   ├── credits.ts            # Credit wallet operations
│   └── subscription.ts       # Subscription tier management
├── chat/                      # Chat domain
│   ├── handler.ts            # Thread CRUD, message history
│   └── moderation/           # Message content filtering
├── marketplace/               # Marketplace domain
│   ├── handler.ts            # Guide listing, search, purchase
│   └── reviews/              # Guide reviews and ratings
├── operations/                # System status and deal tracker
│   ├── handler.ts            # Health checks, deal tracking jobs
│   └── tracker/              # Price monitoring logic
├── routes/                    # Route CRUD domain
│   ├── handler.ts            # Create, read, update, delete routes
│   ├── sharing/              # Public share link generation
│   └── export/               # Route export (GPX, PDF)
├── shared/                    # Cross-domain utilities
│   ├── dynamo.ts             # DynamoDB client and helpers
│   ├── response.ts           # Standardized API response builder
│   ├── auth.ts               # JWT validation middleware
│   └── errors.ts             # Error types and handler
├── stripe/                    # Stripe webhook and checkout
│   ├── handler.ts            # SQS event processor
│   ├── checkout.ts           # Checkout session creation
│   └── webhooks/             # Event-type-specific handlers
└── ws/                        # WebSocket handlers
    ├── onconnect.ts          # Store connectionId in DynamoDB
    ├── onmessage.ts          # Route and fan out messages
    └── ondisconnect.ts       # Clean up connectionId
```

**Key files**:

- Each `handler.ts` is the Lambda entry point (exports `handler` function)
- `shared/dynamo.ts` is the centralized DynamoDB access layer used by all domains

**Dependencies**: `packages/contracts` (types), `packages/database` (DynamoDB client), `packages/security` (rate limiter, middleware), `packages/monitoring` (logger), `services/*` (business logic)

---

## infra/terraform/ -- Infrastructure as Code

**Purpose**: Terraform configuration defining all AWS resources. Organized into composable modules.

**Primary team**: Infrastructure / DevOps

```
infra/terraform/
├── main.tf                    # Root module, wires child modules together
├── variables.tf               # Input variables (environment, region, domain)
├── outputs.tf                 # Exported values (API URL, CloudFront domain)
├── terraform.tfvars           # Environment-specific variable values
└── modules/
    ├── api/                   # API Gateway, Lambda functions, IAM roles
    ├── database/              # DynamoDB, Aurora Serverless, ElastiCache
    ├── messaging/             # WebSocket API, connection management
    ├── storage/               # S3 buckets, CloudFront, CloudFront Functions
    ├── payments/              # SQS queue + DLQ for Stripe webhooks
    ├── analytics/             # Kinesis Firehose, Glue catalog, S3 analytics
    ├── vpc/                   # VPC, subnets, NAT, security groups, endpoints
    └── security/              # WAF v2, Cognito User Pool, rate limiting
```

**Dependencies**: None (root of infrastructure). Consumed by CI/CD pipeline.

---

## infra/ -- Other Infrastructure Directories

```
infra/
├── ai-memory/                 # AI conversation memory infrastructure
│                              #   DynamoDB tables, Lambda for memory retrieval
├── ai-training/               # Training pipeline infrastructure
│                              #   Step Functions, S3, SageMaker config
├── travel-rag/                # RAG knowledge base
│                              #   Vector store setup, document ingestion
├── agentcore-gateway/         # AgentCore MCP gateway configuration
│                              #   Tool definitions, place research endpoints
└── scripts/                   # Build, deploy, and verification scripts (28 total)
    ├── build-*.sh             # Per-domain Lambda build scripts
    ├── deploy-*.sh            # Deployment scripts (Lambda, Terraform)
    └── verify-*.sh            # Post-deploy verification and smoke tests
```

**Primary team**: Backend / Infrastructure

---

## services/ -- Domain Service Layer

**Purpose**: Business logic organized using hexagonal (ports and adapters) architecture. Each service defines its domain model, ports (interfaces), and adapters (implementations). Lambda handlers and the frontend both consume these services.

**Primary team**: Backend

```
services/
├── admin/                     # Admin governance service
│   ├── ports/                # Interfaces (user management, content moderation)
│   ├── adapters/             # DynamoDB, Cognito adapters
│   └── domain/              # Admin domain models and rules
├── ai-assistant/              # AI assistant service
│   ├── orchestrator/         # Request routing, agent selection
│   ├── agents/               # Agent implementations and scoring
│   ├── scoring/              # Quality scoring and feedback loops
│   └── memory/              # Conversation context management
├── community/                 # Community and guides service
│   ├── guides/               # Guide publishing, discovery
│   ├── social/               # Following, activity feed
│   └── moderation/          # Content reports, auto-moderation
├── identity-billing/          # Identity and billing service
│   ├── identity/             # User profile, preferences
│   ├── billing/              # Subscription management, credit operations
│   └── stripe/              # Stripe adapter (checkout, webhooks)
├── map-trip/                  # Map and trip service
│   ├── routes/               # Route CRUD, sharing, export
│   ├── places/               # Place search, details, caching
│   └── optimization/        # Route optimization algorithms
└── messaging/                 # Messaging service
    ├── threads/              # Thread lifecycle, participants
    ├── messages/             # Message persistence, retrieval
    └── realtime/            # WebSocket connection management
```

**Key files**:

- Each service has a `ports/` directory defining TypeScript interfaces
- Adapters in `adapters/` implement those interfaces for specific infrastructure

**Dependencies**: `packages/contracts` (shared types), `packages/database` (DynamoDB client), `packages/shared` (utilities)

---

## packages/ -- Shared Packages

**Purpose**: Reusable code consumed by the frontend, Lambda functions, and services. Each package is independently importable.

**Primary team**: Full-stack (all teams contribute)

```
packages/
├── contracts/                 # Domain types, DTOs, and credit costs
│   ├── types/                # TypeScript interfaces for all domains
│   ├── dto/                  # Data transfer objects (API request/response shapes)
│   ├── credits/              # Credit cost definitions per AI operation
│   └── enums/               # Shared enumerations (subscription tiers, route types)
├── ui/                        # Design tokens
│   ├── tokens/               # Colors, spacing, typography, breakpoints
│   └── themes/              # Light/dark theme definitions
├── database/                  # DynamoDB client
│   ├── client.ts             # Configured DynamoDB DocumentClient
│   ├── operations.ts         # Typed get/put/query/update helpers
│   └── keys.ts              # Key construction utilities (USER#, THREAD#, etc.)
├── security/                  # Rate limiter and middleware
│   ├── rate-limiter.ts       # Token bucket rate limiting (Redis-backed)
│   ├── middleware.ts         # Express-style middleware chain
│   └── sanitize.ts          # Input sanitization utilities
├── monitoring/                # Logger
│   ├── logger.ts             # Structured JSON logger (CloudWatch compatible)
│   └── metrics.ts           # Custom metric emission helpers
└── shared/                    # Common utilities
    ├── date.ts               # Date formatting and timezone helpers
    ├── geo.ts                # Geospatial calculations
    ├── validation.ts         # Input validation functions
    └── pagination.ts         # Cursor-based pagination helpers
```

**Dependencies**: `contracts` has no internal dependencies (leaf package). All other packages may depend on `contracts`.

---

## agents/ -- AI Agent Personas

**Purpose**: Markdown files defining the personality, capabilities, constraints, and prompt templates for each AI agent persona used in travel planning.

**Primary team**: AI / Product

```
agents/
├── route-planner.md           # Route and itinerary planning agent
├── restaurant-finder.md       # Restaurant and dining recommendations
├── budget-optimizer.md        # Budget-conscious travel optimization
├── local-guide.md             # Local culture and hidden gems
├── accommodation.md           # Hotel and accommodation search
├── activity-planner.md        # Activities and experiences
├── transport.md               # Transportation options and logistics
├── safety-advisor.md          # Safety and travel advisory information
└── general-assistant.md       # Fallback general travel assistant
```

Nine persona files, each consumed by the AI orchestrator in `services/ai-assistant/`. The orchestrator selects the appropriate agent(s) based on user intent classification.

**Dependencies**: None (consumed as raw text by the AI service)

---

## monitoring/ -- Observability

**Purpose**: CloudWatch dashboards, alarms, runbooks, and synthetic canaries for production monitoring.

**Primary team**: Infrastructure / SRE

```
monitoring/
├── dashboards/                # CloudWatch dashboard JSON definitions
├── alarms/                    # Alarm configurations (error rates, latency, DynamoDB throttling)
├── runbooks/                  # Incident response procedures
└── synthetics/               # Canary scripts for endpoint health checks
```

**Dependencies**: Terraform provisions these resources; definitions here are the source of truth.

---

## schemas/ -- JSON Schemas

**Purpose**: Validation schemas for structured data exchanged between services.

**Primary team**: Backend

```
schemas/
├── trip-plan.json             # Trip plan structure validation
├── learning-signal.json       # AI learning signal format
└── kb-metadata.json           # Knowledge base document metadata
```

Used by Lambda handlers and the training pipeline to validate inputs and outputs.

---

## training/ -- ML Training Data

**Purpose**: Scripts and configuration for preparing training data from production signals.

**Primary team**: AI / Data

```
training/
├── data-prep/                 # Data extraction and cleaning scripts
├── evaluation/                # Model evaluation harnesses
└── datasets/                  # Sample datasets for local development
```

**Dependencies**: `schemas/` (validation), `packages/contracts` (types), S3 analytics bucket (source data)

---

## Dependency Graph

```
                    +----------------+
                    |   contracts    |  (leaf -- no internal deps)
                    +-------+--------+
                            |
          +-----------------+------------------+
          |                 |                  |
    +-----v-----+    +-----v-----+     +------v------+
    |  database  |    |  security |     |   shared    |
    +-----+------+    +-----+----+     +------+------+
          |                 |                  |
          +---------+-------+-------+----------+
                    |               |
              +-----v-----+  +-----v------+
              |  services  |  |  monitoring|
              +-----+------+  +------------+
                    |
          +---------+---------+
          |                   |
    +-----v------+     +------v------+
    | infra/     |     |  apps/web   |
    | lambda/src |     |             |
    +------------+     +-------------+
```

All layers depend downward on `packages/contracts` as the single source of truth for domain types and DTOs. The `services/` layer sits between infrastructure adapters and the presentation/API layers, ensuring business logic is portable and testable.
