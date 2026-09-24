---
type: architecture-overview
title: System Architecture Overview
description: High-level system architecture of Chapter, detailing the React 19 and Vite frontend, Express TypeScript backend, PostgreSQL database, security, sessions, configuration, and API routing.
tags: [architecture, backend, frontend, database, security, configuration]
sources:
  - id: openwiki-source-af559fee7f56cc7abf2bba79
    resource: repo://server.ts
  - id: openwiki-source-9d47595c2a2ea0b2c9b2cc8d
    resource: repo://src/api.ts
  - id: openwiki-source-54631e6ebf1d3b815c4a5eed
    resource: repo://src/App.tsx
  - id: openwiki-source-2b68006c6421e01c95988dcc
    resource: repo://src/config.ts
  - id: openwiki-source-70d4664310eebb80ab5b564c
    resource: repo://src/db.ts
  - id: openwiki-source-95bfccfd0c712f6e72040e0d
    resource: repo://src/main.tsx
generated: { by: "openwiki/0.5.2", at: "2026-09-16T20:06:06.880Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-09-24T20:28:57.073Z
---

# System Architecture Overview

Chapter is a full-scale reading companion application designed for book lovers to track reading progress, manage libraries, generate AI-powered podcasts, capture insights, and review reading habits.

The system comprises an Express TypeScript backend server interacting with a PostgreSQL database via `pg`, and a single-page React frontend built with Vite, React Router, and Tailwind CSS.

```mermaid
flowchart TD
    Client[React Frontend / Vite SPA] -->|HTTP / REST API & JSON| Server[Express Backend / server.ts]
    Server -->|Session Storage & App Data| DB[(PostgreSQL Database / chapter schema)]
    Server -->|LLM / TTS / External APIs| AI[AI & Podcast Services]
    Client -->|Analytics Tracking & Identify| PH[PostHog Analytics]
```

---

## 1. Backend Architecture & Server Layout

The backend entry point is `repo://server.ts`, which initializes an Express application, configures security headers (including CSP and HSTS), enables session storage via `connect-pg-simple` in PostgreSQL, and mounts modular feature routers under `/api`.

### Key Responsibilities & Middleware
- **Security & Headers**: Implements custom Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), frame options (`DENY`), and rate limiting for sensitive authentication routes.
- **Session Management**: Session state is backed by PostgreSQL via `connect-pg-simple` operating within the `chapter` database schema (`repo://server.ts`).
- **Proxy Trust**: Configured with `app.set("trust proxy", 1)` to support secure cookies behind production reverse proxies.

### Modular API Routers
API routing is modularized into dedicated routers for books, reviews, upload, podcasts, entitlements, billing, monthly reviews, ask-reading, and cross-book connections, all mounted in `repo://server.ts`.

---

## 2. Database Layer & Persistence

Database operations are handled by `repo://src/db.ts` using a PostgreSQL connection pool configured to target the `chapter` schema.

- **Query Execution & Timeouts**: Database queries use timed execution wrappers that enforce statement and lock timeouts for request versus background operations within transactions.
- **Migrations & Verification**: Schema bootstrap and migrations are handled via `ensureSchema` and `verifyCoreSchema` modules.

---

## 3. Frontend Architecture & Client Routing

The client-side application is built as a single-page React application bundled with Vite.

- **Frontend Entry**: `repo://src/main.tsx` bootstraps the React application into the DOM.
- **Frontend Root**: `repo://src/App.tsx` configures client-side routing via React Router and wraps authenticated views with authentication, theme, and application providers.
- **API Client Layer**: The API client layer in `repo://src/api.ts` defines strongly typed request handlers, membership models, and data structures corresponding to backend REST endpoints.

---

## 4. Configuration & Environment Management

Configuration handling in `repo://src/config.ts` centralizes environment variables from `.env.local`, validating deployment modes (`prd` vs `dev`), timeouts, and third-party integration settings (e.g., LLM services, Telegram, billing).
