---
type: architecture
title: Backend Architecture
description: Comprehensive documentation of the Express and Node.js backend server, middleware, authentication, and API routing architecture.
tags: [backend, express, node, routing, middleware, authentication, api]
verified:
  - by: openwiki/0.4.0
    at: 2026-08-26T19:17:20.603Z
sources:
  - id: openwiki-source-af559fee7f56cc7abf2bba79
    resource: repo://server.ts
generated: {by: "openwiki/0.4.0", at: "2026-08-26T19:17:20.603Z"}
---

# Backend Architecture

The backend server for OpenWiki / Chapter is built with Node.js and Express, orchestrating API routing, authentication, database persistence, session management, and integrations with external services (such as LLMs and billing).

## Server Initialization & Entrypoint

The main application server is initialized in `/server.ts`. It loads environment configuration via `dotenv`, configures Express middleware (including request compression, security headers, and JSON parsing), and attaches session and authentication mechanisms.

```typescript
import express, { Request, Response } from "express";
import compression from "compression";
import session from "express-session";
import pgSession from "connect-pg-simple";
// ...
const app = express();
const PORT = config.port;
```

### Security & Middleware Pipeline
The server establishes robust HTTP security headers prior to mounting any routers:
- **Content Security Policy (CSP)**: Restricts resource loading to trusted origins.
- **Referrer Policy**: Set to `strict-origin-when-cross-origin`.
- **Frame-Options**: Set to `DENY` to prevent clickjacking.
- **Permissions-Policy**: Disables unused browser APIs (camera, microphone, geolocation).
- **Cache Control**: Automatically applies `no-store` headers to any request path starting with `/api/`.

## Routing & Route Mounting

API routes are structured modularly under `src/routes/` and mounted onto the Express application in `server.ts`. Key mounted routers include:

- **Books Router**: `/api/books` (`src/routes/books.ts`)
- **Reviews Router**: `/api/reviews` (`src/routes/reviews.ts`)
- **Upload Router**: `/api/upload` (`src/routes/upload.ts`)
- **Podcasts Router**: `/api/podcasts` (`src/routes/podcasts.ts`)
- **Entitlements Router**: `/api/entitlements` (`src/routes/entitlements.ts`)
- **Billing Router**: `/api/billing` (`src/routes/billing.ts`)
- **Monthly Reviews**: `/api/monthly-review` (`src/routes/monthly-review.ts`)
- **Ask Reading**: `/api/ask-reading` (`src/routes/ask-reading.ts`)
- **Cross-Book Connections**: `/api/cross-book-connections` (`src/routes/cross-book-connections.ts`)
- **Podcast Recaps**: `/api/podcast-recap` (`src/routes/podcast-recap.ts`)

Additionally, public health checks are available:
- `GET /health`: Returns a lightweight JSON status `{ ok: true }` without requiring database queries or session verification.

## Authentication & Session Management

Session handling relies on `express-session` backed by PostgreSQL via `connect-pg-simple` (`pgSession`).

- **Store**: Uses the PostgreSQL pool (`getPool()`) targeting schema `chapter` and table `session`.
- **Security**: In production (`APP_ENV=prd`), `SESSION_SECRET` is strictly required. The application trusts a single reverse proxy (`app.set("trust proxy", 1)`) to handle secure cookies properly behind TLS termination.
- **Authentication Helpers**: Located in `src/auth.ts`, providing utilities such as `requireAuth`, `userFrom`, and `avatarFor` to guard protected API routes and inject user context into requests.
- **Rate Limiting**: Specialized rate-limiting policies for authentication routes are implemented in `src/auth-rate-limit.ts`.

## Database & Lifecycle Integration

- **Schema & Query**: Database connectivity, connection pooling, and schema verification are handled in `src/db.ts`.
- **User Lifecycle**: Login tracking, last-seen timestamps, and engagement metrics are updated asynchronously via `src/userLifecycleTracking.ts`.
