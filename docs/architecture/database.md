# DynamoDB Single-Table Design

MapsBridge uses a single DynamoDB table for all domains. This document defines every key pattern, access pattern, Global Secondary Index (GSI) design, TTL strategy, capacity configuration, and streams setup.

---

## Design Principles

1. **Single table**: All entities share one table. Entity type is encoded in the partition key prefix (e.g., `USER#`, `THREAD#`, `SYSTEM#`).
2. **Key prefixes**: Partition keys (PK) and sort keys (SK) use `TYPE#value` notation to enable efficient queries and prevent key collisions across domains.
3. **Denormalization over joins**: Related data is co-located under the same partition key to support single-query access patterns.
4. **Sparse GSIs**: Global Secondary Indexes are populated only on items that need the alternate access pattern, keeping index storage and write costs minimal.

---

## Table Configuration

| Setting | Value |
|---------|-------|
| Table name | `mapsbridge-main` |
| Partition key | `PK` (String) |
| Sort key | `SK` (String) |
| Billing mode | On-demand (PAY_PER_REQUEST) |
| Encryption | AWS-managed key (SSE) |
| Point-in-time recovery | Enabled |
| Deletion protection | Enabled |

---

## Complete Key Schema

### User Domain

| PK | SK | Purpose | Key Attributes |
|----|-----|---------|----------------|
| `USER#{userId}` | `META` | User metadata | email, displayName, avatarUrl, createdAt, updatedAt, status |
| `USER#{userId}` | `ROUTE#{routeId}` | Saved route | title, waypoints, distance, duration, createdAt |
| `USER#{userId}` | `SUBSCRIPTION` | Subscription tier and status | tier (free/pro/premium), status (active/cancelled/past_due), stripeSubscriptionId, currentPeriodEnd |
| `USER#{userId}` | `CREDITS` | Credit wallet | balance, lifetimeEarned, lifetimeSpent, lastUpdated |
| `USER#{userId}` | `STRIPE_CUSTOMER` | Stripe customer binding | stripeCustomerId, createdAt |
| `USER#{userId}` | `AI#{requestId}` | AI request receipt | agentType, model, inputTokens, outputTokens, creditCost, createdAt |
| `USER#{userId}` | `AI_DAY#{date}` | Daily AI usage counter | requestCount, totalCredits, date |
| `USER#{userId}` | `AI_PREFERENCES` | Travel preferences | travelStyle, budgetRange, dietaryRestrictions, interests, languages |
| `USER#{userId}` | `AI_LATEST` | Latest conversation pointer | conversationId, lastMessageAt, agentType |
| `USER#{userId}` | `AI_CHAT#{conversationId}` | Conversation state | messages (list), agentType, startedAt, lastMessageAt, summary |
| `USER#{userId}` | `TELEMETRY#{ts}#{batch}` | Behavioral telemetry | events (list), sessionId, deviceType |
| `USER#{userId}` | `TRACKER#{jobId}` | Price tracker job | destination, dateRange, targetPrice, status, lastChecked |
| `USER#{userId}` | `DEAL_ALERT#{ts}` | Deal notification | destination, originalPrice, dealPrice, source, expiresAt |

### Messaging Domain

| PK | SK | Purpose | Key Attributes |
|----|-----|---------|----------------|
| `THREAD#{threadId}` | `META` | Thread metadata | title, type (direct/group), createdAt, lastMessageAt, messageCount |
| `THREAD#{threadId}` | `PARTICIPANT#{userId}` | Thread participant | joinedAt, role, GSI1PK, GSI1SK |
| `CHAT#{threadId}` | `MSG#{timestamp}` | Chat message | senderId, content, type (text/image/system), createdAt |
| `CHAT#{threadId}` | `READ#{userId}` | Read receipt | lastReadTimestamp, updatedAt |

### Sharing Domain

| PK | SK | Purpose | Key Attributes |
|----|-----|---------|----------------|
| `SHARE#{code}` | `ROUTE` | Shared route link | userId, routeId, title, waypoints, expiresAt (TTL) |
| `SHARE#{code}` | `METADATA` | Shared location | userId, locationData, description, expiresAt (TTL) |

### Profile Domain

| PK | SK | Purpose | Key Attributes |
|----|-----|---------|----------------|
| `PROFILE#{username}` | `PUBLIC` | Public profile | userId, displayName, bio, avatarUrl, routeCount, followerCount |
| `OWNER#{userId}` | `PUBLIC_PROFILE` | Username reservation | username, createdAt |

### Marketplace Domain

| PK | SK | Purpose | Key Attributes |
|----|-----|---------|----------------|
| `GUIDE#{guideId}` | `META` | Marketplace guide | authorId, title, description, price, currency, category, rating, downloadCount, s3Key, status |
| `PURCHASE#{userId}` | `GUIDE#{guideId}` | Guide purchase | price, currency, stripePaymentId, purchasedAt |

### Content Domain

| PK | SK | Purpose | Key Attributes |
|----|-----|---------|----------------|
| `BLOG#{blogId}` | `META` | Blog post | authorId, title, content, slug, status (draft/published), publishedAt |

### Admin and Moderation Domain

| PK | SK | Purpose | Key Attributes |
|----|-----|---------|----------------|
| `REPORT#{reportId}` | `META` | Moderation report | reporterId, targetType, targetId, reason, status, resolvedBy, createdAt |
| `AUDIT#{auditId}` | `META` | Audit log | actorId, action, targetType, targetId, metadata, createdAt |
| `REFUND#{refundId}` | `META` | Refund record | userId, amount, currency, reason, stripeRefundId, status, createdAt |
| `ADMINCREDIT#{requestId}` | `META` | Admin credit adjustment | userId, amount, reason, adminId, createdAt |
| `TICKET#{ticketId}` | `META` | Support ticket | userId, subject, description, status, priority, assignedTo, createdAt, updatedAt |
| `ANNOUNCEMENT#{id}` | `META` | System announcement | title, content, type (info/warning/critical), activeFrom, activeUntil |

### Billing Domain

| PK | SK | Purpose | Key Attributes |
|----|-----|---------|----------------|
| `PAYMENT#{id}` | `META` | Payment record | userId, amount, currency, type, stripePaymentIntentId, status, createdAt |
| `BILLING#CHECKOUT#{sessionId}` | `RECEIPT` | Checkout receipt | userId, items, totalAmount, currency, status, completedAt |
| `BILLING#INVOICE#{invoiceId}` | `RECEIPT` | Invoice receipt | userId, subscriptionId, amount, currency, status, paidAt |

### System Domain

| PK | SK | Purpose | Key Attributes |
|----|-----|---------|----------------|
| `SYSTEM#CONFIG` | `META` | Global configuration | maintenanceMode, featureFlags, defaultCreditGrant, maxDailyRequests |
| `SYSTEM#MODULES` | `META` | Module toggles | chat (enabled/disabled), marketplace, aiPlanner, tracker, community |
| `SYSTEM#AI_CONTROL` | `META` | AI control state | globalEnabled, allowedModels, maxConcurrency, costAlertThreshold |
| `SYSTEM#AI_RUNTIME` | `META` | AI runtime snapshot | activeRequests, dailyTokenUsage, dailyCost, lastUpdated |
| `SYSTEM#AI_AGENTS` | `META` | Agent catalog | agents (map of agentId to config: model, maxTokens, temperature, enabled) |
| `SYSTEM#AI_RELEASE` | `META` | Release pipeline | currentVersion, pendingVersion, rolloutPercentage, lastDeployedAt |
| `SYSTEM#AI` | `{date}` | Daily global AI counter | totalRequests, totalTokens, totalCost, byAgent (map), byModel (map) |

### AI Operations Domain

| PK | SK | Purpose | Key Attributes |
|----|-----|---------|----------------|
| `AI#OPERATIONS` | `{ts}#{uuid}` | Operation event log | eventType, agentId, userId, model, tokens, latencyMs, status, error |
| `AI#TRAINING_PENDING` | `{key}` | Training data queue | signalType, inputData, expectedOutput, score, collectedAt |

---

## Access Patterns

### User Operations

| Access Pattern | Key Condition | Notes |
|---------------|---------------|-------|
| Get user profile | PK = `USER#{userId}`, SK = `META` | GetItem, single read |
| Get user subscription | PK = `USER#{userId}`, SK = `SUBSCRIPTION` | GetItem |
| Get credit balance | PK = `USER#{userId}`, SK = `CREDITS` | GetItem |
| List user routes | PK = `USER#{userId}`, SK begins_with `ROUTE#` | Query, paginated |
| Get daily AI usage | PK = `USER#{userId}`, SK = `AI_DAY#{today}` | GetItem |
| List AI history | PK = `USER#{userId}`, SK begins_with `AI#` | Query, returns all AI receipts |
| List conversations | PK = `USER#{userId}`, SK begins_with `AI_CHAT#` | Query |
| Get latest conversation | PK = `USER#{userId}`, SK = `AI_LATEST` | GetItem |
| Deduct credits | PK = `USER#{userId}`, SK = `CREDITS` | UpdateItem with ConditionExpression: `balance >= :cost` |
| List user telemetry | PK = `USER#{userId}`, SK begins_with `TELEMETRY#` | Query, time-sorted |
| List tracker jobs | PK = `USER#{userId}`, SK begins_with `TRACKER#` | Query |
| List deal alerts | PK = `USER#{userId}`, SK begins_with `DEAL_ALERT#` | Query, newest first (ScanIndexForward=false) |

### Messaging Operations

| Access Pattern | Key Condition | Notes |
|---------------|---------------|-------|
| Get thread metadata | PK = `THREAD#{threadId}`, SK = `META` | GetItem |
| List thread participants | PK = `THREAD#{threadId}`, SK begins_with `PARTICIPANT#` | Query |
| List messages (paginated) | PK = `CHAT#{threadId}`, SK begins_with `MSG#` | Query, ScanIndexForward=false for newest first |
| Get read receipt | PK = `CHAT#{threadId}`, SK = `READ#{userId}` | GetItem |
| List user's threads | GSI1: GSI1PK = `USER#{userId}`, GSI1SK begins_with `THREAD#` | See GSI1 below |

### Sharing Operations

| Access Pattern | Key Condition | Notes |
|---------------|---------------|-------|
| Resolve share link | PK = `SHARE#{code}`, SK = `ROUTE` or `METADATA` | GetItem, public (no auth required) |

### Profile Operations

| Access Pattern | Key Condition | Notes |
|---------------|---------------|-------|
| Get public profile by username | PK = `PROFILE#{username}`, SK = `PUBLIC` | GetItem, public |
| Get username by userId | PK = `OWNER#{userId}`, SK = `PUBLIC_PROFILE` | GetItem, used to check username ownership |

### Marketplace Operations

| Access Pattern | Key Condition | Notes |
|---------------|---------------|-------|
| Get guide details | PK = `GUIDE#{guideId}`, SK = `META` | GetItem |
| Check if user purchased guide | PK = `PURCHASE#{userId}`, SK = `GUIDE#{guideId}` | GetItem |
| List user purchases | PK = `PURCHASE#{userId}`, SK begins_with `GUIDE#` | Query |

### Admin Operations

| Access Pattern | Key Condition | Notes |
|---------------|---------------|-------|
| Get system config | PK = `SYSTEM#CONFIG`, SK = `META` | GetItem |
| Get module toggles | PK = `SYSTEM#MODULES`, SK = `META` | GetItem |
| List audit log | PK = `AUDIT#{auditId}`, SK = `META` | Scan with filter (or use date-based auditId) |
| List reports | PK begins_with `REPORT#` | Scan with filter |
| Get daily AI stats | PK = `SYSTEM#AI`, SK = `{date}` | GetItem |
| List AI operations | PK = `AI#OPERATIONS`, SK begins_with `{date}` | Query for a specific day |

---

## Global Secondary Index: GSI1

GSI1 enables the "list threads for a user" access pattern, which cannot be served from the base table because threads are keyed by `THREAD#{threadId}`.

| GSI Attribute | Source |
|--------------|--------|
| GSI1PK | `USER#{userId}` (set on PARTICIPANT items only) |
| GSI1SK | `THREAD#{threadId}#${lastMessageAt}` |
| Projection | `KEYS_ONLY` + `threadId`, `title`, `lastMessageAt`, `unreadCount` |

**How it works**: When a user is added as a participant to a thread, the `THREAD#{threadId} / PARTICIPANT#{userId}` item includes `GSI1PK = USER#{userId}` and `GSI1SK = THREAD#{threadId}#${lastMessageAt}`. Querying GSI1 with `GSI1PK = USER#{userId}` returns all threads the user participates in, sorted by last activity.

**Update strategy**: When a new message arrives, the `onmessage` handler updates the `GSI1SK` on each participant item to reflect the new `lastMessageAt` timestamp. This keeps the thread listing sorted by recency.

```
Base Table                              GSI1
+--------------------------+            +--------------------------+
| PK          | SK         |            | GSI1PK      | GSI1SK     |
|-------------|------------|            |-------------|------------|
| THREAD#t1   | PART#u1    | ---------> | USER#u1     | THREAD#t1  |
| THREAD#t1   | PART#u2    | ---------> | USER#u2     | THREAD#t1  |
| THREAD#t2   | PART#u1    | ---------> | USER#u1     | THREAD#t2  |
| THREAD#t2   | PART#u3    | ---------> | USER#u3     | THREAD#t2  |
+--------------------------+            +--------------------------+

Query: GSI1PK = "USER#u1"
Result: THREAD#t1, THREAD#t2 (all threads for user u1)
```

---

## TTL (Time-To-Live)

DynamoDB TTL automatically deletes expired items at no cost. The following item types use TTL:

| Item Type | TTL Attribute | Retention |
|-----------|--------------|-----------|
| `SHARE#{code} / ROUTE` | `expiresAt` | 30 days after creation |
| `SHARE#{code} / METADATA` | `expiresAt` | 30 days after creation |
| `USER#{userId} / TELEMETRY#{ts}#{batch}` | `expiresAt` | 90 days |
| `USER#{userId} / DEAL_ALERT#{ts}` | `expiresAt` | 14 days |
| `USER#{userId} / AI#{requestId}` | `expiresAt` | 365 days |
| `AI#OPERATIONS / {ts}#{uuid}` | `expiresAt` | 30 days |
| `AI#TRAINING_PENDING / {key}` | `expiresAt` | 7 days (processed items removed sooner) |

The TTL attribute is named `expiresAt` and stores a Unix epoch timestamp (seconds).

---

## DynamoDB Streams

Streams are enabled on the table with `StreamViewType: NEW_AND_OLD_IMAGES`. Downstream consumers:

| Consumer | Trigger Condition | Purpose |
|----------|-------------------|---------|
| Analytics Firehose | All item changes | Writes change events to S3 (Parquet) for analytics |
| Search indexer | `USER#*/ROUTE#*` changes | Updates route search index |
| Notification dispatcher | `CHAT#*/MSG#*` inserts | Triggers push notifications for offline users |
| Credit audit | `USER#*/CREDITS` updates | Logs all credit balance changes for reconciliation |

---

## Capacity and Performance

| Setting | Value | Rationale |
|---------|-------|-----------|
| Billing mode | On-demand | Unpredictable traffic patterns during early growth phase |
| Read consistency | Eventually consistent (default) | Acceptable for most reads; strong consistency used only for credit deduction and subscription checks |
| Max item size | 400 KB (DynamoDB limit) | Conversation messages in `AI_CHAT#` items are summarized to stay within limits |
| Burst capacity | Up to 3,000 RCU / 1,000 WCU | DynamoDB automatic burst for traffic spikes |

### Hot Partition Mitigation

- **SYSTEM# keys**: Low-cardinality system configuration keys are read-heavy but rarely written. Cached in Lambda memory (60-second TTL) and ElastiCache to avoid hot partitions.
- **Daily counters** (`AI_DAY#`, `SYSTEM#AI/{date}`): Use atomic `ADD` operations. The `SYSTEM#AI` daily counter is the only true hot key; write sharding (appending a shard suffix) is implemented if throughput exceeds thresholds.

---

## Conditional Writes and Transactions

### Credit Deduction (Optimistic Locking)

```
UpdateItem:
  Key: { PK: "USER#{userId}", SK: "CREDITS" }
  UpdateExpression: "SET balance = balance - :cost, lifetimeSpent = lifetimeSpent + :cost"
  ConditionExpression: "balance >= :cost"
```

If the condition fails, the Lambda returns HTTP 402 (Payment Required) without invoking Bedrock.

### Username Reservation (Transaction)

```
TransactWriteItems:
  - Put: { PK: "PROFILE#{username}", SK: "PUBLIC", ... }
    ConditionExpression: "attribute_not_exists(PK)"
  - Put: { PK: "OWNER#{userId}", SK: "PUBLIC_PROFILE", username: "..." }
    ConditionExpression: "attribute_not_exists(PK)"
```

Both items must be created atomically. If the username is taken, the transaction fails and the user is prompted to choose another.

### Subscription Update (Transaction)

```
TransactWriteItems:
  - Update: { PK: "USER#{userId}", SK: "SUBSCRIPTION", ... }
  - Update: { PK: "USER#{userId}", SK: "CREDITS", ... }
```

Subscription tier changes and credit grants are applied atomically to prevent inconsistency between a user's tier and their credit balance.

---

## Key Construction Utilities

The `packages/database/keys.ts` module provides typed helper functions for constructing keys:

```typescript
// Example key builders (simplified)
const userKey      = (userId: string)     => ({ PK: `USER#${userId}` });
const userMeta     = (userId: string)     => ({ PK: `USER#${userId}`, SK: 'META' });
const userRoute    = (userId: string, routeId: string) =>
                     ({ PK: `USER#${userId}`, SK: `ROUTE#${routeId}` });
const threadMeta   = (threadId: string)   => ({ PK: `THREAD#${threadId}`, SK: 'META' });
const chatMessage  = (threadId: string, ts: string) =>
                     ({ PK: `CHAT#${threadId}`, SK: `MSG#${ts}` });
const shareRoute   = (code: string)       => ({ PK: `SHARE#${code}`, SK: 'ROUTE' });
const systemConfig = ()                   => ({ PK: 'SYSTEM#CONFIG', SK: 'META' });
```

All Lambda handlers import these helpers rather than constructing key strings directly, ensuring consistency and type safety across the codebase.

---

## Aurora Serverless v2 (Secondary)

While DynamoDB is the primary data store, Aurora Serverless v2 (PostgreSQL 17 + PostGIS) is available for:

| Use Case | Rationale |
|----------|-----------|
| Geospatial queries | PostGIS enables complex spatial queries (radius search, polygon containment, nearest-neighbor) that DynamoDB cannot perform |
| Admin reporting | Complex aggregations and joins for admin dashboards |
| Full-text search | PostgreSQL `tsvector` for guide and blog content search |
| Analytics backfill | Historical data analysis requiring SQL joins |

Aurora is not in the critical request path for end users. Writes always go to DynamoDB first; Aurora is populated asynchronously via DynamoDB Streams or batch jobs.

---

## ElastiCache Serverless (Redis)

Redis serves as the caching and ephemeral state layer:

| Use Case | Key Pattern | TTL |
|----------|------------|-----|
| System config cache | `config:system` | 60s |
| Rate limiting counters | `rate:{userId}:{endpoint}` | Sliding window |
| WebSocket connection map | `ws:conn:{userId}` | Session duration |
| AI response cache | `ai:cache:{hash}` | 1 hour |
| Session tokens | `session:{tokenId}` | Token lifetime |

Redis is accessed from Lambda functions within the VPC via VPC endpoints. Cache misses fall through to DynamoDB.
