# System Architecture Overview

MapsBridge is a serverless travel planning platform built on AWS. This document describes the high-level architecture, request flows, domain isolation model, and data flows for key operations.

---

## High-Level Architecture

```
                                 +------------------+
                                 |   CloudFront     |
                                 |   CDN + WAF v2   |
                                 +--------+---------+
                                          |
                          +---------------+---------------+
                          |                               |
                  +-------v--------+            +---------v----------+
                  |  S3 Static     |            |  API Gateway v2    |
                  |  (Next.js SPA) |            |  HTTP API          |
                  +----------------+            +---------+----------+
                                                          |
              +----------+----------+----------+----------+----------+----------+----------+
              |          |          |          |          |          |          |          |
          +---v--+  +---v---+ +---v---+ +---v----+ +---v--+ +---v----+ +---v---+ +---v--------+
          | auth |  | routes| | chat  | |market- | |  ai  | | stripe | | admin | | operations |
          +---+--+  +---+---+ +---+---+ |place   | +---+--+ +---+----+ +---+---+ +---+--------+
              |          |          |    +---+----+     |         |          |          |
              |          |          |        |          |         |          |          |
              +----------+----------+--------+----------+---------+----------+----------+
                                          |
                              +-----------v-----------+
                              |     DynamoDB          |
                              |   (Single Table)      |
                              +-----------+-----------+
                                          |
                          +---------------+---------------+
                          |                               |
                  +-------v--------+            +---------v----------+
                  | Aurora          |            | ElastiCache        |
                  | Serverless v2   |            | Serverless (Redis) |
                  | (PostgreSQL 17  |            +--------------------+
                  |  + PostGIS)     |
                  +-----------------+

    +------------------+       +------------------+       +------------------+
    | AWS Bedrock      |       | Cognito          |       | Stripe           |
    | (Claude models)  |       | User Pool        |       | (Payments)       |
    | + AgentCore MCP  |       | + Google/Apple   |       | + SQS + DLQ      |
    +------------------+       +------------------+       +------------------+

    +------------------+       +------------------+       +------------------+
    | S3: Media        |       | S3: Guides       |       | S3: Analytics    |
    | (photos/avatars) |       | (private PDFs)   |       | (Parquet/Firehose)|
    +------------------+       +------------------+       +------------------+

    WebSocket API (API Gateway v2)
    +-----------+    +-------------+    +---------------+
    | onconnect | -> | onmessage   | -> | ondisconnect  |
    +-----------+    +-------------+    +---------------+
```

---

## Request Flow

### Static Content (SPA)

```
Browser
  |
  v
CloudFront (edge cache, WAF v2 OWASP rules, per-IP rate limiting)
  |
  +--> CloudFront Function (locale-aware routing, security headers)
  |
  v
S3 Bucket (Next.js static export)
```

CloudFront Functions inspect the `Accept-Language` header and URL path to serve the correct locale-specific `index.html`. Security headers (CSP, HSTS, X-Frame-Options) are injected on every response.

### API Request

```
Browser / Mobile Client
  |
  | HTTPS (Authorization: Bearer <Cognito JWT>)
  v
CloudFront (passes through to API Gateway origin)
  |
  v
API Gateway v2 HTTP API
  |
  +--> JWT Authorizer (Cognito)
  |
  +--> Route selection: POST /api/routes/* --> routes Lambda
  |                      POST /api/chat/*   --> chat Lambda
  |                      POST /api/ai/*     --> ai Lambda
  |                      ...
  v
Lambda Function (domain-specific handler)
  |
  +--> Validate request (contracts package)
  +--> Execute business logic (services layer)
  +--> Read/write DynamoDB (single-table)
  +--> Optional: Aurora, Redis, Bedrock, Stripe
  |
  v
JSON Response --> API Gateway --> CloudFront --> Client
```

### WebSocket (Real-Time Messaging)

```
Client
  |
  | wss://ws.mapsbridge.com
  v
API Gateway v2 WebSocket API
  |
  +--> $connect   --> onconnect Lambda   (authenticate, store connectionId)
  +--> $default   --> onmessage Lambda   (route message, persist to DynamoDB)
  +--> $disconnect--> ondisconnect Lambda (remove connectionId)
```

Connection IDs are stored in DynamoDB, keyed by user. When a message is sent, the `onmessage` handler looks up all participants' connection IDs and posts to each via the API Gateway Management API.

---

## Domain Isolation

Each backend domain is deployed as an independent Lambda function with its own IAM execution role. This provides:

| Property | Implementation |
|----------|---------------|
| **Separate deployable** | Each Lambda is built and deployed independently via dedicated build scripts |
| **Minimal IAM scope** | Each function's role grants access only to the resources it needs (e.g., the `stripe` Lambda can access the SQS queue; the `chat` Lambda cannot) |
| **Independent scaling** | Each function scales independently based on its own invocation patterns |
| **Fault isolation** | A failure in the `ai` domain does not affect `auth` or `routes` |
| **Shared utilities** | Cross-cutting concerns (logging, DynamoDB client, rate limiting) live in `infra/lambda/src/shared/` and `packages/` |

### Domain Responsibilities

| Domain | Lambda | Primary Resources |
|--------|--------|-------------------|
| **Auth** | `auth` | Cognito, DynamoDB (USER# keys) |
| **Routes** | `routes` | DynamoDB (USER#/ROUTE#, SHARE# keys), S3 media |
| **Chat** | `chat` | DynamoDB (THREAD#, CHAT# keys), WebSocket API |
| **Marketplace** | `marketplace` | DynamoDB (GUIDE#, PURCHASE# keys), S3 guides |
| **AI** | `ai` | Bedrock (Claude), AgentCore MCP, DynamoDB (AI# keys) |
| **Stripe** | `stripe` | Stripe API, SQS webhook queue, DynamoDB (BILLING#, PAYMENT# keys) |
| **Admin** | `admin` | DynamoDB (full read, SYSTEM# write), Aurora (reporting) |
| **Operations** | `operations` | DynamoDB (SYSTEM# keys), CloudWatch |

The `services/` layer enforces hexagonal architecture. Each service module exposes ports (interfaces) that Lambda handlers and the frontend consume. Adapters for DynamoDB, Aurora, Redis, Stripe, and Bedrock are injected at runtime.

---

## Data Flows for Key Operations

### 1. AI Travel Planning Request

```
Client                  API GW        ai Lambda         Bedrock          AgentCore MCP
  |                       |               |                |                   |
  |  POST /api/ai/plan    |               |                |                   |
  |---------------------->|-------------->|                |                   |
  |                       |               |                |                   |
  |                       |               | Check credits  |                   |
  |                       |               | (USER#/CREDITS)|                   |
  |                       |               |                |                   |
  |                       |               | Deduct credit  |                   |
  |                       |               | (conditional   |                   |
  |                       |               |  update expr)  |                   |
  |                       |               |                |                   |
  |                       |               | Invoke Claude  |                   |
  |                       |               |--------------->|                   |
  |                       |               |                |                   |
  |                       |               |                | tool_use: search  |
  |                       |               |                |------------------>|
  |                       |               |                |   place results   |
  |                       |               |                |<------------------|
  |                       |               |                |                   |
  |                       |               |  AI response   |                   |
  |                       |               |<---------------|                   |
  |                       |               |                |                   |
  |                       |               | Store receipt   |                  |
  |                       |               | (USER#/AI#)    |                   |
  |                       |               | Update counter |                   |
  |                       |               | (USER#/AI_DAY#)|                   |
  |                       |               | (SYSTEM#AI)    |                   |
  |                       |               |                |                   |
  |   JSON response       |               |                |                   |
  |<----------------------|<--------------|                |                   |
```

**Credit gating** uses a DynamoDB conditional update expression to atomically decrement the user's credit balance, preventing race conditions. If the balance is insufficient, the request is rejected before any Bedrock invocation occurs.

### 2. Payment Flow (Stripe)

```
Client              API GW       stripe Lambda       Stripe API        SQS Queue
  |                   |               |                  |                 |
  | POST /checkout    |               |                  |                 |
  |------------------>|-------------->|                  |                 |
  |                   |               | Create session   |                 |
  |                   |               |----------------->|                 |
  |                   |               | session URL      |                 |
  |                   |               |<-----------------|                 |
  |  redirect URL     |               |                  |                 |
  |<------------------|<--------------|                  |                 |
  |                   |               |                  |                 |
  | (user pays on     |               |                  |                 |
  |  Stripe checkout) |               |                  |                 |
  |                   |               |                  |                 |
  |                   |               |                  | webhook event   |
  |                   |               |                  |---------------->|
  |                   |               |                  |                 |
  |                   |               |  SQS trigger     |                 |
  |                   |               |<------------------------------------|
  |                   |               |                  |                 |
  |                   |               | Verify signature |                 |
  |                   |               | Process event:   |                 |
  |                   |               |  - Update        |                 |
  |                   |               |    SUBSCRIPTION  |                 |
  |                   |               |  - Grant CREDITS |                 |
  |                   |               |  - Store PAYMENT |                 |
  |                   |               |  - Store RECEIPT |                 |
  |                   |               |                  |                 |
```

Stripe webhooks are delivered to an SQS queue rather than directly to a Lambda URL. This provides:
- **Durability**: messages survive Lambda cold starts and transient failures.
- **Dead Letter Queue (DLQ)**: failed events are retained for investigation and replay.
- **Backpressure**: SQS controls concurrency, preventing thundering herd on subscription renewal waves.

### 3. Real-Time Messaging

```
User A (sender)          API GW WS         onmessage Lambda        DynamoDB
  |                         |                     |                    |
  | send message            |                     |                    |
  | (WebSocket frame)       |                     |                    |
  |------------------------>|-------------------->|                    |
  |                         |                     |                    |
  |                         |                     | Store message      |
  |                         |                     | CHAT#{threadId}    |
  |                         |                     | MSG#{timestamp}    |
  |                         |                     |------------------->|
  |                         |                     |                    |
  |                         |                     | Query participants |
  |                         |                     | THREAD#{threadId}  |
  |                         |                     | PARTICIPANT#*      |
  |                         |                     |------------------->|
  |                         |                     |  connectionIds     |
  |                         |                     |<-------------------|
  |                         |                     |                    |
  |                         |   postToConnection  |                    |
  |                         |<--------------------|                    |
  |                         |                     |                    |
  |                         |------+              |                    |
  |                         |      | Fan out to   |                    |
  |                         |      | all online   |                    |
  |                         |      | participants |                    |
  |                         |<-----+              |                    |
  |                         |                     |                    |
User B (receiver)           |                     |                    |
  |<------------------------|                     |                    |
  | receive message         |                     |                    |
```

Offline participants do not have a stored connectionId. Undeliverable messages are not retried over WebSocket; the recipient fetches them via the REST API on reconnect.

---

## Infrastructure as Code

All AWS resources are managed by Terraform, organized into eight modules:

| Module | Resources |
|--------|-----------|
| `api` | API Gateway v2 (HTTP + WebSocket), Lambda functions, IAM roles, CloudWatch log groups |
| `database` | DynamoDB table, GSIs, Aurora Serverless v2 cluster, ElastiCache Serverless |
| `messaging` | WebSocket API routes, Lambda integrations, DynamoDB connection table |
| `storage` | S3 buckets (media, guides, analytics), CloudFront distribution, CloudFront Functions |
| `payments` | SQS queue + DLQ, Stripe webhook endpoint configuration, IAM policies |
| `analytics` | Kinesis Firehose, S3 analytics bucket, Glue catalog |
| `vpc` | VPC, subnets, NAT gateway, security groups, VPC endpoints |
| `security` | WAF v2 WebACL, Cognito User Pool, rate limiting rules, OWASP managed rules |

---

## Security Posture

- **WAF v2** with AWS Managed Rules (OWASP Core Rule Set) and per-IP rate limiting protects all CloudFront and API Gateway endpoints.
- **Cognito JWT authorizer** on API Gateway validates every API request. Google and Apple federated identity providers are configured for social sign-in.
- **IAM least privilege**: each Lambda has a dedicated execution role scoped to only the AWS resources it accesses.
- **Encryption**: DynamoDB uses AWS-managed encryption at rest. S3 buckets enforce SSE-S3. Aurora uses encryption at rest with KMS. All transit is TLS 1.2+.
- **CloudFront Functions** inject `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, and `Content-Security-Policy` headers on every response.

---

## Technology Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (static export), React, TypeScript |
| CDN | CloudFront + CloudFront Functions |
| API | API Gateway v2 (HTTP + WebSocket) |
| Compute | AWS Lambda (Node.js) |
| Primary Database | DynamoDB (single-table design) |
| Relational Database | Aurora Serverless v2 (PostgreSQL 17 + PostGIS) |
| Cache | ElastiCache Serverless (Redis) |
| AI | AWS Bedrock (Claude models), AgentCore MCP gateway |
| Auth | Cognito User Pool (email, Google, Apple) |
| Payments | Stripe + SQS webhook queue |
| Storage | S3 (media, guides, analytics) |
| Analytics | Kinesis Firehose, Parquet on S3 |
| IaC | Terraform (8 modules) |
| Security | WAF v2, IAM, KMS, VPC |
