# MapsBridge Admin API Reference

Base URL: `/api/v1/admin`

All admin endpoints require a valid JWT Bearer token with an appropriate role. Access is governed by role-based access control (RBAC):

| Role | Access |
|------|--------|
| **admin** | Full access to all endpoints |
| **moderator** | Content management and support endpoints |
| **support** | User lookup and support ticket endpoints |

Unauthorized access returns `403 Forbidden`.

---

## Session & Dashboard

### `GET /admin/session`
**Auth:** Required (any admin role)
**Description:** Retrieve the current admin session including identity, role, and granular permissions.
**Response:**
```json
{
  "userId": "string",
  "email": "string",
  "role": "admin | moderator | support",
  "permissions": ["users.read", "users.write", "content.moderate", "..."],
  "sessionExpiresAt": "ISO-8601"
}
```
**Errors:** `401` Unauthorized. `403` No admin role assigned.

---

### `GET /admin/metrics`
**Auth:** Required (admin)
**Description:** Dashboard metrics overview including user counts, revenue summary, active routes, and AI usage for the current period.
**Response:**
```json
{
  "users": { "total": 0, "activeToday": 0, "newThisWeek": 0 },
  "routes": { "total": 0, "createdToday": 0 },
  "revenue": { "mrr": 0, "currency": "USD" },
  "ai": { "requestsToday": 0, "creditsConsumed": 0 },
  "generatedAt": "ISO-8601"
}
```
**Errors:** `403` Insufficient role.

---

## User Management

### `GET /admin/users`
**Auth:** Required (admin, support)
**Description:** List all users with filtering and pagination. Supports search by email, username, or status.
**Request:** Query parameters — `limit`, `nextToken`, `search`, `status` (active/suspended), `tier` (free/pro/premium), `sort` (newest/oldest).
**Response:**
```json
{
  "users": [
    {
      "userId": "string",
      "email": "string",
      "username": "string",
      "tier": "free | pro | premium",
      "status": "active | suspended",
      "createdAt": "ISO-8601",
      "lastLoginAt": "ISO-8601"
    }
  ],
  "nextToken": "string | null",
  "totalCount": 0
}
```
**Errors:** `403` Insufficient role.

---

### `GET /admin/users/{id}`
**Auth:** Required (admin, support)
**Description:** Retrieve full detail for a specific user, including subscription info, wallet state, route count, AI usage, and moderation history.
**Response:**
```json
{
  "userId": "string",
  "email": "string",
  "username": "string",
  "role": "user | admin | moderator | support",
  "tier": "free | pro | premium",
  "status": "active | suspended",
  "wallet": { "credits": 0, "frozen": false },
  "subscription": { "plan": "string", "status": "string", "currentPeriodEnd": "ISO-8601" },
  "stats": { "routeCount": 0, "aiRequestsTotal": 0, "lastLoginAt": "ISO-8601" },
  "moderationHistory": [{ "action": "string", "reason": "string", "at": "ISO-8601", "by": "string" }],
  "createdAt": "ISO-8601"
}
```
**Errors:** `404` User not found.

---

### `POST /admin/users/{id}/suspend`
**Auth:** Required (admin)
**Description:** Suspend a user account. The user is immediately logged out and cannot authenticate until unsuspended.
**Request:**
```json
{
  "reason": "string"
}
```
**Response:** `200 OK`.
**Errors:** `400` Already suspended. `404` User not found.

---

### `POST /admin/users/{id}/unsuspend`
**Auth:** Required (admin)
**Description:** Restore a suspended user account, re-enabling authentication and access.
**Response:** `200 OK`.
**Errors:** `400` User is not suspended. `404` User not found.

---

### `POST /admin/users/{id}/refund`
**Auth:** Required (admin)
**Description:** Issue a Stripe refund for a user's payment. Processes the refund through Stripe and updates internal records.
**Request:**
```json
{
  "paymentIntentId": "string",
  "amount": 0,
  "reason": "string"
}
```
If `amount` is omitted, a full refund is issued.
**Response:**
```json
{
  "refundId": "string",
  "amount": 0,
  "currency": "USD",
  "status": "succeeded"
}
```
**Errors:** `400` Invalid payment intent or already refunded. `404` User not found. `502` Stripe error.

---

### `POST /admin/users/{id}/profile`
**Auth:** Required (admin)
**Description:** Update a user's profile fields on their behalf.
**Request:**
```json
{
  "displayName": "string",
  "bio": "string",
  "avatar": "string (S3 key)"
}
```
**Response:** `200 OK` — updated profile.
**Errors:** `404` User not found.

---

### `POST /admin/users/{id}/sessions`
**Auth:** Required (admin)
**Description:** Revoke all active sessions for a user, forcing re-authentication on all devices.
**Response:** `200 OK`.
**Errors:** `404` User not found.

---

### `POST /admin/users/{id}/role`
**Auth:** Required (admin)
**Description:** Change a user's role. Available roles: `admin`, `moderator`, `support`, `user`.
**Request:**
```json
{
  "role": "admin | moderator | support | user"
}
```
**Response:** `200 OK`.
**Errors:** `400` Invalid role. `403` Cannot demote the last admin. `404` User not found.

---

### `POST /admin/users/{id}/credits`
**Auth:** Required (admin)
**Description:** Adjust a user's credit balance (add or deduct). This operation is **idempotent** — include a unique `operationId` to prevent duplicate adjustments.
**Request:**
```json
{
  "amount": 50,
  "operationId": "string (UUID)",
  "reason": "string"
}
```
Use positive values to add credits, negative values to deduct.
**Response:**
```json
{
  "previousBalance": 20,
  "newBalance": 70,
  "adjustment": 50
}
```
**Errors:** `400` Would result in negative balance. `404` User not found. `409` Duplicate `operationId`.

---

### `POST /admin/users/{id}/wallet`
**Auth:** Required (admin)
**Description:** Freeze or unfreeze a user's wallet. A frozen wallet prevents all credit-consuming operations (AI requests, purchases).
**Request:**
```json
{
  "action": "freeze | unfreeze",
  "reason": "string"
}
```
**Response:** `200 OK`.
**Errors:** `400` Wallet already in requested state. `404` User not found.

---

### `POST /admin/users/{id}/subscription`
**Auth:** Required (admin)
**Description:** Cancel or resume a user's subscription. Cancellation takes effect at the end of the current billing period unless immediate cancellation is specified.
**Request:**
```json
{
  "action": "cancel | resume",
  "immediate": false
}
```
**Response:** `200 OK` — updated subscription state.
**Errors:** `400` No active subscription (for cancel) or not canceled (for resume). `404` User not found. `502` Stripe error.

---

## Finance

### `GET /admin/finance`
**Auth:** Required (admin)
**Description:** Revenue dashboard with MRR, churn rate, ARPU, and revenue breakdown by plan over a configurable time range.
**Request:** Query parameters — `period` (7d/30d/90d/1y, default 30d).
**Response:**
```json
{
  "mrr": 0,
  "arr": 0,
  "churnRate": 0.02,
  "arpu": 0,
  "currency": "USD",
  "revenueByPlan": { "pro": 0, "premium": 0 },
  "trend": [{ "date": "YYYY-MM-DD", "revenue": 0 }],
  "period": "30d"
}
```
**Errors:** `403` Insufficient role.

---

### `GET /admin/payments`
**Auth:** Required (admin)
**Description:** Payment transaction log with filtering by user, status, and date range.
**Request:** Query parameters — `limit`, `nextToken`, `userId`, `status` (succeeded/failed/refunded), `from` (ISO-8601), `to` (ISO-8601).
**Response:**
```json
{
  "payments": [
    {
      "paymentId": "string",
      "userId": "string",
      "amount": 0,
      "currency": "USD",
      "status": "succeeded | failed | refunded",
      "description": "string",
      "createdAt": "ISO-8601"
    }
  ],
  "nextToken": "string | null"
}
```
**Errors:** `403` Insufficient role.

---

## System

### `GET /admin/system-health`
**Auth:** Required (admin)
**Description:** Comprehensive service health check across all backend components — database, cache, queue, Stripe, AI provider, S3, and OSRM.
**Response:**
```json
{
  "overall": "healthy | degraded | unhealthy",
  "services": {
    "dynamodb": { "status": "healthy", "latencyMs": 12 },
    "redis": { "status": "healthy", "latencyMs": 3 },
    "sqs": { "status": "healthy", "latencyMs": 8 },
    "stripe": { "status": "healthy", "latencyMs": 150 },
    "ai": { "status": "healthy", "latencyMs": 200 },
    "s3": { "status": "healthy", "latencyMs": 20 },
    "osrm": { "status": "healthy", "latencyMs": 45 }
  },
  "checkedAt": "ISO-8601"
}
```
**Errors:** `403` Insufficient role.

---

### `GET /admin/system-config`
**Auth:** Required (admin)
**Description:** Retrieve current system configuration, including maintenance mode state and feature flags.
**Response:**
```json
{
  "maintenanceMode": false,
  "maintenanceMessage": "string | null",
  "flags": {
    "registrationEnabled": true,
    "aiEnabled": true,
    "marketplaceEnabled": true,
    "trackerEnabled": true
  },
  "updatedAt": "ISO-8601",
  "updatedBy": "string"
}
```
**Errors:** `403` Insufficient role.

---

### `POST /admin/system-config`
**Auth:** Required (admin)
**Description:** Update system configuration. Can enable/disable maintenance mode and toggle feature flags. Changes take effect immediately.
**Request:**
```json
{
  "maintenanceMode": false,
  "maintenanceMessage": "string | null",
  "flags": {
    "registrationEnabled": true,
    "aiEnabled": true,
    "marketplaceEnabled": true,
    "trackerEnabled": true
  }
}
```
**Response:** `200 OK` — updated config.
**Errors:** `400` Validation error. `403` Insufficient role.

---

### `GET /admin/module-config`
**Auth:** Required (admin)
**Description:** Retrieve module-level toggle configuration. Modules can be independently enabled or disabled without full maintenance mode.
**Response:**
```json
{
  "modules": {
    "routes": { "enabled": true },
    "chat": { "enabled": true },
    "marketplace": { "enabled": true },
    "ai": { "enabled": true },
    "tracker": { "enabled": true },
    "support": { "enabled": true }
  },
  "updatedAt": "ISO-8601"
}
```
**Errors:** `403` Insufficient role.

---

### `POST /admin/module-config`
**Auth:** Required (admin)
**Description:** Update module toggles. Disabling a module returns `503 Service Unavailable` for all endpoints in that module.
**Request:**
```json
{
  "modules": {
    "chat": { "enabled": false }
  }
}
```
Partial updates are supported — only provided modules are changed.
**Response:** `200 OK` — updated module config.
**Errors:** `400` Invalid module name. `403` Insufficient role.

---

### `GET /admin/audit-logs`
**Auth:** Required (admin)
**Description:** Query the audit trail for all admin actions. Every state-changing admin operation is logged with actor, target, action, and timestamp.
**Request:** Query parameters — `limit`, `nextToken`, `actorId`, `action`, `targetType` (user/route/system/content), `from` (ISO-8601), `to` (ISO-8601).
**Response:**
```json
{
  "logs": [
    {
      "logId": "string",
      "actorId": "string",
      "actorEmail": "string",
      "action": "string",
      "targetType": "string",
      "targetId": "string",
      "details": {},
      "timestamp": "ISO-8601"
    }
  ],
  "nextToken": "string | null"
}
```
**Errors:** `403` Insufficient role.

---

### `GET /admin/realtime`
**Auth:** Required (admin)
**Description:** Live telemetry stream data, including active connections, request rates, and error rates for the current time window.
**Response:**
```json
{
  "activeConnections": 0,
  "requestsPerMinute": 0,
  "errorRate": 0.01,
  "topEndpoints": [{ "path": "string", "count": 0 }],
  "window": "5m",
  "timestamp": "ISO-8601"
}
```
**Errors:** `403` Insufficient role.

---

## Content Management

### `GET /admin/routes`
**Auth:** Required (admin, moderator)
**Description:** List all routes across all users with filtering by status, user, and date.
**Request:** Query parameters — `limit`, `nextToken`, `userId`, `status` (active/suspended/featured), `search`.
**Response:**
```json
{
  "routes": [
    {
      "id": "string",
      "title": "string",
      "ownerId": "string",
      "ownerEmail": "string",
      "status": "active | suspended | featured",
      "waypointCount": 0,
      "createdAt": "ISO-8601"
    }
  ],
  "nextToken": "string | null"
}
```
**Errors:** `403` Insufficient role.

---

### `POST /admin/routes/{id}/action`
**Auth:** Required (admin, moderator)
**Description:** Perform a moderation action on a route — approve, feature (promote to homepage/discovery), or suspend.
**Request:**
```json
{
  "action": "approve | feature | suspend",
  "reason": "string"
}
```
**Response:** `200 OK` — updated route status.
**Errors:** `400` Invalid action. `404` Route not found.

---

### `POST /admin/routes/{id}/details`
**Auth:** Required (admin, moderator)
**Description:** Administratively update route details such as title, description, or tags.
**Request:**
```json
{
  "title": "string",
  "description": "string",
  "tags": ["string"]
}
```
**Response:** `200 OK` — updated route.
**Errors:** `404` Route not found.

---

### `GET /admin/reports`
**Auth:** Required (admin, moderator)
**Description:** Retrieve the moderation queue — user-submitted reports on routes, profiles, or chat messages.
**Request:** Query parameters — `limit`, `nextToken`, `status` (pending/resolved), `type` (route/profile/message).
**Response:**
```json
{
  "reports": [
    {
      "reportId": "string",
      "type": "route | profile | message",
      "targetId": "string",
      "reporterId": "string",
      "reason": "string",
      "status": "pending | resolved",
      "createdAt": "ISO-8601"
    }
  ],
  "nextToken": "string | null"
}
```
**Errors:** `403` Insufficient role.

---

### `POST /admin/reports/{id}/resolve`
**Auth:** Required (admin, moderator)
**Description:** Resolve a moderation report with an action decision.
**Request:**
```json
{
  "resolution": "dismissed | warning_issued | content_removed | user_suspended",
  "notes": "string"
}
```
**Response:** `200 OK`.
**Errors:** `400` Invalid resolution. `404` Report not found.

---

### `GET /admin/shares`
**Auth:** Required (admin, moderator)
**Description:** List all active share links across the platform.
**Request:** Query parameters — `limit`, `nextToken`, `routeId`, `userId`.
**Response:**
```json
{
  "shares": [
    {
      "shareId": "string",
      "routeId": "string",
      "ownerId": "string",
      "url": "string",
      "expiresAt": "ISO-8601",
      "createdAt": "ISO-8601"
    }
  ],
  "nextToken": "string | null"
}
```
**Errors:** `403` Insufficient role.

---

### `POST /admin/shares/{id}/revoke`
**Auth:** Required (admin, moderator)
**Description:** Immediately revoke a share link, rendering it inaccessible.
**Request:**
```json
{
  "reason": "string"
}
```
**Response:** `200 OK`.
**Errors:** `404` Share not found.

---

### `GET /admin/profiles`
**Auth:** Required (admin, moderator)
**Description:** List all published public profiles.
**Request:** Query parameters — `limit`, `nextToken`, `search`, `status` (published/moderated).
**Response:**
```json
{
  "profiles": [
    {
      "userId": "string",
      "username": "string",
      "displayName": "string",
      "status": "published | moderated",
      "publishedAt": "ISO-8601"
    }
  ],
  "nextToken": "string | null"
}
```
**Errors:** `403` Insufficient role.

---

### `POST /admin/profiles/{id}/moderate`
**Auth:** Required (admin, moderator)
**Description:** Moderate a public profile — approve, unpublish, or flag for review.
**Request:**
```json
{
  "action": "approve | unpublish | flag",
  "reason": "string"
}
```
**Response:** `200 OK`.
**Errors:** `400` Invalid action. `404` Profile not found.

---

### `GET /admin/content`
**Auth:** Required (admin, moderator)
**Description:** List all marketplace content (blogs and guides) with filtering.
**Request:** Query parameters — `limit`, `nextToken`, `type` (blog/guide), `status` (published/draft/suspended), `search`.
**Response:**
```json
{
  "content": [
    {
      "id": "string",
      "type": "blog | guide",
      "title": "string",
      "authorId": "string",
      "status": "published | draft | suspended",
      "createdAt": "ISO-8601"
    }
  ],
  "nextToken": "string | null"
}
```
**Errors:** `403` Insufficient role.

---

### `POST /admin/content`
**Auth:** Required (admin)
**Description:** Create a new blog post as an admin (for announcements or official content).
**Request:**
```json
{
  "title": "string",
  "content": "string (markdown)",
  "tags": ["string"],
  "coverImageKey": "string (S3 key)",
  "published": true
}
```
**Response:** `201 Created` — content object.
**Errors:** `400` Validation error.

---

### `POST /admin/content/{type}/{id}`
**Auth:** Required (admin, moderator)
**Description:** Update or moderate a piece of marketplace content. The `type` path parameter is either `blog` or `guide`.
**Request:**
```json
{
  "title": "string",
  "status": "published | suspended",
  "reason": "string"
}
```
**Response:** `200 OK` — updated content.
**Errors:** `400` Invalid type. `404` Content not found.

---

### `GET /admin/tickets`
**Auth:** Required (admin, moderator, support)
**Description:** List all support tickets across all users with filtering.
**Request:** Query parameters — `limit`, `nextToken`, `status` (open/in_progress/resolved/closed), `assigneeId`, `priority`, `userId`.
**Response:**
```json
{
  "tickets": [
    {
      "ticketId": "string",
      "userId": "string",
      "userEmail": "string",
      "subject": "string",
      "status": "open | in_progress | resolved | closed",
      "priority": "low | normal | high | urgent",
      "assigneeId": "string | null",
      "createdAt": "ISO-8601",
      "lastReplyAt": "ISO-8601"
    }
  ],
  "nextToken": "string | null"
}
```
**Errors:** `403` Insufficient role.

---

### `POST /admin/tickets/{id}`
**Auth:** Required (admin, moderator, support)
**Description:** Update a support ticket — change status, assign to an agent, set priority, or add an internal note.
**Request:**
```json
{
  "status": "open | in_progress | resolved | closed",
  "assigneeId": "string | null",
  "priority": "low | normal | high | urgent",
  "reply": "string",
  "internalNote": "string"
}
```
All fields are optional; only provided fields are updated.
**Response:** `200 OK` — updated ticket.
**Errors:** `404` Ticket not found.

---

### `GET /admin/announcements`
**Auth:** Required (admin)
**Description:** List all announcements (active, scheduled, and expired).
**Request:** Query parameters — `limit`, `nextToken`, `status` (active/scheduled/expired).
**Response:**
```json
{
  "announcements": [
    {
      "id": "string",
      "title": "string",
      "message": "string",
      "type": "info | warning | critical",
      "status": "active | scheduled | expired",
      "startsAt": "ISO-8601",
      "expiresAt": "ISO-8601",
      "createdBy": "string"
    }
  ],
  "nextToken": "string | null"
}
```
**Errors:** `403` Insufficient role.

---

### `POST /admin/announcements`
**Auth:** Required (admin)
**Description:** Create or update an announcement. If an `id` is provided, the existing announcement is updated; otherwise a new one is created.
**Request:**
```json
{
  "id": "string (optional, for update)",
  "title": "string",
  "message": "string",
  "type": "info | warning | critical",
  "startsAt": "ISO-8601",
  "expiresAt": "ISO-8601"
}
```
**Response:** `201 Created` or `200 OK` — announcement object.
**Errors:** `400` Validation error (e.g., expiresAt before startsAt). `404` Announcement not found (for update).

---

### `GET /admin/subscriptions`
**Auth:** Required (admin)
**Description:** List all subscriptions across the platform with filtering by plan and status.
**Request:** Query parameters — `limit`, `nextToken`, `plan`, `status` (active/canceled/past_due/trialing).
**Response:**
```json
{
  "subscriptions": [
    {
      "subscriptionId": "string",
      "userId": "string",
      "userEmail": "string",
      "plan": "string",
      "status": "active | canceled | past_due | trialing",
      "currentPeriodEnd": "ISO-8601",
      "createdAt": "ISO-8601"
    }
  ],
  "nextToken": "string | null"
}
```
**Errors:** `403` Insufficient role.

---

### `GET /admin/usage`
**Auth:** Required (admin)
**Description:** Retrieve AI usage records across all users with filtering.
**Request:** Query parameters — `limit`, `nextToken`, `userId`, `type` (clarify/chat/route), `from` (ISO-8601), `to` (ISO-8601).
**Response:**
```json
{
  "records": [
    {
      "recordId": "string",
      "userId": "string",
      "type": "clarify | chat | route",
      "creditsCost": 0,
      "prompt": "string (truncated)",
      "timestamp": "ISO-8601"
    }
  ],
  "nextToken": "string | null"
}
```
**Errors:** `403` Insufficient role.

---

### `GET /admin/credit-stats`
**Auth:** Required (admin)
**Description:** Credit economy statistics — total credits in circulation, credits consumed, top consumers, and burn rate.
**Request:** Query parameters — `period` (7d/30d/90d, default 30d).
**Response:**
```json
{
  "totalInCirculation": 0,
  "totalConsumed": 0,
  "totalGranted": 0,
  "burnRate": 0,
  "topConsumers": [
    { "userId": "string", "email": "string", "consumed": 0 }
  ],
  "period": "30d"
}
```
**Errors:** `403` Insufficient role.

---

## AI Operations

### `GET /admin/ai-operations`
**Auth:** Required (admin)
**Description:** Retrieve the current AI control state — whether AI is globally enabled, active agent count, model version, and queue depth.
**Response:**
```json
{
  "enabled": true,
  "activeAgents": 8,
  "modelVersion": "string",
  "queueDepth": 0,
  "requestsToday": 0,
  "errorRate": 0.01,
  "avgLatencyMs": 1200,
  "updatedAt": "ISO-8601"
}
```
**Errors:** `403` Insufficient role.

---

### `POST /admin/ai-control`
**Auth:** Required (admin)
**Description:** Enable or disable the AI subsystem globally. When disabled, all AI endpoints return `503 Service Unavailable`.
**Request:**
```json
{
  "enabled": true,
  "reason": "string"
}
```
**Response:** `200 OK`.
**Errors:** `403` Insufficient role.

---

### `GET /admin/ai-agents`
**Auth:** Required (admin)
**Description:** Retrieve the full agent catalog. The system supports 8 specialized agents, each with independent configuration and toggle state.
**Response:**
```json
{
  "agents": [
    {
      "agentId": "string",
      "name": "string",
      "description": "string",
      "enabled": true,
      "version": "string",
      "requestsToday": 0,
      "avgLatencyMs": 0,
      "errorRate": 0.0
    }
  ]
}
```
**Errors:** `403` Insufficient role.

---

### `POST /admin/ai-agents/{id}/config`
**Auth:** Required (admin)
**Description:** Toggle an individual AI agent on or off, or update its configuration parameters.
**Request:**
```json
{
  "enabled": true,
  "config": {
    "maxTokens": 4096,
    "temperature": 0.7,
    "systemPromptOverride": "string | null"
  }
}
```
**Response:** `200 OK` — updated agent config.
**Errors:** `400` Invalid configuration. `404` Agent not found.

---

### `GET /admin/ai-training`
**Auth:** Required (admin)
**Description:** Retrieve the training data queue — AI interactions flagged for review to improve model quality.
**Request:** Query parameters — `limit`, `nextToken`, `status` (pending/approved/rejected).
**Response:**
```json
{
  "records": [
    {
      "recordId": "string",
      "userId": "string",
      "prompt": "string",
      "response": "string",
      "type": "clarify | chat | route",
      "status": "pending | approved | rejected",
      "flaggedAt": "ISO-8601"
    }
  ],
  "nextToken": "string | null"
}
```
**Errors:** `403` Insufficient role.

---

### `POST /admin/ai-training/{id}/review`
**Auth:** Required (admin)
**Description:** Review a training data record — approve for inclusion in training data or reject.
**Request:**
```json
{
  "decision": "approve | reject",
  "notes": "string"
}
```
**Response:** `200 OK`.
**Errors:** `400` Invalid decision. `404` Record not found.

---

### `GET /admin/ai-release`
**Auth:** Required (admin)
**Description:** View the AI release pipeline — current active version, staged versions, and release history.
**Response:**
```json
{
  "current": {
    "version": "string",
    "publishedAt": "ISO-8601",
    "publishedBy": "string"
  },
  "staged": {
    "version": "string | null",
    "proposedAt": "ISO-8601",
    "proposedBy": "string"
  },
  "history": [
    {
      "version": "string",
      "action": "publish | rollback",
      "at": "ISO-8601",
      "by": "string"
    }
  ]
}
```
**Errors:** `403` Insufficient role.

---

### `POST /admin/ai-release/propose`
**Auth:** Required (admin)
**Description:** Propose a new AI release version for staging. The version must be reviewed before publishing.
**Request:**
```json
{
  "version": "string",
  "changelog": "string",
  "config": {}
}
```
**Response:** `201 Created` — staged release.
**Errors:** `400` Version already exists. `409` Another release is already staged.

---

### `POST /admin/ai-release/publish`
**Auth:** Required (admin)
**Description:** Publish the currently staged AI release to production. Replaces the active version.
**Request:**
```json
{
  "confirm": true
}
```
**Response:** `200 OK` — published release details.
**Errors:** `400` No staged release. `409` `confirm` must be `true`.

---

### `POST /admin/ai-release/rollback`
**Auth:** Required (admin)
**Description:** Rollback the AI system to the previous production version. Takes effect immediately.
**Request:**
```json
{
  "reason": "string"
}
```
**Response:**
```json
{
  "rolledBackFrom": "string",
  "rolledBackTo": "string",
  "at": "ISO-8601"
}
```
**Errors:** `400` No previous version available to rollback to.
