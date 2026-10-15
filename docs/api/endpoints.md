# MapsBridge API Reference

Base URL: `/api/v1`

All endpoints require a valid JWT Bearer token in the `Authorization` header unless noted otherwise. Responses use standard HTTP status codes and return JSON.

---

## Routes

### `GET /routes`

**Auth:** Required
**Description:** List all routes belonging to the authenticated user. Returns a summary array sorted by last-modified date.
**Request:** Query parameters — `limit` (default 20), `nextToken` (cursor for pagination).
**Response:**

```json
{
  "routes": [{ "id", "title", "createdAt", "updatedAt", "waypointCount" }],
  "nextToken": "string | null"
}
```

**Errors:** `401` Unauthorized.

---

### `POST /routes`

**Auth:** Required
**Description:** Create a new route. Free-tier users are limited to a maximum of 3 routes; exceeding this returns a 403.
**Request:**

```json
{
  "title": "string",
  "description": "string",
  "waypoints": [{ "lat": 0.0, "lng": 0.0, "label": "string" }],
  "tags": ["string"]
}
```

**Response:** `201 Created` — full route object with generated `id`.
**Errors:** `400` Validation error. `403` Route limit reached (free tier).

---

### `GET /routes/{id}`

**Auth:** Required
**Description:** Retrieve full details for a single route owned by the authenticated user.
**Response:**

```json
{
  "id", "title", "description", "waypoints", "tags",
  "createdAt", "updatedAt", "ownerId"
}
```

**Errors:** `404` Route not found or not owned by user.

---

### `PUT /routes/{id}`

**Auth:** Required
**Description:** Update an existing route. Partial updates are supported; only provided fields are overwritten.
**Request:**

```json
{
  "title": "string",
  "description": "string",
  "waypoints": [{ "lat": 0.0, "lng": 0.0, "label": "string" }],
  "tags": ["string"]
}
```

**Response:** `200 OK` — updated route object.
**Errors:** `400` Validation error. `404` Route not found.

---

### `DELETE /routes/{id}`

**Auth:** Required
**Description:** Permanently delete a route and all associated media.
**Response:** `204 No Content`.
**Errors:** `404` Route not found.

---

### `POST /routes/{id}/share`

**Auth:** Required
**Description:** Generate a public share link for the route. The link expires after the specified TTL (minimum 1 hour, maximum 7 days).
**Request:**

```json
{
  "ttl": "4h"
}
```

Accepted TTL formats: `1h`, `4h`, `12h`, `1d`, `3d`, `7d`.
**Response:**

```json
{
  "shareId": "string",
  "url": "string",
  "expiresAt": "ISO-8601"
}
```

**Errors:** `400` Invalid TTL value. `404` Route not found.

---

### `GET /routes/{id}/osrm/{profile}`

**Auth:** Required
**Description:** Calculate a turn-by-turn route between waypoints using the OSRM engine. The `profile` path parameter selects the travel mode.
**Request:** Path parameter `profile` — one of `driving`, `walking`, `cycling`.
**Response:**

```json
{
  "geometry": "encoded polyline",
  "distance": 12345.6,
  "duration": 3600,
  "steps": [{ "instruction", "distance", "duration", "geometry" }]
}
```

**Errors:** `400` Invalid profile or insufficient waypoints. `404` Route not found. `502` OSRM service unavailable.

---

### `GET /media/presign-upload`

**Auth:** Required
**Description:** Obtain a pre-signed S3 URL for direct media upload (images, GPX files). The client uploads the file directly to S3 using the returned URL.
**Request:** Query parameters — `filename` (required), `contentType` (required), `routeId` (optional).
**Response:**

```json
{
  "uploadUrl": "string",
  "key": "string",
  "expiresIn": 300
}
```

**Errors:** `400` Missing or invalid parameters.

---

### `POST /routes/telemetry`

**Auth:** Required
**Description:** Submit behavioral analytics events for route interactions (views, edits, shares). Used for usage tracking and product analytics.
**Request:**

```json
{
  "events": [
    {
      "type": "route_view | route_edit | route_share",
      "routeId": "string",
      "timestamp": "ISO-8601",
      "metadata": {}
    }
  ]
}
```

**Response:** `202 Accepted`.
**Errors:** `400` Malformed event payload.

---

## Chat

### `GET /chat/threads`

**Auth:** Required
**Description:** List all chat threads for the authenticated user. Backed by a DynamoDB GSI1 query for efficient retrieval.
**Request:** Query parameters — `limit` (default 20), `nextToken`.
**Response:**

```json
{
  "threads": [
    {
      "threadId": "string",
      "participants": ["userId"],
      "lastMessage": "string",
      "lastMessageAt": "ISO-8601",
      "unreadCount": 0
    }
  ],
  "nextToken": "string | null"
}
```

**Errors:** `401` Unauthorized.

---

### `POST /chat/threads`

**Auth:** Required
**Description:** Create a new 1:1 chat thread with another user. If a thread already exists between the two users, the existing thread is returned.
**Request:**

```json
{
  "participantId": "string"
}
```

**Response:** `201 Created` (or `200 OK` if existing) — thread object.
**Errors:** `400` Cannot create thread with self. `404` Participant not found.

---

### `GET /chat/threads/{id}/messages`

**Auth:** Required
**Description:** Retrieve messages in a thread with cursor-based pagination. Messages are returned in reverse chronological order.
**Request:** Query parameters — `limit` (default 50, max 100), `cursor` (opaque pagination token).
**Response:**

```json
{
  "messages": [
    {
      "messageId": "string",
      "senderId": "string",
      "content": "string",
      "sentAt": "ISO-8601"
    }
  ],
  "cursor": "string | null"
}
```

**Errors:** `403` Not a participant. `404` Thread not found.

---

### `POST /chat/threads/{id}/messages`

**Auth:** Required
**Description:** Send a message to a chat thread. Messages are limited to 2000 characters.
**Request:**

```json
{
  "content": "string (max 2000 chars)"
}
```

**Response:** `201 Created` — message object with `messageId` and `sentAt`.
**Errors:** `400` Message empty or exceeds 2000 characters. `403` Not a participant. `404` Thread not found.

---

## Auth & Profiles

### `POST /auth/reset-password`

**Auth:** None
**Description:** Initiate a password reset flow via Cognito. Sends a verification code to the user's registered email.
**Request:**

```json
{
  "email": "string"
}
```

**Response:** `200 OK` — confirmation that the reset email was sent.
**Errors:** `400` Invalid email format. `404` User not found (returns 200 to prevent enumeration in some configurations).

---

### `POST /auth/change-password`

**Auth:** Required
**Description:** Change the authenticated user's password. New password must be a minimum of 12 characters.
**Request:**

```json
{
  "previousPassword": "string",
  "proposedPassword": "string (min 12 chars)"
}
```

**Response:** `200 OK`.
**Errors:** `400` Password does not meet requirements. `401` Previous password incorrect.

---

### `POST /auth/refresh`

**Auth:** None (requires valid refresh token)
**Description:** Exchange a refresh token for a new access token and refresh token pair.
**Request:**

```json
{
  "refreshToken": "string"
}
```

**Response:**

```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "expiresIn": 3600
}
```

**Errors:** `401` Invalid or expired refresh token.

---

### `POST /profile/publish`

**Auth:** Required
**Description:** Publish the authenticated user's profile, making it publicly accessible via their username.
**Request:**

```json
{
  "bio": "string",
  "displayName": "string",
  "avatar": "string (S3 key)"
}
```

**Response:** `200 OK` — published profile object with public URL.
**Errors:** `400` Validation error. `409` Username already taken (if changed).

---

### `POST /profile/unpublish`

**Auth:** Required
**Description:** Remove the user's profile from public visibility. The profile data is retained but no longer accessible publicly.
**Response:** `200 OK`.
**Errors:** `404` Profile not published.

---

### `GET /profiles/{username}`

**Auth:** None
**Description:** Retrieve a user's public profile by username. Only returns data for published profiles.
**Response:**

```json
{
  "username": "string",
  "displayName": "string",
  "bio": "string",
  "avatar": "string",
  "routeCount": 0,
  "joinedAt": "ISO-8601"
}
```

**Errors:** `404` Profile not found or not published.

---

## Marketplace

### `GET /marketplace/guides`

**Auth:** Optional
**Description:** List available guides in the marketplace. Supports filtering and pagination.
**Request:** Query parameters — `limit`, `nextToken`, `category`, `sort` (newest/popular/price).
**Response:**

```json
{
  "guides": [
    {
      "id": "string",
      "title": "string",
      "author": "string",
      "price": 0,
      "currency": "USD",
      "rating": 4.5,
      "thumbnailUrl": "string"
    }
  ],
  "nextToken": "string | null"
}
```

**Errors:** None typical.

---

### `GET /marketplace/guides/{id}`

**Auth:** Optional
**Description:** Get full details for a specific guide, including description, preview images, and author info.
**Response:**

```json
{
  "id", "title", "description", "author", "price", "currency",
  "rating", "reviewCount", "thumbnailUrl", "previewImages",
  "createdAt", "updatedAt"
}
```

**Errors:** `404` Guide not found.

---

### `POST /marketplace/guides`

**Auth:** Required (seller role)
**Description:** Create a new guide listing in the marketplace. Requires seller permissions.
**Request:**

```json
{
  "title": "string",
  "description": "string",
  "price": 0,
  "currency": "USD",
  "pdfKey": "string (S3 key)",
  "thumbnailKey": "string (S3 key)",
  "category": "string"
}
```

**Response:** `201 Created` — guide object.
**Errors:** `400` Validation error. `403` Not a seller.

---

### `POST /marketplace/guides/{id}/purchase`

**Auth:** Required
**Description:** **DISABLED** — This endpoint is currently disabled and returns `503 Service Unavailable`. Purchase functionality is temporarily suspended.
**Response:** `503 Service Unavailable`.

---

### `GET /marketplace/guides/{id}/download`

**Auth:** Required
**Description:** Obtain a pre-signed S3 URL to download the guide PDF. The URL is valid for 15 minutes. Only accessible to users who have purchased the guide.
**Response:**

```json
{
  "downloadUrl": "string",
  "expiresIn": 900
}
```

**Errors:** `403` Guide not purchased. `404` Guide not found.

---

### `POST /marketplace/blogs`

**Auth:** Required
**Description:** Create a new blog post in the marketplace.
**Request:**

```json
{
  "title": "string",
  "content": "string (markdown)",
  "tags": ["string"],
  "coverImageKey": "string (S3 key)"
}
```

**Response:** `201 Created` — blog object.
**Errors:** `400` Validation error.

---

### `GET /marketplace/blogs`

**Auth:** Optional
**Description:** List published blog posts with pagination.
**Request:** Query parameters — `limit`, `nextToken`, `tag`, `authorId`.
**Response:**

```json
{
  "blogs": [
    { "id", "title", "author", "excerpt", "tags", "coverImageUrl", "publishedAt" }
  ],
  "nextToken": "string | null"
}
```

**Errors:** None typical.

---

### `GET /marketplace/blogs/{id}`

**Auth:** Optional
**Description:** Retrieve a single blog post by ID with full content.
**Response:**

```json
{
  "id", "title", "content", "author", "tags",
  "coverImageUrl", "publishedAt", "updatedAt"
}
```

**Errors:** `404` Blog not found.

---

## Stripe & Billing

### `GET /stripe/plans`

**Auth:** Optional
**Description:** Retrieve the product catalog including all subscription plans and their pricing.
**Response:**

```json
{
  "plans": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "price": 0,
      "currency": "USD",
      "interval": "month | year",
      "features": ["string"]
    }
  ]
}
```

**Errors:** `502` Stripe service unavailable.

---

### `POST /stripe/checkout`

**Auth:** Required
**Description:** Create a Stripe Checkout session for subscription purchase or credit top-up. Redirects the user to Stripe's hosted checkout page.
**Request:**

```json
{
  "priceId": "string",
  "successUrl": "string",
  "cancelUrl": "string"
}
```

**Response:**

```json
{
  "sessionId": "string",
  "url": "string"
}
```

**Errors:** `400` Invalid price ID. `409` Active subscription already exists (for subscription checkouts).

---

### `POST /stripe/portal`

**Auth:** Required
**Description:** Create a Stripe Customer Portal session for the user to manage their subscription, payment methods, and billing history.
**Request:**

```json
{
  "returnUrl": "string"
}
```

**Response:**

```json
{
  "url": "string"
}
```

**Errors:** `404` No Stripe customer record found.

---

### `GET /stripe/wallet`

**Auth:** Required
**Description:** Retrieve the authenticated user's credit balance and current subscription tier.
**Response:**

```json
{
  "credits": 50,
  "tier": "free | pro | premium",
  "frozen": false
}
```

**Errors:** `401` Unauthorized.

---

### `GET /stripe/subscription`

**Auth:** Required
**Description:** Get detailed subscription information for the authenticated user.
**Response:**

```json
{
  "subscriptionId": "string | null",
  "status": "active | canceled | past_due | trialing | none",
  "plan": "string",
  "currentPeriodEnd": "ISO-8601",
  "cancelAtPeriodEnd": false
}
```

**Errors:** `401` Unauthorized.

---

### `GET /stripe/session`

**Auth:** Required
**Description:** Check the status of a Stripe Checkout session. Used to confirm successful payment after redirect.
**Request:** Query parameter — `sessionId` (required).
**Response:**

```json
{
  "status": "complete | expired | open",
  "paymentStatus": "paid | unpaid | no_payment_required"
}
```

**Errors:** `400` Missing session ID. `404` Session not found.

---

### `POST /stripe/webhook`

**Auth:** None (verified via Stripe signature)
**Description:** Stripe webhook endpoint for processing subscription lifecycle events, payment confirmations, and invoice updates. Verified using Stripe's webhook signature — no JWT auth required.
**Request:** Raw Stripe event payload with `Stripe-Signature` header.
**Response:** `200 OK`.
**Errors:** `400` Invalid signature or unrecognized event type.

---

## AI

### `GET /ai`

**Auth:** Required
**Description:** Retrieve the current AI state for the authenticated user, including active conversation context, wallet balance, usage statistics, and AI preferences.
**Response:**

```json
{
  "conversation": {
    "conversationId": "string | null",
    "history": [{ "role": "user | assistant", "content": "string" }]
  },
  "wallet": {
    "credits": 50,
    "tier": "free | pro | premium"
  },
  "usage": {
    "today": 5,
    "dailyLimit": 20,
    "remaining": 15
  },
  "preferences": {
    "language": "en",
    "units": "metric | imperial"
  }
}
```

**Errors:** `401` Unauthorized.

---

### `POST /ai`

**Auth:** Required
**Description:** Send a prompt to the AI assistant. Each request type costs a different number of credits: **clarify = 0**, **chat = 1**, **route = 5**. Users are subject to a daily limit of **20 requests per day**.
**Request:**

```json
{
  "prompt": "string",
  "conversationHistory": [{ "role": "user | assistant", "content": "string" }],
  "requestId": "string (UUID, idempotency key)",
  "conversationId": "string | null"
}
```

**Response:**

```json
{
  "response": "string",
  "type": "clarify | chat | route",
  "creditsCost": 0,
  "creditsRemaining": 45,
  "conversationId": "string",
  "route": {
    "waypoints": [],
    "title": "string"
  }
}
```

The `route` field is only present when `type` is `route`.
**Errors:** `400` Empty prompt. `402` Insufficient credits. `429` Daily limit exceeded.

---

## Operations

### `GET /system/status`

**Auth:** None
**Description:** Public system status endpoint. Returns operational state of all services.
**Response:**

```json
{
  "status": "operational | degraded | outage",
  "services": {
    "api": "operational",
    "database": "operational",
    "ai": "operational",
    "stripe": "operational"
  },
  "updatedAt": "ISO-8601"
}
```

**Errors:** None.

---

### `GET /support/tickets`

**Auth:** Required
**Description:** List the authenticated user's support tickets.
**Request:** Query parameters — `limit`, `nextToken`, `status` (open/closed).
**Response:**

```json
{
  "tickets": [
    {
      "ticketId": "string",
      "subject": "string",
      "status": "open | in_progress | resolved | closed",
      "createdAt": "ISO-8601",
      "lastReplyAt": "ISO-8601"
    }
  ],
  "nextToken": "string | null"
}
```

**Errors:** `401` Unauthorized.

---

### `POST /support/tickets`

**Auth:** Required
**Description:** Create a new support ticket. Users may have a maximum of **10 open tickets** at any time.
**Request:**

```json
{
  "subject": "string",
  "message": "string",
  "category": "billing | technical | account | other"
}
```

**Response:** `201 Created` — ticket object.
**Errors:** `400` Validation error. `429` Maximum open ticket limit reached (10).

---

### `POST /support/tickets/{id}/reply`

**Auth:** Required
**Description:** Add a reply to an existing support ticket.
**Request:**

```json
{
  "message": "string"
}
```

**Response:** `201 Created` — reply object.
**Errors:** `400` Empty message. `403` Not the ticket owner. `404` Ticket not found.

---

### `GET /tracker/metrics`

**Auth:** Required
**Description:** Retrieve health metrics for the user's active tracker jobs, including success rates and last-check timestamps.
**Response:**

```json
{
  "activeJobs": 3,
  "totalChecks": 120,
  "successRate": 0.98,
  "lastCheckAt": "ISO-8601"
}
```

**Errors:** `401` Unauthorized.

---

### `GET /tracker/jobs`

**Auth:** Required
**Description:** List the authenticated user's tracker jobs (flight and hotel price trackers).
**Request:** Query parameters — `limit`, `nextToken`, `type` (flight/hotel).
**Response:**

```json
{
  "jobs": [
    {
      "jobId": "string",
      "type": "flight | hotel",
      "status": "active | paused | expired",
      "config": {},
      "lastResult": {},
      "createdAt": "ISO-8601"
    }
  ],
  "nextToken": "string | null"
}
```

**Errors:** `401` Unauthorized.

---

### `POST /tracker/jobs`

**Auth:** Required
**Description:** Create a new tracker job for monitoring flight or hotel prices.
**Request:**

```json
{
  "type": "flight | hotel",
  "config": {
    "origin": "string (IATA code, for flights)",
    "destination": "string (IATA code, for flights)",
    "checkIn": "YYYY-MM-DD",
    "checkOut": "YYYY-MM-DD",
    "hotelId": "string (for hotels)",
    "threshold": 0
  }
}
```

**Response:** `201 Created` — job object.
**Errors:** `400` Invalid configuration. `402` Feature requires paid tier.

---

### `DELETE /tracker/jobs/{id}`

**Auth:** Required
**Description:** Delete a tracker job. Stops all future price checks.
**Response:** `204 No Content`.
**Errors:** `404` Job not found.

---

### `POST /tracker/jobs/{id}/check`

**Auth:** Required
**Description:** Trigger an immediate manual price check for a tracker job, outside the normal schedule.
**Response:**

```json
{
  "result": {
    "price": 0,
    "currency": "USD",
    "checkedAt": "ISO-8601",
    "priceChange": -15.0
  }
}
```

**Errors:** `404` Job not found. `429` Too many manual checks (rate limited).
