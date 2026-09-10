---
type: architecture
title: Database Schema & Migrations
description: Comprehensive documentation of PostgreSQL schema, connection management in src/db.ts, database migrations, indexing, ownership constraints, and transactional safety for reading sessions.
tags: [database, postgresql, schema, migrations, transactions, architecture]
verified:
  - by: openwiki/0.5.1
    at: 2026-09-10T19:40:31.384Z
sources:
  - id: openwiki-source-25fa9ab7c0715dd94360a213
    resource: repo://migrations/20260728_add_podcast.sql
  - id: openwiki-source-1e2ee3ecb23f8d762250ed49
    resource: repo://migrations/20260802_add_reading_rounds.sql
  - id: openwiki-source-86caf049cf49aa6c6ac643ce
    resource: repo://migrations/20260805_podcast_narrator_per_round.sql
  - id: openwiki-source-1c4642b1e8b0904d58359f74
    resource: repo://migrations/20260826_add_podcast_unavailable_status.sql
  - id: openwiki-source-6b1db57a0627fa8cd59cc63a
    resource: repo://migrations/20260829_backfill_reading_round_history.sql
  - id: openwiki-source-066188e04e203a08bb0227d4
    resource: repo://migrations/20260908_add_unified_library_search.sql
  - id: openwiki-source-70d4664310eebb80ab5b564c
    resource: repo://src/db.ts
  - id: openwiki-source-125e76395473d098c7269d6d
    resource: repo://src/db/schema.sql
generated: { by: "openwiki/0.5.1", at: "2026-09-10T19:40:31.384Z" }
---

# Database Schema & Migrations

The Chapter AI Daily Book Reading Companion relies on PostgreSQL (targeting PostgreSQL 13+) for persistent data storage, session management, and transaction safety. The schema is organized under the dedicated `chapter` schema within the database (configured via connection string search paths and connection bootstrapping) [repo://src/db/schema.sql#L15-L16].

---

## Connection Management & Execution (`src/db.ts`)

Database connections are managed via `node-postgres` (`pg`) in `src/db.ts`. Connection pooling and query safety are structured around distinct execution patterns and timeouts:

- **Pool Configuration**: `getPool()` initializes a shared `Pool` configured via `DATABASE_URL` or fallback localhost parameters (`chapter` database, user `postgres`, max 10 connections) [repo://src/db.ts#L25-L40].
- **Date Parser Optimization**: PostgreSQL `DATE` columns (OID `1082`) are parsed into plain `YYYY-MM-DD` strings rather than JavaScript `Date` objects. This prevents timezone shifting issues during JSON serialization across Express [repo://src/db.ts#L4-L11].
- **Timeouts & Safety**:
  - **Request Budgets (`query`, `withTransaction`)**: Enforce stricter statement and lock timeouts (`dbRequestStatementTimeoutMs`, `dbRequestLockTimeoutMs`) designed for fast HTTP request SLAs [repo://src/db.ts#L16-L19, L102, L143].
  - **Background Budgets (`backgroundQuery`, `withBackgroundTransaction`)**: Provide larger timeouts (`dbBackgroundStatementTimeoutMs`, `dbBackgroundLockTimeoutMs`) for batch processing, AI enrichment, and backfill tasks [repo://src/db.ts#L20-L23, L107, L148].
- **Transactional Safety**: `timedTransaction` and `timedQuery` wrap operations in an explicit `BEGIN`, apply local transaction-level timeouts via `set_config('statement_timeout', ...)` and `set_config('lock_timeout', ...)` with `is_local = true`, and guarantee robust `COMMIT` or `ROLLBACK` handling [repo://src/db.ts#L56-L98, L120-L140].

---

## Core Database Schema

The complete database schema is maintained in `src/db/schema.sql` and verified on startup via `verifyCoreSchema()` [repo://src/db.ts#L154-L197].

```mermaid
erDiagram
    users {
        UUID id PK
        TEXT username UK
        TEXT environment
        TEXT email
        TEXT telegram_chat_id
        TIMESTAMPTZ created_at
    }

    books {
        UUID id PK
        TEXT title
        TEXT author
        TEXT file_path
        TEXT file_type
        INT total_pages
        INT current_page
        INT current_reading_round
        TEXT status
        TIMESTAMPTZ created_at
    }

    reading_log {
        UUID id PK
        UUID book_id FK
        INT reading_round
        INT page_start
        INT page_end
        TIMESTAMPTZ created_at
    }

    book_reading_rounds {
        UUID book_id PK
        INT reading_round PK
        TEXT status
        TIMESTAMPTZ started_at
        TIMESTAMPTZ finished_at
        INT final_page
    }

    podcasts {
        UUID id PK
        UUID book_id FK
        INT reading_round
        TEXT status
        TEXT audio_url
    }

    search_documents {
        UUID id PK
        UUID owner_id FK
        UUID book_id FK
        TEXT kind
        TEXT body
        tsvector search_vector
    }
```

---

## Database Schema Changes

Recent schema migrations focus on unifying search capabilities across generated and user-provided artifacts:

- `20260908_add_unified_library_search.sql`: Introduces `chapter.search_documents` for efficient, normalized full-text search across books, wikis, notes, reflections, story threads, and story memory snapshots. This table utilizes GIN indexes on `search_vector` for high-performance retrieval [repo://migrations/20260908_add_unified_library_search.sql].
