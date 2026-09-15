---
type: architecture
title: Backend Architecture
description: Comprehensive documentation of the Express and Node.js backend server, middleware, authentication, and API routing architecture.
tags: [backend, express, node, routing, middleware, authentication, api]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-15T20:14:22.648Z
sources:
  - id: openwiki-source-af559fee7f56cc7abf2bba79
    resource: repo://server.ts
generated: { by: "openwiki/0.5.2", at: "2026-09-15T20:14:22.648Z" }
---

# Backend Architecture

The backend server for OpenWiki / Chapter is built with Node.js and Express, orchestrating API routing, authentication, database persistence, session management, and integrations with external services.

## Server Initialization & Entrypoint

The main application server is initialized in `/server.ts`. It loads environment configuration via `dotenv`, configures Express middleware (including request compression, security headers, and JSON parsing), and attaches session and authentication mechanisms.

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Lexical error on line 4. Unrecognized text. ...-> D[/api/books/...] C -> E[/api/a -->
```text
graph TD
    A[Client Request] --> B[Security Headers/Middleware]
    B --> C{Route Router}
    C --> D[/api/books/...]
    C --> E[/api/auth/...]
    C --> F[/health]
    D --> G[Database]
    E --> H[Session/Auth Manager]
```

## Security & Middleware Pipeline

The server establishes robust HTTP security headers prior to mounting any routers:
- **Content Security Policy (CSP)**: Restricts resource loading to trusted origins.
- **Referrer Policy**: Set to `strict-origin-when-cross-origin`.
- **Frame-Options**: Set to `DENY` to prevent clickjacking.
- **Permissions-Policy**: Disables unused browser APIs.
- **Cache Control**: Automatically applies `no-store` headers to any request path starting with `/api/`.

## Routing & Route Mounting

API routes are structured modularly under `src/routes/` and mounted onto the Express application in `server.ts`. Key mounted routers include:

- **Books & Reviews**: `/api/books`, `/api/reviews`
- **Media**: `/api/podcasts`, `/api/podcast-recap`
- **User/Billing**: `/api/billing`, `/api/entitlements`
- **Features**: `/api/monthly-review`, `/api/ask-reading`, `/api/cross-book-connections`
- **Admin/Support**: `/api/upload`

Additionally, a public health check endpoint is provided at `GET /health` which returns `{ ok: true }` without requiring database or session verification.

## Authentication & Session Management

Session handling relies on `express-session` backed by PostgreSQL via `connect-pg-simple`.

- **Store**: Uses the PostgreSQL pool (`getPool()`) targeting schema `chapter` and table `session`.
- **Helpers**: Utilities in `src/auth.ts` (`requireAuth`, `userFrom`) protect routes and inject user context.
- **Rate Limiting**: Authentication-specific limits are defined in `src/auth-rate-limit.ts`.

## Database & Lifecycle Integration

- **Connectivity**: Managed by `src/db.ts` utilizing connection pooling.
- **Tracking**: User lifecycle events are processed asynchronously via `src/userLifecycleTracking.ts`.
