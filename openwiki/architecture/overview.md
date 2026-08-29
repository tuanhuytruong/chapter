---
type: architecture-overview
title: System Architecture Overview
description: High-level system architecture of Chapter, detailing the React 19 and Vite frontend, Express TypeScript backend, PostgreSQL database, security, sessions, configuration, and API routing.
tags: [architecture, backend, frontend, database, security, configuration]
verified:
  - by: openwiki/0.4.3
    at: 2026-08-29T19:44:06.027Z
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
generated: { by: "openwiki/0.4.3", at: "2026-08-29T19:44:06.027Z" }
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

The backend entry point is `repo://server.ts`, which sets up the Express application instance, configures security headers, session storage, and mounts modular feature routers under `/api`.

### Key Responsibilities & Middleware
- **Security & Headers**: Implements custom Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), frame options (`DENY`), and rate limiting (`repo://src/auth-rate-limit.ts`) for sensitive authentication routes.
- **Session Management**: Session state is backed by PostgreSQL via `connect-pg-simple` operating within the `chapter` database schema (`repo://server.ts`).
- **Proxy Trust**: Configured with `app.set("trust proxy", 1)` to support secure cookies behind production reverse proxies.

### Modular API Routers
Routes are modularized into dedicated feature files and mounted in `repo://server.ts`:
- **Books & Reading**: `repo://src/routes/books.ts` handles book management, reading sessions, progress tracking, and reading markers.
- **Reviews & Community**: `repo://src/routes/reviews.ts` handles user reviews and community recall cards.
- **Uploads**: `repo://src/routes/upload.ts` manages EPUB, PDF, and cover image uploads.
- **Podcasts**: `repo://src/routes/podcasts.ts` and `repo://src/routes/podcast-recap.ts` manage audio generation queues and feeds.
- **Entitlements & Billing**: `repo://src/routes/entitlements.ts` and `repo://src/routes/billing.ts` manage subscription tiers and payment gateways.
- **Analytics & Reviews**: `repo://src/routes/monthly-review.ts` provides monthly retrospectives and momentum tracking.
- **AI & Cross-Book Intelligence**: `repo://src/routes/ask-reading.ts` and `repo://src/routes/cross-book-connections.ts` power LLM-based Q&A and cross-book synthesis (`repo://src/llm.ts`).
- **Telegram Integration**: `repo://src/telegram-link.ts` handles webhook linking for Telegram bot reminders and quick capture.

---

## 2. Database Layer & Persistence

Database interactions are managed through `repo://src/db.ts`, which wraps the node-postgres (`pg`) connection pool.

- **Schema Isolation**: Forces the search path to the `chapter` schema (`search_path=chapter`) across connections (`repo://src/db.ts`).
- **Query Execution & Timeouts**: Enforces timed execution wrappers (`timedQuery`, `backgroundQuery`, `withTransaction`) that apply strict statement and lock timeouts tailored for interactive requests versus background tasks (`repo://src/db.ts`).
- **Migrations & Verification**: Schema bootstrap and migrations are handled via `ensureSchema` and `verifyCoreSchema` (`repo://src/db.ts`).

---

## 3. Frontend Architecture & Client Routing

The client-side application is built as a single-page React application (`repo://src/App.tsx`), styled with Tailwind CSS, and bundled with Vite.

- **Client Entrypoint**: `repo://src/main.tsx` mounts the root React application into the DOM.
- **API Client Layer**: `repo://src/api.ts` provides strongly typed HTTP helper methods and data models interfacing with the backend REST endpoints.
- **Authentication Context**: `repo://src/AuthContext.tsx` manages active session state, loading gates, and redirects unauthenticated visitors to login/signup flows.
- **App Shell & Views**: `repo://src/components/AppShell.tsx` wraps authenticated routes (`/`, `/today`, `/books/:id`, `/insights`, `/review`, `/calendar`, `/momentum`, `/achievements`, `/profile`, `/account`, `/pricing`, `/quotes`).
- **Analytics & PostHog Identity**: `repo://src/analytics.ts` initializes PostHog analytics (`posthog-js`), associating user IDs and account handles upon successful authentication (`posthog.identify`) and resetting session tracking on logout (`posthog.reset`).

---

## 4. Configuration & Environment Management

Configuration handling is centralized in `repo://src/config.ts`, combining dotenv loading from `.env.local` with strict environment variable validation.

- **Environment Mode**: Validates `APP_ENV` to be either `prd` or `dev`.
- **Database & Timeouts**: Configures connection pools, query timeouts, and background worker limits.
- **External Integrations**: Manages API keys and endpoints for LLM services (9router), Telegram bots, VietQR billing, Resend email delivery, and Google OAuth.
