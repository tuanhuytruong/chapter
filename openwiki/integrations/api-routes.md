---
type: concept
title: API Routes
description: API surface, route handlers, and data flows for books, reading progress, and synthesis endpoints in Chapter.
tags: [api, routes, backend, express, documentation]
sources:
  - id: openwiki-source-9d47595c2a2ea0b2c9b2cc8d
    resource: repo://src/api.ts
  - id: openwiki-source-449cc5af19f441ac60ec275b
    resource: repo://src/routes/books.ts
generated: {by: "openwiki/0.4.0", at: "2026-08-25T17:44:34.504Z"}
verified:
  - by: openwiki/0.5.0
    at: 2026-09-05T16:00:46.565Z
---

# API Routes

The Chapter reading-companion backend exposes an authenticated API surface built with Express. Routes are organized around core domains: books and reading sessions, review schedules, weekly goals, dashboard metrics, entitlements, billing, and AI-driven reading synthesis features (such as reading progress companions, story threads, reading lenses, monthly reviews, and cross-book connections).

## Architecture & Entrypoints

The main Express application is configured in `server.ts`, which mounts various routers under `/api` or specific resource paths. Book-related routes are handled by `booksRouter` defined in `src/routes/books.ts`, while the unified TypeScript API client interface is defined in `src/api.ts`.

```mermaid
sequenceDiagram
    participant Client as Client App
    participant Server as Express Server (server.ts)
    participant Router as Books Router (/api/books)
    participant DB as PostgreSQL DB
    participant LLM as LLM Service

    Client->>Server: HTTP Request (e.g. POST /api/books/:id/advance)
    Server->>Router: Route Handler
    Router->>DB: Query Book & Current Round State
    DB-->>Router: Book & State Data
    Router->>LLM: Generate Insights / Summary
    LLM-->>Router: AI Response
    Router->>DB: Persist Log & Update Progress
    DB-->>Router: Commit Transaction
    Router-->>Client: JSON Response (AdvanceResult)
```
*Request flow for advancing a reading session and generating AI synthesis.*

## Core Endpoints & Data Flows

### 1. Books & Reading Sessions (`/api/books`)
- **`GET /api/books`**: Lists books based on scope (`mine` or `all`).
- **`POST /api/books`**: Creates or registers a new book entity.
- **`GET /api/books/:id`**: Retrieves details for a specific book.
- **`PATCH /api/books/:id`**: Updates book metadata.
- **`DELETE /api/books/:id`**: Deletes a book.
- **`POST /api/books/:id/advance`**: Advances reading progress for a book. Extracts units, invokes LLM summarization and insight extraction, writes a reading log, and returns an `AdvanceResult`.
- **`GET /api/books/:id/log`**: Fetches reading logs/history for a book and optional reading round.
- **`POST /api/books/:id/reread`**: Initiates a new reading round for a book.

### 2. Reading Synthesis & Companions
- **Reading Progress (`/api/books/:id/reading-progress`)**: Computes or retrieves companion reading progress summaries.
- **Reading Lens (`/api/books/:id/reading-lens`)**: Provides analytical lens breakdowns for reading logs.
- **Story Threads (`/api/books/:id/story-thread`)**: Tracks narrative and thematic continuity across reading sessions.
- **AI Synthesis Endpoints (`/api/monthly-review`, `/api/cross-book-connections`, `/api/ask-reading`, `/api/podcast-recap`)**: Aggregate insights across multiple books and sessions to generate comprehensive reviews, answers, and audio recaps.

### 3. Reviews, Goals, & Dashboard
- **`GET /api/reviews/due`**: Retrieves due spaced-repetition review cards.
- **`POST /api/reviews/:id`**: Submits a review outcome (`remembered: boolean`).
- **`GET /api/goals/weekly`**: Fetches weekly reading goal metrics and progress.
- **`GET /api/today`**: Provides the active dashboard state, including active books, today's progress, and queue information.

### 4. Entitlements & Billing
- **`GET /api/entitlements/me`**: Returns current subscription tier, feature availability, and usage limits.
- **`GET /api/billing/catalog`**: Exposes available billing SKUs and pricing tiers.
- **`POST /api/billing/orders`**: Creates a new billing order reference.

## Invariants, Security, and Failure Semantics

- **Authentication & Ownership**: All API routes under `booksRouter` require authentication via `requireAuth`. Mutation operations enforce ownership checks (`ownerCanMutate` / `requireOwner`).
- **Transaction Safety**: Complex operations like EPUB/PDF chunk ingestion and session advancement use database transactions (`withTransaction`) and advisory locks to prevent race conditions.
- **Text Safety**: PostgreSQL TEXT fields reject NUL bytes (`\u0000`), handled by `stripNul()` during ingestion.
- **Timezone consistency**: Daily summaries and progress calculations operate in the `Asia/Bangkok` timezone (`UTC+7`).
