# AWS Infrastructure Reference

This document describes every Terraform module and standalone stack that makes up the MapsBridge AWS infrastructure.

---

## Module Architecture

The main Terraform stack lives in `infra/terraform/` and is composed of reusable modules under `infra/terraform/modules/`. Additional standalone stacks handle specialized subsystems (AI memory, training, RAG, etc.).

```
infra/terraform/
├── main.tf
├── hosting.tf          # S3 + CloudFront + Cognito + DynamoDB main table
├── ai.tf               # Bedrock configuration
├── ai-alarms.tf        # AI CloudWatch alarms
├── guardrails.tf       # Bedrock guardrails
├── finops.tf           # Cost management
├── tracker.tf          # Deal tracker
├── pipeline.tf         # CI/CD pipeline
├── terraform.tfvars    # Environment-specific variables
└── modules/
    ├── vpc/
    ├── api/
    ├── database/
    ├── messaging/
    ├── storage/
    ├── payments/
    ├── analytics/
    └── security/
```

---

## 1. VPC Module (`modules/vpc`)

Provides the network foundation for all private resources.

### Resources

- **VPC** with DNS support and DNS hostnames enabled.
- **Private subnets** -- 1 AZ in dev, 2 AZs in prod for high availability.
- **Security groups:**
  - Aurora security group (PostgreSQL port 5432, Lambda ingress)
  - Redis security group (port 6379, Lambda ingress)
  - Lambda security group (egress-only, attached to VPC-connected functions)

### VPC Endpoints

| Endpoint   | Type      | Purpose                                      |
| ---------- | --------- | -------------------------------------------- |
| S3         | Gateway   | Free data transfer for S3 access from Lambda |
| Bedrock    | Interface | Private connectivity to Amazon Bedrock       |
| CloudWatch | Interface | Log and metric submission without internet   |
| SQS        | Interface | Queue access from VPC-connected Lambdas      |

### Cost Optimization

No NAT Gateway is provisioned. All external connectivity is handled through VPC endpoints, which eliminates the ~$32/month per-AZ NAT Gateway cost. Lambda functions that need internet access (e.g., calling external APIs) should use non-VPC configurations or dedicated endpoints.

---

## 2. API Module (`modules/api`)

Implements the REST API layer using API Gateway v2 and per-domain Lambda functions.

### API Gateway

- **Type:** HTTP API (API Gateway v2)
- **Protocol:** HTTPS with custom domain
- **Integration:** Lambda proxy integrations per route group

### Lambda Functions

All Lambda functions share these defaults:

| Property     | Value             |
| ------------ | ----------------- |
| Architecture | arm64 (Graviton2) |
| Runtime      | Node.js 22.x      |
| Tracing      | AWS X-Ray enabled |

Per-domain configuration:

| Domain            | Memory | Concurrency  | Env Vars | Description                         |
| ----------------- | ------ | ------------ | -------- | ----------------------------------- |
| **auth**          | 256 MB | Unlimited    | 3        | Authentication and token management |
| **admin**         | 256 MB | Unlimited    | 7        | Admin panel operations              |
| **AI**            | 512 MB | 2 (reserved) | varies   | Bedrock inference, AI handlers      |
| **other domains** | 256 MB | Unlimited    | varies   | Listings, bookings, payments, etc.  |

### IAM

Each Lambda function has its own IAM execution role following least-privilege principles. Roles are scoped to only the AWS services and resources that the specific function needs (e.g., the payments Lambda can access SQS and SSM but not Bedrock).

---

## 3. Database Module (`modules/database`)

Managed database services for relational and cache workloads.

### Aurora Serverless v2

| Property     | Value                                               |
| ------------ | --------------------------------------------------- |
| Engine       | PostgreSQL 17                                       |
| Extensions   | PostGIS (geospatial queries)                        |
| Mode         | Serverless v2 (auto-scaling ACUs)                   |
| Connectivity | Private subnets only, Lambda security group ingress |

### ElastiCache Serverless (Redis)

| Property     | Value                                               |
| ------------ | --------------------------------------------------- |
| Engine       | Redis                                               |
| Mode         | Serverless (auto-scaling)                           |
| Connectivity | Private subnets only, Lambda security group ingress |

### Parameter Store

Connection strings and credentials are stored in AWS Systems Manager Parameter Store (SSM) as `SecureString` parameters, referenced by Lambda environment variables at deploy time.

---

## 4. Messaging Module (`modules/messaging`)

Real-time communication via WebSocket.

### WebSocket API Gateway

- **Type:** API Gateway v2 WebSocket API
- **Routes:** `$connect`, `$default`, `$disconnect`

### Lambda Handlers

| Handler        | Purpose                                                |
| -------------- | ------------------------------------------------------ |
| `onconnect`    | Registers connection in DynamoDB, validates auth token |
| `onmessage`    | Routes messages to recipients, handles broadcast logic |
| `ondisconnect` | Removes connection record, cleans up subscriptions     |

### DynamoDB Connections Table

| Property     | Value                                   |
| ------------ | --------------------------------------- |
| Billing mode | PAY_PER_REQUEST (on-demand)             |
| TTL          | Enabled (auto-expire stale connections) |
| Key schema   | Connection ID (partition key)           |

---

## 5. Storage Module (`modules/storage`)

S3 buckets for media, documents, analytics data, and query results.

| Bucket        | Access                         | Versioning | Storage Class       | Purpose                       |
| ------------- | ------------------------------ | ---------- | ------------------- | ----------------------------- |
| **media**     | Public read via CloudFront OAC | No         | Standard            | Property images, user uploads |
| **guides**    | Private                        | Yes        | Standard            | Travel guides, documents      |
| **analytics** | Private                        | No         | Intelligent-Tiering | Event data, Firehose delivery |
| **athena**    | Private                        | No         | Standard            | Athena query results          |

### Media Bucket CDN

The media bucket is fronted by a CloudFront distribution using Origin Access Control (OAC). The bucket policy denies direct access; all public reads go through CloudFront, which provides caching, HTTPS, and geographic distribution.

---

## 6. Payments Module (`modules/payments`)

Asynchronous payment processing with Stripe.

### SQS Queue

| Property      | Value                            |
| ------------- | -------------------------------- |
| Type          | Standard queue                   |
| Purpose       | Buffer for Stripe webhook events |
| Max retries   | 5                                |
| DLQ retention | 14 days                          |

Failed messages are moved to a dead-letter queue (DLQ) after 5 delivery attempts. The DLQ retains messages for 14 days to allow manual inspection and replay.

### Secrets

Stripe API keys are stored as SSM `SecureString` parameters, decrypted at Lambda cold-start time.

---

## 7. Analytics Module (`modules/analytics`)

Event ingestion and queryable data lake.

### Pipeline

```
Client events
    → API Gateway
        → Lambda
            → Kinesis Data Firehose
                → S3 (Parquet via Glue SerDe)
```

### Components

| Component            | Configuration                                       |
| -------------------- | --------------------------------------------------- |
| **Kinesis Firehose** | Delivery stream to S3 with Parquet conversion       |
| **Glue Catalog**     | Database and table definitions for analytics schema |
| **Athena Workgroup** | Query workgroup with 1 GB scan limit per query      |

The Glue catalog enables Athena to query Parquet files in S3 using standard SQL. The 1 GB scan limit on the Athena workgroup prevents runaway queries from generating unexpected costs.

---

## 8. Security Module (`modules/security`)

Web application firewall for API protection.

### WAF v2 WebACL

| Rule Group          | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| OWASP Core Rule Set | Protection against common web exploits (SQLi, XSS, etc.) |
| Rate limiting       | Throttle excessive requests per IP                       |

### Deployment

- **Production and staging:** WAF is associated with the API Gateway stage.
- **Development:** WAF is not attached (cost optimization).

---

## Root-Level Terraform Configurations

These `.tf` files live in the root of `infra/terraform/` alongside the module calls:

| File            | Purpose                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------ |
| `hosting.tf`    | S3 bucket for static site, CloudFront distribution, Cognito User Pool, DynamoDB main table |
| `ai.tf`         | Amazon Bedrock model access and configuration                                              |
| `ai-alarms.tf`  | CloudWatch alarms for AI Lambda errors, latency, and throttling                            |
| `guardrails.tf` | Bedrock Guardrails for content filtering and safety                                        |
| `finops.tf`     | Cost management: budgets, anomaly detection, tagging policies                              |
| `tracker.tf`    | Deal tracker feature infrastructure                                                        |
| `pipeline.tf`   | CI/CD pipeline definitions                                                                 |

---

## Standalone Stacks

These stacks are managed independently from the main Terraform stack. Each has its own state file and can be planned/applied separately.

| Stack                 | Path                       | Purpose                                                          |
| --------------------- | -------------------------- | ---------------------------------------------------------------- |
| **AI Memory**         | `infra/ai-memory/`         | Persistent memory store for AI conversations and context         |
| **AI Training**       | `infra/ai-training/`       | Training data pipeline and model fine-tuning infrastructure      |
| **Travel RAG**        | `infra/travel-rag/`        | Retrieval-Augmented Generation knowledge base for travel content |
| **AgentCore Gateway** | `infra/agentcore-gateway/` | AgentCore MCP gateway for agent-to-agent communication           |
| **Admin Runtime**     | `infra/admin-runtime/`     | Admin orchestration runtime for complex multi-step operations    |

### Working with standalone stacks

Each standalone stack follows the same workflow:

```bash
cd infra/<stack-name>
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

> **Important:** Standalone stacks may reference outputs from the main stack via Terraform remote state or SSM parameters. Always ensure the main stack is up to date before applying standalone stacks.
